import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('APP_VERSION', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.APP_VERSION;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('prefers process.env.APP_VERSION when set and non-empty', async () => {
    process.env.APP_VERSION = 'v9.9.9';

    const { APP_VERSION } = await import('~/version.js');

    expect(APP_VERSION).toBe('v9.9.9');
  });

  it('falls back to the package.json version when APP_VERSION is unset', async () => {
    delete process.env.APP_VERSION;

    const { APP_VERSION } = await import('~/version.js');

    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
    expect(APP_VERSION).not.toBe('v9.9.9');
  });

  it('falls back to the package.json version when APP_VERSION is an empty string', async () => {
    process.env.APP_VERSION = '';

    const { APP_VERSION } = await import('~/version.js');

    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});
