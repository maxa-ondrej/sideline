import * as Ix from 'dfx/Interactions/index';
import { AttendeesButton, AttendeesPageButton } from './attendees.js';
import { EventCreateModal } from './event-create.js';
import { RsvpButton, RsvpModal } from './rsvp.js';

export const interactionBuilder = Ix.builder
  .add(RsvpButton)
  .add(RsvpModal)
  .add(AttendeesButton)
  .add(AttendeesPageButton)
  .add(EventCreateModal);
