import { Model } from '@effect/sql';
import { DateTime, Schema } from 'effect';
import { TeamId } from './Team.js';
import { UserId } from './User.js';

export const TeamInviteId = Schema.String.pipe(Schema.brand('TeamInviteId'));
export type TeamInviteId = typeof TeamInviteId.Type;

const NullableDateTimeFromDate = Schema.NullOr(
  Schema.transform(Schema.DateFromSelf, Schema.DateTimeUtcFromSelf, {
    decode: (date) => DateTime.unsafeFromDate(date),
    encode: (dt) => new Date(DateTime.toEpochMillis(dt)),
  }),
);

export class TeamInvite extends Model.Class<TeamInvite>('TeamInvite')({
  id: Model.Generated(TeamInviteId),
  team_id: TeamId,
  code: Schema.String,
  active: Schema.Boolean,
  created_by: UserId,
  created_at: Model.DateTimeInsertFromDate,
  expires_at: NullableDateTimeFromDate,
}) {}
