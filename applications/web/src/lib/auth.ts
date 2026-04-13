import { BrowserKeyValueStore } from '@effect/platform-browser';
import { Effect, Option } from 'effect';
import { KeyValueStore } from 'effect/unstable/persistence';
import { client } from '~/lib/client';

export const getLogin = () => client.pipe(Effect.flatMap((c) => c.auth.getLogin()));

const TOKEN = 'api-token';
const PENDING_INVITE = 'pending-invite';
const LAST_TEAM = 'last-team-id';

const kvLayer = BrowserKeyValueStore.layerLocalStorage;

const get = (key: string) =>
  KeyValueStore.KeyValueStore.pipe(
    Effect.flatMap((store) => store.get(key)),
    Effect.provide(kvLayer),
    Effect.tapError((e) => Effect.logDebug(`Failed to read browser storage key "${key}"`, e)),
    Effect.catchTag('BadArgument', 'SystemError', () => Effect.succeed(Option.none<string>())),
  );

const set = (key: string, value: string) =>
  KeyValueStore.KeyValueStore.pipe(
    Effect.flatMap((store) => store.set(key, value)),
    Effect.provide(kvLayer),
    Effect.tapError((e) => Effect.logWarning(`Failed to set browser storage key "${key}"`, e)),
    Effect.catchTag('BadArgument', 'SystemError', () => Effect.void),
  );

const remove = (key: string) =>
  KeyValueStore.KeyValueStore.pipe(
    Effect.flatMap((store) => store.remove(key)),
    Effect.provide(kvLayer),
    Effect.tapError((e) => Effect.logWarning(`Failed to remove browser storage key "${key}"`, e)),
    Effect.catchTag('BadArgument', 'SystemError', () => Effect.void),
  );

export const finishLogin = (token: string) => set(TOKEN, token);

export const getToken = get(TOKEN);

export const logout = Effect.all([remove(TOKEN), remove(LAST_TEAM)]).pipe(Effect.asVoid);

export const setPendingInvite = (code: string) => set(PENDING_INVITE, code);

export const getPendingInvite = get(PENDING_INVITE);

export const clearPendingInvite = remove(PENDING_INVITE);

export const getLastTeamId = get(LAST_TEAM);

export const setLastTeamId = (teamId: string) => set(LAST_TEAM, teamId);
