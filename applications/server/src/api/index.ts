import { HttpApiBuilder } from '@effect/platform';
import { Layer } from 'effect';
import { Api } from './api.js';
import { AuthApiLive } from './auth.js';
import { InviteApiLive } from './invite.js';

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(AuthApiLive),
  Layer.provide(InviteApiLive),
);

export { LogicError, Redirect, RuntimeError } from './errors.js';
