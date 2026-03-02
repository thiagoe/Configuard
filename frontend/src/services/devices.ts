/**
 * Devices service - API calls for device management
 */

import api from './api';
import { Device } from '@/types';

export interface DeviceFilters {
  search?: string;
  brand_id?: string;
  category_id?: string;
  model_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface DeviceCreate {
  name: string;
  ip_address: string;
  hostname?: string;
  port?: number;
  brand_id?: string;
  category_id?: string;
  model_id?: string;
  credential_id?: string;
  backup_template_id?: string;
  custom_retention?: boolean;
  retention_versions?: number;
  notes?: string;
}

export interface DeviceUpdate {
  name?: string;
  ip_address?: string;
  hostname?: string;
  port?: number;
  brand_id?: string | null;
  category_id?: string | null;
  model_id?: string | null;
  credential_id?: string | null;
  backup_template_id?: string | null;
  custom_retention?: boolean;
  retention_versions?: number | null;
  notes?: string;
  status?: string;
  backup_enabled?: boolean;
}

export interface DeviceListResponse {
  items: Device[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Configuration {
  id: string;
  device_id: string;
  version: number;
  config_hash: string;
  collection_method: string;
  changes_detected: boolean;
  collected_at: string;
  created_at: string;
  config_data?: string;
  collected_by?: string | null;
  previous_config_id?: string | null;
  size_bytes?: number | null;
  lines_count?: number | null;
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

// Get all devices
export async function getDevices(filters?: DeviceFilters): Promise<DeviceListResponse> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.brand_id && filters.brand_id !== 'all') params.append('brand_id', filters.brand_id);
  if (filters?.category_id && filters.category_id !== 'all') params.append('category_id', filters.category_id);
  if (filters?.model_id && filters.model_id !== 'all') params.append('model_id', filters.model_id);
  if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.page_size) params.append('page_size', filters.page_size.toString());

  const response = await api.get<DeviceListResponse>(`/devices/paginated?${params.toString()}`);
  return response.data;
}

// Get single device
export async function getDevice(id: string): Promise<Device> {
  const response = await api.get<Device>(`/devices/${id}`);
  return response.data;
}

// Create device
export async function createDevice(data: DeviceCreate): Promise<Device> {
  const response = await api.post<Device>('/devices', data);
  return response.data;
}

// Update device
export async function updateDevice(id: string, data: DeviceUpdate): Promise<Device> {
  const response = await api.patch<Device>(`/devices/${id}`, data);
  return response.data;
}

// Delete device
export async function deleteDevice(id: string): Promise<void> {
  await api.delete(`/devices/${id}`);
}

// Toggle backup enabled
export async function toggleDeviceBackup(id: string, enabled: boolean): Promise<Device> {
  console.log(`[toggleDeviceBackup] Setting device ${id} backup_enabled to ${enabled}`);
  const response = await api.patch<Device>(`/devices/${id}`, { backup_enabled: enabled });
  console.log(`[toggleDeviceBackup] Response backup_enabled:`, response.data.backup_enabled);
  return response.data;
}

// Execute backup now
export async function executeDeviceBackup(id: string): Promise<Configuration> {
  const response = await api.post<Configuration>(`/devices/${id}/backup`);
  return response.data;
}

// Get device configurations
export async function getDeviceConfigurations(deviceId: string): Promise<Configuration[]> {
  const response = await api.get<Configuration[]>(`/devices/${deviceId}/configurations`);
  return response.data;
}

// Get single configuration
export async function getConfiguration(configId: string): Promise<Configuration> {
  const response = await api.get<Configuration>(`/configurations/${configId}`);
  return response.data;
}

// Get configuration diff
export async function getConfigurationDiff(configId: string, configId2: string): Promise<ConfigurationDiff> {
  const response = await api.get<ConfigurationDiff>(`/configurations/${configId}/diff/${configId2}`);
  return response.data;
}

export interface DeviceImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: { row: number; name: string; error: string }[];
}

// Export all devices as CSV blob
export async function exportDevices(): Promise<Blob> {
  const response = await api.get('/devices/export', { responseType: 'blob' });
  return response.data;
}

// Bulk import devices from a CSV file
export async function importDevices(file: File): Promise<DeviceImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<DeviceImportResult>('/devices/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
