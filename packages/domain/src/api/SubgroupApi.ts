import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Permission } from '~/models/Role.js';
import { SubgroupId } from '~/models/SubgroupModel.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class SubgroupInfo extends Schema.Class<SubgroupInfo>('SubgroupInfo')({
  subgroupId: SubgroupId,
  teamId: TeamId,
  name: Schema.String,
  memberCount: Schema.Number,
}) {}

export class SubgroupDetail extends Schema.Class<SubgroupDetail>('SubgroupDetail')({
  subgroupId: SubgroupId,
  teamId: TeamId,
  name: Schema.String,
  permissions: Schema.Array(Permission),
  members: Schema.Array(
    Schema.Struct({
      memberId: TeamMemberId,
      name: Schema.NullOr(Schema.String),
      discordUsername: Schema.String,
    }),
  ),
}) {}

export class CreateSubgroupRequest extends Schema.Class<CreateSubgroupRequest>(
  'CreateSubgroupRequest',
)({
  name: Schema.NonEmptyString,
}) {}

export class UpdateSubgroupRequest extends Schema.Class<UpdateSubgroupRequest>(
  'UpdateSubgroupRequest',
)({
  name: Schema.NonEmptyString,
}) {}

export class AddSubgroupMemberRequest extends Schema.Class<AddSubgroupMemberRequest>(
  'AddSubgroupMemberRequest',
)({
  memberId: TeamMemberId,
}) {}

export class SetSubgroupPermissionsRequest extends Schema.Class<SetSubgroupPermissionsRequest>(
  'SetSubgroupPermissionsRequest',
)({
  permissions: Schema.Array(Permission),
}) {}

export class SubgroupNotFound extends Schema.TaggedError<SubgroupNotFound>()(
  'SubgroupNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'SubgroupForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  'SubgroupMemberNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class SubgroupApiGroup extends HttpApiGroup.make('subgroup')
  .add(
    HttpApiEndpoint.get('listSubgroups', '/teams/:teamId/subgroups')
      .addSuccess(Schema.Array(SubgroupInfo))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createSubgroup', '/teams/:teamId/subgroups')
      .addSuccess(SubgroupInfo, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(CreateSubgroupRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getSubgroup', '/teams/:teamId/subgroups/:subgroupId')
      .addSuccess(SubgroupDetail)
      .addError(Forbidden, { status: 403 })
      .addError(SubgroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, subgroupId: SubgroupId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateSubgroup', '/teams/:teamId/subgroups/:subgroupId')
      .addSuccess(SubgroupInfo)
      .addError(Forbidden, { status: 403 })
      .addError(SubgroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, subgroupId: SubgroupId }))
      .setPayload(UpdateSubgroupRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('deleteSubgroup', '/teams/:teamId/subgroups/:subgroupId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(SubgroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, subgroupId: SubgroupId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('addSubgroupMember', '/teams/:teamId/subgroups/:subgroupId/members')
      .addSuccess(Schema.Void, { status: 204 })
      .addError(Forbidden, { status: 403 })
      .addError(SubgroupNotFound, { status: 404 })
      .addError(MemberNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, subgroupId: SubgroupId }))
      .setPayload(AddSubgroupMemberRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del(
      'removeSubgroupMember',
      '/teams/:teamId/subgroups/:subgroupId/members/:memberId',
    )
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(SubgroupNotFound, { status: 404 })
      .addError(MemberNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, subgroupId: SubgroupId, memberId: TeamMemberId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch(
      'setSubgroupPermissions',
      '/teams/:teamId/subgroups/:subgroupId/permissions',
    )
      .addSuccess(SubgroupDetail)
      .addError(Forbidden, { status: 403 })
      .addError(SubgroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, subgroupId: SubgroupId }))
      .setPayload(SetSubgroupPermissionsRequest)
      .middleware(AuthMiddleware),
  ) {}
