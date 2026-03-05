import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { UserId } from '~/models/User.js';

export const OAuthConnectionId = Schema.String.pipe(Schema.brand('OAuthConnectionId'));
export type OAuthConnectionId = typeof OAuthConnectionId.Type;

export class OAuthConnection extends Model.Class<OAuthConnection>('OAuthConnection')({
  id: Model.Generated(OAuthConnectionId),
  user_id: UserId,
  provider: Schema.String,
  access_token: Model.Sensitive(Schema.String),
  refresh_token: Model.Sensitive(Schema.NullOr(Schema.String)),
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
