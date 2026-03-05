import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventRsvpApi } from '@sideline/domain';
import { DateTime, Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership } from '~/api/permissions.js';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

const forbidden = new EventRsvpApi.Forbidden();
const notFound = new EventRsvpApi.EventNotFound();
const deadlinePassed = new EventRsvpApi.RsvpDeadlinePassed();

const isEventPastDeadline = (startAt: string): boolean =>
  !DateTime.lessThan(DateTime.unsafeNow(), DateTime.unsafeMake(startAt));

const buildRsvpDetail = (
  rsvps: EventRsvpsRepository,
  eventId: Parameters<EventRsvpsRepository['findRsvpsByEventId']>[0],
  myMemberId: Parameters<EventRsvpsRepository['findRsvpByEventAndMember']>[1],
  canRsvp: boolean,
) =>
  Effect.Do.pipe(
    Effect.bind('allRsvps', () =>
      rsvps.findRsvpsByEventId(eventId).pipe(Effect.mapError(() => forbidden)),
    ),
    Effect.bind('myRsvp', () =>
      rsvps.findRsvpByEventAndMember(eventId, myMemberId).pipe(Effect.mapError(() => forbidden)),
    ),
    Effect.bind('counts', () =>
      rsvps.countRsvpsByEventId(eventId).pipe(Effect.mapError(() => forbidden)),
    ),
    Effect.map(({ allRsvps, myRsvp, counts }) => {
      const yesCount = counts.find((c) => c.response === 'yes')?.count ?? 0;
      const noCount = counts.find((c) => c.response === 'no')?.count ?? 0;
      const maybeCount = counts.find((c) => c.response === 'maybe')?.count ?? 0;
      const my = Option.getOrNull(myRsvp);
      return new EventRsvpApi.EventRsvpDetail({
        myResponse: my?.response ?? null,
        myMessage: my?.message ?? null,
        rsvps: allRsvps.map(
          (r) =>
            new EventRsvpApi.RsvpEntry({
              teamMemberId: r.team_member_id,
              memberName: r.member_name,
              username: r.username,
              response: r.response,
              message: r.message,
            }),
        ),
        yesCount,
        noCount,
        maybeCount,
        canRsvp,
      });
    }),
  );

export const EventRsvpApiLive = HttpApiBuilder.group(Api, 'eventRsvp', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('events', () => EventsRepository),
    Effect.bind('rsvps', () => EventRsvpsRepository),
    Effect.map(({ members, events, rsvps }) =>
      handlers
        .handle('getRsvps', ({ path: { teamId, eventId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.bind('event', () =>
              events.findEventByIdWithDetails(eventId).pipe(
                Effect.mapError(() => forbidden),
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
            Effect.flatMap(({ event, membership }) => {
              const canRsvp = event.status === 'active' && !isEventPastDeadline(event.start_at);
              return buildRsvpDetail(rsvps, eventId, membership.id, canRsvp);
            }),
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
                Effect.mapError(() => forbidden),
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
            Effect.tap(({ membership }) =>
              rsvps
                .upsertRsvp(eventId, membership.id, payload.response, payload.message)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.flatMap(({ membership }) =>
              buildRsvpDetail(rsvps, eventId, membership.id, true),
            ),
          ),
        ),
    ),
  ),
);
