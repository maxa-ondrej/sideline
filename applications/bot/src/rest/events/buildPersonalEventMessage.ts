import { createHash } from 'node:crypto';
import type { Discord as DiscordSchemas, EventRpcModels } from '@sideline/domain';
import type * as DiscordTypes from 'dfx/types';
import { Option } from 'effect';
import type { Locale } from '~/locale.js';
import { buildUpcomingEventEmbed } from './buildUpcomingEventEmbed.js';

/** A fully-rendered personal event message payload. */
export type PersonalMessagePayload = {
  readonly content: string;
  readonly embeds: ReadonlyArray<DiscordTypes.RichEmbed>;
  readonly components: ReadonlyArray<DiscordTypes.ActionRowComponentForMessageRequest>;
  readonly allowed_mentions: { readonly parse: [] };
};

/**
 * Build the personal-channel message for a single member + event.
 *
 * When the member has not responded yet we put their mention in `content`. We
 * always send `allowed_mentions: { parse: [] }` so the mention renders (and
 * highlights the unanswered event) WITHOUT producing a ping — and so no other
 * markup in the embed can ever notify anyone.
 */
export const buildPersonalMessagePayload = (params: {
  entry: EventRpcModels.UpcomingEventForUserEntry;
  yesAttendees: ReadonlyArray<EventRpcModels.RsvpAttendeeEntry>;
  discordId: DiscordSchemas.Snowflake;
  locale: Locale;
}): PersonalMessagePayload => {
  const { entry, yesAttendees, discordId, locale } = params;
  const rendered = buildUpcomingEventEmbed({ entry, yesAttendees, locale });
  const content = Option.isNone(entry.my_response) ? `<@${discordId}>` : '';
  return {
    content,
    embeds: rendered.embeds,
    components: rendered.components,
    allowed_mentions: { parse: [] },
  };
};

/** Stable hash of the content-bearing parts of a payload (drives hash-diff skips). */
export const hashPersonalMessagePayload = (payload: PersonalMessagePayload): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        content: payload.content,
        embeds: payload.embeds,
        components: payload.components,
      }),
    )
    .digest('hex');
