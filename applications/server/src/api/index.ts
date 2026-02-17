import { HttpApiBuilder } from '@effect/platform';
import { Layer } from 'effect';
import { AuthApiLive } from './auth.js';
import { Api, HealthApiLive } from './health.js';
import { InviteApiLive } from './invite.js';

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(HealthApiLive),
  Layer.provide(AuthApiLive),
  Layer.provide(InviteApiLive),
);

export { LogicError, Redirect, RuntimeError } from './errors.js';
