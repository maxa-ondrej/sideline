import { SqlClient, SqlSchema } from '@effect/sql';
import { Event, Team } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class TeamSettingsRow extends Schema.Class<TeamSettingsRow>('TeamSettingsRow')({
  team_id: Team.TeamId,
  event_horizon_days: Schema.Number,
  min_players_threshold: Schema.Number,
  rsvp_reminder_hours: Schema.Number,
  discord_channel_training: Schema.NullOr(Schema.String),
  discord_channel_match: Schema.NullOr(Schema.String),
  discord_channel_tournament: Schema.NullOr(Schema.String),
  discord_channel_meeting: Schema.NullOr(Schema.String),
  discord_channel_social: Schema.NullOr(Schema.String),
  discord_channel_other: Schema.NullOr(Schema.String),
}) {}

class TeamSettingsUpsertInput extends Schema.Class<TeamSettingsUpsertInput>(
  'TeamSettingsUpsertInput',
)({
  team_id: Schema.String,
  event_horizon_days: Schema.Number,
  min_players_threshold: Schema.Number,
  rsvp_reminder_hours: Schema.Number,
  discord_channel_training: Schema.NullOr(Schema.String),
  discord_channel_match: Schema.NullOr(Schema.String),
  discord_channel_tournament: Schema.NullOr(Schema.String),
  discord_channel_meeting: Schema.NullOr(Schema.String),
  discord_channel_social: Schema.NullOr(Schema.String),
  discord_channel_other: Schema.NullOr(Schema.String),
}) {}

class EventNeedingReminder extends Schema.Class<EventNeedingReminder>('EventNeedingReminder')({
  event_id: Event.EventId,
  team_id: Team.TeamId,
  title: Schema.String,
  start_at: Schema.String,
  event_type: Schema.String,
  discord_target_channel_id: Schema.NullOr(Schema.String),
}) {}

export class TeamSettingsRepository extends Effect.Service<TeamSettingsRepository>()(
  'api/TeamSettingsRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findByTeam', ({ sql }) =>
        SqlSchema.findOne({
          Request: Schema.String,
          Result: TeamSettingsRow,
          execute: (teamId) => sql`
            SELECT team_id, event_horizon_days,
                   min_players_threshold, rsvp_reminder_hours,
                   discord_channel_training, discord_channel_match,
                   discord_channel_tournament, discord_channel_meeting,
                   discord_channel_social, discord_channel_other
            FROM team_settings
            WHERE team_id = ${teamId}
          `,
        }),
      ),
      Effect.let('upsertSettings', ({ sql }) =>
        SqlSchema.single({
          Request: TeamSettingsUpsertInput,
          Result: TeamSettingsRow,
          execute: (input) => sql`
            INSERT INTO team_settings (team_id, event_horizon_days,
                                       min_players_threshold, rsvp_reminder_hours,
                                       discord_channel_training, discord_channel_match,
                                       discord_channel_tournament, discord_channel_meeting,
                                       discord_channel_social, discord_channel_other)
            VALUES (${input.team_id}, ${input.event_horizon_days},
                    ${input.min_players_threshold}, ${input.rsvp_reminder_hours},
                    ${input.discord_channel_training}, ${input.discord_channel_match},
                    ${input.discord_channel_tournament}, ${input.discord_channel_meeting},
                    ${input.discord_channel_social}, ${input.discord_channel_other})
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
              updated_at = now()
            RETURNING team_id, event_horizon_days,
                      min_players_threshold, rsvp_reminder_hours,
                      discord_channel_training, discord_channel_match,
                      discord_channel_tournament, discord_channel_meeting,
                      discord_channel_social, discord_channel_other
          `,
        }),
      ),
      Effect.let('getHorizon', ({ sql }) =>
        SqlSchema.single({
          Request: Schema.String,
          Result: Schema.Struct({ event_horizon_days: Schema.Number }),
          execute: (teamId) => sql`
            SELECT COALESCE(ts.event_horizon_days, 30) AS event_horizon_days
            FROM (SELECT ${teamId}::uuid AS id) t
            LEFT JOIN team_settings ts ON ts.team_id = t.id
          `,
        }),
      ),
      Effect.let('findEventsForReminder', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.Void,
          Result: EventNeedingReminder,
          execute: () => sql`
            SELECT e.id AS event_id, e.team_id, e.title, e.start_at::text, e.event_type,
                   e.discord_target_channel_id
            FROM events e
            JOIN team_settings ts ON ts.team_id = e.team_id
            WHERE e.status = 'active'
              AND e.reminder_sent_at IS NULL
              AND ts.rsvp_reminder_hours > 0
              AND e.start_at > NOW()
              AND e.start_at <= NOW() + (ts.rsvp_reminder_hours || ' hours')::interval
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findByTeamId(teamId: Team.TeamId) {
    return this.findByTeam(teamId);
  }

  upsert(input: {
    teamId: Team.TeamId;
    eventHorizonDays: number;
    minPlayersThreshold: number;
    rsvpReminderHours: number;
    discordChannelTraining?: string | null;
    discordChannelMatch?: string | null;
    discordChannelTournament?: string | null;
    discordChannelMeeting?: string | null;
    discordChannelSocial?: string | null;
    discordChannelOther?: string | null;
  }) {
    return this.upsertSettings({
      team_id: input.teamId,
      event_horizon_days: input.eventHorizonDays,
      min_players_threshold: input.minPlayersThreshold,
      rsvp_reminder_hours: input.rsvpReminderHours,
      discord_channel_training: input.discordChannelTraining ?? null,
      discord_channel_match: input.discordChannelMatch ?? null,
      discord_channel_tournament: input.discordChannelTournament ?? null,
      discord_channel_meeting: input.discordChannelMeeting ?? null,
      discord_channel_social: input.discordChannelSocial ?? null,
      discord_channel_other: input.discordChannelOther ?? null,
    });
  }

  getHorizonDays(teamId: Team.TeamId) {
    return this.getHorizon(teamId).pipe(Effect.map((r) => r.event_horizon_days));
  }

  findEventsNeedingReminder() {
    return this.findEventsForReminder(undefined as undefined);
  }
}
