/**
 * Services index - exports all API services
 */

export * from './auth';
export * from './devices';
export * from './deviceModels';
export * from './brands';
export * from './categories';
export * from './credentials';
export * from './templates';
export * from './schedules';
export * from './backupExecutions';
export * from './admin';
export * from './search';

// Re-export the api instance
export { default as api } from './api';
