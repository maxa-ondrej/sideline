import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Permission, RoleId } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class RoleInfo extends Schema.Class<RoleInfo>('RoleInfo')({
  roleId: RoleId,
  teamId: TeamId,
  name: Schema.String,
  isBuiltIn: Schema.Boolean,
  permissionCount: Schema.Number,
}) {}

export class RoleDetail extends Schema.Class<RoleDetail>('RoleDetail')({
  roleId: RoleId,
  teamId: TeamId,
  name: Schema.String,
  isBuiltIn: Schema.Boolean,
  permissions: Schema.Array(Permission),
}) {}

export class CreateRoleRequest extends Schema.Class<CreateRoleRequest>('CreateRoleRequest')({
  name: Schema.NonEmptyString,
  permissions: Schema.Array(Permission),
}) {}

export class UpdateRoleRequest extends Schema.Class<UpdateRoleRequest>('UpdateRoleRequest')({
  name: Schema.NullOr(Schema.NonEmptyString),
  permissions: Schema.NullOr(Schema.Array(Permission)),
}) {}

export class RoleNotFound extends Schema.TaggedError<RoleNotFound>()(
  'RoleNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'RoleForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class CannotModifyBuiltIn extends Schema.TaggedError<CannotModifyBuiltIn>()(
  'CannotModifyBuiltIn',
  {},
  HttpApiSchema.annotations({ status: 400 }),
) {}

export class AssignRoleRequest extends Schema.Class<AssignRoleRequest>('AssignRoleRequest')({
  roleId: RoleId,
}) {}

export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  'MemberNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class RoleInUse extends Schema.TaggedError<RoleInUse>()(
  'RoleInUse',
  {},
  HttpApiSchema.annotations({ status: 409 }),
) {}

export class RoleApiGroup extends HttpApiGroup.make('role')
  .add(
    HttpApiEndpoint.get('listRoles', '/teams/:teamId/roles')
      .addSuccess(Schema.Array(RoleInfo))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createRole', '/teams/:teamId/roles')
      .addSuccess(RoleDetail, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(CreateRoleRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getRole', '/teams/:teamId/roles/:roleId')
      .addSuccess(RoleDetail)
      .addError(Forbidden, { status: 403 })
      .addError(RoleNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, roleId: RoleId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateRole', '/teams/:teamId/roles/:roleId')
      .addSuccess(RoleDetail)
      .addError(Forbidden, { status: 403 })
      .addError(RoleNotFound, { status: 404 })
      .addError(CannotModifyBuiltIn, { status: 400 })
      .setPath(Schema.Struct({ teamId: TeamId, roleId: RoleId }))
      .setPayload(UpdateRoleRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('deleteRole', '/teams/:teamId/roles/:roleId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(RoleNotFound, { status: 404 })
      .addError(CannotModifyBuiltIn, { status: 400 })
      .addError(RoleInUse, { status: 409 })
      .setPath(Schema.Struct({ teamId: TeamId, roleId: RoleId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('assignRole', '/teams/:teamId/members/:memberId/roles')
      .addSuccess(Schema.Void, { status: 204 })
      .addError(Forbidden, { status: 403 })
      .addError(MemberNotFound, { status: 404 })
      .addError(RoleNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId }))
      .setPayload(AssignRoleRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('unassignRole', '/teams/:teamId/members/:memberId/roles/:roleId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(MemberNotFound, { status: 404 })
      .addError(RoleNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, memberId: TeamMemberId, roleId: RoleId }))
      .middleware(AuthMiddleware),
  ) {}
