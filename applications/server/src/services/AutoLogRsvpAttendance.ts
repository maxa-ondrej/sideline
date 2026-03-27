import type { TeamMember } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';

const isUniqueViolation = (defect: unknown): boolean =>
  defect instanceof Error && /duplicate key|unique constraint/i.test(defect.message);

export const autoLogRsvpAttendance = ({
  memberId,
  loggedAt,
}: {
  readonly memberId: TeamMember.TeamMemberId;
  readonly loggedAt: Date;
}) =>
  ActivityLogsRepository.pipe(
    Effect.flatMap((activityLogs) =>
      activityLogs.insert({
        team_member_id: memberId,
        activity_type: 'training',
        logged_at: loggedAt,
        duration_minutes: Option.none(),
        note: Option.none(),
        source: 'auto',
      }),
    ),
    Effect.asVoid,
    // Silently ignore duplicate auto-training logs (enforced by DB unique index);
    // the unique constraint violation surfaces as a defect because SqlError is converted via Effect.die
    Effect.catchSomeDefect((defect) =>
      isUniqueViolation(defect) ? Option.some(Effect.void) : Option.none(),
    ),
  );

export const removeAutoLogRsvpAttendance = ({
  memberId,
  loggedAt,
}: {
  readonly memberId: TeamMember.TeamMemberId;
  readonly loggedAt: Date;
}) =>
  ActivityLogsRepository.pipe(
    Effect.flatMap((activityLogs) => activityLogs.deleteAutoTrainingLog(memberId, loggedAt)),
  );
