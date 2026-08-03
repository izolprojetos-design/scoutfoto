import { Outlet, useLocation } from 'react-router-dom';
import NotificationBell from '@/components/NotificationBell';
import SectionIndicator from '@/components/SectionIndicator';
import DataFreshnessIndicator from '@/components/DataFreshnessIndicator';
import { Loader2, Menu } from 'lucide-react';
import { useRenderDiagnostics } from '@/lib/useRenderDiagnostics';
import RenderDiagnosticsToolbar from '@/components/RenderDiagnosticsToolbar';
import { PermissionSimulationPanel, PermissionSimulationTrigger } from '@/components/PermissionSimulationPanel';
import { Suspense, useEffect } from 'react';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import AppSidebar from '@/components/AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

const PageLoader = () => (
  <div className="flex flex-1 items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

/** Persistent layout – sidebar stays mounted across route changes. */
const AppLayout = ({ children }: { children?: React.ReactNode }) => {
  useRenderDiagnostics('AppLayout', { children });
  useNavigationGuard();
  const { pathname, search } = useLocation();

  // Persiste a última rota acessada (pathname + query params se houver)
  useEffect(() => {
    const fullPath = pathname + search;
    const isPublicRoute = pathname === '/' || pathname === '/login' || pathname.includes('reset-password');
    
    if (!isPublicRoute) {
      localStorage.setItem('last_accessed_route', fullPath);
      console.log(`[AppLayout] Rota salva: ${fullPath}`);
    }
  }, [pathname, search]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
          <header className="sticky top-0 z-50 h-12 flex items-center justify-between border-b bg-background px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground" />
              <SectionIndicator />
            </div>
            <div className="flex items-center gap-3">
              <DataFreshnessIndicator />
              <PermissionSimulationTrigger />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 bg-background text-foreground">
            {children ?? (
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            )}
          </main>
        </div>
      </div>
      <RenderDiagnosticsToolbar />
      <PermissionSimulationPanel />
    </SidebarProvider>
  );
};

export default AppLayout;
