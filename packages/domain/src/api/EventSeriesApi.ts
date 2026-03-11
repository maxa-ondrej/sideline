import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import * as Schemas from '@sideline/effect-lib/Schemas';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Forbidden } from '~/api/EventApi.js';
import { Snowflake } from '~/models/Discord.js';
import {
  DaysOfWeek,
  EventSeriesId,
  EventSeriesStatus,
  RecurrenceFrequency,
} from '~/models/EventSeries.js';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';
import { TrainingTypeId } from '~/models/TrainingType.js';

export class EventSeriesInfo extends Schema.Class<EventSeriesInfo>('EventSeriesInfo')({
  seriesId: EventSeriesId,
  teamId: TeamId,
  title: Schema.String,
  frequency: RecurrenceFrequency,
  daysOfWeek: DaysOfWeek,
  startDate: Schemas.DateTimeFromIsoString,
  endDate: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  status: EventSeriesStatus,
  trainingTypeId: Schema.OptionFromNullOr(TrainingTypeId),
  trainingTypeName: Schema.OptionFromNullOr(Schema.String),
  startTime: Schema.String,
  endTime: Schema.OptionFromNullOr(Schema.String),
  location: Schema.OptionFromNullOr(Schema.String),
  discordChannelId: Schema.OptionFromNullOr(Snowflake),
  ownerGroupId: Schema.OptionFromNullOr(GroupId),
  ownerGroupName: Schema.OptionFromNullOr(Schema.String),
  memberGroupId: Schema.OptionFromNullOr(GroupId),
  memberGroupName: Schema.OptionFromNullOr(Schema.String),
}) {}

export class EventSeriesDetail extends Schema.Class<EventSeriesDetail>('EventSeriesDetail')({
  seriesId: EventSeriesId,
  teamId: TeamId,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  frequency: RecurrenceFrequency,
  daysOfWeek: DaysOfWeek,
  startDate: Schemas.DateTimeFromIsoString,
  endDate: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  status: EventSeriesStatus,
  trainingTypeId: Schema.OptionFromNullOr(TrainingTypeId),
  trainingTypeName: Schema.OptionFromNullOr(Schema.String),
  startTime: Schema.String,
  endTime: Schema.OptionFromNullOr(Schema.String),
  location: Schema.OptionFromNullOr(Schema.String),
  discordChannelId: Schema.OptionFromNullOr(Snowflake),
  ownerGroupId: Schema.OptionFromNullOr(GroupId),
  ownerGroupName: Schema.OptionFromNullOr(Schema.String),
  memberGroupId: Schema.OptionFromNullOr(GroupId),
  memberGroupName: Schema.OptionFromNullOr(Schema.String),
  canEdit: Schema.Boolean,
  canCancel: Schema.Boolean,
}) {}

export class CreateEventSeriesRequest extends Schema.Class<CreateEventSeriesRequest>(
  'CreateEventSeriesRequest',
)({
  title: Schema.NonEmptyString,
  trainingTypeId: Schema.OptionFromNullOr(TrainingTypeId),
  description: Schema.OptionFromNullOr(Schema.String),
  frequency: RecurrenceFrequency,
  daysOfWeek: DaysOfWeek,
  startDate: Schemas.DateTimeFromIsoString,
  endDate: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  startTime: Schema.String,
  endTime: Schema.OptionFromNullOr(Schema.String),
  location: Schema.OptionFromNullOr(Schema.String),
  discordChannelId: Schema.OptionFromNullOr(Snowflake),
  ownerGroupId: Schema.OptionFromNullOr(GroupId),
  memberGroupId: Schema.OptionFromNullOr(GroupId),
}) {}

export class UpdateEventSeriesRequest extends Schema.Class<UpdateEventSeriesRequest>(
  'UpdateEventSeriesRequest',
)({
  title: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  trainingTypeId: Schema.optionalWith(Schema.OptionFromNullOr(TrainingTypeId), { as: 'Option' }),
  description: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), { as: 'Option' }),
  daysOfWeek: Schema.optionalWith(DaysOfWeek, { as: 'Option' }),
  startTime: Schema.optionalWith(Schema.String, { as: 'Option' }),
  endTime: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), { as: 'Option' }),
  location: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), { as: 'Option' }),
  endDate: Schema.optionalWith(Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString), {
    as: 'Option',
  }),
  discordChannelId: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), { as: 'Option' }),
  ownerGroupId: Schema.optionalWith(Schema.OptionFromNullOr(GroupId), { as: 'Option' }),
  memberGroupId: Schema.optionalWith(Schema.OptionFromNullOr(GroupId), { as: 'Option' }),
}) {}

export class EventSeriesNotFound extends Schema.TaggedError<EventSeriesNotFound>()(
  'EventSeriesNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class EventSeriesCancelled extends Schema.TaggedError<EventSeriesCancelled>()(
  'EventSeriesCancelled',
  {},
  HttpApiSchema.annotations({ status: 400 }),
) {}

export class EventSeriesApiGroup extends HttpApiGroup.make('eventSeries')
  .add(
    HttpApiEndpoint.post('createEventSeries', '/teams/:teamId/event-series')
      .addSuccess(EventSeriesInfo, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(CreateEventSeriesRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('listEventSeries', '/teams/:teamId/event-series')
      .addSuccess(Schema.Array(EventSeriesInfo))
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getEventSeries', '/teams/:teamId/event-series/:seriesId')
      .addSuccess(EventSeriesDetail)
      .addError(Forbidden, { status: 403 })
      .addError(EventSeriesNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, seriesId: EventSeriesId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateEventSeries', '/teams/:teamId/event-series/:seriesId')
      .addSuccess(EventSeriesDetail)
      .addError(Forbidden, { status: 403 })
      .addError(EventSeriesNotFound, { status: 404 })
      .addError(EventSeriesCancelled, { status: 400 })
      .setPath(Schema.Struct({ teamId: TeamId, seriesId: EventSeriesId }))
      .setPayload(UpdateEventSeriesRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('cancelEventSeries', '/teams/:teamId/event-series/:seriesId/cancel')
      .addSuccess(Schema.Void, { status: 204 })
      .addError(Forbidden, { status: 403 })
      .addError(EventSeriesNotFound, { status: 404 })
      .addError(EventSeriesCancelled, { status: 400 })
      .setPath(Schema.Struct({ teamId: TeamId, seriesId: EventSeriesId }))
      .middleware(AuthMiddleware),
  ) {}
