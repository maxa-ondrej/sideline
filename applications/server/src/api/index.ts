import { HttpApiBuilder } from '@effect/platform';
import { Layer } from 'effect';
import { AuthApiLive } from './auth.js';
import { Api, HealthApiLive } from './health.js';

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(HealthApiLive),
  Layer.provide(AuthApiLive),
);

export { LogicError, Redirect, RuntimeError } from './errors.js';
