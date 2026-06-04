import type { ChannelApi, GroupApi } from '@sideline/domain';
import { Link, useRouter } from '@tanstack/react-router';
import { Option } from 'effect';
import { MoreHorizontal } from 'lucide-react';
import React from 'react';
import { DiscordChannelLink } from '~/components/atoms/DiscordChannelLink.js';
import { ArchiveChannelDialog } from '~/components/organisms/ArchiveChannelDialog.js';
import { ChannelAccessSheet } from '~/components/organisms/ChannelAccessSheet.js';
import { CreateChannelDialog } from '~/components/organisms/CreateChannelDialog.js';
import { RenameChannelDialog } from '~/components/organisms/RenameChannelDialog.js';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Skeleton } from '~/components/ui/skeleton';
import { tr } from '~/lib/translations.js';

interface ChannelManagementPageProps {
  teamId: string;
  guildId: Option.Option<string>;
  data: ChannelApi.ChannelListResponse | null;
  allGroups: ReadonlyArray<GroupApi.GroupInfo>;
}

type DialogState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'rename'; channel: ChannelApi.ChannelInfo }
  | { kind: 'archive'; channel: ChannelApi.ChannelInfo }
  | { kind: 'access'; channel: ChannelApi.ChannelInfo };

function ChannelRowSkeleton() {
  return (
    <div className='flex items-center gap-3 py-3 border-b'>
      <Skeleton className='h-4 w-32' />
      <Skeleton className='h-5 w-16' />
      <Skeleton className='h-4 w-24' />
      <div className='ml-auto'>
        <Skeleton className='h-8 w-8' />
      </div>
    </div>
  );
}

