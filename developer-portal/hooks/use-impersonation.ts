'use client';

import { useState, useEffect } from 'react';

interface ImpersonationState {
  isImpersonating: boolean;
  merchantId: string | null;
  companyName: string | null;
  impersonatedBy: string | null;
  token: string | null;
}

const IMPERSONATION_STORAGE_KEY = 'impersonation_state';

/**
 * useImpersonation Hook
 * 
 * Manages impersonation state in the developer portal.
 * Stores impersonation token in localStorage and provides methods
 * to start/stop impersonation mode.
 * 
 * @see .kiro/specs/merchant-platform/tasks.md - Task 13.2 Admin UI (Add impersonation mode)
 */
export function useImpersonation() {
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    merchantId: null,
    companyName: null,
    impersonatedBy: null,
    token: null,
  });

  // Load impersonation state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(parsed);
      } catch (error) {
        console.error('Failed to parse impersonation state:', error);
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      }
    }
  }, []);

  /**
   * Start impersonating a merchant
   */
  const startImpersonation = (data: {
    merchantId: string;
    companyName: string;
    impersonatedBy: string;
    token: string;
  }) => {
    const newState: ImpersonationState = {
      isImpersonating: true,
      merchantId: data.merchantId,
      companyName: data.companyName,
      impersonatedBy: data.impersonatedBy,
      token: data.token,
    };

    setState(newState);
    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(newState));
  };

  /**
   * Stop impersonating and return to admin view
   */
  const stopImpersonation = () => {
    const newState: ImpersonationState = {
      isImpersonating: false,
      merchantId: null,
      companyName: null,
      impersonatedBy: null,
      token: null,
    };

    setState(newState);
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  };

  /**
   * Get headers to include in API requests
   */
  const getImpersonationHeaders = (): Record<string, string> => {
    if (state.isImpersonating && state.token) {
      return {
        'X-Impersonation-Token': state.token,
      };
    }
    return {};
  };

  return {
    ...state,
    startImpersonation,
    stopImpersonation,
    getImpersonationHeaders,
  };
}
