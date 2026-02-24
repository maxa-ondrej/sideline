import { m } from '../../paraglide/messages.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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

interface LocaleSelectProps {
  currentLocale: 'en' | 'cs';
  onLocaleChange: (locale: 'en' | 'cs') => void;
}

export function LocaleSelect({ currentLocale, onLocaleChange }: LocaleSelectProps) {
  return (
    <Select value={currentLocale} onValueChange={onLocaleChange}>
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
