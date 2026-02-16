import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpClient,
  HttpClientRequest,
  HttpServerResponse,
} from '@effect/platform';
import { AuthApiGroup, CurrentUserContext } from '@sideline/domain/AuthApi';
import * as Discord from 'dfx/types';
import { Effect, Layer, Schema } from 'effect';
import { DiscordOAuth } from './DiscordOAuth.js';
import { env } from './env.js';
import { SessionsRepository } from './SessionsRepository.js';
import { UsersRepository } from './UsersRepository.js';

class HealthApiGroup extends HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('healthCheck', '/health').addSuccess(
    Schema.Struct({ status: Schema.Literal('ok') }),
  ),
) {}

class Api extends HttpApi.make('api').add(HealthApiGroup).add(AuthApiGroup) {}

const HealthApiLive = HttpApiBuilder.group(Api, 'health', (handlers) =>
  Effect.succeed(handlers.handle('healthCheck', () => Effect.succeed({ status: 'ok' as const }))),
);

const AuthApiLive = HttpApiBuilder.group(Api, 'auth', (handlers) =>
  Effect.gen(function* () {
    const discord = yield* DiscordOAuth;
    const users = yield* UsersRepository;
    const sessions = yield* SessionsRepository;
    return handlers
      .handleRaw('login', () =>
        Effect.gen(function* () {
          const state = crypto.randomUUID();
          const url = yield* discord.createAuthorizationURL(state);
          return HttpServerResponse.empty({ status: 302 }).pipe(
            HttpServerResponse.setHeader('Location', url.toString()),
          );
        }),
      )
      .handleRaw('callback', ({ urlParams }) =>
        Effect.gen(function* () {
          const { code, state } = urlParams;

          if (!state || !code) {
            return HttpServerResponse.empty({ status: 400 });
          }

          const tokens = yield* Effect.orDie(discord.validateAuthorizationCode(code));

          const bearerClient = (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.prependUrl('https://discord.com/api/v10')),
            HttpClient.mapRequest(
              HttpClientRequest.setHeader('Authorization', `Bearer ${tokens.accessToken()}`),
            ),
          );
          const discordRest = Discord.make(bearerClient);
          const discordUser = yield* Effect.orDie(discordRest.getMyUser());

          const user = yield* users.upsertFromDiscord({
            discordId: discordUser.id,
            discordUsername: discordUser.username,
            discordAvatar: discordUser.avatar ?? null,
            accessToken: tokens.accessToken(),
            refreshToken: tokens.refreshToken() ?? null,
          });

          const sessionToken = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          yield* sessions.create(user.id, sessionToken, expiresAt);

          return HttpServerResponse.empty({ status: 302 }).pipe(
            HttpServerResponse.setHeader('Location', `${env.FRONTEND_URL}?token=${sessionToken}`),
          );
        }),
      )
      .handle('me', () => CurrentUserContext);
  }),
);

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(HealthApiLive),
  Layer.provide(AuthApiLive),
);
