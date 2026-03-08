import type { Auth } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, Outlet, useMatches } from '@tanstack/react-router';
import React from 'react';
import { AppSidebar } from '~/components/layouts/AppSidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';
import { Separator } from '~/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar';

interface BreadcrumbEntry {
  label: string;
  to: string;
}

function useBreadcrumbs(): ReadonlyArray<BreadcrumbEntry> {
  const matches = useMatches();

  return React.useMemo(() => {
    const crumbs: BreadcrumbEntry[] = [];

    for (const match of matches) {
      const routeId = match.routeId;
      // Skip the root and layout group routes
      if (routeId === '__root__' || routeId === '/(authenticated)') continue;

      const pathname = match.pathname;

      if (routeId.includes('/create-team')) {
        crumbs.push({ label: m.breadcrumb_createTeam(), to: pathname });
      } else if (routeId.includes('/profile/complete')) {
        crumbs.push({ label: m.breadcrumb_profile(), to: '/profile' });
        crumbs.push({ label: m.breadcrumb_complete(), to: pathname });
      } else if (routeId.includes('/profile')) {
        crumbs.push({ label: m.breadcrumb_profile(), to: pathname });
      } else if (routeId.includes('/teams/$teamId/')) {
        // Team sub-pages: add the team crumb, then the sub-page
        const teamId = (match.params as Record<string, string>).teamId;
        if (teamId && !crumbs.some((c) => c.to.includes('/teams/'))) {
          crumbs.push({ label: m.breadcrumb_team(), to: `/teams/${teamId}` });
        }

        if (routeId.includes('/notifications')) {
          crumbs.push({ label: m.notification_title(), to: pathname });
        } else if (routeId.includes('/members')) {
          if (!crumbs.some((c) => c.to.endsWith('/members'))) {
            crumbs.push({ label: m.team_members(), to: `/teams/${teamId}/members` });
          }
          if (routeId.includes('$memberId')) {
            crumbs.push({ label: m.breadcrumb_details(), to: pathname });
          }
        } else if (routeId.includes('/roles')) {
          if (!crumbs.some((c) => c.to.endsWith('/roles'))) {
            crumbs.push({ label: m.team_roles(), to: `/teams/${teamId}/roles` });
          }
          if (routeId.includes('$roleId')) {
            crumbs.push({ label: m.breadcrumb_details(), to: pathname });
          }
        } else if (routeId.includes('/rosters')) {
          if (!crumbs.some((c) => c.to.endsWith('/rosters'))) {
            crumbs.push({ label: m.team_rosters(), to: `/teams/${teamId}/rosters` });
          }
          if (routeId.includes('$rosterId')) {
            crumbs.push({ label: m.breadcrumb_details(), to: pathname });
          }
        } else if (routeId.includes('/groups')) {
          if (!crumbs.some((c) => c.to.endsWith('/groups'))) {
            crumbs.push({ label: m.team_groups(), to: `/teams/${teamId}/groups` });
          }
          if (routeId.includes('$groupId')) {
            crumbs.push({ label: m.breadcrumb_details(), to: pathname });
          }
        } else if (routeId.includes('/age-thresholds')) {
          crumbs.push({ label: m.team_ageThresholds(), to: pathname });
        }
      } else if (routeId === '/(authenticated)/teams/$teamId/') {
        const teamId = (match.params as Record<string, string>).teamId;
        crumbs.push({ label: m.breadcrumb_team(), to: `/teams/${teamId}` });
      }
    }

    return crumbs;
  }, [matches]);
}

interface AuthenticatedLayoutProps {
  user: Auth.CurrentUser;
  teams: ReadonlyArray<Auth.UserTeam>;
  activeTeam: Auth.UserTeam;
  onLogout: () => void;
}

export function AuthenticatedLayout({
  user,
  teams,
  activeTeam,
  onLogout,
}: AuthenticatedLayoutProps) {
  const breadcrumbs = useBreadcrumbs();

  return (
    <SidebarProvider>
      <AppSidebar user={user} teams={teams} activeTeam={activeTeam} onLogout={onLogout} />
      <SidebarInset>
        <header className='flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12'>
          <div className='flex items-center gap-2 px-4'>
            <SidebarTrigger className='-ml-1' />
            <Separator orientation='vertical' className='mr-2 h-4' />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;

                  return (
                    <React.Fragment key={crumb.to}>
                      {index > 0 && <BreadcrumbSeparator className='hidden md:block' />}
                      <BreadcrumbItem
                        className={index < breadcrumbs.length - 1 ? 'hidden md:block' : undefined}
                      >
                        {isLast ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.to}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className='flex flex-1 flex-col gap-4 p-4 pt-0'>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
