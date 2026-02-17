import {
  FetchHttpClient,
  HttpApiBuilder,
  HttpApiSwagger,
  HttpMiddleware,
  HttpServer,
} from '@effect/platform';
import { Layer } from 'effect';
import { ApiLive } from './api/index.js';
import { AuthMiddlewareLive } from './middleware/AuthMiddlewareLive.js';
import { SessionsRepository } from './repositories/SessionsRepository.js';
import { UsersRepository } from './repositories/UsersRepository.js';
import { DiscordOAuth } from './services/DiscordOAuth.js';

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
