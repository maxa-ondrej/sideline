import { describe, expect, it } from '@effect/vitest';
import { Schema } from 'effect';
import * as EventApi from '~/api/EventApi.js';

describe('EventImageUrl — validation', () => {
  it('accepts a valid public https URL', () => {
    const result = Schema.decodeUnknownSync(EventApi.EventImageUrl)(
      'https://example.com/cover.png',
    );
    expect(result).toBe('https://example.com/cover.png');
  });

  it('accepts an Unsplash URL', () => {
    const result = Schema.decodeUnknownSync(EventApi.EventImageUrl)(
      'https://images.unsplash.com/photo-123?auto=format',
    );
    expect(result).toBe('https://images.unsplash.com/photo-123?auto=format');
  });

  it('accepts a Discord CDN URL', () => {
    const result = Schema.decodeUnknownSync(EventApi.EventImageUrl)(
      'https://cdn.discordapp.com/attachments/123/456/cover.png',
    );
    expect(result).toBe('https://cdn.discordapp.com/attachments/123/456/cover.png');
  });

  it('rejects http:// URLs', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('http://example.com/cover.png'),
    ).toThrow();
  });

  it('rejects IPv6 loopback [::1]', () => {
    expect(() => Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://[::1]/x.png')).toThrow();
  });

  it('rejects IPv6-mapped IPv4 loopback [::ffff:127.0.0.1]', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://[::ffff:127.0.0.1]/x.png'),
    ).toThrow();
  });

  it('rejects unique-local fc00::/7 address [fc00::1]', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://[fc00::1]/x.png'),
    ).toThrow();
  });

  it('rejects unique-local fd00::/7 address [fd00::1]', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://[fd00::1]/x.png'),
    ).toThrow();
  });

  it('rejects link-local address [fe80::1]', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://[fe80::1]/x.png'),
    ).toThrow();
  });

  it('rejects IPv4 loopback 127.0.0.1', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://127.0.0.1/x.png'),
    ).toThrow();
  });

  it('rejects RFC1918 10.x.x.x', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://10.0.0.1/x.png'),
    ).toThrow();
  });

  it('rejects RFC1918 192.168.x.x', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://192.168.1.1/x.png'),
    ).toThrow();
  });

  it('rejects localhost', () => {
    expect(() =>
      Schema.decodeUnknownSync(EventApi.EventImageUrl)('https://localhost/x.png'),
    ).toThrow();
  });

  it('rejects URLs longer than 2048 characters', () => {
    const longUrl = `https://example.com/${'a'.repeat(2050)}`;
    expect(() => Schema.decodeUnknownSync(EventApi.EventImageUrl)(longUrl)).toThrow();
  });
});
