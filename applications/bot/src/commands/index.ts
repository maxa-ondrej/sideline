import * as Ix from 'dfx/Interactions/index';
import { PingCommand } from '~/commands/ping.js';

export const commandBuilder = Ix.builder.add(PingCommand);
