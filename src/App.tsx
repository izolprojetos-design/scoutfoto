import { lazy, Suspense, useState, useCallback } from "react";
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
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// App root component
const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ForceChangePassword />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<ProtectedRoute requiredPermission="view_photos"><Dashboard /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/upload" element={<ProtectedRoute requiredPermission="upload_photos"><Upload /></ProtectedRoute>} />
                <Route path="/gallery" element={<ProtectedRoute requiredPermission="view_photos"><Gallery /></ProtectedRoute>} />
                <Route path="/gallery/:branchKey" element={<ProtectedRoute requiredPermission="view_photos"><Gallery /></ProtectedRoute>} />
                <Route path="/branch/:branchKey" element={<ProtectedRoute requiredPermission="view_photos"><BranchScouts /></ProtectedRoute>} />
                <Route path="/events" element={<ProtectedRoute requiredPermission="manage_events"><Events /></ProtectedRoute>} />
                <Route path="/events/:eventId" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
                <Route path="/scouts" element={<ProtectedRoute requiredPermission="manage_scouts"><Scouts /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><ScoutCalendar /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requiredPermission="manage_users"><Admin /></ProtectedRoute>} />
                <Route path="/evento/:token" element={<EventPortal />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;