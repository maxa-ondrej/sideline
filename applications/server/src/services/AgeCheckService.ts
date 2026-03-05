import {
  AgeThresholdApi,
  type Discord,
  type GroupModel,
  type Team,
  type TeamMember,
  type User,
} from '@sideline/domain';
import { Array, Data, Effect, Option, pipe } from 'effect';
import {
  AgeThresholdRepository,
  type AgeThresholdWithGroupName,
  type MemberWithBirthDate,
} from '~/repositories/AgeThresholdRepository.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';

interface Dependencies {
  thresholds: AgeThresholdRepository;
  groups: GroupsRepository;
  notifications: NotificationsRepository;
  channelSync: ChannelSyncEventsRepository;
}

interface Change {
  userId: User.UserId;
  memberId: TeamMember.TeamMemberId;
  memberName: string;
  discordId: string;
  groupId: GroupModel.GroupId;
  groupName: string;
  action: 'added' | 'removed';
}

const makeChange = (change: Change) => change;

const computeAge = (birthDateStr: string, now: Date): number => {
  const birth = new Date(`${birthDateStr}T00:00:00Z`);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
};

const detectChanges = (
  today: Date,
  rules: readonly AgeThresholdWithGroupName[],
  teamMembers: readonly MemberWithBirthDate[],
) =>
  pipe(
    teamMembers,
    Array.flatMap((member) =>
      Array.map(rules, (rule) => ({
        rule,
        member,
      })),
    ),
    Array.let('age', ({ member }) => computeAge(member.birth_date, today)),
    Array.let('minOk', ({ age, rule }) =>
      rule.min_age.pipe(
        Option.filter((minAge) => age < minAge),
        Option.isNone,
      ),
    ),
    Array.let('maxOk', ({ age, rule }) =>
      rule.max_age.pipe(
        Option.filter((maxAge) => age > maxAge),
        Option.isNone,
      ),
    ),
    Array.let('shouldBeInGroup', ({ minOk, maxOk }) => minOk && maxOk),
    Array.let('isInGroup', ({ member, rule }) => Array.contains(member.group_ids, rule.group_id)),
    Array.filter(({ shouldBeInGroup, isInGroup }) => shouldBeInGroup !== isInGroup),
    Array.let('displayName', ({ member }) =>
      Option.getOrElse(member.member_name, () => member.username),
    ),
    Array.map(({ shouldBeInGroup, member, displayName, rule }) =>
      shouldBeInGroup
        ? makeChange({
            userId: member.user_id,
            memberId: member.member_id,
            memberName: displayName,
            discordId: member.discord_id,
            groupId: rule.group_id,
            groupName: rule.group_name,
            action: 'added',
          })
        : makeChange({
            userId: member.user_id,
            memberId: member.member_id,
            memberName: displayName,
            discordId: member.discord_id,
            groupId: rule.group_id,
            groupName: rule.group_name,
            action: 'removed',
          }),
    ),
  );

const commitChange = (groups: GroupsRepository) => (change: Change) =>
  Effect.succeed(change).pipe(
    Effect.tap(
      Effect.if(change.action === 'added', {
        onTrue: () => groups.addMemberById(change.groupId, change.memberId),
        onFalse: () => groups.removeMemberById(change.groupId, change.memberId),
      }),
    ),
  );

const commitChanges = (groups: GroupsRepository, changes: readonly Change[]) =>
  pipe(
    changes,
    Array.map(commitChange(groups)),
    Array.map(
      Effect.tap((change) =>
        Effect.logInfo(
          `${change.memberId} was automatically ${change.action} the "${change.groupName}" group based on age threshold.`,
        ),
      ),
    ),
    Array.map(Effect.tapError(Effect.logError)),
    Effect.allSuccesses,
    Effect.tap((commits) =>
      Effect.logInfo(`Successfully made ${commits.length} changes to age-based groups!`),
    ),
  );

class NoChanges extends Data.TaggedError('NoChanges')<{
  readonly count: 0;
}> {}

