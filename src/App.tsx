import { lazy, Suspense, useState, useCallback } from "react";
import { useAppUpdate, usePeriodicUpdateCheck } from "@/hooks/useAppUpdate";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ForceChangePassword from "@/components/ForceChangePassword";
import SplashScreen from "@/components/SplashScreen";
import InstallPrompt from "@/components/InstallPrompt";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Upload = lazy(() => import("./pages/Upload"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const EventPortal = lazy(() => import("./pages/EventPortal"));
const Scouts = lazy(() => import("./pages/Scouts"));
const ScoutCalendar = lazy(() => import("./pages/ScoutCalendar"));
const Profile = lazy(() => import("./pages/Profile"));
const BranchScouts = lazy(() => import("./pages/BranchScouts"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 10 * 60 * 1000,   // 10 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

import AppLayout from "@/components/AppLayout";

// Check if running as installed PWA (standalone mode)
const isStandalone = window.matchMedia("(display-mode: standalone)").matches
  || (navigator as any).standalone === true;

// App root component
const App = () => {
  const [splashDone, setSplashDone] = useState(!isStandalone);
  const handleSplashFinished = useCallback(() => setSplashDone(true), []);

  // Auto-update: detect new versions and reload
  useAppUpdate();
  usePeriodicUpdateCheck(5 * 60 * 1000); // check every 5 min

  return (
    <>
      {!splashDone && <SplashScreen onFinished={handleSplashFinished} />}
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <InstallPrompt />
            <BrowserRouter>
              <AuthProvider>
                <ForceChangePassword />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/evento/:token" element={<EventPortal />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    
                    {/* All app routes share persistent sidebar layout */}
                    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                      <Route path="/dashboard" element={<ProtectedRoute requiredPermission="view_photos"><Dashboard /></ProtectedRoute>} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/upload" element={<ProtectedRoute requiredPermission="upload_photos"><Upload /></ProtectedRoute>} />
                      <Route path="/gallery" element={<ProtectedRoute requiredPermission="view_photos"><Gallery /></ProtectedRoute>} />
                      <Route path="/gallery/:branchKey" element={<ProtectedRoute requiredPermission="view_photos"><Gallery /></ProtectedRoute>} />
                      <Route path="/branch/:branchKey" element={<ProtectedRoute requiredPermission="view_scouts"><BranchScouts /></ProtectedRoute>} />
                      <Route path="/events" element={<ProtectedRoute requiredPermission="view_events"><Events /></ProtectedRoute>} />
                      <Route path="/events/:eventId" element={<ProtectedRoute requiredPermission="view_events"><EventDetail /></ProtectedRoute>} />
                      <Route path="/scouts" element={<ProtectedRoute requiredPermission="view_scouts"><Scouts /></ProtectedRoute>} />
                      <Route path="/calendar" element={<ScoutCalendar />} />
                      <Route path="/admin" element={<ProtectedRoute requiredPermission="access_admin"><Admin /></ProtectedRoute>} />
                    </Route>
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </>
  );
};

export default App;