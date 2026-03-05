import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { EventApi, EventRsvpApi, GroupApi, TrainingTypeApi } from '@sideline/domain';
import { Event, EventSeries, Team, TrainingType } from '@sideline/domain';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { DateTime, Effect, Option, Schema } from 'effect';
import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { DatePicker } from '~/components/ui/date-picker';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
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

const EventEditSchema = Schema.Struct({
  title: Schema.NonEmptyString,
  eventType: Event.EventType,
  trainingTypeId: Schema.String,
  description: Schema.String,
  startDate: Schema.NonEmptyString,
  startTime: Schema.NonEmptyString,
  endDate: Schema.String,
  endTime: Schema.String,
  location: Schema.String,
  discordChannelId: Schema.String,
});

type EventEditValues = Schema.Schema.Type<typeof EventEditSchema>;

const toIsoDateTime = (date: string, time: string): string =>
  DateTime.formatIso(DateTime.unsafeMake(`${date}T${time}:00Z`));

const buildPayload = (values: EventEditValues) => {
  const trainingTypeIdOption =
    values.trainingTypeId && values.trainingTypeId !== NONE_VALUE
      ? Option.some(Schema.decodeSync(TrainingType.TrainingTypeId)(values.trainingTypeId))
      : Option.none();
  const startAt = toIsoDateTime(values.startDate, values.startTime);
  const endAt = values.endTime
    ? Option.some(toIsoDateTime(values.endDate || values.startDate, values.endTime))
    : Option.none();
  return { trainingTypeIdOption, startAt, endAt };
};

interface EventDetailPageProps {
  teamId: string;
  eventId: string;
  eventDetail: EventApi.EventDetail;
  trainingTypes: ReadonlyArray<TrainingTypeApi.TrainingTypeInfo>;
  discordChannels: ReadonlyArray<GroupApi.DiscordChannelInfo>;
  rsvpDetail: EventRsvpApi.EventRsvpDetail;
}

