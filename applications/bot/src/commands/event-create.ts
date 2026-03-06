import * as m from '@sideline/i18n/messages';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect } from 'effect';
import { userLocale } from '~/locale.js';

export const EventCreateCommand = Ix.global(
  {
    name: 'event-create',
    description: 'Create a new event',
    description_localizations: { cs: 'Vytvořit novou událost' },
    options: [
      {
        name: 'type',
        description: 'Type of event',
        description_localizations: { cs: 'Typ události' },
        type: Discord.ApplicationCommandOptionType.STRING,
        required: true,
        choices: [
          { name: 'Training', name_localizations: { cs: 'Trénink' }, value: 'training' },
          { name: 'Match', name_localizations: { cs: 'Zápas' }, value: 'match' },
          { name: 'Tournament', name_localizations: { cs: 'Turnaj' }, value: 'tournament' },
          { name: 'Meeting', name_localizations: { cs: 'Schůzka' }, value: 'meeting' },
          { name: 'Social', name_localizations: { cs: 'Společenská' }, value: 'social' },
          { name: 'Other', name_localizations: { cs: 'Jiné' }, value: 'other' },
        ],
      },
    ],
  },
  Interaction.pipe(
    Effect.map((interaction) => {
      const locale = userLocale(interaction);
      const guildId = interaction.guild_id;

      if (!guildId) {
        return Ix.response({
          type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: m.bot_event_no_guild({}, { locale }), flags: 64 },
        });
      }

      const data = interaction.data;
      const eventType =
        data && 'options' in data
          ? ((
              data.options?.find((o: { name: string }) => o.name === 'type') as
                | { value: string }
                | undefined
            )?.value ?? 'other')
          : 'other';

      return Ix.response({
        type: Discord.InteractionCallbackTypes.MODAL,
        data: {
          custom_id: `event-create:${eventType}`,
          title: m.bot_event_modal_title({}, { locale }),
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'event_title',
                  label: m.bot_event_title_label({}, { locale }),
                  style: 1,
                  required: true,
                  max_length: 100,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'event_start',
                  label: m.bot_event_start_label({}, { locale }),
                  style: 1,
                  required: true,
                  placeholder: m.bot_event_start_placeholder({}, { locale }),
                  max_length: 16,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'event_end',
                  label: m.bot_event_end_label({}, { locale }),
                  style: 1,
                  required: false,
                  placeholder: m.bot_event_end_placeholder({}, { locale }),
                  max_length: 16,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'event_location',
                  label: m.bot_event_location_label({}, { locale }),
                  style: 1,
                  required: false,
                  placeholder: m.bot_event_location_placeholder({}, { locale }),
                  max_length: 200,
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'event_description',
                  label: m.bot_event_description_label({}, { locale }),
                  style: 2,
                  required: false,
                  max_length: 1000,
                },
              ],
            },
          ],
        },
      });
    }),
  ),
);
