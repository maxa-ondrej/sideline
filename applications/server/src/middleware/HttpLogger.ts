import { HttpMiddleware, HttpServerError, HttpServerRequest } from '@effect/platform';
import { Effect } from 'effect';
import { env } from '~/env.js';

const rpcUrl = `/${env.RPC_PREFIX}`.replace(/\/+/g, '/');

/**
 * Custom HTTP logger middleware that logs RPC polling requests at DEBUG level
 * to reduce log noise from the bot's 5-second polling interval.
 */
export const HttpLogger = HttpMiddleware.make((httpApp) => {
  let counter = 0;

  return Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
    const isRpc = request.method === 'POST' && request.url === rpcUrl;
    const log = isRpc ? Effect.logDebug : Effect.log;

    return Effect.withLogSpan(
      Effect.flatMap(Effect.exit(httpApp), (exit) => {
        if (exit._tag === 'Failure') {
          const [response, cause] = HttpServerError.causeResponseStripped(exit.cause);

          return Effect.zipRight(
            Effect.annotateLogs(
              cause._tag === 'Some' ? log(cause.value) : log('Sent HTTP response'),
              {
                'http.method': request.method,
                'http.url': request.url,
                'http.status': response.status,
              },
            ),
            exit,
          );
        }

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