export function EventDetailPage({
  teamId,
  eventId,
  eventDetail,
  trainingTypes,
  discordChannels,
  rsvpDetail,
}: EventDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const navigate = useNavigate();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const eventIdBranded = Schema.decodeSync(Event.EventId)(eventId);

  const form = useForm<EventEditValues>({
    resolver: effectTsResolver(EventEditSchema),
    mode: 'onChange',
    defaultValues: {
      title: eventDetail.title,
      eventType: eventDetail.eventType,
      trainingTypeId: eventDetail.trainingTypeId ?? NONE_VALUE,
      description: eventDetail.description ?? '',
      startDate: eventDetail.startAt.slice(0, 10),
      startTime: eventDetail.startAt.slice(11, 16),
      endDate: eventDetail.endAt ? eventDetail.endAt.slice(0, 10) : '',
      endTime: eventDetail.endAt ? eventDetail.endAt.slice(11, 16) : '',
      location: eventDetail.location ?? '',
      discordChannelId: eventDetail.discordChannelId ?? NONE_VALUE,
    },
  });

  const watchedEventType = form.watch('eventType');

  React.useEffect(() => {
    if (watchedEventType !== 'training') {
      form.setValue('trainingTypeId', NONE_VALUE);
    }
  }, [watchedEventType, form]);

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
    const values = form.getValues();
    setSaving(true);
    setShowEditScope(false);
    const { trainingTypeIdOption, startAt, endAt } = buildPayload(values);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.event.updateEvent({
          path: { teamId: teamIdBranded, eventId: eventIdBranded },
          payload: {
            title: Option.some(values.title),
            eventType: Option.some(values.eventType),
            trainingTypeId: Option.some(trainingTypeIdOption),
            description: Option.some(
              values.description ? Option.some(values.description) : Option.none(),
            ),
            startAt: Option.some(startAt),
            endAt: Option.some(endAt),
            location: Option.some(values.location ? Option.some(values.location) : Option.none()),
            discordChannelId: Option.some(
              values.discordChannelId && values.discordChannelId !== NONE_VALUE
                ? Option.some(values.discordChannelId)
                : Option.none(),
            ),
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
  }, [form, teamIdBranded, eventIdBranded, run, router]);

  const doSaveAllFuture = React.useCallback(async () => {
    if (!eventDetail.seriesId) return;
    const values = form.getValues();
    setSaving(true);
    setShowEditScope(false);
    const { trainingTypeIdOption } = buildPayload(values);
    const seriesIdBranded = Schema.decodeSync(EventSeries.EventSeriesId)(eventDetail.seriesId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.eventSeries.updateEventSeries({
          path: { teamId: teamIdBranded, seriesId: seriesIdBranded },
          payload: {
            title: Option.some(values.title),
            trainingTypeId: Option.some(trainingTypeIdOption),
            description: Option.some(
              values.description ? Option.some(values.description) : Option.none(),
            ),
            startTime: Option.some(values.startTime),
            endTime: Option.some(values.endTime ? Option.some(values.endTime) : Option.none()),
            location: Option.some(values.location ? Option.some(values.location) : Option.none()),
            endDate: Option.none(),
            discordChannelId: Option.some(
              values.discordChannelId && values.discordChannelId !== NONE_VALUE
                ? Option.some(values.discordChannelId)
                : Option.none(),
            ),
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
  }, [form, teamIdBranded, eventDetail.seriesId, run, router]);

  const handleSave = form.handleSubmit(() => {
    if (hasSeries) {
      setShowEditScope(true);
    } else {
      doSaveThisOnly();
    }
  });

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
          <Form {...form}>
            <form onSubmit={handleSave} className='flex flex-col gap-4'>
              <FormField
                {...form.register('title')}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.event_title()}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={m.event_titlePlaceholder()} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='flex gap-4'>
                <FormField
                  {...form.register('eventType')}
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>{m.event_eventType()}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Event.EventType.literals.map((type) => (
                            <SelectItem key={type} value={type}>
                              {eventTypeLabels[type]()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedEventType === 'training' && (
                  <FormField
                    {...form.register('trainingTypeId')}
                    render={({ field }) => (
                      <FormItem className='flex-1'>
                        <FormLabel>{m.event_trainingType()}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={m.event_noTrainingType()} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>{m.event_noTrainingType()}</SelectItem>
                            {trainingTypes.map((tt) => (
                              <SelectItem key={tt.trainingTypeId} value={tt.trainingTypeId}>
                                {tt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className='flex gap-4'>
                <FormField
                  {...form.register('startDate')}
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>{m.event_startDate()}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={m.event_startDate()}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  {...form.register('startTime')}
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>{m.event_startTime()}</FormLabel>
                      <FormControl>
                        <Input {...field} type='time' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='flex gap-4'>
                <FormField
                  {...form.register('endDate')}
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>{m.event_endDate()}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={m.event_endDate()}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  {...form.register('endTime')}
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>{m.event_endTime()}</FormLabel>
                      <FormControl>
                        <Input {...field} type='time' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                {...form.register('location')}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.event_location()}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={m.event_locationPlaceholder()} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                {...form.register('description')}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.event_description()}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={m.event_descriptionPlaceholder()}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                {...form.register('discordChannelId')}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{m.event_discordChannel()}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={m.event_useDefault()} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>{m.event_useDefault()}</SelectItem>
                        {discordChannels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            # {ch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showEditScope && (
                <div className='rounded-md border p-4 space-y-2'>
                  <p className='font-medium'>{m.event_editScopeTitle()}</p>
                  <div className='flex gap-2'>
                    <Button type='button' size='sm' variant='outline' onClick={doSaveThisOnly}>
                      {m.event_editThisOnly()}
                    </Button>
                    <Button type='button' size='sm' onClick={doSaveAllFuture}>
                      {m.event_editAllFuture()}
                    </Button>
                  </div>
                </div>
              )}

              {showCancelScope && (
                <div className='rounded-md border border-destructive/30 p-4 space-y-2'>
                  <p className='font-medium'>{m.event_cancelScopeTitle()}</p>
                  <div className='flex gap-2'>
                    <Button type='button' size='sm' variant='outline' onClick={doCancelThisOnly}>
                      {m.event_cancelThisOnly()}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='destructive'
                      onClick={doCancelAllFuture}
                    >
                      {m.event_cancelAllFuture()}
                    </Button>
                  </div>
                </div>
              )}

              <div className='flex gap-2'>
                <Button type='submit' disabled={saving}>
                  {saving ? m.event_saving() : m.event_saveChanges()}
                </Button>
                {eventDetail.canCancel && (
                  <Button type='button' variant='destructive' onClick={handleCancel}>
                    {m.event_cancelEvent()}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        ) : (
          <>
            {eventDetail.eventType === 'training' && eventDetail.trainingTypeName && (
              <p>
                <span className='text-sm font-medium'>{m.event_trainingType()}: </span>
                {eventDetail.trainingTypeName}
              </p>
            )}
            <p>
              <span className='text-sm font-medium'>{m.event_startDate()}: </span>
              {eventDetail.startAt.slice(0, 10)} {eventDetail.startAt.slice(11, 16)}
            </p>
            {eventDetail.endAt && (
              <p>
                <span className='text-sm font-medium'>{m.event_endDate()}: </span>
                {eventDetail.endAt.slice(0, 10)} {eventDetail.endAt.slice(11, 16)}
              </p>
            )}
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
