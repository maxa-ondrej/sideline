import { Effect, Schedule } from 'effect';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';

const cronEffect = Effect.Do.pipe(
  Effect.bind('thresholds', () => AgeThresholdRepository),
  Effect.bind('ageCheck', () => AgeCheckService),
  Effect.tap(() => Effect.logInfo('AgeCheckCron: starting evaluation cycle')),
  Effect.bind('teamIds', ({ thresholds }) => thresholds.getAllTeamsWithRules()),
  Effect.tap(({ teamIds, ageCheck }) => {
    const today = new Date();
    return Effect.all(
      teamIds.map((teamId) =>
        ageCheck
          .evaluate(teamId as Parameters<typeof ageCheck.evaluate>[0], today)
          .pipe(
            Effect.tap((changes) =>
              changes.length > 0
                ? Effect.logInfo(
                    `AgeCheckCron: team ${teamId} — ${String(changes.length)} role changes applied`,
                  )
                : Effect.void,
            ),
          ),
      ),
    );
  }),
  Effect.tap(() => Effect.logInfo('AgeCheckCron: evaluation cycle complete')),
  Effect.asVoid,
);

const cronSchedule = Schedule.cron('0 2 * * *');

export const AgeCheckCron = cronEffect.pipe(Effect.repeat(cronSchedule), Effect.asVoid);
