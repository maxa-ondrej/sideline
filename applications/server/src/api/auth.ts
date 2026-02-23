import { URL } from 'node:url';
import { HttpApiBuilder, HttpClient, HttpClientRequest } from '@effect/platform';
import { ApiGroup, Auth } from '@sideline/domain';
import { CurrentUser, CurrentUserContext } from '@sideline/domain/api/Auth';
import { DiscordConfig, DiscordREST, DiscordRESTLive, MemoryRateLimitStoreLive } from 'dfx';
import { DateTime, Effect, Layer, Option, pipe, Redacted, Schema } from 'effect';
import { env } from '../env.js';
import { SessionsRepository } from '../repositories/SessionsRepository.js';
import { UsersRepository } from '../repositories/UsersRepository.js';
import { DiscordOAuth } from '../services/DiscordOAuth.js';
import { Api } from './api.js';
import { InternalError, LogicError, Redirect, RuntimeError } from './errors.js';

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

class BadOriginError extends Schema.TaggedError<BadOriginError>()('BadOriginError', {
  code: Schema.String,
  state: LoginSchema,
}) {}

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
            Effect.catchTag('ParseError', () => new InternalError()),
          ),
        )
        .handle('callback', ({ urlParams: { code, state, error } }) =>
          Effect.Do.pipe(
            Effect.bind('code', () => code),
            Effect.bind('stateRaw', () => state),
            Effect.catchTag('NoSuchElementException', () =>
              RuntimeError.auth(Option.getOrElse(error, () => 'missing_params')),
            ),
            Effect.bind('state', ({ stateRaw }) => Schema.decode(LoginSchema)(stateRaw)),
            Effect.andThen((data) =>
              env.NODE_ENV === 'development' &&
              data.state.redirectUrl.toString().startsWith(env.FRONTEND_URL.toString())
                ? Effect.succeed(data)
                : Effect.fail(new BadOriginError({ state: data.state, code: data.code })),
            ),
            Effect.bind('oauth', ({ code }) => discord.validateAuthorizationCode(code)),
            Effect.let('DiscordConfigLive', ({ oauth }) =>
              DiscordConfig.layer({
                token: Redacted.make(oauth.accessToken()),
              }),
            ),
            Effect.bind('client', ({ DiscordConfigLive }) =>
              DiscordREST.pipe(
                Effect.provide(DiscordRESTLive),
                Effect.provide(CustomClient),
                Effect.provide(MemoryRateLimitStoreLive),
                Effect.provide(DiscordConfigLive),
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
            Effect.map(({ sessionToken, state }) =>
              pipe(
                Redirect.fromUrl(state.redirectUrl),
                Redirect.withSearchParam('token', sessionToken),
              ),
            ),
            Effect.catchTags({
              ErrorResponse: () => RuntimeError.auth('profile_failed'),
              RatelimitedResponse: () => RuntimeError.auth('rate_limited'),
              RequestError: LogicError.fromUnknown,
              ResponseError: LogicError.fromUnknown,
              DiscordOAuthError: LogicError.fromUnknown,
              SqlError: LogicError.fromUnknown,
              ParseError: LogicError.fromUnknown,
              NoSuchElementException: LogicError.fromUnknown,
              BadOriginError: (a) =>
                pipe(
                  Redirect.fromUrl(
                    new URL(
                      `/api/${Auth.AuthApiGroup.pipe(ApiGroup.getEndpoint('doLogin')).path}`,
                      a.state.redirectUrl,
                    ),
                  ),
                  Redirect.withSearchParam('state', Schema.encodeSync(LoginSchema)(a.state)),
                  Redirect.withSearchParam('code', a.code),
                  Effect.succeed,
                ),
            }),
            Effect.tapErrorTag('LogicError', Effect.logError),
            Effect.catchTag('LogicError', () => RuntimeError.auth('oauth_failed')),
            Effect.catchTag('RuntimeError', (e) =>
              pipe(
                Redirect.fromUrl(env.FRONTEND_URL),
                Redirect.withSearchParam('error', e.error),
                Redirect.withSearchParam('reason', e.reason),
                Effect.succeed,
              ),
            ),
            Effect.map(Redirect.toResponse),
          ),
        )
        .handle('me', () => CurrentUserContext)
        .handle('updateLocale', ({ payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => CurrentUserContext),
            Effect.bind('updated', ({ currentUser }) =>
              users
                .updateLocale({
                  id: currentUser.id,
                  locale: payload.locale,
                })
                .pipe(Effect.mapError(() => new InternalError())),
            ),
            Effect.map(
              ({ updated }) =>
                new CurrentUser({
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
            Effect.bind('currentUser', () => CurrentUserContext),
            Effect.bind('updated', ({ currentUser }) =>
              users
                .completeProfile({
                  id: currentUser.id,
                  name: payload.name,
                  birth_year: payload.birthYear,
                  gender: payload.gender,
                  jersey_number: Option.getOrNull(payload.jerseyNumber),
                  position: payload.position,
                  proficiency: payload.proficiency,
                })
                .pipe(Effect.mapError(() => new InternalError())),
            ),
            Effect.map(
              ({ updated }) =>
                new CurrentUser({
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
