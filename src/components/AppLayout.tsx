import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import NotificationBell from '@/components/NotificationBell';
import SectionIndicator from '@/components/SectionIndicator';
import DataFreshnessIndicator from '@/components/DataFreshnessIndicator';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

const PageLoader = () => (
  <div className="flex flex-1 items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

/** Persistent layout – sidebar stays mounted across route changes. */
const AppLayout = ({ children }: { children?: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-50 h-12 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <SectionIndicator />
            </div>
            <div className="flex items-center gap-3">
              <DataFreshnessIndicator />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            {children ?? (
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
