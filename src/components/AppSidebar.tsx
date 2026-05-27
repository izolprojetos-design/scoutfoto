import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { NavLink } from '@/components/NavLink';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings, Home, Calendar, User, Users, CalendarDays, Sun, Moon, ListChecks, CalendarRange, ChevronRight, LayoutDashboard, Shield, RefreshCw, Lock, FolderTree, Link2, Archive, ImageOff, Cloud } from 'lucide-react';
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
import { stringToColor } from '@/lib/avatarUtils';

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
    { to: '/agendamentos', label: 'Mensagem', icon: ListChecks, show: true },
    { to: '/calendar', label: 'Calendário', icon: CalendarDays, show: true },
    { to: '/events', label: 'Eventos', icon: Calendar, show: canViewEvents },
  ].filter(i => i.show);

  const adminSubItems = [
    { to: '/admin', label: 'Visão Geral', icon: LayoutDashboard, show: canAccessAdmin },
    { to: '/admin?tab=users', label: 'Usuários', icon: Users, show: canAccessAdmin },
    { to: '/admin?tab=roles_permissions', label: 'Papéis e Permissões', icon: Shield, show: canAccessAdmin },

    { to: '/admin?tab=audit', label: 'Auditoria', icon: ListChecks, show: canAccessAdmin },
    { to: '/admin?tab=subgroups', label: 'Equipes', icon: FolderTree, show: canAccessAdmin },
    { to: '/admin?tab=invites', label: 'Convites', icon: Link2, show: canAccessAdmin },
    { to: '/admin?tab=archived', label: 'Arquivadas', icon: Archive, show: canAccessAdmin },
    { to: '/admin?tab=security', label: 'Segurança', icon: Shield, show: canAccessAdmin },
    { to: '/admin?tab=system', label: 'Sistema & Status', icon: RefreshCw, show: canAccessAdmin },
    { to: '/admin?tab=branding', label: 'Identidade', icon: ImageOff, show: canAccessAdmin },
  ].filter(i => i.show);


  const isEventRoute = eventSubItems.some(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'));
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Helper to determine if an admin sub-item is active based on path AND query params
  const isAdminSubActive = (to: string) => {
    const url = new URL(to, window.location.origin);
    const targetTab = url.searchParams.get('tab');
    const currentParams = new URLSearchParams(location.search);
    const currentTab = currentParams.get('tab');

    // If target has a tab param, match it with current tab param
    if (targetTab) {
      return location.pathname === '/admin' && currentTab === targetTab;
    }
    // If target has NO tab param (Overview), it's active if pathname is /admin and tab is null
    return location.pathname === '/admin' && !currentTab;
  };

  
  const [eventsOpen, setEventsOpen] = useState(isEventRoute);
  const [adminOpen, setAdminOpen] = useState(isAdminRoute);

  useEffect(() => {
    setEventsOpen(isEventRoute);
  }, [location.pathname, isEventRoute]);

  useEffect(() => {
    setAdminOpen(isAdminRoute);
  }, [location.pathname, isAdminRoute]);

  const primaryRole = getPrimaryRole(roles);

  const navItems = [
    { to: '/dashboard', label: 'Início', icon: Home, show: canViewPhotos },
    { 
      to: '/scouts', 
      label: primaryRole === 'parent' ? 'Meus Jovens' : 'Integrantes', 
      icon: Users, 
      show: canViewScouts 
    },
  ];

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden shadow-sm">
                  <img src="/logo.png" alt="ScoutFoto" className="w-full h-full object-contain" />
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
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
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

              {eventSubItems.length > 0 && (
                <Collapsible open={collapsed ? false : eventsOpen} onOpenChange={setEventsOpen} asChild>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isEventRoute}
                        tooltip="Central de Eventos"
                      >
                        <CalendarRange className="h-4 w-4" />
                        <span>Central de Eventos</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform data-[state=open]:rotate-90 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {eventSubItems.map(sub => {
                          const subActive = location.pathname === sub.to || location.pathname.startsWith(sub.to + '/');
                          return (
                            <SidebarMenuSubItem key={sub.to}>
                              <SidebarMenuSubButton asChild isActive={subActive}>
                                <NavLink
                                  to={sub.to}
                                  end
                                  className="flex items-center gap-2"
                                  onClick={() => isMobile && setOpenMobile(false)}
                                >
                                  <sub.icon className="h-4 w-4" />
                                  <span>{sub.label}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {adminSubItems.length > 0 && (
                <Collapsible open={collapsed ? false : adminOpen} onOpenChange={setAdminOpen} asChild>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isAdminRoute}
                        tooltip="Administração"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Administração</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform data-[state=open]:rotate-90 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {adminSubItems.map(sub => {
                          const subActive = isAdminSubActive(sub.to);

                          return (
                            <SidebarMenuSubItem key={sub.to}>
                              <SidebarMenuSubButton asChild isActive={subActive}>
                                <NavLink
                                  to={sub.to}
                                  end
                                  className="flex items-center gap-2"
                                  onClick={() => isMobile && setOpenMobile(false)}
                                >
                                  <sub.icon className="h-4 w-4" />
                                  <span>{sub.label}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
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
              isActive={location.pathname === '/profile'}
            >
              <NavLink 
                to="/profile" 
                className="flex items-center gap-2 w-full"
                onClick={() => isMobile && setOpenMobile(false)}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback 
                    className="text-white text-xs font-bold"
                    style={{ backgroundColor: stringToColor(profile?.name || '') }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex flex-1 flex-col items-start text-left leading-tight">
                    <span className="text-sm font-medium truncate max-w-[140px]">{profile?.name}</span>
                    <span className="text-xs text-sidebar-foreground/60">{ROLE_LABELS[primaryRole]}</span>
                  </div>
                )}
              </NavLink>
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