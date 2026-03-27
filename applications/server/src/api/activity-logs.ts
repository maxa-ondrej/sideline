import { HttpApiBuilder } from '@effect/platform';
import { ActivityLogApi, Auth } from '@sideline/domain';
import { DateTime, Effect } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership } from '~/api/permissions.js';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

export const ActivityLogApiLive = HttpApiBuilder.group(Api, 'activityLog', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('activityLogs', () => ActivityLogsRepository),
    Effect.map(({ members, activityLogs }) =>
      handlers
        .handle('listLogs', ({ path: { teamId, memberId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new ActivityLogApi.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              membership.id === memberId
                ? Effect.void
                : Effect.fail(new ActivityLogApi.Forbidden()),
            ),
            Effect.bind('logs', () => activityLogs.findByMember(memberId)),
            Effect.map(
              ({ logs }) =>
                new ActivityLogApi.ActivityLogListResponse({
                  logs: logs.map(
                    (l) =>
                      new ActivityLogApi.ActivityLogEntry({
                        id: l.id,
                        activityType: l.activity_type,
                        loggedAt: l.logged_at.toISOString(),
                        durationMinutes: l.duration_minutes,
                        note: l.note,
                      }),
                  ),
                }),
            ),
          ),
        )
        .handle('createLog', ({ path: { teamId, memberId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new ActivityLogApi.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              membership.id === memberId
                ? Effect.void
                : Effect.fail(new ActivityLogApi.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              membership.active ? Effect.void : Effect.fail(new ActivityLogApi.MemberInactive()),
            ),
            Effect.flatMap(() =>
              activityLogs.insert({
                team_member_id: memberId,
                activity_type: payload.activityType,
                logged_at: DateTime.toDateUtc(DateTime.unsafeNow()),
                duration_minutes: payload.durationMinutes,
                note: payload.note,
              }),
            ),
            Effect.map(
              (inserted) =>
                new ActivityLogApi.ActivityLogEntry({
                  id: inserted.id,
                  activityType: inserted.activity_type,
                  loggedAt: inserted.logged_at,
                  durationMinutes: payload.durationMinutes,
                  note: payload.note,
                }),
            ),
          ),
        )
        .handle('updateLog', ({ path: { teamId, memberId, logId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new ActivityLogApi.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              membership.id === memberId
                ? Effect.void
                : Effect.fail(new ActivityLogApi.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              membership.active ? Effect.void : Effect.fail(new ActivityLogApi.MemberInactive()),
            ),
            Effect.flatMap(() =>
              activityLogs.update(logId, memberId, {
                activity_type: payload.activityType,
                duration_minutes: payload.durationMinutes,
                note: payload.note,
              }),
            ),
            Effect.map(
              (updated) =>
                new ActivityLogApi.ActivityLogEntry({
                  id: updated.id,
                  activityType: updated.activity_type,
                  loggedAt: updated.logged_at.toISOString(),
                  durationMinutes: updated.duration_minutes,
                  note: updated.note,
                }),
            ),
          ),
        )
        .handle('deleteLog', ({ path: { teamId, memberId, logId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new ActivityLogApi.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              membership.id === memberId
                ? Effect.void
                : Effect.fail(new ActivityLogApi.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              membership.active ? Effect.void : Effect.fail(new ActivityLogApi.MemberInactive()),
            ),
            Effect.flatMap(() => activityLogs.delete(logId, memberId)),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
