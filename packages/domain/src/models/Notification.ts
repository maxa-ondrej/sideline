import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';
import { UserId } from '~/models/User.js';

export const NotificationId = Schema.String.pipe(Schema.brand('NotificationId'));
export type NotificationId = typeof NotificationId.Type;

export const NotificationType = Schema.Literal(
  'age_role_assigned',
  'age_role_removed',
  'role_assigned',
  'role_removed',
);
export type NotificationType = typeof NotificationType.Type;

export class Notification extends Model.Class<Notification>('Notification')({
  id: Model.Generated(NotificationId),
  team_id: TeamId,
  user_id: UserId,
  type: NotificationType,
  title: Schema.String,
  body: Schema.String,
  is_read: Schema.Boolean,
  created_at: Model.DateTimeInsertFromDate,
}) {}
