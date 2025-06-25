/**
 * Application constants used throughout the frontend.
 * All magic numbers and hardcoded values should be defined here.
 */

// Byte formatting
export const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
export const BYTE_UNIT_SIZE = 1024;

// Chart configuration
export const DEFAULT_CHART_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#ec4899',
  '#6366f1',
];

export const CHART_PADDING_PERCENT = 0.1; // 10% padding for charts

// Data limits and pagination
export const DEFAULT_MAX_DATA_POINTS = 50;
export const BENCHMARK_RESULTS_LIMIT = 5000;
export const DEFAULT_PAGE_SIZE = 100;

// Performance thresholds
export const SIGNIFICANT_DELTA_THRESHOLD = 5; // 5% change is considered significant
export const DELTA_COLOR_THRESHOLD = 5; // Threshold for color coding deltas

// Toast configuration
export const TOAST_REMOVE_DELAY = 5000; // 5 seconds (changed from 1000000)

// Colors for different states
export const COLORS = {
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
  NEUTRAL: '#6b7280',
} as const;
