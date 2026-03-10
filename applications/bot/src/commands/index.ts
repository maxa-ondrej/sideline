import * as Ix from 'dfx/Interactions/index';
import { EventCreateCommand } from '~/commands/event-create.js';
import { EventListCommand } from '~/commands/event-list.js';

export const commandBuilder = Ix.builder.add(EventCreateCommand).add(EventListCommand);
