import type { Roster as RosterDomain, TrainingTypeApi } from '@sideline/domain';
import { Team, TeamMember, TrainingType } from '@sideline/domain';
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
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

interface TrainingTypeDetailPageProps {
  teamId: string;
  trainingTypeId: string;
  trainingTypeDetail: TrainingTypeApi.TrainingTypeDetail;
  allMembers: ReadonlyArray<RosterDomain.RosterPlayer>;
}

export function TrainingTypeDetailPage({
  teamId,
  trainingTypeId,
  trainingTypeDetail,
  allMembers,
}: TrainingTypeDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const navigate = useNavigate();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const trainingTypeIdBranded = Schema.decodeSync(TrainingType.TrainingTypeId)(trainingTypeId);

  const [name, setName] = React.useState(trainingTypeDetail.name);
  const [saving, setSaving] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');

  const coachIdsInTrainingType = new Set(trainingTypeDetail.coaches.map((c) => c.memberId));
  const availableMembers = allMembers.filter((m) => !coachIdsInTrainingType.has(m.memberId));

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

  const handleAddCoach = React.useCallback(async () => {
    if (!selectedMemberId) return;
    const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(selectedMemberId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.trainingType.addTrainingTypeCoach({
          path: { teamId: teamIdBranded, trainingTypeId: trainingTypeIdBranded },
          payload: { memberId },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.trainingType_updateFailed())),
      run,
    );
    if (Option.isSome(result)) {
      setSelectedMemberId('');
      toast.success(m.trainingType_coachAdded());
      router.invalidate();
    }
  }, [selectedMemberId, teamIdBranded, trainingTypeIdBranded, run, router]);

  const handleRemoveCoach = React.useCallback(
    async (memberIdRaw: string) => {
      const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(memberIdRaw);
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.trainingType.removeTrainingTypeCoach({
            path: { teamId: teamIdBranded, trainingTypeId: trainingTypeIdBranded, memberId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.trainingType_updateFailed())),
        run,
      );
      if (Option.isSome(result)) {
        toast.success(m.trainingType_coachRemoved());
        router.invalidate();
      }
    },
    [teamIdBranded, trainingTypeIdBranded, run, router],
  );

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

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId/training-types' params={{ teamId }}>
            ← {m.trainingType_backToTrainingTypes()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{trainingTypeDetail.name}</h1>
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

        {/* Coaches */}
        <div>
          <p className='text-sm font-medium mb-2'>{m.trainingType_coaches()}</p>
          <div className='flex gap-2 mb-4'>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className='flex-1'>
                <SelectValue placeholder={m.trainingType_addCoach()} />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.memberId} value={member.memberId}>
                    {member.name ?? member.discordUsername}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddCoach} disabled={!selectedMemberId}>
              {m.trainingType_addCoach()}
            </Button>
          </div>

          {trainingTypeDetail.coaches.length === 0 ? (
            <p className='text-muted-foreground'>{m.members_noPlayers()}</p>
          ) : (
            <table className='w-full'>
              <tbody>
                {trainingTypeDetail.coaches.map((coach) => (
                  <tr key={coach.memberId} className='border-b'>
                    <td className='py-2 px-4'>{coach.name ?? coach.discordUsername}</td>
                    <td className='py-2 px-4'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleRemoveCoach(coach.memberId)}
                      >
                        {m.trainingType_removeCoach()}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete */}
        <div>
          <Button variant='destructive' onClick={handleDelete}>
            {m.trainingType_deleteTrainingType()}
          </Button>
        </div>
      </div>
    </div>
  );
}
