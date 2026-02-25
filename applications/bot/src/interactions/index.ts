import * as Ix from 'dfx/Interactions/index';

// Component interaction registry for buttons, selects, and modals.
// Add handlers here using Ix.messageComponent() or Ix.modalSubmit()
// with Ix.id(), Ix.idStartsWith(), or Ix.idRegex() as predicates.
//
// Example:
//   const ConfirmButton = Ix.messageComponent(
//     Ix.idStartsWith('confirm:'),
//     MessageComponentData.pipe(
//       Effect.map((data) =>
//         Ix.response({
//           type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
//           data: { content: 'Confirmed!' },
//         }),
//       ),
//     ),
//   );
//   export const interactionBuilder = Ix.builder.add(ConfirmButton);

export const interactionBuilder = Ix.builder;
