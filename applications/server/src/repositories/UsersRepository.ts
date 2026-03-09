import { Model, SqlClient, SqlSchema } from '@effect/sql';
import { User } from '@sideline/domain';
import { Effect, Schema } from 'effect';

class UpsertDiscordInput extends Schema.Class<UpsertDiscordInput>('UpsertDiscordInput')({
  discord_id: Schema.String,
  username: Schema.String,
  avatar: Schema.OptionFromNullOr(Schema.String),
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
  ),
}) {
  private findByDiscordIdQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: User.User,
    execute: (discordId) => this.sql`SELECT * FROM users WHERE discord_id = ${discordId}`,
  });

  findByDiscordId = (discordId: string) =>
    this.findByDiscordIdQuery(discordId).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  findById = (id: User.UserId) => this.repo.findById(id);

  private upsertFromDiscordQuery = SqlSchema.single({
    Request: UpsertDiscordInput,
    Result: User.User,
    execute: (input) => this.sql`
      INSERT INTO users (discord_id, username, avatar)
      VALUES (${input.discord_id}, ${input.username}, ${input.avatar})
      ON CONFLICT (discord_id) DO UPDATE SET
        username = ${input.username},
        avatar = ${input.avatar},
        updated_at = now()
      RETURNING *
    `,
  });

  upsertFromDiscord = (input: UpsertDiscordInput) =>
    this.upsertFromDiscordQuery(input).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  private completeProfileQuery = SqlSchema.single({
    Request: CompleteProfileInput,
    Result: User.User,
    execute: (input) => this.sql`
      UPDATE users SET
        name = ${input.name},
        birth_date = ${input.birth_date},
        gender = ${input.gender},
        is_profile_complete = true,
        updated_at = now()
      WHERE id = ${input.id}
      RETURNING *
    `,
  });

  completeProfile = (input: Schema.Schema.Type<typeof CompleteProfileInput>) =>
    this.completeProfileQuery(input).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  private updateLocaleQuery = SqlSchema.single({
    Request: Schema.Struct({ id: User.UserId, locale: User.Locale }),
    Result: User.User,
    execute: (input) => this.sql`
      UPDATE users SET
        locale = ${input.locale},
        updated_at = now()
      WHERE id = ${input.id}
      RETURNING *
    `,
  });

  updateLocale = (input: { readonly id: User.UserId; readonly locale: User.Locale }) =>
    this.updateLocaleQuery(input).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  private updateAdminProfileQuery = SqlSchema.single({
    Request: AdminUpdateProfileInput,
    Result: User.User,
    execute: (input) => this.sql`
      UPDATE users SET
        name = ${input.name},
        birth_date = ${input.birth_date},
        gender = ${input.gender},
        updated_at = now()
      WHERE id = ${input.id}
      RETURNING *
    `,
  });

  updateAdminProfile = (input: Schema.Schema.Type<typeof AdminUpdateProfileInput>) =>
    this.updateAdminProfileQuery(input).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
}
