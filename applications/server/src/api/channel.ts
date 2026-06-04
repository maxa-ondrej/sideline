import {
  Auth,
  ChannelApi,
  type Discord,
  type GroupModel,
  type TeamChannel,
  type TeamChannelAccess,
} from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Array, Effect, Option } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { SqlClient } from 'effect/unstable/sql';
import { Api } from '~/api/api.js';
import { hasPermission, requireMembership, requirePermission } from '~/api/permissions.js';
import { BotGuildsRepository } from '~/repositories/BotGuildsRepository.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';
import { TeamChannelAccessRepository } from '~/repositories/TeamChannelAccessRepository.js';
import { TeamChannelsRepository } from '~/repositories/TeamChannelsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { buildManagedAccessGrantEntries } from '~/utils/managedAccessEntries.js';

const forbidden = new ChannelApi.ChannelForbidden();

const toChannelDetail = (
  row: {
    readonly id: TeamChannel.TeamChannelId;
    readonly name: string;
    readonly category: Option.Option<string>;
    readonly position: number;
    readonly archived: boolean;
    readonly discord_channel_id: Option.Option<string>;
  },
  accessCount: number,
  grants: ReadonlyArray<{
    group_id: GroupModel.GroupId;
    access_level: TeamChannelAccess.AccessLevel;
  }>,
): ChannelApi.ChannelDetail =>
  new ChannelApi.ChannelDetail({
    channelId: row.id,
    name: row.name,
    category: row.category,
    position: row.position,
    archived: row.archived,
    discordChannelId: row.discord_channel_id,
    accessCount,
    grants: grants.map(
      (g) =>
        new ChannelApi.ChannelAccessGrant({
          groupId: g.group_id,
          accessLevel: g.access_level,
        }),
    ),
  });

