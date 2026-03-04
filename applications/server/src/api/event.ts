import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventApi, type TeamMember, type TrainingType } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { hasPermission, requireMembership, requirePermission } from '~/api/permissions.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

const forbidden = new EventApi.Forbidden();
const notFound = new EventApi.EventNotFound();
const cancelled = new EventApi.EventCancelled();

const checkCoachScoping = (
  events: EventsRepository,
  memberId: TeamMember.TeamMemberId,
  trainingTypeId: TrainingType.TrainingTypeId | string | null,
  isAdmin: boolean,
) => {
  if (isAdmin) return Effect.void;
  if (trainingTypeId === null) return Effect.void;
  return events.getScopedTrainingTypeIds(memberId).pipe(
    Effect.mapError(() => forbidden),
    Effect.flatMap((scopedIds) => {
      const allowed: readonly string[] = scopedIds.map((s) => s.training_type_id);
      if (allowed.length === 0) return Effect.void;
      return allowed.includes(trainingTypeId) ? Effect.void : Effect.fail(forbidden);
    }),
  );
};

export const EventApiLive = HttpApiBuilder.group(Api, 'event', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('events', () => EventsRepository),
    Effect.map(({ members, events }) =>
      handlers
        .handle('listEvents', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.let('canCreate', ({ membership }) => hasPermission(membership, 'event:create')),
            Effect.bind('list', () =>
              events.findEventsByTeamId(teamId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ list, canCreate }) =>
                new EventApi.EventListResponse({
                  canCreate,
                  events: list.map(
                    (e) =>
                      new EventApi.EventInfo({
                        eventId: e.id,
                        teamId: e.team_id,
                        title: e.title,
                        eventType: e.event_type,
                        trainingTypeName: e.training_type_name,
                        startAt: e.start_at,
                        endAt: e.end_at,
                        location: e.location,
                        status: e.status,
                        seriesId: e.series_id,
                      }),
                  ),
                }),
            ),
          ),
        )
        .handle('createEvent', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'event:create', forbidden),
            ),
            Effect.let('isAdmin', ({ membership }) => hasPermission(membership, 'team:manage')),
            Effect.tap(({ membership, isAdmin }) =>
              checkCoachScoping(events, membership.id, payload.trainingTypeId, isAdmin),
            ),
            Effect.bind('event', ({ membership }) =>
              events
                .insertEvent({
                  teamId,
                  trainingTypeId: payload.trainingTypeId,
                  eventType: payload.eventType,
                  title: payload.title,
                  description: payload.description,
                  startAt: payload.startAt,
                  endAt: payload.endAt,
                  location: payload.location,
                  createdBy: membership.id,
                })
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ event }) =>
                new EventApi.EventInfo({
                  eventId: event.id,
                  teamId: event.team_id,
                  title: event.title,
                  eventType: event.event_type,
                  trainingTypeName: null,
                  startAt: event.start_at,
                  endAt: event.end_at,
                  location: event.location,
                  status: event.status,
                  seriesId: event.series_id,
                }),
            ),
          ),
        )
        .handle('getEvent', ({ path: { teamId, eventId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.let('canEdit', ({ membership }) => hasPermission(membership, 'event:edit')),
            Effect.let('canCancel', ({ membership }) => hasPermission(membership, 'event:cancel')),
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
            Effect.map(
              ({ event, canEdit, canCancel }) =>
                new EventApi.EventDetail({
                  eventId: event.id,
                  teamId: event.team_id,
                  title: event.title,
                  eventType: event.event_type,
                  trainingTypeId: event.training_type_id,
                  trainingTypeName: event.training_type_name,
                  description: event.description,
                  startAt: event.start_at,
                  endAt: event.end_at,
                  location: event.location,
                  status: event.status,
                  createdByName: event.created_by_name,
                  canEdit: canEdit && event.status === 'active',
                  canCancel: canCancel && event.status === 'active',
                  seriesId: event.series_id,
                  seriesModified: event.series_modified,
                }),
            ),
          ),
        )
        .handle('updateEvent', ({ path: { teamId, eventId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'event:edit', forbidden)),
            Effect.let('isAdmin', ({ membership }) => hasPermission(membership, 'team:manage')),
            Effect.bind('existing', () =>
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
            Effect.tap(({ existing }) =>
              existing.team_id !== teamId ? Effect.fail(notFound) : Effect.void,
            ),
            Effect.tap(({ existing }) =>
              existing.status === 'cancelled' ? Effect.fail(cancelled) : Effect.void,
            ),
            Effect.tap(({ existing, isAdmin, membership }) => {
              const newTrainingTypeId = Option.match(payload.trainingTypeId, {
                onNone: () => existing.training_type_id,
                onSome: Option.getOrNull,
              });
              return checkCoachScoping(events, membership.id, newTrainingTypeId, isAdmin);
            }),
            Effect.bind('updated', ({ existing }) =>
              events
                .updateEvent({
                  id: eventId,
                  title: Option.getOrElse(payload.title, () => existing.title),
                  eventType: Option.getOrElse(payload.eventType, () => existing.event_type),
                  trainingTypeId: Option.match(payload.trainingTypeId, {
                    onNone: () => existing.training_type_id,
                    onSome: Option.getOrNull,
                  }),
                  description: Option.match(payload.description, {
                    onNone: () => existing.description,
                    onSome: Option.getOrNull,
                  }),
                  startAt: Option.getOrElse(payload.startAt, () => existing.start_at),
                  endAt: Option.match(payload.endAt, {
                    onNone: () => existing.end_at,
                    onSome: Option.getOrNull,
                  }),
                  location: Option.match(payload.location, {
                    onNone: () => existing.location,
                    onSome: Option.getOrNull,
                  }),
                })
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ existing }) =>
              existing.series_id !== null
                ? events.markEventSeriesModified(eventId).pipe(Effect.mapError(() => forbidden))
                : Effect.void,
            ),
            Effect.bind('detail', () =>
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
            Effect.map(({ detail, membership }) => {
              const canEdit = hasPermission(membership, 'event:edit');
              const canCancel = hasPermission(membership, 'event:cancel');
              return new EventApi.EventDetail({
                eventId: detail.id,
                teamId: detail.team_id,
                title: detail.title,
                eventType: detail.event_type,
                trainingTypeId: detail.training_type_id,
                trainingTypeName: detail.training_type_name,
                description: detail.description,
                startAt: detail.start_at,
                endAt: detail.end_at,
                location: detail.location,
                status: detail.status,
                createdByName: detail.created_by_name,
                canEdit: canEdit && detail.status === 'active',
                canCancel: canCancel && detail.status === 'active',
                seriesId: detail.series_id,
                seriesModified: detail.series_modified,
              });
            }),
          ),
        )
        .handle('cancelEvent', ({ path: { teamId, eventId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'event:cancel', forbidden),
            ),
            Effect.let('isAdmin', ({ membership }) => hasPermission(membership, 'team:manage')),
            Effect.bind('existing', () =>
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
            Effect.tap(({ existing }) =>
              existing.team_id !== teamId ? Effect.fail(notFound) : Effect.void,
            ),
            Effect.tap(({ existing }) =>
              existing.status === 'cancelled' ? Effect.fail(cancelled) : Effect.void,
            ),
            Effect.tap(({ existing, isAdmin, membership }) =>
              checkCoachScoping(events, membership.id, existing.training_type_id, isAdmin),
            ),
            Effect.tap(() => events.cancelEvent(eventId).pipe(Effect.mapError(() => forbidden))),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
