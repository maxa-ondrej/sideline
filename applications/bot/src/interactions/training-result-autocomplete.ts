import { Discord as DiscordSchemas } from '@sideline/domain';
import * as Ix from 'dfx/Interactions/index';
import { FocusedOptionContext, Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Array, DateTime, Effect, Metric, pipe, Schema } from 'effect';
import { discordInteractionsTotal } from '~/metrics.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeUnknownSync(DiscordSchemas.Snowflake);

/** Format a DateTime.Utc to a compact date string like "2026-06-16" for autocomplete labels. */
const formatDateLabel = (dt: DateTime.Utc): string => {
  const ms = Number(DateTime.toEpochMillis(dt));
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const TrainingResultAutocomplete = Ix.autocomplete(
  (data, focused) => data.name === 'training' && focused.name === 'event',
  Effect.Do.pipe(
    Effect.tap(() =>
      Metric.update(
        Metric.withAttributes(discordInteractionsTotal, { interaction_type: 'autocomplete' }),
        1,
      ),
    ),
    Effect.bind('interaction', () => Interaction.asEffect()),
    Effect.bind('focused', () => FocusedOptionContext.asEffect()),
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.flatMap(({ interaction, focused, rpc }) => {
      const guildId = interaction.guild_id;

      if (!guildId) {
        return Effect.succeed(
          Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
            data: { choices: [] },
          }),
        );
      }

      const query =
        focused && 'value' in focused && typeof focused.value === 'string' ? focused.value : '';

      return rpc['Event/GetLoggableTrainingEvents']({
        guild_id: decodeSnowflake(guildId),
      }).pipe(
        Effect.map((events) => {
          const queryLower = query.toLowerCase();

          return pipe(
            [...events],
            Array.filter((e) => {
              if (queryLower === '') return true;
              const dateLabel = formatDateLabel(e.start_at);
              return e.title.toLowerCase().includes(queryLower) || dateLabel.includes(queryLower);
            }),
            Array.take(25),
            Array.map((e) => {
              const dateLabel = formatDateLabel(e.start_at);
              const label = `${dateLabel} · ${e.title}`.slice(0, 100);
              return { name: label, value: e.event_id };
            }),
          );
        }),
        Effect.tapError((err) => Effect.logError('[training-result-autocomplete] RPC error', err)),
        Effect.catchTag('GuildNotFound', () =>
          Effect.succeed<ReadonlyArray<{ name: string; value: string }>>([]),
        ),
        Effect.catchTag('RpcClientError', () =>
          Effect.succeed<ReadonlyArray<{ name: string; value: string }>>([]),
        ),
        Effect.map((choices) =>
          Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
            data: { choices },
          }),
        ),
      );
    }),
    Effect.withSpan('interaction/training-result-autocomplete'),
  ),
);
