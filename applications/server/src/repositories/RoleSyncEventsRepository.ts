import { Discord, Role, RoleSyncEvent, Team, TeamMember } from '@sideline/domain';
import { Effect, Layer, Option, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: RoleSyncEvent.RoleSyncEventType,
  role_id: Role.RoleId,
  role_name: Schema.OptionFromNullOr(Schema.String),
  team_member_id: Schema.OptionFromNullOr(TeamMember.TeamMemberId),
  discord_user_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class GuildLookupResult extends Schema.Class<GuildLookupResult>('GuildLookupResult')({
  guild_id: Discord.Snowflake,
}) {}

export class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: RoleSyncEvent.RoleSyncEventId,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: RoleSyncEvent.RoleSyncEventType,
  role_id: Role.RoleId,
  role_name: Schema.OptionFromNullOr(Schema.String),
  team_member_id: Schema.OptionFromNullOr(TeamMember.TeamMemberId),
  discord_user_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class MarkProcessedInput extends Schema.Class<MarkProcessedInput>('MarkProcessedInput')({
  id: RoleSyncEvent.RoleSyncEventId,
}) {}

class MarkFailedInput extends Schema.Class<MarkFailedInput>('MarkFailedInput')({
  id: RoleSyncEvent.RoleSyncEventId,
  error: Schema.String,
}) {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const insertEvent = SqlSchema.void({
    Request: InsertInput,
    execute: (input) => sql`
      INSERT INTO role_sync_events (team_id, guild_id, event_type, role_id, role_name, team_member_id, discord_user_id)
      VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.role_id}, ${input.role_name}, ${input.team_member_id}, ${input.discord_user_id})
    `,
  });

  const lookupGuildId = SqlSchema.findOne({
    Request: Schema.String,
    Result: GuildLookupResult,
    execute: (teamId) => sql`SELECT guild_id FROM teams WHERE id = ${teamId}`,
  });

  const findUnprocessedEvents = SqlSchema.findAll({
    Request: Schema.Number,
    Result: EventRow,
    execute: (limit) => sql`
      SELECT id, team_id, guild_id, event_type, role_id, role_name, team_member_id, discord_user_id
      FROM role_sync_events
      WHERE processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
    `,
  });

  const markEventProcessed = SqlSchema.void({
    Request: MarkProcessedInput,
    execute: (input) => sql`
      UPDATE role_sync_events SET processed_at = now() WHERE id = ${input.id}
    `,
  });

  const markEventFailed = SqlSchema.void({
    Request: MarkFailedInput,
    execute: (input) => sql`
      UPDATE role_sync_events SET processed_at = now(), error = ${input.error} WHERE id = ${input.id}
    `,
  });

  const _emitIfGuildLinked = (
    teamId: Team.TeamId,
    eventType: RoleSyncEvent.RoleSyncEventType,
    roleId: Role.RoleId,
    roleName: string,
    teamMemberId: Option.Option<TeamMember.TeamMemberId> = Option.none(),
    discordUserId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    lookupGuildId(teamId).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: ({ guild_id }) =>
            insertEvent({
              team_id: teamId,
              guild_id,
              event_type: eventType,
              role_id: roleId,
              role_name: Option.some(roleName),
              team_member_id: teamMemberId,
              discord_user_id: discordUserId,
            }),
        }),
      ),
      catchSqlErrors,
    );

  const emitRoleCreated = (teamId: Team.TeamId, roleId: Role.RoleId, roleName: string) =>
    _emitIfGuildLinked(teamId, 'role_created', roleId, roleName);

  const emitRoleDeleted = (teamId: Team.TeamId, roleId: Role.RoleId, roleName: string) =>
    _emitIfGuildLinked(teamId, 'role_deleted', roleId, roleName);

  const emitRoleAssigned = (
    teamId: Team.TeamId,
    roleId: Role.RoleId,
    roleName: string,
    teamMemberId: TeamMember.TeamMemberId,
    discordUserId: Discord.Snowflake,
  ) =>
    _emitIfGuildLinked(
      teamId,
      'role_assigned',
      roleId,
      roleName,
      Option.some(teamMemberId),
      Option.some(discordUserId),
    );

  const emitRoleUnassigned = (
    teamId: Team.TeamId,
    roleId: Role.RoleId,
    roleName: string,
    teamMemberId: TeamMember.TeamMemberId,
    discordUserId: Discord.Snowflake,
  ) =>
    _emitIfGuildLinked(
      teamId,
      'role_unassigned',
      roleId,
      roleName,
      Option.some(teamMemberId),
      Option.some(discordUserId),
    );

  const findUnprocessed = (limit: number) => findUnprocessedEvents(limit).pipe(catchSqlErrors);

  const markProcessed = (id: RoleSyncEvent.RoleSyncEventId) =>
    markEventProcessed({ id }).pipe(catchSqlErrors);

  const markFailed = (id: RoleSyncEvent.RoleSyncEventId, error: string) =>
    markEventFailed({ id, error }).pipe(catchSqlErrors);

  return {
    emitRoleCreated,
    emitRoleDeleted,
    emitRoleAssigned,
    emitRoleUnassigned,
    findUnprocessed,
    markProcessed,
    markFailed,
  };
});

export class RoleSyncEventsRepository extends ServiceMap.Service<
  RoleSyncEventsRepository,
  Effect.Success<typeof make>
>()('api/RoleSyncEventsRepository') {
  static readonly Default = Layer.effect(RoleSyncEventsRepository, make);
}
