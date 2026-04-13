import { Schema } from 'effect';
import { Model } from 'effect/unstable/schema';
import { UserId } from '~/models/User.js';

export class ICalToken extends Model.Class<ICalToken>('ICalToken')({
  id: Model.Generated(Schema.String),
  user_id: UserId,
  token: Schema.String,
  created_at: Model.DateTimeInsertFromDate,
}) {}
