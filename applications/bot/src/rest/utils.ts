import { Array, Option, pipe, Schedule } from 'effect';
import type { Permission } from './permissions.js';

export const POLL_BATCH_SIZE = 50;

export const retryPolicy = Schedule.exponential('1 second').pipe(Schedule.both(Schedule.recurs(3)));

export const allow = (permission: Permission) => Number(permission.allow ?? 0);

export const deny = (permission: Permission) => Number(permission.deny ?? 0);

const pickName = (entry: {
  readonly name: Option.Option<string>;
  readonly nickname: Option.Option<string>;
  readonly display_name: Option.Option<string>;
  readonly username: Option.Option<string>;
}): Option.Option<string> =>
  pipe(
    Array.make(entry.name, entry.nickname, entry.display_name, entry.username),
    Array.getSomes,
    Array.head,
    Option.map((u) => `**${u}**`),
  );

export const formatName = (entry: {
  readonly name: Option.Option<string>;
  readonly nickname: Option.Option<string>;
  readonly display_name: Option.Option<string>;
  readonly username: Option.Option<string>;
}) =>
  pipe(
    pickName(entry),
    Option.getOrElse(() => 'Unknown'),
  );

export const formatNameWithMention = (entry: {
  readonly discord_id: Option.Option<string>;
  readonly name: Option.Option<string>;
  readonly nickname: Option.Option<string>;
  readonly display_name: Option.Option<string>;
  readonly username: Option.Option<string>;
}): string => {
  const name = pickName(entry);
  const mention = Option.map(entry.discord_id, (id) => `<@${id}>`);
  return Option.match(name, {
    onNone: () => Option.getOrElse(mention, () => 'Unknown'),
    onSome: (n) =>
      Option.match(mention, {
        onNone: () => n,
        onSome: (m) => `${n} (${m})`,
      }),
  });
};
