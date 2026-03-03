import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { EventSeriesApi, TrainingTypeApi } from '@sideline/domain';
import { EventSeries, Team, TrainingType } from '@sideline/domain';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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

const dayOfWeekLabels: Record<number, () => string> = {
  0: m.event_day_0,
  1: m.event_day_1,
  2: m.event_day_2,
  3: m.event_day_3,
  4: m.event_day_4,
  5: m.event_day_5,
  6: m.event_day_6,
};

const CreateScheduleSchema = Schema.Struct({
  title: Schema.NonEmptyString,
  description: Schema.String,
  frequency: EventSeries.RecurrenceFrequency,
  dayOfWeek: Schema.NumberFromString,
  startDate: Schema.NonEmptyString,
  endDate: Schema.String,
  startTime: Schema.NonEmptyString,
  endTime: Schema.String,
  location: Schema.String,
});

type CreateScheduleValues = Schema.Schema.Type<typeof CreateScheduleSchema>;

interface TrainingTypeDetailPageProps {
  teamId: string;
  trainingTypeId: string;
  trainingTypeDetail: TrainingTypeApi.TrainingTypeDetail;
  canAdmin: boolean;
  series: ReadonlyArray<EventSeriesApi.EventSeriesInfo>;
}

export function TrainingTypeDetailPage({
  teamId,
  trainingTypeId,
  trainingTypeDetail,
  canAdmin,
  series,
}: TrainingTypeDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const navigate = useNavigate();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const trainingTypeIdBranded = Schema.decodeSync(TrainingType.TrainingTypeId)(trainingTypeId);

  const [name, setName] = React.useState(trainingTypeDetail.name);
  const [saving, setSaving] = React.useState(false);
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  const scheduleForm = useForm({
    resolver: effectTsResolver(CreateScheduleSchema),
    mode: 'onChange',
    defaultValues: {
      title: trainingTypeDetail.name,
      description: '',
      frequency: 'weekly' as EventSeries.RecurrenceFrequency,
      dayOfWeek: '1',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      startTime: '',
      endTime: '',
      location: '',
    },
  });

  const handleSaveName = React.useCallback(async () => {
    setSaving(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.trainingType.updateTrainingType({
          path: { teamId: teamIdBranded, trainingTypeId: trainingTypeIdBranded },
          payload: { name },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.trainingType_updateFailed())),
      run,
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, trainingTypeIdBranded, name, run, router]);

  const handleDelete = React.useCallback(async () => {
    if (!window.confirm(m.trainingType_deleteConfirm())) return;
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.trainingType.deleteTrainingType({
          path: { teamId: teamIdBranded, trainingTypeId: trainingTypeIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.trainingType_deleteFailed())),
      run,
    );
    if (Option.isSome(result)) {
      toast.success(m.trainingType_deleted());
      navigate({ to: '/teams/$teamId/training-types', params: { teamId } });
    }
  }, [teamId, teamIdBranded, trainingTypeIdBranded, run, navigate]);

  const onSubmitSchedule = async (values: CreateScheduleValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.eventSeries.createEventSeries({
          path: { teamId: teamIdBranded },
          payload: {
            title: values.title,
            trainingTypeId: trainingTypeIdBranded,
            description: values.description || null,
            frequency: values.frequency,
            dayOfWeek: values.dayOfWeek as EventSeries.DayOfWeek,
            startDate: values.startDate,
            endDate: values.endDate || null,
            startTime: values.startTime,
            endTime: values.endTime || null,
            location: values.location || null,
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.trainingType_createScheduleFailed())),
      run,
    );
    if (Option.isSome(result)) {
      scheduleForm.reset({ ...scheduleForm.formState.defaultValues } as Record<string, string>);
      setShowCreateForm(false);
      router.invalidate();
    }
  };

  const handleCancelSchedule = React.useCallback(
    async (seriesId: string) => {
      if (!window.confirm(m.trainingType_cancelScheduleConfirm())) return;
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.eventSeries.cancelEventSeries({
            path: {
              teamId: teamIdBranded,
              seriesId: Schema.decodeSync(EventSeries.EventSeriesId)(seriesId),
            },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.event_cancelFailed())),
        run,
      );
      if (Option.isSome(result)) {
        toast.success(m.trainingType_scheduleCancelled());
        router.invalidate();
      }
    },
    [teamIdBranded, run, router],
  );

  const activeSeries = series.filter((s) => s.status === 'active');

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId/training-types' params={{ teamId }}>
            ← {m.trainingType_backToTrainingTypes()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{trainingTypeDetail.name}</h1>
        {trainingTypeDetail.groupName && (
          <p className='text-muted-foreground'>
            {m.trainingType_groupName()}: {trainingTypeDetail.groupName}
          </p>
        )}
      </header>

      <div className='flex flex-col gap-6'>
        {/* Rename */}
        <div>
          <label htmlFor='training-type-name' className='text-sm font-medium mb-1 block'>
            {m.trainingType_rename()}
          </label>
          <div className='flex gap-2'>
            <Input
              id='training-type-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='flex-1'
            />
            <Button onClick={handleSaveName} disabled={saving || name === trainingTypeDetail.name}>
              {saving ? m.trainingType_saving() : m.trainingType_saveChanges()}
            </Button>
          </div>
        </div>

        {/* Recurring Schedules */}
        {canAdmin && (
          <div>
            <h2 className='text-lg font-semibold mb-3'>{m.trainingType_recurringSchedules()}</h2>

            {activeSeries.length === 0 && !showCreateForm && (
              <p className='text-muted-foreground mb-3'>{m.trainingType_noSchedules()}</p>
            )}

            {activeSeries.length > 0 && (
              <table className='w-full mb-4'>
                <tbody>
                  {activeSeries.map((s) => (
                    <tr key={s.seriesId} className='border-b'>
                      <td className='py-2 px-4 font-medium'>{s.title}</td>
                      <td className='py-2 px-4 text-muted-foreground'>
                        {s.frequency === 'weekly'
                          ? m.event_frequency_weekly()
                          : m.event_frequency_biweekly()}
                      </td>
                      <td className='py-2 px-4 text-muted-foreground'>
                        {dayOfWeekLabels[s.dayOfWeek]()}
                      </td>
                      <td className='py-2 px-4 text-muted-foreground'>
                        {s.startTime}
                        {s.endTime ? ` - ${s.endTime}` : ''}
                      </td>
                      <td className='py-2 px-4 text-muted-foreground'>
                        {s.startDate} → {s.endDate ?? m.event_ongoing()}
                      </td>
                      <td className='py-2 px-4'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => handleCancelSchedule(s.seriesId)}
                        >
                          {m.trainingType_cancelSchedule()}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showCreateForm ? (
              <div className='max-w-lg'>
                <Form {...scheduleForm}>
                  <form
                    onSubmit={scheduleForm.handleSubmit(onSubmitSchedule)}
                    className='flex flex-col gap-4'
                  >
                    <FormField
                      {...scheduleForm.register('title')}
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
                        {...scheduleForm.register('frequency')}
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
                      <FormField
                        {...scheduleForm.register('dayOfWeek')}
                        render={({ field }) => (
                          <FormItem className='flex-1'>
                            <FormLabel>{m.event_dayOfWeek()}</FormLabel>
                            <Select onValueChange={field.onChange} value={String(field.value)}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                                  <SelectItem key={d} value={String(d)}>
                                    {dayOfWeekLabels[d]()}
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
                        {...scheduleForm.register('startDate')}
                        render={({ field }) => (
                          <FormItem className='flex-1'>
                            <FormLabel>{m.event_startDate()}</FormLabel>
                            <FormControl>
                              <Input {...field} type='date' />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        {...scheduleForm.register('endDate')}
                        render={({ field }) => (
                          <FormItem className='flex-1'>
                            <FormLabel>{m.event_endDate()}</FormLabel>
                            <FormControl>
                              <Input {...field} type='date' />
                            </FormControl>
                            <p className='text-xs text-muted-foreground'>{m.event_endDateHelp()}</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className='flex gap-4'>
                      <FormField
                        {...scheduleForm.register('startTime')}
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
                        {...scheduleForm.register('endTime')}
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
                      {...scheduleForm.register('location')}
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
                      {...scheduleForm.register('description')}
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
                    <div className='flex gap-2'>
                      <Button type='submit' disabled={scheduleForm.formState.isSubmitting}>
                        {m.trainingType_createSchedule()}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => setShowCreateForm(false)}
                      >
                        {m.guild_back()}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            ) : (
              <Button variant='outline' onClick={() => setShowCreateForm(true)}>
                {m.trainingType_createSchedule()}
              </Button>
            )}
          </div>
        )}

        {/* Delete */}
        {canAdmin && (
          <div>
            <Button variant='destructive' onClick={handleDelete}>
              {m.trainingType_deleteTrainingType()}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
