import { Model } from '@effect/sql';
import { Schema } from 'effect';

export const UserId = Schema.String.pipe(Schema.brand('UserId'));
export type UserId = typeof UserId.Type;

export class User extends Model.Class<User>('User')({
  id: Model.Generated(UserId),
  discord_id: Schema.String,
  discord_username: Schema.String,
  discord_avatar: Schema.NullOr(Schema.String),
  discord_access_token: Model.Sensitive(Schema.String),
  discord_refresh_token: Model.Sensitive(Schema.NullOr(Schema.String)),
  created_at: Model.DateTimeInsertFromDate,
  is_profile_complete: Schema.Boolean,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
