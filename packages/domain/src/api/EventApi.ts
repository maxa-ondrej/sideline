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

// IPv4 private/loopback ranges (matches after URL normalisation)
const PRIVATE_IPV4_PATTERN =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0)/i;

// IPv6 reserved ranges (tested against the de-bracketed hostname)
// Covers: loopback (::1), unspecified (::), unique-local (fc00::/7 = fc.. or fd..),
// link-local (fe80::/10 = fe8x, fe9x, feax, febx), and IPv4-mapped (::ffff:)
const PRIVATE_IPV6_PATTERN = /^(::1$|::$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe[89ab][0-9a-f]:|::ffff:)/i;

const isValidEventImageUrl = (value: string): boolean | string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Image URL must be a valid URL';
  }
  if (url.protocol !== 'https:')
    return 'Image URL must use https:// protocol (http://, data:, javascript:, etc. are not allowed)';

  // url.hostname for an IPv6 literal includes brackets, e.g. "[::1]" — strip them
  const hostname = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;

  if (PRIVATE_IPV4_PATTERN.test(hostname))
    return 'Image URL must point to a public host (loopback and private network addresses are not allowed)';

  if (PRIVATE_IPV6_PATTERN.test(hostname))
    return 'Image URL must point to a public host (loopback and private network addresses are not allowed)';

  return true;
};

export const EventImageUrl = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(2048)),
  Schema.check(Schema.makeFilter<string>(isValidEventImageUrl)),
);
export type EventImageUrl = typeof EventImageUrl.Type;

export class EventInfo extends Schema.Class<EventInfo>('EventInfo')({
  eventId: EventId,
  teamId: TeamId,
  title: Schema.String,
  eventType: EventType,
  trainingTypeName: Schema.OptionFromNullOr(Schema.String),
  description: Schema.OptionFromNullOr(Schema.String),
  imageUrl: Schema.OptionFromNullOr(Schema.String),
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
  imageUrl: Schema.OptionFromNullOr(Schema.String),
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

export const CreateEventRequest = Schema.Struct({
  title: Schema.NonEmptyString,
  eventType: EventType,
  trainingTypeId: Schema.OptionFromNullOr(TrainingTypeId),
  description: Schema.OptionFromNullOr(Schema.String),
  imageUrl: Schema.OptionFromOptionalNullOr(EventImageUrl),
  startAt: Schemas.DateTimeFromIsoString,
  endAt: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  location: Schema.OptionFromNullOr(Schema.String),
  discordChannelId: Schema.OptionFromNullOr(Snowflake),
  ownerGroupId: Schema.OptionFromNullOr(GroupId),
  memberGroupId: Schema.OptionFromNullOr(GroupId),
});
export type CreateEventRequest = Schema.Schema.Type<typeof CreateEventRequest>;

export const UpdateEventRequest = Schema.Struct({
  title: Schema.OptionFromOptional(Schema.NonEmptyString),
  eventType: Schema.OptionFromOptional(EventType),
  trainingTypeId: Schema.OptionFromOptional(Schema.OptionFromNullOr(TrainingTypeId)),
  description: Schema.OptionFromOptional(Schema.OptionFromNullOr(Schema.String)),
  imageUrl: Schema.OptionFromOptional(Schema.OptionFromNullOr(EventImageUrl)),
  startAt: Schema.OptionFromOptional(Schemas.DateTimeFromIsoString),
  endAt: Schema.OptionFromOptional(Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString)),
  location: Schema.OptionFromOptional(Schema.OptionFromNullOr(Schema.String)),
  discordChannelId: Schema.OptionFromOptional(Schema.OptionFromNullOr(Snowflake)),
  ownerGroupId: Schema.OptionFromOptional(Schema.OptionFromNullOr(GroupId)),
  memberGroupId: Schema.OptionFromOptional(Schema.OptionFromNullOr(GroupId)),
});
export type UpdateEventRequest = Schema.Schema.Type<typeof UpdateEventRequest>;

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
