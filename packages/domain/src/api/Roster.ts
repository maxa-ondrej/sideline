import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId, TeamRole } from '~/models/TeamMember.js';
import { Gender, Position, Proficiency, UserId } from '~/models/User.js';

export class RosterPlayer extends Schema.Class<RosterPlayer>('RosterPlayer')({
  memberId: TeamMemberId,
  userId: UserId,
  role: TeamRole,
  name: Schema.NullOr(Schema.String),
  birthYear: Schema.NullOr(Schema.Number),
  gender: Schema.NullOr(Gender),
  jerseyNumber: Schema.NullOr(Schema.Number),
  position: Schema.NullOr(Position),
  proficiency: Schema.NullOr(Proficiency),
  discordUsername: Schema.String,
  discordAvatar: Schema.NullOr(Schema.String),
}) {}

export class UpdatePlayerRequest extends Schema.Class<UpdatePlayerRequest>('UpdatePlayerRequest')({
  name: Schema.NullOr(Schema.String),
  birthYear: Schema.NullOr(Schema.Number),
  gender: Schema.NullOr(Gender),
  jerseyNumber: Schema.NullOr(Schema.Number),
  position: Schema.NullOr(Position),
  proficiency: Schema.NullOr(Proficiency),
}) {}

export class PlayerNotFound extends Schema.TaggedError<PlayerNotFound>()(
  'PlayerNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'Forbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class RosterApiGroup extends HttpApiGroup.make('roster')
  .add(
    HttpApiEndpoint.get('listRoster', '/teams/:teamId/roster')
      .addSuccess(Schema.Array(RosterPlayer))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getPlayer', '/teams/:teamId/roster/:memberId')
      .addSuccess(RosterPlayer)
      .addError(Forbidden, { status: 403 })
      .addError(PlayerNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updatePlayer', '/teams/:teamId/roster/:memberId')
      .addSuccess(RosterPlayer)
      .addError(Forbidden, { status: 403 })
      .addError(PlayerNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .setPayload(UpdatePlayerRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('deactivatePlayer', '/teams/:teamId/roster/:memberId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(PlayerNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .middleware(AuthMiddleware),
  ) {}
