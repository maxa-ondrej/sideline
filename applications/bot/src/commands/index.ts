import * as Ix from 'dfx/Interactions/index';
import { EventCommand } from '~/commands/event/index.js';
import { MakanickoCommand } from '~/commands/makanicko/index.js';

export const commandBuilder = Ix.builder.add(EventCommand).add(MakanickoCommand);
