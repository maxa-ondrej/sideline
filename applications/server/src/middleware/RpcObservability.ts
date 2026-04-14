import { Effect, Layer, Metric } from 'effect';
import { RpcMiddleware } from 'effect/unstable/rpc';

const rpcRequestsTotal = Metric.counter('rpc_requests_total', {
  description: 'Total RPC requests handled',
  incremental: true,
});

const rpcRequestDuration = Metric.histogram('rpc_request_duration_ms', {
  boundaries: Metric.exponentialBoundaries({ start: 1, factor: 2, count: 12 }),
});

export class RpcObservability extends RpcMiddleware.Service<RpcObservability>()(
  'RpcObservability',
) {}

export const RpcObservabilityLive = Layer.succeed(RpcObservability, (effect, { rpc }) => {
  const tag = rpc._tag as string;
  const start = Date.now();

  return effect.pipe(
    Effect.tap(() => {
      const durationMs = Date.now() - start;
      return Effect.all([
        Effect.logDebug(`RPC ${tag} completed in ${durationMs}ms`),
        Metric.update(Metric.withAttributes(rpcRequestsTotal, { rpc: tag, result: 'success' }), 1),
        Metric.update(Metric.withAttributes(rpcRequestDuration, { rpc: tag }), durationMs),
      ]);
    }),
    Effect.tapError((error) => {
      const durationMs = Date.now() - start;
      return Effect.all([
        Effect.logWarning(`RPC ${tag} failed in ${durationMs}ms`, error),
        Metric.update(Metric.withAttributes(rpcRequestsTotal, { rpc: tag, result: 'failure' }), 1),
        Metric.update(Metric.withAttributes(rpcRequestDuration, { rpc: tag }), durationMs),
      ]);
    }),
  );
});
