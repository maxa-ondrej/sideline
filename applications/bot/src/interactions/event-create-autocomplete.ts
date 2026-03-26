import { Discord as DiscordSchemas } from '@sideline/domain';
import * as Ix from 'dfx/Interactions/index';
import { FocusedOptionContext, Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Array, Effect, Option, pipe, Schema } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeUnknownSync(DiscordSchemas.Snowflake);

export const EventCreateAutocomplete = Ix.autocomplete(
  (data, focused) => data.name === 'event' && focused.name === 'training_type',
  Effect.Do.pipe(
    Effect.bind('interaction', () => Interaction),
    Effect.bind('focused', () => FocusedOptionContext),
    Effect.bind('rpc', () => SyncRpc),
    Effect.tap(() => Effect.logInfo('[autocomplete] handler invoked')),
    Effect.flatMap(({ interaction, focused, rpc }) => {
      const guildId = interaction.guild_id;
      const data = interaction.data;

      // For subcommands, options are nested: data.options[0] = "create" subcommand,
      // and the actual options (type, training_type) are in data.options[0].options
      const subCommandOptions =
        data && 'options' in data && data.options?.[0] && 'options' in data.options[0]
          ? (data.options[0].options ?? [])
          : [];

      const eventType = pipe(
        [...subCommandOptions],
        Array.findFirst((o) => o.name === 'type'),
        Option.flatMap((o) => ('value' in o ? Option.some(String(o.value)) : Option.none())),
        Option.getOrElse(() => ''),
      );

      if (eventType !== 'training') {
        return Effect.logInfo(
          `[autocomplete] skipping: eventType=${eventType}, options=${JSON.stringify(subCommandOptions)}`,
        ).pipe(
          Effect.as(
            Ix.response({
              type: DiscordTypes.InteractionCallbackTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
              data: { choices: [] },
            }),
          ),
        );
      }

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

      return rpc['Event/GetTrainingTypesByGuild']({
        guild_id: decodeSnowflake(guildId),
      }).pipe(
        Effect.map((types) => [
          ...pipe(
            [...types],
            Array.filter((tt) => tt.name.toLowerCase().includes(query.toLowerCase())),
            Array.map((tt) => ({
              name: tt.name.slice(0, 100),
              value: tt.id,
            })),
            Array.take(24),
          ),
          { name: 'Other', value: '' },
        ]),
        Effect.tapError((err) => Effect.logError('[autocomplete] RPC error', err)),
        Effect.catchAll(() => Effect.succeed<ReadonlyArray<{ name: string; value: string }>>([])),
        Effect.tap((choices) =>
          Effect.logInfo(`[autocomplete] returning ${choices.length} choices`),
        ),
        Effect.map((choices) =>
          Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
            data: { choices },
          }),
        ),
      );
    }),
  ),
);
