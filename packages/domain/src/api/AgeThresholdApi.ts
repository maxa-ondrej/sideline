import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { AgeThresholdRuleId } from '~/models/AgeThresholdRule.js';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class AgeThresholdInfo extends Schema.Class<AgeThresholdInfo>('AgeThresholdInfo')({
  ruleId: AgeThresholdRuleId,
  teamId: TeamId,
  groupId: GroupId,
  groupName: Schema.String,
  minAge: Schema.OptionFromNullOr(Schema.Number),
  maxAge: Schema.OptionFromNullOr(Schema.Number),
}) {}

export class AgeGroupChange extends Schema.Class<AgeGroupChange>('AgeGroupChange')({
  memberId: TeamMemberId,
  memberName: Schema.String,
  groupId: GroupId,
  groupName: Schema.String,
  action: Schema.Literals(['added', 'removed']),
}) {}

export class CreateAgeThresholdRequest extends Schema.Class<CreateAgeThresholdRequest>(
  'CreateAgeThresholdRequest',
)({
  groupId: GroupId,
  minAge: Schema.OptionFromNullOr(Schema.Number),
  maxAge: Schema.OptionFromNullOr(Schema.Number),
}) {}

export class UpdateAgeThresholdRequest extends Schema.Class<UpdateAgeThresholdRequest>(
  'UpdateAgeThresholdRequest',
)({
  minAge: Schema.OptionFromNullOr(Schema.Number),
  maxAge: Schema.OptionFromNullOr(Schema.Number),
}) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
  'AgeThresholdForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class RuleNotFound extends Schema.TaggedErrorClass<RuleNotFound>()(
  'AgeThresholdRuleNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class GroupNotFound extends Schema.TaggedErrorClass<GroupNotFound>()(
  'AgeThresholdGroupNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class AgeThresholdAlreadyExists extends Schema.TaggedErrorClass<AgeThresholdAlreadyExists>()(
  'AgeThresholdAlreadyExists',
  {},
  HttpApiSchema.annotations({ status: 409 }),
) {}

export class AgeThresholdApiGroup extends HttpApiGroup.make('ageThreshold')
  .add(
    HttpApiEndpoint.get('listAgeThresholds', '/teams/:teamId/age-thresholds')
      .addSuccess(Schema.Array(AgeThresholdInfo))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createAgeThreshold', '/teams/:teamId/age-thresholds')
      .addSuccess(AgeThresholdInfo, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .addError(GroupNotFound, { status: 404 })
      .addError(AgeThresholdAlreadyExists, { status: 409 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(CreateAgeThresholdRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateAgeThreshold', '/teams/:teamId/age-thresholds/:ruleId')
      .addSuccess(AgeThresholdInfo)
      .addError(Forbidden, { status: 403 })
      .addError(RuleNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, ruleId: AgeThresholdRuleId }))
      .setPayload(UpdateAgeThresholdRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.delete('deleteAgeThreshold', '/teams/:teamId/age-thresholds/:ruleId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(RuleNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, ruleId: AgeThresholdRuleId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('evaluateAgeThresholds', '/teams/:teamId/age-thresholds/evaluate')
      .addSuccess(Schema.Array(AgeGroupChange))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  ) {}
