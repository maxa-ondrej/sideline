import { ChannelRpcEvents, type ChannelSyncEvent } from '@sideline/domain';
import { Data, Effect, Match, type Option } from 'effect';
import {
  ChannelSyncEventsRepository,
  type EventRow,
} from '~/repositories/ChannelSyncEventsRepository.js';

export class EventPropertyMissing extends Data.TaggedError('EventPropertyMissing')<{
  event_type: string;
  id: ChannelSyncEvent.ChannelSyncEventId;
  property: string;
}> {
  errorMessage = () =>
    `Property "${this.property}" is missing for event "${this.event_type}" with id "${this.id}"`;

  log = () => Effect.logError(this.errorMessage());

  markFailed = () =>
    ChannelSyncEventsRepository.pipe(
      Effect.flatMap((repository) => repository.markFailed(this.id, this.errorMessage())),
    );

  static handle = (e: EventPropertyMissing) => e.log().pipe(Effect.tap(() => e.markFailed()));
}

const nullable = <
  K extends keyof E & string,
  E extends {
    readonly event_type: string;
    readonly id: ChannelSyncEvent.ChannelSyncEventId;
  } & {
    [key in K]: E[K] extends Option.Option<infer T> ? Option.Option<T> : never;
  },
>(
  event: E,
  key: K,
) =>
  event[key].pipe(
    Effect.catchTag(
      'NoSuchElementException',
      () => new EventPropertyMissing({ event_type: event.event_type, id: event.id, property: key }),
    ),
  ) as Effect.Effect<E[K] extends Option.Option<infer T> ? T : never, EventPropertyMissing>;

export const constructEvent = Match.type<EventRow>().pipe(
  Match.when({ event_type: 'channel_created' }, (r) =>
    Effect.Do.pipe(
      Effect.bind('subgroup_name', () => nullable(r, 'subgroup_name')),
      Effect.map(
        ({ subgroup_name }) =>
          new ChannelRpcEvents.ChannelCreatedEvent({
            id: r.id,
            team_id: r.team_id,
            guild_id: r.guild_id,
            subgroup_id: r.subgroup_id,
            subgroup_name,
          }),
      ),
    ),
  ),
  Match.when({ event_type: 'channel_deleted' }, (r) =>
    Effect.succeed(
      new ChannelRpcEvents.ChannelDeletedEvent({
        id: r.id,
        team_id: r.team_id,
        guild_id: r.guild_id,
        subgroup_id: r.subgroup_id,
      }),
    ),
  ),
  Match.when({ event_type: 'member_added' }, (r) =>
    Effect.Do.pipe(
      Effect.bind('discord_user_id', () => nullable(r, 'discord_user_id')),
      Effect.bind('team_member_id', () => nullable(r, 'team_member_id')),
      Effect.bind('subgroup_name', () => nullable(r, 'subgroup_name')),
      Effect.map(
        ({ discord_user_id, team_member_id, subgroup_name }) =>
          new ChannelRpcEvents.ChannelMemberAddedEvent({
            id: r.id,
            team_id: r.team_id,
            guild_id: r.guild_id,
            subgroup_id: r.subgroup_id,
            subgroup_name,
            discord_user_id,
            team_member_id,
          }),
      ),
    ),
  ),
  Match.when({ event_type: 'member_removed' }, (r) =>
    Effect.Do.pipe(
      Effect.bind('discord_user_id', () => nullable(r, 'discord_user_id')),
      Effect.bind('team_member_id', () => nullable(r, 'team_member_id')),
      Effect.bind('subgroup_name', () => nullable(r, 'subgroup_name')),
      Effect.map(
        ({ discord_user_id, team_member_id }) =>
          new ChannelRpcEvents.ChannelMemberRemovedEvent({
            id: r.id,
            team_id: r.team_id,
            guild_id: r.guild_id,
            subgroup_id: r.subgroup_id,
            discord_user_id,
            team_member_id,
          }),
      ),
    ),
  ),
  Match.exhaustive,
);
