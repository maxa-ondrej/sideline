import type { ChannelRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Exit, Option } from 'effect';
import { isPermanentError } from '~/rcp/channel/ProcessorService.js';
import { createDiscordChannelAndRole } from '~/rest/channels/createChannelWithRole.js';
import { createRoleForChannel } from '~/rest/channels/createRoleForChannel.js';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc, type SyncRpcClient } from '~/services/SyncRpc.js';

export const handleRosterChannelCreated = (event: ChannelRpcEvents.RosterChannelCreatedEvent) => {
  const roleColor = Option.getOrUndefined(event.discord_role_color);

  // Create the channel + role (or just the role when an existing channel is supplied), persist the
  // mapping, and link the new channel back onto the roster. Used both when no mapping exists yet and
  // when a mapping exists without any channel — the two cases are identical.
  const provisionChannelAndRole = (rpc: SyncRpcClient) =>
    Effect.Do.pipe(
      Effect.bind('result', () =>
        Option.match(event.existing_channel_id, {
          onNone: () =>
            createDiscordChannelAndRole(
              event.guild_id,
              event.discord_channel_name,
              event.discord_role_name,
              roleColor,
              Option.getOrUndefined(event.target_category_id),
            ),
          onSome: (channelId) =>
            createRoleForChannel(event.guild_id, channelId, event.discord_role_name, roleColor),
        }),
      ),
      Effect.tap(({ result }) =>
        rpc['Channel/UpsertRosterMapping']({
          team_id: event.team_id,
          roster_id: event.roster_id,
          discord_channel_id: result.discord_channel_id,
          discord_role_id: result.discord_role_id,
        }),
      ),
      Effect.tap(({ result }) =>
        rpc['Channel/UpdateRosterChannel']({
          roster_id: event.roster_id,
          discord_channel_id: Option.some(result.discord_channel_id),
        }),
      ),
      Effect.map(({ result }) => result.discord_role_id),
    );

  return Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.bind('existingMapping', ({ rpc }) =>
      rpc['Channel/GetRosterMapping']({ team_id: event.team_id, roster_id: event.roster_id }),
    ),
    Effect.bind('roleId', ({ rpc, existingMapping }) =>
      Option.match(existingMapping, {
        // Mapping exists — check if role already exists
        onSome: (mapping) =>
          Option.match(mapping.discord_role_id, {
            // Role already exists → reuse it, skip all creation and mapping writes
            onSome: (existingRoleId) => Effect.succeed(existingRoleId),
            // Mapping exists but no role → create role using the channel from the mapping
            onNone: () =>
              Option.match(mapping.discord_channel_id, {
                onSome: (channelId) =>
                  Effect.Do.pipe(
                    Effect.bind('result', () =>
                      createRoleForChannel(
                        event.guild_id,
                        channelId,
                        event.discord_role_name,
                        roleColor,
                      ),
                    ),
                    Effect.tap(({ result }) =>
                      rpc['Channel/UpsertRosterMapping']({
                        team_id: event.team_id,
                        roster_id: event.roster_id,
                        discord_channel_id: result.discord_channel_id,
                        discord_role_id: result.discord_role_id,
                      }),
                    ),
                    // UpdateRosterChannel NOT called — channel already exists in mapping
                    Effect.map(({ result }) => result.discord_role_id),
                  ),
                // No channel in mapping either — create both channel and role
                onNone: () => provisionChannelAndRole(rpc),
              }),
          }),
        // No mapping → create channel+role (or just role if existing_channel_id), upsert mapping
        onNone: () => provisionChannelAndRole(rpc),
      }),
    ),
    Effect.bind('members', ({ rpc }) =>
      rpc['Channel/GetRosterMembers']({ team_id: event.team_id, roster_id: event.roster_id }),
    ),
    Effect.tap(({ rest, roleId, members }) =>
      Effect.forEach(
        members,
        (member) =>
          rest.addGuildMemberRole(event.guild_id, member.discord_user_id, roleId).pipe(
            Effect.retry({ schedule: retryPolicy, while: (e) => !isPermanentError(e) }),
            Effect.exit,
            Effect.flatMap((exit) =>
              Exit.match(exit, {
                onSuccess: () => Effect.void,
                onFailure: (cause) =>
                  Effect.logWarning(
                    `Failed to add role ${roleId} to member ${member.team_member_id} (discord user ${member.discord_user_id}): ${String(cause)}`,
                  ),
              }),
            ),
          ),
        { concurrency: 1 },
      ),
    ),
    Effect.tap(({ roleId }) =>
      Effect.logInfo(
        `Synced roster_channel_created: roster ${event.roster_id} → role ${roleId} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );
};
