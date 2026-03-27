import { describe, expect, it } from '@effect/vitest';
import { Schema } from 'effect';
import { ActivitySource, ActivityType } from '~/models/ActivityLog.js';

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

  it('accepts training as a valid activity type', () => {
    const result = Schema.decodeUnknownSync(ActivityType)('training');
    expect(result).toBe('training');
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
