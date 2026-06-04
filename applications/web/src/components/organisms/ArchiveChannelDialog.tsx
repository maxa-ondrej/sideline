import type { ChannelApi } from '@sideline/domain';
import { Team, TeamChannel } from '@sideline/domain';
import { useRouter } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import { tr } from '~/lib/translations.js';

interface ArchiveChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  channel: ChannelApi.ChannelInfo;
}

export function ArchiveChannelDialog({
  open,
  onOpenChange,
  teamId,
  channel,
}: ArchiveChannelDialogProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const channelIdBranded = Schema.decodeSync(TeamChannel.TeamChannelId)(channel.channelId);
  const [submitting, setSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    await ApiClient.asEffect().pipe(
      Effect.flatMap((api) =>
        api.channel.archiveChannel({
          params: { teamId: teamIdBranded, channelId: channelIdBranded },
        }),
      ),
      Effect.mapError(() => ClientError.make(tr('channels_archiveFailed'))),
      run({ success: tr('channels_archived') }),
    );
    setSubmitting(false);
    onOpenChange(false);
    router.invalidate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr('channels_archive_title')}</AlertDialogTitle>
          <AlertDialogDescription>{tr('channels_archive_body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{tr('channels_cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className='bg-destructive text-white hover:bg-destructive/90'
            onClick={handleConfirm}
            disabled={submitting}
          >
            {tr('channels_archive_confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
