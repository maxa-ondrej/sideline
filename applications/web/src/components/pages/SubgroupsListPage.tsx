import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { SubgroupApi } from '@sideline/domain';
import { Team } from '@sideline/domain';
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
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

const CreateSubgroupSchema = Schema.Struct({
  name: Schema.NonEmptyString,
});

type CreateSubgroupValues = Schema.Schema.Type<typeof CreateSubgroupSchema>;

interface SubgroupsListPageProps {
  teamId: string;
  subgroups: ReadonlyArray<SubgroupApi.SubgroupInfo>;
}

export function SubgroupsListPage({ teamId, subgroups }: SubgroupsListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);

  const form = useForm({
    resolver: effectTsResolver(CreateSubgroupSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: CreateSubgroupValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.subgroup.createSubgroup({
          path: { teamId: teamIdBranded },
          payload: { name: values.name },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.subgroup_createFailed())),
      run,
    );
    if (Option.isSome(result)) {
      form.reset();
      router.invalidate();
    }
  };

  return (
    <div className='p-4'>
      <Button asChild variant='ghost' className='mb-4'>
        <Link to='/teams/$teamId/members' params={{ teamId }}>
          ← {m.members_viewMembers()}
        </Link>
      </Button>
      <h1 className='text-2xl font-bold mb-4'>{m.subgroup_subgroups()}</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex gap-2 mb-6 max-w-md'>
          <FormField
            {...form.register('name')}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel>{m.subgroup_subgroupName()}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={m.subgroup_subgroupNamePlaceholder()} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit' disabled={form.formState.isSubmitting} className='self-end'>
            {m.subgroup_createSubgroup()}
          </Button>
        </form>
      </Form>

      {subgroups.length === 0 ? (
        <p className='text-muted-foreground'>{m.subgroup_noSubgroups()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {subgroups.map((sg) => (
              <tr key={sg.subgroupId} className='border-b'>
                <td className='py-2 px-4'>
                  <Link
                    to='/teams/$teamId/subgroups/$subgroupId'
                    params={{ teamId, subgroupId: sg.subgroupId }}
                    className='font-medium hover:underline'
                  >
                    {sg.name}
                  </Link>
                </td>
                <td className='py-2 px-4 text-muted-foreground'>
                  {m.subgroup_memberCount({ count: String(sg.memberCount) })}
                </td>
                <td className='py-2 px-4'>
                  <Button asChild variant='outline' size='sm'>
                    <Link
                      to='/teams/$teamId/subgroups/$subgroupId'
                      params={{ teamId, subgroupId: sg.subgroupId }}
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
