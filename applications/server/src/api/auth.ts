import { URL } from 'node:url';
import { HttpApiBuilder, HttpClient, HttpClientRequest } from '@effect/platform';
import { ApiGroup, Auth } from '@sideline/domain';
import { DiscordConfig, DiscordREST, DiscordRESTLive, MemoryRateLimitStoreLive } from 'dfx';
import { DateTime, Effect, Layer, Option, pipe, Redacted, Schema } from 'effect';
import { Api } from '~/api/api.js';
import { Redirect } from '~/api/index.js';
import { env } from '~/env.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
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

const DiscordRestLive = Layer.merge(DiscordRESTLive, CustomClient);

const LoginSchema = Schema.parseJson(
  Schema.Struct({
    id: Schema.UUID,
    redirectUrl: Schema.URL,
  }),
);

type LoginState = Schema.Schema.Type<typeof LoginSchema>;

const redirectForPreviews = ({
  state,
  stateRaw,
  code,
}: {
  state: LoginState;
  stateRaw: string;
  code: string;
}) =>
  Effect.succeed(
    pipe(
      Redirect.fromUrl(
        new URL(
          env.API_PREFIX + Auth.AuthApiGroup.pipe(ApiGroup.getEndpoint('callback')).path,
          state.redirectUrl.origin,
        ),
      ),
      Redirect.withSearchParam('state', stateRaw),
      Redirect.withSearchParam('code', code),
      Redirect.toResponse,
    ),
  );

const handleDiscordLogin = ({
  code,
  state,
  discord,
  users,
  sessions,
}: {
  code: string;
  state: LoginState;
  discord: DiscordOAuth;
  users: UsersRepository;
  sessions: SessionsRepository;
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
      Effect.provide(
        DiscordREST,
        pipe(
          DiscordRestLive,
          Layer.provideMerge(Layer.merge(MemoryRateLimitStoreLive, DiscordConfigLive)),
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
    Effect.bind('dbUser', ({ discordUser, oauth }) =>
      users.upsertFromDiscord({
        discord_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: discordUser.avatar ?? null,
        discord_access_token: oauth.accessToken(),
        discord_refresh_token: oauth.refreshToken(),
      }),
    ),
    Effect.tap(({ dbUser }) =>
      Effect.logInfo('[auth/callback] user upserted in db', { userId: dbUser.id }),
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
    Effect.catchTag(
      'RequestError',
      'ResponseError',
      'DiscordOAuthError',
      'SqlError',
      'ParseError',
      'NoSuchElementException',
      AuthError.failCause,
    ),
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
  );

export const AuthApiLive = HttpApiBuilder.group(Api, 'auth', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('discord', () => DiscordOAuth),
    Effect.bind('users', () => UsersRepository),
    Effect.bind('sessions', () => SessionsRepository),
    Effect.map(({ discord, users, sessions }) =>
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
            Effect.andThen(({ state, stateRaw, code }) =>
              env.NODE_ENV === 'development' &&
              state.redirectUrl.toString().startsWith(env.FRONTEND_URL.toString())
                ? handleDiscordLogin({ code, state, discord, users, sessions })
                : redirectForPreviews({ state, stateRaw, code }),
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
            Effect.mapError(() => new Auth.Unauthorized()),
            Effect.map(
              ({ updated }) =>
                new Auth.CurrentUser({
                  id: updated.id,
                  discordId: updated.discord_id,
                  discordUsername: updated.discord_username,
                  discordAvatar: updated.discord_avatar,
                  isProfileComplete: updated.is_profile_complete,
                  name: updated.name,
                  birthYear: updated.birth_year,
                  gender: updated.gender,
                  jerseyNumber: updated.jersey_number,
                  position: updated.position,
                  proficiency: updated.proficiency,
                  locale: updated.locale,
                }),
            ),
          ),
        )
        .handle('completeProfile', ({ payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('updated', ({ currentUser }) =>
              users.completeProfile({
                id: currentUser.id,
                name: payload.name,
                birth_year: payload.birthYear,
                gender: payload.gender,
                jersey_number: Option.getOrNull(payload.jerseyNumber),
                position: payload.position,
                proficiency: payload.proficiency,
              }),
            ),
            Effect.mapError(() => new Auth.Unauthorized()),
            Effect.map(
              ({ updated }) =>
                new Auth.CurrentUser({
                  id: updated.id,
                  discordId: updated.discord_id,
                  discordUsername: updated.discord_username,
                  discordAvatar: updated.discord_avatar,
                  isProfileComplete: updated.is_profile_complete,
                  name: updated.name,
                  birthYear: updated.birth_year,
                  gender: updated.gender,
                  jerseyNumber: updated.jersey_number,
                  position: updated.position,
                  proficiency: updated.proficiency,
                  locale: updated.locale,
                }),
            ),
          ),
        ),
    ),
  ),
);
