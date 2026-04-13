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
  name: Schema.optionalWith(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)), {
    as: 'Option',
  }),
  description: Schema.optionalWith(
    Schema.OptionFromNullOr(Schema.String.pipe(Schema.maxLength(500))),
    {
      as: 'Option',
    },
  ),
  sport: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String.pipe(Schema.maxLength(50))), {
    as: 'Option',
  }),
  logoUrl: Schema.optionalWith(
    Schema.OptionFromNullOr(Schema.String.pipe(Schema.maxLength(2048))),
    {
      as: 'Option',
    },
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
