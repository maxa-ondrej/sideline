import { describe, expect, it } from '@effect/vitest';
import { Schema } from 'effect';
import { ActivitySource } from '~/models/ActivityLog.js';
import { ActivityTypeSlug } from '~/models/ActivityType.js';

describe('ActivityTypeSlug schema', () => {
  it('accepts gym as a valid activity type slug', () => {
    const result = Schema.decodeUnknownSync(ActivityTypeSlug)('gym');
    expect(result).toBe('gym');
  });

  it('accepts running as a valid activity type slug', () => {
    const result = Schema.decodeUnknownSync(ActivityTypeSlug)('running');
    expect(result).toBe('running');
  });

  it('accepts stretching as a valid activity type slug', () => {
    const result = Schema.decodeUnknownSync(ActivityTypeSlug)('stretching');
    expect(result).toBe('stretching');
  });

  it('accepts training as a valid activity type slug', () => {
    const result = Schema.decodeUnknownSync(ActivityTypeSlug)('training');
    expect(result).toBe('training');
  });

  it('rejects swimming as an invalid activity type slug', () => {
    expect(() => Schema.decodeUnknownSync(ActivityTypeSlug)('swimming')).toThrow();
  });

  it('rejects empty string as an invalid activity type slug', () => {
    expect(() => Schema.decodeUnknownSync(ActivityTypeSlug)('')).toThrow();
  });

  it('rejects null as an invalid activity type slug', () => {
    expect(() => Schema.decodeUnknownSync(ActivityTypeSlug)(null)).toThrow();
  });
});

describe('ActivitySource schema', () => {
  it('accepts manual as a valid activity source', () => {
    const result = Schema.decodeUnknownSync(ActivitySource)('manual');
    expect(result).toBe('manual');
  });

  it('accepts auto as a valid activity source', () => {
    const result = Schema.decodeUnknownSync(ActivitySource)('auto');
    expect(result).toBe('auto');
  });

  it('rejects unknown as an invalid activity source', () => {
    expect(() => Schema.decodeUnknownSync(ActivitySource)('unknown')).toThrow();
  });

  it('rejects empty string as an invalid activity source', () => {
    expect(() => Schema.decodeUnknownSync(ActivitySource)('')).toThrow();
  });

  it('rejects null as an invalid activity source', () => {
    expect(() => Schema.decodeUnknownSync(ActivitySource)(null)).toThrow();
  });
});
