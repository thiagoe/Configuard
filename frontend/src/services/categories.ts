/**
 * Categories service - API calls for category management
 */

import api from './api';

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

// Get all categories
export async function getCategories(): Promise<Category[]> {
  const response = await api.get<Category[]>('/categories');
  return response.data;
}

// Get single category
export async function getCategory(id: string): Promise<Category> {
  const response = await api.get<Category>(`/categories/${id}`);
  return response.data;
}

// Create category
export async function createCategory(data: CategoryCreate): Promise<Category> {
  const response = await api.post<Category>('/categories', data);
  return response.data;
}

// Update category
export async function updateCategory(id: string, data: CategoryUpdate): Promise<Category> {
  const response = await api.patch<Category>(`/categories/${id}`, data);
  return response.data;
}

// Delete category
export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}
