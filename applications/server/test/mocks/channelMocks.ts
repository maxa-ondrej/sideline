import { Effect, Layer, Option } from 'effect';
import { TeamChannelAccessRepository } from '~/repositories/TeamChannelAccessRepository.js';
import { TeamChannelsRepository } from '~/repositories/TeamChannelsRepository.js';

/**
 * Noop mock for TeamChannelsRepository used in tests that don't exercise
 * the channel management endpoints.
 */
export const MockTeamChannelsRepositoryLayer = Layer.succeed(TeamChannelsRepository, {
  _tag: 'api/TeamChannelsRepository' as const,
  findById: () => Effect.succeed(Option.none()),
  findAllByTeam: () => Effect.succeed([]),
  insert: () => Effect.die(new Error('MockTeamChannelsRepository.insert not implemented')),
  rename: () => Effect.die(new Error('MockTeamChannelsRepository.rename not implemented')),
  updateOrganization: () =>
    Effect.die(new Error('MockTeamChannelsRepository.updateOrganization not implemented')),
  setArchived: () => Effect.void,
  delete: () => Effect.void,
  upsertDiscordChannelId: () => Effect.void,
  clearDiscordChannelId: () => Effect.void,
} as never);

/**
 * Noop mock for TeamChannelAccessRepository used in tests that don't exercise
 * the channel management endpoints.
 */
export const MockTeamChannelAccessRepositoryLayer = Layer.succeed(TeamChannelAccessRepository, {
  _tag: 'api/TeamChannelAccessRepository' as const,
  findByChannel: () => Effect.succeed([]),
  findByChannelForUpdate: () => Effect.succeed([]),
  upsertGrant: () => Effect.void,
  deleteGrant: () => Effect.void,
  countByChannel: () => Effect.succeed(0),
  findGroupRoleIds: () => Effect.succeed([]),
} as never);

export const MockChannelManagementLayers = Layer.merge(
  MockTeamChannelsRepositoryLayer,
  MockTeamChannelAccessRepositoryLayer,
);
