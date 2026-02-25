import type { Auth } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import { ChevronsUpDown, Plus, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar';

interface TeamSwitcherProps {
  teams: ReadonlyArray<Auth.UserTeam>;
  activeTeamId: string | undefined;
}

export function TeamSwitcher({ teams, activeTeamId }: TeamSwitcherProps) {
  const { isMobile } = useSidebar();
  const activeTeam = teams.find((t) => t.teamId === activeTeamId);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                <Users className='size-4' />
              </div>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {activeTeam?.teamName ?? 'Select team'}
                </span>
                {activeTeam && (
                  <span className='truncate text-xs'>{activeTeam.roleNames.join(', ')}</span>
                )}
              </div>
              <ChevronsUpDown className='ml-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs text-muted-foreground'>Teams</DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem key={team.teamId} className='gap-2 p-2' asChild>
                <Link to='/teams/$teamId' params={{ teamId: team.teamId }}>
                  <div className='flex size-6 items-center justify-center rounded-sm border'>
                    <Users className='size-4 shrink-0' />
                  </div>
                  {team.teamName}
                  {index < 9 && (
                    <DropdownMenuShortcut>
                      {'\u2318'}
                      {index + 1}
                    </DropdownMenuShortcut>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className='gap-2 p-2' asChild>
              <Link to='/dashboard'>
                <div className='flex size-6 items-center justify-center rounded-md border bg-background'>
                  <Plus className='size-4' />
                </div>
                <div className='font-medium text-muted-foreground'>Add team</div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
