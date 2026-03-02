import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { GroupApi } from '@sideline/domain';
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

const CreateGroupSchema = Schema.Struct({
  name: Schema.NonEmptyString,
});

type CreateGroupValues = Schema.Schema.Type<typeof CreateGroupSchema>;

interface GroupsListPageProps {
  teamId: string;
  groups: ReadonlyArray<GroupApi.GroupInfo>;
}

export function GroupsListPage({ teamId, groups }: GroupsListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);

  const form = useForm({
    resolver: effectTsResolver(CreateGroupSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: CreateGroupValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.createGroup({
          path: { teamId: teamIdBranded },
          payload: { name: values.name, parentId: null, emoji: null },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_createFailed())),
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
        <h1 className='text-2xl font-bold'>{m.group_groups()}</h1>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex gap-2 mb-6 max-w-md'>
          <FormField
            {...form.register('name')}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel>{m.group_groupName()}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={m.group_groupNamePlaceholder()} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit' disabled={form.formState.isSubmitting} className='self-end'>
            {m.group_createGroup()}
          </Button>
        </form>
      </Form>

      {groups.length === 0 ? (
        <p className='text-muted-foreground'>{m.group_noGroups()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {groups.map((g) => (
              <tr key={g.groupId} className='border-b'>
                <td className='py-2 px-4'>
                  <Link
                    to='/teams/$teamId/groups/$groupId'
                    params={{ teamId, groupId: g.groupId }}
                    className='font-medium hover:underline'
                  >
                    {g.emoji ? `${g.emoji} ${g.name}` : g.name}
                  </Link>
                </td>
                <td className='py-2 px-4 text-muted-foreground'>
                  {m.group_memberCount({ count: String(g.memberCount) })}
                </td>
                <td className='py-2 px-4'>
                  <Button asChild variant='outline' size='sm'>
                    <Link
                      to='/teams/$teamId/groups/$groupId'
                      params={{ teamId, groupId: g.groupId }}
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
