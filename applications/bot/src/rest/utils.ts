import { Schedule } from 'effect';
import type { Permission } from './permissions.js';

export const POLL_BATCH_SIZE = 50;

export const retryPolicy = Schedule.exponential('1 second').pipe(
  Schedule.intersect(Schedule.recurs(3)),
);

export const allow = (permission: Permission) => Number(permission.allow ?? 0);

export const deny = (permission: Permission) => Number(permission.deny ?? 0);
