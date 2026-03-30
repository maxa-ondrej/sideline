import { describe, expect, it } from '@effect/vitest';
import { cs } from 'date-fns/locale/cs';
import { enUS } from 'date-fns/locale/en-US';
import { vi } from 'vitest';

vi.mock('@sideline/i18n/runtime', () => ({
  getLocale: vi.fn(),
}));

// Import after mock is set up
const { getLocale } = await import('@sideline/i18n/runtime');
const { getDateFnsLocale } = await import('~/lib/date-locale.js');

describe('getDateFnsLocale', () => {
  it('returns enUS locale when app locale is "en"', () => {
    vi.mocked(getLocale).mockReturnValue('en');
    expect(getDateFnsLocale()).toBe(enUS);
  });

  it('returns cs locale when app locale is "cs"', () => {
    vi.mocked(getLocale).mockReturnValue('cs');
    expect(getDateFnsLocale()).toBe(cs);
  });

  it('falls back to enUS for unknown locale', () => {
    // Cast needed to simulate a runtime value outside the known union
    vi.mocked(getLocale).mockReturnValue('fr' as 'en');
    expect(getDateFnsLocale()).toBe(enUS);
  });
});
