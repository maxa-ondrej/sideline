import * as Schemas from '@sideline/effect-lib/Schemas';
import { Schema } from 'effect';
import { Model } from 'effect/unstable/schema';
import { UserId } from '~/models/User.js';

export class Session extends Model.Class<Session>('Session')({
  id: Model.Generated(Schema.String),
  user_id: UserId,
  token: Schema.String,
  expires_at: Schemas.DateTimeFromDate,
  created_at: Model.DateTimeInsertFromDate,
}) {}
