import {
  type Auth,
  type Team,
  type WeeklyChallenge,
  WeeklyChallengeRpcGroup,
  WeeklyChallengeSyncEvents,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { DateTime, Effect, Option, type Option as OptionType } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { currentTeamMondayDate, scheduleAtNineAm } from '~/helpers/weeklyChallenge.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import type { MembershipWithRole } from '~/repositories/TeamMembersRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { WeeklyChallengeRepository } from '~/repositories/WeeklyChallengeRepository.js';

const { WeeklyChallengeForbidden, WeeklyChallengeNotFound, WeeklyChallengeWeekOutOfRange } =
  WeeklyChallengeRpcGroup;

// ---------------------------------------------------------------------------
// Auth helper: resolve current user from Bearer token in HTTP request
// ---------------------------------------------------------------------------

const resolveCurrentUser = Effect.Do.pipe(
  Effect.bind('request', () => HttpServerRequest.HttpServerRequest.asEffect()),
  Effect.bind('sessions', () => SessionsRepository.asEffect()),
  Effect.bind('users', () => UsersRepository.asEffect()),
  Effect.flatMap(({ request, sessions, users }) => {
    const authHeader = (request.headers as Readonly<Record<string, string>>).authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return Effect.fail(new WeeklyChallengeForbidden()).pipe(
        Effect.tapError(() => Effect.logWarning('WeeklyChallenge: no Bearer token in request')),
      );
    }
    return sessions.findByToken(token).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(new WeeklyChallengeForbidden()).pipe(
              Effect.tapError(() =>
                Effect.logWarning('WeeklyChallenge: session not found for token'),
              ),
            ),
          onSome: (session) =>
            users.findById(session.user_id).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(new WeeklyChallengeForbidden()).pipe(
                      Effect.tapError(() =>
                        Effect.logWarning('WeeklyChallenge: user not found for session'),
                      ),
                    ),
                  onSome: (user) => Effect.succeed(user),
                }),
              ),
            ),
        }),
      ),
    );
  }),
);

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

const assertCaptain = (
  members: {
    findMembershipByIds: (
      teamId: Team.TeamId,
      userId: Auth.UserId,
    ) => Effect.Effect<OptionType.Option<MembershipWithRole>>;
  },
  userId: Auth.UserId,
  teamId: Team.TeamId,
): Effect.Effect<void, WeeklyChallengeRpcGroup.WeeklyChallengeForbidden> =>
  members.findMembershipByIds(teamId, userId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(new WeeklyChallengeForbidden()).pipe(
            Effect.tapError(() =>
              Effect.logWarning(`WeeklyChallenge: user ${userId} not member of team ${teamId}`),
            ),
          ),
        onSome: (membership) => {
          if (!membership.permissions.includes('team:manage')) {
            return Effect.fail(new WeeklyChallengeForbidden()).pipe(
              Effect.tapError(() =>
                Effect.logWarning(
                  `WeeklyChallenge: user ${userId} lacks team:manage on team ${teamId}`,
                ),
              ),
            );
          }
          return Effect.void;
        },
      }),
    ),
  );

