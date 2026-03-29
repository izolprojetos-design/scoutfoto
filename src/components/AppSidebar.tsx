import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { NavLink } from '@/components/NavLink';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, Home, Calendar, User, Users, CalendarDays, ChevronUp, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const AppSidebar = () => {
  const { profile, signOut, roles } = useAuth();
  const { canViewPhotos, canManageEvents, canManageScouts, canManageUsers } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Home, show: canViewPhotos },
    { to: '/scouts', label: 'Integrantes', icon: Users, show: canManageScouts },
    { to: '/calendar', label: 'Calendário', icon: CalendarDays, show: true },
    { to: '/events', label: 'Eventos', icon: Calendar, show: canManageEvents },
    { to: '/admin', label: 'Admin', icon: Settings, show: canManageUsers },
  ];

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

  const primaryRole = roles[0] || 'viewer';
  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    chefe: 'Chefe Escoteiro',
    viewer: 'Visualizador',
    parent: 'Pai/Mãe',
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-sidebar-accent"
            >
              <NavLink to="/dashboard" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg scout-gradient text-base shadow-sm">
                  ⚜️
                </div>
                {!collapsed && (
                  <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
                    ScoutFoto
                  </span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter(i => i.show).map(item => {
                const isActive = location.pathname === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <NavLink
                        to={item.to}
                        end
                        className="flex items-center gap-2"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              tooltip="Alternar tema"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              {!collapsed && <span>Alternar tema</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="w-full">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="flex flex-1 flex-col items-start text-left leading-tight">
                      <span className="text-sm font-medium truncate max-w-[140px]">{profile?.name}</span>
                      <span className="text-xs text-sidebar-foreground/60">{roleLabel[primaryRole]}</span>
                    </div>
                  )}
                  {!collapsed && <ChevronUp className="ml-auto h-4 w-4 text-sidebar-foreground/60" />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{profile?.name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onClick={() => navigate('/profile')}>
                  <User className="h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
