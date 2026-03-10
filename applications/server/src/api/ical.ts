import { HttpApiBuilder, HttpServerResponse } from '@effect/platform';
import { Auth, ICalApi } from '@sideline/domain';
import { DateTime, Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { env } from '~/env.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { ICalTokensRepository } from '~/repositories/ICalTokensRepository.js';

const formatDateTimeUtc = (dt: DateTime.Utc): string => {
  const s = DateTime.formatIso(dt);
  return `${s.replace(/[-:]/g, '').replace(/\.\d+/, '').replace('Z', '')}Z`;
};

const escapeICalText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

const buildWebcalUrl = (token: string): string => {
  const serverUrl = env.SERVER_URL.toString().replace(/\/$/, '');
  return `webcal://${serverUrl.replace(/^https?:\/\//, '')}/ical/${token}`;
};

const buildICalFeed = (
  events: ReadonlyArray<{
    id: string;
    title: string;
    description: Option.Option<string>;
    start_at: DateTime.Utc;
    end_at: Option.Option<DateTime.Utc>;
    location: Option.Option<string>;
    status: string;
    event_type: string;
    team_name: string;
  }>,
): string => {
  const lines: Array<string> = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sideline//Events//EN',
    'CALNAME:Sideline Events',
    'X-WR-CALNAME:Sideline Events',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@sideline`);
    lines.push(`DTSTART:${formatDateTimeUtc(event.start_at)}`);
    Option.map(event.end_at, (endAt) => {
      lines.push(`DTEND:${formatDateTimeUtc(endAt)}`);
    });
    lines.push(`SUMMARY:${escapeICalText(`[${event.team_name}] ${event.title}`)}`);
    Option.map(event.description, (desc) => {
      lines.push(`DESCRIPTION:${escapeICalText(desc)}`);
    });
    Option.map(event.location, (loc) => {
      lines.push(`LOCATION:${escapeICalText(loc)}`);
    });
    lines.push(`STATUS:${event.status === 'active' ? 'CONFIRMED' : 'CANCELLED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const ICalApiLive = HttpApiBuilder.group(Api, 'ical', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('icalTokens', () => ICalTokensRepository),
    Effect.bind('events', () => EventsRepository),
    Effect.map(({ icalTokens, events }) =>
      handlers
        .handle('getICalToken', () =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('existing', ({ currentUser }) => icalTokens.findByUserId(currentUser.id)),
            Effect.bind('token', ({ existing, currentUser }) =>
              Option.match(existing, {
                onNone: () => icalTokens.create(currentUser.id),
                onSome: Effect.succeed,
              }),
            ),
            Effect.map(
              ({ token }) =>
                new ICalApi.ICalTokenResponse({
                  token: token.token,
                  url: buildWebcalUrl(token.token),
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('regenerateICalToken', () =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('token', ({ currentUser }) => icalTokens.regenerate(currentUser.id)),
            Effect.map(
              ({ token }) =>
                new ICalApi.ICalTokenResponse({
                  token: token.token,
                  url: buildWebcalUrl(token.token),
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('getICalFeed', ({ path: { token } }) =>
          Effect.Do.pipe(
            Effect.bind('icalToken', () => icalTokens.findByToken(token)),
            Effect.bind('tokenRow', ({ icalToken }) =>
              Option.match(icalToken, {
                onNone: () => Effect.fail(new ICalApi.ICalTokenNotFound()),
                onSome: Effect.succeed,
              }),
            ),
            Effect.bind('userEvents', ({ tokenRow }) =>
              events.findEventsByUserId(tokenRow.user_id),
            ),
            Effect.map(({ userEvents }) =>
              HttpServerResponse.text(buildICalFeed(userEvents), {
                contentType: 'text/calendar; charset=utf-8',
              }),
            ),
          ),
        ),
    ),
  ),
);
