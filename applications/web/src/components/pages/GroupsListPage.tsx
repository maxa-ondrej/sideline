import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { GroupApi } from '@sideline/domain';
import { GroupModel, Team } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { withFieldErrors } from '~/lib/form';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

const CreateGroupSchema = Schema.Struct({
  name: Schema.NonEmptyString.annotations({ message: () => m.validation_required() }),
});

type CreateGroupValues = Schema.Schema.Type<typeof CreateGroupSchema>;

interface TreeNode {
  group: GroupApi.GroupInfo;
  children: TreeNode[];
}

function buildTree(groups: ReadonlyArray<GroupApi.GroupInfo>): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const g of groups) {
    byId.set(g.groupId, { group: g, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const g of groups) {
    const node = byId.get(g.groupId);
    if (!node) continue;
    if (g.parentId !== null && byId.has(g.parentId)) {
      byId.get(g.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

interface GroupTreeNodeProps {
  node: TreeNode;
  teamId: string;
  depth: number;
  onCreateSubgroup: (parentId: string) => void;
}

function GroupTreeNode({ node, teamId, depth, onCreateSubgroup }: GroupTreeNodeProps) {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <tr className='border-b'>
        <td className='py-2 px-4'>
          <div className='flex items-center' style={{ paddingLeft: `${depth * 24}px` }}>
            {hasChildren ? (
              <button
                type='button'
                onClick={() => setExpanded((v) => !v)}
                className='mr-1 p-0.5 rounded hover:bg-muted'
              >
                {expanded ? (
                  <ChevronDown className='size-4' />
                ) : (
                  <ChevronRight className='size-4' />
                )}
              </button>
            ) : (
              <span className='mr-1 w-5' />
            )}
            <Link
              to='/teams/$teamId/groups/$groupId'
              params={{ teamId, groupId: node.group.groupId }}
              className='font-medium hover:underline'
            >
              {node.group.emoji ? `${node.group.emoji} ${node.group.name}` : node.group.name}
            </Link>
          </div>
        </td>
        <td className='py-2 px-4 text-muted-foreground'>
          {m.group_memberCount({ count: String(node.group.memberCount) })}
        </td>
        <td className='py-2 px-4'>
          <div className='flex gap-1'>
            <Button variant='ghost' size='sm' onClick={() => onCreateSubgroup(node.group.groupId)}>
              {m.group_createSubgroup()}
            </Button>
            <Button asChild variant='outline' size='sm'>
              <Link
                to='/teams/$teamId/groups/$groupId'
                params={{ teamId, groupId: node.group.groupId }}
              >
                View
              </Link>
            </Button>
          </div>
        </td>
      </tr>
      {expanded &&
        node.children.map((child) => (
          <GroupTreeNode
            key={child.group.groupId}
            node={child}
            teamId={teamId}
            depth={depth + 1}
            onCreateSubgroup={onCreateSubgroup}
          />
        ))}
    </>
  );
}

interface GroupsListPageProps {
  teamId: string;
  groups: ReadonlyArray<GroupApi.GroupInfo>;
}

export function GroupsListPage({ teamId, groups }: GroupsListPageProps) {
  const run = useRun();
  const router = useRouter();
  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const [selectedParentId, setSelectedParentId] = React.useState<string>('__root__');

  const tree = React.useMemo(() => buildTree(groups), [groups]);

  const form = useForm({
    resolver: effectTsResolver(CreateGroupSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: CreateGroupValues) => {
    const parentId =
      selectedParentId === '__root__'
        ? null
        : Schema.decodeSync(GroupModel.GroupId)(selectedParentId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.createGroup({
          path: { teamId: teamIdBranded },
          payload: { name: values.name, parentId, emoji: null },
        }),
      ),
      withFieldErrors(form, [
        { tag: 'GroupNameAlreadyTaken', field: 'name', message: m.group_nameAlreadyTaken() },
      ]),
      Effect.catchAll(() => ClientError.make(m.group_createFailed())),
      run(),
    );
    if (Option.isSome(result)) {
      form.reset();
      setSelectedParentId('__root__');
      router.invalidate();
    }
  };

  const handleCreateSubgroup = React.useCallback((parentId: string) => {
    setSelectedParentId(parentId);
    document.getElementById('group-name-input')?.focus();
  }, []);

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
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex gap-2 mb-6 max-w-lg items-end'>
          <FormField
            {...form.register('name')}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel>{m.group_groupName()}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    id='group-name-input'
                    placeholder={m.group_groupNamePlaceholder()}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='flex flex-col'>
            <label htmlFor='parent-group-select' className='text-sm font-medium mb-1'>
              {m.group_parentGroup()}
            </label>
            <Select value={selectedParentId} onValueChange={setSelectedParentId}>
              <SelectTrigger id='parent-group-select' className='w-48'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__root__'>{m.group_rootGroup()}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.groupId} value={g.groupId}>
                    {g.emoji ? `${g.emoji} ${g.name}` : g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type='submit' disabled={form.formState.isSubmitting}>
            {m.group_createGroup()}
          </Button>
        </form>
      </Form>

      {groups.length === 0 ? (
        <p className='text-muted-foreground'>{m.group_noGroups()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {tree.map((node) => (
              <GroupTreeNode
                key={node.group.groupId}
                node={node}
                teamId={teamId}
                depth={0}
                onCreateSubgroup={handleCreateSubgroup}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
