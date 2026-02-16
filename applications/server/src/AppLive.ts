import {
  FetchHttpClient,
  HttpApiBuilder,
  HttpApiSwagger,
  HttpMiddleware,
  HttpServer,
} from '@effect/platform';
import { Layer } from 'effect';
import { ApiLive } from './Api.js';
import { AuthMiddlewareLive } from './AuthMiddlewareLive.js';
import { DiscordOAuth } from './DiscordOAuth.js';
import { SessionsRepository } from './SessionsRepository.js';
import { UsersRepository } from './UsersRepository.js';

export const AppLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer({ path: '/docs/swagger-ui' })),
  Layer.provide(HttpApiBuilder.middlewareOpenApi({ path: '/docs/openapi.json' })),
  Layer.provide(HttpApiBuilder.middlewareCors({ credentials: true, allowedOrigins: () => true })),
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(AuthMiddlewareLive),
  Layer.provide(UsersRepository.Default),
  Layer.provide(SessionsRepository.Default),
  Layer.provide(DiscordOAuth.Default),
  Layer.provide(FetchHttpClient.layer),
);
