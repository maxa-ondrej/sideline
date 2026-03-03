import { HttpApiBuilder } from '@effect/platform';
import {
  Auth,
  EventApi,
  EventSeriesApi,
  type TeamMember,
  type TrainingType,
} from '@sideline/domain';
import { DateTime, Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { hasPermission, requireMembership, requirePermission } from '~/api/permissions.js';
import { EventSeriesRepository } from '~/repositories/EventSeriesRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { generateOccurrenceDates } from '~/services/RecurrenceService.js';

const forbidden = new EventApi.Forbidden();
const notFound = new EventSeriesApi.EventSeriesNotFound();
const cancelled = new EventSeriesApi.EventSeriesCancelled();

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

const todayStr = () => DateTime.formatIsoDateUtc(DateTime.unsafeNow());

export const EventSeriesApiLive = HttpApiBuilder.group(Api, 'eventSeries', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('events', () => EventsRepository),
    Effect.bind('series', () => EventSeriesRepository),
    Effect.map(({ members, events, series }) =>
      handlers
        .handle('createEventSeries', ({ path: { teamId }, payload }) =>
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
            Effect.bind('inserted', ({ membership }) =>
              series
                .insertEventSeries({
                  teamId,
                  trainingTypeId: payload.trainingTypeId,
                  title: payload.title,
                  description: payload.description,
                  frequency: payload.frequency,
                  dayOfWeek: payload.dayOfWeek,
                  startDate: payload.startDate,
                  endDate: payload.endDate,
                  startTime: payload.startTime,
                  endTime: payload.endTime,
                  location: payload.location,
                  createdBy: membership.id,
                })
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.let('dates', ({ inserted }) =>
              generateOccurrenceDates({
                frequency: inserted.frequency,
                dayOfWeek: inserted.day_of_week,
                startDate: DateTime.unsafeMake(inserted.start_date),
                endDate: DateTime.unsafeMake(inserted.end_date),
              }),
            ),
            Effect.tap(({ inserted, dates, membership }) =>
              Effect.all(
                dates.map((date) => {
                  const dateStr = DateTime.formatIsoDateUtc(date);
                  return events
                    .insertEvent({
                      teamId,
                      trainingTypeId: inserted.training_type_id,
                      eventType: 'training',
                      title: inserted.title,
                      description: inserted.description,
                      eventDate: dateStr,
                      startTime: inserted.start_time,
                      endTime: inserted.end_time,
                      location: inserted.location,
                      createdBy: membership.id,
                      seriesId: inserted.id,
                    })
                    .pipe(Effect.mapError(() => forbidden));
                }),
                { concurrency: 1 },
              ),
            ),
            Effect.map(
              ({ inserted }) =>
                new EventSeriesApi.EventSeriesInfo({
                  seriesId: inserted.id,
                  teamId: inserted.team_id,
                  title: inserted.title,
                  frequency: inserted.frequency,
                  dayOfWeek: inserted.day_of_week,
                  startDate: inserted.start_date,
                  endDate: inserted.end_date,
                  status: inserted.status,
                  trainingTypeId: inserted.training_type_id,
                  trainingTypeName: null,
                  startTime: inserted.start_time,
                  endTime: inserted.end_time,
                  location: inserted.location,
                }),
            ),
          ),
        )
        .handle('listEventSeries', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.tap(({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.bind('list', () =>
              series.findSeriesByTeamId(teamId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(({ list }) =>
              list.map(
                (s) =>
                  new EventSeriesApi.EventSeriesInfo({
                    seriesId: s.id,
                    teamId: s.team_id,
                    title: s.title,
                    frequency: s.frequency,
                    dayOfWeek: s.day_of_week,
                    startDate: s.start_date,
                    endDate: s.end_date,
                    status: s.status,
                    trainingTypeId: s.training_type_id,
                    trainingTypeName: s.training_type_name,
                    startTime: s.start_time,
                    endTime: s.end_time,
                    location: s.location,
                  }),
              ),
            ),
          ),
        )
        .handle('getEventSeries', ({ path: { teamId, seriesId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.let('canEdit', ({ membership }) => hasPermission(membership, 'event:edit')),
            Effect.let('canCancel', ({ membership }) => hasPermission(membership, 'event:cancel')),
            Effect.bind('found', () =>
              series.findSeriesById(seriesId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(notFound),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ found }) =>
              found.team_id !== teamId ? Effect.fail(notFound) : Effect.void,
            ),
            Effect.map(
              ({ found, canEdit, canCancel }) =>
                new EventSeriesApi.EventSeriesDetail({
                  seriesId: found.id,
                  teamId: found.team_id,
                  title: found.title,
                  description: found.description,
                  frequency: found.frequency,
                  dayOfWeek: found.day_of_week,
                  startDate: found.start_date,
                  endDate: found.end_date,
                  status: found.status,
                  trainingTypeId: found.training_type_id,
                  trainingTypeName: found.training_type_name,
                  startTime: found.start_time,
                  endTime: found.end_time,
                  location: found.location,
                  canEdit: canEdit && found.status === 'active',
                  canCancel: canCancel && found.status === 'active',
                }),
            ),
          ),
        )
        .handle('updateEventSeries', ({ path: { teamId, seriesId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'event:edit', forbidden)),
            Effect.let('isAdmin', ({ membership }) => hasPermission(membership, 'team:manage')),
            Effect.bind('existing', () =>
              series.findSeriesById(seriesId).pipe(
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
            Effect.let('resolvedTitle', ({ existing }) =>
              Option.getOrElse(payload.title, () => existing.title),
            ),
            Effect.let('resolvedTrainingTypeId', ({ existing }) =>
              Option.match(payload.trainingTypeId, {
                onNone: () => existing.training_type_id,
                onSome: Option.getOrNull,
              }),
            ),
            Effect.let('resolvedDescription', ({ existing }) =>
              Option.match(payload.description, {
                onNone: () => existing.description,
                onSome: Option.getOrNull,
              }),
            ),
            Effect.let('resolvedStartTime', ({ existing }) =>
              Option.getOrElse(payload.startTime, () => existing.start_time),
            ),
            Effect.let('resolvedEndTime', ({ existing }) =>
              Option.match(payload.endTime, {
                onNone: () => existing.end_time,
                onSome: Option.getOrNull,
              }),
            ),
            Effect.let('resolvedLocation', ({ existing }) =>
              Option.match(payload.location, {
                onNone: () => existing.location,
                onSome: Option.getOrNull,
              }),
            ),
            Effect.let('resolvedEndDate', ({ existing }) =>
              Option.getOrElse(payload.endDate, () => existing.end_date),
            ),
            Effect.tap(
              ({
                resolvedTitle,
                resolvedTrainingTypeId,
                resolvedDescription,
                resolvedStartTime,
                resolvedEndTime,
                resolvedLocation,
                resolvedEndDate,
              }) =>
                series
                  .updateEventSeries({
                    id: seriesId,
                    title: resolvedTitle,
                    trainingTypeId: resolvedTrainingTypeId,
                    description: resolvedDescription,
                    startTime: resolvedStartTime,
                    endTime: resolvedEndTime,
                    location: resolvedLocation,
                    endDate: resolvedEndDate,
                  })
                  .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(
              ({
                resolvedTitle,
                resolvedTrainingTypeId,
                resolvedDescription,
                resolvedStartTime,
                resolvedEndTime,
                resolvedLocation,
              }) =>
                events
                  .updateFutureUnmodifiedInSeries(seriesId, todayStr(), {
                    title: resolvedTitle,
                    trainingTypeId: resolvedTrainingTypeId,
                    description: resolvedDescription,
                    startTime: resolvedStartTime,
                    endTime: resolvedEndTime,
                    location: resolvedLocation,
                  })
                  .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ existing, resolvedEndDate, membership }) => {
              const oldEnd = DateTime.unsafeMake(existing.end_date);
              const newEnd = DateTime.unsafeMake(resolvedEndDate);
              if (!DateTime.greaterThan(newEnd, oldEnd)) return Effect.void;
              const nextDay = DateTime.add(oldEnd, { days: 1 });
              const newDates = generateOccurrenceDates({
                frequency: existing.frequency,
                dayOfWeek: existing.day_of_week,
                startDate: nextDay,
                endDate: newEnd,
              });
              return Effect.all(
                newDates.map((date) => {
                  const dateStr = DateTime.formatIsoDateUtc(date);
                  return events
                    .insertEvent({
                      teamId,
                      trainingTypeId: existing.training_type_id,
                      eventType: 'training',
                      title: existing.title,
                      description: existing.description,
                      eventDate: dateStr,
                      startTime: existing.start_time,
                      endTime: existing.end_time,
                      location: existing.location,
                      createdBy: membership.id,
                      seriesId: existing.id,
                    })
                    .pipe(Effect.mapError(() => forbidden));
                }),
                { concurrency: 1 },
              );
            }),
            Effect.bind('detail', () =>
              series.findSeriesById(seriesId).pipe(
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
              return new EventSeriesApi.EventSeriesDetail({
                seriesId: detail.id,
                teamId: detail.team_id,
                title: detail.title,
                description: detail.description,
                frequency: detail.frequency,
                dayOfWeek: detail.day_of_week,
                startDate: detail.start_date,
                endDate: detail.end_date,
                status: detail.status,
                trainingTypeId: detail.training_type_id,
                trainingTypeName: detail.training_type_name,
                startTime: detail.start_time,
                endTime: detail.end_time,
                location: detail.location,
                canEdit: canEdit && detail.status === 'active',
                canCancel: canCancel && detail.status === 'active',
              });
            }),
          ),
        )
        .handle('cancelEventSeries', ({ path: { teamId, seriesId } }) =>
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
              series.findSeriesById(seriesId).pipe(
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
            Effect.tap(() =>
              series.cancelEventSeries(seriesId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(() =>
              events
                .cancelFutureInSeries(seriesId, todayStr())
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
