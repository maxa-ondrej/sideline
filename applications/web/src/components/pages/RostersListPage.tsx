import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { Roster as RosterDomain } from '@sideline/domain';
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

const CreateRosterSchema = Schema.Struct({
  name: Schema.NonEmptyString,
});

type CreateRosterValues = Schema.Schema.Type<typeof CreateRosterSchema>;

interface RostersListPageProps {
  teamId: string;
  rosters: ReadonlyArray<RosterDomain.RosterInfo>;
  userId: string;
}

export function RostersListPage({ teamId, rosters }: RostersListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);

  const form = useForm({
    resolver: effectTsResolver(CreateRosterSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: CreateRosterValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.roster.createRoster({
          path: { teamId: teamIdBranded },
          payload: { name: values.name },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_createFailed())),
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
        <h1 className='text-2xl font-bold'>{m.roster_rosters()}</h1>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex gap-2 mb-6 max-w-md'>
          <FormField
            {...form.register('name')}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel>{m.roster_rosterName()}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={m.roster_rosterNamePlaceholder()} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit' disabled={form.formState.isSubmitting} className='self-end'>
            {m.roster_createRoster()}
          </Button>
        </form>
      </Form>

      {rosters.length === 0 ? (
        <p className='text-muted-foreground'>{m.roster_noRosters()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {rosters.map((roster) => (
              <tr key={roster.rosterId} className='border-b'>
                <td className='py-2 px-4'>
                  <Link
                    to='/teams/$teamId/rosters/$rosterId'
                    params={{ teamId, rosterId: roster.rosterId }}
                    className='font-medium hover:underline'
                  >
                    {roster.name}
                  </Link>
                </td>
                <td className='py-2 px-4'>
                  <span
                    className={
                      roster.active
                        ? 'text-green-700 font-medium'
                        : 'text-muted-foreground font-medium'
                    }
                  >
                    {roster.active ? m.roster_active() : m.roster_inactive()}
                  </span>
                </td>
                <td className='py-2 px-4 text-muted-foreground'>{roster.memberCount} members</td>
                <td className='py-2 px-4'>
                  <Button asChild variant='outline' size='sm'>
                    <Link
                      to='/teams/$teamId/rosters/$rosterId'
                      params={{ teamId, rosterId: roster.rosterId }}
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
