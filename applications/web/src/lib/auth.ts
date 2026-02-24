import { Effect, Option } from 'effect';
import { client } from '~/lib/client';
import { ApiClient } from '~/lib/runtime';

export const getLogin = () => client.pipe(Effect.flatMap((c) => c.auth.getLogin()));

const TOKEN = 'api-token';

export const finishLogin = (token: string) => {
  window.localStorage.setItem(TOKEN, token);
};

export const getToken = Effect.sync(() => {
  return Option.fromNullable(window.localStorage.getItem(TOKEN));
});

export const logout = () => {
  window.localStorage.removeItem(TOKEN);
};

const PENDING_INVITE = 'pending-invite';

export const setPendingInvite = (code: string) => {
  window.localStorage.setItem(PENDING_INVITE, code);
};

export const getPendingInvite = (): string | null => {
  return window.localStorage.getItem(PENDING_INVITE);
};

export const clearPendingInvite = () => {
  window.localStorage.removeItem(PENDING_INVITE);
};

export const getCurrentUser = ApiClient.pipe(
  Effect.flatMap((api) => api.auth.me()),
  Effect.map(Option.some),
  Effect.catchTag('Unauthorized', () => Effect.succeed(Option.none())),
  Effect.tap((user) => Effect.logInfo('Logged in as', user)),
);
