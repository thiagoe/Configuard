import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import DeviceDetail from "./pages/DeviceDetail";
import DeviceBackupHistory from "./pages/DeviceBackupHistory";
import DeviceLogs from "./pages/DeviceLogs";
import Backups from "./pages/Backups";
import Versions from "./pages/Versions";
import Diff from "./pages/Diff";
import SearchConfigs from "./pages/SearchConfigs";
import BackupTemplates from "./pages/BackupTemplates";
import Schedules from "./pages/Schedules";
import Audit from "./pages/Audit";
import Brands from "./pages/Brands";
import Categories from "./pages/Categories";
import Models from "./pages/Models";
import Credentials from "./pages/Credentials";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <LayoutWrapper>{children}</LayoutWrapper>
        </div>
      </div>
    </SidebarProvider>
  </ProtectedRoute>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
          <Routes>
            {/* Public route */}
            <Route path="/auth" element={<Auth />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedLayout>
                  <Dashboard />
                </ProtectedLayout>
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedLayout>
                  <Devices />
                </ProtectedLayout>
              }
            />
            <Route
              path="/devices/:id"
              element={
                <ProtectedLayout>
                  <DeviceDetail />
                </ProtectedLayout>
              }
            />
            <Route
              path="/devices/:id/history"
              element={
                <ProtectedLayout>
                  <DeviceBackupHistory />
                </ProtectedLayout>
              }
            />
            <Route
              path="/devices/:id/logs"
              element={
                <ProtectedLayout>
                  <DeviceLogs />
                </ProtectedLayout>
              }
            />
            <Route
              path="/backups"
              element={
                <ProtectedLayout>
                  <Backups />
                </ProtectedLayout>
              }
            />
            <Route
              path="/versions"
              element={
                <ProtectedLayout>
                  <Versions />
                </ProtectedLayout>
              }
            />
            <Route
              path="/diff"
              element={
                <ProtectedLayout>
                  <Diff />
                </ProtectedLayout>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedLayout>
                  <SearchConfigs />
                </ProtectedLayout>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute requireModerator>
                  <ProtectedLayout>
                    <BackupTemplates />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/schedules"
              element={
                <ProtectedRoute requireModerator>
                  <ProtectedLayout>
                    <Schedules />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute requireAdmin>
                  <ProtectedLayout>
                    <Audit />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands"
              element={
                <ProtectedRoute requireModerator>
                  <ProtectedLayout>
                    <Brands />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute requireModerator>
                  <ProtectedLayout>
                    <Categories />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/models"
              element={
                <ProtectedRoute requireModerator>
                  <ProtectedLayout>
                    <Models />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/credentials"
              element={
                <ProtectedRoute requireModerator>
                  <ProtectedLayout>
                    <Credentials />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <ProtectedLayout>
                    <Admin />
                  </ProtectedLayout>
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
