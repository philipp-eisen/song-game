import {
  CaretUpDownIcon,
  GameControllerIcon,
  HouseIcon,
  PlaylistIcon,
  SignOutIcon,
  SpotifyLogoIcon,
} from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import type { Icon } from '@phosphor-icons/react'
import { authClient } from '@/lib/auth-client'
import { AppLogo } from '@/components/app-logo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
} from '@/components/ui/sidebar'

const menuItems: Array<{ title: string; url: string; icon: Icon }> = [
  {
    title: 'Home',
    url: '/',
    icon: HouseIcon,
  },
  {
    title: 'My Games',
    url: '/games',
    icon: GameControllerIcon,
  },
  {
    title: 'Playlists',
    url: '/playlists',
    icon: PlaylistIcon,
  },
]

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <figure className="flex aspect-square size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <AppLogo size="80%" />
              </figure>
              <article className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Song Eras</span>
                <span className="text-xs text-muted-foreground">
                  When was it released?
                </span>
              </article>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<Link to={item.url} />}>
                    <item.icon weight="duotone" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function UserMenu() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Avatar size="sm">
              <AvatarFallback>...</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">Loading...</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!session) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={() => authClient.signIn.social({ provider: 'spotify' })}
            className="bg-spotify/10 hover:bg-spotify/20"
          >
            <SpotifyLogoIcon weight="duotone" className="size-5 text-spotify" />
            <span className="font-medium">Sign in with Spotify</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const isGuest = session.user.email.includes('guest.songgame.local')
  const displayName = isGuest ? 'Guest' : session.user.name
  const initials = isGuest
    ? 'G'
    : session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

  const handleSignOut = async () => {
    await authClient.signOut()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              >
                <Avatar size="sm">
                  {session.user.image && (
                    <AvatarImage src={session.user.image} alt={displayName} />
                  )}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <article className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  {!isGuest && (
                    <span className="truncate text-xs text-muted-foreground">
                      {session.user.email}
                    </span>
                  )}
                </article>
                <CaretUpDownIcon weight="duotone" className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-[--trigger-width] min-w-56 rounded-lg"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <article className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar size="sm">
                    {session.user.image && (
                      <AvatarImage src={session.user.image} alt={displayName} />
                    )}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {displayName}
                    </span>
                    {!isGuest && (
                      <span className="truncate text-xs text-muted-foreground">
                        {session.user.email}
                      </span>
                    )}
                  </div>
                </article>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            {isGuest && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    authClient.signIn.social({ provider: 'spotify' })
                  }
                >
                  <SpotifyLogoIcon weight="duotone" className="text-spotify" />
                  Upgrade to Spotify
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <SignOutIcon weight="duotone" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
