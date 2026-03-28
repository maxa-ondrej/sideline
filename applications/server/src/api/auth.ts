import { HttpApiBuilder, HttpClient, HttpClientRequest } from '@effect/platform';
import { ApiGroup, Auth, Discord, Role, type Team, type User } from '@sideline/domain';
import { DiscordConfig, DiscordREST, DiscordRESTLive, MemoryRateLimitStoreLive } from 'dfx';
import {
  Array,
  DateTime,
  Effect,
  flow,
  Layer,
  Option,
  pipe,
  Redacted,
  Schema,
  Struct,
} from 'effect';
import { Api } from '~/api/api.js';
import { Redirect } from '~/api/index.js';
import { env } from '~/env.js';
import { BotGuildsRepository } from '~/repositories/BotGuildsRepository.js';
import { OAuthConnectionsRepository } from '~/repositories/OAuthConnectionsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { DiscordOAuth } from '~/services/DiscordOAuth.js';

class AuthError extends Schema.TaggedError<AuthError>()('AuthError', {
  error: Schema.Literal('auth_failed'),
  reason: Schema.String,
}) {
  static withReason = (reason: string) => new AuthError({ error: 'auth_failed', reason });

  static failCause = (cause: unknown) =>
    Effect.logError('[auth/callback] unexpected error during OAuth flow', cause).pipe(
      Effect.flatMap(() => Effect.fail(this.withReason('oauth_failed'))),
    );
}

const CustomClient = HttpClient.HttpClient.pipe(
  Effect.bindTo('client'),
  Effect.bind('config', () => DiscordConfig.DiscordConfig),
  Effect.map(({ client, config }) =>
    client.pipe(
      HttpClient.mapRequest(HttpClientRequest.bearerToken(config.token)),
      HttpClient.tapRequest(Effect.logDebug),
    ),
  ),
  Layer.effect(HttpClient.HttpClient),
);

const LoginSchema = Schema.parseJson(
  Schema.Struct({
    id: Schema.UUID,
    redirectUrl: Schema.URL,
  }),
);

const handleDiscordLogin = ({
  code,
  state,
  discord,
  users,
  sessions,
  oauthConnections,
}: {
  code: string;
  state: Schema.Schema.Type<typeof LoginSchema>;
  discord: DiscordOAuth;
  users: UsersRepository;
  sessions: SessionsRepository;
  oauthConnections: OAuthConnectionsRepository;
}) =>
  Effect.Do.pipe(
    Effect.bind('oauth', () => discord.validateAuthorizationCode(code)),
    Effect.tap(() =>
      Effect.logInfo(
        '[auth/callback] oauth token exchange succeeded, building Discord REST client',
      ),
    ),
    Effect.let('DiscordConfigLive', ({ oauth }) =>
      DiscordConfig.layer({
        token: Redacted.make(oauth.accessToken()),
      }),
    ),
    Effect.bind('client', ({ DiscordConfigLive }) =>
      DiscordREST.pipe(
        Effect.provide(
          DiscordRESTLive.pipe(
            Layer.provideMerge(CustomClient),
            Layer.provideMerge(MemoryRateLimitStoreLive),
            Layer.provideMerge(DiscordConfigLive),
          ),
        ),
      ),
    ),
    Effect.tap(() =>
      Effect.logInfo('[auth/callback] Discord REST client ready, calling getMyUser()'),
    ),
    Effect.bind('discordUser', ({ client }) => client.getMyUser()),
    Effect.tap(({ discordUser }) =>
      Effect.logInfo('[auth/callback] getMyUser() succeeded', {
        discordId: discordUser.id,
        username: discordUser.username,
      }),
    ),
    Effect.let('sessionToken', () => crypto.randomUUID()),
    Effect.bind('now', () => DateTime.now),
    Effect.let('expiresAt', ({ now }) => DateTime.add(now, { days: 30 })),
    Effect.bind('dbUser', ({ discordUser }) =>
      users.upsertFromDiscord({
        discord_id: discordUser.id,
        username: discordUser.username,
        avatar: Option.fromNullable(discordUser.avatar),
      }),
    ),
    Effect.tap(({ dbUser }) =>
      Effect.logInfo('[auth/callback] user upserted in db', { userId: dbUser.id }),
    ),
    Effect.tap(({ dbUser, oauth }) =>
      oauthConnections.upsert(
        dbUser.id,
        'discord',
        oauth.accessToken(),
        Option.fromNullable(oauth.refreshToken()),
      ),
    ),
    Effect.bind('session', ({ dbUser, sessionToken, expiresAt }) =>
      sessions.create({
        user_id: dbUser.id,
        token: sessionToken,
        expires_at: expiresAt,
        created_at: undefined,
      }),
    ),
    Effect.tap(() => Effect.logInfo('[auth/callback] session created, redirecting')),
    Effect.catchTag('RequestError', 'ResponseError', 'DiscordOAuthError', AuthError.failCause),
    Effect.map(({ sessionToken }) =>
      pipe(
        Redirect.fromUrl(state.redirectUrl),
        Redirect.withSearchParam('token', sessionToken),
        Redirect.toResponse,
      ),
    ),
    Effect.catchTag('ErrorResponse', (e) =>
      Effect.logError('[auth/callback] Discord API returned ErrorResponse in getMyUser()', e).pipe(
        Effect.flatMap(() => Effect.fail(AuthError.withReason('profile_failed'))),
      ),
    ),
    Effect.catchTag('RatelimitedResponse', (e) =>
      Effect.logError('[auth/callback] Discord API rate-limited us', e).pipe(
        Effect.flatMap(() => Effect.fail(AuthError.withReason('rate_limited'))),
      ),
    ),
    Effect.catchTag('NoSuchElementException', Effect.die),
  );

