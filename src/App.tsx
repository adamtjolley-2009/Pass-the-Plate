import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";
import CompleteProfile from "./pages/CompleteProfile.tsx";
import { useMyProfile } from "@/hooks/useProfile";
import { isProfileComplete } from "@/lib/profile";

const queryClient = new QueryClient();

const FullPageSpinner = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

// New users must add their name and a username before using the app
const RequireCompleteProfile = ({ children }: { children: React.ReactNode }) => {
  const { data: profile, isLoading, isError } = useMyProfile();
  if (isLoading) return <FullPageSpinner />;
  // Don't lock people out of their recipes if the profile can't be loaded
  if (isError || isProfileComplete(profile)) return <>{children}</>;
  return <CompleteProfile profile={profile ?? null} />;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={user ? <RequireCompleteProfile><Index /></RequireCompleteProfile> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
