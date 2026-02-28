import {
  ChannelRpcGroup,
  ChannelRpcModels,
  type ChannelSyncEvent,
  type Discord,
  type SubgroupModel,
  type Team,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Array, Effect, flow, Option } from 'effect';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { constructEvent, EventPropertyMissing } from './events.js';

export const ChannelsRpcLive = Effect.Do.pipe(
  Effect.bind('syncEvents', () => ChannelSyncEventsRepository),
  Effect.bind('mappings', () => DiscordChannelMappingRepository),
  Effect.let(
    'Channel/GetUnprocessedEvents',
    ({ syncEvents }) =>
      ({ limit }: { readonly limit: number }) =>
        syncEvents.findUnprocessed(limit).pipe(
          Effect.map(
            Array.map(
              flow(
                constructEvent,
                Effect.tapErrorTag('EventPropertyMissing', EventPropertyMissing.handle),
              ),
            ),
          ),
          Effect.tap((events) =>
            Effect.logInfo(`Collected ${events.length} channel events from database.`),
          ),
          Effect.flatMap(Effect.allSuccesses),
          Effect.tap((events) =>
            Effect.logInfo(`Successfully mapped ${events.length} channel events from database.`),
          ),
          Effect.catchAll((error) =>
            Effect.logError('GetUnprocessedChannelEvents failed', error).pipe(Effect.map(() => [])),
          ),
        ),
  ),
  Effect.let(
    'Channel/MarkEventProcessed',
    ({ syncEvents }) =>
      ({ id }: { readonly id: ChannelSyncEvent.ChannelSyncEventId }) =>
        syncEvents.markProcessed(id).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Channel/MarkEventFailed',
    ({ syncEvents }) =>
      ({
        id,
        error,
      }: {
        readonly id: ChannelSyncEvent.ChannelSyncEventId;
        readonly error: string;
      }) =>
        syncEvents.markFailed(id, error).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Channel/GetMapping',
    ({ mappings }) =>
      ({
        team_id,
        subgroup_id,
      }: {
        readonly team_id: Team.TeamId;
        readonly subgroup_id: SubgroupModel.SubgroupId;
      }) =>
        mappings.findBySubgroupId(team_id, subgroup_id).pipe(
          Effect.map(
            Option.map(
              (m) =>
                new ChannelRpcModels.ChannelMapping({
                  id: m.id,
                  team_id: m.team_id,
                  subgroup_id: m.subgroup_id,
                  discord_channel_id: m.discord_channel_id,
                  discord_role_id: m.discord_role_id,
                }),
            ),
          ),
          Effect.catchAll(() => Effect.succeed(Option.none())),
        ),
  ),
  Effect.let(
    'Channel/UpsertMapping',
    ({ mappings }) =>
      ({
        team_id,
        subgroup_id,
        discord_channel_id,
        discord_role_id,
      }: {
        readonly team_id: Team.TeamId;
        readonly subgroup_id: SubgroupModel.SubgroupId;
        readonly discord_channel_id: Discord.Snowflake;
        readonly discord_role_id: Discord.Snowflake;
      }) =>
        mappings
          .insert(team_id, subgroup_id, discord_channel_id, discord_role_id)
          .pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Channel/DeleteMapping',
    ({ mappings }) =>
      ({
        team_id,
        subgroup_id,
      }: {
        readonly team_id: Team.TeamId;
        readonly subgroup_id: SubgroupModel.SubgroupId;
      }) =>
        mappings.deleteBySubgroupId(team_id, subgroup_id).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Bind.remove('syncEvents'),
  Bind.remove('mappings'),
  ChannelRpcGroup.ChannelRpcGroup.toLayer,
);
