import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { TrainingTypeApi } from '@sideline/domain';
import { Team } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
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
import { withFieldErrors } from '~/lib/form';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

const CreateTrainingTypeSchema = Schema.Struct({
  name: Schema.NonEmptyString.annotations({ message: () => m.validation_required() }),
});

type CreateTrainingTypeValues = Schema.Schema.Type<typeof CreateTrainingTypeSchema>;

interface TrainingTypesListPageProps {
  teamId: string;
  trainingTypes: ReadonlyArray<TrainingTypeApi.TrainingTypeInfo>;
  canAdmin: boolean;
}

export function TrainingTypesListPage({
  teamId,
  trainingTypes,
  canAdmin,
}: TrainingTypesListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);

  const form = useForm({
    resolver: effectTsResolver(CreateTrainingTypeSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: CreateTrainingTypeValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.trainingType.createTrainingType({
          path: { teamId: teamIdBranded },
          payload: {
            name: values.name,
            ownerGroupId: Option.none(),
            memberGroupId: Option.none(),
            discordChannelId: Option.none(),
          },
        }),
      ),
      withFieldErrors(form, [
        {
          tag: 'TrainingTypeNameAlreadyTaken',
          field: 'name',
          message: m.trainingType_nameAlreadyTaken(),
        },
      ]),
      Effect.catchAll(() => ClientError.make(m.trainingType_createFailed())),
      run({ success: m.trainingType_created() }),
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
        <h1 className='text-2xl font-bold'>{m.trainingType_trainingTypes()}</h1>
      </header>

      {canAdmin && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='flex gap-2 mb-6 max-w-md'>
            <FormField
              {...form.register('name')}
              render={({ field }) => (
                <FormItem className='flex-1'>
                  <FormLabel>{m.trainingType_name()}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={m.trainingType_namePlaceholder()} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' disabled={form.formState.isSubmitting} className='self-end'>
              {m.trainingType_createTrainingType()}
            </Button>
          </form>
        </Form>
      )}

      {trainingTypes.length === 0 ? (
        <p className='text-muted-foreground'>{m.trainingType_noTrainingTypes()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {trainingTypes.map((tt) => (
              <tr key={tt.trainingTypeId} className='border-b'>
                <td className='py-2 px-4'>
                  <Link
                    to='/teams/$teamId/training-types/$trainingTypeId'
                    params={{ teamId, trainingTypeId: tt.trainingTypeId }}
                    className='font-medium hover:underline'
                  >
                    {tt.name}
                  </Link>
                  <p className='text-xs text-muted-foreground sm:hidden'>
                    {Option.getOrElse(tt.ownerGroupName, () => m.trainingType_noGroup())}
                  </p>
                </td>
                <td className='hidden sm:table-cell py-2 px-4 text-muted-foreground'>
                  {Option.getOrElse(tt.ownerGroupName, () => m.trainingType_noGroup())}
                </td>
                <td className='py-2 px-4'>
                  <Button asChild variant='outline' size='sm'>
                    <Link
                      to='/teams/$teamId/training-types/$trainingTypeId'
                      params={{ teamId, trainingTypeId: tt.trainingTypeId }}
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
