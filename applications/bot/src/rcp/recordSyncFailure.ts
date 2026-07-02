import { Effect, Metric } from 'effect';
import { syncEventsFailedTotal } from '../metrics.js';

/** Wrap an already-issued "mark event failed" RPC effect with the identical
 * log-then-metric tail shared by the ten `syncEventsFailedTotal`-based RCP
 * ProcessorServices after a processing failure: a warning log carrying the raw
 * error, then a bump of the shared `syncEventsFailedTotal` counter tagged by
 * `syncType`. (inviteGenerator/onboarding bump their own domain counters, and
 * personalEvents has no mark-failed tail, so they intentionally do not use this.)
 *
 * Returns the mark-failed effect (order preserved: log first, then metric) so the
 * caller can write `Effect.catch((error) => recordSyncFailure(rpc['X/MarkFailed'](…), …))`.
 * The mark-failed RPC call stays at the call site because its method name, id field,
 * and error-stringification legitimately vary per domain. */
export const recordSyncFailure = <A, E, R>(
  markFailed: Effect.Effect<A, E, R>,
  options: { readonly syncType: string; readonly message: string; readonly error: unknown },
): Effect.Effect<A, E, R> =>
  markFailed.pipe(
    Effect.tap(() => Effect.logWarning(options.message, options.error)),
    Effect.tap(() =>
      Metric.update(
        Metric.withAttributes(syncEventsFailedTotal, { sync_type: options.syncType }),
        1,
      ),
    ),
  );
