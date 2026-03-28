import type { ICalApi } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect } from 'effect';
import React from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

interface CalendarSubscriptionPageProps {
  teamId: string;
  icalToken: ICalApi.ICalTokenResponse;
}

export function CalendarSubscriptionPage({ teamId, icalToken }: CalendarSubscriptionPageProps) {
  const run = useRun();
  const router = useRouter();
  const [url, setUrl] = React.useState(icalToken.url);
  const [copied, setCopied] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!window.confirm(m.ical_regenerateConfirm())) return;
    setRegenerating(true);
    const result = await run({ success: m.ical_regenerated() })(
      ApiClient.pipe(
        Effect.flatMap((api) => api.ical.regenerateICalToken()),
        Effect.mapError(() => ClientError.make(m.ical_regenerateFailed())),
      ),
    );
    setRegenerating(false);
    if (result._tag === 'Some') {
      setUrl(result.value.url);
      router.invalidate();
    }
  };

  return (
    <div className='mx-auto max-w-2xl space-y-8 p-6'>
      <div className='flex items-center gap-4'>
        <Link
          to='/teams/$teamId'
          params={{ teamId }}
          className='text-muted-foreground hover:text-foreground text-sm'
        >
          {m.team_backToTeams()}
        </Link>
      </div>

      <div>
        <h1 className='text-2xl font-bold'>{m.ical_title()}</h1>
        <p className='text-muted-foreground mt-1'>{m.ical_description()}</p>
      </div>

      <div className='space-y-2'>
        <span className='text-sm font-medium'>{m.ical_subscribeUrl()}</span>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <Input value={url} readOnly className='font-mono text-sm flex-1' />
          <Button variant='outline' onClick={handleCopy} className='shrink-0'>
            {copied ? m.ical_copied() : m.ical_copyUrl()}
          </Button>
        </div>
      </div>

      <div>
        <Button variant='destructive' onClick={handleRegenerate} disabled={regenerating}>
          {m.ical_regenerate()}
        </Button>
      </div>

      <div className='space-y-4'>
        <h2 className='text-lg font-semibold'>Google Calendar</h2>
        <p className='text-muted-foreground text-sm'>{m.ical_instructions_google()}</p>

        <h2 className='text-lg font-semibold'>Apple Calendar</h2>
        <p className='text-muted-foreground text-sm'>{m.ical_instructions_apple()}</p>

        <h2 className='text-lg font-semibold'>Outlook</h2>
        <p className='text-muted-foreground text-sm'>{m.ical_instructions_outlook()}</p>
      </div>
    </div>
  );
}
