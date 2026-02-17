import { Model, SqlClient, SqlSchema } from '@effect/sql';
import { User, type UserId } from '@sideline/domain/models/User';
import { Effect, Schema } from 'effect';

class UpsertDiscordInput extends Schema.Class<UpsertDiscordInput>('UpsertDiscordInput')({
  discord_id: Schema.String,
  discord_username: Schema.String,
  discord_avatar: Schema.NullOr(Schema.String),
  discord_access_token: Schema.String,
  discord_refresh_token: Schema.NullOr(Schema.String),
}) {}

const CompleteProfileInput = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  birth_year: Schema.Number,
  gender: Schema.String,
  jersey_number: Schema.NullOr(Schema.Number),
  position: Schema.String,
  proficiency: Schema.String,
});

export class UsersRepository extends Effect.Service<UsersRepository>()('api/UsersRepository', {
  effect: SqlClient.SqlClient.pipe(
    Effect.bindTo('sql'),
    Effect.bind('repo', () =>
      Model.makeRepository(User, {
        tableName: 'users',
        spanPrefix: 'UsersRepository',
        idColumn: 'id',
      }),
    ),
    Effect.let('findByDiscordId', ({ sql }) =>
      SqlSchema.findOne({
        Request: Schema.String,
        Result: User,
        execute: (discordId) => sql`SELECT * FROM users WHERE discord_id = ${discordId}`,
      }),
    ),
    Effect.let(
      'findById',
      ({ repo }) => repo.findById as (id: UserId) => ReturnType<typeof repo.findById>,
    ),
    Effect.let('upsertFromDiscord', ({ sql }) =>
      SqlSchema.single({
        Request: UpsertDiscordInput,
        Result: User,
        execute: (input) => sql`
          INSERT INTO users (discord_id, discord_username, discord_avatar, discord_access_token, discord_refresh_token)
          VALUES (${input.discord_id}, ${input.discord_username}, ${input.discord_avatar}, ${input.discord_access_token}, ${input.discord_refresh_token})
          ON CONFLICT (discord_id) DO UPDATE SET
            discord_username = ${input.discord_username},
            discord_avatar = ${input.discord_avatar},
            discord_access_token = ${input.discord_access_token},
            discord_refresh_token = ${input.discord_refresh_token},
            updated_at = now()
          RETURNING *
        `,
      }),
    ),
    Effect.let('completeProfile', ({ sql }) =>
      SqlSchema.single({
        Request: CompleteProfileInput,
        Result: User,
        execute: (input) => sql`
          UPDATE users SET
            name = ${input.name},
            birth_year = ${input.birth_year},
            gender = ${input.gender},
            jersey_number = ${input.jersey_number},
            position = ${input.position},
            proficiency = ${input.proficiency},
            is_profile_complete = true,
            updated_at = now()
          WHERE id = ${input.id}
          RETURNING *
        `,
      }),
    ),
  ),
}) {}
