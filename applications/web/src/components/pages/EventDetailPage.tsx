import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { EventApi, EventRsvpApi, GroupApi, TrainingTypeApi } from '@sideline/domain';
import { Discord, Event, EventSeries, GroupModel, Team, TrainingType } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { useForm } from 'react-hook-form';

import { EventRsvpPanel } from '~/components/organisms/EventRsvpPanel.js';
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
import { formatLocalDate, formatLocalTime, formatUtcTime, localToUtc } from '~/lib/datetime';
import { DISCORD_CHANNEL_TYPE_TEXT } from '~/lib/discord';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

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
  title: Schema.NonEmptyString.annotations({ message: () => m.validation_required() }),
  eventType: Event.EventType.annotations({ message: () => m.validation_invalidOption() }),
  trainingTypeId: Schema.String,
  description: Schema.String,
  startDate: Schema.NonEmptyString.annotations({ message: () => m.validation_required() }),
  startTime: Schema.NonEmptyString.annotations({ message: () => m.validation_required() }),
  endDate: Schema.String,
  endTime: Schema.String,
  location: Schema.String,
  discordChannelId: Schema.String,
  ownerGroupId: Schema.String,
  memberGroupId: Schema.String,
});

type EventEditValues = Schema.Schema.Type<typeof EventEditSchema>;

const buildPayload = (values: EventEditValues) => {
  const trainingTypeIdOption =
    values.trainingTypeId && values.trainingTypeId !== NONE_VALUE
      ? Option.some(Schema.decodeSync(TrainingType.TrainingTypeId)(values.trainingTypeId))
      : Option.none();
  const startAt = localToUtc(values.startDate, values.startTime);
  const endAt = values.endTime
    ? Option.some(localToUtc(values.endDate || values.startDate, values.endTime))
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
  nonResponders: ReadonlyArray<EventRsvpApi.NonResponderEntry>;
  groups: ReadonlyArray<GroupApi.GroupInfo>;
}

