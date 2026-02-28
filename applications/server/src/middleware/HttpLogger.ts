import { HttpMiddleware, HttpServerError, HttpServerRequest } from '@effect/platform';
import { Effect } from 'effect';

/**
 * Custom HTTP logger middleware that logs RPC polling requests at DEBUG level
 * to reduce log noise from the bot's 5-second polling interval.
 */
export const HttpLogger = HttpMiddleware.make((httpApp) => {
  let counter = 0;

  return Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
    return Effect.withLogSpan(
      Effect.flatMap(Effect.exit(httpApp), (exit) => {
        if (exit._tag === 'Failure') {
          const [response, cause] = HttpServerError.causeResponseStripped(exit.cause);

          return Effect.zipRight(
            Effect.annotateLogs(
              cause._tag === 'Some'
                ? Effect.logError(cause.value)
                : Effect.logError('Sent HTTP response'),
              {
                'http.method': request.method,
                'http.url': request.url,
                'http.status': response.status,
              },
            ),
            exit,
          );
        }

        const log = exit.value.status >= 400 ? Effect.logWarning : Effect.logDebug;
        return Effect.zipRight(
          Effect.annotateLogs(log('Sent HTTP response'), {
            'http.method': request.method,
            'http.url': request.url,
            'http.status': exit.value.status,
          }),
          exit,
        );
      }),
      `http.span.${++counter}`,
    );
  });
});
