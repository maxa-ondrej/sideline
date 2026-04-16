import { LogicError } from '@sideline/effect-lib';
import { Array, DateTime, Effect, Option, Schedule } from 'effect';
import { withCronMetrics } from '~/metrics.js';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { ActivityTypesRepository } from '~/repositories/ActivityTypesRepository.js';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';

const isUniqueViolation = (defect: unknown): boolean =>
  defect instanceof Error && /duplicate key|unique constraint/i.test(defect.message);

export const trainingAutoLogCronEffect = Effect.Do.pipe(
  Effect.bind('eventsRepo', () => EventsRepository.asEffect()),
  Effect.bind('rsvpsRepo', () => EventRsvpsRepository.asEffect()),
  Effect.bind('activityLogs', () => ActivityLogsRepository.asEffect()),
  Effect.bind('activityTypes', () => ActivityTypesRepository.asEffect()),
  Effect.tap(() => Effect.logInfo('TrainingAutoLogCron: starting cycle')),
  Effect.bind('trainingTypeId', ({ activityTypes }) =>
    activityTypes.findBySlug('training').pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => LogicError.die('Training activity type not found'),
          onSome: (t) => Effect.succeed(t.id),
        }),
      ),
    ),
  ),
  Effect.bind('events', ({ eventsRepo }) => eventsRepo.findEndedTrainingsForAutoLog()),
  Effect.tap(({ events, rsvpsRepo, activityLogs, eventsRepo, trainingTypeId }) =>
    Effect.all(
      Array.map(events, (event) =>
        Effect.Do.pipe(
          Effect.bind('memberIds', () => rsvpsRepo.findYesRsvpMemberIdsByEventId(event.id)),
          Effect.let('loggedAt', () =>
            DateTime.toDateUtc(Option.getOrElse(event.end_at, () => event.start_at)),
          ),
          Effect.tap(({ memberIds, loggedAt }) =>
            Effect.all(
              Array.map(memberIds, (memberId) =>
                activityLogs
                  .insert({
                    team_member_id: memberId,
                    activity_type_id: trainingTypeId,
                    logged_at: loggedAt,
                    duration_minutes: Option.none(),
                    note: Option.none(),
                    source: 'auto',
                  })
                  .pipe(
                    Effect.asVoid,
                    Effect.catchDefect((defect) =>
                      isUniqueViolation(defect) ? Effect.void : Effect.die(defect),
                    ),
                  ),
              ),
              { concurrency: 1 },
            ),
          ),
          Effect.tap(() => eventsRepo.markTrainingAutoLogged(event.id)),
          Effect.tap(() => Effect.logInfo(`TrainingAutoLogCron: processed event ${event.id}`)),
          Effect.catchDefect((defect) =>
            Effect.logWarning(`TrainingAutoLogCron: defect processing event ${event.id}`, defect),
          ),
        ),
      ),
      { concurrency: 1 },
    ),
  ),
  Effect.tap(({ events }) =>
    Effect.logInfo(
      `TrainingAutoLogCron: cycle complete, ${String(events.length)} event(s) attempted`,
    ),
  ),
  Effect.asVoid,
  withCronMetrics('training-auto-log'),
);

const cronSchedule = Schedule.cron('*/5 * * * *');

export const TrainingAutoLogCron = trainingAutoLogCronEffect.pipe(
  Effect.repeat(cronSchedule),
  Effect.asVoid,
);
