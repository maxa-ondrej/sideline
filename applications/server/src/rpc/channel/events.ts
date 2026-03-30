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

const channelCreatedFromSql = (r: EventRow) =>
  Match.value(r.entity_type).pipe(
    Match.when('group', () =>
      Effect.Do.pipe(
        Effect.bind('group_id', () => nullable(r, 'group_id')),
        Effect.bind('group_name', () => nullable(r, 'group_name')),
        Effect.map(
          ({ group_id, group_name }) =>
            new ChannelRpcEvents.GroupChannelCreatedEvent({
              id: r.id,
              team_id: r.team_id,
              guild_id: r.guild_id,
              group_id,
              group_name,
              existing_channel_id: r.existing_channel_id,
            }),
        ),
      ),
    ),
    Match.when('roster', () =>
      Effect.Do.pipe(
        Effect.bind('roster_id', () => nullable(r, 'roster_id')),
        Effect.bind('roster_name', () => nullable(r, 'roster_name')),
        Effect.map(
          ({ roster_id, roster_name }) =>
            new ChannelRpcEvents.RosterChannelCreatedEvent({
              id: r.id,
              team_id: r.team_id,
              guild_id: r.guild_id,
              roster_id,
              roster_name,
              existing_channel_id: r.existing_channel_id,
            }),
        ),
      ),
    ),
    Match.exhaustive,
  );

const channelDeletedFromSql = (r: EventRow) =>
  Match.value(r.entity_type).pipe(
    Match.when('group', () =>
      Effect.Do.pipe(
        Effect.bind('group_id', () => nullable(r, 'group_id')),
        Effect.bind('discord_channel_id', () => nullable(r, 'existing_channel_id')),
        Effect.map(
          ({ group_id, discord_channel_id }) =>
            new ChannelRpcEvents.GroupChannelDeletedEvent({
              id: r.id,
              team_id: r.team_id,
              guild_id: r.guild_id,
              group_id,
              discord_channel_id,
              discord_role_id: r.discord_role_id,
            }),
        ),
      ),
    ),
    Match.when('roster', () =>
      Effect.Do.pipe(
        Effect.bind('roster_id', () => nullable(r, 'roster_id')),
        Effect.bind('discord_channel_id', () => nullable(r, 'existing_channel_id')),
        Effect.map(
          ({ roster_id, discord_channel_id }) =>
            new ChannelRpcEvents.RosterChannelDeletedEvent({
              id: r.id,
              team_id: r.team_id,
              guild_id: r.guild_id,
              roster_id,
              discord_channel_id,
              discord_role_id: r.discord_role_id,
            }),
        ),
      ),
    ),
    Match.exhaustive,
  );

const memberAddedFromSql = (r: EventRow) =>
  Match.value(r.entity_type).pipe(
    Match.when('group', () =>
      Effect.Do.pipe(
        Effect.bind('group_id', () => nullable(r, 'group_id')),
        Effect.bind('group_name', () => nullable(r, 'group_name')),
        Effect.bind('team_member_id', () => nullable(r, 'team_member_id')),
        Effect.bind('discord_user_id', () => nullable(r, 'discord_user_id')),
        Effect.map(
          ({ group_id, group_name, team_member_id, discord_user_id }) =>
            new ChannelRpcEvents.GroupMemberAddedEvent({
              id: r.id,
              team_id: r.team_id,
              guild_id: r.guild_id,
              group_id,
              group_name,
              team_member_id,
              discord_user_id,
            }),
        ),
      ),
    ),
    Match.when('roster', () =>
      Effect.Do.pipe(
        Effect.bind('roster_id', () => nullable(r, 'roster_id')),
        Effect.bind('roster_name', () => nullable(r, 'roster_name')),
        Effect.bind('team_member_id', () => nullable(r, 'team_member_id')),
        Effect.bind('discord_user_id', () => nullable(r, 'discord_user_id')),
        Effect.map(
          ({ roster_id, roster_name, team_member_id, discord_user_id }) =>
            new ChannelRpcEvents.RosterMemberAddedEvent({
              id: r.id,
              team_id: r.team_id,
              guild_id: r.guild_id,
              roster_id,
              roster_name,
              team_member_id,
              discord_user_id,
            }),
        ),
      ),
    ),
    Match.exhaustive,
  );

const memberRemovedFromSql = (r: EventRow) =>
  Match.value(r.entity_type).pipe(
    Match.when('group', () =>
      Effect.Do.pipe(
        Effect.bind('group_id', () => nullable(r, 'group_id')),
        Effect.bind('team_member_id', () => nullable(r, 'team_member_id')),
        Effect.bind('discord_user_id', () => nullable(r, 'discord_user_id')),
        Effect.map(
          ({ group_id, team_member_id, discord_user_id }) =>
            new ChannelRpcEvents.GroupMemberRemovedEvent({
              id: r.id,
              team_id: r.team_id,
              guild_id: r.guild_id,
              group_id,
              team_member_id,
              discord_user_id,
            }),
        ),
      ),
    ),
    Match.when('roster', () =>
      Effect.Do.pipe(
        Effect.bind('roster_id', () => nullable(r, 'roster_id')),
        Effect.bind('team_member_id', () => nullable(r, 'team_member_id')),
        Effect.bind('discord_user_id', () => nullable(r, 'discord_user_id')),
        Effect.map(
          ({ roster_id, team_member_id, discord_user_id }) =>
            new ChannelRpcEvents.RosterMemberRemovedEvent({
              id: r.id,
              team_id: r.team_id,
              guild_id: r.guild_id,
              roster_id,
              team_member_id,
              discord_user_id,
            }),
        ),
      ),
    ),
    Match.exhaustive,
  );

export const constructEvent = Match.type<EventRow>().pipe(
  Match.when({ event_type: 'channel_created' }, channelCreatedFromSql),
  Match.when({ event_type: 'channel_deleted' }, channelDeletedFromSql),
  Match.when({ event_type: 'member_added' }, memberAddedFromSql),
  Match.when({ event_type: 'member_removed' }, memberRemovedFromSql),
  Match.exhaustive,
);
