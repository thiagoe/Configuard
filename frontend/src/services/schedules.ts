/**
 * Schedules service - API calls for backup scheduling
 */

import api from './api';

export type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'cron';

export interface Schedule {
  id: string;
  name: string;
  description?: string;
  schedule_type: ScheduleType;
  cron_expression?: string;
  time_of_day?: string;
  day_of_week?: number;
  day_of_month?: number;
  is_active: boolean;
  device_ids: string[];
  category_ids: string[];  // Categories to include all their devices
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleCreate {
  name: string;
  description?: string;
  schedule_type: ScheduleType;
  cron_expression?: string;
  time_of_day?: string;
  day_of_week?: number;
  day_of_month?: number;
  is_active?: boolean;
  device_ids: string[];
  category_ids: string[];
}

export interface ScheduleUpdate {
  name?: string;
  description?: string;
  schedule_type?: ScheduleType;
  cron_expression?: string;
  time_of_day?: string;
  day_of_week?: number;
  day_of_month?: number;
  is_active?: boolean;
  device_ids?: string[];
  category_ids?: string[];
}

export async function getSchedules(): Promise<Schedule[]> {
  const response = await api.get<Schedule[]>('/schedules');
  return response.data;
}

export async function createSchedule(data: ScheduleCreate): Promise<Schedule> {
  const response = await api.post<Schedule>('/schedules', data);
  return response.data;
}

export async function updateSchedule(id: string, data: ScheduleUpdate): Promise<Schedule> {
  const response = await api.patch<Schedule>(`/schedules/${id}`, data);
  return response.data;
}

export async function deleteSchedule(id: string): Promise<void> {
  await api.delete(`/schedules/${id}`);
}
