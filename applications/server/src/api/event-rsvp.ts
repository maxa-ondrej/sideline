import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventRsvpApi, type GroupModel, type TeamMember } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Array, DateTime, Effect, Option, pipe } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';

const forbidden = new EventRsvpApi.Forbidden();
const notFound = new EventRsvpApi.EventNotFound();
const deadlinePassed = new EventRsvpApi.RsvpDeadlinePassed();

const checkGroupAccess = (
  groups: GroupsRepository,
  memberId: TeamMember.TeamMemberId,
  groupId: Option.Option<GroupModel.GroupId>,
): Effect.Effect<boolean, never, never> => {
  if (Option.isNone(groupId)) return Effect.succeed(true);
  return groups
    .getDescendantMemberIds(groupId.value)
    .pipe(Effect.map((memberIds) => Array.contains(memberIds, memberId)));
};

const isEventPastDeadline = (startAt: DateTime.Utc): boolean =>
  !DateTime.lessThan(DateTime.unsafeNow(), startAt);

const buildRsvpDetail = (
  rsvps: EventRsvpsRepository,
  eventId: Parameters<EventRsvpsRepository['findRsvpsByEventId']>[0],
  myMemberId: Parameters<EventRsvpsRepository['findRsvpByEventAndMember']>[1],
  canRsvp: boolean,
  minPlayersThreshold: number,
) =>
  Effect.Do.pipe(
    Effect.bind('allRsvps', () => rsvps.findRsvpsByEventId(eventId)),
    Effect.bind('myRsvp', () => rsvps.findRsvpByEventAndMember(eventId, myMemberId)),
    Effect.bind('counts', () => rsvps.countRsvpsByEventId(eventId)),
    Effect.map(
      ({ allRsvps, myRsvp, counts }) =>
        new EventRsvpApi.EventRsvpDetail({
          myResponse: Option.map(myRsvp, (my) => my.response),
          myMessage: Option.flatMap(myRsvp, (my) => my.message),
          rsvps: Array.map(
            allRsvps,
            (r) =>
              new EventRsvpApi.RsvpEntry({
                teamMemberId: r.team_member_id,
                memberName: r.member_name,
                username: r.username,
                response: r.response,
                message: r.message,
              }),
          ),
          yesCount: pipe(
            counts,
            Array.findFirst((c) => c.response === 'yes'),
            Option.map((c) => c.count),
            Option.getOrElse(() => 0),
          ),
          noCount: pipe(
            counts,
            Array.findFirst((c) => c.response === 'no'),
            Option.map((c) => c.count),
            Option.getOrElse(() => 0),
          ),
          maybeCount: pipe(
            counts,
            Array.findFirst((c) => c.response === 'maybe'),
            Option.map((c) => c.count),
            Option.getOrElse(() => 0),
          ),
          canRsvp,
          minPlayersThreshold,
        }),
    ),
  );

export const EventRsvpApiLive = HttpApiBuilder.group(Api, 'eventRsvp', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('events', () => EventsRepository),
    Effect.bind('rsvps', () => EventRsvpsRepository),
    Effect.bind('syncEvents', () => EventSyncEventsRepository),
    Effect.bind('teamSettings', () => TeamSettingsRepository),
    Effect.bind('groups', () => GroupsRepository),
    Effect.map(({ members, events, rsvps, syncEvents, teamSettings, groups }) =>
      handlers
        .handle('getRsvps', ({ path: { teamId, eventId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.bind('event', () =>
              events.findEventByIdWithDetails(eventId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(notFound),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ event }) =>
              event.team_id !== teamId ? Effect.fail(notFound) : Effect.void,
            ),
            Effect.bind('settings', () => teamSettings.findByTeamId(teamId)),
            Effect.bind('isGroupMember', ({ event, membership }) =>
              checkGroupAccess(groups, membership.id, event.member_group_id),
            ),
            Effect.flatMap(({ event, membership, settings, isGroupMember }) =>
              buildRsvpDetail(
                rsvps,
                eventId,
                membership.id,
                event.status === 'active' && !isEventPastDeadline(event.start_at) && isGroupMember,
                Option.match(settings, {
                  onNone: () => 0,
                  onSome: (s) => s.min_players_threshold,
                }),
              ),
            ),
          ),
        )
        .handle('submitRsvp', ({ path: { teamId, eventId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.bind('event', () =>
              events.findEventByIdWithDetails(eventId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(notFound),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ event }) =>
              event.team_id !== teamId ? Effect.fail(notFound) : Effect.void,
            ),
            Effect.tap(({ event }) =>
              event.status !== 'active' ? Effect.fail(notFound) : Effect.void,
            ),
            Effect.tap(({ event }) =>
              isEventPastDeadline(event.start_at) ? Effect.fail(deadlinePassed) : Effect.void,
            ),
            Effect.tap(({ event, membership }) =>
              checkGroupAccess(groups, membership.id, event.member_group_id).pipe(
                Effect.flatMap((isMember) => (isMember ? Effect.void : Effect.fail(forbidden))),
              ),
            ),
            Effect.tap(({ membership }) =>
              rsvps.upsertRsvp(eventId, membership.id, payload.response, payload.message).pipe(
                Effect.catchTag(
                  'NoSuchElementException',
                  LogicError.withMessage(() => 'Failed upserting RSVP — no row returned'),
                ),
              ),
            ),
            Effect.andThen(({ event }) =>
              syncEvents.emitEventUpdated(
                teamId,
                event.id,
                event.title,
                event.description,
                event.start_at,
                event.end_at,
                event.location,
                event.event_type,
              ),
            ),
          ),
        )
        .handle('getNonResponders', ({ path: { teamId, eventId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'event:edit', forbidden)),
            Effect.bind('event', () =>
              events.findEventByIdWithDetails(eventId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(notFound),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ event }) =>
              event.team_id !== teamId ? Effect.fail(notFound) : Effect.void,
            ),
            Effect.bind('nonResponders', ({ event }) =>
              rsvps.findNonRespondersByEventId(eventId, teamId, event.member_group_id),
            ),
            Effect.map(
              ({ nonResponders }) =>
                new EventRsvpApi.NonRespondersResponse({
                  nonResponders: Array.map(
                    nonResponders,
                    (nr) =>
                      new EventRsvpApi.NonResponderEntry({
                        teamMemberId: nr.team_member_id,
                        memberName: nr.member_name,
                        username: nr.username,
                      }),
                  ),
                }),
            ),
          ),
        ),
    ),
  ),
);
