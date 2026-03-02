import type { TrainingTypeApi } from '@sideline/domain';
import { Team, TrainingType } from '@sideline/domain';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

interface TrainingTypeDetailPageProps {
  teamId: string;
  trainingTypeId: string;
  trainingTypeDetail: TrainingTypeApi.TrainingTypeDetail;
  canAdmin: boolean;
}

export function TrainingTypeDetailPage({
  teamId,
  trainingTypeId,
  trainingTypeDetail,
  canAdmin,
}: TrainingTypeDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const navigate = useNavigate();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const trainingTypeIdBranded = Schema.decodeSync(TrainingType.TrainingTypeId)(trainingTypeId);

  const [name, setName] = React.useState(trainingTypeDetail.name);
  const [saving, setSaving] = React.useState(false);

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
