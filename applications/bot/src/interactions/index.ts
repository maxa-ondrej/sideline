import * as Ix from 'dfx/Interactions/index';
import { AttendeesButton, AttendeesPageButton } from './attendees.js';
import { EventCreateModal } from './event-create.js';
import { EventCreateAutocomplete } from './event-create-autocomplete.js';
import { EventListPageButton } from './event-list.js';
import { RsvpButton, RsvpModal } from './rsvp.js';

export const interactionBuilder = Ix.builder
  .add(RsvpButton)
  .add(RsvpModal)
  .add(AttendeesButton)
  .add(AttendeesPageButton)
  .add(EventCreateModal)
  .add(EventListPageButton)
  .add(EventCreateAutocomplete);
