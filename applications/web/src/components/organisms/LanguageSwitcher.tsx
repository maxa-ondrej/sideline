import { Effect } from 'effect';
import { useCallback } from 'react';
import { ApiClient, ClientError, useRun } from '../../lib/runtime';
import { m } from '../../paraglide/messages.js';
import { getLocale, setLocale } from '../../paraglide/runtime.js';
import { LocaleSelect } from '../molecules/LocaleSelect';

export function LanguageSwitcher({ isAuthenticated }: { isAuthenticated: boolean }) {
  const run = useRun();
  const currentLocale = getLocale();

  const handleChange = useCallback(
    (locale: 'en' | 'cs') => {
      setLocale(locale);

      if (isAuthenticated) {
        ApiClient.pipe(
          Effect.flatMap((api) => api.auth.updateLocale({ payload: { locale } })),
          Effect.catchAll(() => ClientError.make(m.auth_errors_profileFailed())),
          run,
        );
      }
    },
    [isAuthenticated, run],
  );

  return <LocaleSelect currentLocale={currentLocale} onLocaleChange={handleChange} />;
}
