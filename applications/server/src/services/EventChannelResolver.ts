import type { Event, Team } from '@sideline/domain';
import { Effect, Option } from 'effect';
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
  string | null,
  never,
  EventsRepository | TrainingTypesRepository | TeamSettingsRepository
> =>
  Effect.Do.pipe(
    Effect.bind('events', () => EventsRepository),
    Effect.bind('trainingTypes', () => TrainingTypesRepository),
    Effect.bind('settings', () => TeamSettingsRepository),
    Effect.bind('event', ({ events }) =>
      events.findEventByIdWithDetails(eventId).pipe(
        Effect.map(Option.getOrNull),
        Effect.catchAll(() => Effect.succeed(null)),
      ),
    ),
    Effect.flatMap(({ event, trainingTypes, settings }) => {
      if (event === null) return Effect.succeed(null);

      // 1. Per-event override
      if (Option.isSome(event.discord_target_channel_id))
        return Effect.succeed(event.discord_target_channel_id.value);

      // 2. Training type default
      const trainingTypeCheck = Option.isSome(event.training_type_id)
        ? trainingTypes.findTrainingTypeById(event.training_type_id.value).pipe(
            Effect.map((opt) => {
              const tt = Option.getOrNull(opt);
              return tt?.discord_channel_id ?? null;
            }),
            Effect.catchAll(() => Effect.succeed(null)),
          )
        : Effect.succeed(null);

      return trainingTypeCheck.pipe(
        Effect.flatMap((channelFromTT) => {
          if (channelFromTT) return Effect.succeed(channelFromTT);

          // 3. Team settings event-type default
          return settings.findByTeamId(teamId).pipe(
            Effect.map((opt) => {
              const s = Option.getOrNull(opt);
              if (!s) return null;
              const field = eventTypeToSettingsField(event.event_type);
              return s[field];
            }),
            Effect.catchAll(() => Effect.succeed(null)),
          );
        }),
      );
    }),
  );
