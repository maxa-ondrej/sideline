import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import * as Schemas from '@sideline/effect-lib/Schemas';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { EventId, EventType } from '~/models/Event.js';
import { RsvpResponse } from '~/models/EventRsvp.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class DashboardUpcomingEvent extends Schema.Class<DashboardUpcomingEvent>(
  'DashboardUpcomingEvent',
)({
  eventId: EventId,
  title: Schema.String,
  eventType: EventType,
  startAt: Schemas.DateTimeFromIsoString,
  endAt: Schema.optionalWith(Schemas.DateTimeFromIsoString, { as: 'Option' }),
  location: Schema.optionalWith(Schema.String, { as: 'Option' }),
  myRsvp: Schema.optionalWith(RsvpResponse, { as: 'Option' }),
}) {}

export class DashboardActivitySummary extends Schema.Class<DashboardActivitySummary>(
  'DashboardActivitySummary',
)({
  currentStreak: Schema.Int,
  longestStreak: Schema.Int,
  totalActivities: Schema.Int,
  totalDurationMinutes: Schema.Int,
  leaderboardRank: Schema.optionalWith(Schema.Int, { as: 'Option' }),
  leaderboardTotal: Schema.Int,
  recentActivityCount: Schema.Int,
}) {}

export class DashboardResponse extends Schema.Class<DashboardResponse>('DashboardResponse')({
  upcomingEvents: Schema.Array(DashboardUpcomingEvent),
  awaitingRsvp: Schema.Array(DashboardUpcomingEvent),
  activitySummary: DashboardActivitySummary,
  myMemberId: TeamMemberId,
}) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'DashboardForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class DashboardApiGroup extends HttpApiGroup.make('dashboard').add(
  HttpApiEndpoint.get('getDashboard', '/teams/:teamId/dashboard')
    .addSuccess(DashboardResponse)
    .addError(Forbidden)
    .setPath(Schema.Struct({ teamId: TeamId }))
    .middleware(AuthMiddleware),
) {}
