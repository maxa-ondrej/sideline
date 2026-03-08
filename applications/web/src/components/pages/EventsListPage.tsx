import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { EventApi, GroupApi, TrainingTypeApi } from '@sideline/domain';
import { Event, EventSeries, Team, TrainingType } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useRouter } from '@tanstack/react-router';
import { DateTime, Effect, Option, Schema } from 'effect';
import { CalendarDays, List } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { EventCalendarView } from '~/components/organisms/EventCalendarView';
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

const NONE_VALUE = '__none__';

const CreateEventSchema = Schema.Struct({
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

type CreateEventValues = Schema.Schema.Type<typeof CreateEventSchema>;

const toIsoDateTime = (date: string, time: string): string =>
  DateTime.formatIso(DateTime.unsafeMake(`${date}T${time}:00Z`));

const CreateSeriesSchema = Schema.Struct({
  title: Schema.NonEmptyString,
  trainingTypeId: Schema.String,
  description: Schema.String,
  frequency: EventSeries.RecurrenceFrequency,
  daysOfWeek: EventSeries.DaysOfWeek,
  startDate: Schema.NonEmptyString,
  endDate: Schema.String,
  startTime: Schema.NonEmptyString,
  endTime: Schema.String,
  location: Schema.String,
  discordChannelId: Schema.String,
});

type CreateSeriesValues = Schema.Schema.Type<typeof CreateSeriesSchema>;

const eventTypeLabels: Record<Event.EventType, () => string> = {
  training: m.event_type_training,
  match: m.event_type_match,
  tournament: m.event_type_tournament,
  meeting: m.event_type_meeting,
  social: m.event_type_social,
  other: m.event_type_other,
};

const dayShortLabels: Record<number, () => string> = {
  0: m.event_day_short_0,
  1: m.event_day_short_1,
  2: m.event_day_short_2,
  3: m.event_day_short_3,
  4: m.event_day_short_4,
  5: m.event_day_short_5,
  6: m.event_day_short_6,
};

const dayFullLabels: Record<number, () => string> = {
  0: m.event_day_0,
  1: m.event_day_1,
  2: m.event_day_2,
  3: m.event_day_3,
  4: m.event_day_4,
  5: m.event_day_5,
  6: m.event_day_6,
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const sortDays = (days: number[]): number[] =>
  [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

interface EventsListPageProps {
  teamId: string;
  events: ReadonlyArray<EventApi.EventInfo>;
  canCreate: boolean;
  trainingTypes: ReadonlyArray<TrainingTypeApi.TrainingTypeInfo>;
  discordChannels: ReadonlyArray<GroupApi.DiscordChannelInfo>;
}

export function EventsListPage({
  teamId,
  events,
  canCreate,
  trainingTypes,
  discordChannels,
}: EventsListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const [viewMode, setViewMode] = React.useState<'list' | 'calendar'>('list');
  const [mode, setMode] = React.useState<'one-time' | 'recurring'>('one-time');

  const form = useForm({
    resolver: effectTsResolver(CreateEventSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      eventType: 'training' as Event.EventType,
      trainingTypeId: NONE_VALUE,
      description: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      location: '',
      discordChannelId: NONE_VALUE,
    },
  });

  const watchedEventType = form.watch('eventType');

  const seriesForm = useForm({
    resolver: effectTsResolver(CreateSeriesSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      trainingTypeId: NONE_VALUE,
      description: '',
      frequency: 'weekly' as EventSeries.RecurrenceFrequency,
      daysOfWeek: [] as number[],
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      startTime: '',
      endTime: '',
      location: '',
      discordChannelId: NONE_VALUE,
    },
  });

  React.useEffect(() => {
    if (watchedEventType !== 'training') {
      form.setValue('trainingTypeId', NONE_VALUE);
    }
  }, [watchedEventType, form]);

  const onSubmit = async (values: CreateEventValues) => {
    const startAt = toIsoDateTime(values.startDate, values.startTime);
    const endAt = values.endTime
      ? toIsoDateTime(values.endDate || values.startDate, values.endTime)
      : null;
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.event.createEvent({
          path: { teamId: teamIdBranded },
          payload: {
            title: values.title,
            eventType: values.eventType,
            trainingTypeId:
              values.trainingTypeId && values.trainingTypeId !== NONE_VALUE
                ? Schema.decodeSync(TrainingType.TrainingTypeId)(values.trainingTypeId)
                : null,
            description: values.description || null,
            startAt,
            endAt,
            location: values.location || null,
            discordChannelId:
              values.discordChannelId && values.discordChannelId !== NONE_VALUE
                ? values.discordChannelId
                : null,
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_createFailed())),
      run(),
    );
    if (Option.isSome(result)) {
      form.reset();
      router.invalidate();
    }
  };

  const onSubmitSeries = async (values: CreateSeriesValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.eventSeries.createEventSeries({
          path: { teamId: teamIdBranded },
          payload: {
            title: values.title,
            trainingTypeId:
              values.trainingTypeId && values.trainingTypeId !== NONE_VALUE
                ? Schema.decodeSync(TrainingType.TrainingTypeId)(values.trainingTypeId)
                : null,
            description: values.description || null,
            frequency: values.frequency,
            daysOfWeek: values.daysOfWeek,
            startDate: values.startDate,
            endDate: values.endDate || null,
            startTime: values.startTime,
            endTime: values.endTime || null,
            location: values.location || null,
            discordChannelId:
              values.discordChannelId && values.discordChannelId !== NONE_VALUE
                ? values.discordChannelId
                : null,
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_createSeriesFailed())),
      run(),
    );
    if (Option.isSome(result)) {
      seriesForm.reset();
      router.invalidate();
    }
  };

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId' params={{ teamId }}>
            ← {m.team_backToTeams()}
          </Link>
        </Button>
        <div className='flex items-center gap-3'>
          <h1 className='text-2xl font-bold'>{m.event_events()}</h1>
          <div className='flex rounded-md border'>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size='icon'
              className='rounded-r-none h-8 w-8'
              onClick={() => setViewMode('list')}
              title={m.event_viewList()}
            >
              <List className='h-4 w-4' />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size='icon'
              className='rounded-l-none h-8 w-8'
              onClick={() => setViewMode('calendar')}
              title={m.event_viewCalendar()}
            >
              <CalendarDays className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </header>

      {viewMode === 'calendar' ? (
        <EventCalendarView teamId={teamId} events={events} trainingTypes={trainingTypes} />
      ) : (
        <>
          {canCreate && (
            <div className='mb-8 max-w-lg'>
              <div className='flex gap-2 mb-4'>
                <Button
                  variant={mode === 'one-time' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setMode('one-time')}
                >
                  {m.event_oneTime()}
                </Button>
                <Button
                  variant={mode === 'recurring' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setMode('recurring')}
                >
                  {m.event_recurring()}
                </Button>
              </div>

              {mode === 'one-time' ? (
                <Form key='one-time' {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className='flex flex-col gap-4'>
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
                          <p className='text-xs text-muted-foreground'>
                            {m.event_discordChannelHelp()}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type='submit'
                      disabled={form.formState.isSubmitting}
                      className='self-start'
                    >
                      {m.event_createEvent()}
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form key='recurring' {...seriesForm}>
                  <form
                    onSubmit={seriesForm.handleSubmit(onSubmitSeries)}
                    className='flex flex-col gap-4'
                  >
                    <FormField
                      {...seriesForm.register('title')}
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
                        {...seriesForm.register('trainingTypeId')}
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
                      <FormField
                        {...seriesForm.register('frequency')}
                        render={({ field }) => (
                          <FormItem className='flex-1'>
                            <FormLabel>{m.event_frequency()}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value='weekly'>{m.event_frequency_weekly()}</SelectItem>
                                <SelectItem value='biweekly'>
                                  {m.event_frequency_biweekly()}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      name='daysOfWeek'
                      control={seriesForm.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{m.event_daysOfWeek()}</FormLabel>
                          <div className='flex gap-1'>
                            {DAY_ORDER.map((d) => {
                              const selected = (field.value as number[]).includes(d);
                              return (
                                <Button
                                  key={d}
                                  type='button'
                                  size='sm'
                                  variant={selected ? 'default' : 'outline'}
                                  className='w-10'
                                  aria-pressed={selected}
                                  aria-label={dayFullLabels[d]()}
                                  onClick={() => {
                                    const current = field.value as number[];
                                    field.onChange(
                                      sortDays(
                                        selected ? current.filter((v) => v !== d) : [...current, d],
                                      ),
                                    );
                                  }}
                                >
                                  {dayShortLabels[d]()}
                                </Button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className='flex gap-4'>
                      <FormField
                        {...seriesForm.register('startDate')}
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
                        {...seriesForm.register('endDate')}
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
                            <p className='text-xs text-muted-foreground'>{m.event_endDateHelp()}</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className='flex gap-4'>
                      <FormField
                        {...seriesForm.register('startTime')}
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
                      <FormField
                        {...seriesForm.register('endTime')}
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
                      {...seriesForm.register('location')}
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
                      {...seriesForm.register('description')}
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
                      {...seriesForm.register('discordChannelId')}
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
                          <p className='text-xs text-muted-foreground'>
                            {m.event_discordChannelHelp()}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type='submit'
                      disabled={seriesForm.formState.isSubmitting}
                      className='self-start'
                    >
                      {m.event_createSeries()}
                    </Button>
                  </form>
                </Form>
              )}
            </div>
          )}

          {events.length === 0 ? (
            <p className='text-muted-foreground'>{m.event_noEvents()}</p>
          ) : (
            <table className='w-full'>
              <tbody>
                {events.map((event) => (
                  <tr key={event.eventId} className='border-b'>
                    <td className='py-2 px-4'>
                      <Link
                        to='/teams/$teamId/events/$eventId'
                        params={{ teamId, eventId: event.eventId }}
                        className='font-medium hover:underline'
                      >
                        {event.title}
                      </Link>
                      {event.seriesId !== null && (
                        <span className='ml-2 text-xs text-muted-foreground'>
                          {m.event_recurring()}
                        </span>
                      )}
                    </td>
                    <td className='py-2 px-4 text-muted-foreground'>
                      {eventTypeLabels[event.eventType]()}
                    </td>
                    <td className='py-2 px-4 text-muted-foreground'>{event.trainingTypeName}</td>
                    <td className='py-2 px-4 text-muted-foreground'>
                      {event.startAt.slice(0, 10)}
                    </td>
                    <td className='py-2 px-4 text-muted-foreground'>
                      {event.startAt.slice(11, 16)}
                      {event.endAt ? ` - ${event.endAt.slice(11, 16)}` : ''}
                    </td>
                    <td className='py-2 px-4'>
                      <span
                        className={
                          event.status === 'active'
                            ? 'text-green-700 font-medium'
                            : 'text-muted-foreground line-through'
                        }
                      >
                        {event.status === 'active'
                          ? m.event_status_active()
                          : m.event_status_cancelled()}
                      </span>
                    </td>
                    <td className='py-2 px-4'>
                      <Button asChild variant='outline' size='sm'>
                        <Link
                          to='/teams/$teamId/events/$eventId'
                          params={{ teamId, eventId: event.eventId }}
                        >
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
