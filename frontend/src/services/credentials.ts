/**
 * Credentials service - API calls for credential management
 */

import api from './api';

export interface Credential {
  id: string;
  name: string;
  username: string;
  description?: string;
  has_password?: boolean;
  has_private_key?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CredentialCreate {
  name: string;
  username: string;
  password?: string;
  private_key?: string;
  passphrase?: string;
  description?: string;
}

export interface CredentialUpdate {
  name?: string;
  username?: string;
  password?: string;
  private_key?: string;
  passphrase?: string;
  description?: string;
}

// Get all credentials (without sensitive data)
export async function getCredentials(): Promise<Credential[]> {
  const response = await api.get<Credential[]>('/credentials');
  return response.data;
}

// Get single credential
export async function getCredential(id: string): Promise<Credential> {
  const response = await api.get<Credential>(`/credentials/${id}`);
  return response.data;
}

// Create credential
export async function createCredential(data: CredentialCreate): Promise<Credential> {
  const response = await api.post<Credential>('/credentials', data);
  return response.data;
}

// Update credential
export async function updateCredential(id: string, data: CredentialUpdate): Promise<Credential> {
  const response = await api.patch<Credential>(`/credentials/${id}`, data);
  return response.data;
}

// Delete credential
export async function deleteCredential(id: string): Promise<void> {
  await api.delete(`/credentials/${id}`);
}

// Test credential (check if it works)
export async function testCredential(id: string, deviceId?: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(`/credentials/${id}/test`, { device_id: deviceId });
  return response.data;
}
