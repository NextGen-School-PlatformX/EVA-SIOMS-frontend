import { apiClient } from './apiClient';
import type { AttendanceRecord } from '@/types';

export const attendanceService = {
  getAll: async (date?: string): Promise<AttendanceRecord[]> => {
    const response = await apiClient.get<{ data: AttendanceRecord[] }>(`/attendance?limit=1000${date ? `&date=${date}` : ''}`);
    return response.data;
  },

  checkIn: async (employeeId: string): Promise<AttendanceRecord> => {
    return apiClient.post<AttendanceRecord>('/attendance/check-in', { employeeId });
  },

  checkOut: async (recordId: number): Promise<AttendanceRecord> => {
    return apiClient.post<AttendanceRecord>(`/attendance/check-out/${recordId}`, {});
  }
};
