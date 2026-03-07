import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventApi, type TeamMember, type TrainingType } from '@sideline/domain';
import { Effect, Option } from 'effect';
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
      const allowed: readonly string[] = scopedIds.map((s) => s.training_type_id);
      if (allowed.length === 0) return Effect.void;
      return allowed.includes(trainingTypeId.value) ? Effect.void : Effect.fail(forbidden);
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
                  events: list.map(
                    (e) =>
                      new EventApi.EventInfo({
                        eventId: e.id,
                        teamId: e.team_id,
                        title: e.title,
                        eventType: e.event_type,
                        trainingTypeName: Option.getOrNull(e.training_type_name),
                        startAt: e.start_at,
                        endAt: Option.getOrNull(e.end_at),
                        location: Option.getOrNull(e.location),
                        status: e.status,
                        seriesId: Option.getOrNull(e.series_id),
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
              checkCoachScoping(
                events,
                membership.id,
                Option.fromNullable(payload.trainingTypeId),
                isAdmin,
              ),
            ),
            Effect.bind('event', ({ membership }) =>
              events.insertEvent({
                teamId,
                trainingTypeId: Option.fromNullable(payload.trainingTypeId),
                eventType: payload.eventType,
                title: payload.title,
                description: Option.fromNullable(payload.description),
                startAt: payload.startAt,
                endAt: Option.fromNullable(payload.endAt),
                location: Option.fromNullable(payload.location),
                createdBy: membership.id,
                discordTargetChannelId: Option.fromNullable(payload.discordChannelId),
              }),
            ),
            Effect.bind('resolvedChannel', ({ event }) =>
              resolveChannel(teamId, event.id).pipe(Effect.catchAll(() => Effect.succeed(null))),
            ),
            Effect.tap(({ event, resolvedChannel }) =>
              syncEvents
                .emitEventCreated(
                  teamId,
                  event.id,
                  event.title,
                  Option.getOrNull(event.description),
                  event.start_at,
                  Option.getOrNull(event.end_at),
                  Option.getOrNull(event.location),
                  event.event_type,
                  resolvedChannel,
                )
                .pipe(Effect.catchAll(() => Effect.void)),
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
                  endAt: Option.getOrNull(event.end_at),
                  location: Option.getOrNull(event.location),
                  status: event.status,
                  seriesId: Option.getOrNull(event.series_id),
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
                  trainingTypeId: Option.getOrNull(event.training_type_id),
                  trainingTypeName: Option.getOrNull(event.training_type_name),
                  description: Option.getOrNull(event.description),
                  startAt: event.start_at,
                  endAt: Option.getOrNull(event.end_at),
                  location: Option.getOrNull(event.location),
                  status: event.status,
                  createdByName: Option.getOrNull(event.created_by_name),
                  canEdit: canEdit && event.status === 'active',
                  canCancel: canCancel && event.status === 'active',
                  seriesId: Option.getOrNull(event.series_id),
                  seriesModified: event.series_modified,
                  discordChannelId: Option.getOrNull(event.discord_target_channel_id),
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
              resolveChannel(teamId, detail.id).pipe(Effect.catchAll(() => Effect.succeed(null))),
            ),
            Effect.tap(({ detail, resolvedChannelForUpdate }) =>
              syncEvents
                .emitEventUpdated(
                  teamId,
                  detail.id,
                  detail.title,
                  Option.getOrNull(detail.description),
                  detail.start_at,
                  Option.getOrNull(detail.end_at),
                  Option.getOrNull(detail.location),
                  detail.event_type,
                  resolvedChannelForUpdate,
                )
                .pipe(Effect.catchAll(() => Effect.void)),
            ),
            Effect.map(({ detail, membership }) => {
              const canEdit = hasPermission(membership, 'event:edit');
              const canCancel = hasPermission(membership, 'event:cancel');
              return new EventApi.EventDetail({
                eventId: detail.id,
                teamId: detail.team_id,
                title: detail.title,
                eventType: detail.event_type,
                trainingTypeId: Option.getOrNull(detail.training_type_id),
                trainingTypeName: Option.getOrNull(detail.training_type_name),
                description: Option.getOrNull(detail.description),
                startAt: detail.start_at,
                endAt: Option.getOrNull(detail.end_at),
                location: Option.getOrNull(detail.location),
                status: detail.status,
                createdByName: Option.getOrNull(detail.created_by_name),
                canEdit: canEdit && detail.status === 'active',
                canCancel: canCancel && detail.status === 'active',
                seriesId: Option.getOrNull(detail.series_id),
                seriesModified: detail.series_modified,
                discordChannelId: Option.getOrNull(detail.discord_target_channel_id),
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
              syncEvents
                .emitEventCancelled(
                  teamId,
                  existing.id,
                  existing.title,
                  Option.getOrNull(existing.description),
                  existing.start_at,
                  Option.getOrNull(existing.end_at),
                  Option.getOrNull(existing.location),
                  existing.event_type,
                )
                .pipe(Effect.catchAll(() => Effect.void)),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
