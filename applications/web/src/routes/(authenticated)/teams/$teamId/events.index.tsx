import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { EventsListPage } from '~/components/pages/EventsListPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/events/')({
  ssr: false,
  component: EventsRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all({
          eventList: api.event.listEvents({ path: { teamId } }),
          trainingTypes: api.trainingType.listTrainingTypes({ path: { teamId } }),
          discordChannels: api.group
            .listDiscordChannels({ path: { teamId } })
            .pipe(Effect.catchAll(() => Effect.succeed([] as const))),
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

function EventsRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const data = Route.useLoaderData();

  return (
    <EventsListPage
      teamId={teamIdRaw}
      events={data.eventList.events}
      canCreate={data.eventList.canCreate}
      trainingTypes={data.trainingTypes.trainingTypes}
      discordChannels={data.discordChannels}
      groups={data.groups}
    />
  );
}
