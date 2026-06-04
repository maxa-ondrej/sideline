import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';
import { TeamChannelId } from '~/models/TeamChannel.js';
import { AccessLevel } from '~/models/TeamChannelAccess.js';

export class ChannelAccessGrant extends Schema.Class<ChannelAccessGrant>('ChannelAccessGrant')({
  groupId: GroupId,
  accessLevel: AccessLevel,
}) {}

export class ChannelInfo extends Schema.Class<ChannelInfo>('ChannelInfo')({
  channelId: TeamChannelId,
  name: Schema.String,
  category: Schema.OptionFromNullOr(Schema.String),
  position: Schema.Number,
  archived: Schema.Boolean,
  discordChannelId: Schema.OptionFromNullOr(Schema.String),
  accessCount: Schema.Number,
}) {}

export class ChannelDetail extends Schema.Class<ChannelDetail>('ChannelDetail')({
  channelId: TeamChannelId,
  name: Schema.String,
  category: Schema.OptionFromNullOr(Schema.String),
  position: Schema.Number,
  archived: Schema.Boolean,
  discordChannelId: Schema.OptionFromNullOr(Schema.String),
  accessCount: Schema.Number,
  grants: Schema.Array(ChannelAccessGrant),
}) {}

export class ChannelListResponse extends Schema.Class<ChannelListResponse>('ChannelListResponse')({
  canManage: Schema.Boolean,
  guildLinked: Schema.Boolean,
  channels: Schema.Array(ChannelInfo),
}) {}

export const CreateChannelRequest = Schema.Struct({
  name: Schema.NonEmptyString,
  category: Schema.OptionFromNullOr(Schema.NonEmptyString),
});
export type CreateChannelRequest = Schema.Schema.Type<typeof CreateChannelRequest>;

export const RenameChannelRequest = Schema.Struct({
  name: Schema.NonEmptyString,
});
export type RenameChannelRequest = Schema.Schema.Type<typeof RenameChannelRequest>;

export const UpdateOrganizationRequest = Schema.Struct({
  category: Schema.OptionFromNullOr(Schema.String),
  position: Schema.Number,
});
export type UpdateOrganizationRequest = Schema.Schema.Type<typeof UpdateOrganizationRequest>;

export const SetChannelAccessRequest = Schema.Struct({
  grants: Schema.Array(ChannelAccessGrant),
});
export type SetChannelAccessRequest = Schema.Schema.Type<typeof SetChannelAccessRequest>;

export class ChannelForbidden extends Schema.TaggedErrorClass<ChannelForbidden>()(
  'ChannelForbidden',
  {},
) {}

export class ChannelNotFound extends Schema.TaggedErrorClass<ChannelNotFound>()(
  'ChannelNotFound',
  {},
) {}

export class ChannelNameAlreadyTaken extends Schema.TaggedErrorClass<ChannelNameAlreadyTaken>()(
  'ChannelNameAlreadyTaken',
  {},
) {}

export class ChannelApiGroup extends HttpApiGroup.make('channel')
  .add(
    HttpApiEndpoint.get('listChannels', '/teams/:teamId/channels', {
      success: ChannelListResponse,
      error: ChannelForbidden.pipe(HttpApiSchema.status(403)),
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createChannel', '/teams/:teamId/channels', {
      success: ChannelDetail.pipe(HttpApiSchema.status(201)),
      error: [
        ChannelForbidden.pipe(HttpApiSchema.status(403)),
        ChannelNameAlreadyTaken.pipe(HttpApiSchema.status(409)),
      ],
      payload: CreateChannelRequest,
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getChannel', '/teams/:teamId/channels/:channelId', {
      success: ChannelDetail,
      error: [
        ChannelForbidden.pipe(HttpApiSchema.status(403)),
        ChannelNotFound.pipe(HttpApiSchema.status(404)),
      ],
      params: { teamId: TeamId, channelId: TeamChannelId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('renameChannel', '/teams/:teamId/channels/:channelId/name', {
      success: ChannelDetail,
      error: [
        ChannelForbidden.pipe(HttpApiSchema.status(403)),
        ChannelNotFound.pipe(HttpApiSchema.status(404)),
        ChannelNameAlreadyTaken.pipe(HttpApiSchema.status(409)),
      ],
      payload: RenameChannelRequest,
      params: { teamId: TeamId, channelId: TeamChannelId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateOrganization', '/teams/:teamId/channels/:channelId/organization', {
      success: ChannelDetail,
      error: [
        ChannelForbidden.pipe(HttpApiSchema.status(403)),
        ChannelNotFound.pipe(HttpApiSchema.status(404)),
      ],
      payload: UpdateOrganizationRequest,
      params: { teamId: TeamId, channelId: TeamChannelId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('archiveChannel', '/teams/:teamId/channels/:channelId/archive', {
      success: Schema.Void.pipe(HttpApiSchema.status(204)),
      error: [
        ChannelForbidden.pipe(HttpApiSchema.status(403)),
        ChannelNotFound.pipe(HttpApiSchema.status(404)),
      ],
      params: { teamId: TeamId, channelId: TeamChannelId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.put('setAccess', '/teams/:teamId/channels/:channelId/access', {
      success: ChannelDetail,
      error: [
        ChannelForbidden.pipe(HttpApiSchema.status(403)),
        ChannelNotFound.pipe(HttpApiSchema.status(404)),
      ],
      payload: SetChannelAccessRequest,
      params: { teamId: TeamId, channelId: TeamChannelId },
    }).middleware(AuthMiddleware),
  ) {}
