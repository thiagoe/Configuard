/**
 * Admin services - users, audit logs, db stats
 */

import api from "./api";

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminUserCreate {
  email: string;
  password: string;
  full_name?: string | null;
  role: "admin" | "moderator" | "user";
}

export interface AdminUserUpdate {
  full_name?: string | null;
  is_active?: boolean;
  role?: string;
  password?: string;
}

export async function getAdminUsers(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  is_active?: boolean;
}): Promise<AdminUserListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());
  if (params?.search) query.set("search", params.search);
  if (params?.role) query.set("role", params.role);
  if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));
  const response = await api.get<AdminUserListResponse>(`/users?${query.toString()}`);
  return response.data;
}

export async function createAdminUser(data: AdminUserCreate): Promise<AdminUser> {
  const response = await api.post<AdminUser>(`/users`, data);
  return response.data;
}

export async function updateAdminUser(id: string, data: AdminUserUpdate): Promise<AdminUser> {
  const response = await api.put<AdminUser>(`/users/${id}`, data);
  return response.data;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export interface AuditLogUser {
  id: string;
  email: string;
  full_name?: string | null;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string | null;
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  old_data?: unknown;
  new_data?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  user?: AuditLogUser | null;
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getAuditLogs(params?: {
  page?: number;
  page_size?: number;
  action?: string;
  table_name?: string;
  user_id?: string;
  record_id?: string;
}): Promise<AuditLogListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());
  if (params?.action) query.set("action", params.action);
  if (params?.table_name) query.set("table_name", params.table_name);
  if (params?.user_id) query.set("user_id", params.user_id);
  if (params?.record_id) query.set("record_id", params.record_id);
  const response = await api.get<AuditLogListResponse>(`/audit?${query.toString()}`);
  return response.data;
}

export interface DbStatsResponse {
  users: number;
  brands: number;
  categories: number;
  credentials: number;
  templates: number;
  devices: number;
  configurations: number;
  schedules: number;
  audit_logs: number;
  db_size_bytes: number;
}

export async function getDbStats(): Promise<DbStatsResponse> {
  const response = await api.get<DbStatsResponse>("/admin/db-stats");
  return response.data;
}

// System Settings
export interface SystemSettings {
  retention_versions: number;
  audit_retention_days: number;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const response = await api.get<SystemSettings>("/admin/settings");
  return response.data;
}

export async function updateRetentionVersions(value: number): Promise<void> {
  await api.patch("/admin/settings/retention_versions", { value: String(value) });
}

export async function updateAuditRetentionDays(value: number): Promise<void> {
  await api.patch("/admin/settings/audit_retention_days", { value: String(value) });
}

// Email settings
export interface EmailSettings {
  email_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_use_tls: boolean;
  smtp_username: string;
  smtp_password_set: boolean;
  email_sender: string;
  email_recipients: string;
  notify_backup_failed: boolean;
  notify_backup_success: boolean;
  notify_device_disabled: boolean;
  notify_device_deleted: boolean;
}

export interface EmailSettingsUpdate {
  email_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_use_tls: boolean;
  smtp_username: string;
  smtp_password?: string;
  email_sender: string;
  email_recipients: string;
  notify_backup_failed: boolean;
  notify_backup_success: boolean;
  notify_device_disabled: boolean;
  notify_device_deleted: boolean;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const response = await api.get<EmailSettings>("/admin/settings/email");
  return response.data;
}

export async function updateEmailSettings(data: EmailSettingsUpdate): Promise<EmailSettings> {
  const response = await api.patch<EmailSettings>("/admin/settings/email", data);
  return response.data;
}

export async function sendTestEmail(): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>("/admin/settings/email/test");
  return response.data;
}

// LDAP Settings
export interface LdapGroupMapping {
  group_dn: string;
  role: "admin" | "moderator" | "user";
}

export interface LdapSettings {
  ldap_enabled: boolean;
  ldap_server: string;
  ldap_port: number;
  ldap_use_ssl: boolean;
  ldap_use_starttls: boolean;
  ldap_bind_dn: string;
  ldap_bind_password_set: boolean;
  ldap_base_dn: string;
  ldap_user_filter: string;
  ldap_username_attr: string;
  ldap_email_attr: string;
  ldap_display_name_attr: string;
  ldap_group_search_base: string;
  ldap_group_search_filter: string;
  ldap_group_mappings: LdapGroupMapping[];
  ldap_default_role: string;
  ldap_access_token_ttl: number;
}

export interface LdapSettingsUpdate {
  ldap_enabled: boolean;
  ldap_server: string;
  ldap_port: number;
  ldap_use_ssl: boolean;
  ldap_use_starttls: boolean;
  ldap_bind_dn: string;
  ldap_bind_password?: string;
  ldap_base_dn: string;
  ldap_user_filter: string;
  ldap_username_attr: string;
  ldap_email_attr: string;
  ldap_display_name_attr: string;
  ldap_group_search_base: string;
  ldap_group_search_filter: string;
  ldap_group_mappings: LdapGroupMapping[];
  ldap_default_role: string;
  ldap_access_token_ttl: number;
}

export async function getLdapSettings(): Promise<LdapSettings> {
  const response = await api.get<LdapSettings>("/admin/settings/ldap");
  return response.data;
}

export async function updateLdapSettings(data: LdapSettingsUpdate): Promise<LdapSettings> {
  const response = await api.patch<LdapSettings>("/admin/settings/ldap", data);
  return response.data;
}

export async function testLdapConnection(testUsername?: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>(
    "/admin/settings/ldap/test",
    { test_username: testUsername || null }
  );
  return response.data;
}
