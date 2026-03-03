import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Forbidden } from '~/api/EventApi.js';
import { TeamId } from '~/models/Team.js';

export class TeamSettingsInfo extends Schema.Class<TeamSettingsInfo>('TeamSettingsInfo')({
  teamId: TeamId,
  eventHorizonDays: Schema.Int,
}) {}

export class UpdateTeamSettingsRequest extends Schema.Class<UpdateTeamSettingsRequest>(
  'UpdateTeamSettingsRequest',
)({
  eventHorizonDays: Schema.Int.pipe(Schema.between(1, 365)),
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
