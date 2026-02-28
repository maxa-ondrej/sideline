import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { AgeThresholdRuleId } from '~/models/AgeThresholdRule.js';
import { RoleId } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class AgeThresholdInfo extends Schema.Class<AgeThresholdInfo>('AgeThresholdInfo')({
  ruleId: AgeThresholdRuleId,
  teamId: TeamId,
  roleId: RoleId,
  roleName: Schema.String,
  minAge: Schema.OptionFromNullOr(Schema.Number),
  maxAge: Schema.OptionFromNullOr(Schema.Number),
}) {}

export class AgeRoleChange extends Schema.Class<AgeRoleChange>('AgeRoleChange')({
  memberId: TeamMemberId,
  memberName: Schema.String,
  roleId: RoleId,
  roleName: Schema.String,
  action: Schema.Literal('assigned', 'removed'),
}) {}

export class CreateAgeThresholdRequest extends Schema.Class<CreateAgeThresholdRequest>(
  'CreateAgeThresholdRequest',
)({
  roleId: RoleId,
  minAge: Schema.OptionFromNullOr(Schema.Number),
  maxAge: Schema.OptionFromNullOr(Schema.Number),
}) {}

export class UpdateAgeThresholdRequest extends Schema.Class<UpdateAgeThresholdRequest>(
  'UpdateAgeThresholdRequest',
)({
  minAge: Schema.OptionFromNullOr(Schema.Number),
  maxAge: Schema.OptionFromNullOr(Schema.Number),
}) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'AgeThresholdForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class RuleNotFound extends Schema.TaggedError<RuleNotFound>()(
  'AgeThresholdRuleNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class RoleNotFound extends Schema.TaggedError<RoleNotFound>()(
  'AgeThresholdRoleNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
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
      .addError(RoleNotFound, { status: 404 })
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
    HttpApiEndpoint.del('deleteAgeThreshold', '/teams/:teamId/age-thresholds/:ruleId')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(RuleNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, ruleId: AgeThresholdRuleId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('evaluateAgeThresholds', '/teams/:teamId/age-thresholds/evaluate')
      .addSuccess(Schema.Array(AgeRoleChange))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  ) {}
