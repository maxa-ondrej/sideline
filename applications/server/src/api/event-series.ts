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
    Effect.mapError(() => forbidden),
    Effect.flatMap((scopedIds) => {
      const allowed: readonly string[] = scopedIds.map((s) => s.training_type_id);
      if (allowed.length === 0) return Effect.void;
      return allowed.includes(trainingTypeId.value) ? Effect.void : Effect.fail(forbidden);
    }),
  );
};

const todayStr = () => DateTime.formatIsoDateUtc(DateTime.unsafeNow());

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
              checkCoachScoping(
                events,
                membership.id,
                Option.fromNullable(payload.trainingTypeId),
                isAdmin,
              ),
            ),
            Effect.bind('inserted', ({ membership }) =>
              series
                .insertEventSeries({
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
                })
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.bind('horizonDays', () =>
              teamSettings.getHorizonDays(teamId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.let('effectiveEnd', ({ inserted, horizonDays }) =>
              computeHorizonEnd({
                seriesEndDate: inserted.end_date,
                horizonDays,
              }),
            ),
            Effect.let('dates', ({ inserted, effectiveEnd }) =>
              generateOccurrenceDates({
                frequency: inserted.frequency,
                daysOfWeek: inserted.days_of_week,
                startDate: DateTime.unsafeMake(inserted.start_date),
                endDate: effectiveEnd,
              }),
            ),
            Effect.tap(({ inserted, dates, membership }) =>
              Effect.all(
                dates.map((date) => {
                  const dateStr = DateTime.formatIsoDateUtc(date);
                  const startAt = `${dateStr}T${inserted.start_time}Z`;
                  const endAt = inserted.end_time ? `${dateStr}T${inserted.end_time}Z` : null;
                  return events
                    .insertEvent({
                      teamId,
                      trainingTypeId: Option.fromNullable(inserted.training_type_id),
                      eventType: 'training',
                      title: inserted.title,
                      description: Option.fromNullable(inserted.description),
                      startAt,
                      endAt: Option.fromNullable(endAt),
                      location: Option.fromNullable(inserted.location),
                      createdBy: membership.id,
                      seriesId: Option.some(inserted.id),
                      discordTargetChannelId: Option.fromNullable(
                        inserted.discord_target_channel_id,
                      ),
                    })
                    .pipe(
                      Effect.tap((event) =>
                        resolveChannel(teamId, event.id).pipe(
                          Effect.catchAll(() => Effect.succeed(null)),
                          Effect.flatMap((resolved) =>
                            syncEvents
                              .emitIfGuildLinked(
                                teamId,
                                'event_created',
                                event.id,
                                event.title,
                                Option.getOrNull(event.description),
                                event.start_at,
                                Option.getOrNull(event.end_at),
                                Option.getOrNull(event.location),
                                event.event_type,
                                resolved,
                              )
                              .pipe(Effect.catchAll(() => Effect.void)),
                          ),
                        ),
                      ),
                      Effect.mapError(() => forbidden),
                    );
                }),
                { concurrency: 1 },
              ),
            ),
            Effect.tap(({ inserted, effectiveEnd }) =>
              series
                .updateLastGeneratedDate(inserted.id, DateTime.formatIsoDateUtc(effectiveEnd))
                .pipe(Effect.mapError(() => forbidden)),
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
                  trainingTypeName: null,
                  startTime: inserted.start_time,
                  endTime: inserted.end_time,
                  location: inserted.location,
                  discordChannelId: inserted.discord_target_channel_id,
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
              return checkCoachScoping(
                events,
                membership.id,
                Option.fromNullable(newTrainingTypeId),
                isAdmin,
              );
            }),
            Effect.let('resolved', ({ existing }) => ({
              title: Option.getOrElse(payload.title, () => existing.title),
              trainingTypeId: Option.match(payload.trainingTypeId, {
                onNone: () => existing.training_type_id,
                onSome: Option.getOrNull,
              }),
              description: Option.match(payload.description, {
                onNone: () => existing.description,
                onSome: Option.getOrNull,
              }),
              daysOfWeek: Option.getOrElse(payload.daysOfWeek, () => existing.days_of_week),
              startTime: Option.getOrElse(payload.startTime, () => existing.start_time),
              endTime: Option.match(payload.endTime, {
                onNone: () => existing.end_time,
                onSome: Option.getOrNull,
              }),
              location: Option.match(payload.location, {
                onNone: () => existing.location,
                onSome: Option.getOrNull,
              }),
              endDate: Option.match(payload.endDate, {
                onNone: () => existing.end_date,
                onSome: Option.getOrNull,
              }),
              discordTargetChannelId: Option.match(payload.discordChannelId, {
                onNone: () => existing.discord_target_channel_id,
                onSome: Option.getOrNull,
              }),
            })),
            Effect.tap(({ resolved }) =>
              series
                .updateEventSeries({
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
                })
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ resolved }) =>
              events
                .updateFutureUnmodifiedInSeries(seriesId, todayStr(), {
                  title: resolved.title,
                  trainingTypeId: Option.fromNullable(resolved.trainingTypeId),
                  description: Option.fromNullable(resolved.description),
                  startTime: resolved.startTime,
                  endTime: Option.fromNullable(resolved.endTime),
                  location: Option.fromNullable(resolved.location),
                })
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.tap(({ existing, resolved, membership }) =>
              teamSettings.getHorizonDays(teamId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap((horizonDays) => {
                  const effectiveEnd = computeHorizonEnd({
                    seriesEndDate: resolved.endDate,
                    horizonDays,
                  });
                  const lastGenStr = existing.last_generated_date;
                  if (lastGenStr === null) return Effect.void;
                  const lastGen = DateTime.unsafeMake(lastGenStr);
                  if (!DateTime.greaterThan(effectiveEnd, lastGen)) return Effect.void;
                  const nextDay = DateTime.add(lastGen, { days: 1 });
                  const newDates = generateOccurrenceDates({
                    frequency: existing.frequency,
                    daysOfWeek: existing.days_of_week,
                    startDate: nextDay,
                    endDate: effectiveEnd,
                  });
                  if (newDates.length === 0) return Effect.void;
                  const lastDate = DateTime.formatIsoDateUtc(effectiveEnd);
                  return Effect.all(
                    newDates.map((date) => {
                      const dateStr = DateTime.formatIsoDateUtc(date);
                      const startAt = `${dateStr}T${existing.start_time}Z`;
                      const endAt = existing.end_time ? `${dateStr}T${existing.end_time}Z` : null;
                      return events
                        .insertEvent({
                          teamId,
                          trainingTypeId: Option.fromNullable(existing.training_type_id),
                          eventType: 'training',
                          title: existing.title,
                          description: Option.fromNullable(existing.description),
                          startAt,
                          endAt: Option.fromNullable(endAt),
                          location: Option.fromNullable(existing.location),
                          createdBy: membership.id,
                          seriesId: Option.some(existing.id),
                        })
                        .pipe(Effect.mapError(() => forbidden));
                    }),
                    { concurrency: 1 },
                  ).pipe(
                    Effect.tap(() =>
                      series
                        .updateLastGeneratedDate(existing.id, lastDate)
                        .pipe(Effect.mapError(() => forbidden)),
                    ),
                  );
                }),
              ),
            ),
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
              checkCoachScoping(
                events,
                membership.id,
                Option.fromNullable(existing.training_type_id),
                isAdmin,
              ),
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