const assertActiveMember = (
  members: {
    findMembershipByIds: (
      teamId: Team.TeamId,
      userId: Auth.UserId,
    ) => Effect.Effect<OptionType.Option<MembershipWithRole>>;
  },
  userId: Auth.UserId,
  teamId: Team.TeamId,
): Effect.Effect<MembershipWithRole, WeeklyChallengeRpcGroup.WeeklyChallengeForbidden> =>
  members.findMembershipByIds(teamId, userId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(new WeeklyChallengeForbidden()).pipe(
            Effect.tapError(() =>
              Effect.logWarning(`WeeklyChallenge: user ${userId} not member of team ${teamId}`),
            ),
          ),
        onSome: (membership) =>
          membership.active
            ? Effect.succeed(membership)
            : Effect.fail(new WeeklyChallengeForbidden()).pipe(
                Effect.tapError(() =>
                  Effect.logWarning(`WeeklyChallenge: user ${userId} inactive in team ${teamId}`),
                ),
              ),
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Main RPC handlers (WeeklyChallengeRpcGroup)
// ---------------------------------------------------------------------------

export const WeeklyChallengeRpcLive = Effect.Do.pipe(
  Effect.bind('challenges', () => WeeklyChallengeRepository.asEffect()),
  Effect.bind('members', () => TeamMembersRepository.asEffect()),
  Effect.bind('settings', () => TeamSettingsRepository.asEffect()),
  Effect.let(
    'WeeklyChallenge/List',
    ({ challenges, members, settings }) =>
      ({ teamId }: { readonly teamId: Team.TeamId }) =>
        Effect.Do.pipe(
          Effect.bind('user', () => resolveCurrentUser),
          Effect.tap(({ user }) => assertActiveMember(members, user.id, teamId)),
          Effect.bind('teamSettings', () => settings.findByTeamId(teamId)),
          Effect.let('teamTz', ({ teamSettings }) =>
            Option.match(teamSettings, {
              onNone: () => 'UTC' as string,
              onSome: (s) => s.timezone,
            }),
          ),
          Effect.flatMap(({ teamTz }) => challenges.listForTeam(teamId, teamTz)),
        ),
  ),
  Effect.let(
    'WeeklyChallenge/Create',
    ({ challenges, members, settings }) =>
      ({
        teamId,
        weekStart,
        kind,
        title,
        description,
      }: {
        readonly teamId: Team.TeamId;
        readonly weekStart: Date;
        readonly kind: WeeklyChallenge.WeeklyChallengeKind;
        readonly title: WeeklyChallenge.WeeklyChallengeTitle;
        readonly description: OptionType.Option<WeeklyChallenge.WeeklyChallengeDescription>;
      }) =>
        Effect.Do.pipe(
          Effect.bind('user', () => resolveCurrentUser),
          Effect.bind('membership', ({ user }) =>
            members.findMembershipByIds(teamId, user.id).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(new WeeklyChallengeForbidden()) as Effect.Effect<
                      MembershipWithRole,
                      WeeklyChallengeRpcGroup.WeeklyChallengeForbidden
                    >,
                  onSome: (m) =>
                    Effect.succeed(m) as Effect.Effect<
                      MembershipWithRole,
                      WeeklyChallengeRpcGroup.WeeklyChallengeForbidden
                    >,
                }),
              ),
            ),
          ),
          Effect.tap(({ membership }) =>
            membership.permissions.includes('team:manage')
              ? Effect.void
              : Effect.fail(new WeeklyChallengeForbidden()).pipe(
                  Effect.tapError(() =>
                    Effect.logWarning(
                      `WeeklyChallenge/Create: user ${membership.user_id} lacks team:manage`,
                    ),
                  ),
                ),
          ),
          Effect.bind('teamSettings', () => settings.findByTeamId(teamId)),
          Effect.let('teamTz', ({ teamSettings }) =>
            Option.match(teamSettings, {
              onNone: () => 'UTC' as string,
              onSome: (s) => s.timezone,
            }),
          ),
          Effect.tap(({ teamTz }) => {
            const currentMonday = currentTeamMondayDate(teamTz);
            const maxMonday = new Date(currentMonday.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
            if (weekStart.getTime() < currentMonday.getTime()) {
              return Effect.fail(new WeeklyChallengeWeekOutOfRange());
            }
            if (weekStart.getTime() > maxMonday.getTime()) {
              return Effect.fail(new WeeklyChallengeWeekOutOfRange());
            }
            return Effect.void;
          }),
          Effect.bind('challenge', ({ membership }) =>
            challenges.create({
              team_id: teamId,
              week_start_date: weekStart,
              kind,
              title,
              description,
              created_by: membership.id,
            }),
          ),
          Effect.tap(({ challenge, teamSettings, teamTz }) => {
            const channelIdOpt = Option.flatMap(teamSettings, (s) => s.weekly_summary_channel_id);
            if (Option.isNone(channelIdOpt)) {
              return Effect.void;
            }
            const scheduledFor = scheduleAtNineAm(weekStart, teamTz);
            return challenges
              .enqueueAnnouncementEvent(challenge.id, teamId, channelIdOpt.value, scheduledFor)
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.logWarning(
                    'WeeklyChallenge: failed to enqueue announcement sync event',
                    cause,
                  ),
                ),
              );
          }),
          Effect.map(({ challenge }) => challenge),
        ),
  ),
  Effect.let(
    'WeeklyChallenge/UpdateTitleDescription',
    ({ challenges, members }) =>
      ({
        challengeId,
        title,
        description,
      }: {
        readonly challengeId: WeeklyChallenge.WeeklyChallengeId;
        readonly title: WeeklyChallenge.WeeklyChallengeTitle;
        readonly description: OptionType.Option<WeeklyChallenge.WeeklyChallengeDescription>;
      }) =>
        Effect.Do.pipe(
          Effect.bind('user', () => resolveCurrentUser),
          Effect.bind('challenge', () =>
            challenges.findById(challengeId).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(new WeeklyChallengeNotFound()) as Effect.Effect<
                      WeeklyChallenge.WeeklyChallenge,
                      WeeklyChallengeRpcGroup.WeeklyChallengeNotFound
                    >,
                  onSome: (c) =>
                    Effect.succeed(c) as Effect.Effect<
                      WeeklyChallenge.WeeklyChallenge,
                      WeeklyChallengeRpcGroup.WeeklyChallengeNotFound
                    >,
                }),
              ),
            ),
          ),
          Effect.tap(({ user, challenge }) => assertCaptain(members, user.id, challenge.team_id)),
          Effect.flatMap(() => challenges.updateTitleDescription(challengeId, title, description)),
        ),
  ),
  Effect.let(
    'WeeklyChallenge/Delete',
    ({ challenges, members }) =>
      ({ challengeId }: { readonly challengeId: WeeklyChallenge.WeeklyChallengeId }) =>
        Effect.Do.pipe(
          Effect.bind('user', () => resolveCurrentUser),
          Effect.bind('challenge', () =>
            challenges.findById(challengeId).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(new WeeklyChallengeNotFound()) as Effect.Effect<
                      WeeklyChallenge.WeeklyChallenge,
                      WeeklyChallengeRpcGroup.WeeklyChallengeNotFound
                    >,
                  onSome: (c) =>
                    Effect.succeed(c) as Effect.Effect<
                      WeeklyChallenge.WeeklyChallenge,
                      WeeklyChallengeRpcGroup.WeeklyChallengeNotFound
                    >,
                }),
              ),
            ),
          ),
          Effect.tap(({ user, challenge }) => assertCaptain(members, user.id, challenge.team_id)),
          Effect.flatMap(() => challenges.delete(challengeId)),
        ),
  ),
  Effect.let(
    'WeeklyChallenge/MarkCompleted',
    ({ challenges, settings, members }) =>
      ({ challengeId }: { readonly challengeId: WeeklyChallenge.WeeklyChallengeId }) =>
        Effect.Do.pipe(
          Effect.bind('user', () => resolveCurrentUser),
          Effect.bind('challenge', () =>
            challenges.findById(challengeId).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(new WeeklyChallengeNotFound()) as Effect.Effect<
                      WeeklyChallenge.WeeklyChallenge,
                      WeeklyChallengeRpcGroup.WeeklyChallengeNotFound
                    >,
                  onSome: (c) =>
                    Effect.succeed(c) as Effect.Effect<
                      WeeklyChallenge.WeeklyChallenge,
                      WeeklyChallengeRpcGroup.WeeklyChallengeNotFound
                    >,
                }),
              ),
            ),
          ),
          Effect.bind('membership', ({ user, challenge }) =>
            assertActiveMember(members, user.id, challenge.team_id),
          ),
          Effect.bind('teamSettings', ({ challenge }) => settings.findByTeamId(challenge.team_id)),
          Effect.let('teamTz', ({ teamSettings }) =>
            Option.match(teamSettings, {
              onNone: () => 'UTC' as string,
              onSome: (s) => s.timezone,
            }),
          ),
          Effect.flatMap(({ membership, teamTz }) =>
            challenges.markCompleted(challengeId, membership.id, teamTz),
          ),
        ),
  ),
  Effect.let(
    'WeeklyChallenge/UnmarkCompleted',
    ({ challenges, settings, members }) =>
      ({ challengeId }: { readonly challengeId: WeeklyChallenge.WeeklyChallengeId }) =>
        Effect.Do.pipe(
          Effect.bind('user', () => resolveCurrentUser),
          Effect.bind('challenge', () =>
            challenges.findById(challengeId).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(new WeeklyChallengeNotFound()) as Effect.Effect<
                      WeeklyChallenge.WeeklyChallenge,
                      WeeklyChallengeRpcGroup.WeeklyChallengeNotFound
                    >,
                  onSome: (c) =>
                    Effect.succeed(c) as Effect.Effect<
                      WeeklyChallenge.WeeklyChallenge,
                      WeeklyChallengeRpcGroup.WeeklyChallengeNotFound
                    >,
                }),
              ),
            ),
          ),
          Effect.bind('membership', ({ user, challenge }) =>
            assertActiveMember(members, user.id, challenge.team_id),
          ),
          Effect.bind('teamSettings', ({ challenge }) => settings.findByTeamId(challenge.team_id)),
          Effect.let('teamTz', ({ teamSettings }) =>
            Option.match(teamSettings, {
              onNone: () => 'UTC' as string,
              onSome: (s) => s.timezone,
            }),
          ),
          Effect.flatMap(({ membership, teamTz }) =>
            challenges.unmarkCompleted(challengeId, membership.id, teamTz),
          ),
        ),
  ),
  Bind.remove('challenges'),
  Bind.remove('members'),
  Bind.remove('settings'),
  (handlers) => WeeklyChallengeRpcGroup.WeeklyChallengeRpcGroup.toLayer(handlers),
);

