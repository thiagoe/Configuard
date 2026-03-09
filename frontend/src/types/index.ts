/**
 * Shared TypeScript types
 * Replaces Supabase generated types
 */

// Enums
export type AppRole = 'admin' | 'moderator' | 'user';

export type DeviceStatus = 'active' | 'inactive' | 'error' | 'maintenance';

export type BackupStatus = 'success' | 'failed' | 'running';

export type CollectionMethod = 'manual' | 'scheduled' | 'api';

export type StepType = 'command' | 'expect' | 'pause' | 'set_prompt' | 'enter_mode' | 'send_key';

export type OnErrorAction = 'continue' | 'stop' | 'retry';

export type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'cron';

// Base interface with common fields
interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// User
export interface User extends BaseEntity {
  email: string;
  full_name: string | null;
  is_active: boolean;
}

export interface UserWithRole extends User {
  role: AppRole;
}

// Credential
export interface Credential extends BaseEntity {
  user_id: string;
  name: string;
  description: string | null;
  username: string;
  // encrypted_password is not exposed to frontend
  ssh_key: string | null;
}

// Brand
export interface Brand extends BaseEntity {
  user_id: string;
  name: string;
  description: string | null;
}

// Category
export interface Category extends BaseEntity {
  user_id: string;
  name: string;
  description: string | null;
}

// Backup Template
export interface BackupTemplate extends BaseEntity {
  user_id: string;
  name: string;
  description: string | null;
  commands: string;
  use_steps: boolean;
  prompt_pattern: string;
  login_prompt: string;
  password_prompt: string;
  enable_prompt: string | null;
  enable_required: boolean;
  enable_password_required: boolean;
  pagination_pattern: string;
  pagination_key: string;
  connection_timeout: number;
  command_timeout: number;
  pre_commands: string | null;
  post_commands: string | null;
  error_patterns: string | null;
}

// Template Step
export interface TemplateStep extends BaseEntity {
  template_id: string;
  step_order: number;
  step_type: StepType;
  command: string | null;
  expect_pattern: string | null;
  timeout_seconds: number;
  delay_ms: number;
  capture_output: boolean;
  on_error: OnErrorAction;
  retry_count: number;
  enabled: boolean;
  description: string | null;
}

// Simple embedded types
export interface BrandSimple {
  id: string;
  name: string;
}

export interface CategorySimple {
  id: string;
  name: string;
}

// Device
export interface Device extends BaseEntity {
  user_id: string;
  name: string;
  hostname: string | null;
  ip_address: string;
  port: number;
  brand_id: string | null;
  category_id: string | null;
  credential_id: string | null;
  backup_template_id: string | null;
  status: DeviceStatus;
  notes: string | null;
  last_backup_at: string | null;
  last_backup_status: BackupStatus | null;
  // Embedded related objects from API
  brand?: BrandSimple | null;
  category?: CategorySimple | null;
}

// Device with relations
export interface DeviceWithRelations extends Device {
  brand?: Brand | null;
  category?: Category | null;
  credential?: Pick<Credential, 'id' | 'name' | 'username'> | null;
  backup_template?: Pick<BackupTemplate, 'id' | 'name'> | null;
}

// Configuration (backup history)
export interface Configuration {
  id: string;
  device_id: string;
  version: number;
  config_data: string;
  config_hash: string;
  changes_detected: boolean;
  diff_summary: Record<string, unknown> | null;
  collection_method: CollectionMethod;
  collected_at: string;
  created_at: string;
}

// Backup Schedule
export interface BackupSchedule extends BaseEntity {
  user_id: string;
  name: string;
  description: string | null;
  schedule_type: ScheduleType;
  cron_expression: string | null;
  time_of_day: string;
  day_of_week: number | null;
  day_of_month: number | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

// Audit Log
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// API Response types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DiffResult {
  lines_added: number;
  lines_removed: number;
  lines_changed: number;
  diff_content: string;
}

// Dashboard stats
export interface DashboardStats {
  total_devices: number;
  active_devices: number;
  backups_today: number;
  failed_backups: number;
  scheduled_jobs: number;
}

