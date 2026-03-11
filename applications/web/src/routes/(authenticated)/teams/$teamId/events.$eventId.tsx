import { Event, Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { EventDetailPage } from '~/components/pages/EventDetailPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/events/$eventId')({
  ssr: false,
  component: EventDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const eventId = Schema.decodeSync(Event.EventId)(params.eventId);
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all({
          event: api.event.getEvent({ path: { teamId, eventId } }),
          trainingTypes: api.trainingType.listTrainingTypes({ path: { teamId } }),
          rsvpDetail: api.eventRsvp.getRsvps({ path: { teamId, eventId } }),
          discordChannels: api.group
            .listDiscordChannels({ path: { teamId } })
            .pipe(Effect.catchAll(() => Effect.succeed([] as const))),
          nonResponders: api.eventRsvp
            .getNonResponders({ path: { teamId, eventId } })
            .pipe(Effect.catchAll(() => Effect.succeed({ nonResponders: [] }))),
          groups: api.group
            .listGroups({ path: { teamId } })
            .pipe(Effect.catchAll(() => Effect.succeed([] as const))),
        }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function EventDetailRoute() {
  const { teamId: teamIdRaw, eventId: eventIdRaw } = Route.useParams();
  const data = Route.useLoaderData();

  return (
    <EventDetailPage
      teamId={teamIdRaw}
      eventId={eventIdRaw}
      eventDetail={data.event}
      trainingTypes={data.trainingTypes.trainingTypes}
      rsvpDetail={data.rsvpDetail}
      discordChannels={data.discordChannels}
      nonResponders={data.nonResponders.nonResponders}
      groups={data.groups}
    />
  );
}
