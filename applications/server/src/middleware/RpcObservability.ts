import { Effect, Layer, Metric, MetricBoundaries, pipe } from 'effect';
import { RpcMiddleware } from 'effect/unstable/rpc';

const rpcRequestsTotal = Metric.counter('rpc_requests_total', {
  description: 'Total RPC requests handled',
  incremental: true,
});

const rpcRequestDuration = Metric.histogram(
  'rpc_request_duration_ms',
  MetricBoundaries.exponential({ start: 1, factor: 2, count: 12 }),
);

export class RpcObservability extends RpcMiddleware.Tag<RpcObservability>()('RpcObservability', {
  wrap: true,
}) {}

export const RpcObservabilityLive = Layer.succeed(
  RpcObservability,
  RpcObservability.of(({ rpc, next }) => {
    const tag = rpc._tag as string;
    const start = Date.now();

    return next.pipe(
      Effect.tap(() => {
        const durationMs = Date.now() - start;
        return Effect.all([
          Effect.logDebug(`RPC ${tag} completed in ${durationMs}ms`),
          Metric.update(
            pipe(rpcRequestsTotal, Metric.tagged('rpc', tag), Metric.tagged('result', 'success')),
            1,
          ),
          Metric.update(pipe(rpcRequestDuration, Metric.tagged('rpc', tag)), durationMs),
        ]);
      }),
      Effect.tapError((error) => {
        const durationMs = Date.now() - start;
        return Effect.all([
          Effect.logWarning(`RPC ${tag} failed in ${durationMs}ms`, error),
          Metric.update(
            pipe(rpcRequestsTotal, Metric.tagged('rpc', tag), Metric.tagged('result', 'failure')),
            1,
          ),
          Metric.update(pipe(rpcRequestDuration, Metric.tagged('rpc', tag)), durationMs),
        ]);
      }),
    );
  }),
);
