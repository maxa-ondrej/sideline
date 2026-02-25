import { Effect, Schedule } from 'effect';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';

const cronEffect = Effect.Do.pipe(
  Effect.bind('thresholds', () => AgeThresholdRepository),
  Effect.bind('ageCheck', () => AgeCheckService),
  Effect.tap(() => Effect.logInfo('AgeCheckCron: starting evaluation cycle')),
  Effect.bind('teamIds', ({ thresholds }) =>
    thresholds.getAllTeamsWithRules().pipe(
      Effect.tapError((e) => Effect.logWarning('AgeCheckCron: failed to load teams', e)),
      Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
    ),
  ),
  Effect.tap(({ teamIds, ageCheck }) => {
    const currentYear = new Date().getFullYear();
    return Effect.all(
      teamIds.map((teamId) =>
        ageCheck.evaluate(teamId as Parameters<typeof ageCheck.evaluate>[0], currentYear).pipe(
          Effect.tap((changes) =>
            changes.length > 0
              ? Effect.logInfo(
                  `AgeCheckCron: team ${teamId} — ${String(changes.length)} role changes applied`,
                )
              : Effect.void,
          ),
          Effect.tapError((e) =>
            Effect.logWarning(`AgeCheckCron: failed evaluation for team ${teamId}`, e),
          ),
          Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<unknown>)),
        ),
      ),
    );
  }),
  Effect.tap(() => Effect.logInfo('AgeCheckCron: evaluation cycle complete')),
  Effect.asVoid,
);

const cronSchedule = Schedule.cron('0 2 * * *');

export const AgeCheckCron = cronEffect.pipe(Effect.repeat(cronSchedule), Effect.asVoid);
