import { Effect, Option } from 'effect';
import { API_URL } from './client';
import { ApiClient } from './runtime';

export const getLogin = () => `${API_URL}/auth/login` as const;

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

export const getCurrentUser = ApiClient.pipe(
  Effect.flatMap((api) => api.auth.me()),
  Effect.catchTag('Unauthorized', () => Effect.succeed(null)),
  Effect.tap((user) => Effect.logInfo('Logged in as', user)),
);
