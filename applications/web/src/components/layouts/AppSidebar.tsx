import type { Auth } from '@sideline/domain';
import { Link, useMatchRoute } from '@tanstack/react-router';
import {
  CalendarDays,
  Home,
  LayoutDashboard,
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

function getGeneralNavItems(): ReadonlyArray<NavItem> {
  return [{ title: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' }];
}

function getTeamNavItems(teamId: string): ReadonlyArray<NavItem> {
  return [
    { title: 'Overview', icon: Home, to: '/teams/$teamId', params: { teamId } },
    { title: 'Members', icon: Users, to: '/teams/$teamId/members', params: { teamId } },
    { title: 'Roles', icon: Shield, to: '/teams/$teamId/roles', params: { teamId } },
    { title: 'Rosters', icon: UsersRound, to: '/teams/$teamId/rosters', params: { teamId } },
    { title: 'Subgroups', icon: UserCog, to: '/teams/$teamId/subgroups', params: { teamId } },
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
  activeTeamId: string | undefined;
  onLogout: () => void;
}

export function AppSidebar({ user, teams, activeTeamId, onLogout, ...props }: AppSidebarProps) {
  const matchRoute = useMatchRoute();
  const generalItems = getGeneralNavItems();
  const teamItems = activeTeamId ? getTeamNavItems(activeTeamId) : [];

  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} activeTeamId={activeTeamId} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {generalItems.map((item) => (
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

        {activeTeamId && teamItems.length > 0 && (
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
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