const notifyAdmins = (
  notifications: NotificationsRepository,
  teamId: Team.TeamId,
  changes: readonly Change[],
  teamMembers: readonly MemberWithBirthDate[],
) =>
  Effect.succeed(teamMembers.filter(({ is_admin }) => is_admin).map((m) => m.user_id)).pipe(
    Effect.map(Array.dedupe),
    Effect.map(
      Array.flatMap((userId) =>
        Array.map(changes, (change) =>
          change.action === 'added'
            ? {
                teamId,
                userId,
                type: 'age_group_added' as const,
                title: `Added to group "${change.groupName}"`,
                body: `${change.memberName} was automatically added to the "${change.groupName}" group based on age threshold.`,
              }
            : {
                teamId,
                userId,
                type: 'age_group_removed' as const,
                title: `Removed from group "${change.groupName}"`,
                body: `${change.memberName} was automatically removed from the "${change.groupName}" group based on age threshold.`,
              },
        ),
      ),
    ),
    Effect.tap((notifications) =>
      Array.isEmptyArray(notifications) ? Effect.fail(new NoChanges({ count: 0 })) : Effect.void,
    ),
    Effect.flatMap((n) => notifications.insertBulk(n)),
    Effect.tapErrorTag('NoChanges', () => Effect.void),
    Effect.orDie,
  );

const evaluateTeam =
  ({ thresholds, groups, notifications, channelSync }: Dependencies) =>
  (teamId: Team.TeamId, today: Date) =>
    Effect.Do.pipe(
      Effect.bind('rules', () => thresholds.findRulesByTeamId(teamId).pipe(Effect.orDie)),
      Effect.bind('teamMembers', () =>
        thresholds.getMembersWithBirthDates(teamId).pipe(Effect.orDie),
      ),
      Effect.let('changes', ({ rules, teamMembers }) => detectChanges(today, rules, teamMembers)),
      Effect.tap(({ changes }) =>
        Array.isEmptyArray(changes) ? Effect.fail(new NoChanges({ count: 0 })) : Effect.void,
      ),
      Effect.tap(({ changes }) =>
        Effect.logInfo(`Detected ${changes.length} changes to be made with age-based groups!`),
      ),
      Effect.bind('commited', ({ changes }) => commitChanges(groups, changes)),
      Effect.tap(({ changes }) =>
        pipe(
          changes,
          Array.map((change) =>
            change.action === 'added'
              ? notifications.insert(
                  teamId,
                  change.userId,
                  'age_group_added',
                  `Added to group "${change.groupName}"`,
                  `You have been added to the "${change.groupName}" group.`,
                )
              : notifications.insert(
                  teamId,
                  change.userId,
                  'age_group_removed',
                  `Removed from group "${change.groupName}"`,
                  `You have been removed from the "${change.groupName}" group.`,
                ),
          ),
        ),
      ),
      Effect.tap(({ changes, teamMembers }) =>
        notifyAdmins(notifications, teamId, changes, teamMembers),
      ),
      Effect.tap(({ changes }) =>
        Effect.allSuccesses(
          changes.map((change) =>
            change.action === 'added'
              ? channelSync
                  .emitIfGuildLinked(
                    teamId,
                    'member_added',
                    change.groupId,
                    Option.some(change.groupName),
                    Option.some(change.memberId),
                    Option.some(change.discordId as Discord.Snowflake),
                  )
                  .pipe(Effect.catchAll((e) => Effect.logError('channel sync event failed', e)))
              : channelSync
                  .emitIfGuildLinked(
                    teamId,
                    'member_removed',
                    change.groupId,
                    Option.some(change.groupName),
                    Option.some(change.memberId),
                    Option.some(change.discordId as Discord.Snowflake),
                  )
                  .pipe(Effect.catchAll((e) => Effect.logError('channel sync event failed', e))),
          ),
        ).pipe(Effect.asVoid),
      ),
      Effect.map(({ changes }) =>
        changes.map(
          (c) =>
            new AgeThresholdApi.AgeGroupChange({
              memberId: c.memberId,
              memberName: c.memberName,
              groupId: c.groupId,
              groupName: c.groupName,
              action: c.action,
            }),
        ),
      ),
      Effect.catchTag('NoChanges', () => Effect.succeed(Array.empty())),
    );

export class AgeCheckService extends Effect.Service<AgeCheckService>()('api/AgeCheckService', {
  effect: Effect.Do.pipe(
    Effect.bind('thresholds', () => AgeThresholdRepository),
    Effect.bind('groups', () => GroupsRepository),
    Effect.bind('notifications', () => NotificationsRepository),
    Effect.bind('channelSync', () => ChannelSyncEventsRepository),
    Effect.let('evaluateTeam', evaluateTeam),
    Effect.map(({ evaluateTeam }) => ({ evaluateTeam })),
  ),
}) {
  evaluate(teamId: Team.TeamId, today: Date) {
    return this.evaluateTeam(teamId, today);
  }
}
