import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
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

export class RoleListResponse extends Schema.Class<RoleListResponse>('RoleListResponse')({
  canManage: Schema.Boolean,
  roles: Schema.Array(RoleInfo),
}) {}

export class RoleDetail extends Schema.Class<RoleDetail>('RoleDetail')({
  roleId: RoleId,
  teamId: TeamId,
  name: Schema.String,
  isBuiltIn: Schema.Boolean,
  permissions: Schema.Array(Permission),
  canManage: Schema.Boolean,
}) {}

export class CreateRoleRequest extends Schema.Class<CreateRoleRequest>('CreateRoleRequest')({
  name: Schema.NonEmptyString,
  permissions: Schema.Array(Permission),
}) {}

export class UpdateRoleRequest extends Schema.Class<UpdateRoleRequest>('UpdateRoleRequest')({
  name: Schema.OptionFromNullOr(Schema.NonEmptyString),
  permissions: Schema.OptionFromNullOr(Schema.Array(Permission)),
}) {}

export class RoleNotFound extends Schema.TaggedErrorClass<RoleNotFound>()('RoleNotFound', {}) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()('RoleForbidden', {}) {}

export class CannotModifyBuiltIn extends Schema.TaggedErrorClass<CannotModifyBuiltIn>()(
  'CannotModifyBuiltIn',
  {},
) {}

export class AssignRoleRequest extends Schema.Class<AssignRoleRequest>('AssignRoleRequest')({
  roleId: RoleId,
}) {}

export class MemberNotFound extends Schema.TaggedErrorClass<MemberNotFound>()(
  'MemberNotFound',
  {},
) {}

export class RoleInUse extends Schema.TaggedErrorClass<RoleInUse>()('RoleInUse', {}) {}

export class RoleNameAlreadyTaken extends Schema.TaggedErrorClass<RoleNameAlreadyTaken>()(
  'RoleNameAlreadyTaken',
  {},
) {}

export class RoleApiGroup extends HttpApiGroup.make('role')
  .add(
    HttpApiEndpoint.get('listRoles', '/teams/:teamId/roles', {
      success: RoleListResponse,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createRole', '/teams/:teamId/roles', {
      success: RoleDetail.pipe(HttpApiSchema.status(201)),
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        RoleNameAlreadyTaken.pipe(HttpApiSchema.status(409)),
      ],
      payload: CreateRoleRequest,
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getRole', '/teams/:teamId/roles/:roleId', {
      success: RoleDetail,
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        RoleNotFound.pipe(HttpApiSchema.status(404)),
      ],
      params: { teamId: TeamId, roleId: RoleId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateRole', '/teams/:teamId/roles/:roleId', {
      success: RoleDetail,
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        RoleNotFound.pipe(HttpApiSchema.status(404)),
        CannotModifyBuiltIn.pipe(HttpApiSchema.status(400)),
        RoleNameAlreadyTaken.pipe(HttpApiSchema.status(409)),
      ],
      payload: UpdateRoleRequest,
      params: { teamId: TeamId, roleId: RoleId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.delete('deleteRole', '/teams/:teamId/roles/:roleId', {
      success: Schema.Void.pipe(HttpApiSchema.status(204)),
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        RoleNotFound.pipe(HttpApiSchema.status(404)),
        CannotModifyBuiltIn.pipe(HttpApiSchema.status(400)),
        RoleInUse.pipe(HttpApiSchema.status(409)),
      ],
      params: { teamId: TeamId, roleId: RoleId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('assignRole', '/teams/:teamId/members/:memberId/roles', {
      success: Schema.Void.pipe(HttpApiSchema.status(204)),
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        MemberNotFound.pipe(HttpApiSchema.status(404)),
        RoleNotFound.pipe(HttpApiSchema.status(404)),
      ],
      payload: AssignRoleRequest,
      params: { teamId: TeamId, memberId: TeamMemberId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.delete('unassignRole', '/teams/:teamId/members/:memberId/roles/:roleId', {
      success: Schema.Void.pipe(HttpApiSchema.status(204)),
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        MemberNotFound.pipe(HttpApiSchema.status(404)),
        RoleNotFound.pipe(HttpApiSchema.status(404)),
      ],
      params: { teamId: TeamId, memberId: TeamMemberId, roleId: RoleId },
    }).middleware(AuthMiddleware),
  ) {}
