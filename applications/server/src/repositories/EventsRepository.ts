import { SqlClient, SqlSchema } from '@effect/sql';
import {
  Discord,
  Event,
  EventSeries,
  GroupModel,
  Team,
  TeamMember,
  TrainingType,
} from '@sideline/domain';
import { Schemas } from '@sideline/effect-lib';
import { type DateTime, Effect, Option, Schema } from 'effect';

class EventWithDetails extends Schema.Class<EventWithDetails>('EventWithDetails')({
  id: Event.EventId,
  team_id: Team.TeamId,
  training_type_id: Schema.OptionFromNullOr(TrainingType.TrainingTypeId),
  event_type: Event.EventType,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromDate,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
  location: Schema.OptionFromNullOr(Schema.String),
  status: Event.EventStatus,
  created_by: TeamMember.TeamMemberId,
  training_type_name: Schema.OptionFromNullOr(Schema.String),
  created_by_name: Schema.OptionFromNullOr(Schema.String),
  series_id: Schema.OptionFromNullOr(EventSeries.EventSeriesId),
  series_modified: Schema.Boolean,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  owner_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  owner_group_name: Schema.OptionFromNullOr(Schema.String),
  member_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  member_group_name: Schema.OptionFromNullOr(Schema.String),
}) {}

class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: Event.EventId,
  team_id: Team.TeamId,
  training_type_id: Schema.OptionFromNullOr(TrainingType.TrainingTypeId),
  event_type: Event.EventType,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromDate,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
  location: Schema.OptionFromNullOr(Schema.String),
  status: Event.EventStatus,
  created_by: TeamMember.TeamMemberId,
  series_id: Schema.OptionFromNullOr(EventSeries.EventSeriesId),
  series_modified: Schema.Boolean,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  owner_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  member_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
}) {}

class EventInsertInput extends Schema.Class<EventInsertInput>('EventInsertInput')({
  team_id: Schema.String,
  training_type_id: Schema.OptionFromNullOr(Schema.String),
  event_type: Schema.String,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromDate,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
  location: Schema.OptionFromNullOr(Schema.String),
  created_by: Schema.String,
  series_id: Schema.OptionFromNullOr(Schema.String),
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  owner_group_id: Schema.OptionFromNullOr(Schema.String),
  member_group_id: Schema.OptionFromNullOr(Schema.String),
}) {}

class EventUpdateInput extends Schema.Class<EventUpdateInput>('EventUpdateInput')({
  id: Event.EventId,
  title: Schema.String,
  event_type: Schema.String,
  training_type_id: Schema.OptionFromNullOr(Schema.String),
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromDate,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
  location: Schema.OptionFromNullOr(Schema.String),
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  owner_group_id: Schema.OptionFromNullOr(Schema.String),
  member_group_id: Schema.OptionFromNullOr(Schema.String),
}) {}

class ScopedTrainingTypeId extends Schema.Class<ScopedTrainingTypeId>('ScopedTrainingTypeId')({
  training_type_id: TrainingType.TrainingTypeId,
}) {}

