import { getDateFnsLocale } from '~/lib/date-locale';

/** React hook returning the date-fns Locale for the current app locale. */
export function useDateFnsLocale() {
  return getDateFnsLocale();
}
