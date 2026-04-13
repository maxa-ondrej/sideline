import { m } from '@sideline/i18n/messages';
import { getLocale, setLocale } from '@sideline/i18n/runtime';
import { Effect } from 'effect';
import { useCallback } from 'react';
import { LocaleSelect } from '~/components/molecules/LocaleSelect';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

export function LanguageSwitcher({ isAuthenticated }: { isAuthenticated: boolean }) {
  const run = useRun();
  const currentLocale = getLocale();

  const handleChange = useCallback(
    (locale: 'en' | 'cs') => {
      setLocale(locale);

      if (isAuthenticated) {
        ApiClient.asEffect().pipe(
          Effect.flatMap((api) => api.auth.updateLocale({ payload: { locale } })),
          Effect.catchAll(() => ClientError.make(m.auth_errors_profileFailed())),
          run(),
        );
      }
    },
    [isAuthenticated, run],
  );

  return <LocaleSelect currentLocale={currentLocale} onLocaleChange={handleChange} />;
}
