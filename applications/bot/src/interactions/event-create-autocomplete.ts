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
    Effect.flatMap(({ interaction, focused, rpc }) => {
      const guildId = interaction.guild_id;
      const data = interaction.data;

      const eventType =
        data && 'options' in data
          ? pipe(
              [...(data.options ?? [])],
              Array.findFirst((o) => o.name === 'type'),
              Option.flatMap((o) => ('value' in o ? Option.some(String(o.value)) : Option.none())),
              Option.getOrElse(() => ''),
            )
          : '';

      if (eventType !== 'training') {
        return Effect.succeed(
          Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
            data: { choices: [] },
          }),
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
        Effect.map((types) =>
          pipe(
            [...types],
            Array.filter((tt) => tt.name.toLowerCase().includes(query.toLowerCase())),
            Array.map((tt) => ({
              name: tt.name.slice(0, 100),
              value: tt.id,
            })),
            Array.take(25),
          ),
        ),
        Effect.catchAll(() => Effect.succeed<ReadonlyArray<{ name: string; value: string }>>([])),
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
