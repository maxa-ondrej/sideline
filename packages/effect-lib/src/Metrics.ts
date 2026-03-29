import { Metric, MetricBoundaries } from 'effect';

/** Total HTTP requests, tagged with { method, status_class } */
export const httpRequestsTotal = Metric.counter('http_requests_total', {
  description: 'Total HTTP requests',
  incremental: true,
});

/** HTTP request latency in milliseconds, tagged with { method } */
export const httpRequestDuration = Metric.histogram(
  'http_request_duration_ms',
  MetricBoundaries.fromIterable([5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]),
  'HTTP request latency in milliseconds',
);
