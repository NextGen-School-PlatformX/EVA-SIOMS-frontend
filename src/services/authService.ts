import { apiClient } from './apiClient';
import type { User, Role, PageId } from '@/types';

const ROLE_PERMISSIONS: Record<string, PageId[]> = {
  "Admin":            ["dashboard","attendance","hr","payroll","canteen","inventory","suppliers","workshop","assets","settings"],
  "HR":               ["dashboard","attendance","hr","payroll","assets"],
  "Accountant":       ["dashboard","payroll","canteen","suppliers"],
  "StoreKeeper":      ["dashboard","inventory","suppliers"],
  "WorkshopEngineer": ["dashboard","workshop","assets","inventory"],
  "CanteenManager":   ["dashboard","canteen","inventory"],
  "Employee":         ["dashboard"],
  // Employee role: Dashboard only - attendance managed by Admin/HR
};

export const authService = {
  login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
    return apiClient.post<{ user: User; token: string }>('/auth/login', { email, password });
  },

  registerRequest: async (data: {
    name: string; email: string; requestedRole: string;
    department?: string; phone?: string; reason?: string;
  }): Promise<{ message: string; requestId: number }> => {
    return apiClient.post('/auth/register-request', data);
  },

  verifyEmail: async (email: string, code: string): Promise<{ message: string }> => {
    return apiClient.post('/auth/verify-email', { email, code });
  },

  resendVerification: async (email: string): Promise<{ message: string }> => {
    return apiClient.post('/auth/resend-verification', { email });
  },

  getCurrentUser: async (): Promise<User> => {
    return apiClient.get<User>('/auth/me');
  },

  hasPermission: (user: User | null, pageId: PageId): boolean => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return (user.permissions || ROLE_PERMISSIONS[user.role] || []).includes(pageId);
  },
};
