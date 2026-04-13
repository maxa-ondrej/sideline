import { ChannelSyncEvent, Discord, Event, GroupModel, Team } from '@sideline/domain';
import { Schemas } from '@sideline/effect-lib';
import { Effect, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';
import { DEFAULT_CHANNEL_FORMAT, DEFAULT_ROLE_FORMAT } from '~/utils/applyDiscordFormat.js';

class TeamSettingsRow extends Schema.Class<TeamSettingsRow>('TeamSettingsRow')({
  team_id: Team.TeamId,
  event_horizon_days: Schema.Number,
  min_players_threshold: Schema.Number,
  rsvp_reminder_hours: Schema.Number,
  discord_channel_training: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_match: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_tournament: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_meeting: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_social: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_other: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_late_rsvp: Schema.OptionFromNullOr(Discord.Snowflake),
  create_discord_channel_on_group: Schema.Boolean,
  create_discord_channel_on_roster: Schema.Boolean,
  discord_archive_category_id: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_cleanup_on_group_delete: ChannelSyncEvent.ChannelCleanupMode,
  discord_channel_cleanup_on_roster_deactivate: ChannelSyncEvent.ChannelCleanupMode,
  discord_role_format: Schema.String,
  discord_channel_format: Schema.String,
}) {}

class TeamSettingsUpsertInput extends Schema.Class<TeamSettingsUpsertInput>(
  'TeamSettingsUpsertInput',
)({
  team_id: Schema.String,
  event_horizon_days: Schema.Number,
  min_players_threshold: Schema.Number,
  rsvp_reminder_hours: Schema.Number,
  discord_channel_training: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_match: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_tournament: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_meeting: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_social: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_other: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_late_rsvp: Schema.OptionFromNullOr(Discord.Snowflake),
  create_discord_channel_on_group: Schema.Boolean,
  create_discord_channel_on_roster: Schema.Boolean,
  discord_archive_category_id: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_cleanup_on_group_delete: ChannelSyncEvent.ChannelCleanupMode,
  discord_channel_cleanup_on_roster_deactivate: ChannelSyncEvent.ChannelCleanupMode,
  discord_role_format: Schema.String,
  discord_channel_format: Schema.String,
}) {}

class EventNeedingReminder extends Schema.Class<EventNeedingReminder>('EventNeedingReminder')({
  event_id: Event.EventId,
  team_id: Team.TeamId,
  title: Schema.String,
  start_at: Schemas.DateTimeFromDate,
  event_type: Schema.String,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  owner_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
}) {}

export class TeamSettingsRepository extends Effect.Service<TeamSettingsRepository>()(
  'api/TeamSettingsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private _findByTeam = SqlSchema.findOne({
    Request: Schema.String,
    Result: TeamSettingsRow,
    execute: (teamId) => this.sql`
      SELECT team_id, event_horizon_days,
             min_players_threshold, rsvp_reminder_hours,
             discord_channel_training, discord_channel_match,
             discord_channel_tournament, discord_channel_meeting,
             discord_channel_social, discord_channel_other,
             discord_channel_late_rsvp,
             create_discord_channel_on_group, create_discord_channel_on_roster,
             discord_archive_category_id,
             discord_channel_cleanup_on_group_delete,
             discord_channel_cleanup_on_roster_deactivate,
             discord_role_format,
             discord_channel_format
      FROM team_settings
      WHERE team_id = ${teamId}
    `,
  });

  private _upsertSettings = SqlSchema.single({
    Request: TeamSettingsUpsertInput,
    Result: TeamSettingsRow,
    execute: (input) => this.sql`
      INSERT INTO team_settings (team_id, event_horizon_days,
                                 min_players_threshold, rsvp_reminder_hours,
                                 discord_channel_training, discord_channel_match,
                                 discord_channel_tournament, discord_channel_meeting,
                                 discord_channel_social, discord_channel_other,
                                 discord_channel_late_rsvp,
                                 create_discord_channel_on_group, create_discord_channel_on_roster,
                                 discord_archive_category_id,
                                 discord_channel_cleanup_on_group_delete,
                                 discord_channel_cleanup_on_roster_deactivate,
                                 discord_role_format,
                                 discord_channel_format)
      VALUES (${input.team_id}, ${input.event_horizon_days},
              ${input.min_players_threshold}, ${input.rsvp_reminder_hours},
              ${input.discord_channel_training}, ${input.discord_channel_match},
              ${input.discord_channel_tournament}, ${input.discord_channel_meeting},
              ${input.discord_channel_social}, ${input.discord_channel_other},
              ${input.discord_channel_late_rsvp},
              ${input.create_discord_channel_on_group}, ${input.create_discord_channel_on_roster},
              ${input.discord_archive_category_id},
              ${input.discord_channel_cleanup_on_group_delete},
              ${input.discord_channel_cleanup_on_roster_deactivate},
              ${input.discord_role_format},
              ${input.discord_channel_format})
      ON CONFLICT (team_id) DO UPDATE SET
        event_horizon_days = ${input.event_horizon_days},
        min_players_threshold = ${input.min_players_threshold},
        rsvp_reminder_hours = ${input.rsvp_reminder_hours},
        discord_channel_training = ${input.discord_channel_training},
        discord_channel_match = ${input.discord_channel_match},
        discord_channel_tournament = ${input.discord_channel_tournament},
        discord_channel_meeting = ${input.discord_channel_meeting},
        discord_channel_social = ${input.discord_channel_social},
        discord_channel_other = ${input.discord_channel_other},
        discord_channel_late_rsvp = ${input.discord_channel_late_rsvp},
        create_discord_channel_on_group = ${input.create_discord_channel_on_group},
        create_discord_channel_on_roster = ${input.create_discord_channel_on_roster},
        discord_archive_category_id = ${input.discord_archive_category_id},
        discord_channel_cleanup_on_group_delete = ${input.discord_channel_cleanup_on_group_delete},
        discord_channel_cleanup_on_roster_deactivate = ${input.discord_channel_cleanup_on_roster_deactivate},
        discord_role_format = ${input.discord_role_format},
        discord_channel_format = ${input.discord_channel_format},
        updated_at = now()
      RETURNING team_id, event_horizon_days,
                min_players_threshold, rsvp_reminder_hours,
                discord_channel_training, discord_channel_match,
                discord_channel_tournament, discord_channel_meeting,
                discord_channel_social, discord_channel_other,
                discord_channel_late_rsvp,
                create_discord_channel_on_group, create_discord_channel_on_roster,
                discord_archive_category_id,
                discord_channel_cleanup_on_group_delete,
                discord_channel_cleanup_on_roster_deactivate,
                discord_role_format,
                discord_channel_format
    `,
  });

  private _getHorizon = SqlSchema.single({
    Request: Schema.String,
    Result: Schema.Struct({ event_horizon_days: Schema.Number }),
    execute: (teamId) => this.sql`
      SELECT COALESCE(ts.event_horizon_days, 30) AS event_horizon_days
      FROM (SELECT ${teamId}::uuid AS id) t
      LEFT JOIN team_settings ts ON ts.team_id = t.id
    `,
  });

  private _findEventsForReminder = SqlSchema.findAll({
    Request: Schema.Void,
    Result: EventNeedingReminder,
    execute: () => this.sql`
      SELECT e.id AS event_id, e.team_id, e.title, e.start_at, e.event_type,
             e.discord_target_channel_id, e.owner_group_id
      FROM events e
      JOIN team_settings ts ON ts.team_id = e.team_id
      WHERE e.status = 'active'
        AND e.reminder_sent_at IS NULL
        AND ts.rsvp_reminder_hours > 0
        AND e.start_at > NOW()
        AND e.start_at <= NOW() + (ts.rsvp_reminder_hours || ' hours')::interval
    `,
  });

  findByTeamId = (teamId: Team.TeamId) => this._findByTeam(teamId).pipe(catchSqlErrors);

  upsert = ({
    teamId,
    eventHorizonDays,
    minPlayersThreshold,
    rsvpReminderHours,
    discordChannelTraining = Option.none(),
    discordChannelMatch = Option.none(),
    discordChannelTournament = Option.none(),
    discordChannelMeeting = Option.none(),
    discordChannelSocial = Option.none(),
    discordChannelOther = Option.none(),
    discordChannelLateRsvp = Option.none(),
    createDiscordChannelOnGroup = true,
    createDiscordChannelOnRoster = true,
    discordArchiveCategoryId = Option.none(),
    discordChannelCleanupOnGroupDelete = 'delete' as ChannelSyncEvent.ChannelCleanupMode,
    discordChannelCleanupOnRosterDeactivate = 'delete' as ChannelSyncEvent.ChannelCleanupMode,
    discordRoleFormat = DEFAULT_ROLE_FORMAT,
    discordChannelFormat = DEFAULT_CHANNEL_FORMAT,
  }: {
    teamId: Team.TeamId;
    eventHorizonDays: number;
    minPlayersThreshold: number;
    rsvpReminderHours: number;
    discordChannelTraining?: Option.Option<Discord.Snowflake>;
    discordChannelMatch?: Option.Option<Discord.Snowflake>;
    discordChannelTournament?: Option.Option<Discord.Snowflake>;
    discordChannelMeeting?: Option.Option<Discord.Snowflake>;
    discordChannelSocial?: Option.Option<Discord.Snowflake>;
    discordChannelOther?: Option.Option<Discord.Snowflake>;
    discordChannelLateRsvp?: Option.Option<Discord.Snowflake>;
    createDiscordChannelOnGroup?: boolean;
    createDiscordChannelOnRoster?: boolean;
    discordArchiveCategoryId?: Option.Option<Discord.Snowflake>;
    discordChannelCleanupOnGroupDelete?: ChannelSyncEvent.ChannelCleanupMode;
    discordChannelCleanupOnRosterDeactivate?: ChannelSyncEvent.ChannelCleanupMode;
    discordRoleFormat?: string;
    discordChannelFormat?: string;
  }) =>
    this._upsertSettings({
      team_id: teamId,
      event_horizon_days: eventHorizonDays,
      min_players_threshold: minPlayersThreshold,
      rsvp_reminder_hours: rsvpReminderHours,
      discord_channel_training: discordChannelTraining,
      discord_channel_match: discordChannelMatch,
      discord_channel_tournament: discordChannelTournament,
      discord_channel_meeting: discordChannelMeeting,
      discord_channel_social: discordChannelSocial,
      discord_channel_other: discordChannelOther,
      discord_channel_late_rsvp: discordChannelLateRsvp,
      create_discord_channel_on_group: createDiscordChannelOnGroup,
      create_discord_channel_on_roster: createDiscordChannelOnRoster,
      discord_archive_category_id: discordArchiveCategoryId,
      discord_channel_cleanup_on_group_delete: discordChannelCleanupOnGroupDelete,
      discord_channel_cleanup_on_roster_deactivate: discordChannelCleanupOnRosterDeactivate,
      discord_role_format: discordRoleFormat,
      discord_channel_format: discordChannelFormat,
    }).pipe(catchSqlErrors);

  getHorizonDays = (teamId: Team.TeamId) =>
    this._getHorizon(teamId).pipe(
      Effect.map((r) => r.event_horizon_days),
      catchSqlErrors,
    );

  findLateRsvpChannelId = (teamId: Team.TeamId) =>
    this.findByTeamId(teamId).pipe(
      Effect.map(Option.flatMap((s) => s.discord_channel_late_rsvp)),
      catchSqlErrors,
    );

  findEventsNeedingReminder = () =>
    this._findEventsForReminder(undefined as undefined).pipe(catchSqlErrors);
}
