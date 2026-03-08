import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Forbidden } from '~/api/EventApi.js';
import { TeamId } from '~/models/Team.js';

export class TeamSettingsInfo extends Schema.Class<TeamSettingsInfo>('TeamSettingsInfo')({
  teamId: TeamId,
  eventHorizonDays: Schema.Int,
  minPlayersThreshold: Schema.Int,
  rsvpReminderHours: Schema.Int,
  discordChannelTraining: Schema.OptionFromNullOr(Schema.String),
  discordChannelMatch: Schema.OptionFromNullOr(Schema.String),
  discordChannelTournament: Schema.OptionFromNullOr(Schema.String),
  discordChannelMeeting: Schema.OptionFromNullOr(Schema.String),
  discordChannelSocial: Schema.OptionFromNullOr(Schema.String),
  discordChannelOther: Schema.OptionFromNullOr(Schema.String),
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
  discordChannelTraining: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), {
    as: 'Option',
  }),
  discordChannelMatch: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), {
    as: 'Option',
  }),
  discordChannelTournament: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), {
    as: 'Option',
  }),
  discordChannelMeeting: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), {
    as: 'Option',
  }),
  discordChannelSocial: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), {
    as: 'Option',
  }),
  discordChannelOther: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), {
    as: 'Option',
  }),
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
