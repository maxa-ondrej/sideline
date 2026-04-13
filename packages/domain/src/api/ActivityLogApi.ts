import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { ActivityLogId, ActivitySource } from '~/models/ActivityLog.js';
import { ActivityTypeId } from '~/models/ActivityType.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class ActivityLogEntry extends Schema.Class<ActivityLogEntry>('ActivityLogEntry')({
  id: ActivityLogId,
  activityTypeId: ActivityTypeId,
  activityTypeName: Schema.String,
  loggedAt: Schema.String,
  durationMinutes: Schema.OptionFromNullOr(Schema.Int),
  note: Schema.OptionFromNullOr(Schema.String),
  source: ActivitySource,
}) {}

export class ActivityLogListResponse extends Schema.Class<ActivityLogListResponse>(
  'ActivityLogListResponse',
)({
  logs: Schema.Array(ActivityLogEntry),
}) {}

export class CreateActivityLogRequest extends Schema.Class<CreateActivityLogRequest>(
  'CreateActivityLogRequest',
)({
  activityTypeId: ActivityTypeId,
  durationMinutes: Schema.OptionFromNullOr(
    Schema.Int.pipe(Schema.isBetween({ minimum: 1, maximum: 1440 })),
  ),
  note: Schema.OptionFromNullOr(Schema.String),
}) {}

export class UpdateActivityLogRequest extends Schema.Class<UpdateActivityLogRequest>(
  'UpdateActivityLogRequest',
)({
  activityTypeId: Schema.OptionFromOptional(ActivityTypeId),
  durationMinutes: Schema.OptionFromOptional(
    Schema.OptionFromNullOr(Schema.Int.pipe(Schema.isBetween({ minimum: 1, maximum: 1440 }))),
  ),
  note: Schema.OptionFromOptional(Schema.OptionFromNullOr(Schema.String)),
}) {}

export class ActivityTypeEntry extends Schema.Class<ActivityTypeEntry>('ActivityTypeEntry')({
  id: ActivityTypeId,
  name: Schema.String,
  slug: Schema.OptionFromNullOr(Schema.String),
}) {}

export class ActivityTypeListResponse extends Schema.Class<ActivityTypeListResponse>(
  'ActivityTypeListResponse',
)({
  activityTypes: Schema.Array(ActivityTypeEntry),
}) {}

export class MemberNotFound extends Schema.TaggedErrorClass<MemberNotFound>()(
  'ActivityLogMemberNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
  'ActivityLogForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class LogNotFound extends Schema.TaggedErrorClass<LogNotFound>()(
  'ActivityLogNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class MemberInactive extends Schema.TaggedErrorClass<MemberInactive>()(
  'ActivityLogMemberInactive',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class AutoSourceForbidden extends Schema.TaggedErrorClass<AutoSourceForbidden>()(
  'ActivityLogAutoSourceForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class ActivityLogApiGroup extends HttpApiGroup.make('activityLog')
  .add(
    HttpApiEndpoint.get('listLogs', '/teams/:teamId/members/:memberId/activity-logs', {
      success: ActivityLogListResponse,
      error: [
        MemberNotFound.pipe(HttpApiSchema.status(404)),
        Forbidden.pipe(HttpApiSchema.status(403)),
      ],
      params: { teamId: TeamId, memberId: TeamMemberId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createLog', '/teams/:teamId/members/:memberId/activity-logs', {
      success: ActivityLogEntry.pipe(HttpApiSchema.status(201)),
      error: [
        MemberNotFound.pipe(HttpApiSchema.status(404)),
        Forbidden.pipe(HttpApiSchema.status(403)),
        MemberInactive.pipe(HttpApiSchema.status(403)),
      ],
      payload: CreateActivityLogRequest,
      params: { teamId: TeamId, memberId: TeamMemberId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateLog', '/teams/:teamId/members/:memberId/activity-logs/:logId', {
      success: ActivityLogEntry,
      error: [
        LogNotFound.pipe(HttpApiSchema.status(404)),
        Forbidden.pipe(HttpApiSchema.status(403)),
        MemberInactive.pipe(HttpApiSchema.status(403)),
        AutoSourceForbidden.pipe(HttpApiSchema.status(403)),
      ],
      payload: UpdateActivityLogRequest,
      params: { teamId: TeamId, memberId: TeamMemberId, logId: ActivityLogId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post(
      'deleteLog',
      '/teams/:teamId/members/:memberId/activity-logs/:logId/delete',
      {
        success: Schema.Void.pipe(HttpApiSchema.status(204)),
        error: [
          LogNotFound.pipe(HttpApiSchema.status(404)),
          Forbidden.pipe(HttpApiSchema.status(403)),
          MemberInactive.pipe(HttpApiSchema.status(403)),
          AutoSourceForbidden.pipe(HttpApiSchema.status(403)),
        ],
        params: { teamId: TeamId, memberId: TeamMemberId, logId: ActivityLogId },
      },
    ).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('listActivityTypes', '/teams/:teamId/activity-types', {
      success: ActivityTypeListResponse,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  ) {}
