import { HttpApiBuilder } from '@effect/platform';
import { Layer } from 'effect';
import { Api } from '~/api/api.js';
import { AuthApiLive } from '~/api/auth.js';
import { InviteApiLive } from '~/api/invite.js';

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(AuthApiLive),
  Layer.provide(InviteApiLive),
);

export { Redirect } from '~/api/redirect.js';
