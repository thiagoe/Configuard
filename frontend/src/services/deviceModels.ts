/**
 * Device Models service - API calls for device model management
 */

import api from './api';

export interface DeviceModelBrand {
  id: string;
  name: string;
}

export interface DeviceModelCategory {
  id: string;
  name: string;
}

export interface DeviceModel {
  id: string;
  name: string;
  description?: string;
  brand_id?: string;
  category_id?: string;
  brand?: DeviceModelBrand;
  category?: DeviceModelCategory;
  created_at: string;
  updated_at: string;
}

export interface DeviceModelCreate {
  name: string;
  description?: string;
  brand_id?: string;
  category_id?: string;
}

export interface DeviceModelUpdate {
  name?: string;
  description?: string;
  brand_id?: string;
  category_id?: string;
}

export interface DeviceModelListResponse {
  items: DeviceModel[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Get all device models
export async function getDeviceModels(params?: {
  search?: string;
  brand_id?: string;
  category_id?: string;
}): Promise<DeviceModel[]> {
  const response = await api.get<DeviceModel[]>('/device-models', { params });
  return response.data;
}

// Get device models paginated
export async function getDeviceModelsPaginated(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  brand_id?: string;
  category_id?: string;
}): Promise<DeviceModelListResponse> {
  const response = await api.get<DeviceModelListResponse>('/device-models/paginated', { params });
  return response.data;
}

// Get single device model
export async function getDeviceModel(id: string): Promise<DeviceModel> {
  const response = await api.get<DeviceModel>(`/device-models/${id}`);
  return response.data;
}

// Create device model
export async function createDeviceModel(data: DeviceModelCreate): Promise<DeviceModel> {
  const response = await api.post<DeviceModel>('/device-models', data);
  return response.data;
}

// Update device model
export async function updateDeviceModel(id: string, data: DeviceModelUpdate): Promise<DeviceModel> {
  const response = await api.patch<DeviceModel>(`/device-models/${id}`, data);
  return response.data;
}

// Delete device model
export async function deleteDeviceModel(id: string): Promise<void> {
  await api.delete(`/device-models/${id}`);
}
