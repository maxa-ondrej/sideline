import type { EventApi, EventRsvpApi, TrainingTypeApi } from '@sideline/domain';
import { Event, EventSeries, Team, TrainingType } from '@sideline/domain';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { DatePicker } from '~/components/ui/date-picker';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

const NONE_VALUE = '__none__';

const eventTypeLabels: Record<Event.EventType, () => string> = {
  training: m.event_type_training,
  match: m.event_type_match,
  tournament: m.event_type_tournament,
  meeting: m.event_type_meeting,
  social: m.event_type_social,
  other: m.event_type_other,
};

interface EventDetailPageProps {
  teamId: string;
  eventId: string;
  eventDetail: EventApi.EventDetail;
  trainingTypes: ReadonlyArray<TrainingTypeApi.TrainingTypeInfo>;
  rsvpDetail: EventRsvpApi.EventRsvpDetail;
}

export function EventDetailPage({
  teamId,
  eventId,
  eventDetail,
  trainingTypes,
  rsvpDetail,
}: EventDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const navigate = useNavigate();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const eventIdBranded = Schema.decodeSync(Event.EventId)(eventId);

  const [title, setTitle] = React.useState(eventDetail.title);
  const [eventType, setEventType] = React.useState(eventDetail.eventType);
  const [trainingTypeId, setTrainingTypeId] = React.useState(
    eventDetail.trainingTypeId ?? NONE_VALUE,
  );
  const [description, setDescription] = React.useState(eventDetail.description ?? '');
  const [eventDate, setEventDate] = React.useState(eventDetail.startAt.slice(0, 10));
  const [startTime, setStartTime] = React.useState(eventDetail.startAt.slice(11, 16));
  const [endTime, setEndTime] = React.useState(
    eventDetail.endAt ? eventDetail.endAt.slice(11, 16) : '',
  );
  const [location, setLocation] = React.useState(eventDetail.location ?? '');
  const [saving, setSaving] = React.useState(false);
  const [showEditScope, setShowEditScope] = React.useState(false);
  const [showCancelScope, setShowCancelScope] = React.useState(false);
  const [rsvpResponse, setRsvpResponse] = React.useState<'yes' | 'no' | 'maybe' | null>(
    rsvpDetail.myResponse,
  );
  const [rsvpMessage, setRsvpMessage] = React.useState(rsvpDetail.myMessage ?? '');
  const [rsvpSubmitting, setRsvpSubmitting] = React.useState(false);

  const hasSeries = eventDetail.seriesId !== null;

  const doSaveThisOnly = React.useCallback(async () => {
    setSaving(true);
    setShowEditScope(false);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.event.updateEvent({
          path: { teamId: teamIdBranded, eventId: eventIdBranded },
          payload: {
            title: Option.some(title),
            eventType: Option.some(eventType),
            trainingTypeId: Option.some(
              trainingTypeId && trainingTypeId !== NONE_VALUE
                ? Option.some(Schema.decodeSync(TrainingType.TrainingTypeId)(trainingTypeId))
                : Option.none(),
            ),
            description: Option.some(description ? Option.some(description) : Option.none()),
            startAt: Option.some(`${eventDate}T${startTime}:00`),
            endAt: Option.some(endTime ? Option.some(`${eventDate}T${endTime}:00`) : Option.none()),
            location: Option.some(location ? Option.some(location) : Option.none()),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_updateFailed())),
      run,
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [
    teamIdBranded,
    eventIdBranded,
    title,
    eventType,
    trainingTypeId,
    description,
    eventDate,
    startTime,
    endTime,
    location,
    run,
    router,
  ]);

  const doSaveAllFuture = React.useCallback(async () => {
    if (!eventDetail.seriesId) return;
    setSaving(true);
    setShowEditScope(false);
    const seriesIdBranded = Schema.decodeSync(EventSeries.EventSeriesId)(eventDetail.seriesId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.eventSeries.updateEventSeries({
          path: { teamId: teamIdBranded, seriesId: seriesIdBranded },
          payload: {
            title: Option.some(title),
            trainingTypeId: Option.some(
              trainingTypeId && trainingTypeId !== NONE_VALUE
                ? Option.some(Schema.decodeSync(TrainingType.TrainingTypeId)(trainingTypeId))
                : Option.none(),
            ),
            description: Option.some(description ? Option.some(description) : Option.none()),
            startTime: Option.some(startTime),
            endTime: Option.some(endTime ? Option.some(endTime) : Option.none()),
            location: Option.some(location ? Option.some(location) : Option.none()),
            endDate: Option.none(),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_updateSeriesFailed())),
      run,
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [
    teamIdBranded,
    eventDetail.seriesId,
    title,
    trainingTypeId,
    description,
    startTime,
    endTime,
    location,
    run,
    router,
  ]);

  const handleSave = React.useCallback(() => {
    if (hasSeries) {
      setShowEditScope(true);
    } else {
      doSaveThisOnly();
    }
  }, [hasSeries, doSaveThisOnly]);

  const doCancelThisOnly = React.useCallback(async () => {
    setShowCancelScope(false);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.event.cancelEvent({ path: { teamId: teamIdBranded, eventId: eventIdBranded } }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_cancelFailed())),
      run,
    );
    if (Option.isSome(result)) {
      toast.success(m.event_cancelled());
      navigate({ to: '/teams/$teamId/events', params: { teamId } });
    }
  }, [teamId, teamIdBranded, eventIdBranded, run, navigate]);

  const doCancelAllFuture = React.useCallback(async () => {
    if (!eventDetail.seriesId) return;
    setShowCancelScope(false);
    const seriesIdBranded = Schema.decodeSync(EventSeries.EventSeriesId)(eventDetail.seriesId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.eventSeries.cancelEventSeries({
          path: { teamId: teamIdBranded, seriesId: seriesIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_cancelFailed())),
      run,
    );
    if (Option.isSome(result)) {
      toast.success(m.event_seriesCancelled());
      navigate({ to: '/teams/$teamId/events', params: { teamId } });
    }
  }, [teamId, teamIdBranded, eventDetail.seriesId, run, navigate]);

  const handleCancel = React.useCallback(() => {
    if (hasSeries) {
      setShowCancelScope(true);
    } else {
      if (!window.confirm(m.event_cancelConfirm())) return;
      doCancelThisOnly();
    }
  }, [hasSeries, doCancelThisOnly]);

  const handleRsvpSubmit = React.useCallback(async () => {
    if (!rsvpResponse) return;
    setRsvpSubmitting(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.eventRsvp.submitRsvp({
          path: { teamId: teamIdBranded, eventId: eventIdBranded },
          payload: {
            response: rsvpResponse,
            message: rsvpMessage || null,
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.rsvp_submitFailed())),
      run,
    );
    setRsvpSubmitting(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, eventIdBranded, rsvpResponse, rsvpMessage, run, router]);

  const isActive = eventDetail.status === 'active';

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId/events' params={{ teamId }}>
            ← {m.event_backToEvents()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{eventDetail.title}</h1>
        <div className='flex gap-4 text-sm text-muted-foreground mt-1'>
          <span>{eventTypeLabels[eventDetail.eventType]()}</span>
          <span
            className={
              isActive ? 'text-green-700 font-medium' : 'text-muted-foreground line-through'
            }
          >
            {isActive ? m.event_status_active() : m.event_status_cancelled()}
          </span>
          {eventDetail.createdByName && (
            <span>
              {m.event_createdBy()}: {eventDetail.createdByName}
            </span>
          )}
        </div>
      </header>

      {hasSeries && (
        <div className='mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800'>
          {m.event_partOfSeries()}
        </div>
      )}

      <div className='flex flex-col gap-6 max-w-lg'>
        {eventDetail.canEdit && isActive ? (
          <>
            <div>
              <label htmlFor='event-title' className='text-sm font-medium mb-1 block'>
                {m.event_title()}
              </label>
              <Input id='event-title' value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className='flex gap-4'>
              <div className='flex-1'>
                <label htmlFor='event-type' className='text-sm font-medium mb-1 block'>
                  {m.event_eventType()}
                </label>
                <Select onValueChange={(v) => setEventType(v as Event.EventType)} value={eventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Event.EventType.literals.map((type) => (
                      <SelectItem key={type} value={type}>
                        {eventTypeLabels[type]()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='flex-1'>
                <label htmlFor='event-training-type' className='text-sm font-medium mb-1 block'>
                  {m.event_trainingType()}
                </label>
                <Select onValueChange={setTrainingTypeId} value={trainingTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={m.event_noTrainingType()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{m.event_noTrainingType()}</SelectItem>
                    {trainingTypes.map((tt) => (
                      <SelectItem key={tt.trainingTypeId} value={tt.trainingTypeId}>
                        {tt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='flex gap-4'>
              <div className='flex-1'>
                <label htmlFor='event-date' className='text-sm font-medium mb-1 block'>
                  {m.event_eventDate()}
                </label>
                <DatePicker
                  value={eventDate}
                  onChange={setEventDate}
                  placeholder={m.event_eventDate()}
                />
              </div>
              <div className='flex-1'>
                <label htmlFor='event-start-time' className='text-sm font-medium mb-1 block'>
                  {m.event_startTime()}
                </label>
                <Input
                  id='event-start-time'
                  type='time'
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className='flex-1'>
                <label htmlFor='event-end-time' className='text-sm font-medium mb-1 block'>
                  {m.event_endTime()}
                </label>
                <Input
                  id='event-end-time'
                  type='time'
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor='event-location' className='text-sm font-medium mb-1 block'>
                {m.event_location()}
              </label>
              <Input
                id='event-location'
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={m.event_locationPlaceholder()}
              />
            </div>

            <div>
              <label htmlFor='event-description' className='text-sm font-medium mb-1 block'>
                {m.event_description()}
              </label>
              <Textarea
                id='event-description'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={m.event_descriptionPlaceholder()}
                rows={3}
              />
            </div>

            {showEditScope && (
              <div className='rounded-md border p-4 space-y-2'>
                <p className='font-medium'>{m.event_editScopeTitle()}</p>
                <div className='flex gap-2'>
                  <Button size='sm' variant='outline' onClick={doSaveThisOnly}>
                    {m.event_editThisOnly()}
                  </Button>
                  <Button size='sm' onClick={doSaveAllFuture}>
                    {m.event_editAllFuture()}
                  </Button>
                </div>
              </div>
            )}

            {showCancelScope && (
              <div className='rounded-md border border-destructive/30 p-4 space-y-2'>
                <p className='font-medium'>{m.event_cancelScopeTitle()}</p>
                <div className='flex gap-2'>
                  <Button size='sm' variant='outline' onClick={doCancelThisOnly}>
                    {m.event_cancelThisOnly()}
                  </Button>
                  <Button size='sm' variant='destructive' onClick={doCancelAllFuture}>
                    {m.event_cancelAllFuture()}
                  </Button>
                </div>
              </div>
            )}

            <div className='flex gap-2'>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? m.event_saving() : m.event_saveChanges()}
              </Button>
              {eventDetail.canCancel && (
                <Button variant='destructive' onClick={handleCancel}>
                  {m.event_cancelEvent()}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            {eventDetail.trainingTypeName && (
              <p>
                <span className='text-sm font-medium'>{m.event_trainingType()}: </span>
                {eventDetail.trainingTypeName}
              </p>
            )}
            <p>
              <span className='text-sm font-medium'>{m.event_eventDate()}: </span>
              {eventDetail.startAt.slice(0, 10)}
            </p>
            <p>
              <span className='text-sm font-medium'>{m.event_startTime()}: </span>
              {eventDetail.startAt.slice(11, 16)}
              {eventDetail.endAt ? ` - ${eventDetail.endAt.slice(11, 16)}` : ''}
            </p>
            {eventDetail.location && (
              <p>
                <span className='text-sm font-medium'>{m.event_location()}: </span>
                {eventDetail.location}
              </p>
            )}
            {eventDetail.description && (
              <p>
                <span className='text-sm font-medium'>{m.event_description()}: </span>
                {eventDetail.description}
              </p>
            )}
            {eventDetail.canCancel && isActive && (
              <div>
                <Button variant='destructive' onClick={handleCancel}>
                  {m.event_cancelEvent()}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {isActive && (
        <div className='mt-8 max-w-lg'>
          <h2 className='text-lg font-semibold mb-4'>{m.rsvp_title()}</h2>

          {rsvpDetail.canRsvp ? (
            <div className='flex flex-col gap-4'>
              <div className='flex gap-2'>
                <Button
                  variant={rsvpResponse === 'yes' ? 'default' : 'outline'}
                  onClick={() => setRsvpResponse('yes')}
                >
                  {m.rsvp_yes()}
                </Button>
                <Button
                  variant={rsvpResponse === 'maybe' ? 'secondary' : 'outline'}
                  onClick={() => setRsvpResponse('maybe')}
                >
                  {m.rsvp_maybe()}
                </Button>
                <Button
                  variant={rsvpResponse === 'no' ? 'destructive' : 'outline'}
                  onClick={() => setRsvpResponse('no')}
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
                      onChange={(e) => setRsvpMessage(e.target.value)}
                      placeholder={m.rsvp_messagePlaceholder()}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Button onClick={handleRsvpSubmit} disabled={rsvpSubmitting}>
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
              <span className='text-green-700'>
                {m.rsvp_attending({ count: String(rsvpDetail.yesCount) })}
              </span>
              <span className='text-yellow-600'>
                {m.rsvp_undecided({ count: String(rsvpDetail.maybeCount) })}
              </span>
              <span className='text-red-600'>
                {m.rsvp_notAttending({ count: String(rsvpDetail.noCount) })}
              </span>
            </div>

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
                            ? 'text-green-700'
                            : r.response === 'maybe'
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }
                      >
                        {r.response === 'yes'
                          ? m.rsvp_yes()
                          : r.response === 'maybe'
                            ? m.rsvp_maybe()
                            : m.rsvp_no()}
                      </span>
                      <span>{r.memberName ?? '—'}</span>
                      {r.message && <span className='text-muted-foreground'>— {r.message}</span>}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className='text-sm text-muted-foreground'>{m.rsvp_noResponses()}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
