/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, login as loginService, logout as logoutService, getCurrentUser } from '@/services/auth';
import { getAccessToken, clearTokens } from '@/services/api';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { InactivityWarningDialog } from '@/components/InactivityWarningDialog';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  locale: string;
  changeLocale: (lang: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locale, setLocale] = useState<string>(
    localStorage.getItem('configuard_locale') || 'pt-BR'
  );

  const changeLocale = useCallback((lang: string) => {
    localStorage.setItem('configuard_locale', lang);
    setLocale(lang);
    i18n.changeLanguage(lang);
  }, []);

  // Logout handler for inactivity
  const handleInactivityLogout = useCallback(async () => {
    try {
      await logoutService();
    } catch {
      // Ignore errors during logout
    }
    setUser(null);
    clearTokens();
    localStorage.removeItem('configuard_device_search');
    localStorage.removeItem('configuard_template_search');
    toast.info(i18n.t('sessionExpired'));
    window.location.href = '/auth';
  }, []);

  // Inactivity timeout hook
  const {
    showWarning,
    remainingSeconds,
    dismissWarning,
  } = useInactivityTimeout({
    onLogout: handleInactivityLogout,
    enabled: !!user, // Only track inactivity when logged in
  });

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to get current user:', error);
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await loginService({ email, password });
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutService();
      setUser(null);
      // Clear search terms on logout
      localStorage.removeItem('configuard_device_search');
      localStorage.removeItem('configuard_template_search');
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isModerator: user?.role === 'admin' || user?.role === 'moderator',
    locale,
    changeLocale,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <InactivityWarningDialog
        open={showWarning}
        remainingSeconds={remainingSeconds}
        onContinue={dismissWarning}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
