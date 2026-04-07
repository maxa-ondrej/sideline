import type { GroupApi, TeamApi, TeamSettingsApi } from '@sideline/domain';
import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import { MessageSquare, Settings, Users } from 'lucide-react';
import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import { DISCORD_CHANNEL_TYPE_CATEGORY, DISCORD_CHANNEL_TYPE_TEXT } from '~/lib/discord';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

interface TeamSettingsPageProps {
  teamId: string;
  settings: TeamSettingsApi.TeamSettingsInfo;
  discordChannels: ReadonlyArray<GroupApi.DiscordChannelInfo>;
  teamInfo: TeamApi.TeamInfo;
}

const NONE_VALUE = '__none__';
const DEFAULT_ROLE_FORMAT = '{emoji} {name}';
const DEFAULT_CHANNEL_FORMAT = '{emoji}\u2502{name}';

const isFormatValid = (format: string) => format.includes('{name}');

const renderFormatPreview = (format: string, isChannel: boolean) => {
  const emoji = '\u{1F3C0}';
  const name = isChannel ? 'seniors' : 'Seniors';
  return format.replaceAll('{emoji}', emoji).replaceAll('{name}', name).trim();
};

export function TeamSettingsPage({
  teamId,
  settings,
  discordChannels,
  teamInfo,
}: TeamSettingsPageProps) {
  const run = useRun();
  const router = useRouter();

  // Team profile state
  const [teamName, setTeamName] = React.useState(teamInfo.name);
  const [description, setDescription] = React.useState(
    Option.getOrElse(teamInfo.description, () => ''),
  );
  const [sport, setSport] = React.useState(Option.getOrElse(teamInfo.sport, () => ''));
  const [logoUrl, setLogoUrl] = React.useState(Option.getOrElse(teamInfo.logoUrl, () => ''));
  const [savingProfile, setSavingProfile] = React.useState(false);

  // General settings state
  const [horizonDays, setHorizonDays] = React.useState(String(settings.eventHorizonDays));
  const [minPlayersThreshold, setMinPlayersThreshold] = React.useState(
    String(settings.minPlayersThreshold),
  );
  const [rsvpReminderHours, setRsvpReminderHours] = React.useState(
    String(settings.rsvpReminderHours),
  );

  // Discord channels state
  const [channelTraining, setChannelTraining] = React.useState(
    Option.getOrElse(settings.discordChannelTraining, () => NONE_VALUE),
  );
  const [channelMatch, setChannelMatch] = React.useState(
    Option.getOrElse(settings.discordChannelMatch, () => NONE_VALUE),
  );
  const [channelTournament, setChannelTournament] = React.useState(
    Option.getOrElse(settings.discordChannelTournament, () => NONE_VALUE),
  );
  const [channelMeeting, setChannelMeeting] = React.useState(
    Option.getOrElse(settings.discordChannelMeeting, () => NONE_VALUE),
  );
  const [channelSocial, setChannelSocial] = React.useState(
    Option.getOrElse(settings.discordChannelSocial, () => NONE_VALUE),
  );
  const [channelOther, setChannelOther] = React.useState(
    Option.getOrElse(settings.discordChannelOther, () => NONE_VALUE),
  );
  const [channelLateRsvp, setChannelLateRsvp] = React.useState(
    Option.getOrElse(settings.discordChannelLateRsvp, () => NONE_VALUE),
  );
  const [archiveCategory, setArchiveCategory] = React.useState(
    Option.getOrElse(settings.discordArchiveCategoryId, () => NONE_VALUE),
  );
  const [cleanupOnGroupDelete, setCleanupOnGroupDelete] = React.useState<string>(
    settings.discordChannelCleanupOnGroupDelete,
  );
  const [cleanupOnRosterDeactivate, setCleanupOnRosterDeactivate] = React.useState<string>(
    settings.discordChannelCleanupOnRosterDeactivate,
  );
  const [createDiscordChannelOnGroup, setCreateDiscordChannelOnGroup] = React.useState(
    settings.createDiscordChannelOnGroup,
  );
  const [createDiscordChannelOnRoster, setCreateDiscordChannelOnRoster] = React.useState(
    settings.createDiscordChannelOnRoster,
  );
  const [roleFormat, setRoleFormat] = React.useState(settings.discordRoleFormat);
  const [channelFormat, setChannelFormat] = React.useState(settings.discordChannelFormat);
  const [savingSettings, setSavingSettings] = React.useState(false);

  const hasProfileChanges =
    teamName !== teamInfo.name ||
    description !== Option.getOrElse(teamInfo.description, () => '') ||
    sport !== Option.getOrElse(teamInfo.sport, () => '') ||
    logoUrl !== Option.getOrElse(teamInfo.logoUrl, () => '');

  const hasSettingsChanges =
    horizonDays !== String(settings.eventHorizonDays) ||
    minPlayersThreshold !== String(settings.minPlayersThreshold) ||
    rsvpReminderHours !== String(settings.rsvpReminderHours) ||
    channelTraining !== Option.getOrElse(settings.discordChannelTraining, () => NONE_VALUE) ||
    channelMatch !== Option.getOrElse(settings.discordChannelMatch, () => NONE_VALUE) ||
    channelTournament !== Option.getOrElse(settings.discordChannelTournament, () => NONE_VALUE) ||
    channelMeeting !== Option.getOrElse(settings.discordChannelMeeting, () => NONE_VALUE) ||
    channelSocial !== Option.getOrElse(settings.discordChannelSocial, () => NONE_VALUE) ||
    channelOther !== Option.getOrElse(settings.discordChannelOther, () => NONE_VALUE) ||
    channelLateRsvp !== Option.getOrElse(settings.discordChannelLateRsvp, () => NONE_VALUE) ||
    archiveCategory !== Option.getOrElse(settings.discordArchiveCategoryId, () => NONE_VALUE) ||
    cleanupOnGroupDelete !== settings.discordChannelCleanupOnGroupDelete ||
    cleanupOnRosterDeactivate !== settings.discordChannelCleanupOnRosterDeactivate ||
    createDiscordChannelOnGroup !== settings.createDiscordChannelOnGroup ||
    createDiscordChannelOnRoster !== settings.createDiscordChannelOnRoster ||
    roleFormat !== settings.discordRoleFormat ||
    channelFormat !== settings.discordChannelFormat;

  const channelToOption = React.useCallback(
    (value: string) =>
      value !== NONE_VALUE ? Option.some(Discord.Snowflake.make(value)) : Option.none(),
    [],
  );

  const handleSaveProfile = React.useCallback(async () => {
    if (!teamName.trim()) return;
    setSavingProfile(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.team.updateTeamInfo({
          path: { teamId: teamInfo.teamId },
          payload: {
            name: Option.some(teamName.trim()),
            description: Option.some(
              description.trim() ? Option.some(description.trim()) : Option.none(),
            ),
            sport: Option.some(sport.trim() ? Option.some(sport.trim()) : Option.none()),
            logoUrl: Option.some(logoUrl.trim() ? Option.some(logoUrl.trim()) : Option.none()),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.teamSettings_profileSaveFailed())),
      run({ success: m.teamSettings_profileSaved() }),
    );
    setSavingProfile(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamInfo.teamId, teamName, description, sport, logoUrl, run, router]);

  const handleSaveSettings = React.useCallback(async () => {
    const parsed = Number.parseInt(horizonDays, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 365) return;
    const parsedThreshold = Number.parseInt(minPlayersThreshold, 10);
    if (Number.isNaN(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 100) return;
    const parsedReminderHours = Number.parseInt(rsvpReminderHours, 10);
    if (Number.isNaN(parsedReminderHours) || parsedReminderHours < 0 || parsedReminderHours > 168)
      return;
    if (!isFormatValid(roleFormat) || !isFormatValid(channelFormat)) return;
    setSavingSettings(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.teamSettings.updateTeamSettings({
          path: { teamId: settings.teamId },
          payload: {
            eventHorizonDays: parsed,
            minPlayersThreshold: Option.some(parsedThreshold),
            rsvpReminderHours: Option.some(parsedReminderHours),
            discordChannelTraining: Option.some(channelToOption(channelTraining)),
            discordChannelMatch: Option.some(channelToOption(channelMatch)),
            discordChannelTournament: Option.some(channelToOption(channelTournament)),
            discordChannelMeeting: Option.some(channelToOption(channelMeeting)),
            discordChannelSocial: Option.some(channelToOption(channelSocial)),
            discordChannelOther: Option.some(channelToOption(channelOther)),
            discordChannelLateRsvp: Option.some(channelToOption(channelLateRsvp)),
            discordArchiveCategoryId: Option.some(channelToOption(archiveCategory)),
            discordChannelCleanupOnGroupDelete: Option.some(
              cleanupOnGroupDelete as 'nothing' | 'delete' | 'archive',
            ),
            discordChannelCleanupOnRosterDeactivate: Option.some(
              cleanupOnRosterDeactivate as 'nothing' | 'delete' | 'archive',
            ),
            createDiscordChannelOnGroup: Option.some(createDiscordChannelOnGroup),
            createDiscordChannelOnRoster: Option.some(createDiscordChannelOnRoster),
            discordRoleFormat: Option.some(roleFormat),
            discordChannelFormat: Option.some(channelFormat),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.teamSettings_saveFailed())),
      run({ success: m.teamSettings_saved() }),
    );
    setSavingSettings(false);
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
    channelLateRsvp,
    archiveCategory,
    cleanupOnGroupDelete,
    cleanupOnRosterDeactivate,
    createDiscordChannelOnGroup,
    createDiscordChannelOnRoster,
    roleFormat,
    channelFormat,
    run,
    router,
    channelToOption,
  ]);

  const channelConfigs = [
    {
      key: 'training',
      value: channelTraining,
      setter: setChannelTraining,
      label: m.teamSettings_channelTraining(),
    },
    {
      key: 'match',
      value: channelMatch,
      setter: setChannelMatch,
      label: m.teamSettings_channelMatch(),
    },
    {
      key: 'tournament',
      value: channelTournament,
      setter: setChannelTournament,
      label: m.teamSettings_channelTournament(),
    },
    {
      key: 'meeting',
      value: channelMeeting,
      setter: setChannelMeeting,
      label: m.teamSettings_channelMeeting(),
    },
    {
      key: 'social',
      value: channelSocial,
      setter: setChannelSocial,
      label: m.teamSettings_channelSocial(),
    },
    {
      key: 'other',
      value: channelOther,
      setter: setChannelOther,
      label: m.teamSettings_channelOther(),
    },
    {
      key: 'lateRsvp',
      value: channelLateRsvp,
      setter: setChannelLateRsvp,
      label: m.teamSettings_channelLateRsvp(),
    },
  ] as const;

  return (
    <div>
      <header className='mb-6'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId' params={{ teamId }}>
            ← {m.team_backToTeams()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{m.team_settings()}</h1>
      </header>

      <div className='flex flex-col gap-6 max-w-2xl'>
        {/* Team Profile */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Users className='size-4 text-muted-foreground' />
              <CardTitle className='text-base'>{m.teamSettings_teamProfile()}</CardTitle>
            </div>
            <CardDescription>{m.teamSettings_teamProfileDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex flex-col gap-5'>
              {logoUrl.trim() && (
                <div className='flex justify-center'>
                  <Avatar className='size-20'>
                    <AvatarImage src={logoUrl.trim()} alt={teamName} />
                    <AvatarFallback>{teamName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
              )}
              <div>
                <label htmlFor='team-name' className='text-sm font-medium mb-1 block'>
                  {m.teamSettings_teamName()}
                </label>
                <Input
                  id='team-name'
                  type='text'
                  maxLength={100}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor='team-description' className='text-sm font-medium mb-1 block'>
                  {m.teamSettings_description()}
                </label>
                <p className='text-xs text-muted-foreground mb-2'>
                  {m.teamSettings_descriptionHelp()}
                </p>
                <Textarea
                  id='team-description'
                  maxLength={500}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor='team-sport' className='text-sm font-medium mb-1 block'>
                  {m.teamSettings_sport()}
                </label>
                <p className='text-xs text-muted-foreground mb-2'>{m.teamSettings_sportHelp()}</p>
                <Input
                  id='team-sport'
                  type='text'
                  maxLength={50}
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor='team-logo-url' className='text-sm font-medium mb-1 block'>
                  {m.teamSettings_logoUrl()}
                </label>
                <p className='text-xs text-muted-foreground mb-2'>{m.teamSettings_logoUrlHelp()}</p>
                <Input
                  id='team-logo-url'
                  type='url'
                  maxLength={2048}
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder='https://...'
                />
              </div>
              <div className='flex items-center gap-3'>
                <Button onClick={handleSaveProfile} disabled={savingProfile || !hasProfileChanges}>
                  {savingProfile ? m.profile_saving() : m.profile_saveChanges()}
                </Button>
                {hasProfileChanges && (
                  <p className='text-sm text-muted-foreground'>{m.teamSettings_unsavedChanges()}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Settings className='size-4 text-muted-foreground' />
              <CardTitle className='text-base'>{m.teamSettings_generalTitle()}</CardTitle>
            </div>
            <CardDescription>{m.teamSettings_generalDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex flex-col gap-5'>
              <div>
                <label htmlFor='horizon-days' className='text-sm font-medium mb-1 block'>
                  {m.teamSettings_horizonDays()}
                </label>
                <p className='text-xs text-muted-foreground mb-2'>
                  {m.teamSettings_horizonDaysHelp()}
                </p>
                <Input
                  id='horizon-days'
                  type='number'
                  min={1}
                  max={365}
                  value={horizonDays}
                  onChange={(e) => setHorizonDays(e.target.value)}
                  className='max-w-32'
                />
              </div>
              <Separator />
              <div>
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
                  className='max-w-32'
                />
              </div>
              <Separator />
              <div>
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
                  className='max-w-32'
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discord Channel Defaults */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <MessageSquare className='size-4 text-muted-foreground' />
              <CardTitle className='text-base'>{m.teamSettings_discordChannels()}</CardTitle>
            </div>
            <CardDescription>{m.teamSettings_discordChannelsHelp()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex flex-col gap-6'>
              {/* Naming formats */}
              <div className='space-y-4'>
                <h4 className='font-medium'>{m.teamSettings_namingFormats()}</h4>
                <div className='grid gap-4'>
                  {/* Role format */}
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <Label>{m.teamSettings_roleFormat()}</Label>
                      {roleFormat !== DEFAULT_ROLE_FORMAT && (
                        <Button
                          variant='link'
                          size='sm'
                          className='h-auto p-0 text-xs'
                          onClick={() => setRoleFormat(DEFAULT_ROLE_FORMAT)}
                        >
                          {m.teamSettings_formatResetDefault()}
                        </Button>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {m.teamSettings_roleFormatHelp({ emoji: '{emoji}', name: '{name}' })}
                    </p>
                    <Input value={roleFormat} onChange={(e) => setRoleFormat(e.target.value)} />
                    <div className='text-xs text-muted-foreground'>
                      <span>{m.teamSettings_formatPreview()} </span>
                      <span className='font-mono'>{renderFormatPreview(roleFormat, false)}</span>
                    </div>
                    {!isFormatValid(roleFormat) && (
                      <p className='text-xs text-destructive'>
                        {m.teamSettings_formatMustIncludeName({ name: '{name}' })}
                      </p>
                    )}
                  </div>
                  {/* Channel format */}
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <Label>{m.teamSettings_channelFormat()}</Label>
                      {channelFormat !== DEFAULT_CHANNEL_FORMAT && (
                        <Button
                          variant='link'
                          size='sm'
                          className='h-auto p-0 text-xs'
                          onClick={() => setChannelFormat(DEFAULT_CHANNEL_FORMAT)}
                        >
                          {m.teamSettings_formatResetDefault()}
                        </Button>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {m.teamSettings_channelFormatHelp({ emoji: '{emoji}', name: '{name}' })}
                    </p>
                    <Input
                      value={channelFormat}
                      onChange={(e) => setChannelFormat(e.target.value)}
                    />
                    <div className='text-xs text-muted-foreground'>
                      <span>{m.teamSettings_formatPreview()} </span>
                      <span className='font-mono'>{renderFormatPreview(channelFormat, true)}</span>
                    </div>
                    {!isFormatValid(channelFormat) && (
                      <p className='text-xs text-destructive'>
                        {m.teamSettings_formatMustIncludeName({ name: '{name}' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Separator />

              {/* Event notification channels */}
              <div>
                <h4 className='text-sm font-semibold mb-3'>
                  {m.teamSettings_discordEventChannels()}
                </h4>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  {channelConfigs.map(({ key, value, setter, label }) => (
                    <div key={key}>
                      <label htmlFor={`channel-${key}`} className='text-sm font-medium mb-1 block'>
                        {label}
                      </label>
                      <Select value={value} onValueChange={setter}>
                        <SelectTrigger id={`channel-${key}`}>
                          <SelectValue placeholder={m.teamSettings_channelNone()} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>{m.teamSettings_channelNone()}</SelectItem>
                          {discordChannels
                            .filter((ch) => ch.type === DISCORD_CHANNEL_TYPE_TEXT)
                            .map((ch) => (
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

              <Separator />

              {/* Group channels sub-section */}
              <div className='flex flex-col gap-4'>
                <h4 className='text-sm font-semibold'>{m.teamSettings_groupChannelSettings()}</h4>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <label htmlFor='create-discord-channel' className='text-sm font-medium block'>
                      {m.teamSettings_createDiscordChannelOnGroup()}
                    </label>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {m.teamSettings_createDiscordChannelOnGroupHelp()}
                    </p>
                  </div>
                  <Switch
                    id='create-discord-channel'
                    checked={createDiscordChannelOnGroup}
                    onCheckedChange={setCreateDiscordChannelOnGroup}
                  />
                </div>
                <div>
                  <label
                    htmlFor='cleanup-on-group-delete'
                    className='text-sm font-medium mb-1 block'
                  >
                    {m.teamSettings_channelCleanupOnGroupDelete()}
                  </label>
                  <p className='text-xs text-muted-foreground mb-2'>
                    {m.teamSettings_channelCleanupOnGroupDeleteHelp()}
                  </p>
                  <Select value={cleanupOnGroupDelete} onValueChange={setCleanupOnGroupDelete}>
                    <SelectTrigger id='cleanup-on-group-delete'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='nothing'>{m.teamSettings_cleanupNothing()}</SelectItem>
                      <SelectItem value='delete'>{m.teamSettings_cleanupDelete()}</SelectItem>
                      <SelectItem value='archive'>{m.teamSettings_cleanupArchive()}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Roster channels sub-section */}
              <div className='flex flex-col gap-4'>
                <h4 className='text-sm font-semibold'>{m.teamSettings_rosterChannelSettings()}</h4>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <label
                      htmlFor='create-discord-channel-roster'
                      className='text-sm font-medium block'
                    >
                      {m.teamSettings_createDiscordChannelOnRoster()}
                    </label>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {m.teamSettings_createDiscordChannelOnRosterHelp()}
                    </p>
                  </div>
                  <Switch
                    id='create-discord-channel-roster'
                    checked={createDiscordChannelOnRoster}
                    onCheckedChange={setCreateDiscordChannelOnRoster}
                  />
                </div>
                <div>
                  <label
                    htmlFor='cleanup-on-roster-deactivate'
                    className='text-sm font-medium mb-1 block'
                  >
                    {m.teamSettings_channelCleanupOnRosterDeactivate()}
                  </label>
                  <p className='text-xs text-muted-foreground mb-2'>
                    {m.teamSettings_channelCleanupOnRosterDeactivateHelp()}
                  </p>
                  <Select
                    value={cleanupOnRosterDeactivate}
                    onValueChange={setCleanupOnRosterDeactivate}
                  >
                    <SelectTrigger id='cleanup-on-roster-deactivate'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='nothing'>{m.teamSettings_cleanupNothing()}</SelectItem>
                      <SelectItem value='delete'>{m.teamSettings_cleanupDelete()}</SelectItem>
                      <SelectItem value='archive'>{m.teamSettings_cleanupArchive()}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Archive category (shared, shown when either mode is archive) */}
              {(cleanupOnGroupDelete === 'archive' || cleanupOnRosterDeactivate === 'archive') && (
                <>
                  <Separator />
                  <div>
                    <label htmlFor='archive-category' className='text-sm font-medium mb-1 block'>
                      {m.teamSettings_archiveCategory()}
                    </label>
                    <p className='text-xs text-muted-foreground mb-2'>
                      {m.teamSettings_archiveCategoryHelp()}
                    </p>
                    <Select value={archiveCategory} onValueChange={setArchiveCategory}>
                      <SelectTrigger id='archive-category'>
                        <SelectValue placeholder={m.teamSettings_channelNone()} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>{m.teamSettings_channelNone()}</SelectItem>
                        {discordChannels
                          .filter((ch) => ch.type === DISCORD_CHANNEL_TYPE_CATEGORY)
                          .map((ch) => (
                            <SelectItem key={ch.id} value={ch.id}>
                              {ch.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings save button */}
        <div className='flex items-center gap-3'>
          <Button onClick={handleSaveSettings} disabled={savingSettings || !hasSettingsChanges}>
            {savingSettings ? m.profile_saving() : m.profile_saveChanges()}
          </Button>
          {hasSettingsChanges && (
            <p className='text-sm text-muted-foreground'>{m.teamSettings_unsavedChanges()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
