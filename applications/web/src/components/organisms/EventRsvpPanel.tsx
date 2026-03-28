import type { EventApi, EventRsvpApi } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Option } from 'effect';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';

interface EventRsvpPanelProps {
  eventDetail: EventApi.EventDetail;
  rsvpDetail: EventRsvpApi.EventRsvpDetail;
  nonResponders: ReadonlyArray<EventRsvpApi.NonResponderEntry>;
  rsvpResponse: 'yes' | 'no' | 'maybe' | null;
  rsvpMessage: string;
  rsvpSubmitting: boolean;
  onResponseChange: (response: 'yes' | 'no' | 'maybe') => void;
  onMessageChange: (message: string) => void;
  onSubmit: () => Promise<void>;
}

export function EventRsvpPanel({
  eventDetail,
  rsvpDetail,
  nonResponders,
  rsvpResponse,
  rsvpMessage,
  rsvpSubmitting,
  onResponseChange,
  onMessageChange,
  onSubmit,
}: EventRsvpPanelProps) {
  return (
    <div>
      <h2 className='text-lg font-semibold mb-4'>{m.rsvp_title()}</h2>

      {rsvpDetail.canRsvp ? (
        <div className='flex flex-col gap-4'>
          <div className='flex gap-2'>
            <Button
              variant={rsvpResponse === 'yes' ? 'default' : 'outline'}
              onClick={() => onResponseChange('yes')}
            >
              {m.rsvp_yes()}
            </Button>
            <Button
              variant={rsvpResponse === 'maybe' ? 'secondary' : 'outline'}
              onClick={() => onResponseChange('maybe')}
            >
              {m.rsvp_maybe()}
            </Button>
            <Button
              variant={rsvpResponse === 'no' ? 'destructive' : 'outline'}
              onClick={() => onResponseChange('no')}
            >
              {m.rsvp_no()}
            </Button>
          </div>

          {rsvpResponse && (
            <>
              <div>
                <label htmlFor='rsvp-message' className='text-sm font-medium mb-1 block'>
                  {m.rsvp_message()}
                </label>
                <Textarea
                  id='rsvp-message'
                  value={rsvpMessage}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder={m.rsvp_messagePlaceholder()}
                  rows={2}
                />
              </div>
              <div>
                <Button onClick={onSubmit} disabled={rsvpSubmitting}>
                  {rsvpSubmitting ? m.rsvp_submitting() : m.rsvp_submit()}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className='text-sm text-muted-foreground'>{m.rsvp_deadlinePassed()}</p>
      )}

      <div className='mt-6'>
        <h3 className='text-sm font-semibold mb-2'>{m.rsvp_summary()}</h3>
        <div className='flex gap-4 text-sm mb-4'>
          <span className='text-green-700 dark:text-green-400'>
            {m.rsvp_attending({ count: String(rsvpDetail.yesCount) })}
          </span>
          <span className='text-yellow-600 dark:text-yellow-400'>
            {m.rsvp_undecided({ count: String(rsvpDetail.maybeCount) })}
          </span>
          <span className='text-red-600 dark:text-red-400'>
            {m.rsvp_notAttending({ count: String(rsvpDetail.noCount) })}
          </span>
        </div>

        {rsvpDetail.minPlayersThreshold > 0 &&
          rsvpDetail.yesCount < rsvpDetail.minPlayersThreshold && (
            <div className='mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200'>
              {m.rsvp_belowMinPlayers({
                count: String(rsvpDetail.yesCount),
                threshold: String(rsvpDetail.minPlayersThreshold),
              })}
            </div>
          )}

        {rsvpDetail.rsvps.length > 0 ? (
          <ul className='space-y-1 text-sm'>
            {[...rsvpDetail.rsvps]
              .sort((a, b) => {
                const order: Record<string, number> = { yes: 0, maybe: 1, no: 2 };
                return (order[a.response] ?? 3) - (order[b.response] ?? 3);
              })
              .map((r) => (
                <li key={r.teamMemberId} className='flex items-center gap-2'>
                  <span
                    className={
                      r.response === 'yes'
                        ? 'text-green-700 dark:text-green-400'
                        : r.response === 'maybe'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {r.response === 'yes'
                      ? m.rsvp_yes()
                      : r.response === 'maybe'
                        ? m.rsvp_maybe()
                        : m.rsvp_no()}
                  </span>
                  <span>
                    {Option.getOrElse(r.memberName, () => Option.getOrElse(r.username, () => '—'))}
                  </span>
                  {Option.isSome(r.message) && (
                    <span className='text-muted-foreground'>— {r.message.value}</span>
                  )}
                </li>
              ))}
          </ul>
        ) : (
          <p className='text-sm text-muted-foreground'>{m.rsvp_noResponses()}</p>
        )}

        {(eventDetail.canEdit || eventDetail.canCancel) && nonResponders.length > 0 && (
          <div className='mt-6'>
            <h3 className='text-sm font-semibold mb-2'>{m.rsvp_nonRespondersTitle()}</h3>
            <ul className='space-y-1 text-sm text-muted-foreground'>
              {nonResponders.map((nr) => (
                <li key={nr.teamMemberId}>
                  {Option.getOrElse(nr.memberName, () => Option.getOrElse(nr.username, () => '—'))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
