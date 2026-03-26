import { describe, expect, it } from '@effect/vitest';
import { formatLocalDate, formatLocalTime, localToUtc } from '~/lib/datetime.js';

describe('datetime', () => {
  describe('localToUtc + formatLocalDate + formatLocalTime roundtrip', () => {
    it('roundtrips a standard afternoon datetime', () => {
      const dt = localToUtc('2024-06-15', '14:30');
      expect(formatLocalDate(dt)).toBe('2024-06-15');
      expect(formatLocalTime(dt)).toBe('14:30');
    });

    it('roundtrips a near-midnight datetime', () => {
      const dt = localToUtc('2024-12-31', '23:45');
      expect(formatLocalDate(dt)).toBe('2024-12-31');
      expect(formatLocalTime(dt)).toBe('23:45');
    });

    it('roundtrips midnight', () => {
      const dt = localToUtc('2024-03-10', '00:00');
      expect(formatLocalDate(dt)).toBe('2024-03-10');
      expect(formatLocalTime(dt)).toBe('00:00');
    });
  });

  describe('formatLocalDate', () => {
    it('output matches YYYY-MM-DD format', () => {
      const dt = localToUtc('2024-06-15', '14:30');
      expect(formatLocalDate(dt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatLocalTime', () => {
    it('output matches HH:mm format', () => {
      const dt = localToUtc('2024-06-15', '14:30');
      expect(formatLocalTime(dt)).toMatch(/^\d{2}:\d{2}$/);
    });

    it('pads single-digit hours and minutes', () => {
      const dt = localToUtc('2024-01-01', '09:05');
      expect(formatLocalDate(dt)).toBe('2024-01-01');
      expect(formatLocalTime(dt)).toBe('09:05');
    });
  });

  describe('DST edge cases', () => {
    it('roundtrips DST spring-forward datetime', () => {
      const dt = localToUtc('2024-03-10', '03:00');
      expect(formatLocalDate(dt)).toBe('2024-03-10');
      expect(formatLocalTime(dt)).toBe('03:00');
    });

    it('roundtrips DST fall-back datetime', () => {
      const dt = localToUtc('2024-11-03', '01:30');
      expect(formatLocalDate(dt)).toBe('2024-11-03');
      expect(formatLocalTime(dt)).toBe('01:30');
    });
  });
});
