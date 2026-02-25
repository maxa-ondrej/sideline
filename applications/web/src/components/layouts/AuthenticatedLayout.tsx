import type { Auth } from '@sideline/domain';
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

      if (routeId.includes('/dashboard')) {
        crumbs.push({ label: 'Dashboard', to: pathname });
      } else if (routeId.includes('/notifications')) {
        crumbs.push({ label: 'Notifications', to: pathname });
      } else if (routeId.includes('/profile/complete')) {
        crumbs.push({ label: 'Profile', to: '/profile' });
        crumbs.push({ label: 'Complete', to: pathname });
      } else if (routeId.includes('/profile')) {
        crumbs.push({ label: 'Profile', to: pathname });
      } else if (routeId.includes('/teams/$teamId/')) {
        // Team sub-pages: add the team crumb, then the sub-page
        const teamId = (match.params as Record<string, string>).teamId;
        if (teamId && !crumbs.some((c) => c.to.includes('/teams/'))) {
          crumbs.push({ label: 'Team', to: `/teams/${teamId}` });
        }

        if (routeId.includes('/members')) {
          if (!crumbs.some((c) => c.label === 'Members')) {
            crumbs.push({ label: 'Members', to: `/teams/${teamId}/members` });
          }
          if (routeId.includes('$memberId')) {
            crumbs.push({ label: 'Details', to: pathname });
          }
        } else if (routeId.includes('/roles')) {
          if (!crumbs.some((c) => c.label === 'Roles')) {
            crumbs.push({ label: 'Roles', to: `/teams/${teamId}/roles` });
          }
          if (routeId.includes('$roleId')) {
            crumbs.push({ label: 'Details', to: pathname });
          }
        } else if (routeId.includes('/rosters')) {
          if (!crumbs.some((c) => c.label === 'Rosters')) {
            crumbs.push({ label: 'Rosters', to: `/teams/${teamId}/rosters` });
          }
          if (routeId.includes('$rosterId')) {
            crumbs.push({ label: 'Details', to: pathname });
          }
        } else if (routeId.includes('/subgroups')) {
          if (!crumbs.some((c) => c.label === 'Subgroups')) {
            crumbs.push({ label: 'Subgroups', to: `/teams/${teamId}/subgroups` });
          }
          if (routeId.includes('$subgroupId')) {
            crumbs.push({ label: 'Details', to: pathname });
          }
        } else if (routeId.includes('/age-thresholds')) {
          crumbs.push({ label: 'Age Thresholds', to: pathname });
        }
      } else if (routeId === '/(authenticated)/teams/$teamId/') {
        const teamId = (match.params as Record<string, string>).teamId;
        crumbs.push({ label: 'Team', to: `/teams/${teamId}` });
      } else if (routeId.includes('/teams')) {
        crumbs.push({ label: 'Teams', to: pathname });
      }
    }

    return crumbs;
  }, [matches]);
}

interface AuthenticatedLayoutProps {
  user: Auth.CurrentUser;
  teams: ReadonlyArray<Auth.UserTeam>;
  activeTeamId: string | undefined;
  onLogout: () => void;
}

export function AuthenticatedLayout({
  user,
  teams,
  activeTeamId,
  onLogout,
}: AuthenticatedLayoutProps) {
  const breadcrumbs = useBreadcrumbs();

  return (
    <SidebarProvider>
      <AppSidebar user={user} teams={teams} activeTeamId={activeTeamId} onLogout={onLogout} />
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
