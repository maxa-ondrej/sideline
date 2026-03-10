import { HttpApiBuilder } from '@effect/platform';
import {
  Auth,
  EventApi,
  EventSeriesApi,
  type TeamMember,
  type TrainingType,
} from '@sideline/domain';
import { Array, DateTime, Effect, Option, pipe } from 'effect';
import { Api } from '~/api/api.js';
import { hasPermission, requireMembership, requirePermission } from '~/api/permissions.js';
import { EventSeriesRepository } from '~/repositories/EventSeriesRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { resolveChannel } from '~/services/EventChannelResolver.js';
import { computeHorizonEnd, generateOccurrenceDates } from '~/services/RecurrenceService.js';

const forbidden = new EventApi.Forbidden();
const notFound = new EventSeriesApi.EventSeriesNotFound();
const cancelled = new EventSeriesApi.EventSeriesCancelled();

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

export const EventSeriesApiLive = HttpApiBuilder.group(Api, 'eventSeries', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('events', () => EventsRepository),
    Effect.bind('series', () => EventSeriesRepository),
    Effect.bind('teamSettings', () => TeamSettingsRepository),
    Effect.bind('syncEvents', () => EventSyncEventsRepository),
    Effect.map(({ members, events, series, teamSettings, syncEvents }) =>
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
              series.insertEventSeries({
                teamId,
                trainingTypeId: payload.trainingTypeId,
                title: payload.title,
                description: payload.description,
                frequency: payload.frequency,
                daysOfWeek: payload.daysOfWeek,
                startDate: payload.startDate,
                endDate: payload.endDate,
                startTime: payload.startTime,
                endTime: payload.endTime,
                location: payload.location,
                createdBy: membership.id,
                discordTargetChannelId: payload.discordChannelId,
              }),
            ),
            Effect.bind('horizonDays', () => teamSettings.getHorizonDays(teamId)),
            Effect.let('effectiveEnd', ({ inserted, horizonDays }) =>
              computeHorizonEnd({
                seriesEndDate: Option.getOrNull(inserted.end_date),
                horizonDays,
              }),
            ),
            Effect.let('dates', ({ inserted, effectiveEnd }) =>
              generateOccurrenceDates({
                frequency: inserted.frequency,
                daysOfWeek: inserted.days_of_week,
                startDate: inserted.start_date,
                endDate: effectiveEnd,
              }),
            ),
            Effect.tap(({ inserted, dates, membership }) =>
              Effect.all(
                Array.map(dates, (date) => {
                  const dateStr = DateTime.formatIsoDateUtc(date);
                  const startAt = DateTime.unsafeMake(`${dateStr}T${inserted.start_time}Z`);
                  const endAt = Option.map(inserted.end_time, (t) =>
                    DateTime.unsafeMake(`${dateStr}T${t}Z`),
                  );
                  return events
                    .insertEvent({
                      teamId,
                      trainingTypeId: inserted.training_type_id,
                      eventType: 'training',
                      title: inserted.title,
                      description: inserted.description,
                      startAt,
                      endAt,
                      location: inserted.location,
                      createdBy: membership.id,
                      seriesId: Option.some(inserted.id),
                      discordTargetChannelId: inserted.discord_target_channel_id,
                    })
                    .pipe(
                      Effect.tap((event) =>
                        resolveChannel(teamId, event.id).pipe(
                          Effect.flatMap((resolved) =>
                            syncEvents.emitEventCreated(
                              teamId,
                              event.id,
                              event.title,
                              event.description,
                              event.start_at,
                              event.end_at,
                              event.location,
                              event.event_type,
                              resolved,
                            ),
                          ),
                        ),
                      ),
                    );
                }),
                { concurrency: 1 },
              ),
            ),
            Effect.tap(({ inserted, effectiveEnd }) =>
              series.updateLastGeneratedDate(inserted.id, effectiveEnd),
            ),
            Effect.map(
              ({ inserted }) =>
                new EventSeriesApi.EventSeriesInfo({
                  seriesId: inserted.id,
                  teamId: inserted.team_id,
                  title: inserted.title,
                  frequency: inserted.frequency,
                  daysOfWeek: inserted.days_of_week,
                  startDate: inserted.start_date,
                  endDate: inserted.end_date,
                  status: inserted.status,
                  trainingTypeId: inserted.training_type_id,
                  trainingTypeName: Option.none(),
                  startTime: inserted.start_time,
                  endTime: inserted.end_time,
                  location: inserted.location,
                  discordChannelId: inserted.discord_target_channel_id,
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('listEventSeries', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.tap(({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.bind('list', () => series.findSeriesByTeamId(teamId)),
            Effect.map(({ list }) =>
              Array.map(
                list,
                (s) =>
                  new EventSeriesApi.EventSeriesInfo({
                    seriesId: s.id,
                    teamId: s.team_id,
                    title: s.title,
                    frequency: s.frequency,
                    daysOfWeek: s.days_of_week,
                    startDate: s.start_date,
                    endDate: s.end_date,
                    status: s.status,
                    trainingTypeId: s.training_type_id,
                    trainingTypeName: s.training_type_name,
                    startTime: s.start_time,
                    endTime: s.end_time,
                    location: s.location,
                    discordChannelId: s.discord_target_channel_id,
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
                  daysOfWeek: found.days_of_week,
                  startDate: found.start_date,
                  endDate: found.end_date,
                  status: found.status,
                  trainingTypeId: found.training_type_id,
                  trainingTypeName: found.training_type_name,
                  startTime: found.start_time,
                  endTime: found.end_time,
                  location: found.location,
                  discordChannelId: found.discord_target_channel_id,
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
            Effect.let('resolved', ({ existing }) => ({
              title: Option.getOrElse(payload.title, () => existing.title),
              trainingTypeId: Option.match(payload.trainingTypeId, {
                onNone: () => existing.training_type_id,
                onSome: (v) => v,
              }),
              description: Option.match(payload.description, {
                onNone: () => existing.description,
                onSome: (v) => v,
              }),
              daysOfWeek: Option.getOrElse(payload.daysOfWeek, () => existing.days_of_week),
              startTime: Option.getOrElse(payload.startTime, () => existing.start_time),
              endTime: Option.match(payload.endTime, {
                onNone: () => existing.end_time,
                onSome: (v) => v,
              }),
              location: Option.match(payload.location, {
                onNone: () => existing.location,
                onSome: (v) => v,
              }),
              endDate: Option.match(payload.endDate, {
                onNone: () => existing.end_date,
                onSome: (v) => v,
              }),
              discordTargetChannelId: Option.match(payload.discordChannelId, {
                onNone: () => existing.discord_target_channel_id,
                onSome: (v) => v,
              }),
            })),
            Effect.tap(({ resolved }) =>
              series.updateEventSeries({
                id: seriesId,
                title: resolved.title,
                trainingTypeId: resolved.trainingTypeId,
                description: resolved.description,
                daysOfWeek: resolved.daysOfWeek,
                startTime: resolved.startTime,
                endTime: resolved.endTime,
                location: resolved.location,
                endDate: resolved.endDate,
                discordTargetChannelId: resolved.discordTargetChannelId,
              }),
            ),
            Effect.tap(({ resolved }) =>
              events.updateFutureUnmodifiedInSeries(seriesId, new Date(), {
                title: resolved.title,
                trainingTypeId: resolved.trainingTypeId,
                description: resolved.description,
                startTime: resolved.startTime,
                endTime: resolved.endTime,
                location: resolved.location,
              }),
            ),
            Effect.tap(({ existing, resolved, membership }) =>
              teamSettings.getHorizonDays(teamId).pipe(
                Effect.flatMap((horizonDays) => {
                  const effectiveEnd = computeHorizonEnd({
                    seriesEndDate: Option.getOrNull(resolved.endDate),
                    horizonDays,
                  });
                  return Option.match(existing.last_generated_date, {
                    onNone: () => Effect.void,
                    onSome: (lastGen) => {
                      if (!DateTime.greaterThan(effectiveEnd, lastGen)) return Effect.void;
                      const nextDay = DateTime.add(lastGen, { days: 1 });
                      const newDates = generateOccurrenceDates({
                        frequency: existing.frequency,
                        daysOfWeek: existing.days_of_week,
                        startDate: nextDay,
                        endDate: effectiveEnd,
                      });
                      if (newDates.length === 0) return Effect.void;
                      return Effect.all(
                        Array.map(newDates, (date) => {
                          const dateStr = DateTime.formatIsoDateUtc(date);
                          const startAt = DateTime.unsafeMake(`${dateStr}T${existing.start_time}Z`);
                          const endAt = Option.map(existing.end_time, (t) =>
                            DateTime.unsafeMake(`${dateStr}T${t}Z`),
                          );
                          return events.insertEvent({
                            teamId,
                            trainingTypeId: existing.training_type_id,
                            eventType: 'training',
                            title: existing.title,
                            description: existing.description,
                            startAt,
                            endAt,
                            location: existing.location,
                            createdBy: membership.id,
                            seriesId: Option.some(existing.id),
                          });
                        }),
                        { concurrency: 1 },
                      ).pipe(
                        Effect.tap(() => series.updateLastGeneratedDate(existing.id, effectiveEnd)),
                      );
                    },
                  });
                }),
              ),
            ),
            Effect.bind('detail', () =>
              series.findSeriesById(seriesId).pipe(
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
                daysOfWeek: detail.days_of_week,
                startDate: detail.start_date,
                endDate: detail.end_date,
                status: detail.status,
                trainingTypeId: detail.training_type_id,
                trainingTypeName: detail.training_type_name,
                startTime: detail.start_time,
                endTime: detail.end_time,
                location: detail.location,
                discordChannelId: detail.discord_target_channel_id,
                canEdit: canEdit && detail.status === 'active',
                canCancel: canCancel && detail.status === 'active',
              });
            }),
            Effect.catchTag('NoSuchElementException', Effect.die),
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
            Effect.tap(() => series.cancelEventSeries(seriesId)),
            Effect.tap(() => events.cancelFutureInSeries(seriesId, new Date())),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
