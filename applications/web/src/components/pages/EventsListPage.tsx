import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { EventApi, TrainingTypeApi } from '@sideline/domain';
import { Event, Team, TrainingType } from '@sideline/domain';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
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

const CreateEventSchema = Schema.Struct({
  title: Schema.NonEmptyString,
  eventType: Event.EventType,
  trainingTypeId: Schema.String,
  description: Schema.String,
  eventDate: Schema.NonEmptyString,
  startTime: Schema.NonEmptyString,
  endTime: Schema.String,
  location: Schema.String,
});

type CreateEventValues = Schema.Schema.Type<typeof CreateEventSchema>;

const eventTypeLabels: Record<Event.EventType, () => string> = {
  training: m.event_type_training,
  match: m.event_type_match,
  tournament: m.event_type_tournament,
  meeting: m.event_type_meeting,
  social: m.event_type_social,
  other: m.event_type_other,
};

interface EventsListPageProps {
  teamId: string;
  events: ReadonlyArray<EventApi.EventInfo>;
  canCreate: boolean;
  trainingTypes: ReadonlyArray<TrainingTypeApi.TrainingTypeInfo>;
}

export function EventsListPage({ teamId, events, canCreate, trainingTypes }: EventsListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);

  const form = useForm({
    resolver: effectTsResolver(CreateEventSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      eventType: 'training' as Event.EventType,
      trainingTypeId: NONE_VALUE,
      description: '',
      eventDate: '',
      startTime: '',
      endTime: '',
      location: '',
    },
  });

  const onSubmit = async (values: CreateEventValues) => {
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
            eventDate: values.eventDate,
            startTime: values.startTime,
            endTime: values.endTime || null,
            location: values.location || null,
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.event_createFailed())),
      run,
    );
    if (Option.isSome(result)) {
      form.reset();
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
        <h1 className='text-2xl font-bold'>{m.event_events()}</h1>
      </header>

      {canCreate && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4 mb-8 max-w-lg'
          >
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
            </div>
            <div className='flex gap-4'>
              <FormField
                {...form.register('eventDate')}
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormLabel>{m.event_eventDate()}</FormLabel>
                    <FormControl>
                      <Input {...field} type='date' />
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
                    <Textarea {...field} placeholder={m.event_descriptionPlaceholder()} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' disabled={form.formState.isSubmitting} className='self-start'>
              {m.event_createEvent()}
            </Button>
          </form>
        </Form>
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
                </td>
                <td className='py-2 px-4 text-muted-foreground'>
                  {eventTypeLabels[event.eventType]()}
                </td>
                <td className='py-2 px-4 text-muted-foreground'>{event.trainingTypeName}</td>
                <td className='py-2 px-4 text-muted-foreground'>{event.eventDate}</td>
                <td className='py-2 px-4 text-muted-foreground'>
                  {event.startTime}
                  {event.endTime ? ` - ${event.endTime}` : ''}
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
    </div>
  );
}
