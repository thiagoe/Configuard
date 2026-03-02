/**
 * Configurations service - API calls for backup history
 */

import api from './api';

export interface DeviceSimple {
  id: string;
  name: string;
  ip_address: string;
}

export interface Configuration {
  id: string;
  device_id: string;
  version: number;
  config_hash: string;
  collection_method: 'ssh' | 'telnet' | 'api' | 'manual' | 'scheduled';
  collected_at: string;
  collected_by: string | null;
  changes_detected: boolean;
  previous_config_id: string | null;
  size_bytes: number | null;
  lines_count: number | null;
  created_at: string;
  device?: DeviceSimple;
}

export interface ConfigurationDetail extends Configuration {
  config_data: string;
}

export interface ConfigurationListResponse {
  items: Configuration[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ConfigurationFilters {
  device_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface ConfigurationDiff {
  device_id: string;
  from_config_id: string;
  to_config_id: string;
  from_version: number;
  to_version: number;
  diff: string;
  added_lines: number;
  removed_lines: number;
}

// Get all configurations (paginated)
export async function getConfigurations(filters?: ConfigurationFilters): Promise<ConfigurationListResponse> {
  const params = new URLSearchParams();
  if (filters?.device_id) params.append('device_id', filters.device_id);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.page_size) params.append('page_size', filters.page_size.toString());

  const response = await api.get<ConfigurationListResponse>(`/configurations?${params.toString()}`);
  return response.data;
}

// Get configurations for a specific device
export async function getDeviceConfigurations(deviceId: string): Promise<Configuration[]> {
  const response = await api.get<Configuration[]>(`/devices/${deviceId}/configurations`);
  return response.data;
}

// Get single configuration with full data
export async function getConfiguration(configId: string): Promise<ConfigurationDetail> {
  const response = await api.get<ConfigurationDetail>(`/configurations/${configId}`);
  return response.data;
}

// Get diff between two configurations
export async function getConfigurationDiff(configId1: string, configId2: string): Promise<ConfigurationDiff> {
  const response = await api.get<ConfigurationDiff>(`/configurations/${configId1}/diff/${configId2}`);
  return response.data;
}
