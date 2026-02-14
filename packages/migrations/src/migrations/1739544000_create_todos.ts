import { SqlClient } from "@effect/sql"
import { Effect } from "effect"

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    CREATE TABLE todos (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE
    )
  `,
)
