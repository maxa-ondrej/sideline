export const hexColorToDiscordInt = (hex: string): number =>
  Number.parseInt(hex.replace('#', ''), 16);