const emptyTeams: ReadonlyArray<Auth.UserTeam> = [];

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

const makeUserDiscordClient = (accessToken: string) =>
  DiscordREST.pipe(
    Effect.provide(
      DiscordRESTLive.pipe(
        Layer.provideMerge(CustomClient),
        Layer.provideMerge(MemoryRateLimitStoreLive),
        Layer.provideMerge(
          DiscordConfig.layer({
            token: Redacted.make(accessToken),
          }),
        ),
      ),
    ),
  );

export const AuthApiLive = HttpApiBuilder.group(Api, 'auth', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('discord', () => DiscordOAuth),
    Effect.bind('users', () => UsersRepository),
    Effect.bind('sessions', () => SessionsRepository),
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('teams', () => TeamsRepository),
    Effect.bind('roles', () => RolesRepository),
    Effect.bind('botGuilds', () => BotGuildsRepository),
    Effect.bind('oauthConnections', () => OAuthConnectionsRepository),
    Effect.map(({ discord, users, sessions, members, teams, roles, botGuilds, oauthConnections }) =>
      handlers
        .handle('getLogin', () =>
          Effect.succeed(
            new URL(env.SERVER_URL + Auth.AuthApiGroup.pipe(ApiGroup.getEndpoint('doLogin')).path),
          ),
        )
        .handle('doLogin', () =>
          Effect.sync(() => crypto.randomUUID()).pipe(
            Effect.bindTo('id'),
            Effect.let('redirectUrl', () => env.FRONTEND_URL),
            Effect.flatMap(Schema.encode(LoginSchema)),
            Effect.flatMap(discord.createAuthorizationURL),
            Effect.map(Redirect.fromUrl),
            Effect.map(Redirect.toResponse),
            Effect.catchTag('ParseError', AuthError.failCause),
            Effect.catchTag('AuthError', (e) =>
              pipe(
                Redirect.fromUrl(env.FRONTEND_URL),
                Redirect.withSearchParam('error', e.error),
                Redirect.withSearchParam('reason', e.reason),
                Redirect.toResponse,
                Effect.succeed,
              ),
            ),
          ),
        )
        .handle('callback', ({ urlParams: { code, state, error } }) =>
          Effect.Do.pipe(
            Effect.tap(() =>
              Effect.logInfo('[auth/callback] received callback', {
                hasCode: Option.isSome(code),
                hasState: Option.isSome(state),
                hasError: Option.isSome(error),
              }),
            ),
            Effect.bind('code', () => code),
            Effect.bind('stateRaw', () => state),
            Effect.catchTag('NoSuchElementException', () =>
              AuthError.withReason(Option.getOrElse(error, () => 'missing_params')),
            ),
            Effect.bind('state', ({ stateRaw }) => Schema.decode(LoginSchema)(stateRaw)),
            Effect.tap(({ state }) =>
              Effect.logInfo('[auth/callback] state decoded', {
                redirectUrl: state.redirectUrl.toString(),
                frontendUrl: env.FRONTEND_URL.toString(),
              }),
            ),
            Effect.andThen(({ state, code }) =>
              handleDiscordLogin({ code, state, discord, users, sessions, oauthConnections }),
            ),
            Effect.catchTag('ParseError', AuthError.failCause),
            Effect.catchTag('AuthError', (e) =>
              pipe(
                Redirect.fromUrl(env.FRONTEND_URL),
                Redirect.withSearchParam('error', e.error),
                Redirect.withSearchParam('reason', e.reason),
                Redirect.toResponse,
                Effect.succeed,
              ),
            ),
          ),
        )
        .handle('me', () => Auth.CurrentUserContext)
        .handle('updateLocale', ({ payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('updated', ({ currentUser }) =>
              users.updateLocale({
                id: currentUser.id,
                locale: payload.locale,
              }),
            ),

            Effect.map(
              ({ updated }) =>
                new Auth.CurrentUser({
                  id: updated.id,
                  discordId: updated.discord_id,
                  username: updated.username,
                  avatar: updated.avatar,
                  isProfileComplete: updated.is_profile_complete,
                  name: updated.name,
                  birthDate: Option.map(updated.birth_date, DateTime.formatIsoDateUtc),
                  gender: updated.gender,
                  locale: updated.locale,
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('updateProfile', ({ payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('updated', ({ currentUser }) =>
              users.updateAdminProfile({
                id: currentUser.id,
                name: payload.name,
                birth_date: Option.map(payload.birthDate, DateTime.unsafeMake),
                gender: payload.gender,
              }),
            ),

            Effect.map(
              ({ updated }) =>
                new Auth.CurrentUser({
                  id: updated.id,
                  discordId: updated.discord_id,
                  username: updated.username,
                  avatar: updated.avatar,
                  isProfileComplete: updated.is_profile_complete,
                  name: updated.name,
                  birthDate: Option.map(updated.birth_date, DateTime.formatIsoDateUtc),
                  gender: updated.gender,
                  locale: updated.locale,
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('completeProfile', ({ payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('updated', ({ currentUser }) =>
              users.completeProfile({
                id: currentUser.id,
                name: Option.some(payload.name),
                birth_date: Option.some(DateTime.unsafeMake(payload.birthDate)),
                gender: Option.some(payload.gender),
              }),
            ),

            Effect.map(
              ({ updated }) =>
                new Auth.CurrentUser({
                  id: updated.id,
                  discordId: updated.discord_id,
                  username: updated.username,
                  avatar: updated.avatar,
                  isProfileComplete: updated.is_profile_complete,
                  name: updated.name,
                  birthDate: Option.map(updated.birth_date, DateTime.formatIsoDateUtc),
                  gender: updated.gender,
                  locale: updated.locale,
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('myTeams', () =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('memberships', ({ currentUser }) => members.findByUser(currentUser.id)),
            Effect.flatMap(
              flow(
                Struct.get('memberships'),
                Array.map((m) =>
                  teams.findById(m.team_id).pipe(
                    Effect.flatMap(
                      Option.match({
                        onNone: () => Effect.fail(new Auth.Unauthorized()),
                        onSome: Effect.succeed,
                      }),
                    ),
                    Effect.map(
                      (team) =>
                        new Auth.UserTeam({
                          teamId: team.id,
                          teamName: team.name,
                          logoUrl: team.logo_url,
                          roleNames: m.role_names,
                          permissions: m.permissions,
                        }),
                    ),
                  ),
                ),
                (all) => Effect.all(all, { concurrency: 'unbounded' }),
              ),
            ),
          ),
        )
        .handle('myGuilds', () =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('accessToken', ({ currentUser }) =>
              oauthConnections.getAccessToken(currentUser.id, 'discord').pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Auth.Unauthorized()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('client', ({ accessToken }) => makeUserDiscordClient(accessToken)),
            Effect.bind('guilds', ({ client }) => client.listMyGuilds()),
            Effect.flatMap(({ guilds }) =>
              Effect.all(
                pipe(
                  guilds,
                  Array.filter((g) => {
                    const perms = BigInt(g.permissions);
                    return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
                  }),
                  Array.map((g) =>
                    botGuilds.exists(Schema.decodeSync(Discord.Snowflake)(g.id)).pipe(
                      Effect.map(
                        (present) =>
                          new Auth.DiscordGuild({
                            id: Schema.decodeSync(Discord.Snowflake)(g.id),
                            name: g.name,
                            icon: Option.fromNullable(g.icon),
                            owner: g.owner,
                            botPresent: present,
                          }),
                      ),
                    ),
                  ),
                ),
                { concurrency: 'unbounded' },
              ),
            ),
            Effect.catchTag('RequestError', 'ResponseError', () =>
              Effect.fail(new Auth.Unauthorized()),
            ),
            Effect.catchTag('ErrorResponse', () => Effect.fail(new Auth.Unauthorized())),
            Effect.catchTag('RatelimitedResponse', () => Effect.fail(new Auth.Unauthorized())),
          ),
        )
        .handle('createTeam', ({ payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('team', ({ currentUser }) =>
              teams.insert({
                name: payload.name,
                guild_id: payload.guildId,
                description: Option.none(),
                sport: Option.none(),
                logo_url: Option.none(),
                created_by: currentUser.id,
                created_at: undefined,
                updated_at: undefined,
              }),
            ),
            Effect.bind('seededRoles', ({ team }) => roles.seedTeamRolesWithPermissions(team.id)),
            Effect.bind('adminRole', ({ seededRoles }) =>
              pipe(
                seededRoles,
                Array.findFirst((r) => r.name === 'Admin'),
                Option.match({
                  onNone: () => Effect.fail(new Auth.Unauthorized()),
                  onSome: Effect.succeed,
                }),
              ),
            ),
            Effect.bind('newMember', ({ team, currentUser }) =>
              members.addMember({
                team_id: team.id,
                user_id: currentUser.id,
                active: true,
                joined_at: undefined,
              }),
            ),
            Effect.tap(({ newMember, adminRole }) =>
              members.assignRole(newMember.id, adminRole.id),
            ),
            Effect.map(
              ({ team }) =>
                new Auth.UserTeam({
                  teamId: team.id,
                  teamName: team.name,
                  logoUrl: team.logo_url,
                  roleNames: ['Admin'],
                  permissions: [...Role.defaultPermissions.Admin],
                }),
            ),
            Effect.catchTag('MemberAlreadyExistsError', Effect.die),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('autoJoinTeams', () => {
          const tryJoinTeam = (team: Team.Team, userId: User.UserId) =>
            members.findMembershipByIds(team.id, userId).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    members.getPlayerRoleId(team.id).pipe(
                      Effect.flatMap(
                        Option.match({
                          onNone: () => Effect.succeed(Option.none<Auth.UserTeam>()),
                          onSome: (role) =>
                            Effect.Do.pipe(
                              Effect.bind('membership', () =>
                                members.addMember({
                                  team_id: team.id,
                                  user_id: userId,
                                  active: true,
                                  joined_at: undefined,
                                }),
                              ),
                              Effect.tap(({ membership }) =>
                                members.assignRole(membership.id, role.id),
                              ),
                              Effect.tap(() =>
                                Effect.logInfo('[auth/autoJoinTeams] joined team', {
                                  teamId: team.id,
                                  teamName: team.name,
                                }),
                              ),
                              Effect.map(() =>
                                Option.some(
                                  new Auth.UserTeam({
                                    teamId: team.id,
                                    teamName: team.name,
                                    logoUrl: team.logo_url,
                                    roleNames: ['Player'],
                                    permissions: [...Role.defaultPermissions.Player],
                                  }),
                                ),
                              ),
                              Effect.catchTag('MemberAlreadyExistsError', () =>
                                Effect.succeed(Option.none<Auth.UserTeam>()),
                              ),
                            ),
                        }),
                      ),
                    ),
                  onSome: () => Effect.succeed(Option.none<Auth.UserTeam>()),
                }),
              ),
            );

          return Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.flatMap(({ currentUser }) =>
              !currentUser.isProfileComplete
                ? Effect.succeed(emptyTeams)
                : oauthConnections.getAccessToken(currentUser.id, 'discord').pipe(
                    Effect.flatMap(
                      Option.match({
                        onNone: () => Effect.succeed(emptyTeams),
                        onSome: (accessToken) =>
                          Effect.Do.pipe(
                            Effect.bind('client', () => makeUserDiscordClient(accessToken)),
                            Effect.bind('guilds', ({ client }) => client.listMyGuilds()),
                            Effect.let('guildIds', ({ guilds }) =>
                              Array.map(guilds, (g) => Schema.decodeSync(Discord.Snowflake)(g.id)),
                            ),
                            Effect.flatMap(({ guildIds }) =>
                              Array.isEmptyReadonlyArray(guildIds)
                                ? Effect.succeed(emptyTeams)
                                : teams.findByGuildIds(guildIds).pipe(
                                    Effect.flatMap((matchingTeams) =>
                                      Effect.all(
                                        Array.map(matchingTeams, (team) =>
                                          tryJoinTeam(team, currentUser.id),
                                        ),
                                        { concurrency: 'unbounded' },
                                      ),
                                    ),
                                    Effect.map(Array.getSomes),
                                  ),
                            ),
                            Effect.catchTag(
                              'RequestError',
                              'ResponseError',
                              'ErrorResponse',
                              'RatelimitedResponse',
                              () => Effect.succeed(emptyTeams),
                            ),
                          ),
                      }),
                    ),
                  ),
            ),
            // NoSuchElementException can be produced by Auth.CurrentUserContext when no session exists
            Effect.catchTag('NoSuchElementException', Effect.die),
          );
        }),
    ),
  ),
);
