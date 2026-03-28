import type { ICalApi } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { useRouter } from '@tanstack/react-router';
import { Effect } from 'effect';
import React from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Separator } from '~/components/ui/separator';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

interface CalendarSubscriptionPageProps {
  icalToken: ICalApi.ICalTokenResponse;
}

export function CalendarSubscriptionPage({ icalToken }: CalendarSubscriptionPageProps) {
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
    <div className='max-w-2xl space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>{m.ical_title()}</h1>
        <p className='text-muted-foreground mt-1'>{m.ical_description()}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>{m.ical_subscribeUrl()}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Input value={url} readOnly className='font-mono text-sm flex-1' />
            <Button variant='outline' onClick={handleCopy} className='shrink-0'>
              {copied ? m.ical_copied() : m.ical_copyUrl()}
            </Button>
          </div>
          <div>
            <Button variant='destructive' onClick={handleRegenerate} disabled={regenerating}>
              {m.ical_regenerate()}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='pt-6 space-y-4'>
          <div>
            <h2 className='text-base font-semibold mb-1'>Google Calendar</h2>
            <p className='text-muted-foreground text-sm'>{m.ical_instructions_google()}</p>
          </div>
          <Separator />
          <div>
            <h2 className='text-base font-semibold mb-1'>Apple Calendar</h2>
            <p className='text-muted-foreground text-sm'>{m.ical_instructions_apple()}</p>
          </div>
          <Separator />
          <div>
            <h2 className='text-base font-semibold mb-1'>Outlook</h2>
            <p className='text-muted-foreground text-sm'>{m.ical_instructions_outlook()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
