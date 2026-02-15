import { SqlClient } from "@effect/sql"
import type { UserId } from "@sideline/domain/AuthApi"
import { User } from "@sideline/domain/AuthApi"
import { DateTime, Effect } from "effect"

interface UserRow {
  readonly id: string
  readonly discord_id: string
  readonly discord_username: string
  readonly discord_avatar: string | null
  readonly discord_access_token: string
  readonly discord_refresh_token: string | null
  readonly created_at: Date
  readonly updated_at: Date
}

const toUser = (row: UserRow) =>
  new User({
    id: row.id as UserId,
    discordId: row.discord_id,
    discordUsername: row.discord_username,
    discordAvatar: row.discord_avatar,
    createdAt: DateTime.unsafeFromDate(row.created_at),
    updatedAt: DateTime.unsafeFromDate(row.updated_at),
  })

export class UsersRepository extends Effect.Service<UsersRepository>()("api/UsersRepository", {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    function findById(id: UserId) {
      return sql<UserRow>`SELECT * FROM users WHERE id = ${id}`.pipe(
        Effect.orDie,
        Effect.map((rows) => (rows.length > 0 ? toUser(rows[0]) : null)),
      )
    }

    function findByDiscordId(discordId: string) {
      return sql<UserRow>`SELECT * FROM users WHERE discord_id = ${discordId}`.pipe(
        Effect.orDie,
        Effect.map((rows) => (rows.length > 0 ? toUser(rows[0]) : null)),
      )
    }

    function upsertFromDiscord(profile: {
      readonly discordId: string
      readonly discordUsername: string
      readonly discordAvatar: string | null
      readonly accessToken: string
      readonly refreshToken: string | null
    }) {
      return sql<UserRow>`
        INSERT INTO users (discord_id, discord_username, discord_avatar, discord_access_token, discord_refresh_token)
        VALUES (${profile.discordId}, ${profile.discordUsername}, ${profile.discordAvatar}, ${profile.accessToken}, ${profile.refreshToken})
        ON CONFLICT (discord_id) DO UPDATE SET
          discord_username = ${profile.discordUsername},
          discord_avatar = ${profile.discordAvatar},
          discord_access_token = ${profile.accessToken},
          discord_refresh_token = ${profile.refreshToken},
          updated_at = now()
        RETURNING *
      `.pipe(
        Effect.orDie,
        Effect.map((rows) => toUser(rows[0])),
      )
    }

    return { findById, findByDiscordId, upsertFromDiscord } as const
  }),
}) {}
