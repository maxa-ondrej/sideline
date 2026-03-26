import { describe, expect, it } from '@effect/vitest';
import { Schema } from 'effect';
import { ActivityType } from '~/models/ActivityLog.js';

describe('ActivityType schema', () => {
  it('accepts gym as a valid activity type', () => {
    const result = Schema.decodeUnknownSync(ActivityType)('gym');
    expect(result).toBe('gym');
  });

  it('accepts running as a valid activity type', () => {
    const result = Schema.decodeUnknownSync(ActivityType)('running');
    expect(result).toBe('running');
  });

  it('accepts stretching as a valid activity type', () => {
    const result = Schema.decodeUnknownSync(ActivityType)('stretching');
    expect(result).toBe('stretching');
  });

  it('rejects swimming as an invalid activity type', () => {
    expect(() => Schema.decodeUnknownSync(ActivityType)('swimming')).toThrow();
  });

  it('rejects empty string as an invalid activity type', () => {
    expect(() => Schema.decodeUnknownSync(ActivityType)('')).toThrow();
  });

  it('rejects null as an invalid activity type', () => {
    expect(() => Schema.decodeUnknownSync(ActivityType)(null)).toThrow();
  });
});
