import type { Discord as DiscordSchemas } from '@sideline/domain';
import { Array as Arr, Effect, Option } from 'effect';
import { createPersonalEventChannel } from '~/rest/channels/createPersonalEventChannel.js';
import { POLL_BATCH_SIZE } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';

/**
 * Idempotent provisioner: for each guild, find members without a personal
 * channel and create one for them.
 *
 * Algorithm per member:
 *   1. GetPersonalChannelTargetCategory → resolves base or overflow category
 *   2. ReservePersonalChannel (INSERT ON CONFLICT DO NOTHING) → if reserved=true, proceed
 *   3. createPersonalEventChannel (Discord API call)
 *      - On permanent category-full error: AllocatePersonalOverflowCategory + retry once
 *   4. SavePersonalChannelId
 *
 * Serialized per guild (concurrency 1) to avoid Discord rate limits.
 */
export const provisionPersonalChannels = (guildId: DiscordSchemas.Snowflake) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    // Fetch members who still need a channel
    Effect.bind('members', ({ rpc }) =>
      rpc['Guild/GetMembersNeedingPersonalChannel']({
        guild_id: guildId,
        limit: POLL_BATCH_SIZE,
      }),
    ),
    Effect.tap(({ members }) =>
      members.length > 0
        ? Effect.logDebug(
            `Guild ${guildId}: ${members.length} member(s) need a personal events channel`,
          )
        : Effect.void,
    ),
    Effect.flatMap(({ rpc, members }) =>
      Effect.all(
        Arr.map(members, (member) =>
          Effect.Do.pipe(
            // Resolve which category (base or overflow) to use for this team
            Effect.bind('target', () =>
              rpc['Guild/GetPersonalChannelTargetCategory']({ team_id: member.team_id }),
            ),
            Effect.flatMap(({ target }) =>
              Option.match(target.category_id, {
                onNone: () =>
                  Effect.logDebug(
                    `No personal events category configured for team ${member.team_id}, skipping`,
                  ),
                onSome: (categoryId) =>
                  Effect.Do.pipe(
                    // Reserve a row first (idempotent)
                    Effect.bind('reservation', () =>
                      rpc['Guild/ReservePersonalChannel']({
                        team_id: member.team_id,
                        team_member_id: member.team_member_id,
                      }),
                    ),
                    Effect.flatMap(({ reservation }) => {
                      if (!reservation.reserved) {
                        // Another bot replica or previous run already reserved
                        return Effect.void;
                      }

                      const channelName = `events-${member.discord_id}`;

                      const createAndSave = (catId: DiscordSchemas.Snowflake) =>
                        createPersonalEventChannel(
                          guildId,
                          member.discord_id,
                          catId,
                          channelName,
                        ).pipe(
                          Effect.flatMap(({ discord_channel_id }) =>
                            rpc['Guild/SavePersonalChannelId']({
                              team_id: member.team_id,
                              team_member_id: member.team_member_id,
                              discord_channel_id,
                            }),
                          ),
                        );

                      // Try with the resolved category; on permanent 403 (category full),
                      // allocate/save an overflow category and retry once.
                      return createAndSave(categoryId).pipe(
                        Effect.catchTag('ErrorResponse', (e) => {
                          const status =
                            e.response !== undefined && e.response !== null
                              ? (e.response as { status?: number }).status
                              : undefined;
                          if (status !== 403) {
                            return Effect.fail(e);
                          }
                          // 403 may mean category is full — allocate overflow and retry
                          return rpc['Guild/AllocatePersonalOverflowCategory']({
                            team_id: member.team_id,
                          }).pipe(
                            Effect.flatMap(({ sequence }) =>
                              // The new overflow category must be created via Discord API first.
                              // Since createGuildChannel for a category is handled at a higher level,
                              // just re-resolve the target category which should now reflect the new overflow.
                              rpc['Guild/GetPersonalChannelTargetCategory']({
                                team_id: member.team_id,
                              }).pipe(
                                Effect.flatMap(({ category_id }) =>
                                  Option.match(category_id, {
                                    onNone: () =>
                                      Effect.logWarning(
                                        `No overflow category available for team ${member.team_id} after allocation (sequence ${sequence})`,
                                      ),
                                    onSome: (overflowCatId) => createAndSave(overflowCatId),
                                  }),
                                ),
                              ),
                            ),
                          );
                        }),
                        Effect.tapError((e) =>
                          Effect.logWarning(
                            `Failed to provision personal channel for member ${member.team_member_id} in guild ${guildId}`,
                            e,
                          ),
                        ),
                        Effect.catch(() => Effect.void),
                      );
                    }),
                    Effect.catchTag('RpcClientError', (e) =>
                      Effect.logWarning(
                        `RPC error provisioning personal channel for member ${member.team_member_id}`,
                        e,
                      ),
                    ),
                  ),
              }),
            ),
          ),
        ),
        { concurrency: 1 },
      ),
    ),
    Effect.asVoid,
  );
