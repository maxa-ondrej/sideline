import * as m from '@sideline/i18n/messages';
import { Hash } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';

interface DiscordChannelLinkProps {
  guildId: string;
  channelId: string;
  channelName: string;
  className?: string;
}

export function DiscordChannelLink({
  guildId,
  channelId,
  channelName,
  className,
}: DiscordChannelLinkProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={`https://discord.com/channels/${guildId}/${channelId}`}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={m.discord_openChannel({ channelName })}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
              className,
            )}
          >
            <Hash className='size-3.5 shrink-0 text-muted-foreground' aria-hidden />
            {channelName}
          </a>
        </TooltipTrigger>
        <TooltipContent>ID: {channelId}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
