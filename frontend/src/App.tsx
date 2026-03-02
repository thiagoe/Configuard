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
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
                <ProtectedLayout>
                  <BackupTemplates />
                </ProtectedLayout>
              }
            />
            <Route
              path="/schedules"
              element={
                <ProtectedLayout>
                  <Schedules />
                </ProtectedLayout>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedLayout>
                  <Audit />
                </ProtectedLayout>
              }
            />
            <Route
              path="/brands"
              element={
                <ProtectedLayout>
                  <Brands />
                </ProtectedLayout>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedLayout>
                  <Categories />
                </ProtectedLayout>
              }
            />
            <Route
              path="/models"
              element={
                <ProtectedLayout>
                  <Models />
                </ProtectedLayout>
              }
            />
            <Route
              path="/credentials"
              element={
                <ProtectedLayout>
                  <Credentials />
                </ProtectedLayout>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedLayout>
                  <Admin />
                </ProtectedLayout>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
