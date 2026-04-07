import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Forbidden } from '~/api/EventApi.js';
import { ChannelCleanupMode } from '~/models/ChannelSyncEvent.js';
import { Snowflake } from '~/models/Discord.js';
import { TeamId } from '~/models/Team.js';

const DiscordFormatString = Schema.String.pipe(
  Schema.filter((s) => s.includes('{name}'), {
    message: () => 'Format must include {name}',
  }),
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
  eventHorizonDays: Schema.Int.pipe(Schema.between(1, 365)),
  minPlayersThreshold: Schema.optionalWith(Schema.Int.pipe(Schema.between(0, 100)), {
    as: 'Option',
  }),
  rsvpReminderHours: Schema.optionalWith(Schema.Int.pipe(Schema.between(0, 168)), {
    as: 'Option',
  }),
  discordChannelTraining: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), {
    as: 'Option',
  }),
  discordChannelMatch: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), {
    as: 'Option',
  }),
  discordChannelTournament: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), {
    as: 'Option',
  }),
  discordChannelMeeting: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), {
    as: 'Option',
  }),
  discordChannelSocial: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), {
    as: 'Option',
  }),
  discordChannelOther: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), {
    as: 'Option',
  }),
  discordChannelLateRsvp: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), {
    as: 'Option',
  }),
  createDiscordChannelOnGroup: Schema.optionalWith(Schema.Boolean, { as: 'Option' }),
  createDiscordChannelOnRoster: Schema.optionalWith(Schema.Boolean, { as: 'Option' }),
  discordArchiveCategoryId: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), {
    as: 'Option',
  }),
  discordChannelCleanupOnGroupDelete: Schema.optionalWith(ChannelCleanupMode, { as: 'Option' }),
  discordChannelCleanupOnRosterDeactivate: Schema.optionalWith(ChannelCleanupMode, {
    as: 'Option',
  }),
  discordRoleFormat: Schema.optionalWith(DiscordFormatString, { as: 'Option' }),
  discordChannelFormat: Schema.optionalWith(DiscordFormatString, { as: 'Option' }),
}) {}

export class TeamSettingsApiGroup extends HttpApiGroup.make('teamSettings')
  .add(
    HttpApiEndpoint.get('getTeamSettings', '/teams/:teamId/settings')
      .addSuccess(TeamSettingsInfo)
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateTeamSettings', '/teams/:teamId/settings')
      .addSuccess(TeamSettingsInfo)
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(UpdateTeamSettingsRequest)
      .middleware(AuthMiddleware),
  ) {}
