import * as Schemas from '@sideline/effect-lib/Schemas';
import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { Snowflake } from '~/models/Discord.js';
import { EventId, EventStatus, EventType } from '~/models/Event.js';
import { EventSeriesId } from '~/models/EventSeries.js';
import { GroupId } from '~/models/GroupModel.js';
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
  ownerGroupId: Schema.OptionFromNullOr(GroupId),
  ownerGroupName: Schema.OptionFromNullOr(Schema.String),
  memberGroupId: Schema.OptionFromNullOr(GroupId),
  memberGroupName: Schema.OptionFromNullOr(Schema.String),
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
  ownerGroupId: Schema.OptionFromNullOr(GroupId),
  memberGroupId: Schema.OptionFromNullOr(GroupId),
}) {}

export class UpdateEventRequest extends Schema.Class<UpdateEventRequest>('UpdateEventRequest')({
  title: Schema.OptionFromOptional(Schema.NonEmptyString),
  eventType: Schema.OptionFromOptional(EventType),
  trainingTypeId: Schema.OptionFromOptional(Schema.OptionFromNullOr(TrainingTypeId)),
  description: Schema.OptionFromOptional(Schema.OptionFromNullOr(Schema.String)),
  startAt: Schema.OptionFromOptional(Schemas.DateTimeFromIsoString),
  endAt: Schema.OptionFromOptional(Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString)),
  location: Schema.OptionFromOptional(Schema.OptionFromNullOr(Schema.String)),
  discordChannelId: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  ownerGroupId: Schema.OptionFromOptional(Schema.OptionFromNullOr(GroupId)),
  memberGroupId: Schema.OptionFromOptional(Schema.OptionFromNullOr(GroupId)),
}) {}

export class EventNotFound extends Schema.TaggedErrorClass<EventNotFound>()('EventNotFound', {}) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()('EventForbidden', {}) {}

export class EventCancelled extends Schema.TaggedErrorClass<EventCancelled>()(
  'EventCancelled',
  {},
) {}

export class EventNotActive extends Schema.TaggedErrorClass<EventNotActive>()(
  'EventNotActive',
  {},
) {}

export class EventApiGroup extends HttpApiGroup.make('event')
  .add(
    HttpApiEndpoint.get('listEvents', '/teams/:teamId/events', {
      success: EventListResponse,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createEvent', '/teams/:teamId/events', {
      success: EventInfo.pipe(HttpApiSchema.status(201)),
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      payload: CreateEventRequest,
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getEvent', '/teams/:teamId/events/:eventId', {
      success: EventDetail,
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        EventNotFound.pipe(HttpApiSchema.status(404)),
      ],
      params: { teamId: TeamId, eventId: EventId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('updateEvent', '/teams/:teamId/events/:eventId', {
      success: EventDetail,
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        EventNotFound.pipe(HttpApiSchema.status(404)),
        EventNotActive.pipe(HttpApiSchema.status(400)),
      ],
      payload: UpdateEventRequest,
      params: { teamId: TeamId, eventId: EventId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('cancelEvent', '/teams/:teamId/events/:eventId/cancel', {
      success: Schema.Void.pipe(HttpApiSchema.status(204)),
      error: [
        Forbidden.pipe(HttpApiSchema.status(403)),
        EventNotFound.pipe(HttpApiSchema.status(404)),
        EventNotActive.pipe(HttpApiSchema.status(400)),
      ],
      params: { teamId: TeamId, eventId: EventId },
    }).middleware(AuthMiddleware),
  ) {}
