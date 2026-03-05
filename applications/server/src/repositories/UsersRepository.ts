import { Model, SqlClient, SqlSchema } from '@effect/sql';
import { User } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class UpsertDiscordInput extends Schema.Class<UpsertDiscordInput>('UpsertDiscordInput')({
  discord_id: Schema.String,
  username: Schema.String,
  avatar: Schema.NullOr(Schema.String),
}) {}

const CompleteProfileInput = User.User.pipe(Schema.pick('id', 'name', 'birth_date', 'gender'));

const AdminUpdateProfileInput = User.User.pipe(Schema.pick('id', 'name', 'birth_date', 'gender'));

export class UsersRepository extends Effect.Service<UsersRepository>()('api/UsersRepository', {
  effect: SqlClient.SqlClient.pipe(
    Effect.bindTo('sql'),
    Effect.bind('repo', () =>
      Model.makeRepository(User.User, {
        tableName: 'users',
        spanPrefix: 'UsersRepository',
        idColumn: 'id',
      }),
    ),
    Effect.let('findByDiscordId', ({ sql }) =>
      SqlSchema.findOne({
        Request: Schema.String,
        Result: User.User,
        execute: (discordId) => sql`SELECT * FROM users WHERE discord_id = ${discordId}`,
      }),
    ),
    Effect.let(
      'findById',
      ({ repo }) =>
        (id: User.UserId) =>
          repo.findById(id),
    ),
    Effect.let('upsertFromDiscord', ({ sql }) =>
      SqlSchema.single({
        Request: UpsertDiscordInput,
        Result: User.User,
        execute: (input) => sql`
          INSERT INTO users (discord_id, username, avatar)
          VALUES (${input.discord_id}, ${input.username}, ${input.avatar})
          ON CONFLICT (discord_id) DO UPDATE SET
            username = ${input.username},
            avatar = ${input.avatar},
            updated_at = now()
          RETURNING *
        `,
      }),
    ),
    Effect.let('completeProfile', ({ sql }) =>
      SqlSchema.single({
        Request: CompleteProfileInput,
        Result: User.User,
        execute: (input) => sql`
          UPDATE users SET
            name = ${input.name},
            birth_date = ${input.birth_date},
            gender = ${input.gender},
            is_profile_complete = true,
            updated_at = now()
          WHERE id = ${input.id}
          RETURNING *
        `,
      }),
    ),
    Effect.let('updateLocale', ({ sql }) =>
      SqlSchema.single({
        Request: Schema.Struct({ id: User.UserId, locale: User.Locale }),
        Result: User.User,
        execute: (input) => sql`
          UPDATE users SET
            locale = ${input.locale},
            updated_at = now()
          WHERE id = ${input.id}
          RETURNING *
        `,
      }),
    ),
    Effect.let('updateAdminProfile', ({ sql }) =>
      SqlSchema.single({
        Request: AdminUpdateProfileInput,
        Result: User.User,
        execute: (input) => sql`
          UPDATE users SET
            name = ${input.name},
            birth_date = ${input.birth_date},
            gender = ${input.gender},
            updated_at = now()
          WHERE id = ${input.id}
          RETURNING *
        `,
      }),
    ),
    Bind.remove('sql'),
    Bind.remove('repo'),
  ),
}) {}
