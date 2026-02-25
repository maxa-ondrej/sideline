import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Permission } from '~/models/Role.js';
import { RosterId } from '~/models/RosterModel.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';
import { Gender, Position, Proficiency, UserId } from '~/models/User.js';

export class RosterPlayer extends Schema.Class<RosterPlayer>('RosterPlayer')({
  memberId: TeamMemberId,
  userId: UserId,
  roleName: Schema.String,
  permissions: Schema.Array(Permission),
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

export class RosterNotFound extends Schema.TaggedError<RosterNotFound>()(
  'RosterNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class RosterInfo extends Schema.Class<RosterInfo>('RosterInfo')({
  rosterId: RosterId,
  teamId: TeamId,
  name: Schema.String,
  active: Schema.Boolean,
  memberCount: Schema.Number,
  createdAt: Schema.String,
}) {}

export class RosterDetail extends Schema.Class<RosterDetail>('RosterDetail')({
  rosterId: RosterId,
  teamId: TeamId,
  name: Schema.String,
  active: Schema.Boolean,
  createdAt: Schema.String,
  members: Schema.Array(RosterPlayer),
}) {}

export class CreateRosterRequest extends Schema.Class<CreateRosterRequest>('CreateRosterRequest')({
  name: Schema.String,
}) {}

export class UpdateRosterRequest extends Schema.Class<UpdateRosterRequest>('UpdateRosterRequest')({
  name: Schema.NullOr(Schema.String),
  active: Schema.NullOr(Schema.Boolean),
}) {}

export class AddRosterMemberRequest extends Schema.Class<AddRosterMemberRequest>(
  'AddRosterMemberRequest',
)({
  memberId: TeamMemberId,
}) {}

export class RosterApiGroup extends HttpApiGroup.make('roster')
  .add(
    HttpApiEndpoint.get('listMembers', '/teams/:teamId/members')
      .addSuccess(Schema.Array(RosterPlayer))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getMember', '/teams/:teamId/members/:memberId')
      .addSuccess(RosterPlayer)
      .addError(Forbidden, { status: 403 })
      .addError(PlayerNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateMember', '/teams/:teamId/members/:memberId')
      .addSuccess(RosterPlayer)
      .addError(Forbidden, { status: 403 })
      .addError(PlayerNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .setPayload(UpdatePlayerRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('deactivateMember', '/teams/:teamId/members/:memberId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(PlayerNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('listRosters', '/teams/:teamId/rosters')
      .addSuccess(Schema.Array(RosterInfo))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createRoster', '/teams/:teamId/rosters')
      .addSuccess(RosterInfo, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(CreateRosterRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getRoster', '/teams/:teamId/rosters/:rosterId')
      .addSuccess(RosterDetail)
      .addError(Forbidden, { status: 403 })
      .addError(RosterNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, rosterId: RosterId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateRoster', '/teams/:teamId/rosters/:rosterId')
      .addSuccess(RosterInfo)
      .addError(Forbidden, { status: 403 })
      .addError(RosterNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, rosterId: RosterId }))
      .setPayload(UpdateRosterRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('deleteRoster', '/teams/:teamId/rosters/:rosterId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(RosterNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, rosterId: RosterId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('addRosterMember', '/teams/:teamId/rosters/:rosterId/members')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(RosterNotFound, { status: 404 })
      .addError(PlayerNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, rosterId: RosterId }))
      .setPayload(AddRosterMemberRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('removeRosterMember', '/teams/:teamId/rosters/:rosterId/members/:memberId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(RosterNotFound, { status: 404 })
      .addError(PlayerNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, rosterId: RosterId, memberId: TeamMemberId }))
      .middleware(AuthMiddleware),
  ) {}
