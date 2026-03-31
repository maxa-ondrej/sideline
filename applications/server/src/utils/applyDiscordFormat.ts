import { Option } from 'effect';

export const DEFAULT_ROLE_FORMAT = '{emoji} {name}';
export const DEFAULT_CHANNEL_FORMAT = '{emoji}\u2502{name}';

/** Apply a Discord name format template. When emoji is None, {emoji} is removed and separators are cleaned up. */
export const applyDiscordFormat = (
  template: string,
  name: string,
  emoji: Option.Option<string>,
): string => {
  const emojiStr = Option.getOrElse(emoji, () => '');
  if (emojiStr === '') {
    // Remove {emoji} and any adjacent whitespace, then clean leading separator chars
    const result = template
      .replace(/\{emoji\}\s*/g, '')
      .replace(/\s*\{emoji\}/g, '')
      .replaceAll('{name}', name)
      .trim();
    // Clean any leading/trailing separator chars (│, |) left when emoji is absent
    return result.replace(/^[\u2502|]+|[\u2502|]+$/g, '').trim();
  }
  return template.replaceAll('{emoji}', emojiStr).replaceAll('{name}', name).trim();
};
