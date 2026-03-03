import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Snowflake } from '~/models/Discord.js';
import { GroupId } from '~/models/GroupModel.js';
import { RoleId } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class GroupInfo extends Schema.Class<GroupInfo>('GroupInfo')({
  groupId: GroupId,
  teamId: TeamId,
  parentId: Schema.NullOr(GroupId),
  name: Schema.String,
  emoji: Schema.NullOr(Schema.String),
  memberCount: Schema.Number,
}) {}

export class GroupDetail extends Schema.Class<GroupDetail>('GroupDetail')({
  groupId: GroupId,
  teamId: TeamId,
  parentId: Schema.NullOr(GroupId),
  name: Schema.String,
  emoji: Schema.NullOr(Schema.String),
  roles: Schema.Array(
    Schema.Struct({
      roleId: RoleId,
      roleName: Schema.String,
    }),
  ),
  members: Schema.Array(
    Schema.Struct({
      memberId: TeamMemberId,
      name: Schema.NullOr(Schema.String),
      discordUsername: Schema.String,
    }),
  ),
}) {}

export class CreateGroupRequest extends Schema.Class<CreateGroupRequest>('CreateGroupRequest')({
  name: Schema.NonEmptyString,
  parentId: Schema.NullOr(GroupId),
  emoji: Schema.NullOr(Schema.String),
}) {}

export class UpdateGroupRequest extends Schema.Class<UpdateGroupRequest>('UpdateGroupRequest')({
  name: Schema.NonEmptyString,
  emoji: Schema.NullOr(Schema.String),
}) {}

export class AddGroupMemberRequest extends Schema.Class<AddGroupMemberRequest>(
  'AddGroupMemberRequest',
)({
  memberId: TeamMemberId,
}) {}

export class AssignGroupRoleRequest extends Schema.Class<AssignGroupRoleRequest>(
  'AssignGroupRoleRequest',
)({
  roleId: RoleId,
}) {}

export class MoveGroupRequest extends Schema.Class<MoveGroupRequest>('MoveGroupRequest')({
  parentId: Schema.NullOr(GroupId),
}) {}

export class ChannelMappingInfo extends Schema.Class<ChannelMappingInfo>('ChannelMappingInfo')({
  discordChannelId: Snowflake,
  discordRoleId: Schema.NullOr(Snowflake),
}) {}

export class SetChannelMappingRequest extends Schema.Class<SetChannelMappingRequest>(
  'SetChannelMappingRequest',
)({
  discordChannelId: Snowflake,
}) {}

export class GroupNotFound extends Schema.TaggedError<GroupNotFound>()(
  'GroupNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'GroupForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  'GroupMemberNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class GroupApiGroup extends HttpApiGroup.make('group')
  .add(
    HttpApiEndpoint.get('listGroups', '/teams/:teamId/groups')
      .addSuccess(Schema.Array(GroupInfo))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createGroup', '/teams/:teamId/groups')
      .addSuccess(GroupInfo, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(CreateGroupRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getGroup', '/teams/:teamId/groups/:groupId')
      .addSuccess(GroupDetail)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateGroup', '/teams/:teamId/groups/:groupId')
      .addSuccess(GroupInfo)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .setPayload(UpdateGroupRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('deleteGroup', '/teams/:teamId/groups/:groupId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('addGroupMember', '/teams/:teamId/groups/:groupId/members')
      .addSuccess(Schema.Void, { status: 204 })
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .addError(MemberNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .setPayload(AddGroupMemberRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('removeGroupMember', '/teams/:teamId/groups/:groupId/members/:memberId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .addError(MemberNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId, memberId: TeamMemberId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('assignGroupRole', '/teams/:teamId/groups/:groupId/roles')
      .addSuccess(Schema.Void, { status: 204 })
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .setPayload(AssignGroupRoleRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('unassignGroupRole', '/teams/:teamId/groups/:groupId/roles/:roleId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId, roleId: RoleId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('moveGroup', '/teams/:teamId/groups/:groupId/parent')
      .addSuccess(GroupInfo)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .setPayload(MoveGroupRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getChannelMapping', '/teams/:teamId/groups/:groupId/channel-mapping')
      .addSuccess(Schema.NullOr(ChannelMappingInfo))
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.put('setChannelMapping', '/teams/:teamId/groups/:groupId/channel-mapping')
      .addSuccess(ChannelMappingInfo)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .setPayload(SetChannelMappingRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('deleteChannelMapping', '/teams/:teamId/groups/:groupId/channel-mapping')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .middleware(AuthMiddleware),
  ) {}
