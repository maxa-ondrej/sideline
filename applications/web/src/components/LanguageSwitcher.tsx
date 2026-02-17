import { Effect } from 'effect';
import { useCallback } from 'react';
import { ApiClient, runPromise } from '../lib/runtime';
import { m } from '../paraglide/messages.js';
import { getLocale, setLocale } from '../paraglide/runtime.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const locales = [
  { value: 'en' as const, flag: '🇬🇧' },
  { value: 'cs' as const, flag: '🇨🇿' },
] as const;

const localeLabel = (locale: 'en' | 'cs') => {
  switch (locale) {
    case 'en':
      return m.language_en();
    case 'cs':
      return m.language_cs();
  }
};

export function LanguageSwitcher({ isAuthenticated }: { isAuthenticated: boolean }) {
  const currentLocale = getLocale();

  const handleChange = useCallback(
    (value: string) => {
      const locale = value as 'en' | 'cs';
      setLocale(locale);

      if (isAuthenticated) {
        ApiClient.pipe(
          Effect.flatMap((api) => api.auth.updateLocale({ payload: { locale } })),
          Effect.catchAll(() => Effect.void),
          runPromise(),
        ).catch(() => {});
      }
    },
    [isAuthenticated],
  );

  return (
    <Select value={currentLocale} onValueChange={handleChange}>
      <SelectTrigger size='sm' className='w-auto gap-1.5'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc.value} value={loc.value}>
            {loc.flag} {localeLabel(loc.value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
