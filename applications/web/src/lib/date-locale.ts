import { getLocale } from '@sideline/i18n/runtime';
import type { Locale } from 'date-fns';
import { cs } from 'date-fns/locale/cs';
import { enUS } from 'date-fns/locale/en-US';

const localeMap: Record<string, Locale> = {
  en: enUS,
  cs: cs,
};

/** Get the date-fns Locale object matching the current Paraglide app locale. */
export function getDateFnsLocale(): Locale {
  return localeMap[getLocale()] ?? enUS;
}
