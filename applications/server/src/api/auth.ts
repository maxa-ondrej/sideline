import { HttpApiBuilder } from '@effect/platform';
import { CurrentUserContext } from '@sideline/domain/api/Auth';
import { DiscordConfig, DiscordREST, DiscordRESTLive, MemoryRateLimitStoreLive } from 'dfx';
import { DateTime, Effect, Option, pipe, Redacted } from 'effect';
import { env } from '../env.js';
import { SessionsRepository } from '../repositories/SessionsRepository.js';
import { UsersRepository } from '../repositories/UsersRepository.js';
import { DiscordOAuth } from '../services/DiscordOAuth.js';
import { LogicError, Redirect, RuntimeError } from './errors.js';
import { Api } from './health.js';

export const AuthApiLive = HttpApiBuilder.group(Api, 'auth', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('discord', () => DiscordOAuth),
    Effect.bind('users', () => UsersRepository),
    Effect.bind('sessions', () => SessionsRepository),
    Effect.map(({ discord, users, sessions }) =>
      handlers
        .handle('login', () =>
          Effect.sync(() => crypto.randomUUID()).pipe(
            Effect.flatMap(discord.createAuthorizationURL),
            Effect.map(Redirect.fromUrl),
            Effect.map(Redirect.toResponse),
          ),
        )
        .handle('callback', ({ urlParams: { code, state, error } }) =>
          Effect.Do.pipe(
            Effect.bind('code', () => code),
            Effect.bind('state', () => state),
            Effect.catchTag('NoSuchElementException', () =>
              RuntimeError.auth(Option.getOrElse(error, () => 'missing_params')),
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
                Effect.provide(DiscordConfigLive),
                Effect.provide(MemoryRateLimitStoreLive),
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
            Effect.map(({ sessionToken }) =>
              pipe(
                Redirect.fromUrl(env.FRONTEND_URL),
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
        .handle('me', () => CurrentUserContext),
    ),
  ),
);
