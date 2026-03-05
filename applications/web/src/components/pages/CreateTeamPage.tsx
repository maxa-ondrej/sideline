import type { Auth } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import React from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

type Step = 'select-guild' | 'invite-bot' | 'name-team';

interface CreateTeamPageProps {
  guilds: readonly Auth.DiscordGuild[];
  loadingGuilds: boolean;
  discordClientId: string;
  onCreateTeam: (name: string, guildId: string) => Promise<boolean>;
  onRefreshGuilds: () => Promise<void>;
}

function guildIconUrl(guildId: string, icon: string | null): string | undefined {
  if (!icon) return undefined;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=64`;
}

export function CreateTeamPage({
  guilds,
  loadingGuilds,
  discordClientId,
  onCreateTeam,
  onRefreshGuilds,
}: CreateTeamPageProps) {
  const [step, setStep] = React.useState<Step>('select-guild');
  const [selectedGuild, setSelectedGuild] = React.useState<Auth.DiscordGuild | null>(null);
  const [teamName, setTeamName] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const handleSelectGuild = React.useCallback((guild: Auth.DiscordGuild) => {
    setSelectedGuild(guild);
    if (guild.botPresent) {
      setStep('name-team');
    } else {
      setStep('invite-bot');
    }
  }, []);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await onRefreshGuilds();
    setRefreshing(false);
  }, [onRefreshGuilds]);

  React.useEffect(() => {
    if (step === 'invite-bot' && selectedGuild) {
      const updated = guilds.find((g) => g.id === selectedGuild.id);
      if (updated) {
        setSelectedGuild(updated);
        if (updated.botPresent) {
          setStep('name-team');
        }
      }
    }
  }, [guilds, step, selectedGuild]);

  const handleCreate = React.useCallback(async () => {
    if (!teamName.trim() || !selectedGuild) return;
    setCreating(true);
    const success = await onCreateTeam(teamName.trim(), selectedGuild.id);
    setCreating(false);
    if (success) {
      setTeamName('');
    }
  }, [teamName, selectedGuild, onCreateTeam]);

  const botInviteUrl = selectedGuild
    ? `https://discord.com/oauth2/authorize?client_id=${discordClientId}&permissions=8&scope=bot%20applications.commands&guild_id=${selectedGuild.id}`
    : '';

  return (
    <div>
      <header className='mb-8'>
        <h1 className='text-2xl font-bold'>{m.dashboard_createTeam()}</h1>
      </header>

      {step === 'select-guild' && (
        <section className='max-w-lg'>
          <h2 className='text-lg font-semibold mb-1'>{m.guild_selectServer()}</h2>
          <p className='text-sm text-muted-foreground mb-4'>{m.guild_selectServerDescription()}</p>

          {loadingGuilds ? (
            <p className='text-sm text-muted-foreground'>{m.guild_loadingGuilds()}</p>
          ) : guilds.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{m.guild_noGuilds()}</p>
          ) : (
            <div className='space-y-2'>
              {guilds.map((guild) => (
                <button
                  key={guild.id}
                  type='button'
                  className='flex items-center gap-3 w-full rounded-lg border p-3 text-left hover:bg-accent transition-colors'
                  onClick={() => handleSelectGuild(guild)}
                >
                  {guildIconUrl(guild.id, guild.icon) ? (
                    <img
                      src={guildIconUrl(guild.id, guild.icon)}
                      alt=''
                      className='w-10 h-10 rounded-full'
                    />
                  ) : (
                    <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium'>
                      {guild.name.charAt(0)}
                    </div>
                  )}
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium truncate'>{guild.name}</div>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                      {guild.owner && <span>{m.guild_owner()}</span>}
                      {guild.botPresent ? (
                        <span className='text-green-600'>{m.guild_botPresent()}</span>
                      ) : (
                        <span className='text-amber-600'>{m.guild_botNotPresent()}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 'invite-bot' && selectedGuild && (
        <section className='max-w-lg'>
          <h2 className='text-lg font-semibold mb-1'>{m.guild_inviteBot()}</h2>
          <p className='text-sm text-muted-foreground mb-4'>{m.guild_inviteBotDescription()}</p>

          <div className='flex items-center gap-3 rounded-lg border p-3 mb-4'>
            {guildIconUrl(selectedGuild.id, selectedGuild.icon) ? (
              <img
                src={guildIconUrl(selectedGuild.id, selectedGuild.icon)}
                alt=''
                className='w-10 h-10 rounded-full'
              />
            ) : (
              <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium'>
                {selectedGuild.name.charAt(0)}
              </div>
            )}
            <span className='font-medium'>{selectedGuild.name}</span>
          </div>

          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => setStep('select-guild')}>
              {m.guild_back()}
            </Button>
            <Button asChild>
              <a href={botInviteUrl} target='_blank' rel='noopener noreferrer'>
                {m.guild_inviteBotButton()}
              </a>
            </Button>
            <Button variant='secondary' onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? m.guild_refreshing() : m.guild_refreshGuilds()}
            </Button>
          </div>
        </section>
      )}

      {step === 'name-team' && selectedGuild && (
        <section className='max-w-lg'>
          <h2 className='text-lg font-semibold mb-1'>{m.guild_nameTeam()}</h2>

          <div className='flex items-center gap-3 rounded-lg border p-3 mb-4'>
            {guildIconUrl(selectedGuild.id, selectedGuild.icon) ? (
              <img
                src={guildIconUrl(selectedGuild.id, selectedGuild.icon)}
                alt=''
                className='w-10 h-10 rounded-full'
              />
            ) : (
              <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium'>
                {selectedGuild.name.charAt(0)}
              </div>
            )}
            <div>
              <div className='font-medium'>{selectedGuild.name}</div>
              <span className='text-xs text-green-600'>{m.guild_botPresent()}</span>
            </div>
          </div>

          <div className='flex gap-2'>
            <Input
              placeholder={m.dashboard_teamNamePlaceholder()}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
            <Button onClick={handleCreate} disabled={creating || !teamName.trim()}>
              {creating ? m.dashboard_creating() : m.dashboard_createTeam()}
            </Button>
          </div>

          <div className='mt-2'>
            <Button variant='ghost' size='sm' onClick={() => setStep('select-guild')}>
              {m.guild_back()}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
