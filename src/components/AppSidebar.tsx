import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { NavLink } from '@/components/NavLink';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Settings, Home, Calendar, User, Users, CalendarDays, Sun, Moon, ListChecks, CalendarRange, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { getPrimaryRole, ROLE_LABELS } from '@/lib/userRoles';

const AppSidebar = () => {
  const { profile, signOut, roles } = useAuth();
  const { canViewPhotos, canViewEvents, canViewScouts, canAccessAdmin } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const eventSubItems = [
    { to: '/agendamentos', label: 'Minha Agenda', icon: ListChecks, show: true },
    { to: '/calendar', label: 'Calendário', icon: CalendarDays, show: true },
    { to: '/events', label: 'Eventos', icon: Calendar, show: canViewEvents },
  ].filter(i => i.show);

  const isEventRoute = eventSubItems.some(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'));
  const [eventsOpen, setEventsOpen] = useState(isEventRoute);

  const navItems = [
    { to: '/dashboard', label: 'Início', icon: Home, show: canViewPhotos },
    { to: '/scouts', label: 'Integrantes', icon: Users, show: canViewScouts },
    { to: '/admin', label: 'Admin', icon: Settings, show: canAccessAdmin },
  ];

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

  const primaryRole = getPrimaryRole(roles);

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
              <NavLink to="/dashboard" className="flex items-center gap-2.5" onClick={() => isMobile && setOpenMobile(false)}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg scout-gradient shadow-sm overflow-hidden p-1">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
                </div>
                {!collapsed && (
                  <span className="text-lg font-bold tracking-tight text-sidebar-primary">
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
                        onClick={() => isMobile && setOpenMobile(false)}
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
            <SidebarMenuButton
              asChild
              tooltip="Perfil"
              onClick={() => { isMobile && setOpenMobile(false); navigate('/profile'); }}
            >
              <button className="flex items-center gap-2 w-full">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex flex-1 flex-col items-start text-left leading-tight">
                    <span className="text-sm font-medium truncate max-w-[140px]">{profile?.name}</span>
                    <span className="text-xs text-sidebar-foreground/60">{ROLE_LABELS[primaryRole]}</span>
                  </div>
                )}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              onClick={handleSignOut}
              tooltip="Sair"
              className="text-red-300 hover:text-red-200 hover:bg-red-500/15"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
