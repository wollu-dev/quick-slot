/**
 * Paid features (QuickSlot Enterprise License, see LICENSE_EE.md).
 * index.ts loads this folder only when it exists, so the free build works without it.
 */
import type { Plugin } from '../app.ts';
import { syncPlugin } from './sync.ts';

export const plugins: Plugin[] = [syncPlugin];

/** Tables for the paid features, applied after the core migrations */
export const migrations = [new URL('./migrations/', import.meta.url)];
