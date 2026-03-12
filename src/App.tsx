import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ForceChangePassword from "@/components/ForceChangePassword";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Gallery from "./pages/Gallery";
import Events from "./pages/Events";
import Admin from "./pages/Admin";
import EventPortal from "./pages/EventPortal";
import Scouts from "./pages/Scouts";
import ScoutCalendar from "./pages/ScoutCalendar";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ForceChangePassword />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute requiredPermission="view_photos"><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute requiredPermission="upload_photos"><Upload /></ProtectedRoute>} />
              <Route path="/gallery/:branchKey" element={<ProtectedRoute requiredPermission="view_photos"><Gallery /></ProtectedRoute>} />
              <Route path="/events" element={<ProtectedRoute requiredPermission="manage_events"><Events /></ProtectedRoute>} />
              <Route path="/scouts" element={<ProtectedRoute requiredPermission="manage_scouts"><Scouts /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><ScoutCalendar /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requiredPermission="manage_users"><Admin /></ProtectedRoute>} />
              <Route path="/evento/:token" element={<EventPortal />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
