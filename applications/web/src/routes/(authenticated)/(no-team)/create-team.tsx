import type { Auth } from '@sideline/domain';
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { CreateTeamPage } from '~/components/pages/CreateTeamPage';
import { setLastTeamId } from '~/lib/auth';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/(no-team)/create-team')({
  component: CreateTeamRoute,
  beforeLoad: ({ context }) => {
    if (!context.user.isProfileComplete) {
      throw redirect({ to: '/profile/complete' });
    }
  },
});

function CreateTeamRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const run = useRun();
  const { environment } = Route.useRouteContext();
  const [guilds, setGuilds] = React.useState<readonly Auth.DiscordGuild[]>([]);
  const [loadingGuilds, setLoadingGuilds] = React.useState(true);

  const fetchGuilds = React.useCallback(async () => {
    setLoadingGuilds(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) => api.auth.myGuilds()),
      Effect.catchAll(() => Effect.succeed([] as readonly Auth.DiscordGuild[])),
      run,
    );
    if (Option.isSome(result)) {
      setGuilds(result.value);
    }
    setLoadingGuilds(false);
  }, [run]);

  React.useEffect(() => {
    fetchGuilds();
  }, [fetchGuilds]);

  const handleCreateTeam = React.useCallback(
    async (name: string, guildId: string) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.auth.createTeam({
            payload: { name, guildId: guildId as Auth.CreateTeamRequest['guildId'] },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.dashboard_createFailed())),
        run,
      );
      if (Option.isSome(result)) {
        const teamId = result.value.teamId;
        Effect.runSync(setLastTeamId(teamId));
        router.invalidate();
        navigate({ to: '/teams/$teamId', params: { teamId } });
        return true;
      }
      return false;
    },
    [run, router, navigate],
  );

  return (
    <CreateTeamPage
      guilds={guilds}
      loadingGuilds={loadingGuilds}
      discordClientId={environment.DISCORD_CLIENT_ID}
      onCreateTeam={handleCreateTeam}
      onRefreshGuilds={fetchGuilds}
    />
  );
}
