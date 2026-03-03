import type { Auth } from '@sideline/domain';
import { Link, useMatchRoute } from '@tanstack/react-router';
import {
  Bell,
  Calendar,
  CalendarDays,
  Dumbbell,
  Home,
  type LucideIcon,
  Shield,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react';
import { NavUser } from '~/components/layouts/NavUser';
import { TeamSwitcher } from '~/components/layouts/TeamSwitcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '~/components/ui/sidebar';

interface NavItem {
  title: string;
  icon: LucideIcon;
  to: string;
  params?: Record<string, string>;
}

function getTeamNavItems(teamId: string): ReadonlyArray<NavItem> {
  return [
    { title: 'Overview', icon: Home, to: '/teams/$teamId', params: { teamId } },
    {
      title: 'Notifications',
      icon: Bell,
      to: '/teams/$teamId/notifications',
      params: { teamId },
    },
    { title: 'Members', icon: Users, to: '/teams/$teamId/members', params: { teamId } },
    { title: 'Roles', icon: Shield, to: '/teams/$teamId/roles', params: { teamId } },
    { title: 'Rosters', icon: UsersRound, to: '/teams/$teamId/rosters', params: { teamId } },
    { title: 'Groups', icon: UserCog, to: '/teams/$teamId/groups', params: { teamId } },
    {
      title: 'Training Types',
      icon: Dumbbell,
      to: '/teams/$teamId/training-types',
      params: { teamId },
    },
    {
      title: 'Events',
      icon: Calendar,
      to: '/teams/$teamId/events',
      params: { teamId },
    },
    {
      title: 'Age Thresholds',
      icon: CalendarDays,
      to: '/teams/$teamId/age-thresholds',
      params: { teamId },
    },
  ];
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: Auth.CurrentUser;
  teams: ReadonlyArray<Auth.UserTeam>;
  activeTeam: Auth.UserTeam;
  onLogout: () => void;
}

export function AppSidebar({ user, teams, activeTeam, onLogout, ...props }: AppSidebarProps) {
  const matchRoute = useMatchRoute();
  const teamItems = getTeamNavItems(activeTeam.teamId);

  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} activeTeamId={activeTeam.teamId} />
      </SidebarHeader>
      <SidebarContent>
        {
          <SidebarGroup>
            <SidebarGroupLabel>Team</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {teamItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={!!matchRoute({ to: item.to, params: item.params, fuzzy: true })}
                      tooltip={item.title}
                    >
                      <Link to={item.to} params={item.params}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        }
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} activeTeamId={activeTeam.teamId} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
