/**
 * Brands service - API calls for brand management
 */

import api from './api';

export interface Brand {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface BrandCreate {
  name: string;
  description?: string;
  logo_url?: string;
}

export interface BrandUpdate {
  name?: string;
  description?: string;
  logo_url?: string;
}

// Get all brands
export async function getBrands(): Promise<Brand[]> {
  const response = await api.get<Brand[]>('/brands');
  return response.data;
}

// Get single brand
export async function getBrand(id: string): Promise<Brand> {
  const response = await api.get<Brand>(`/brands/${id}`);
  return response.data;
}

// Create brand
export async function createBrand(data: BrandCreate): Promise<Brand> {
  const response = await api.post<Brand>('/brands', data);
  return response.data;
}

// Update brand
export async function updateBrand(id: string, data: BrandUpdate): Promise<Brand> {
  const response = await api.patch<Brand>(`/brands/${id}`, data);
  return response.data;
}

// Delete brand
export async function deleteBrand(id: string): Promise<void> {
  await api.delete(`/brands/${id}`);
}
