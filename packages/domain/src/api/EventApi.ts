import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import * as Schemas from '@sideline/effect-lib/Schemas';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { Snowflake } from '~/models/Discord.js';
import { EventId, EventStatus, EventType } from '~/models/Event.js';
import { EventSeriesId } from '~/models/EventSeries.js';
import { TeamId } from '~/models/Team.js';
import { TrainingTypeId } from '~/models/TrainingType.js';

export class EventInfo extends Schema.Class<EventInfo>('EventInfo')({
  eventId: EventId,
  teamId: TeamId,
  title: Schema.String,
  eventType: EventType,
  trainingTypeName: Schema.OptionFromNullOr(Schema.String),
  startAt: Schemas.DateTimeFromIsoString,
  endAt: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  location: Schema.OptionFromNullOr(Schema.String),
  status: EventStatus,
  seriesId: Schema.OptionFromNullOr(EventSeriesId),
}) {}

export class EventDetail extends Schema.Class<EventDetail>('EventDetail')({
  eventId: EventId,
  teamId: TeamId,
  title: Schema.String,
  eventType: EventType,
  trainingTypeId: Schema.OptionFromNullOr(TrainingTypeId),
  trainingTypeName: Schema.OptionFromNullOr(Schema.String),
  description: Schema.OptionFromNullOr(Schema.String),
  startAt: Schemas.DateTimeFromIsoString,
  endAt: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  location: Schema.OptionFromNullOr(Schema.String),
  status: EventStatus,
  createdByName: Schema.OptionFromNullOr(Schema.String),
  canEdit: Schema.Boolean,
  canCancel: Schema.Boolean,
  seriesId: Schema.OptionFromNullOr(EventSeriesId),
  seriesModified: Schema.Boolean,
  discordChannelId: Schema.OptionFromNullOr(Snowflake),
}) {}

export class EventListResponse extends Schema.Class<EventListResponse>('EventListResponse')({
  canCreate: Schema.Boolean,
  events: Schema.Array(EventInfo),
}) {}

export class CreateEventRequest extends Schema.Class<CreateEventRequest>('CreateEventRequest')({
  title: Schema.NonEmptyString,
  eventType: EventType,
  trainingTypeId: Schema.OptionFromNullOr(TrainingTypeId),
  description: Schema.OptionFromNullOr(Schema.String),
  startAt: Schemas.DateTimeFromIsoString,
  endAt: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  location: Schema.OptionFromNullOr(Schema.String),
  discordChannelId: Schema.OptionFromNullOr(Snowflake),
}) {}

export class UpdateEventRequest extends Schema.Class<UpdateEventRequest>('UpdateEventRequest')({
  title: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  eventType: Schema.optionalWith(EventType, { as: 'Option' }),
  trainingTypeId: Schema.optionalWith(Schema.OptionFromNullOr(TrainingTypeId), { as: 'Option' }),
  description: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), { as: 'Option' }),
  startAt: Schema.optionalWith(Schemas.DateTimeFromIsoString, { as: 'Option' }),
  endAt: Schema.optionalWith(Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString), {
    as: 'Option',
  }),
  location: Schema.optionalWith(Schema.OptionFromNullOr(Schema.String), { as: 'Option' }),
  discordChannelId: Schema.optionalWith(Schema.OptionFromNullOr(Snowflake), { as: 'Option' }),
}) {}

export class EventNotFound extends Schema.TaggedError<EventNotFound>()(
  'EventNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'EventForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class EventCancelled extends Schema.TaggedError<EventCancelled>()(
  'EventCancelled',
  {},
  HttpApiSchema.annotations({ status: 400 }),
) {}

export class EventApiGroup extends HttpApiGroup.make('event')
  .add(
    HttpApiEndpoint.get('listEvents', '/teams/:teamId/events')
      .addSuccess(EventListResponse)
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createEvent', '/teams/:teamId/events')
      .addSuccess(EventInfo, { status: 201 })
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .setPayload(CreateEventRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getEvent', '/teams/:teamId/events/:eventId')
      .addSuccess(EventDetail)
      .addError(Forbidden, { status: 403 })
      .addError(EventNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, eventId: EventId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateEvent', '/teams/:teamId/events/:eventId')
      .addSuccess(EventDetail)
      .addError(Forbidden, { status: 403 })
      .addError(EventNotFound, { status: 404 })
      .addError(EventCancelled, { status: 400 })
      .setPath(Schema.Struct({ teamId: TeamId, eventId: EventId }))
      .setPayload(UpdateEventRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('cancelEvent', '/teams/:teamId/events/:eventId/cancel')
      .addSuccess(Schema.Void, { status: 204 })
      .addError(Forbidden, { status: 403 })
      .addError(EventNotFound, { status: 404 })
      .addError(EventCancelled, { status: 400 })
      .setPath(Schema.Struct({ teamId: TeamId, eventId: EventId }))
      .middleware(AuthMiddleware),
  ) {}
