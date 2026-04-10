import type { EventRpcModels } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import type { DiscordRestService } from 'dfx/DiscordREST';
import * as DiscordTypes from 'dfx/types';
import { Effect } from 'effect';
import type { Locale } from '~/locale.js';
import { buildUpcomingEventEmbed } from './buildUpcomingEventEmbed.js';

/**
 * Sends one ephemeral follow-up message per event using the interaction webhook.
 * If there are more events beyond the provided list, appends a "...and X more" note.
 */
export const sendUpcomingEventFollowups = (params: {
  rest: DiscordRestService;
  applicationId: string;
  interactionToken: string;
  events: ReadonlyArray<EventRpcModels.UpcomingEventForUserEntry>;
  total: number;
  locale: Locale;
}) => {
  const { rest, applicationId, interactionToken, events, total, locale } = params;

  const sendMessages = Effect.forEach(
    events,
    (entry) => {
      const { embeds, components } = buildUpcomingEventEmbed({ entry, locale });
      return rest
        .executeWebhook(applicationId, interactionToken, {
          payload: {
            embeds,
            components,
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        })
        .pipe(Effect.asVoid);
    },
    { concurrency: 'inherit', discard: true },
  );

  const extraCount = total - events.length;

  if (extraCount > 0) {
    return sendMessages.pipe(
      Effect.flatMap(() =>
        rest
          .executeWebhook(applicationId, interactionToken, {
            payload: {
              content: m.bot_upcoming_more_events({ count: String(extraCount) }, { locale }),
              flags: DiscordTypes.MessageFlags.Ephemeral,
            },
          })
          .pipe(Effect.asVoid),
      ),
    );
  }

  return sendMessages;
};
