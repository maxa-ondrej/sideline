import { SqlClient } from "@effect/sql"
import { Todo, TodoId, TodoNotFound } from "@sideline/domain/TodosApi"
import { Effect, HashMap, Layer, Ref } from "effect"

interface TodoRow {
  readonly id: number
  readonly text: string
  readonly done: boolean
}

const toTodo = (row: TodoRow) =>
  new Todo({ id: TodoId.make(row.id), text: row.text, done: row.done })

export class TodosRepository extends Effect.Service<TodosRepository>()("api/TodosRepository", {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const getAll = sql<TodoRow>`SELECT id, text, done FROM todos`.pipe(
      Effect.orDie,
      Effect.map((rows) => rows.map(toTodo)),
    )

    function getById(id: TodoId): Effect.Effect<Todo, TodoNotFound> {
      return sql<TodoRow>`SELECT id, text, done FROM todos WHERE id = ${id}`.pipe(
        Effect.orDie,
        Effect.flatMap((rows) =>
          rows.length > 0 ? Effect.succeed(toTodo(rows[0])) : Effect.fail(new TodoNotFound({ id })),
        ),
      )
    }

    function create(text: string): Effect.Effect<Todo> {
      return sql<TodoRow>`INSERT INTO todos (text, done) VALUES (${text}, FALSE) RETURNING id, text, done`.pipe(
        Effect.orDie,
        Effect.map((rows) => toTodo(rows[0])),
      )
    }

    function complete(id: TodoId): Effect.Effect<Todo, TodoNotFound> {
      return sql<TodoRow>`UPDATE todos SET done = TRUE WHERE id = ${id} RETURNING id, text, done`.pipe(
        Effect.orDie,
        Effect.flatMap((rows) =>
          rows.length > 0 ? Effect.succeed(toTodo(rows[0])) : Effect.fail(new TodoNotFound({ id })),
        ),
      )
    }

    function remove(id: TodoId): Effect.Effect<void, TodoNotFound> {
      return sql`DELETE FROM todos WHERE id = ${id}`.pipe(
        Effect.orDie,
        Effect.flatMap((rows) =>
          rows.length > 0 ? Effect.void : Effect.fail(new TodoNotFound({ id })),
        ),
      )
    }

    return { getAll, getById, create, complete, remove } as const
  }),
}) {
  static InMemory = Layer.effect(
    TodosRepository,
    Effect.gen(function* () {
      const todos = yield* Ref.make(HashMap.empty<TodoId, Todo>())

      const getAll = Ref.get(todos).pipe(Effect.map((map) => Array.from(HashMap.values(map))))

      function getById(id: TodoId): Effect.Effect<Todo, TodoNotFound> {
        return Ref.get(todos).pipe(
          Effect.flatMap(HashMap.get(id)),
          Effect.catchTag("NoSuchElementException", () => new TodoNotFound({ id })),
        )
      }

      function create(text: string): Effect.Effect<Todo> {
        return Ref.modify(todos, (map) => {
          const id = TodoId.make(
            HashMap.reduce(map, -1, (max, todo) => (todo.id > max ? todo.id : max)) + 1,
          )
          const todo = new Todo({ id, text, done: false })
          return [todo, HashMap.set(map, id, todo)]
        })
      }

      function complete(id: TodoId): Effect.Effect<Todo, TodoNotFound> {
        return getById(id).pipe(
          Effect.map((todo) => new Todo({ ...todo, done: true })),
          Effect.tap((todo) => Ref.update(todos, HashMap.set(todo.id, todo))),
        )
      }

      function remove(id: TodoId): Effect.Effect<void, TodoNotFound> {
        return getById(id).pipe(
          Effect.flatMap((todo) => Ref.update(todos, HashMap.remove(todo.id))),
        )
      }

      return { getAll, getById, create, complete, remove } as const
    }) as Effect.Effect<TodosRepository>,
  )
}
