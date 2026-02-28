import { Discord } from 'dfx';

export interface Permission {
  allow?: bigint;
  deny?: bigint;
}

export const HIDDEN: Permission = {
  deny: Discord.Permissions.ViewChannel,
};

export const READ_ONLY: Permission = {
  allow: Discord.Permissions.ViewChannel,
  deny: Discord.Permissions.SendMessages,
};

export const READ_WRITE: Permission = {
  allow: Discord.Permissions.ViewChannel | Discord.Permissions.SendMessages,
};

export const MANAGE: Permission = {
  allow: Discord.Permissions.ViewChannel,
  deny: Discord.Permissions.SendMessages,
};
