import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventRsvpApi } from '@sideline/domain';
import { Array, DateTime, Effect, Option, pipe } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';

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
  minPlayersThreshold: number,
) =>
  Effect.Do.pipe(
    Effect.bind('allRsvps', () => rsvps.findRsvpsByEventId(eventId)),
    Effect.bind('myRsvp', () => rsvps.findRsvpByEventAndMember(eventId, myMemberId)),
    Effect.bind('counts', () => rsvps.countRsvpsByEventId(eventId)),
    Effect.map(({ allRsvps, myRsvp, counts }) => {
      const yesCount = pipe(
        counts,
        Array.findFirst((c) => c.response === 'yes'),
        Option.map((c) => c.count),
        Option.getOrElse(() => 0),
      );
      const noCount = pipe(
        counts,
        Array.findFirst((c) => c.response === 'no'),
        Option.map((c) => c.count),
        Option.getOrElse(() => 0),
      );
      const maybeCount = pipe(
        counts,
        Array.findFirst((c) => c.response === 'maybe'),
        Option.map((c) => c.count),
        Option.getOrElse(() => 0),
      );
      return new EventRsvpApi.EventRsvpDetail({
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
        yesCount,
        noCount,
        maybeCount,
        canRsvp,
        minPlayersThreshold,
      });
    }),
  );

export const EventRsvpApiLive = HttpApiBuilder.group(Api, 'eventRsvp', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('events', () => EventsRepository),
    Effect.bind('rsvps', () => EventRsvpsRepository),
    Effect.bind('teamSettings', () => TeamSettingsRepository),
    Effect.map(({ members, events, rsvps, teamSettings }) =>
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
            Effect.flatMap(({ event, membership, settings }) => {
              const canRsvp = event.status === 'active' && !isEventPastDeadline(event.start_at);
              const threshold = Option.match(settings, {
                onNone: () => 0,
                onSome: (s) => s.min_players_threshold,
              });
              return buildRsvpDetail(rsvps, eventId, membership.id, canRsvp, threshold);
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
              rsvps.upsertRsvp(eventId, membership.id, payload.response, payload.message),
            ),
            Effect.bind('settings', () => teamSettings.findByTeamId(teamId)),
            Effect.flatMap(({ membership, settings }) => {
              const threshold = Option.match(settings, {
                onNone: () => 0,
                onSome: (s) => s.min_players_threshold,
              });
              return buildRsvpDetail(rsvps, eventId, membership.id, true, threshold);
            }),
            Effect.catchTag('NoSuchElementException', Effect.die),
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
            Effect.bind('nonResponders', () => rsvps.findNonRespondersByEventId(eventId, teamId)),
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
