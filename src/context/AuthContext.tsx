"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  loading: boolean;
  updateUser: (partial: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Pull fresh user data from /auth/me
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('sioms_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const fresh = await res.json();
        setUser(prev => {
          const updated = { ...prev!, ...fresh };
          localStorage.setItem('sioms_user', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const savedUser  = localStorage.getItem('sioms_user');
    const token      = localStorage.getItem('sioms_token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
      // Silently refresh to get latest profileImage etc.
      refreshUser();
    }
    setLoading(false);
  }, []);

  const login = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('sioms_user', JSON.stringify(userData));
    localStorage.setItem('sioms_token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sioms_user');
    localStorage.removeItem('sioms_token');
  };

  const updateUser = (partial: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      localStorage.setItem('sioms_user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, loading, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
