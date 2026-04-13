import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { Roster as RosterDomain } from '@sideline/domain';
import { Team } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { useForm } from 'react-hook-form';
import { ColorDot } from '~/components/atoms/ColorDot.js';
import { ColorPicker } from '~/components/atoms/ColorPicker.js';
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

const CreateRosterSchema = Schema.Struct({
  name: Schema.NonEmptyString.annotations({ message: () => m.validation_required() }),
});

type CreateRosterValues = Schema.Schema.Type<typeof CreateRosterSchema>;

interface RostersListPageProps {
  teamId: string;
  rosters: ReadonlyArray<RosterDomain.RosterInfo>;
  canManage: boolean;
  userId: string;
}

export function RostersListPage({ teamId, rosters, canManage }: RostersListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const [createEmoji, setCreateEmoji] = React.useState('');
  const [createColor, setCreateColor] = React.useState<string | undefined>(undefined);

  const form = useForm({
    resolver: effectTsResolver(CreateRosterSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: CreateRosterValues) => {
    const result = await ApiClient.asEffect().pipe(
      Effect.flatMap((api) =>
        api.roster.createRoster({
          path: { teamId: teamIdBranded },
          payload: {
            name: values.name,
            emoji: createEmoji ? Option.some(createEmoji) : Option.none(),
            color: createColor ? Option.some(createColor) : Option.none(),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_createFailed())),
      run({ success: m.roster_rosterCreated() }),
    );
    if (Option.isSome(result)) {
      form.reset();
      setCreateEmoji('');
      setCreateColor(undefined);
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

      {canManage && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:max-w-lg'
          >
            <div className='flex gap-2 items-end'>
              <div className='flex flex-col'>
                <label htmlFor='roster-create-emoji' className='text-sm font-medium mb-1'>
                  {m.roster_emoji()}
                </label>
                <Input
                  id='roster-create-emoji'
                  value={createEmoji}
                  onChange={(e) => setCreateEmoji(e.target.value)}
                  className='w-16 shrink-0'
                  placeholder='🏅'
                />
              </div>
              <div className='flex flex-col'>
                <label htmlFor='roster-create-color' className='text-sm font-medium mb-1'>
                  {m.common_color()}
                </label>
                <ColorPicker
                  id='roster-create-color'
                  value={createColor}
                  onChange={setCreateColor}
                />
              </div>
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
            </div>
            <Button type='submit' disabled={form.formState.isSubmitting} className='self-end'>
              {m.roster_createRoster()}
            </Button>
          </form>
        </Form>
      )}

      {rosters.length === 0 ? (
        <p className='text-muted-foreground'>{m.roster_noRosters()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {rosters.map((roster) => (
              <tr key={roster.rosterId} className='border-b'>
                <td className='py-2 px-4'>
                  <div className='flex items-center gap-2'>
                    <ColorDot color={Option.getOrUndefined(roster.color)} />
                    <Link
                      to='/teams/$teamId/rosters/$rosterId'
                      params={{ teamId, rosterId: roster.rosterId }}
                      className='font-medium hover:underline'
                    >
                      {Option.isSome(roster.emoji)
                        ? `${roster.emoji.value} ${roster.name}`
                        : roster.name}
                    </Link>
                  </div>
                  <p className='text-xs text-muted-foreground sm:hidden'>
                    <span className={roster.active ? 'text-green-700 font-medium' : 'font-medium'}>
                      {roster.active ? m.roster_active() : m.roster_inactive()}
                    </span>
                    {' · '}
                    {m.roster_memberCount({ count: roster.memberCount })}
                  </p>
                </td>
                <td className='hidden sm:table-cell py-2 px-4'>
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
                <td className='hidden sm:table-cell py-2 px-4 text-muted-foreground'>
                  {m.roster_memberCount({ count: roster.memberCount })}
                </td>
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
