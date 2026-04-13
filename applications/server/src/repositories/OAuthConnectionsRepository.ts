import { OAuthConnection, User } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class UpsertInput extends Schema.Class<UpsertInput>('UpsertInput')({
  user_id: User.UserId,
  provider: Schema.String,
  access_token: Schema.String,
  refresh_token: Schema.OptionFromNullOr(Schema.String),
}) {}

class FindInput extends Schema.Class<FindInput>('FindInput')({
  user_id: User.UserId,
  provider: Schema.String,
}) {}

class AccessTokenRow extends Schema.Class<AccessTokenRow>('AccessTokenRow')({
  access_token: Schema.String,
}) {}

export class OAuthConnectionsRepository extends Effect.Service<OAuthConnectionsRepository>()(
  'api/OAuthConnectionsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private _upsertConnection = SqlSchema.single({
    Request: UpsertInput,
    Result: OAuthConnection.OAuthConnection,
    execute: (input) => this.sql`
      INSERT INTO oauth_connections (user_id, provider, access_token, refresh_token)
      VALUES (${input.user_id}, ${input.provider}, ${input.access_token}, ${input.refresh_token})
      ON CONFLICT (user_id, provider) DO UPDATE SET
        access_token = ${input.access_token},
        refresh_token = ${input.refresh_token},
        updated_at = now()
      RETURNING *
    `,
  });

  private _findByUserAndProvider = SqlSchema.findOne({
    Request: FindInput,
    Result: OAuthConnection.OAuthConnection,
    execute: (input) => this.sql`
      SELECT * FROM oauth_connections
      WHERE user_id = ${input.user_id} AND provider = ${input.provider}
    `,
  });

  private _findAccessToken = SqlSchema.findOne({
    Request: FindInput,
    Result: AccessTokenRow,
    execute: (input) => this.sql`
      SELECT access_token FROM oauth_connections
      WHERE user_id = ${input.user_id} AND provider = ${input.provider}
    `,
  });

  upsert = (
    userId: User.UserId,
    provider: string,
    accessToken: string,
    refreshToken: Option.Option<string>,
  ) =>
    this._upsertConnection({
      user_id: userId,
      provider,
      access_token: accessToken,
      refresh_token: refreshToken,
    }).pipe(catchSqlErrors);

  findByUser = (userId: User.UserId, provider: string) =>
    this._findByUserAndProvider({ user_id: userId, provider }).pipe(catchSqlErrors);

  getAccessToken = (userId: User.UserId, provider: string) =>
    this._findAccessToken({ user_id: userId, provider }).pipe(
      catchSqlErrors,
      Effect.map(Option.map((row) => row.access_token)),
    );
}
