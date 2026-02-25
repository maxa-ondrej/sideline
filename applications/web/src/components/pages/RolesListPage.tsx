import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { RoleApi } from '@sideline/domain';
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

const CreateRoleSchema = Schema.Struct({
  name: Schema.NonEmptyString,
});

type CreateRoleValues = Schema.Schema.Type<typeof CreateRoleSchema>;

interface RolesListPageProps {
  teamId: string;
  roles: ReadonlyArray<RoleApi.RoleInfo>;
}

export function RolesListPage({ teamId, roles }: RolesListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);

  const form = useForm({
    resolver: effectTsResolver(CreateRoleSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: CreateRoleValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.role.createRole({
          path: { teamId: teamIdBranded },
          payload: { name: values.name, permissions: [] },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.role_createFailed())),
      run,
    );
    if (Option.isSome(result)) {
      form.reset();
      router.invalidate();
    }
  };

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId' params={{ teamId }}>
            ← {m.team_backToTeams()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{m.role_roles()}</h1>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex gap-2 mb-6 max-w-md'>
          <FormField
            {...form.register('name')}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel>{m.role_roleName()}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={m.role_roleNamePlaceholder()} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit' disabled={form.formState.isSubmitting} className='self-end'>
            {m.role_createRole()}
          </Button>
        </form>
      </Form>

      {roles.length === 0 ? (
        <p className='text-muted-foreground'>{m.role_noRoles()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {roles.map((role) => (
              <tr key={role.roleId} className='border-b'>
                <td className='py-2 px-4'>
                  <Link
                    to='/teams/$teamId/roles/$roleId'
                    params={{ teamId, roleId: role.roleId }}
                    className='font-medium hover:underline'
                  >
                    {role.name}
                  </Link>
                </td>
                <td className='py-2 px-4'>
                  <span
                    className={
                      role.isBuiltIn
                        ? 'text-blue-700 font-medium'
                        : 'text-muted-foreground font-medium'
                    }
                  >
                    {role.isBuiltIn ? m.role_builtIn() : m.role_custom()}
                  </span>
                </td>
                <td className='py-2 px-4 text-muted-foreground'>
                  {m.role_permissionCount({ count: String(role.permissionCount) })}
                </td>
                <td className='py-2 px-4'>
                  <Button asChild variant='outline' size='sm'>
                    <Link
                      to='/teams/$teamId/roles/$roleId'
                      params={{ teamId, roleId: role.roleId }}
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
