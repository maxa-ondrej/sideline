import { URL } from 'node:url';
import { HttpApiBuilder, HttpClient, HttpClientRequest } from '@effect/platform';
import { ApiGroup, Auth } from '@sideline/domain';
import { DiscordConfig, DiscordREST, DiscordRESTLive, MemoryRateLimitStoreLive } from 'dfx';
import { Data, DateTime, Effect, flow, Layer, Option, pipe, Redacted, Schema } from 'effect';
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
    Effect.logError(cause).pipe(Effect.flatMap(() => Effect.fail(this.withReason('oauth_failed'))));
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

class BadOriginError extends Data.TaggedError('BadOriginError')<{
  redirect: Redirect;
}> {}

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
            Effect.bind('code', () => code),
            Effect.bind('stateRaw', () => state),
            Effect.catchTag('NoSuchElementException', () =>
              AuthError.withReason(Option.getOrElse(error, () => 'missing_params')),
            ),
            Effect.bind('state', ({ stateRaw }) => Schema.decode(LoginSchema)(stateRaw)),
            Effect.tap(({ state, stateRaw, code }) =>
              env.NODE_ENV === 'development' &&
              state.redirectUrl.toString().startsWith(env.FRONTEND_URL.toString())
                ? Effect.void
                : Effect.fail(
                    new BadOriginError({
                      redirect: pipe(
                        Redirect.fromUrl(
                          new URL(
                            env.API_PREFIX +
                              Auth.AuthApiGroup.pipe(ApiGroup.getEndpoint('callback')).path,
                            state.redirectUrl.origin,
                          ),
                        ),
                        Redirect.withSearchParam('state', stateRaw),
                        Redirect.withSearchParam('code', code),
                      ),
                    }),
                  ),
            ),
            Effect.bind('oauth', ({ code }) => discord.validateAuthorizationCode(code)),
            Effect.let('DiscordConfigLive', ({ oauth }) =>
              DiscordConfig.layer({
                token: Redacted.make(oauth.accessToken()),
              }),
            ),
            Effect.bind('client', ({ DiscordConfigLive }) =>
              Effect.provide(
                DiscordREST,
                Layer.provideMerge(
                  Layer.merge(DiscordRESTLive, CustomClient), // original dependencies
                  Layer.merge(MemoryRateLimitStoreLive, DiscordConfigLive), // layers for dependencies
                ),
              ),
            ),
            Effect.bind('discordUser', ({ client }) => client.getMyUser()),
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
            Effect.bind('session', ({ dbUser, sessionToken, expiresAt }) =>
              sessions.create({
                user_id: dbUser.id,
                token: sessionToken,
                expires_at: expiresAt,
                created_at: undefined,
              }),
            ),
            Effect.catchTag(
              'RequestError',
              'ResponseError',
              'DiscordOAuthError',
              'SqlError',
              'ParseError',
              'NoSuchElementException',
              AuthError.failCause,
            ),
            Effect.map(({ sessionToken, state }) =>
              pipe(
                Redirect.fromUrl(state.redirectUrl),
                Redirect.withSearchParam('token', sessionToken),
                Redirect.toResponse,
              ),
            ),
            Effect.catchTag(
              'BadOriginError',
              flow((e) => e.redirect, Redirect.toResponse, Effect.succeed),
            ),
            Effect.catchTag('ErrorResponse', () => AuthError.withReason('profile_failed')),
            Effect.catchTag('RatelimitedResponse', () => AuthError.withReason('rate_limited')),
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
