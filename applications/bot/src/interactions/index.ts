import * as Ix from 'dfx/Interactions/index';
import { RsvpButton, RsvpModal } from './rsvp.js';

export const interactionBuilder = Ix.builder.add(RsvpButton).add(RsvpModal);