function ChannelRow({
  channel,
  guildId,
  canManage,
  onAction,
}: {
  channel: ChannelApi.ChannelInfo;
  guildId: Option.Option<string>;
  canManage: boolean;
  onAction: (kind: 'rename' | 'archive' | 'access', channel: ChannelApi.ChannelInfo) => void;
}) {
  const isSyncing = Option.isNone(channel.discordChannelId) && !channel.archived;

  return (
    <div className='flex items-center gap-3 py-3 border-b last:border-0'>
      <div className='flex-1 min-w-0 flex flex-wrap items-center gap-2'>
        <span className='font-medium truncate'>{channel.name}</span>
        {Option.isSome(channel.discordChannelId) && Option.isSome(guildId) && (
          <DiscordChannelLink
            guildId={guildId.value}
            channelId={channel.discordChannelId.value}
            channelName={channel.name}
          />
        )}
      </div>
      <div className='flex items-center gap-2 shrink-0'>
        <Badge variant='outline' className='hidden sm:flex'>
          {channel.archived
            ? tr('channels_archive')
            : isSyncing
              ? tr('channels_status_syncing')
              : tr('channels_status_synced')}
        </Badge>
        <span className='text-xs text-muted-foreground hidden md:block'>
          {tr('channels_groupAccessCount', { count: String(channel.accessCount) })}
        </span>
      </div>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='size-8 shrink-0'>
              <MoreHorizontal className='size-4' />
              <span className='sr-only'>Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={() => onAction('access', channel)}>
              {tr('channels_access_action')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('rename', channel)}>
              {tr('channels_rename')}
            </DropdownMenuItem>
            {!channel.archived && (
              <DropdownMenuItem
                className='text-destructive focus:text-destructive'
                onClick={() => onAction('archive', channel)}
              >
                {tr('channels_archive')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function ChannelManagementPage({
  teamId,
  guildId,
  data,
  allGroups,
}: ChannelManagementPageProps) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState>({ kind: 'none' });

  const channels = data?.channels ?? [];
  const canManage = data?.canManage ?? false;
  const guildLinked = data?.guildLinked ?? false;

  // Collect existing categories
  const existingCategories = React.useMemo(() => {
    const cats = new Set<string>();
    for (const ch of channels) {
      if (Option.isSome(ch.category)) cats.add(ch.category.value);
    }
    return [...cats].sort();
  }, [channels]);

  // Poll for syncing channels
  React.useEffect(() => {
    const syncing = channels.filter((ch) => Option.isNone(ch.discordChannelId) && !ch.archived);
    if (syncing.length === 0) return;
    const id = setInterval(() => {
      router.invalidate();
    }, 3000);
    return () => clearInterval(id);
  }, [channels, router]);

  // Group channels by category
  const grouped = React.useMemo(() => {
    const byCategory = new Map<string, ChannelApi.ChannelInfo[]>();
    const UNCATEGORIZED = '\x00__uncategorized__';
    for (const ch of [...channels].sort((a, b) => a.position - b.position)) {
      const key = Option.isSome(ch.category) ? ch.category.value : UNCATEGORIZED;
      const list = byCategory.get(key) ?? [];
      list.push(ch);
      byCategory.set(key, list);
    }
    // Sort: named categories first (alphabetical), then uncategorized
    const entries = [...byCategory.entries()].sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
    return entries.map(([key, chans]) => ({
      label: key === UNCATEGORIZED ? tr('channels_uncategorized') : key,
      channels: chans,
    }));
  }, [channels]);

  const handleAction = (kind: 'rename' | 'archive' | 'access', channel: ChannelApi.ChannelInfo) => {
    setDialog({ kind, channel });
  };

  const handleCreated = (_channel: ChannelApi.ChannelDetail) => {
    // Channel enters syncing state - the polling effect will pick it up
  };

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId' params={{ teamId }}>
            ← {tr('team_backToTeams')}
          </Link>
        </Button>
        <div className='flex items-center justify-between gap-4'>
          <h1 className='text-2xl font-bold'>{tr('channels_title')}</h1>
          {canManage && (
            <Button size='sm' onClick={() => setDialog({ kind: 'create' })}>
              {tr('channels_create')}
            </Button>
          )}
        </div>
      </header>

      {!guildLinked && (
        <Alert className='mb-6'>
          <AlertDescription>
            {tr('channels_notConnected')}{' '}
            <Link
              to='/teams/$teamId/settings'
              params={{ teamId }}
              className='underline font-medium'
            >
              {tr('team_settings')}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {!data ? (
        <div className='flex flex-col gap-1'>
          {[1, 2, 3, 4].map((i) => (
            <ChannelRowSkeleton key={i} />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className='py-12 text-center'>
          <p className='text-lg font-medium'>{tr('channels_empty')}</p>
          <p className='text-muted-foreground mt-1'>{tr('channels_emptyBody')}</p>
          {canManage && (
            <Button className='mt-4' onClick={() => setDialog({ kind: 'create' })}>
              {tr('channels_create')}
            </Button>
          )}
        </div>
      ) : (
        <div className='flex flex-col gap-6'>
          {grouped.map((group) => (
            <div key={group.label}>
              <h2 className='text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2'>
                {group.label}
              </h2>
              <div>
                {group.channels.map((channel) => (
                  <ChannelRow
                    key={channel.channelId}
                    channel={channel}
                    guildId={guildId}
                    canManage={canManage}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateChannelDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: 'none' });
        }}
        teamId={teamId}
        existingCategories={existingCategories}
        onCreated={handleCreated}
      />

      {dialog.kind === 'rename' && (
        <RenameChannelDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog({ kind: 'none' });
          }}
          teamId={teamId}
          channel={dialog.channel}
        />
      )}

      {dialog.kind === 'archive' && (
        <ArchiveChannelDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog({ kind: 'none' });
          }}
          teamId={teamId}
          channel={dialog.channel}
        />
      )}

      {dialog.kind === 'access' && (
        <ChannelAccessSheet
          open
          onOpenChange={(open) => {
            if (!open) setDialog({ kind: 'none' });
          }}
          teamId={teamId}
          channel={dialog.channel}
          allGroups={allGroups}
          canManage={canManage}
        />
      )}
    </div>
  );
}
