import { Model } from '@effect/sql';
import { DateTime, Schema } from 'effect';
import { UserId } from '~/models/User.js';

const DateTimeFromDate = Schema.transform(Schema.DateFromSelf, Schema.DateTimeUtcFromSelf, {
  decode: (date) => DateTime.unsafeFromDate(date),
  encode: (dt) => new Date(DateTime.toEpochMillis(dt)),
});

export class Session extends Model.Class<Session>('Session')({
  id: Model.Generated(Schema.String),
  user_id: UserId,
  token: Schema.String,
  expires_at: DateTimeFromDate,
  created_at: Model.DateTimeInsertFromDate,
}) {}
