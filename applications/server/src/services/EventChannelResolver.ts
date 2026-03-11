import type { Discord, Event, Team } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';

const eventTypeToSettingsField = (eventType: string) => {
  switch (eventType) {
    case 'training':
      return 'discord_channel_training' as const;
    case 'match':
      return 'discord_channel_match' as const;
    case 'tournament':
      return 'discord_channel_tournament' as const;
    case 'meeting':
      return 'discord_channel_meeting' as const;
    case 'social':
      return 'discord_channel_social' as const;
    default:
      return 'discord_channel_other' as const;
  }
};

export const resolveChannel = (
  teamId: Team.TeamId,
  eventId: Event.EventId,
): Effect.Effect<
  Option.Option<Discord.Snowflake>,
  never,
  | EventsRepository
  | TrainingTypesRepository
  | TeamSettingsRepository
  | DiscordChannelMappingRepository
> =>
  Effect.Do.pipe(
    Effect.bind('events', () => EventsRepository),
    Effect.bind('trainingTypes', () => TrainingTypesRepository),
    Effect.bind('settings', () => TeamSettingsRepository),
    Effect.bind('channelMappings', () => DiscordChannelMappingRepository),
    Effect.bind('event', ({ events }) => events.findEventByIdWithDetails(eventId)),
    Effect.flatMap(({ event, trainingTypes, settings, channelMappings }) => {
      if (Option.isNone(event)) return Effect.succeed(Option.none());

      const ev = event.value;

      // 1. Per-event override
      if (Option.isSome(ev.discord_target_channel_id))
        return Effect.succeed(ev.discord_target_channel_id);

      // 2. Owner group's Discord channel
      const ownerGroupCheck = Option.isSome(ev.owner_group_id)
        ? channelMappings
            .findByGroupId(teamId, ev.owner_group_id.value)
            .pipe(Effect.map((opt) => Option.map(opt, (m) => m.discord_channel_id)))
        : Effect.succeed(Option.none<Discord.Snowflake>());

      return ownerGroupCheck.pipe(
        Effect.flatMap((channelFromGroup) => {
          if (Option.isSome(channelFromGroup)) return Effect.succeed(channelFromGroup);

          // 3. Training type default
          const trainingTypeCheck = Option.isSome(ev.training_type_id)
            ? trainingTypes
                .findTrainingTypeById(ev.training_type_id.value)
                .pipe(Effect.map((opt) => Option.flatMap(opt, (tt) => tt.discord_channel_id)))
            : Effect.succeed(Option.none<Discord.Snowflake>());

          return trainingTypeCheck.pipe(
            Effect.flatMap((channelFromTT) => {
              if (Option.isSome(channelFromTT)) return Effect.succeed(channelFromTT);

              // 4. Team settings event-type default
              return settings.findByTeamId(teamId).pipe(
                Effect.map((opt) =>
                  Option.flatMap(opt, (s) => {
                    const field = eventTypeToSettingsField(ev.event_type);
                    return s[field];
                  }),
                ),
              );
            }),
          );
        }),
      );
    }),
  );
