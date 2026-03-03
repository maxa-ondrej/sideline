import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { EventId, EventStatus, EventType } from '~/models/Event.js';
import { TeamId } from '~/models/Team.js';
import { TrainingTypeId } from '~/models/TrainingType.js';

export class EventInfo extends Schema.Class<EventInfo>('EventInfo')({
  eventId: EventId,
  teamId: TeamId,
  title: Schema.String,
  eventType: EventType,
  trainingTypeName: Schema.NullOr(Schema.String),
  eventDate: Schema.String,
  startTime: Schema.String,
  endTime: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  status: EventStatus,
}) {}

export class EventDetail extends Schema.Class<EventDetail>('EventDetail')({
  eventId: EventId,
  teamId: TeamId,
  title: Schema.String,
  eventType: EventType,
  trainingTypeId: Schema.NullOr(TrainingTypeId),
  trainingTypeName: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  eventDate: Schema.String,
  startTime: Schema.String,
  endTime: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  status: EventStatus,
  createdByName: Schema.NullOr(Schema.String),
  canEdit: Schema.Boolean,
  canCancel: Schema.Boolean,
}) {}

export class EventListResponse extends Schema.Class<EventListResponse>('EventListResponse')({
  canCreate: Schema.Boolean,
  events: Schema.Array(EventInfo),
}) {}

export class CreateEventRequest extends Schema.Class<CreateEventRequest>('CreateEventRequest')({
  title: Schema.NonEmptyString,
  eventType: EventType,
  trainingTypeId: Schema.NullOr(TrainingTypeId),
  description: Schema.NullOr(Schema.String),
  eventDate: Schema.String,
  startTime: Schema.String,
  endTime: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
}) {}

export class UpdateEventRequest extends Schema.Class<UpdateEventRequest>('UpdateEventRequest')({
  title: Schema.NullOr(Schema.NonEmptyString),
  eventType: Schema.NullOr(EventType),
  trainingTypeId: Schema.NullOr(TrainingTypeId),
  description: Schema.NullOr(Schema.String),
  eventDate: Schema.NullOr(Schema.String),
  startTime: Schema.NullOr(Schema.String),
  endTime: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
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
