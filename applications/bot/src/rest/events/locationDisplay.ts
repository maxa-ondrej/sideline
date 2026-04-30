import { EventApi } from '@sideline/domain';
import { Option } from 'effect';

const escapeMd = (s: string): string => s.replace(/\\/g, '\\\\').replace(/]/g, '\\]');

export const locationDisplay = (
  text: Option.Option<string>,
  url: Option.Option<string>,
): Option.Option<string> => {
  if (Option.isNone(text)) {
    return Option.none();
  }
  if (Option.isNone(url)) {
    return Option.some(text.value);
  }
  if (!EventApi.isPublicHttpsUrl(url.value)) {
    return Option.some(text.value);
  }
  return Option.some(`[${escapeMd(text.value)}](<${url.value}>)`);
};
