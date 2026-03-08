import type { GroupApi, TeamSettingsApi } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

interface TeamSettingsPageProps {
  teamId: string;
  settings: TeamSettingsApi.TeamSettingsInfo;
  discordChannels: ReadonlyArray<GroupApi.DiscordChannelInfo>;
}

export function TeamSettingsPage({ teamId, settings, discordChannels }: TeamSettingsPageProps) {
  const run = useRun();
  const router = useRouter();
  const [horizonDays, setHorizonDays] = React.useState(String(settings.eventHorizonDays));
  const [minPlayersThreshold, setMinPlayersThreshold] = React.useState(
    String(settings.minPlayersThreshold),
  );
  const [rsvpReminderHours, setRsvpReminderHours] = React.useState(
    String(settings.rsvpReminderHours),
  );
  const [saving, setSaving] = React.useState(false);
  const [channelTraining, setChannelTraining] = React.useState(
    settings.discordChannelTraining ?? '__none__',
  );
  const [channelMatch, setChannelMatch] = React.useState(
    settings.discordChannelMatch ?? '__none__',
  );
  const [channelTournament, setChannelTournament] = React.useState(
    settings.discordChannelTournament ?? '__none__',
  );
  const [channelMeeting, setChannelMeeting] = React.useState(
    settings.discordChannelMeeting ?? '__none__',
  );
  const [channelSocial, setChannelSocial] = React.useState(
    settings.discordChannelSocial ?? '__none__',
  );
  const [channelOther, setChannelOther] = React.useState(
    settings.discordChannelOther ?? '__none__',
  );

  const handleSave = React.useCallback(async () => {
    const parsed = Number.parseInt(horizonDays, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 365) return;
    const parsedThreshold = Number.parseInt(minPlayersThreshold, 10);
    if (Number.isNaN(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 100) return;
    const parsedReminderHours = Number.parseInt(rsvpReminderHours, 10);
    if (Number.isNaN(parsedReminderHours) || parsedReminderHours < 0 || parsedReminderHours > 168)
      return;
    setSaving(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.teamSettings.updateTeamSettings({
          path: { teamId: settings.teamId },
          payload: {
            eventHorizonDays: parsed,
            minPlayersThreshold: Option.some(parsedThreshold),
            rsvpReminderHours: Option.some(parsedReminderHours),
            discordChannelTraining: Option.some(
              channelTraining !== '__none__' ? Option.some(channelTraining) : Option.none(),
            ),
            discordChannelMatch: Option.some(
              channelMatch !== '__none__' ? Option.some(channelMatch) : Option.none(),
            ),
            discordChannelTournament: Option.some(
              channelTournament !== '__none__' ? Option.some(channelTournament) : Option.none(),
            ),
            discordChannelMeeting: Option.some(
              channelMeeting !== '__none__' ? Option.some(channelMeeting) : Option.none(),
            ),
            discordChannelSocial: Option.some(
              channelSocial !== '__none__' ? Option.some(channelSocial) : Option.none(),
            ),
            discordChannelOther: Option.some(
              channelOther !== '__none__' ? Option.some(channelOther) : Option.none(),
            ),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.teamSettings_saveFailed())),
      run({ success: m.teamSettings_saved() }),
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [
    settings.teamId,
    horizonDays,
    minPlayersThreshold,
    rsvpReminderHours,
    channelTraining,
    channelMatch,
    channelTournament,
    channelMeeting,
    channelSocial,
    channelOther,
    run,
    router,
  ]);

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
            disabled={
              saving ||
              (horizonDays === String(settings.eventHorizonDays) &&
                minPlayersThreshold === String(settings.minPlayersThreshold) &&
                rsvpReminderHours === String(settings.rsvpReminderHours) &&
                channelTraining === (settings.discordChannelTraining ?? '__none__') &&
                channelMatch === (settings.discordChannelMatch ?? '__none__') &&
                channelTournament === (settings.discordChannelTournament ?? '__none__') &&
                channelMeeting === (settings.discordChannelMeeting ?? '__none__') &&
                channelSocial === (settings.discordChannelSocial ?? '__none__') &&
                channelOther === (settings.discordChannelOther ?? '__none__'))
            }
          >
            {saving ? m.profile_saving() : m.profile_saveChanges()}
          </Button>
        </div>
        <div className='mt-6'>
          <label htmlFor='min-players' className='text-sm font-medium mb-1 block'>
            {m.teamSettings_minPlayersThreshold()}
          </label>
          <p className='text-xs text-muted-foreground mb-2'>
            {m.teamSettings_minPlayersThresholdHelp()}
          </p>
          <Input
            id='min-players'
            type='number'
            min={0}
            max={100}
            value={minPlayersThreshold}
            onChange={(e) => setMinPlayersThreshold(e.target.value)}
            className='flex-1'
          />
        </div>

        <div className='mt-6'>
          <label htmlFor='rsvp-reminder-hours' className='text-sm font-medium mb-1 block'>
            {m.teamSettings_rsvpReminderHours()}
          </label>
          <p className='text-xs text-muted-foreground mb-2'>
            {m.teamSettings_rsvpReminderHoursHelp()}
          </p>
          <Input
            id='rsvp-reminder-hours'
            type='number'
            min={0}
            max={168}
            value={rsvpReminderHours}
            onChange={(e) => setRsvpReminderHours(e.target.value)}
            className='flex-1'
          />
        </div>

        <div className='mt-8'>
          <h2 className='text-lg font-semibold mb-2'>{m.teamSettings_discordChannels()}</h2>
          <p className='text-xs text-muted-foreground mb-4'>
            {m.teamSettings_discordChannelsHelp()}
          </p>
          <div className='flex flex-col gap-4'>
            {(
              [
                [
                  'channelTraining',
                  channelTraining,
                  setChannelTraining,
                  m.teamSettings_channelTraining(),
                ],
                ['channelMatch', channelMatch, setChannelMatch, m.teamSettings_channelMatch()],
                [
                  'channelTournament',
                  channelTournament,
                  setChannelTournament,
                  m.teamSettings_channelTournament(),
                ],
                [
                  'channelMeeting',
                  channelMeeting,
                  setChannelMeeting,
                  m.teamSettings_channelMeeting(),
                ],
                ['channelSocial', channelSocial, setChannelSocial, m.teamSettings_channelSocial()],
                ['channelOther', channelOther, setChannelOther, m.teamSettings_channelOther()],
              ] as const
            ).map(([key, value, setter, label]) => (
              <div key={key}>
                <label htmlFor={`channel-${key}`} className='text-sm font-medium mb-1 block'>
                  {label}
                </label>
                <Select value={value} onValueChange={setter}>
                  <SelectTrigger id={`channel-${key}`}>
                    <SelectValue placeholder={m.teamSettings_channelNone()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>{m.teamSettings_channelNone()}</SelectItem>
                    {discordChannels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        # {ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
