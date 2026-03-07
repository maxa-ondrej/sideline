import * as Ix from 'dfx/Interactions/index';
import { EventCreateCommand } from '~/commands/event-create.js';
import { PingCommand } from '~/commands/ping.js';

export const commandBuilder = Ix.builder.add(PingCommand).add(EventCreateCommand);
