import { Effect } from 'effect';
import { client } from '~/lib/client';

export {
  clearPendingInvite,
  finishLogin,
  getLastTeamId,
  getPendingInvite,
  getToken,
  logout,
  setLastTeamId,
  setPendingInvite,
} from '~/lib/token';

export const getLogin = () => client.pipe(Effect.flatMap((c) => c.auth.getLogin()));
