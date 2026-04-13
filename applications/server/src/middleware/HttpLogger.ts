import { Metrics } from '@sideline/effect-lib';
import { Clock, Effect, Metric, pipe } from 'effect';
import { HttpMiddleware, HttpServerError, HttpServerRequest } from 'effect/unstable/http';

const statusClass = (status: number): string => `${Math.floor(status / 100)}xx`;

/** Strip query string from URL to avoid leaking sensitive params in spans/logs. */
const sanitizeUrl = (url: string): string => url.split('?')[0];

const recordHttpMetrics = (method: string, status: number, durationMs: number) =>
  Effect.all(
    [
      Metric.update(
        pipe(
          Metrics.httpRequestsTotal,
          Metric.tagged('method', method),
          Metric.tagged('status_class', statusClass(status)),
        ),
        1,
      ),
      Metric.update(pipe(Metrics.httpRequestDuration, Metric.tagged('method', method)), durationMs),
    ],
    { discard: true },
  );

/**
 * Custom HTTP logger middleware that records request metrics, logs responses,
 * and wraps each request in an OpenTelemetry span.
 */
export const HttpLogger = HttpMiddleware.make((httpApp) =>
  Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
    Effect.Do.pipe(
      Effect.bind('startMs', () => Clock.currentTimeMillis),
      Effect.bind('exit', () => Effect.exit(httpApp)),
      Effect.bind('endMs', () => Clock.currentTimeMillis),
      Effect.tap(({ startMs, endMs, exit }) => {
        const durationMs = endMs - startMs;

        if (exit._tag === 'Failure') {
          const [response, cause] = HttpServerError.causeResponseStripped(exit.cause);

          return Effect.all(
            [
              recordHttpMetrics(request.method, response.status, durationMs),
              Effect.annotateLogs(
                cause._tag === 'Some'
                  ? Effect.logError(cause.value)
                  : Effect.logError('Sent HTTP response'),
                {
                  'http.method': request.method,
                  'http.url': sanitizeUrl(request.url),
                  'http.status': response.status,
                },
              ),
            ],
            { discard: true },
          );
        }

        const log = exit.value.status >= 400 ? Effect.logWarning : Effect.logInfo;

        return Effect.all(
          [
            recordHttpMetrics(request.method, exit.value.status, durationMs),
            Effect.annotateLogs(log('Sent HTTP response'), {
              'http.method': request.method,
              'http.url': sanitizeUrl(request.url),
              'http.status': exit.value.status,
            }),
          ],
          { discard: true },
        );
      }),
      Effect.flatMap(({ exit }) => exit),
      Effect.withSpan('http.request', {
        attributes: { 'http.method': request.method, 'http.url': sanitizeUrl(request.url) },
      }),
    ),
  ),
);
