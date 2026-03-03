import type { EventApi, TrainingTypeApi } from '@sideline/domain';
import { Event, Team, TrainingType } from '@sideline/domain';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
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
}

export function EventDetailPage({
  teamId,
  eventId,
  eventDetail,
  trainingTypes,
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
  const [eventDate, setEventDate] = React.useState(eventDetail.eventDate);
  const [startTime, setStartTime] = React.useState(eventDetail.startTime);
  const [endTime, setEndTime] = React.useState(eventDetail.endTime ?? '');
  const [location, setLocation] = React.useState(eventDetail.location ?? '');
  const [saving, setSaving] = React.useState(false);

  const handleSave = React.useCallback(async () => {
    setSaving(true);
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
            eventDate: Option.some(eventDate),
            startTime: Option.some(startTime),
            endTime: Option.some(endTime ? Option.some(endTime) : Option.none()),
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

  const handleCancel = React.useCallback(async () => {
    if (!window.confirm(m.event_cancelConfirm())) return;
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
                <Input
                  id='event-date'
                  type='date'
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
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
              {eventDetail.eventDate}
            </p>
            <p>
              <span className='text-sm font-medium'>{m.event_startTime()}: </span>
              {eventDetail.startTime}
              {eventDetail.endTime ? ` - ${eventDetail.endTime}` : ''}
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
    </div>
  );
}