export const ChannelApiLive = HttpApiBuilder.group(Api, 'channel', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository.asEffect()),
    Effect.bind('channels', () => TeamChannelsRepository.asEffect()),
    Effect.bind('channelAccess', () => TeamChannelAccessRepository.asEffect()),
    Effect.bind('channelSync', () => ChannelSyncEventsRepository.asEffect()),
    Effect.bind('teams', () => TeamsRepository.asEffect()),
    Effect.bind('teamSettings', () => TeamSettingsRepository.asEffect()),
    Effect.bind('botGuilds', () => BotGuildsRepository.asEffect()),
    Effect.map(
      ({ members, channels, channelAccess, channelSync, teams, teamSettings, botGuilds }) =>
        handlers
          .handle('listChannels', ({ params: { teamId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.let('canManage', ({ membership }) =>
                hasPermission(membership, 'group:manage'),
              ),
              Effect.bind('team', () =>
                teams.findById(teamId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(forbidden),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.bind('guildLinked', ({ team }) => botGuilds.exists(team.guild_id)),
              Effect.bind('channelList', () => channels.findAllByTeam(teamId)),
              Effect.bind('channelInfos', ({ channelList }) =>
                Effect.forEach(
                  channelList,
                  (ch) =>
                    channelAccess.countByChannel(ch.id).pipe(
                      Effect.map(
                        (accessCount) =>
                          new ChannelApi.ChannelInfo({
                            channelId: ch.id,
                            name: ch.name,
                            category: ch.category,
                            position: ch.position,
                            archived: ch.archived,
                            discordChannelId: ch.discord_channel_id,
                            accessCount,
                          }),
                      ),
                    ),
                  { concurrency: 'unbounded' },
                ),
              ),
              Effect.map(
                ({ canManage, guildLinked, channelInfos }) =>
                  new ChannelApi.ChannelListResponse({
                    canManage,
                    guildLinked,
                    channels: channelInfos,
                  }),
              ),
            ),
          )
          .handle('createChannel', ({ params: { teamId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('channel', () => channels.insert(teamId, payload.name, payload.category)),
              Effect.tap(({ channel }) =>
                channelSync.emitManagedChannelCreated({
                  teamId,
                  teamChannelId: channel.id,
                  discordChannelName: channel.name,
                }),
              ),
              Effect.map(({ channel }) => toChannelDetail(channel, 0, [])),
              Effect.catchTag('ChannelNameAlreadyTakenError', () =>
                Effect.fail(new ChannelApi.ChannelNameAlreadyTaken()),
              ),
            ),
          )
          .handle('getChannel', ({ params: { teamId, channelId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('channel', () =>
                channels.findById(channelId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new ChannelApi.ChannelNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(({ channel }) =>
                channel.team_id !== teamId
                  ? Effect.fail(new ChannelApi.ChannelNotFound())
                  : Effect.void,
              ),
              Effect.bind('grants', ({ channel }) => channelAccess.findByChannel(channel.id)),
              Effect.map(({ channel, grants }) => toChannelDetail(channel, grants.length, grants)),
            ),
          )
          .handle('renameChannel', ({ params: { teamId, channelId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('existing', () =>
                channels.findById(channelId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new ChannelApi.ChannelNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(({ existing }) =>
                existing.team_id !== teamId
                  ? Effect.fail(new ChannelApi.ChannelNotFound())
                  : Effect.void,
              ),
              Effect.bind('updated', () => channels.rename(channelId, payload.name)),
              Effect.bind('grants', () => channelAccess.findByChannel(channelId)),
              // Rename updates the read model only. No Discord sync event is emitted in v1
              // because the bot handler for managed channel rename is out of scope. When the bot
              // gains support for renaming managed channels a 'channel_updated' managed event
              // should be added here. channelUpdatedFromSql has a 'managed' guard that marks
              // such a row as a permanently-failed impossible state — consistent with not emitting.
              Effect.map(({ updated, grants }) => toChannelDetail(updated, grants.length, grants)),
              Effect.catchTag('ChannelNameAlreadyTakenError', () =>
                Effect.fail(new ChannelApi.ChannelNameAlreadyTaken()),
              ),
              Effect.catchTag(
                'NoSuchElementError',
                LogicError.withMessage(() => `Channel ${channelId} not found when renaming`),
              ),
            ),
          )
          .handle('updateOrganization', ({ params: { teamId, channelId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('existing', () =>
                channels.findById(channelId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new ChannelApi.ChannelNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(({ existing }) =>
                existing.team_id !== teamId
                  ? Effect.fail(new ChannelApi.ChannelNotFound())
                  : Effect.void,
              ),
              Effect.bind('updated', () =>
                channels.updateOrganization(channelId, payload.category, payload.position),
              ),
              Effect.bind('grants', () => channelAccess.findByChannel(channelId)),
              // updateOrganization only updates the Sideline read model (category/position).
              // No Discord sync is needed — Discord channel ordering is managed by Sideline only.
              Effect.map(({ updated, grants }) => toChannelDetail(updated, grants.length, grants)),
              Effect.catchTag(
                'NoSuchElementError',
                LogicError.withMessage(
                  () => `Channel ${channelId} not found when updating organization`,
                ),
              ),
            ),
          )
          .handle('archiveChannel', ({ params: { teamId, channelId } }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('channel', () =>
                channels.findById(channelId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new ChannelApi.ChannelNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(({ channel }) =>
                channel.team_id !== teamId
                  ? Effect.fail(new ChannelApi.ChannelNotFound())
                  : Effect.void,
              ),
              Effect.bind('settings', () => teamSettings.findByTeamId(teamId)),
              Effect.tap(({ channel, settings }) => {
                const archiveCategoryId = Option.flatMap(
                  settings,
                  (s) => s.discord_archive_category_id,
                );
                return SqlClient.SqlClient.asEffect().pipe(
                  Effect.flatMap((sql) =>
                    sql
                      .withTransaction(
                        channels.setArchived(channelId, true).pipe(
                          Effect.flatMap(() =>
                            Option.isSome(archiveCategoryId)
                              ? channels.clearDiscordChannelId(channelId).pipe(
                                  Effect.flatMap(() =>
                                    channelSync.emitManagedChannelArchived({
                                      teamId,
                                      teamChannelId: channelId,
                                      discordChannelId: channel.discord_channel_id,
                                      archiveCategoryId: archiveCategoryId.value,
                                    }),
                                  ),
                                )
                              : Effect.void,
                          ),
                        ),
                      )
                      .pipe(catchSqlErrors),
                  ),
                );
              }),
              Effect.asVoid,
            ),
          )
          .handle('setAccess', ({ params: { teamId, channelId }, payload }) =>
            Effect.Do.pipe(
              Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
              Effect.bind('membership', ({ currentUser }) =>
                requireMembership(members, teamId, currentUser.id, forbidden),
              ),
              Effect.tap(({ membership }) =>
                requirePermission(membership, 'group:manage', forbidden),
              ),
              Effect.bind('channel', () =>
                channels.findById(channelId).pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () => Effect.fail(new ChannelApi.ChannelNotFound()),
                      onSome: Effect.succeed,
                    }),
                  ),
                ),
              ),
              Effect.tap(({ channel }) =>
                channel.team_id !== teamId
                  ? Effect.fail(new ChannelApi.ChannelNotFound())
                  : Effect.void,
              ),
              Effect.bind('sql', () => SqlClient.SqlClient.asEffect()),
              Effect.flatMap(({ channel, sql }) =>
                sql
                  .withTransaction(
                    Effect.Do.pipe(
                      Effect.bind('current', () => channelAccess.findByChannelForUpdate(channelId)),
                      Effect.let(
                        'requested',
                        () =>
                          new Map(payload.grants.map((g) => [g.groupId, g.accessLevel] as const)),
                      ),
                      Effect.let(
                        'currentMap',
                        ({ current }) =>
                          new Map(current.map((g) => [g.group_id, g.access_level] as const)),
                      ),
                      // Compute grants to apply (added or level-changed)
                      Effect.let('toGrant', ({ requested, currentMap }) =>
                        Array.fromIterable(requested.entries()).filter(
                          ([gid, level]) => currentMap.get(gid) !== level,
                        ),
                      ),
                      // Compute grants to revoke (present in current but not in requested)
                      Effect.let('toRevoke', ({ requested, currentMap }) =>
                        Array.fromIterable(currentMap.keys()).filter((gid) => !requested.has(gid)),
                      ),
                      // Apply upserts
                      Effect.tap(({ toGrant }) =>
                        Effect.forEach(
                          toGrant,
                          ([groupId, level]) =>
                            channelAccess.upsertGrant(channelId, groupId, level),
                          { concurrency: 'unbounded' },
                        ),
                      ),
                      // Apply deletes
                      Effect.tap(({ toRevoke }) =>
                        Effect.forEach(
                          toRevoke,
                          (groupId) => channelAccess.deleteGrant(channelId, groupId),
                          { concurrency: 'unbounded' },
                        ),
                      ),
                      // Resolve role IDs for all affected groups
                      Effect.bind('allAffectedGroupIds', ({ toGrant, toRevoke }) =>
                        Effect.succeed([...toGrant.map(([gid]) => gid), ...toRevoke]),
                      ),
                      Effect.bind('roleMap', ({ allAffectedGroupIds }) =>
                        allAffectedGroupIds.length === 0
                          ? Effect.succeed(new Map<GroupModel.GroupId, Discord.Snowflake | null>())
                          : channelAccess
                              .findGroupRoleIds(allAffectedGroupIds)
                              .pipe(
                                Effect.map(
                                  (rows) =>
                                    new Map(
                                      rows.map((r) => [
                                        r.group_id,
                                        Option.getOrNull(r.discord_role_id),
                                      ]),
                                    ),
                                ),
                              ),
                      ),
                      // Emit access granted batch
                      Effect.tap(({ toGrant, roleMap }) => {
                        const discordChannelId = Option.getOrNull(channel.discord_channel_id);
                        if (discordChannelId === null) return Effect.void;
                        const { entries, unresolvableGroupIds } = buildManagedAccessGrantEntries(
                          toGrant.map(([groupId, accessLevel]) => ({ groupId, accessLevel })),
                          roleMap,
                          { teamChannelId: channelId, discordChannelId },
                        );
                        return Effect.forEach(unresolvableGroupIds, (gid) =>
                          Effect.logWarning(
                            `setAccess: skipping grant for group ${gid} on channel ${channelId} — no discord_role_id resolved`,
                          ),
                        ).pipe(
                          Effect.flatMap(() =>
                            channelSync.emitManagedAccessGrantedBatch({ teamId, entries }),
                          ),
                        );
                      }),
                      // Emit access revoked batch
                      Effect.tap(({ toRevoke, roleMap }) => {
                        const discordChannelId = Option.getOrNull(channel.discord_channel_id);
                        if (discordChannelId === null) return Effect.void;
                        const unresolvable = toRevoke.filter(
                          (gid) => (roleMap.get(gid) ?? null) === null,
                        );
                        const entries = toRevoke.flatMap((groupId) => {
                          const discordRoleId = roleMap.get(groupId);
                          if (discordRoleId == null) return [];
                          return [{ discordChannelId, discordRoleId }];
                        });
                        return Effect.forEach(unresolvable, (gid) =>
                          Effect.logWarning(
                            `setAccess: skipping revoke for group ${gid} on channel ${channelId} — no discord_role_id resolved`,
                          ),
                        ).pipe(
                          Effect.flatMap(() =>
                            channelSync.emitManagedAccessRevokedBatch({ teamId, entries }),
                          ),
                        );
                      }),
                      // Return updated channel detail
                      Effect.bind('updatedGrants', () => channelAccess.findByChannel(channelId)),
                      Effect.map(({ updatedGrants }) =>
                        toChannelDetail(channel, updatedGrants.length, updatedGrants),
                      ),
                    ),
                  )
                  .pipe(catchSqlErrors),
              ),
            ),
          ),
    ),
  ),
);
