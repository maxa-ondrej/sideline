import { HttpApiBuilder, HttpMiddleware } from "@effect/platform"
import { Layer } from "effect"
import { ApiLive } from "./Api.js"
import { TodosRepository } from "./TodosRepository.js"

export const AppLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  Layer.provide(TodosRepository.Default),
)
