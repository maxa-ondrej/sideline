import { TeamChannelAccess } from '@sideline/domain';
import { Schema } from 'effect';
import { CheckIcon } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Select, SelectContent, SelectTrigger, SelectValue } from '~/components/ui/select';
import { tr } from '~/lib/translations.js';
import { cn } from '~/lib/utils';

interface AccessLevelSelectProps {
  value: TeamChannelAccess.AccessLevel;
  onValueChange: (value: TeamChannelAccess.AccessLevel) => void;
  disabled?: boolean;
  className?: string;
}

const levels: ReadonlyArray<TeamChannelAccess.AccessLevel> = ['VIEW', 'EDIT', 'ADMIN'];

const labelMap: Record<TeamChannelAccess.AccessLevel, Parameters<typeof tr>[0]> = {
  VIEW: 'channels_accessLevel_view',
  EDIT: 'channels_accessLevel_edit',
  ADMIN: 'channels_accessLevel_admin',
};

const helpMap: Record<TeamChannelAccess.AccessLevel, Parameters<typeof tr>[0]> = {
  VIEW: 'channels_accessLevel_view_help',
  EDIT: 'channels_accessLevel_edit_help',
  ADMIN: 'channels_accessLevel_admin_help',
};

export function AccessLevelSelect({
  value,
  onValueChange,
  disabled,
  className,
}: AccessLevelSelectProps) {
  const handleChange = (v: string) => {
    Schema.decodeUnknownOption(TeamChannelAccess.AccessLevel)(v).pipe((opt) => {
      if (opt._tag === 'Some') {
        onValueChange(opt.value);
      }
    });
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger aria-label={tr('channels_accessLevel_label')} className={className} size='sm'>
        {/* SelectValue mirrors only the option's ItemText (the label), so the collapsed
            trigger shows just "Can view" — the per-option description is rendered as a
            sibling below and only appears in the open dropdown. */}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {levels.map((level) => (
          <SelectPrimitive.Item
            key={level}
            value={level}
            className={cn(
              'focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default flex-col items-start gap-0.5 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            )}
          >
            <span className='absolute top-2 right-2 flex size-3.5 items-center justify-center'>
              <SelectPrimitive.ItemIndicator>
                <CheckIcon className='size-4' />
              </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText>
              <span className='font-medium'>{tr(labelMap[level])}</span>
            </SelectPrimitive.ItemText>
            <span className='text-xs text-muted-foreground'>{tr(helpMap[level])}</span>
          </SelectPrimitive.Item>
        ))}
      </SelectContent>
    </Select>
  );
}
