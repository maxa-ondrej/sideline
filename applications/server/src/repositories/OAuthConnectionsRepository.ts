import { SqlClient, SqlSchema } from '@effect/sql';
import { OAuthConnection, User } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class UpsertInput extends Schema.Class<UpsertInput>('UpsertInput')({
  user_id: User.UserId,
  provider: Schema.String,
  access_token: Schema.String,
  refresh_token: Schema.NullOr(Schema.String),
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
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('upsertConnection', ({ sql }) =>
        SqlSchema.single({
          Request: UpsertInput,
          Result: OAuthConnection.OAuthConnection,
          execute: (input) => sql`
            INSERT INTO oauth_connections (user_id, provider, access_token, refresh_token)
            VALUES (${input.user_id}, ${input.provider}, ${input.access_token}, ${input.refresh_token})
            ON CONFLICT (user_id, provider) DO UPDATE SET
              access_token = ${input.access_token},
              refresh_token = ${input.refresh_token},
              updated_at = now()
            RETURNING *
          `,
        }),
      ),
      Effect.let('findByUserAndProvider', ({ sql }) =>
        SqlSchema.findOne({
          Request: FindInput,
          Result: OAuthConnection.OAuthConnection,
          execute: (input) => sql`
            SELECT * FROM oauth_connections
            WHERE user_id = ${input.user_id} AND provider = ${input.provider}
          `,
        }),
      ),
      Effect.let('findAccessToken', ({ sql }) =>
        SqlSchema.findOne({
          Request: FindInput,
          Result: AccessTokenRow,
          execute: (input) => sql`
            SELECT access_token FROM oauth_connections
            WHERE user_id = ${input.user_id} AND provider = ${input.provider}
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  upsert(userId: User.UserId, provider: string, accessToken: string, refreshToken: string | null) {
    return this.upsertConnection({
      user_id: userId,
      provider,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  findByUser(userId: User.UserId, provider: string) {
    return this.findByUserAndProvider({ user_id: userId, provider });
  }

  getAccessToken(userId: User.UserId, provider: string) {
    return this.findAccessToken({ user_id: userId, provider }).pipe(
      Effect.flatten,
      Effect.map((row) => row.access_token),
    );
  }
}
