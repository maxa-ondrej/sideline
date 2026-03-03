import type { TeamSettingsApi } from '@sideline/domain';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

interface TeamSettingsPageProps {
  teamId: string;
  settings: TeamSettingsApi.TeamSettingsInfo;
}

export function TeamSettingsPage({ teamId, settings }: TeamSettingsPageProps) {
  const run = useRun();
  const router = useRouter();
  const [horizonDays, setHorizonDays] = React.useState(String(settings.eventHorizonDays));
  const [saving, setSaving] = React.useState(false);

  const handleSave = React.useCallback(async () => {
    const parsed = Number.parseInt(horizonDays, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 365) return;
    setSaving(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.teamSettings.updateTeamSettings({
          path: { teamId: settings.teamId },
          payload: { eventHorizonDays: parsed },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.teamSettings_saveFailed())),
      run,
    );
    setSaving(false);
    if (Option.isSome(result)) {
      toast.success(m.teamSettings_saved());
      router.invalidate();
    }
  }, [settings.teamId, horizonDays, run, router]);

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId' params={{ teamId }}>
            ← {m.team_backToTeams()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{m.team_settings()}</h1>
      </header>

      <div className='max-w-md'>
        <label htmlFor='horizon-days' className='text-sm font-medium mb-1 block'>
          {m.teamSettings_horizonDays()}
        </label>
        <p className='text-xs text-muted-foreground mb-2'>{m.teamSettings_horizonDaysHelp()}</p>
        <div className='flex gap-2'>
          <Input
            id='horizon-days'
            type='number'
            min={1}
            max={365}
            value={horizonDays}
            onChange={(e) => setHorizonDays(e.target.value)}
            className='flex-1'
          />
          <Button
            onClick={handleSave}
            disabled={saving || horizonDays === String(settings.eventHorizonDays)}
          >
            {saving ? m.profile_saving() : m.profile_saveChanges()}
          </Button>
        </div>
      </div>
    </div>
  );
}
