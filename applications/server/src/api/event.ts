import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventApi, type TeamMember, type TrainingType } from '@sideline/domain';
import { Array, Effect, Option, pipe } from 'effect';
import { Api } from '~/api/api.js';
import { hasPermission, requireMembership, requirePermission } from '~/api/permissions.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { resolveChannel } from '~/services/EventChannelResolver.js';

const forbidden = new EventApi.Forbidden();
const notFound = new EventApi.EventNotFound();
const cancelled = new EventApi.EventCancelled();

const checkCoachScoping = (
  events: EventsRepository,
  memberId: TeamMember.TeamMemberId,
  trainingTypeId: Option.Option<TrainingType.TrainingTypeId | string>,
  isAdmin: boolean,
) => {
  if (isAdmin) return Effect.void;
  if (Option.isNone(trainingTypeId)) return Effect.void;
  return events.getScopedTrainingTypeIds(memberId).pipe(
    Effect.flatMap((scopedIds) => {
      const allowed = pipe(
        scopedIds,
        Array.map((s) => s.training_type_id),
      );
      if (Array.isEmptyArray(allowed)) return Effect.void;
      return pipe(allowed, Array.contains(trainingTypeId.value))
        ? Effect.void
        : Effect.fail(forbidden);
    }),
  );
};

export const EventApiLive = HttpApiBuilder.group(Api, 'event', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('events', () => EventsRepository),
    Effect.bind('syncEvents', () => EventSyncEventsRepository),
    Effect.map(({ members, events, syncEvents }) =>
      handlers
        .handle('listEvents', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.let('canCreate', ({ membership }) => hasPermission(membership, 'event:create')),
            Effect.bind('list', () => events.findEventsByTeamId(teamId)),
            Effect.map(
              ({ list, canCreate }) =>
                new EventApi.EventListResponse({
                  canCreate,
                  events: Array.map(
                    list,
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
              events.insertEvent({
                teamId,
                trainingTypeId: payload.trainingTypeId,
                eventType: payload.eventType,
                title: payload.title,
                description: payload.description,
                startAt: payload.startAt,
                endAt: payload.endAt,
                location: payload.location,
                createdBy: membership.id,
                discordTargetChannelId: payload.discordChannelId,
              }),
            ),
            Effect.bind('resolvedChannel', ({ event }) => resolveChannel(teamId, event.id)),
            Effect.tap(({ event, resolvedChannel }) =>
              syncEvents.emitEventCreated(
                teamId,
                event.id,
                event.title,
                event.description,
                event.start_at,
                event.end_at,
                event.location,
                event.event_type,
                resolvedChannel,
              ),
            ),
            Effect.map(
              ({ event }) =>
                new EventApi.EventInfo({
                  eventId: event.id,
                  teamId: event.team_id,
                  title: event.title,
                  eventType: event.event_type,
                  trainingTypeName: Option.none(),
                  startAt: event.start_at,
                  endAt: event.end_at,
                  location: event.location,
                  status: event.status,
                  seriesId: event.series_id,
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
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
                  discordChannelId: event.discord_target_channel_id,
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
                onSome: (v) => v,
              });
              return checkCoachScoping(events, membership.id, newTrainingTypeId, isAdmin);
            }),
            Effect.bind('updated', ({ existing }) =>
              events.updateEvent({
                id: eventId,
                title: Option.getOrElse(payload.title, () => existing.title),
                eventType: Option.getOrElse(payload.eventType, () => existing.event_type),
                trainingTypeId: Option.match(payload.trainingTypeId, {
                  onNone: () => existing.training_type_id,
                  onSome: (v) => v,
                }),
                description: Option.match(payload.description, {
                  onNone: () => existing.description,
                  onSome: (v) => v,
                }),
                startAt: Option.getOrElse(payload.startAt, () => existing.start_at),
                endAt: Option.match(payload.endAt, {
                  onNone: () => existing.end_at,
                  onSome: (v) => v,
                }),
                location: Option.match(payload.location, {
                  onNone: () => existing.location,
                  onSome: (v) => v,
                }),
                discordTargetChannelId: Option.match(payload.discordChannelId, {
                  onNone: () => existing.discord_target_channel_id,
                  onSome: (v) => v,
                }),
              }),
            ),
            Effect.tap(({ existing }) =>
              Option.isSome(existing.series_id)
                ? events.markEventSeriesModified(eventId)
                : Effect.void,
            ),
            Effect.bind('detail', () =>
              events.findEventByIdWithDetails(eventId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(notFound),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('resolvedChannelForUpdate', ({ detail }) =>
              resolveChannel(teamId, detail.id),
            ),
            Effect.tap(({ detail, resolvedChannelForUpdate }) =>
              syncEvents.emitEventUpdated(
                teamId,
                detail.id,
                detail.title,
                detail.description,
                detail.start_at,
                detail.end_at,
                detail.location,
                detail.event_type,
                resolvedChannelForUpdate,
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
                discordChannelId: detail.discord_target_channel_id,
              });
            }),
            Effect.catchTag('NoSuchElementException', Effect.die),
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
            Effect.tap(() => events.cancelEvent(eventId)),
            Effect.tap(({ existing }) =>
              syncEvents.emitEventCancelled(
                teamId,
                existing.id,
                existing.title,
                existing.description,
                existing.start_at,
                existing.end_at,
                existing.location,
                existing.event_type,
              ),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
