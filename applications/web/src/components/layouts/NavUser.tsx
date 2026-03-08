import type { Auth } from '@sideline/domain';
import { m } from '@sideline/i18n/messages';
import { getLocale, setLocale } from '@sideline/i18n/runtime';
import { Link } from '@tanstack/react-router';
import { Effect } from 'effect';
import { Bell, Check, ChevronsUpDown, Languages, LogOut, UserIcon } from 'lucide-react';
import { useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

function discordAvatarUrl(discordId: string, avatar: string): string {
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`;
}

function userInitials(user: Auth.CurrentUser): string {
  if (user.name) {
    return user.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return user.username.slice(0, 2).toUpperCase();
}

interface NavUserProps {
  user: Auth.CurrentUser;
  activeTeamId: string | undefined;
  onLogout: () => void;
}

const localeOptions = [
  { value: 'en' as const, flag: '🇬🇧', label: () => m.language_en() },
  { value: 'cs' as const, flag: '🇨🇿', label: () => m.language_cs() },
] as const;

export function NavUser({ user, activeTeamId, onLogout }: NavUserProps) {
  const { isMobile } = useSidebar();
  const run = useRun();
  const displayName = user.name ?? user.username;
  const currentLocale = getLocale();

  const handleLocaleChange = useCallback(
    (locale: 'en' | 'cs') => {
      setLocale(locale);
      ApiClient.pipe(
        Effect.flatMap((api) => api.auth.updateLocale({ payload: { locale } })),
        Effect.catchAll(() => ClientError.make(m.auth_errors_profileFailed())),
        run(),
      );
    },
    [run],
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <Avatar className='h-8 w-8 rounded-lg'>
                {user.avatar && (
                  <AvatarImage
                    src={discordAvatarUrl(user.discordId, user.avatar)}
                    alt={displayName}
                  />
                )}
                <AvatarFallback className='rounded-lg'>{userInitials(user)}</AvatarFallback>
              </Avatar>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold'>{displayName}</span>
                <span className='truncate text-xs'>{user.username}</span>
              </div>
              <ChevronsUpDown className='ml-auto size-4' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuLabel className='p-0 font-normal'>
              <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
                <Avatar className='h-8 w-8 rounded-lg'>
                  {user.avatar && (
                    <AvatarImage
                      src={discordAvatarUrl(user.discordId, user.avatar)}
                      alt={displayName}
                    />
                  )}
                  <AvatarFallback className='rounded-lg'>{userInitials(user)}</AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-semibold'>{displayName}</span>
                  <span className='truncate text-xs'>{user.username}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to='/profile'>
                  <UserIcon />
                  Profile
                </Link>
              </DropdownMenuItem>
              {activeTeamId && (
                <DropdownMenuItem asChild>
                  <Link to='/teams/$teamId/notifications' params={{ teamId: activeTeamId }}>
                    <Bell />
                    Notifications
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Languages />
                  {m.language_label()}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {localeOptions.map((loc) => (
                    <DropdownMenuItem key={loc.value} onClick={() => handleLocaleChange(loc.value)}>
                      {loc.flag} {loc.label()}
                      {currentLocale === loc.value && <Check className='ml-auto h-4 w-4' />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
