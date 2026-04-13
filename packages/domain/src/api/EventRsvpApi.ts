import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { EventId } from '~/models/Event.js';
import { RsvpResponse } from '~/models/EventRsvp.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class RsvpEntry extends Schema.Class<RsvpEntry>('RsvpEntry')({
  teamMemberId: TeamMemberId,
  memberName: Schema.OptionFromNullOr(Schema.String),
  username: Schema.OptionFromNullOr(Schema.String),
  response: RsvpResponse,
  message: Schema.OptionFromNullOr(Schema.String),
}) {}

export class EventRsvpDetail extends Schema.Class<EventRsvpDetail>('EventRsvpDetail')({
  myResponse: Schema.OptionFromNullOr(RsvpResponse),
  myMessage: Schema.OptionFromNullOr(Schema.String),
  rsvps: Schema.Array(RsvpEntry),
  yesCount: Schema.Number,
  noCount: Schema.Number,
  maybeCount: Schema.Number,
  canRsvp: Schema.Boolean,
  minPlayersThreshold: Schema.Number,
}) {}

export class SubmitRsvpRequest extends Schema.Class<SubmitRsvpRequest>('SubmitRsvpRequest')({
  response: RsvpResponse,
  message: Schema.OptionFromNullOr(Schema.String),
}) {}

export class EventNotFound extends Schema.TaggedErrorClass<EventNotFound>()(
  'EventRsvpEventNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
  'EventRsvpForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class RsvpDeadlinePassed extends Schema.TaggedErrorClass<RsvpDeadlinePassed>()(
  'RsvpDeadlinePassed',
  {},
  HttpApiSchema.annotations({ status: 400 }),
) {}

export class NonResponderEntry extends Schema.Class<NonResponderEntry>('NonResponderEntry')({
  teamMemberId: TeamMemberId,
  memberName: Schema.OptionFromNullOr(Schema.String),
  username: Schema.OptionFromNullOr(Schema.String),
}) {}

export class NonRespondersResponse extends Schema.Class<NonRespondersResponse>(
  'NonRespondersResponse',
)({
  nonResponders: Schema.Array(NonResponderEntry),
}) {}

export class EventRsvpApiGroup extends HttpApiGroup.make('eventRsvp')
  .add(
    HttpApiEndpoint.get('getRsvps', '/teams/:teamId/events/:eventId/rsvps')
      .addSuccess(EventRsvpDetail)
      .addError(Forbidden, { status: 403 })
      .addError(EventNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, eventId: EventId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.put('submitRsvp', '/teams/:teamId/events/:eventId/rsvp')
      .addSuccess(Schema.Void, { status: 204 })
      .addError(Forbidden, { status: 403 })
      .addError(EventNotFound, { status: 404 })
      .addError(RsvpDeadlinePassed, { status: 400 })
      .setPath(Schema.Struct({ teamId: TeamId, eventId: EventId }))
      .setPayload(SubmitRsvpRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getNonResponders', '/teams/:teamId/events/:eventId/rsvps/non-responders')
      .addSuccess(NonRespondersResponse)
      .addError(Forbidden, { status: 403 })
      .addError(EventNotFound, { status: 404 })
      .setPath(Schema.Struct({ teamId: TeamId, eventId: EventId }))
      .middleware(AuthMiddleware),
  ) {}
