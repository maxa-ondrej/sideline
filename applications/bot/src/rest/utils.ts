import type { EventRpcModels } from '@sideline/domain';
import { Array, Option, pipe, Schedule } from 'effect';
import type { Permission } from './permissions.js';

export const POLL_BATCH_SIZE = 50;

export const retryPolicy = Schedule.exponential('1 second').pipe(Schedule.both(Schedule.recurs(3)));

export const allow = (permission: Permission) => Number(permission.allow ?? 0);

export const deny = (permission: Permission) => Number(permission.deny ?? 0);

export const formatName = (entry: EventRpcModels.RsvpAttendeeEntry) =>
  pipe(
    Array.make(entry.name, entry.nickname, entry.username),
    Array.map(Option.map((u) => `**${u}**`)),
    Array.getSomes,
    Array.head,
    Option.getOrElse(() => 'Unknown'),
  );
