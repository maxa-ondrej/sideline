import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { Snowflake } from '~/models/Discord.js';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';
import { TrainingTypeId } from '~/models/TrainingType.js';

export class TrainingTypeInfo extends Schema.Class<TrainingTypeInfo>('TrainingTypeInfo')({
  trainingTypeId: TrainingTypeId,
  teamId: TeamId,
  name: Schema.String,
  ownerGroupName: Schema.OptionFromNullOr(Schema.String),
  memberGroupName: Schema.OptionFromNullOr(Schema.String),
}) {}

export class TrainingTypeDetail extends Schema.Class<TrainingTypeDetail>('TrainingTypeDetail')({
  trainingTypeId: TrainingTypeId,
  teamId: TeamId,
  name: Schema.String,
  ownerGroupId: Schema.OptionFromNullOr(GroupId),
  ownerGroupName: Schema.OptionFromNullOr(Schema.String),
  memberGroupId: Schema.OptionFromNullOr(GroupId),
  memberGroupName: Schema.OptionFromNullOr(Schema.String),
  discordChannelId: Schema.OptionFromNullOr(Snowflake),
  canAdmin: Schema.Boolean,
}) {}

export class TrainingTypeListResponse extends Schema.Class<TrainingTypeListResponse>(
  'TrainingTypeListResponse',
)({
  canAdmin: Schema.Boolean,
  trainingTypes: Schema.Array(TrainingTypeInfo),
}) {}

export class CreateTrainingTypeRequest extends Schema.Class<CreateTrainingTypeRequest>(
  'CreateTrainingTypeRequest',
)({
  name: Schema.NonEmptyString,
  ownerGroupId: Schema.OptionFromNullOr(GroupId),
  memberGroupId: Schema.OptionFromNullOr(GroupId),
  discordChannelId: Schema.OptionFromNullOr(Snowflake),
}) {}

export class UpdateTrainingTypeRequest extends Schema.Class<UpdateTrainingTypeRequest>(
  'UpdateTrainingTypeRequest',
)({
  name: Schema.NonEmptyString,
  ownerGroupId: Schema.OptionFromOptional(Schema.OptionFromNullOr(GroupId)),
  memberGroupId: Schema.OptionFromOptional(Schema.OptionFromNullOr(GroupId)),
  discordChannelId: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
}) {}

export class TrainingTypeNotFound extends Schema.TaggedErrorClass<TrainingTypeNotFound>()(
  'TrainingTypeNotFound',
  {},
) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()('TrainingTypeForbidden', {}) {}

export class TrainingTypeNameAlreadyTaken extends Schema.TaggedErrorClass<TrainingTypeNameAlreadyTaken>()(
  'TrainingTypeNameAlreadyTaken',
  {},
) {}

export class TrainingTypeApiGroup extends HttpApiGroup.make('trainingType')
  .add(
    HttpApiEndpoint.get('listTrainingTypes', '/teams/:teamId/training-types', {
      success: TrainingTypeListResponse,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createTrainingType', '/teams/:teamId/training-types', {
      success: TrainingTypeInfo.pipe(HttpApiSchema.status(201)),
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        TrainingTypeNameAlreadyTaken.pipe(HttpApiSchema.status(409)),
      ],
      payload: CreateTrainingTypeRequest,
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getTrainingType', '/teams/:teamId/training-types/:trainingTypeId', {
      success: TrainingTypeDetail,
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        TrainingTypeNotFound.pipe(HttpApiSchema.status(404)),
      ],
      params: { teamId: TeamId, trainingTypeId: TrainingTypeId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateTrainingType', '/teams/:teamId/training-types/:trainingTypeId', {
      success: TrainingTypeInfo,
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        TrainingTypeNotFound.pipe(HttpApiSchema.status(404)),
        TrainingTypeNameAlreadyTaken.pipe(HttpApiSchema.status(409)),
      ],
      payload: UpdateTrainingTypeRequest,
      params: { teamId: TeamId, trainingTypeId: TrainingTypeId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.delete('deleteTrainingType', '/teams/:teamId/training-types/:trainingTypeId', {
      success: Schema.Void,
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        TrainingTypeNotFound.pipe(HttpApiSchema.status(404)),
      ],
      params: { teamId: TeamId, trainingTypeId: TrainingTypeId },
    }).middleware(AuthMiddleware),
  ) {}
