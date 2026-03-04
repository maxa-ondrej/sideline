import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';
import { TrainingTypeId } from '~/models/TrainingType.js';

export class TrainingTypeInfo extends Schema.Class<TrainingTypeInfo>('TrainingTypeInfo')({
  trainingTypeId: TrainingTypeId,
  teamId: TeamId,
  name: Schema.String,
  groupName: Schema.NullOr(Schema.String),
}) {}

export class TrainingTypeDetail extends Schema.Class<TrainingTypeDetail>('TrainingTypeDetail')({
  trainingTypeId: TrainingTypeId,
  teamId: TeamId,
  name: Schema.String,
  groupId: Schema.NullOr(GroupId),
  groupName: Schema.NullOr(Schema.String),
  discordChannelId: Schema.NullOr(Schema.String),
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
  groupId: Schema.NullOr(GroupId),
  discordChannelId: Schema.NullOr(Schema.String),
}) {}

export class UpdateTrainingTypeRequest extends Schema.Class<UpdateTrainingTypeRequest>(
  'UpdateTrainingTypeRequest',
)({
  name: Schema.NonEmptyString,
  discordChannelId: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), { as: 'Option' }),
}) {}

export class TrainingTypeNotFound extends Schema.TaggedError<TrainingTypeNotFound>()(
  'TrainingTypeNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'TrainingTypeForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class TrainingTypeApiGroup extends HttpApiGroup.make('trainingType')
  .add(
    HttpApiEndpoint.get('listTrainingTypes', '/teams/:teamId/training-types')
      .addSuccess(TrainingTypeListResponse)
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createTrainingType', '/teams/:teamId/training-types')
      .addSuccess(TrainingTypeInfo, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(CreateTrainingTypeRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getTrainingType', '/teams/:teamId/training-types/:trainingTypeId')
      .addSuccess(TrainingTypeDetail)
      .addError(Forbidden, { status: 403 })
      .addError(TrainingTypeNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, trainingTypeId: TrainingTypeId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateTrainingType', '/teams/:teamId/training-types/:trainingTypeId')
      .addSuccess(TrainingTypeInfo)
      .addError(Forbidden, { status: 403 })
      .addError(TrainingTypeNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, trainingTypeId: TrainingTypeId }))
      .setPayload(UpdateTrainingTypeRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('deleteTrainingType', '/teams/:teamId/training-types/:trainingTypeId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(TrainingTypeNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, trainingTypeId: TrainingTypeId }))
      .middleware(AuthMiddleware),
  ) {}
