import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { AgeThresholdApi, RoleApi } from '@sideline/domain';
import { AgeThresholdRule, Role, Team } from '@sideline/domain';
import { Link, useRouter } from '@tanstack/react-router';
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
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

const CreateThresholdSchema = Schema.Struct({
  roleId: Role.RoleId,
  minAge: Schema.NumberFromString.pipe(Schema.optionalWith({ as: 'Option' })),
  maxAge: Schema.NumberFromString.pipe(Schema.optionalWith({ as: 'Option' })),
});

type CreateThresholdValues = Schema.Schema.Type<typeof CreateThresholdSchema>;

interface AgeThresholdsPageProps {
  teamId: string;
  rules: ReadonlyArray<AgeThresholdApi.AgeThresholdInfo>;
  roles: ReadonlyArray<RoleApi.RoleInfo>;
}

export function AgeThresholdsPage({ teamId, rules, roles }: AgeThresholdsPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const [evaluationResults, setEvaluationResults] = React.useState<
    ReadonlyArray<AgeThresholdApi.AgeRoleChange>
  >([]);
  const [evaluating, setEvaluating] = React.useState(false);

  const usedRoleIds = new Set(rules.map((r) => r.roleId));
  const availableRoles = roles.filter((r) => !usedRoleIds.has(r.roleId));

  const form = useForm({
    resolver: effectTsResolver(CreateThresholdSchema),
    mode: 'onChange',
    defaultValues: { roleId: '', minAge: '', maxAge: '' },
  });

  const onSubmit = async (values: CreateThresholdValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.ageThreshold.createAgeThreshold({
          path: { teamId: teamIdBranded },
          payload: values,
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.ageThreshold_createFailed())),
      run,
    );
    if (Option.isSome(result)) {
      form.reset();
      router.invalidate();
    }
  };

  const handleDelete = React.useCallback(
    async (ruleIdRaw: string) => {
      if (!window.confirm(m.ageThreshold_deleteConfirm())) return;
      const ruleId = Schema.decodeSync(AgeThresholdRule.AgeThresholdRuleId)(ruleIdRaw);
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.ageThreshold.deleteAgeThreshold({
            path: { teamId: teamIdBranded, ruleId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.ageThreshold_deleteFailed())),
        run,
      );
      if (Option.isSome(result)) {
        toast.success(m.ageThreshold_deleted());
        router.invalidate();
      }
    },
    [teamIdBranded, run, router],
  );

  const handleEvaluate = React.useCallback(async () => {
    setEvaluating(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.ageThreshold.evaluateAgeThresholds({
          path: { teamId: teamIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.ageThreshold_evaluateFailed())),
      run,
    );
    setEvaluating(false);
    if (Option.isSome(result)) {
      setEvaluationResults(result.value);
      router.invalidate();
    }
  }, [teamIdBranded, run, router]);

  const formatAgeRange = (minAge: Option.Option<number>, maxAge: Option.Option<number>) => {
    if (Option.isSome(minAge) && Option.isSome(maxAge)) {
      return `${minAge.value}–${maxAge.value}`;
    }
    if (Option.isSome(minAge)) {
      return `${minAge.value}+`;
    }
    if (Option.isSome(maxAge)) {
      return `≤${maxAge.value}`;
    }
    return m.ageThreshold_anyAge();
  };

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId' params={{ teamId }}>
            ← {m.team_backToTeams()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{m.ageThreshold_title()}</h1>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex gap-2 mb-6 max-w-lg items-end'>
          <FormField
            {...form.register('roleId')}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel>{m.role_roleName()}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={m.ageThreshold_selectRole()} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.roleId} value={role.roleId}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            {...form.register('minAge')}
            render={({ field }) => (
              <FormItem className='w-24'>
                <FormLabel>{m.ageThreshold_minAge()}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type='number'
                    placeholder={m.ageThreshold_minAgePlaceholder()}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            {...form.register('maxAge')}
            render={({ field }) => (
              <FormItem className='w-24'>
                <FormLabel>{m.ageThreshold_maxAge()}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type='number'
                    placeholder={m.ageThreshold_maxAgePlaceholder()}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit' disabled={form.formState.isSubmitting}>
            {m.ageThreshold_create()}
          </Button>
        </form>
      </Form>

      {rules.length === 0 ? (
        <p className='text-muted-foreground'>{m.ageThreshold_noRules()}</p>
      ) : (
        <table className='w-full mb-6'>
          <thead>
            <tr className='border-b'>
              <th className='py-2 px-4 text-left'>{m.role_roleName()}</th>
              <th className='py-2 px-4 text-left'>{m.ageThreshold_ageRange()}</th>
              <th className='py-2 px-4' />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.ruleId} className='border-b'>
                <td className='py-2 px-4 font-medium'>{rule.roleName}</td>
                <td className='py-2 px-4'>{formatAgeRange(rule.minAge, rule.maxAge)}</td>
                <td className='py-2 px-4'>
                  <Button variant='outline' size='sm' onClick={() => handleDelete(rule.ruleId)}>
                    {m.ageThreshold_delete()}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className='flex flex-col gap-4'>
        <Button onClick={handleEvaluate} disabled={evaluating} variant='secondary'>
          {evaluating ? m.ageThreshold_evaluating() : m.ageThreshold_evaluateNow()}
        </Button>

        {evaluationResults.length > 0 && (
          <div>
            <h2 className='text-lg font-semibold mb-2'>{m.ageThreshold_results()}</h2>
            <table className='w-full'>
              <tbody>
                {evaluationResults.map((change, i) => (
                  <tr key={`${change.memberId}-${change.roleId}-${String(i)}`} className='border-b'>
                    <td className='py-2 px-4'>{change.memberName}</td>
                    <td className='py-2 px-4'>{change.roleName}</td>
                    <td className='py-2 px-4'>
                      <span
                        className={
                          change.action === 'assigned'
                            ? 'text-green-700 font-medium'
                            : 'text-red-700 font-medium'
                        }
                      >
                        {change.action === 'assigned'
                          ? m.ageThreshold_assigned()
                          : m.ageThreshold_removed()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
