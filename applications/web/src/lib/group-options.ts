import type { GroupApi } from '@sideline/domain';
import { Option } from 'effect';

export const toGroupOptionLabel = (g: GroupApi.GroupInfo): string =>
  g.emoji.pipe(
    Option.map((v) => `${v} ${g.name}`),
    Option.getOrElse(() => g.name),
  );

export const toGroupOptions = (
  groups: ReadonlyArray<GroupApi.GroupInfo>,
): ReadonlyArray<{ readonly value: string; readonly label: string }> =>
  groups.map((g) => ({
    value: g.groupId,
    label: toGroupOptionLabel(g),
  }));
