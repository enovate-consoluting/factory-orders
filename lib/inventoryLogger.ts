/**
 * Inventory Logger Utility
 * Provides structured logging for inventory operations with:
 * - Console output for immediate visibility
 * - Audit log database persistence for history
 * - Performance timing for diagnostics
 */

import { supabase } from './supabase';

export type InventoryActionType =
  | 'inventory_create'
  | 'inventory_update'
  | 'inventory_delete'
  | 'inventory_received'
  | 'inventory_archived'
  | 'inventory_pickup'
  | 'inventory_restock'
  | 'inventory_adjustment'
  | 'inventory_manual'
  | 'photo_upload_start'
  | 'photo_upload_complete'
  | 'photo_upload_failed'
  | 'inventory_fetch';

export interface InventoryLogEntry {
  action: InventoryActionType;
  userId?: string;
  userName?: string;
  inventoryId?: string;
  details?: Record<string, any>;
  durationMs?: number;
  error?: string;
}

export interface UploadMetrics {
  inventoryId: string;
  fileCount: number;
  totalSizeBytes: number;
  successCount: number;
  failedCount: number;
  durationMs: number;
  compressionSavingsBytes?: number;
  averageFileSizeBytes?: number;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Get styled console prefix based on action type
 */
function getConsoleStyle(action: InventoryActionType): { prefix: string; style: string } {
  const styles: Record<string, { prefix: string; style: string }> = {
    inventory_create: { prefix: '[INV CREATE]', style: 'color: #22c55e; font-weight: bold' },
    inventory_update: { prefix: '[INV UPDATE]', style: 'color: #3b82f6; font-weight: bold' },
    inventory_delete: { prefix: '[INV DELETE]', style: 'color: #ef4444; font-weight: bold' },
    inventory_received: { prefix: '[INV RECEIVED]', style: 'color: #f59e0b; font-weight: bold' },
    inventory_archived: { prefix: '[INV ARCHIVED]', style: 'color: #6b7280; font-weight: bold' },
    inventory_pickup: { prefix: '[INV PICKUP]', style: 'color: #f59e0b; font-weight: bold' },
    inventory_restock: { prefix: '[INV RESTOCK]', style: 'color: #22c55e; font-weight: bold' },
    inventory_adjustment: { prefix: '[INV ADJUST]', style: 'color: #3b82f6; font-weight: bold' },
    inventory_manual: { prefix: '[INV MANUAL]', style: 'color: #8b5cf6; font-weight: bold' },
    photo_upload_start: { prefix: '[UPLOAD START]', style: 'color: #8b5cf6; font-weight: bold' },
    photo_upload_complete: { prefix: '[UPLOAD DONE]', style: 'color: #22c55e; font-weight: bold' },
    photo_upload_failed: { prefix: '[UPLOAD FAIL]', style: 'color: #ef4444; font-weight: bold' },
    inventory_fetch: { prefix: '[INV FETCH]', style: 'color: #06b6d4; font-weight: bold' },
  };
  return styles[action] || { prefix: `[${action}]`, style: 'color: #6b7280' };
}

/**
 * Log to console with structured formatting
 */
function logToConsole(entry: InventoryLogEntry): void {
  const { prefix, style } = getConsoleStyle(entry.action);
  const timestamp = new Date().toISOString();

  const parts: string[] = [];
  if (entry.inventoryId) parts.push(`id=${entry.inventoryId}`);
  if (entry.userId) parts.push(`user=${entry.userId.slice(0, 8)}...`);
  if (entry.durationMs !== undefined) parts.push(`took=${formatDuration(entry.durationMs)}`);

  const summary = parts.length > 0 ? ` | ${parts.join(' | ')}` : '';

  console.log(
    `%c${prefix}%c ${timestamp}${summary}`,
    style,
    'color: inherit'
  );

  if (entry.details && Object.keys(entry.details).length > 0) {
    console.log('  Details:', entry.details);
  }

  if (entry.error) {
    console.error('  Error:', entry.error);
  }
}

/**
 * Log to audit_log database table
 */
async function logToDatabase(entry: InventoryLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert({
      user_id: entry.userId || 'system',
      user_name: entry.userName || 'Unknown',
      action_type: entry.action,
      target_type: 'inventory',
      target_id: entry.inventoryId || '',
      old_value: null,
      new_value: JSON.stringify({
        ...entry.details,
        durationMs: entry.durationMs,
        error: entry.error,
        timestamp: new Date().toISOString(),
      }),
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.warn('[LOGGER] Failed to write to audit_log:', error.message);
    }
  } catch (err) {
    console.warn('[LOGGER] Database log error:', err);
  }
}

/**
 * Main logging function - logs to both console and database
 */
export async function logInventoryAction(entry: InventoryLogEntry): Promise<void> {
  // Always log to console (immediate feedback)
  logToConsole(entry);

  // Log to database (persistent history) - don't await to avoid blocking
  logToDatabase(entry).catch(() => {
    // Silently fail database logging to not disrupt user flow
  });
}

/**
 * Log upload metrics with detailed performance info
 */
export async function logUploadMetrics(
  metrics: UploadMetrics,
  userId?: string,
  userName?: string
): Promise<void> {
  const entry: InventoryLogEntry = {
    action: metrics.failedCount > 0
      ? (metrics.successCount > 0 ? 'photo_upload_complete' : 'photo_upload_failed')
      : 'photo_upload_complete',
    userId,
    userName,
    inventoryId: metrics.inventoryId,
    durationMs: metrics.durationMs,
    details: {
      fileCount: metrics.fileCount,
      successCount: metrics.successCount,
      failedCount: metrics.failedCount,
      totalSize: formatBytes(metrics.totalSizeBytes),
      totalSizeBytes: metrics.totalSizeBytes,
      avgFileSize: metrics.averageFileSizeBytes ? formatBytes(metrics.averageFileSizeBytes) : undefined,
      compressionSavings: metrics.compressionSavingsBytes ? formatBytes(metrics.compressionSavingsBytes) : undefined,
      uploadSpeedMbps: metrics.durationMs > 0
        ? ((metrics.totalSizeBytes / (1024 * 1024)) / (metrics.durationMs / 1000)).toFixed(2)
        : undefined,
    },
  };

  await logInventoryAction(entry);
}

/**
 * Create a timer for measuring operation duration
 */
export function createTimer(): { elapsed: () => number } {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
  };
}

/**
 * Log inventory fetch with timing
 */
export async function logInventoryFetch(
  recordCount: number,
  durationMs: number,
  filters?: { status?: string; clientId?: string }
): Promise<void> {
  await logInventoryAction({
    action: 'inventory_fetch',
    durationMs,
    details: {
      recordCount,
      filters,
    },
  });
}
