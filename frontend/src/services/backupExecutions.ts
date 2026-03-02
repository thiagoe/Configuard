/**
 * Backup Executions service - API calls for backup execution history
 */

import api from './api';

export interface DeviceSimple {
  id: string;
  name: string;
  ip_address: string;
}

export interface BackupExecution {
  id: string;
  device_id: string;
  user_id: string;
  status: 'success' | 'failed' | 'timeout';
  error_message: string | null;
  configuration_id: string | null;
  config_changed: boolean;
  config_hash: string | null;
  collection_method: 'ssh' | 'telnet' | 'scheduled';
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  triggered_by: 'manual' | 'scheduled';
  schedule_id: string | null;
  created_at: string;
  device?: DeviceSimple;
}

export interface BackupExecutionListResponse {
  items: BackupExecution[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface BackupExecutionStats {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  configs_with_changes: number;
  configs_without_changes: number;
  success_rate: number;
  change_rate: number;
}

export interface BackupExecutionFilters {
  device_id?: string;
  status?: 'success' | 'failed' | 'timeout';
  config_changed?: boolean;
  triggered_by?: 'manual' | 'scheduled';
  page?: number;
  page_size?: number;
}

export interface BackupExecutionStatsFilters {
  device_id?: string;
  days?: number;
}

// Get all backup executions (paginated)
export async function getBackupExecutions(
  filters?: BackupExecutionFilters
): Promise<BackupExecutionListResponse> {
  const params = new URLSearchParams();
  if (filters?.device_id) params.append('device_id', filters.device_id);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.config_changed !== undefined) params.append('config_changed', String(filters.config_changed));
  if (filters?.triggered_by) params.append('triggered_by', filters.triggered_by);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.page_size) params.append('page_size', filters.page_size.toString());

  const response = await api.get<BackupExecutionListResponse>(`/backup-executions?${params.toString()}`);
  return response.data;
}

// Get backup execution statistics
export async function getBackupExecutionStats(
  filters?: BackupExecutionStatsFilters
): Promise<BackupExecutionStats> {
  const params = new URLSearchParams();
  if (filters?.device_id) params.append('device_id', filters.device_id);
  if (filters?.days) params.append('days', filters.days.toString());

  const response = await api.get<BackupExecutionStats>(`/backup-executions/stats?${params.toString()}`);
  return response.data;
}

// Get single backup execution
export async function getBackupExecution(executionId: string): Promise<BackupExecution> {
  const response = await api.get<BackupExecution>(`/backup-executions/${executionId}`);
  return response.data;
}

// Get backup executions for a specific device
export async function getDeviceBackupExecutions(
  deviceId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<BackupExecutionListResponse> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());

  const response = await api.get<BackupExecutionListResponse>(
    `/backup-executions/device/${deviceId}?${params.toString()}`
  );
  return response.data;
}
