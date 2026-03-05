export type Locale = 'en' | 'cs';

/** For permanent messages (visible to whole guild): use guild language */
export const guildLocale = (interaction: { guild_locale?: string }): Locale =>
  interaction.guild_locale?.startsWith('cs') ? 'cs' : 'en';

/** For ephemeral messages (visible only to user): use user's Discord client language */
export const userLocale = (interaction: { locale?: string; guild_locale?: string }): Locale =>
  (interaction.locale?.startsWith('cs') ? 'cs' : undefined) ?? guildLocale(interaction);
