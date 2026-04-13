import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { Snowflake } from '~/models/Discord.js';
import { GroupId } from '~/models/GroupModel.js';
import { RoleId } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export const HexColor = Schema.String.pipe(Schema.isPattern(/^#[0-9a-fA-F]{6}$/));

export class GroupInfo extends Schema.Class<GroupInfo>('GroupInfo')({
  groupId: GroupId,
  teamId: TeamId,
  parentId: Schema.OptionFromNullOr(GroupId),
  name: Schema.String,
  emoji: Schema.OptionFromNullOr(Schema.String),
  color: Schema.OptionFromNullOr(HexColor),
  memberCount: Schema.Number,
  discordChannelProvisioning: Schema.Boolean,
}) {}

export class GroupDetail extends Schema.Class<GroupDetail>('GroupDetail')({
  groupId: GroupId,
  teamId: TeamId,
  parentId: Schema.OptionFromNullOr(GroupId),
  name: Schema.String,
  emoji: Schema.OptionFromNullOr(Schema.String),
  color: Schema.OptionFromNullOr(HexColor),
  roles: Schema.Array(
    Schema.Struct({
      roleId: RoleId,
      roleName: Schema.String,
    }),
  ),
  members: Schema.Array(
    Schema.Struct({
      memberId: TeamMemberId,
      name: Schema.OptionFromNullOr(Schema.String),
      username: Schema.String,
    }),
  ),
  discordChannelProvisioning: Schema.Boolean,
}) {}

export class CreateGroupRequest extends Schema.Class<CreateGroupRequest>('CreateGroupRequest')({
  name: Schema.NonEmptyString,
  parentId: Schema.OptionFromNullOr(GroupId),
  emoji: Schema.OptionFromNullOr(Schema.String),
  color: Schema.OptionFromNullOr(HexColor),
}) {}

export class UpdateGroupRequest extends Schema.Class<UpdateGroupRequest>('UpdateGroupRequest')({
  name: Schema.NonEmptyString,
  emoji: Schema.OptionFromNullOr(Schema.String),
  color: Schema.OptionFromNullOr(HexColor),
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
  parentId: Schema.OptionFromNullOr(GroupId),
}) {}

export class ChannelMappingInfo extends Schema.Class<ChannelMappingInfo>('ChannelMappingInfo')({
  discordChannelId: Snowflake,
  discordChannelName: Schema.OptionFromNullOr(Schema.String),
  discordRoleId: Schema.OptionFromNullOr(Snowflake),
}) {}

export class SetChannelMappingRequest extends Schema.Class<SetChannelMappingRequest>(
  'SetChannelMappingRequest',
)({
  discordChannelId: Snowflake,
}) {}

export class DiscordChannelInfo extends Schema.Class<DiscordChannelInfo>('DiscordChannelInfo')({
  id: Snowflake,
  name: Schema.String,
  type: Schema.Number,
  parentId: Schema.OptionFromNullOr(Snowflake),
}) {}

export class GroupNotFound extends Schema.TaggedErrorClass<GroupNotFound>()(
  'GroupNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
  'GroupForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class MemberNotFound extends Schema.TaggedErrorClass<MemberNotFound>()(
  'GroupMemberNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class GroupNameAlreadyTaken extends Schema.TaggedErrorClass<GroupNameAlreadyTaken>()(
  'GroupNameAlreadyTaken',
  {},
  HttpApiSchema.annotations({ status: 409 }),
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
      .addError(GroupNameAlreadyTaken, { status: 409 })
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
      .addError(GroupNameAlreadyTaken, { status: 409 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .setPayload(UpdateGroupRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.delete('deleteGroup', '/teams/:teamId/groups/:groupId')
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
    HttpApiEndpoint.delete('removeGroupMember', '/teams/:teamId/groups/:groupId/members/:memberId')
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
    HttpApiEndpoint.delete('unassignGroupRole', '/teams/:teamId/groups/:groupId/roles/:roleId')
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
      .addSuccess(Schema.OptionFromNullOr(ChannelMappingInfo))
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
    HttpApiEndpoint.delete('deleteChannelMapping', '/teams/:teamId/groups/:groupId/channel-mapping')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createChannel', '/teams/:teamId/groups/:groupId/create-channel')
      .addSuccess(Schema.Void, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, groupId: GroupId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('listDiscordChannels', '/teams/:teamId/discord-channels')
      .addSuccess(Schema.Array(DiscordChannelInfo))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  ) {}
