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
                        eventDate: e.event_date,
                        startTime: e.start_time,
                        endTime: e.end_time,
                        location: e.location,
                        status: e.status,
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
                  eventDate: payload.eventDate,
                  startTime: payload.startTime,
                  endTime: payload.endTime,
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
                  eventDate: event.event_date,
                  startTime: event.start_time,
                  endTime: event.end_time,
                  location: event.location,
                  status: event.status,
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
                  eventDate: event.event_date,
                  startTime: event.start_time,
                  endTime: event.end_time,
                  location: event.location,
                  status: event.status,
                  createdByName: event.created_by_name,
                  canEdit: canEdit && event.status === 'active',
                  canCancel: canCancel && event.status === 'active',
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
            Effect.tap(({ existing, isAdmin }) => {
              const newTrainingTypeId =
                payload.trainingTypeId !== null
                  ? payload.trainingTypeId
                  : existing.training_type_id;
              return checkCoachScoping(events, existing.created_by, newTrainingTypeId, isAdmin);
            }),
            Effect.bind('updated', ({ existing }) =>
              events
                .updateEvent({
                  id: eventId,
                  title: payload.title ?? existing.title,
                  eventType: payload.eventType ?? existing.event_type,
                  trainingTypeId:
                    payload.trainingTypeId !== undefined
                      ? payload.trainingTypeId
                      : existing.training_type_id,
                  description:
                    payload.description !== undefined ? payload.description : existing.description,
                  eventDate: payload.eventDate ?? existing.event_date,
                  startTime: payload.startTime ?? existing.start_time,
                  endTime: payload.endTime !== undefined ? payload.endTime : existing.end_time,
                  location: payload.location !== undefined ? payload.location : existing.location,
                })
                .pipe(Effect.mapError(() => forbidden)),
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
                eventDate: detail.event_date,
                startTime: detail.start_time,
                endTime: detail.end_time,
                location: detail.location,
                status: detail.status,
                createdByName: detail.created_by_name,
                canEdit: canEdit && detail.status === 'active',
                canCancel: canCancel && detail.status === 'active',
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
            Effect.tap(({ existing, isAdmin }) =>
              checkCoachScoping(events, existing.created_by, existing.training_type_id, isAdmin),
            ),
            Effect.tap(() => events.cancelEvent(eventId).pipe(Effect.mapError(() => forbidden))),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
