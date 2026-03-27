import { describe, expect, it } from '@effect/vitest';
import { Option, Schema } from 'effect';
import * as ActivityLogApi from '~/api/ActivityLogApi.js';

describe('CreateActivityLogRequest', () => {
  it('decodes valid input with activityType gym and null optional fields', () => {
    const result = Schema.decodeUnknownSync(ActivityLogApi.CreateActivityLogRequest)({
      activityType: 'gym',
      durationMinutes: null,
      note: null,
    });
    expect(result.activityType).toBe('gym');
    expect(Option.isNone(result.durationMinutes)).toBe(true);
    expect(Option.isNone(result.note)).toBe(true);
  });

  it('decodes valid input with activityType running and provided optional fields', () => {
    const result = Schema.decodeUnknownSync(ActivityLogApi.CreateActivityLogRequest)({
      activityType: 'running',
      durationMinutes: 45,
      note: 'Morning run',
    });
    expect(result.activityType).toBe('running');
    expect(Option.getOrNull(result.durationMinutes)).toBe(45);
    expect(Option.getOrNull(result.note)).toBe('Morning run');
  });

  it('decodes valid input with activityType stretching', () => {
    const result = Schema.decodeUnknownSync(ActivityLogApi.CreateActivityLogRequest)({
      activityType: 'stretching',
      durationMinutes: null,
      note: null,
    });
    expect(result.activityType).toBe('stretching');
  });

  it('rejects invalid activityType swimming', () => {
    expect(() =>
      Schema.decodeUnknownSync(ActivityLogApi.CreateActivityLogRequest)({
        activityType: 'swimming',
        durationMinutes: null,
        note: null,
      }),
    ).toThrow();
  });

  it('rejects durationMinutes greater than 1440', () => {
    expect(() =>
      Schema.decodeUnknownSync(ActivityLogApi.CreateActivityLogRequest)({
        activityType: 'gym',
        durationMinutes: 1441,
        note: null,
      }),
    ).toThrow();
  });

  it('rejects durationMinutes of exactly 0', () => {
    expect(() =>
      Schema.decodeUnknownSync(ActivityLogApi.CreateActivityLogRequest)({
        activityType: 'gym',
        durationMinutes: 0,
        note: null,
      }),
    ).toThrow();
  });

  it('accepts durationMinutes of exactly 1440', () => {
    const result = Schema.decodeUnknownSync(ActivityLogApi.CreateActivityLogRequest)({
      activityType: 'gym',
      durationMinutes: 1440,
      note: null,
    });
    expect(Option.getOrNull(result.durationMinutes)).toBe(1440);
  });
});

describe('UpdateActivityLogRequest', () => {
  it('decodes partial input with only activityType provided', () => {
    const result = Schema.decodeUnknownSync(ActivityLogApi.UpdateActivityLogRequest)({
      activityType: 'running',
    });
    expect(Option.getOrNull(result.activityType)).toBe('running');
    expect(Option.isNone(result.durationMinutes)).toBe(true);
    expect(Option.isNone(result.note)).toBe(true);
  });

  it('decodes empty object with all fields None', () => {
    const result = Schema.decodeUnknownSync(ActivityLogApi.UpdateActivityLogRequest)({});
    expect(Option.isNone(result.activityType)).toBe(true);
    expect(Option.isNone(result.durationMinutes)).toBe(true);
    expect(Option.isNone(result.note)).toBe(true);
  });

  it('decodes full update with all fields provided', () => {
    const result = Schema.decodeUnknownSync(ActivityLogApi.UpdateActivityLogRequest)({
      activityType: 'stretching',
      durationMinutes: 30,
      note: 'Updated note',
    });
    expect(Option.getOrNull(result.activityType)).toBe('stretching');
    expect(Option.getOrNull(result.durationMinutes)).toBe(30);
    expect(Option.getOrNull(result.note)).toBe('Updated note');
  });

  it('rejects invalid activityType in update', () => {
    expect(() =>
      Schema.decodeUnknownSync(ActivityLogApi.UpdateActivityLogRequest)({
        activityType: 'swimming',
      }),
    ).toThrow();
  });

  it('rejects durationMinutes greater than 1440 in update', () => {
    expect(() =>
      Schema.decodeUnknownSync(ActivityLogApi.UpdateActivityLogRequest)({
        durationMinutes: 1441,
      }),
    ).toThrow();
  });
});
