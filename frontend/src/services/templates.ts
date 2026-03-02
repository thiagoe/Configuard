/**
 * Templates service - API calls for backup template management
 */

import api from './api';

export interface BackupTemplate {
  id: string;
  name: string;
  commands: string | null;
  description?: string | null;
  use_steps: boolean;
  prompt_pattern?: string | null;
  login_prompt?: string | null;
  password_prompt?: string | null;
  enable_prompt?: string | null;
  enable_required?: boolean;
  enable_password_required?: boolean;
  pagination_pattern?: string | null;
  pagination_key?: string | null;
  connection_timeout?: number;
  command_timeout?: number;
  pre_commands?: string | null;
  post_commands?: string | null;
  output_cleanup_patterns?: string | null;
  line_ending?: "\\n" | "\\r\\n";
  error_patterns?: string | null;
  steps?: TemplateStep[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateStep {
  id: string;
  template_id: string;
  order: number;
  step_type: "command" | "expect" | "pause" | "set_prompt" | "conditional" | "send_key";
  content: string;
  timeout?: number | null;
  expect_pattern?: string | null;
  on_failure?: "stop" | "continue" | "retry";
  max_retries?: number;
  condition?: string | null;
  capture_output?: boolean;
  variable_name?: string | null;
  created_at?: string;
}

export interface BackupTemplateCreate {
  name: string;
  commands?: string;
  description?: string;
  use_steps?: boolean;
  steps?: TemplateStepCreate[];
  prompt_pattern?: string;
  login_prompt?: string;
  password_prompt?: string;
  enable_prompt?: string;
  enable_required?: boolean;
  enable_password_required?: boolean;
  pagination_pattern?: string;
  pagination_key?: string;
  connection_timeout?: number;
  command_timeout?: number;
  pre_commands?: string;
  post_commands?: string;
  output_cleanup_patterns?: string;
  line_ending?: "\\n" | "\\r\\n";
  error_patterns?: string;
  is_default?: boolean;
}

export interface TemplateStepCreate {
  order: number;
  step_type: "command" | "expect" | "pause" | "set_prompt" | "conditional" | "send_key";
  content: string;
  timeout?: number;
  expect_pattern?: string;
  on_failure?: "stop" | "continue" | "retry";
  max_retries?: number;
  condition?: string;
  capture_output?: boolean;
  variable_name?: string;
}

export interface BackupTemplateUpdate {
  name?: string;
  commands?: string;
  description?: string;
  use_steps?: boolean;
  steps?: TemplateStepCreate[];
  prompt_pattern?: string;
  login_prompt?: string;
  password_prompt?: string;
  enable_prompt?: string;
  enable_required?: boolean;
  enable_password_required?: boolean;
  pagination_pattern?: string;
  pagination_key?: string;
  connection_timeout?: number;
  command_timeout?: number;
  pre_commands?: string;
  post_commands?: string;
  output_cleanup_patterns?: string;
  line_ending?: "\\n" | "\\r\\n";
  error_patterns?: string;
  is_default?: boolean;
}

// Get all templates
export async function getTemplates(): Promise<BackupTemplate[]> {
  const response = await api.get<BackupTemplate[]>('/templates');
  return response.data;
}

// Get single template
export async function getTemplate(id: string): Promise<BackupTemplate> {
  const response = await api.get<BackupTemplate>(`/templates/${id}`);
  return response.data;
}

// Create template
export async function createTemplate(data: BackupTemplateCreate): Promise<BackupTemplate> {
  const response = await api.post<BackupTemplate>('/templates', data);
  return response.data;
}

// Update template
export async function updateTemplate(id: string, data: BackupTemplateUpdate): Promise<BackupTemplate> {
  const response = await api.patch<BackupTemplate>(`/templates/${id}`, data);
  return response.data;
}

// Delete template
export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/templates/${id}`);
}
