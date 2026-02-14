import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { TodosApiGroup } from "@sideline/domain/TodosApi"
import { Effect, Layer, Schema } from "effect"
import { TodosRepository } from "./TodosRepository.js"

class HealthApiGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("healthCheck", "/health").addSuccess(
    Schema.Struct({ status: Schema.Literal("ok") }),
  ),
) {}

class Api extends HttpApi.make("api").add(TodosApiGroup).add(HealthApiGroup) {}

const TodosApiLive = HttpApiBuilder.group(Api, "todos", (handlers) =>
  Effect.gen(function* () {
    const todos = yield* TodosRepository
    return handlers
      .handle("getAllTodos", () => todos.getAll)
      .handle("getTodoById", ({ path: { id } }) => todos.getById(id))
      .handle("createTodo", ({ payload: { text } }) => todos.create(text))
      .handle("completeTodo", ({ path: { id } }) => todos.complete(id))
      .handle("removeTodo", ({ path: { id } }) => todos.remove(id))
  }),
)

const HealthApiLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  Effect.succeed(handlers.handle("healthCheck", () => Effect.succeed({ status: "ok" as const }))),
)

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(TodosApiLive),
  Layer.provide(HealthApiLive),
)
