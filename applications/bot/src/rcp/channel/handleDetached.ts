import type { ChannelRpcEvents } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';
import { deleteRole } from './channelUtils.js';

export const handleGroupDetached = (event: ChannelRpcEvents.GroupChannelDetachedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.tap(() => deleteRole(event.guild_id, event.discord_role_id)),
    Effect.tap(({ rpc }) =>
      rpc['Channel/DeleteMapping']({ team_id: event.team_id, group_id: event.group_id }),
    ),
    Effect.asVoid,
  );

export const handleRosterDetached = (event: ChannelRpcEvents.RosterChannelDetachedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.tap(() => deleteRole(event.guild_id, event.discord_role_id)),
    Effect.tap(({ rpc }) =>
      rpc['Channel/DeleteRosterMapping']({ team_id: event.team_id, roster_id: event.roster_id }),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Channel/UpdateRosterChannel']({
        roster_id: event.roster_id,
        discord_channel_id: Option.none(),
      }),
    ),
    Effect.asVoid,
  );
