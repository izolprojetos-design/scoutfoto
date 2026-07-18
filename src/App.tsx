import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { useAppUpdate, usePeriodicUpdateCheck } from "@/hooks/useAppUpdate";
import { useRemoteForceRefresh } from "@/hooks/useRemoteForceRefresh";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import ForceChangePassword from "@/components/ForceChangePassword";
const SplashScreen = lazyWithRetry(() => import("@/components/SplashScreen"));
const InstallPrompt = lazyWithRetry(() => import("@/components/InstallPrompt"));
import ConnectivityBanner from "@/components/ConnectivityBanner";
import { Loader2 } from "lucide-react";

// Offline cache persister using localStorage
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "scoutfoto-query-cache",
  throttleTime: 2000,
});

// Lazy-loaded pages for code splitting
const Index = lazyWithRetry(() => import("./pages/Index"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Upload = lazyWithRetry(() => import("./pages/Upload"));
const Gallery = lazyWithRetry(() => import("./pages/Gallery"));
const Events = lazyWithRetry(() => import("./pages/Events"));
const EventDetail = lazyWithRetry(() => import("./pages/EventDetail"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const EventPortal = lazyWithRetry(() => import("./pages/EventPortal"));
const Scouts = lazyWithRetry(() => import("./pages/Scouts"));
const ScoutCalendar = lazyWithRetry(() => import("./pages/ScoutCalendar"));
const MyAgendamentos = lazyWithRetry(() => import("./pages/MyAgendamentos"));
const ScoutPhotoGallery = lazyWithRetry(() => import("./pages/ScoutPhotoGallery"));

const Profile = lazyWithRetry(() => import("./pages/Profile"));
const BranchScouts = lazyWithRetry(() => import("./pages/BranchScouts"));
const Register = lazyWithRetry(() => import("./pages/Register"));
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"));
const ConfirmScheduling = lazyWithRetry(() => import("./pages/ConfirmScheduling"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Library = lazyWithRetry(() => import("./pages/Library"));

const isAuthError = (error: unknown): boolean => {
  if (!error) return false;
  const msg = String(error);
  return (
    msg.includes("JWT") ||
    msg.includes("401") ||
    msg.includes("token is expired") ||
    msg.includes("invalid claim") ||
    msg.includes("not authenticated")
  );
};

let authErrorHandled = false;

const handleAuthError = async () => {
  if (authErrorHandled) return;
  authErrorHandled = true;

  // Try refreshing the session first
  const { data } = await supabase.auth.refreshSession();
  if (data.session) {
    authErrorHandled = false;
    // Session recovered — invalidate queries to refetch
    queryClient.invalidateQueries();
    return;
  }

  toast.error("Sua sessão expirou. Faça login novamente.", { id: "auth-expired" });
  await supabase.auth.signOut();
  setTimeout(() => { authErrorHandled = false; }, 3000);
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isAuthError(error)) handleAuthError();
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isAuthError(error)) handleAuthError();
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000, // 24h for offline persistence
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isAuthError(error)) return false;
        return failureCount < 1;
      },
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

// Watches for admin-triggered remote refresh requests on the current user
const RemoteRefreshWatcher = () => {
  const { user } = useAuth();
  useRemoteForceRefresh(user?.id);
  return null;
};

const AppLayout = lazy(() => import("@/components/AppLayout"));

// Check if running as installed PWA (standalone mode)
const isStandalone = window.matchMedia("(display-mode: standalone)").matches
  || (navigator as any).standalone === true;

// App root component
const App = () => {
  const [splashDone, setSplashDone] = useState(!isStandalone);
  const handleSplashFinished = useCallback(() => setSplashDone(true), []);

  // Auto-update: detect new versions and reload
  useAppUpdate();
  usePeriodicUpdateCheck(10 * 60 * 1000); // check every 10 min

  return (
    <>
      {!splashDone && (
        <Suspense fallback={null}>
          <SplashScreen onFinished={handleSplashFinished} />
        </Suspense>
      )}
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 24 * 60 * 60 * 1000, // 24h cache
            buster: "v1",
          }}
        >
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <ConnectivityBanner />
            <Suspense fallback={null}>
              <InstallPrompt />
            </Suspense>
            <BrowserRouter>
              <AuthProvider>
                <RemoteRefreshWatcher />
                <ForceChangePassword />
                <ChunkErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/evento/:token" element={<EventPortal />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    <Route path="/confirmar-agendamento" element={<ConfirmScheduling />} />
                    
                    {/* All app routes share persistent sidebar layout */}
                    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/upload" element={<ProtectedRoute requiredPermission="upload_photos"><Upload /></ProtectedRoute>} />
                      <Route path="/gallery" element={<ProtectedRoute requiredPermission="view_photos"><Gallery /></ProtectedRoute>} />
                      <Route path="/gallery/:branchKey" element={<ProtectedRoute requiredPermission="view_photos"><Gallery /></ProtectedRoute>} />
                      <Route path="/branch/:branchKey" element={<ProtectedRoute requiredPermission="view_scouts"><BranchScouts /></ProtectedRoute>} />
                      <Route path="/events" element={<ProtectedRoute requiredPermission="view_events"><Events /></ProtectedRoute>} />
                      <Route path="/events/:eventId" element={<ProtectedRoute requiredPermission="view_events"><EventDetail /></ProtectedRoute>} />
                      <Route path="/scouts" element={<ProtectedRoute requiredPermission="view_scouts"><Scouts /></ProtectedRoute>} />
                      <Route path="/scout-gallery" element={<ProtectedRoute requiredPermission="view_scouts"><ScoutPhotoGallery /></ProtectedRoute>} />
                      <Route path="/calendar" element={<ScoutCalendar />} />
                      <Route path="/agendamentos" element={<MyAgendamentos />} />
                      <Route path="/biblioteca" element={<Library />} />
                      
                      
                      <Route path="/admin" element={<ProtectedRoute requiredPermission="access_admin"><Admin /></ProtectedRoute>} />
                    </Route>
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </ChunkErrorBoundary>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </>
  );
};

export default App;