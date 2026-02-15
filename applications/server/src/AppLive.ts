import { FetchHttpClient, HttpApiBuilder, HttpMiddleware } from "@effect/platform"
import { Layer } from "effect"
import { ApiLive } from "./Api.js"
import { AuthMiddlewareLive } from "./AuthMiddlewareLive.js"
import { DiscordOAuth } from "./DiscordOAuth.js"
import { SessionsRepository } from "./SessionsRepository.js"
import { UsersRepository } from "./UsersRepository.js"

export const AppLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors({ credentials: true, allowedOrigins: () => true })),
  Layer.provide(ApiLive),
  Layer.provide(AuthMiddlewareLive),
  Layer.provide(UsersRepository.Default),
  Layer.provide(SessionsRepository.Default),
  Layer.provide(DiscordOAuth.Default),
  Layer.provide(FetchHttpClient.layer),
)
