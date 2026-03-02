/**
 * Hook for tracking user inactivity and triggering logout
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Get timeout from environment (in minutes), default 30 minutes
const INACTIVITY_TIMEOUT_MINUTES = parseInt(import.meta.env.VITE_INACTIVITY_TIMEOUT_MINUTES || '30', 10);
const WARNING_BEFORE_LOGOUT_SECONDS = 60; // Show warning 60 seconds before logout

// Events that indicate user activity
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
];

interface UseInactivityTimeoutOptions {
  onLogout: () => void;
  enabled?: boolean;
}

interface UseInactivityTimeoutReturn {
  showWarning: boolean;
  remainingSeconds: number;
  resetTimer: () => void;
  dismissWarning: () => void;
}

export function useInactivityTimeout({
  onLogout,
  enabled = true,
}: UseInactivityTimeoutOptions): UseInactivityTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(WARNING_BEFORE_LOGOUT_SECONDS);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Timeout in milliseconds
  const timeoutMs = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
  const warningMs = timeoutMs - (WARNING_BEFORE_LOGOUT_SECONDS * 1000);

  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setRemainingSeconds(WARNING_BEFORE_LOGOUT_SECONDS);

    countdownTimerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTimers();
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimers, onLogout]);

  const resetTimer = useCallback(() => {
    if (!enabled || INACTIVITY_TIMEOUT_MINUTES <= 0) return;

    clearTimers();
    setShowWarning(false);
    setRemainingSeconds(WARNING_BEFORE_LOGOUT_SECONDS);
    lastActivityRef.current = Date.now();

    // Set timer to show warning
    inactivityTimerRef.current = setTimeout(() => {
      startCountdown();
    }, warningMs);
  }, [enabled, clearTimers, startCountdown, warningMs]);

  const dismissWarning = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    // Only reset if warning is not showing
    // If warning is showing, user must click "Continue" button
    if (!showWarning) {
      resetTimer();
    }
  }, [showWarning, resetTimer]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled || INACTIVITY_TIMEOUT_MINUTES <= 0) return;

    // Start the timer initially
    resetTimer();

    // Add event listeners
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, handleActivity, resetTimer, clearTimers]);

  return {
    showWarning,
    remainingSeconds,
    resetTimer,
    dismissWarning,
  };
}

export default useInactivityTimeout;
