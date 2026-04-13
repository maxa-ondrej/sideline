import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { Forbidden } from '~/api/EventApi.js';
import { Snowflake } from '~/models/Discord.js';
import { TeamId } from '~/models/Team.js';

export class TeamInfo extends Schema.Class<TeamInfo>('TeamInfo')({
  teamId: TeamId,
  name: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  sport: Schema.OptionFromNullOr(Schema.String),
  logoUrl: Schema.OptionFromNullOr(Schema.String),
  guildId: Snowflake,
}) {}

export class UpdateTeamRequest extends Schema.Class<UpdateTeamRequest>('UpdateTeamRequest')({
  name: Schema.OptionFromOptional(
    Schema.String.pipe(Schema.isMinLength(1), Schema.isMaxLength(100)),
  ),
  description: Schema.OptionFromOptional(
    Schema.OptionFromNullOr(Schema.String.pipe(Schema.isMaxLength(500))),
  ),
  sport: Schema.OptionFromOptional(
    Schema.OptionFromNullOr(Schema.String.pipe(Schema.isMaxLength(50))),
  ),
  logoUrl: Schema.OptionFromOptional(
    Schema.OptionFromNullOr(Schema.String.pipe(Schema.isMaxLength(2048))),
  ),
}) {}

export class TeamApiGroup extends HttpApiGroup.make('team')
  .add(
    HttpApiEndpoint.get('getTeamInfo', '/teams/:teamId')
      .addSuccess(TeamInfo)
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateTeamInfo', '/teams/:teamId')
      .addSuccess(TeamInfo)
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(UpdateTeamRequest)
      .middleware(AuthMiddleware),
  ) {}