export function EventDetailPage({
  teamId,
  eventId,
  eventDetail,
  trainingTypes,
  discordChannels,
  rsvpDetail,
  nonResponders,
  groups,
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
      trainingTypeId: Option.getOrElse(eventDetail.trainingTypeId, () => NONE_VALUE),
      description: Option.getOrElse(eventDetail.description, () => ''),
      startDate: formatLocalDate(eventDetail.startAt),
      startTime: formatLocalTime(eventDetail.startAt),
      endDate: Option.match(eventDetail.endAt, {
        onNone: () => '',
        onSome: formatLocalDate,
      }),
      endTime: Option.match(eventDetail.endAt, {
        onNone: () => '',
        onSome: formatLocalTime,
      }),
      location: Option.getOrElse(eventDetail.location, () => ''),
      discordChannelId: Option.getOrElse(eventDetail.discordChannelId, () => NONE_VALUE),
      ownerGroupId: Option.getOrElse(eventDetail.ownerGroupId, () => NONE_VALUE),
      memberGroupId: Option.getOrElse(eventDetail.memberGroupId, () => NONE_VALUE),
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
    Option.getOrNull(rsvpDetail.myResponse),
  );
  const [rsvpMessage, setRsvpMessage] = React.useState(
    Option.getOrElse(rsvpDetail.myMessage, () => ''),
  );
  const [rsvpSubmitting, setRsvpSubmitting] = React.useState(false);

  const hasSeries = Option.isSome(eventDetail.seriesId);

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
                ? Option.some(Discord.Snowflake.make(values.discordChannelId))
                : Option.none(),
            ),
            ownerGroupId: Option.some(
              values.ownerGroupId && values.ownerGroupId !== NONE_VALUE
                ? Option.some(Schema.decodeSync(GroupModel.GroupId)(values.ownerGroupId))
                : Option.none(),
            ),
            memberGroupId: Option.some(
              values.memberGroupId && values.memberGroupId !== NONE_VALUE
                ? Option.some(Schema.decodeSync(GroupModel.GroupId)(values.memberGroupId))
                : Option.none(),
            ),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_updateFailed())),
      run({ success: m.event_eventSaved() }),
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [form, teamIdBranded, eventIdBranded, run, router]);

  const doSaveAllFuture = React.useCallback(async () => {
    if (Option.isNone(eventDetail.seriesId)) return;
    const values = form.getValues();
    setSaving(true);
    setShowEditScope(false);
    const { trainingTypeIdOption, startAt, endAt } = buildPayload(values);
    const seriesIdBranded = Schema.decodeSync(EventSeries.EventSeriesId)(
      eventDetail.seriesId.value,
    );
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all(
          [
            api.eventSeries.updateEventSeries({
              path: { teamId: teamIdBranded, seriesId: seriesIdBranded },
              payload: {
                title: Option.some(values.title),
                trainingTypeId: Option.some(trainingTypeIdOption),
                description: Option.some(
                  values.description ? Option.some(values.description) : Option.none(),
                ),
                daysOfWeek: Option.none(),
                startTime: Option.some(
                  formatUtcTime(localToUtc(values.startDate, values.startTime)),
                ),
                endTime: Option.some(
                  values.endTime
                    ? Option.some(formatUtcTime(localToUtc(values.startDate, values.endTime)))
                    : Option.none(),
                ),
                location: Option.some(
                  values.location ? Option.some(values.location) : Option.none(),
                ),
                endDate: Option.none(),
                discordChannelId: Option.some(
                  values.discordChannelId && values.discordChannelId !== NONE_VALUE
                    ? Option.some(Discord.Snowflake.make(values.discordChannelId))
                    : Option.none(),
                ),
                ownerGroupId: Option.some(
                  values.ownerGroupId && values.ownerGroupId !== NONE_VALUE
                    ? Option.some(Schema.decodeSync(GroupModel.GroupId)(values.ownerGroupId))
                    : Option.none(),
                ),
                memberGroupId: Option.some(
                  values.memberGroupId && values.memberGroupId !== NONE_VALUE
                    ? Option.some(Schema.decodeSync(GroupModel.GroupId)(values.memberGroupId))
                    : Option.none(),
                ),
              },
            }),
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
                location: Option.some(
                  values.location ? Option.some(values.location) : Option.none(),
                ),
                discordChannelId: Option.some(
                  values.discordChannelId && values.discordChannelId !== NONE_VALUE
                    ? Option.some(Discord.Snowflake.make(values.discordChannelId))
                    : Option.none(),
                ),
                ownerGroupId: Option.some(
                  values.ownerGroupId && values.ownerGroupId !== NONE_VALUE
                    ? Option.some(Schema.decodeSync(GroupModel.GroupId)(values.ownerGroupId))
                    : Option.none(),
                ),
                memberGroupId: Option.some(
                  values.memberGroupId && values.memberGroupId !== NONE_VALUE
                    ? Option.some(Schema.decodeSync(GroupModel.GroupId)(values.memberGroupId))
                    : Option.none(),
                ),
              },
            }),
          ],
          { concurrency: 'unbounded' },
        ),
      ),
      Effect.catchAll(() => ClientError.make(m.event_updateSeriesFailed())),
      run({ success: m.event_seriesSaved() }),
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [form, teamIdBranded, eventIdBranded, eventDetail.seriesId, run, router]);

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
      run({ success: m.event_cancelled() }),
    );
    if (Option.isSome(result)) {
      navigate({ to: '/teams/$teamId/events', params: { teamId } });
    }
  }, [teamId, teamIdBranded, eventIdBranded, run, navigate]);

  const doCancelAllFuture = React.useCallback(async () => {
    if (Option.isNone(eventDetail.seriesId)) return;
    setShowCancelScope(false);
    const seriesIdBranded = Schema.decodeSync(EventSeries.EventSeriesId)(
      eventDetail.seriesId.value,
    );
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.eventSeries.cancelEventSeries({
          path: { teamId: teamIdBranded, seriesId: seriesIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_cancelFailed())),
      run({ success: m.event_seriesCancelled() }),
    );
    if (Option.isSome(result)) {
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
            message: rsvpMessage ? Option.some(rsvpMessage) : Option.none(),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.rsvp_submitFailed())),
      run({ success: m.event_rsvpSubmitted() }),
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
        <div className='flex flex-wrap gap-2 sm:gap-4 text-sm text-muted-foreground mt-1'>
          <span>{eventTypeLabels[eventDetail.eventType]()}</span>
          <span
            className={
              isActive ? 'text-green-700 font-medium' : 'text-muted-foreground line-through'
            }
          >
            {isActive ? m.event_status_active() : m.event_status_cancelled()}
          </span>
          {Option.isSome(eventDetail.createdByName) && (
            <span>
              {m.event_createdBy()}: {eventDetail.createdByName.value}
            </span>
          )}
        </div>
      </header>

      {hasSeries && (
        <div className='mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800'>
          {m.event_partOfSeries()}
        </div>
      )}

      <div className='flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_380px]'>
        <div className='order-2 lg:order-1'>
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

                  <div className='flex flex-col gap-4 sm:flex-row'>
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
                                <SelectItem value={NONE_VALUE}>
                                  {m.event_noTrainingType()}
                                </SelectItem>
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

                  <div className='flex flex-col gap-4 sm:flex-row'>
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

                  <div className='flex flex-col gap-4 sm:flex-row'>
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
                            {discordChannels
                              .filter((ch) => ch.type === DISCORD_CHANNEL_TYPE_TEXT)
                              .map((ch) => (
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

                  <div className='flex flex-col gap-4 sm:flex-row'>
                    <FormField
                      {...form.register('ownerGroupId')}
                      render={({ field }) => (
                        <FormItem className='flex-1'>
                          <FormLabel>{m.event_ownerGroup()}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={m.event_useDefault()} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NONE_VALUE}>{m.event_useDefault()}</SelectItem>
                              {groups.map((g) => (
                                <SelectItem key={g.groupId} value={g.groupId}>
                                  {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className='text-xs text-muted-foreground'>
                            {m.event_ownerGroupHelp()}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      {...form.register('memberGroupId')}
                      render={({ field }) => (
                        <FormItem className='flex-1'>
                          <FormLabel>{m.event_memberGroup()}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={m.event_useDefault()} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NONE_VALUE}>{m.event_useDefault()}</SelectItem>
                              {groups.map((g) => (
                                <SelectItem key={g.groupId} value={g.groupId}>
                                  {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className='text-xs text-muted-foreground'>
                            {m.event_memberGroupHelp()}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={doCancelThisOnly}
                        >
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
                {eventDetail.eventType === 'training' &&
                  Option.isSome(eventDetail.trainingTypeName) && (
                    <p>
                      <span className='text-sm font-medium'>{m.event_trainingType()}: </span>
                      {eventDetail.trainingTypeName.value}
                    </p>
                  )}
                <p>
                  <span className='text-sm font-medium'>{m.event_startDate()}: </span>
                  {formatLocalDate(eventDetail.startAt)} {formatLocalTime(eventDetail.startAt)}
                </p>
                {Option.isSome(eventDetail.endAt) && (
                  <p>
                    <span className='text-sm font-medium'>{m.event_endDate()}: </span>
                    {formatLocalDate(eventDetail.endAt.value)}{' '}
                    {formatLocalTime(eventDetail.endAt.value)}
                  </p>
                )}
                {Option.isSome(eventDetail.location) && (
                  <p>
                    <span className='text-sm font-medium'>{m.event_location()}: </span>
                    {eventDetail.location.value}
                  </p>
                )}
                {Option.isSome(eventDetail.description) && (
                  <p>
                    <span className='text-sm font-medium'>{m.event_description()}: </span>
                    {eventDetail.description.value}
                  </p>
                )}
                {Option.isSome(eventDetail.ownerGroupName) && (
                  <p>
                    <span className='text-sm font-medium'>{m.event_ownerGroup()}: </span>
                    {eventDetail.ownerGroupName.value}
                  </p>
                )}
                {Option.isSome(eventDetail.memberGroupName) && (
                  <p>
                    <span className='text-sm font-medium'>{m.event_memberGroup()}: </span>
                    {eventDetail.memberGroupName.value}
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
        </div>

        {isActive && (
          <div className='order-1 lg:order-2 lg:sticky lg:top-20 lg:self-start'>
            <EventRsvpPanel
              eventDetail={eventDetail}
              rsvpDetail={rsvpDetail}
              nonResponders={nonResponders}
              rsvpResponse={rsvpResponse}
              rsvpMessage={rsvpMessage}
              rsvpSubmitting={rsvpSubmitting}
              onResponseChange={setRsvpResponse}
              onMessageChange={setRsvpMessage}
              onSubmit={handleRsvpSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
