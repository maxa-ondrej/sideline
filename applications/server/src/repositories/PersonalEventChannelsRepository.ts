import { Discord, Team, TeamMember } from '@sideline/domain';
import { Effect, Layer, Option, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class PersonalEventChannelRow extends Schema.Class<PersonalEventChannelRow>(
  'PersonalEventChannelRow',
)({
  id: Schema.String,
  team_id: Team.TeamId,
  team_member_id: TeamMember.TeamMemberId,
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class MemberNeedingPersonalChannel extends Schema.Class<MemberNeedingPersonalChannel>(
  'MemberNeedingPersonalChannel',
)({
  team_member_id: TeamMember.TeamMemberId,
  discord_id: Discord.Snowflake,
}) {}

class PersonalChannelForEvent extends Schema.Class<PersonalChannelForEvent>(
  'PersonalChannelForEvent',
)({
  team_member_id: Schema.String,
  discord_id: Discord.Snowflake,
  personal_channel_id: Discord.Snowflake,
}) {}

const make = Effect.Do.pipe(
  Effect.bind('sql', () => SqlClient.SqlClient.asEffect()),
  Effect.map(({ sql }) => {
    const _reserve = SqlSchema.findOneOption({
      Request: Schema.Struct({
        team_id: Schema.String,
        team_member_id: Schema.String,
      }),
      Result: Schema.Struct({ id: Schema.String }),
      execute: (input) => sql`
        INSERT INTO personal_event_channels (team_id, team_member_id)
        VALUES (${input.team_id}, ${input.team_member_id})
        ON CONFLICT (team_id, team_member_id) DO NOTHING
        RETURNING id
      `,
    });

    const _saveChannelId = SqlSchema.void({
      Request: Schema.Struct({
        team_id: Schema.String,
        team_member_id: Schema.String,
        discord_channel_id: Discord.Snowflake,
      }),
      execute: (input) => sql`
        UPDATE personal_event_channels
        SET discord_channel_id = ${input.discord_channel_id}, updated_at = now()
        WHERE team_id = ${input.team_id} AND team_member_id = ${input.team_member_id}
      `,
    });

    const _getChannel = SqlSchema.findOneOption({
      Request: Schema.Struct({
        team_id: Schema.String,
        team_member_id: Schema.String,
      }),
      Result: PersonalEventChannelRow,
      execute: (input) => sql`
        SELECT id, team_id, team_member_id, discord_channel_id
        FROM personal_event_channels
        WHERE team_id = ${input.team_id} AND team_member_id = ${input.team_member_id}
      `,
    });

    const _deleteChannel = SqlSchema.findOneOption({
      Request: Schema.Struct({
        team_id: Schema.String,
        team_member_id: Schema.String,
      }),
      Result: Schema.Struct({
        discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
      }),
      execute: (input) => sql`
        DELETE FROM personal_event_channels
        WHERE team_id = ${input.team_id} AND team_member_id = ${input.team_member_id}
        RETURNING discord_channel_id
      `,
    });

    const _getMembersNeeding = SqlSchema.findAll({
      Request: Schema.Struct({
        team_id: Schema.String,
        limit: Schema.Number,
      }),
      Result: MemberNeedingPersonalChannel,
      execute: (input) => sql`
        SELECT tm.id AS team_member_id, u.discord_id
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        LEFT JOIN personal_event_channels pec ON pec.team_member_id = tm.id AND pec.team_id = tm.team_id
        WHERE tm.team_id = ${input.team_id}
          AND tm.active = true
          AND (pec.id IS NULL OR pec.discord_channel_id IS NULL)
        ORDER BY tm.id
        LIMIT ${input.limit}
      `,
    });

    const _getGuildsNeedingProvisioning = SqlSchema.findAll({
      Request: Schema.Struct({ limit: Schema.Number }),
      Result: Schema.Struct({ guild_id: Discord.Snowflake }),
      execute: (input) => sql`
        SELECT DISTINCT t.guild_id
        FROM teams t
        JOIN team_settings ts ON ts.team_id = t.id
        JOIN team_members tm ON tm.team_id = t.id
        LEFT JOIN personal_event_channels pec ON pec.team_member_id = tm.id AND pec.team_id = tm.team_id
        WHERE ts.discord_personal_events_category_id IS NOT NULL
          AND t.guild_id IS NOT NULL
          AND tm.active = true
          AND (pec.id IS NULL OR pec.discord_channel_id IS NULL)
        LIMIT ${input.limit}
      `,
    });

    const _listForEvent = SqlSchema.findAll({
      Request: Schema.Struct({ event_id: Schema.String }),
      Result: PersonalChannelForEvent,
      execute: (input) => sql`
        SELECT pec.team_member_id, u.discord_id, pec.discord_channel_id AS personal_channel_id
        FROM personal_event_channels pec
        JOIN team_members tm ON tm.id = pec.team_member_id
        JOIN users u ON u.id = tm.user_id
        JOIN events e ON e.team_id = pec.team_id
        WHERE e.id = ${input.event_id}
          AND pec.discord_channel_id IS NOT NULL
      `,
    });

    const reservePersonalChannel = (teamId: Team.TeamId, teamMemberId: TeamMember.TeamMemberId) =>
      _reserve({ team_id: teamId, team_member_id: teamMemberId }).pipe(
        Effect.map(Option.isSome),
        catchSqlErrors,
      );

    const savePersonalChannelId = (
      teamId: Team.TeamId,
      teamMemberId: TeamMember.TeamMemberId,
      discordChannelId: Discord.Snowflake,
    ) =>
      _saveChannelId({
        team_id: teamId,
        team_member_id: teamMemberId,
        discord_channel_id: discordChannelId,
      }).pipe(catchSqlErrors);

    const getPersonalChannel = (teamId: Team.TeamId, teamMemberId: TeamMember.TeamMemberId) =>
      _getChannel({ team_id: teamId, team_member_id: teamMemberId }).pipe(catchSqlErrors);

    const deletePersonalChannel = (teamId: Team.TeamId, teamMemberId: TeamMember.TeamMemberId) =>
      _deleteChannel({ team_id: teamId, team_member_id: teamMemberId }).pipe(
        Effect.map(Option.flatMap((row) => row.discord_channel_id)),
        catchSqlErrors,
      );

    const getMembersNeedingPersonalChannel = (teamId: Team.TeamId, limit: number) =>
      _getMembersNeeding({ team_id: teamId, limit }).pipe(catchSqlErrors);

    const getGuildsNeedingPersonalProvisioning = (limit: number) =>
      _getGuildsNeedingProvisioning({ limit }).pipe(
        Effect.map((rows) => rows.map((r) => r.guild_id)),
        catchSqlErrors,
      );

    const listPersonalChannelsForEvent = (eventId: string) =>
      _listForEvent({ event_id: eventId }).pipe(catchSqlErrors);

    return {
      reservePersonalChannel,
      savePersonalChannelId,
      getPersonalChannel,
      deletePersonalChannel,
      getMembersNeedingPersonalChannel,
      getGuildsNeedingPersonalProvisioning,
      listPersonalChannelsForEvent,
    };
  }),
);

export class PersonalEventChannelsRepository extends ServiceMap.Service<
  PersonalEventChannelsRepository,
  Effect.Success<typeof make>
>()('api/PersonalEventChannelsRepository') {
  static readonly Default = Layer.effect(PersonalEventChannelsRepository, make);
}
