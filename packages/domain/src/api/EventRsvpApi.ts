import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { EventId } from '~/models/Event.js';
import { RsvpResponse } from '~/models/EventRsvp.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class RsvpEntry extends Schema.Class<RsvpEntry>('RsvpEntry')({
  teamMemberId: TeamMemberId,
  memberName: Schema.NullOr(Schema.String),
  username: Schema.NullOr(Schema.String),
  response: RsvpResponse,
  message: Schema.NullOr(Schema.String),
}) {}

export class EventRsvpDetail extends Schema.Class<EventRsvpDetail>('EventRsvpDetail')({
  myResponse: Schema.NullOr(RsvpResponse),
  myMessage: Schema.NullOr(Schema.String),
  rsvps: Schema.Array(RsvpEntry),
  yesCount: Schema.Number,
  noCount: Schema.Number,
  maybeCount: Schema.Number,
  canRsvp: Schema.Boolean,
}) {}

export class SubmitRsvpRequest extends Schema.Class<SubmitRsvpRequest>('SubmitRsvpRequest')({
  response: RsvpResponse,
  message: Schema.NullOr(Schema.String),
}) {}

export class EventNotFound extends Schema.TaggedError<EventNotFound>()(
  'EventRsvpEventNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'EventRsvpForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class RsvpDeadlinePassed extends Schema.TaggedError<RsvpDeadlinePassed>()(
  'RsvpDeadlinePassed',
  {},
  HttpApiSchema.annotations({ status: 400 }),
) {}

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
      .addSuccess(EventRsvpDetail)
      .addError(Forbidden, { status: 403 })
      .addError(EventNotFound, { status: 404 })
      .addError(RsvpDeadlinePassed, { status: 400 })
      .setPath(Schema.Struct({ teamId: TeamId, eventId: EventId }))
      .setPayload(SubmitRsvpRequest)
      .middleware(AuthMiddleware),
  ) {}
