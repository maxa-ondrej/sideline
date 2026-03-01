import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, Role, RoleSyncEvent, Team, TeamMember } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Option, Schema } from 'effect';

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
  guild_id: Schema.OptionFromNullOr(Discord.Snowflake),
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

export class RoleSyncEventsRepository extends Effect.Service<RoleSyncEventsRepository>()(
  'api/RoleSyncEventsRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('insertEvent', ({ sql }) =>
        SqlSchema.void({
          Request: InsertInput,
          execute: (input) => sql`
            INSERT INTO role_sync_events (team_id, guild_id, event_type, role_id, role_name, team_member_id, discord_user_id)
            VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.role_id}, ${input.role_name}, ${input.team_member_id}, ${input.discord_user_id})
          `,
        }),
      ),
      Effect.let('lookupGuildId', ({ sql }) =>
        SqlSchema.findOne({
          Request: Schema.String,
          Result: GuildLookupResult,
          execute: (teamId) => sql`SELECT guild_id FROM teams WHERE id = ${teamId}`,
        }),
      ),
      Effect.let('findUnprocessedEvents', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.Number,
          Result: EventRow,
          execute: (limit) => sql`
            SELECT id, team_id, guild_id, event_type, role_id, role_name, team_member_id, discord_user_id
            FROM role_sync_events
            WHERE processed_at IS NULL
            ORDER BY created_at ASC
            LIMIT ${limit}
          `,
        }),
      ),
      Effect.let('markEventProcessed', ({ sql }) =>
        SqlSchema.void({
          Request: MarkProcessedInput,
          execute: (input) => sql`
            UPDATE role_sync_events SET processed_at = now() WHERE id = ${input.id}
          `,
        }),
      ),
      Effect.let('markEventFailed', ({ sql }) =>
        SqlSchema.void({
          Request: MarkFailedInput,
          execute: (input) => sql`
            UPDATE role_sync_events SET processed_at = now(), error = ${input.error} WHERE id = ${input.id}
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  private _emitIfGuildLinked(
    teamId: Team.TeamId,
    eventType: RoleSyncEvent.RoleSyncEventType,
    roleId: Role.RoleId,
    roleName: string,
    teamMemberId: Option.Option<TeamMember.TeamMemberId> = Option.none(),
    discordUserId: Option.Option<Discord.Snowflake> = Option.none(),
  ) {
    return this.lookupGuildId(teamId).pipe(
      Effect.flatMap(Option.flatMap(({ guild_id }) => guild_id)),
      Effect.flatMap((guild_id) =>
        this.insertEvent({
          team_id: teamId,
          guild_id,
          event_type: eventType,
          role_id: roleId,
          role_name: Option.some(roleName),
          team_member_id: teamMemberId,
          discord_user_id: discordUserId,
        }),
      ),
      Effect.catchTag('NoSuchElementException', () => Effect.void),
    );
  }

  emitRoleCreated(teamId: Team.TeamId, roleId: Role.RoleId, roleName: string) {
    return this._emitIfGuildLinked(teamId, 'role_created', roleId, roleName);
  }

  emitRoleDeleted(teamId: Team.TeamId, roleId: Role.RoleId, roleName: string) {
    return this._emitIfGuildLinked(teamId, 'role_deleted', roleId, roleName);
  }

  emitRoleAssigned(
    teamId: Team.TeamId,
    roleId: Role.RoleId,
    roleName: string,
    teamMemberId: TeamMember.TeamMemberId,
    discordUserId: Discord.Snowflake,
  ) {
    return this._emitIfGuildLinked(
      teamId,
      'role_assigned',
      roleId,
      roleName,
      Option.some(teamMemberId),
      Option.some(discordUserId),
    );
  }

  emitRoleUnassigned(
    teamId: Team.TeamId,
    roleId: Role.RoleId,
    roleName: string,
    teamMemberId: TeamMember.TeamMemberId,
    discordUserId: Discord.Snowflake,
  ) {
    return this._emitIfGuildLinked(
      teamId,
      'role_unassigned',
      roleId,
      roleName,
      Option.some(teamMemberId),
      Option.some(discordUserId),
    );
  }

  findUnprocessed(limit: number) {
    return this.findUnprocessedEvents(limit);
  }

  markProcessed(id: RoleSyncEvent.RoleSyncEventId) {
    return this.markEventProcessed({ id });
  }

  markFailed(id: RoleSyncEvent.RoleSyncEventId, error: string) {
    return this.markEventFailed({ id, error });
  }
}