// ---------------------------------------------------------------------------
// Sync events RPC handlers (WeeklyChallengeSyncEventsRpcGroup)
// ---------------------------------------------------------------------------

export const WeeklyChallengeSyncEventsRpcLive = Effect.Do.pipe(
  Effect.bind('challenges', () => WeeklyChallengeRepository.asEffect()),
  Effect.let(
    'WeeklyChallenge/GetUnprocessedWeeklyChallengeEvents',
    ({ challenges }) =>
      () =>
        challenges.listUnprocessedDueEvents().pipe(
          Effect.map((rows) =>
            rows.map(
              (row) =>
                new WeeklyChallengeSyncEvents.UnprocessedWeeklyChallengeEvent({
                  id: row.id,
                  teamId: row.team_id,
                  challengeId: row.challenge_id,
                  channelId: row.channel_id,
                  scheduledFor: DateTime.makeUnsafe(row.scheduled_for.getTime()),
                  attempts: row.attempts,
                  title: row.title,
                  kind: row.kind,
                  description: row.description,
                  weekStartDate: row.week_start_date.toISOString().split('T')[0] ?? '',
                  weekEndDate:
                    new Date(row.week_start_date.getTime() + 6 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .split('T')[0] ?? '',
                }),
            ),
          ),
        ),
  ),
  Effect.let(
    'WeeklyChallenge/MarkWeeklyChallengeProcessed',
    ({ challenges }) =>
      ({
        eventId,
        deliveredAt,
      }: {
        readonly eventId: string;
        readonly deliveredAt: DateTime.Utc;
      }) =>
        challenges.markProcessed(eventId, new Date(deliveredAt.epochMilliseconds)),
  ),
  Effect.let(
    'WeeklyChallenge/MarkWeeklyChallengeFailed',
    ({ challenges }) =>
      ({ eventId, error }: { readonly eventId: string; readonly error: string }) =>
        challenges.markFailed(eventId, error),
  ),
  Bind.remove('challenges'),
  (handlers) => WeeklyChallengeSyncEvents.WeeklyChallengeSyncEventsRpcGroup.toLayer(handlers),
);
