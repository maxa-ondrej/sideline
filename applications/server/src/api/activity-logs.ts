import { HttpApiBuilder } from '@effect/platform';
import { ActivityLogApi, Auth } from '@sideline/domain';
import { DateTime, Effect } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership } from '~/api/permissions.js';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { ActivityTypesRepository } from '~/repositories/ActivityTypesRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

export const ActivityLogApiLive = HttpApiBuilder.group(Api, 'activityLog', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('activityLogs', () => ActivityLogsRepository),
    Effect.bind('activityTypes', () => ActivityTypesRepository),
    Effect.map(({ members, activityLogs, activityTypes }) =>
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
                        activityTypeId: l.activity_type_id,
                        activityTypeName: l.activity_type_name,
                        loggedAt: l.logged_at.toISOString(),
                        durationMinutes: l.duration_minutes,
                        note: l.note,
                        source: l.source,
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
                activity_type_id: payload.activityTypeId,
                logged_at: DateTime.toDateUtc(DateTime.unsafeNow()),
                duration_minutes: payload.durationMinutes,
                note: payload.note,
                source: 'manual',
              }),
            ),
            Effect.map(
              (inserted) =>
                new ActivityLogApi.ActivityLogEntry({
                  id: inserted.id,
                  activityTypeId: inserted.activity_type_id,
                  activityTypeName: inserted.activity_type_name,
                  loggedAt: inserted.logged_at,
                  durationMinutes: payload.durationMinutes,
                  note: payload.note,
                  source: inserted.source,
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
                activity_type_id: payload.activityTypeId,
                duration_minutes: payload.durationMinutes,
                note: payload.note,
              }),
            ),
            Effect.map(
              (updated) =>
                new ActivityLogApi.ActivityLogEntry({
                  id: updated.id,
                  activityTypeId: updated.activity_type_id,
                  activityTypeName: updated.activity_type_name,
                  loggedAt: updated.logged_at.toISOString(),
                  durationMinutes: updated.duration_minutes,
                  note: updated.note,
                  source: updated.source,
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
        )
        .handle('listActivityTypes', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.tap(({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new ActivityLogApi.Forbidden()),
            ),
            Effect.flatMap(() => activityTypes.findByTeamId(teamId)),
            Effect.map(
              (types) =>
                new ActivityLogApi.ActivityTypeListResponse({
                  activityTypes: types.map(
                    (t) =>
                      new ActivityLogApi.ActivityTypeEntry({
                        id: t.id,
                        name: t.name,
                        slug: t.slug,
                      }),
                  ),
                }),
            ),
          ),
        ),
    ),
  ),
);
