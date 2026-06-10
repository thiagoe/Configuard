import React, { lazy, Suspense } from "react";
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
import Auth from "./pages/Auth"; // eager: first screen, keep it instant

// Route-level code splitting — each page ships in its own chunk, loaded on demand
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Devices = lazy(() => import("./pages/Devices"));
const DeviceDetail = lazy(() => import("./pages/DeviceDetail"));
const DeviceBackupHistory = lazy(() => import("./pages/DeviceBackupHistory"));
const DeviceLogs = lazy(() => import("./pages/DeviceLogs"));
const Backups = lazy(() => import("./pages/Backups"));
const Versions = lazy(() => import("./pages/Versions"));
const Diff = lazy(() => import("./pages/Diff"));
const SearchConfigs = lazy(() => import("./pages/SearchConfigs"));
const BackupTemplates = lazy(() => import("./pages/BackupTemplates"));
const Schedules = lazy(() => import("./pages/Schedules"));
const Audit = lazy(() => import("./pages/Audit"));
const Brands = lazy(() => import("./pages/Brands"));
const Categories = lazy(() => import("./pages/Categories"));
const Models = lazy(() => import("./pages/Models"));
const Credentials = lazy(() => import("./pages/Credentials"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
          <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center text-muted-foreground">Carregando…</div>}>
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
          </Suspense>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