export class EventsRepository extends Effect.Service<EventsRepository>()('api/EventsRepository', {
  effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
}) {
  private findByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: EventWithDetails,
    execute: (teamId) => this.sql`
            SELECT e.id, e.team_id, e.training_type_id, e.event_type, e.title,
                   e.description, e.start_at, e.end_at,
                   e.location, e.status, e.created_by,
                   tt.name AS training_type_name,
                   u.name AS created_by_name,
                   e.series_id, e.series_modified,
                   e.discord_target_channel_id,
                   e.owner_group_id, og.name AS owner_group_name,
                   e.member_group_id, mg.name AS member_group_name
            FROM events e
            LEFT JOIN training_types tt ON tt.id = e.training_type_id
            LEFT JOIN team_members tm ON tm.id = e.created_by
            LEFT JOIN users u ON u.id = tm.user_id
            LEFT JOIN groups og ON og.id = e.owner_group_id
            LEFT JOIN groups mg ON mg.id = e.member_group_id
            WHERE e.team_id = ${teamId}
            ORDER BY e.start_at ASC
          `,
  });

  private findByIdWithDetails = SqlSchema.findOne({
    Request: Event.EventId,
    Result: EventWithDetails,
    execute: (id) => this.sql`
            SELECT e.id, e.team_id, e.training_type_id, e.event_type, e.title,
                   e.description, e.start_at, e.end_at,
                   e.location, e.status, e.created_by,
                   tt.name AS training_type_name,
                   u.name AS created_by_name,
                   e.series_id, e.series_modified,
                   e.discord_target_channel_id,
                   e.owner_group_id, og.name AS owner_group_name,
                   e.member_group_id, mg.name AS member_group_name
            FROM events e
            LEFT JOIN training_types tt ON tt.id = e.training_type_id
            LEFT JOIN team_members tm ON tm.id = e.created_by
            LEFT JOIN users u ON u.id = tm.user_id
            LEFT JOIN groups og ON og.id = e.owner_group_id
            LEFT JOIN groups mg ON mg.id = e.member_group_id
            WHERE e.id = ${id}
          `,
  });

  private insert = SqlSchema.single({
    Request: EventInsertInput,
    Result: EventRow,
    execute: (input) => this.sql`
            INSERT INTO events (team_id, training_type_id, event_type, title, description,
                                start_at, end_at, location, created_by, series_id,
                                discord_target_channel_id, owner_group_id, member_group_id)
            VALUES (${input.team_id}, ${input.training_type_id}, ${input.event_type},
                    ${input.title}, ${input.description}, ${input.start_at},
                    ${input.end_at}, ${input.location}, ${input.created_by},
                    ${input.series_id}, ${input.discord_target_channel_id},
                    ${input.owner_group_id}, ${input.member_group_id})
            RETURNING id, team_id, training_type_id, event_type, title, description,
                      start_at, end_at, location, status,
                      created_by, series_id, series_modified, discord_target_channel_id,
                      owner_group_id, member_group_id
          `,
  });

  private update = SqlSchema.single({
    Request: EventUpdateInput,
    Result: EventRow,
    execute: (input) => this.sql`
            UPDATE events SET
              title = ${input.title},
              event_type = ${input.event_type},
              training_type_id = ${input.training_type_id},
              description = ${input.description},
              start_at = ${input.start_at},
              end_at = ${input.end_at},
              location = ${input.location},
              discord_target_channel_id = ${input.discord_target_channel_id},
              owner_group_id = ${input.owner_group_id},
              member_group_id = ${input.member_group_id},
              updated_at = now()
            WHERE id = ${input.id}
            RETURNING id, team_id, training_type_id, event_type, title, description,
                      start_at, end_at, location, status,
                      created_by, series_id, series_modified, discord_target_channel_id,
                      owner_group_id, member_group_id
          `,
  });

  private cancel = SqlSchema.void({
    Request: Event.EventId,
    execute: (id) =>
      this.sql`UPDATE events SET status = 'cancelled', updated_at = now() WHERE id = ${id}`,
  });

  private findScopedTrainingTypeIds = SqlSchema.findAll({
    Request: TeamMember.TeamMemberId,
    Result: ScopedTrainingTypeId,
    execute: (teamMemberId) => this.sql`
            SELECT DISTINCT rtt.training_type_id FROM (
              SELECT rtt.training_type_id
              FROM member_roles mr
              JOIN role_training_types rtt ON rtt.role_id = mr.role_id
              WHERE mr.team_member_id = ${teamMemberId}
              UNION ALL
              SELECT rtt.training_type_id
              FROM group_members gm
              JOIN LATERAL (
                WITH RECURSIVE ancestors AS (
                  SELECT gm.group_id AS id
                  UNION ALL
                  SELECT g.parent_id FROM groups g JOIN ancestors a ON g.id = a.id WHERE g.parent_id IS NOT NULL
                )
                SELECT id FROM ancestors
              ) anc ON true
              JOIN role_groups rg ON rg.group_id = anc.id
              JOIN role_training_types rtt ON rtt.role_id = rg.role_id
              WHERE gm.team_member_id = ${teamMemberId}
            ) rtt
          `,
  });

  private saveDiscordMessage = SqlSchema.void({
    Request: Schema.Struct({
      event_id: Event.EventId,
      discord_channel_id: Discord.Snowflake,
      discord_message_id: Discord.Snowflake,
    }),
    execute: (input) =>
      this
        .sql`UPDATE events SET discord_channel_id = ${input.discord_channel_id}, discord_message_id = ${input.discord_message_id} WHERE id = ${input.event_id}`,
  });

  private getDiscordMessage = SqlSchema.findOne({
    Request: Event.EventId,
    Result: Schema.Struct({
      discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
      discord_message_id: Schema.OptionFromNullOr(Discord.Snowflake),
    }),
    execute: (id) =>
      this.sql`SELECT discord_channel_id, discord_message_id FROM events WHERE id = ${id}`,
  });

  private findByChannelId = SqlSchema.findAll({
    Request: Discord.Snowflake,
    Result: Schema.Struct({
      event_id: Schema.String,
      team_id: Schema.String,
      title: Schema.String,
      description: Schema.OptionFromNullOr(Schema.String),
      start_at: Schemas.DateTimeFromDate,
      end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
      location: Schema.OptionFromNullOr(Schema.String),
      event_type: Schema.String,
      status: Schema.String,
      discord_message_id: Discord.Snowflake,
    }),
    execute: (channelId) => this.sql`
            SELECT id AS event_id, team_id, title, description,
                   start_at, end_at, location, event_type,
                   status, discord_message_id
            FROM events
            WHERE discord_channel_id = ${channelId}
              AND discord_message_id IS NOT NULL
            ORDER BY start_at ASC
          `,
  });

  private markReminder = SqlSchema.void({
    Request: Event.EventId,
    execute: (id) => this.sql`UPDATE events SET reminder_sent_at = now() WHERE id = ${id}`,
  });

  private markAutoLogged = SqlSchema.void({
    Request: Event.EventId,
    execute: (id) => this.sql`UPDATE events SET auto_logged_at = now() WHERE id = ${id}`,
  });

  private findEndedTrainings = SqlSchema.findAll({
    Request: Schema.Void,
    Result: Schema.Struct({
      id: Event.EventId,
      start_at: Schemas.DateTimeFromDate,
      end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
    }),
    execute: () => this.sql`
      SELECT id, start_at, end_at
      FROM events
      WHERE event_type = 'training'
        AND status = 'active'
        AND auto_logged_at IS NULL
        AND COALESCE(end_at, start_at) < NOW()
        AND COALESCE(end_at, start_at) > NOW() - INTERVAL '7 days'
    `,
  });

  private markModified = SqlSchema.void({
    Request: Event.EventId,
    execute: (id) =>
      this.sql`UPDATE events SET series_modified = true, updated_at = now() WHERE id = ${id}`,
  });

  private cancelFuture = SqlSchema.void({
    Request: Schema.Struct({
      series_id: Schema.String,
      from_date: Schema.DateFromSelf,
    }),
    execute: (input) =>
      this.sql`UPDATE events SET status = 'cancelled', updated_at = now()
              WHERE series_id = ${input.series_id}
                AND (start_at AT TIME ZONE 'UTC')::date >= ${input.from_date}::date
                AND status = 'active'`,
  });

  private updateFutureUnmodified = SqlSchema.void({
    Request: Schema.Struct({
      series_id: Schema.String,
      from_date: Schema.DateFromSelf,
      title: Schema.String,
      training_type_id: Schema.OptionFromNullOr(Schema.String),
      description: Schema.OptionFromNullOr(Schema.String),
      start_time: Schema.String,
      end_time: Schema.OptionFromNullOr(Schema.String),
      location: Schema.OptionFromNullOr(Schema.String),
    }),
    execute: (input) =>
      this.sql`UPDATE events SET
                title = ${input.title},
                training_type_id = ${input.training_type_id},
                description = ${input.description},
                start_at = ((start_at AT TIME ZONE 'UTC')::date + ${input.start_time}::time) AT TIME ZONE 'UTC',
                end_at = CASE WHEN ${input.end_time} IS NOT NULL THEN ((start_at AT TIME ZONE 'UTC')::date + ${input.end_time}::time) AT TIME ZONE 'UTC' ELSE NULL END,
                location = ${input.location},
                updated_at = now()
              WHERE series_id = ${input.series_id}
                AND (start_at AT TIME ZONE 'UTC')::date >= ${input.from_date}::date
                AND series_modified = false
                AND status = 'active'`,
  });

  private findUpcomingByGuild = SqlSchema.findAll({
    Request: Schema.Struct({
      guild_id: Schema.String,
      offset: Schema.Number,
      limit: Schema.Number,
    }),
    Result: Schema.Struct({
      event_id: Schema.String,
      title: Schema.String,
      start_at: Schemas.DateTimeFromDate,
      end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
      location: Schema.OptionFromNullOr(Schema.String),
      event_type: Schema.String,
      yes_count: Schema.Number,
      no_count: Schema.Number,
      maybe_count: Schema.Number,
    }),
    execute: (input) => this.sql`
            SELECT e.id AS event_id, e.title, e.start_at, e.end_at,
                   e.location, e.event_type,
                   COALESCE(SUM(CASE WHEN er.response = 'yes' THEN 1 ELSE 0 END), 0)::int AS yes_count,
                   COALESCE(SUM(CASE WHEN er.response = 'no' THEN 1 ELSE 0 END), 0)::int AS no_count,
                   COALESCE(SUM(CASE WHEN er.response = 'maybe' THEN 1 ELSE 0 END), 0)::int AS maybe_count
            FROM events e
            LEFT JOIN event_rsvps er ON er.event_id = e.id
            WHERE e.team_id = (SELECT id FROM teams WHERE guild_id = ${input.guild_id})
              AND e.status = 'active'
              AND e.start_at >= now()
            GROUP BY e.id
            ORDER BY e.start_at ASC
            LIMIT ${input.limit} OFFSET ${input.offset}
          `,
  });

  private findByUserId = SqlSchema.findAll({
    Request: Schema.String,
    Result: Schema.Struct({
      id: Schema.String,
      title: Schema.String,
      description: Schema.OptionFromNullOr(Schema.String),
      start_at: Schemas.DateTimeFromDate,
      end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
      location: Schema.OptionFromNullOr(Schema.String),
      status: Schema.String,
      event_type: Schema.String,
      team_name: Schema.String,
      rsvp_response: Schema.String,
    }),
    execute: (userId) => this.sql`
            SELECT e.id, e.title, e.description, e.start_at, e.end_at,
                   e.location, e.status, e.event_type, t.name AS team_name,
                   er.response AS rsvp_response
            FROM events e
            JOIN teams t ON t.id = e.team_id
            JOIN team_members tm ON tm.team_id = t.id AND tm.active = true
            JOIN event_rsvps er ON er.event_id = e.id AND er.team_member_id = tm.id
            WHERE tm.user_id = ${userId}
              AND e.status = 'active'
              AND er.response IN ('yes', 'maybe')
            ORDER BY e.start_at ASC
          `,
  });

  private countUpcomingByGuild = SqlSchema.findOne({
    Request: Schema.String,
    Result: Schema.Struct({ count: Schema.Number }),
    execute: (guildId) => this.sql`
            SELECT COUNT(*)::int AS count
            FROM events
            WHERE team_id = (SELECT id FROM teams WHERE guild_id = ${guildId})
              AND status = 'active'
              AND start_at >= now()
          `,
  });

  findUpcomingByGuildId = (guildId: Discord.Snowflake, offset: number, limit: number) =>
    this.findUpcomingByGuild({ guild_id: guildId, offset, limit }).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  countUpcomingByGuildId = (guildId: Discord.Snowflake) =>
    this.countUpcomingByGuild(guildId).pipe(
      Effect.map(Option.map((r) => r.count)),
      Effect.map(Option.getOrElse(() => 0)),
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  findEventsByUserId = (userId: string) =>
    this.findByUserId(userId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  findEventsByTeamId = (teamId: Team.TeamId) =>
    this.findByTeamId(teamId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  findEventByIdWithDetails = (eventId: Event.EventId) =>
    this.findByIdWithDetails(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  insertEvent = ({
    teamId,
    trainingTypeId,
    eventType,
    title,
    description,
    startAt,
    endAt,
    location,
    createdBy,
    seriesId = Option.none(),
    discordTargetChannelId = Option.none(),
    ownerGroupId = Option.none(),
    memberGroupId = Option.none(),
  }: {
    teamId: Team.TeamId;
    trainingTypeId: Option.Option<string>;
    eventType: string;
    title: string;
    description: Option.Option<string>;
    startAt: DateTime.Utc;
    endAt: Option.Option<DateTime.Utc>;
    location: Option.Option<string>;
    createdBy: TeamMember.TeamMemberId;
    seriesId?: Option.Option<string>;
    discordTargetChannelId?: Option.Option<Discord.Snowflake>;
    ownerGroupId?: Option.Option<string>;
    memberGroupId?: Option.Option<string>;
  }) =>
    this.insert({
      team_id: teamId,
      training_type_id: trainingTypeId,
      event_type: eventType,
      title,
      description,
      start_at: startAt,
      end_at: endAt,
      location,
      created_by: createdBy,
      series_id: seriesId,
      discord_target_channel_id: discordTargetChannelId,
      owner_group_id: ownerGroupId,
      member_group_id: memberGroupId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  updateEvent = ({
    id,
    title,
    eventType,
    trainingTypeId,
    description,
    startAt,
    endAt,
    location,
    discordTargetChannelId = Option.none(),
    ownerGroupId = Option.none(),
    memberGroupId = Option.none(),
  }: {
    id: Event.EventId;
    title: string;
    eventType: string;
    trainingTypeId: Option.Option<string>;
    description: Option.Option<string>;
    startAt: DateTime.Utc;
    endAt: Option.Option<DateTime.Utc>;
    location: Option.Option<string>;
    discordTargetChannelId?: Option.Option<Discord.Snowflake>;
    ownerGroupId?: Option.Option<string>;
    memberGroupId?: Option.Option<string>;
  }) =>
    this.update({
      id,
      title,
      event_type: eventType,
      training_type_id: trainingTypeId,
      description,
      start_at: startAt,
      end_at: endAt,
      location,
      discord_target_channel_id: discordTargetChannelId,
      owner_group_id: ownerGroupId,
      member_group_id: memberGroupId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  cancelEvent = (eventId: Event.EventId) =>
    this.cancel(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  getScopedTrainingTypeIds = (teamMemberId: TeamMember.TeamMemberId) =>
    this.findScopedTrainingTypeIds(teamMemberId).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  saveDiscordMessageId = (
    eventId: Event.EventId,
    channelId: Discord.Snowflake,
    messageId: Discord.Snowflake,
  ) =>
    this.saveDiscordMessage({
      event_id: eventId,
      discord_channel_id: channelId,
      discord_message_id: messageId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  getDiscordMessageId = (eventId: Event.EventId) =>
    this.getDiscordMessage(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  findEventsByChannelId = (channelId: Discord.Snowflake) =>
    this.findByChannelId(channelId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  markReminderSent = (eventId: Event.EventId) =>
    this.markReminder(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  markTrainingAutoLogged = (eventId: Event.EventId) =>
    this.markAutoLogged(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  findEndedTrainingsForAutoLog = () =>
    this.findEndedTrainings(undefined).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  markEventSeriesModified = (eventId: Event.EventId) =>
    this.markModified(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  cancelFutureInSeries = (seriesId: EventSeries.EventSeriesId, fromDate: Date) =>
    this.cancelFuture({ series_id: seriesId, from_date: fromDate }).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  updateFutureUnmodifiedInSeries = (
    seriesId: EventSeries.EventSeriesId,
    fromDate: Date,
    fields: {
      title: string;
      trainingTypeId: Option.Option<string>;
      description: Option.Option<string>;
      startTime: string;
      endTime: Option.Option<string>;
      location: Option.Option<string>;
    },
  ) =>
    this.updateFutureUnmodified({
      series_id: seriesId,
      from_date: fromDate,
      title: fields.title,
      training_type_id: fields.trainingTypeId,
      description: fields.description,
      start_time: fields.startTime,
      end_time: fields.endTime,
      location: fields.location,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
}
