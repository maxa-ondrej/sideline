import { EventRpcEvents } from '@sideline/domain';
import { Effect, Match } from 'effect';
import {
  type EventSyncEventRow,
  EventSyncEventsRepository,
} from '~/repositories/EventSyncEventsRepository.js';

export class EventPropertyMissing {
  readonly _tag = 'EventPropertyMissing';
  constructor(
    readonly event_type: string,
    readonly id: string,
    readonly property: string,
  ) {}

  errorMessage = () =>
    `Property "${this.property}" is missing for event "${this.event_type}" with id "${this.id}"`;

  log = () => Effect.logError(this.errorMessage());

  markFailed = () =>
    EventSyncEventsRepository.asEffect().pipe(
      Effect.flatMap((repository) => repository.markFailed(this.id, this.errorMessage())),
    );

  static handle = (e: EventPropertyMissing) => e.log().pipe(Effect.tap(() => e.markFailed()));
}

export const constructEvent = Match.type<EventSyncEventRow>().pipe(
  Match.when({ event_type: 'event_created' }, (r) =>
    Effect.succeed(
      new EventRpcEvents.EventCreatedEvent({
        id: r.id,
        team_id: r.team_id,
        guild_id: r.guild_id,
        event_id: r.event_id,
        title: r.event_title,
        description: r.event_description,
        start_at: r.event_start_at,
        end_at: r.event_end_at,
        location: r.event_location,
        event_type: r.event_event_type,
        discord_channel_id: r.discord_target_channel_id,
      }),
    ),
  ),
  Match.when({ event_type: 'event_updated' }, (r) =>
    Effect.succeed(
      new EventRpcEvents.EventUpdatedEvent({
        id: r.id,
        team_id: r.team_id,
        guild_id: r.guild_id,
        event_id: r.event_id,
        title: r.event_title,
        description: r.event_description,
        start_at: r.event_start_at,
        end_at: r.event_end_at,
        location: r.event_location,
        event_type: r.event_event_type,
        discord_channel_id: r.discord_target_channel_id,
      }),
    ),
  ),
  Match.when({ event_type: 'event_cancelled' }, (r) =>
    Effect.succeed(
      new EventRpcEvents.EventCancelledEvent({
        id: r.id,
        team_id: r.team_id,
        guild_id: r.guild_id,
        event_id: r.event_id,
      }),
    ),
  ),
  Match.when({ event_type: 'rsvp_reminder' }, (r) =>
    Effect.succeed(
      new EventRpcEvents.RsvpReminderEvent({
        id: r.id,
        team_id: r.team_id,
        guild_id: r.guild_id,
        event_id: r.event_id,
        title: r.event_title,
        start_at: r.event_start_at,
        discord_channel_id: r.discord_target_channel_id,
        member_group_id: r.member_group_id,
        discord_role_id: r.discord_role_id,
      }),
    ),
  ),
  Match.when({ event_type: 'event_started' }, (r) =>
    Effect.succeed(
      new EventRpcEvents.EventStartedEvent({
        id: r.id,
        team_id: r.team_id,
        guild_id: r.guild_id,
        event_id: r.event_id,
        title: r.event_title,
        start_at: r.event_start_at,
        end_at: r.event_end_at,
        location: r.event_location,
        event_type: r.event_event_type,
        member_group_id: r.member_group_id,
        discord_channel_id: r.discord_target_channel_id,
        discord_role_id: r.discord_role_id,
      }),
    ),
  ),
  Match.exhaustive,
);
