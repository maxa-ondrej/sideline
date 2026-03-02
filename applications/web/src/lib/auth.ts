import { Effect, Option } from 'effect';
import { client } from '~/lib/client';

export const getLogin = () => client.pipe(Effect.flatMap((c) => c.auth.getLogin()));

const TOKEN = 'api-token';
const PENDING_INVITE = 'pending-invite';
const LAST_TEAM = 'last-team-id';

export const finishLogin = (token: string) => {
  window.localStorage.setItem(TOKEN, token);
};

export const getToken = Effect.sync(() => {
  return Option.fromNullable(window.localStorage.getItem(TOKEN));
});

export const logout = () => {
  window.localStorage.removeItem(TOKEN);
  window.localStorage.removeItem(LAST_TEAM);
};

export const setPendingInvite = (code: string) => {
  window.localStorage.setItem(PENDING_INVITE, code);
};

export const getPendingInvite = (): string | null => {
  return window.localStorage.getItem(PENDING_INVITE);
};

export const clearPendingInvite = () => {
  window.localStorage.removeItem(PENDING_INVITE);
};

export const getLastTeamId = (): string | null => {
  return window.localStorage.getItem(LAST_TEAM);
};

export const setLastTeamId = (teamId: string): void => {
  window.localStorage.setItem(LAST_TEAM, teamId);
};
