import { Effect, Metric, pipe } from 'effect';

/** Total cron job executions, tagged with { cron, result } */
export const cronExecutionsTotal = Metric.counter('cron_executions_total', {
  description: 'Total cron job executions',
  incremental: true,
});

/** Total RSVP submissions, tagged with { response } */
export const rsvpSubmissionsTotal = Metric.counter('rsvp_submissions_total', {
  description: 'Total RSVP submissions',
  incremental: true,
});

/**
 * Wraps an effect with cron-standard observability:
 * - Records success/failure metric with { cron, result } tags
 * - Adds a span named `cron/{name}`
 */
export const withCronMetrics =
  (name: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.tap(() =>
        Metric.update(
          pipe(
            cronExecutionsTotal,
            Metric.tagged('cron', name),
            Metric.tagged('result', 'success'),
          ),
          1,
        ),
      ),
      Effect.tapError(() =>
        Metric.update(
          pipe(
            cronExecutionsTotal,
            Metric.tagged('cron', name),
            Metric.tagged('result', 'failure'),
          ),
          1,
        ),
      ),
      Effect.withSpan(`cron/${name}`),
    );
