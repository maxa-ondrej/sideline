import {
  ChannelRpcGroup,
  ChannelRpcModels,
  type ChannelSyncEvent,
  type Discord,
  type GroupModel,
  type Team,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Array, Data, Effect, flow, Option } from 'effect';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { constructEvent, EventPropertyMissing } from './events.js';

class NoChanges extends Data.TaggedError('NoChanges')<{
  count: 0;
}> {
  static make = () => new NoChanges({ count: 0 });
}

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
          Effect.tap(
            flow(
              Array.isEmptyReadonlyArray,
              Effect.if({
                onTrue: NoChanges.make,
                onFalse: () => Effect.void,
              }),
            ),
          ),
          Effect.tap((events) =>
            Effect.logInfo(`Collected ${events.length} channel events from database.`),
          ),
          Effect.flatMap(Effect.allSuccesses),
          Effect.tap((events) =>
            Effect.logInfo(`Successfully mapped ${events.length} channel events from database.`),
          ),
          Effect.catchTag('NoChanges', () => Effect.succeed(Array.empty())),
        ),
  ),
  Effect.let(
    'Channel/MarkEventProcessed',
    ({ syncEvents }) =>
      ({ id }: { readonly id: ChannelSyncEvent.ChannelSyncEventId }) =>
        syncEvents.markProcessed(id),
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
        syncEvents.markFailed(id, error),
  ),
  Effect.let(
    'Channel/GetMapping',
    ({ mappings }) =>
      ({
        team_id,
        group_id,
      }: {
        readonly team_id: Team.TeamId;
        readonly group_id: GroupModel.GroupId;
      }) =>
        mappings.findByGroupId(team_id, group_id).pipe(
          Effect.map(
            Option.map(
              (m) =>
                new ChannelRpcModels.ChannelMapping({
                  id: m.id,
                  team_id: m.team_id,
                  group_id: m.group_id,
                  discord_channel_id: m.discord_channel_id,
                  discord_role_id: m.discord_role_id,
                }),
            ),
          ),
        ),
  ),
  Effect.let(
    'Channel/UpsertMapping',
    ({ mappings }) =>
      ({
        team_id,
        group_id,
        discord_channel_id,
        discord_role_id,
      }: {
        readonly team_id: Team.TeamId;
        readonly group_id: GroupModel.GroupId;
        readonly discord_channel_id: Discord.Snowflake;
        readonly discord_role_id: Discord.Snowflake;
      }) =>
        mappings.insert(team_id, group_id, discord_channel_id, discord_role_id),
  ),
  Effect.let(
    'Channel/DeleteMapping',
    ({ mappings }) =>
      ({
        team_id,
        group_id,
      }: {
        readonly team_id: Team.TeamId;
        readonly group_id: GroupModel.GroupId;
      }) =>
        mappings.deleteByGroupId(team_id, group_id),
  ),
  Bind.remove('syncEvents'),
  Bind.remove('mappings'),
  (handlers) => ChannelRpcGroup.ChannelRpcGroup.toLayer(handlers),
);
