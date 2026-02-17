import { HttpApiBuilder } from '@effect/platform';
import { Effect } from 'effect';
import { Api } from './api.js';

export const HealthApiLive = HttpApiBuilder.group(Api, 'health', (handlers) =>
  Effect.succeed(handlers.handle('healthCheck', () => Effect.succeed({ status: 'ok' as const }))),
);
