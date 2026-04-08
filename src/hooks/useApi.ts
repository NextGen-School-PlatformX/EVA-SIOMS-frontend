"use client";

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/apiClient';

interface UseApiOptions {
  manual?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useApi<T>(endpoint: string, options: UseApiOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options.manual);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (body?: any) => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (body) {
        result = await apiClient.post<T>(endpoint, body);
      } else {
        result = await apiClient.get<T>(endpoint);
      }
      setData(result);
      options.onSuccess?.(result);
      return result;
    } catch (err: any) {
      setError(err);
      options.onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint, options]);

  useEffect(() => {
    if (!options.manual) {
      execute();
    }
  }, [endpoint, options.manual, execute]);

  return { data, loading, error, execute, setData };
}
