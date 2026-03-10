import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { UserId } from '~/models/User.js';

export class ICalToken extends Model.Class<ICalToken>('ICalToken')({
  id: Model.Generated(Schema.String),
  user_id: UserId,
  token: Schema.String,
  created_at: Model.DateTimeInsertFromDate,
}) {}
