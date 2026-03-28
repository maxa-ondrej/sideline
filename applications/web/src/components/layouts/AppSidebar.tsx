import type { Auth, Role } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useMatchRoute } from '@tanstack/react-router';
import {
  Bell,
  Calendar,
  CalendarDays,
  Dumbbell,
  Home,
  type LucideIcon,
  Rss,
  Settings,
  Shield,
  Trophy,
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
  requiredPermission?: Role.Permission;
}

function getTeamNavItems(teamId: string): ReadonlyArray<NavItem> {
  return [
    { title: m.sidebar_overview(), icon: Home, to: '/teams/$teamId', params: { teamId } },
    {
      title: m.sidebar_makanicko(),
      icon: Trophy,
      to: '/teams/$teamId/makanicko',
      params: { teamId },
    },
    {
      title: m.notification_title(),
      icon: Bell,
      to: '/teams/$teamId/notifications',
      params: { teamId },
    },
    { title: m.team_members(), icon: Users, to: '/teams/$teamId/members', params: { teamId } },
    {
      title: m.team_roles(),
      icon: Shield,
      to: '/teams/$teamId/roles',
      params: { teamId },
      requiredPermission: 'role:view',
    },
    {
      title: m.team_rosters(),
      icon: UsersRound,
      to: '/teams/$teamId/rosters',
      params: { teamId },
    },
    {
      title: m.team_groups(),
      icon: UserCog,
      to: '/teams/$teamId/groups',
      params: { teamId },
      requiredPermission: 'team:manage',
    },
    {
      title: m.team_trainingTypes(),
      icon: Dumbbell,
      to: '/teams/$teamId/training-types',
      params: { teamId },
    },
    {
      title: m.event_events(),
      icon: Calendar,
      to: '/teams/$teamId/events',
      params: { teamId },
    },
    {
      title: m.ical_title(),
      icon: Rss,
      to: '/teams/$teamId/calendar-subscription',
      params: { teamId },
    },
    {
      title: m.team_ageThresholds(),
      icon: CalendarDays,
      to: '/teams/$teamId/age-thresholds',
      params: { teamId },
      requiredPermission: 'team:manage',
    },
    {
      title: m.team_settings(),
      icon: Settings,
      to: '/teams/$teamId/settings',
      params: { teamId },
      requiredPermission: 'team:manage',
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
  const teamItems = getTeamNavItems(activeTeam.teamId).filter(
    (item) => !item.requiredPermission || activeTeam.permissions.includes(item.requiredPermission),
  );

  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} activeTeamId={activeTeam.teamId} />
      </SidebarHeader>
      <SidebarContent>
        {
          <SidebarGroup>
            <SidebarGroupLabel>{m.sidebar_team()}</SidebarGroupLabel>
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
