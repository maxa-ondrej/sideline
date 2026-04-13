import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { Forbidden } from '~/api/EventApi.js';
import { ChannelCleanupMode } from '~/models/ChannelSyncEvent.js';
import { Snowflake } from '~/models/Discord.js';
import { TeamId } from '~/models/Team.js';

const DiscordFormatString = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter<string>((s) => (s.includes('{name}') ? true : 'Format must include {name}')),
  ),
);

export class TeamSettingsInfo extends Schema.Class<TeamSettingsInfo>('TeamSettingsInfo')({
  teamId: TeamId,
  eventHorizonDays: Schema.Int,
  minPlayersThreshold: Schema.Int,
  rsvpReminderHours: Schema.Int,
  discordChannelTraining: Schema.OptionFromNullOr(Snowflake),
  discordChannelMatch: Schema.OptionFromNullOr(Snowflake),
  discordChannelTournament: Schema.OptionFromNullOr(Snowflake),
  discordChannelMeeting: Schema.OptionFromNullOr(Snowflake),
  discordChannelSocial: Schema.OptionFromNullOr(Snowflake),
  discordChannelOther: Schema.OptionFromNullOr(Snowflake),
  discordChannelLateRsvp: Schema.OptionFromNullOr(Snowflake),
  createDiscordChannelOnGroup: Schema.Boolean,
  createDiscordChannelOnRoster: Schema.Boolean,
  discordArchiveCategoryId: Schema.OptionFromNullOr(Snowflake),
  discordChannelCleanupOnGroupDelete: ChannelCleanupMode,
  discordChannelCleanupOnRosterDeactivate: ChannelCleanupMode,
  discordRoleFormat: Schema.String,
  discordChannelFormat: Schema.String,
}) {}

export class UpdateTeamSettingsRequest extends Schema.Class<UpdateTeamSettingsRequest>(
  'UpdateTeamSettingsRequest',
)({
  eventHorizonDays: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 365 }))),
  minPlayersThreshold: Schema.OptionFromOptional(
    Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 100 }))),
  ),
  rsvpReminderHours: Schema.OptionFromOptional(
    Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 168 }))),
  ),
  discordChannelTraining: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  discordChannelMatch: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  discordChannelTournament: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  discordChannelMeeting: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  discordChannelSocial: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  discordChannelOther: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  discordChannelLateRsvp: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  createDiscordChannelOnGroup: Schema.OptionFromOptional(Schema.Boolean),
  createDiscordChannelOnRoster: Schema.OptionFromOptional(Schema.Boolean),
  discordArchiveCategoryId: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  discordChannelCleanupOnGroupDelete: Schema.OptionFromOptional(ChannelCleanupMode),
  discordChannelCleanupOnRosterDeactivate: Schema.OptionFromOptional(ChannelCleanupMode),
  discordRoleFormat: Schema.OptionFromOptional(DiscordFormatString),
  discordChannelFormat: Schema.OptionFromOptional(DiscordFormatString),
}) {}

export class TeamSettingsApiGroup extends HttpApiGroup.make('teamSettings')
  .add(
    HttpApiEndpoint.get('getTeamSettings', '/teams/:teamId/settings', {
      success: TeamSettingsInfo,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateTeamSettings', '/teams/:teamId/settings', {
      success: TeamSettingsInfo,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      payload: UpdateTeamSettingsRequest,
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  ) {}
