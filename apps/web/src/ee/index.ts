/**
 * Paid features on the site (QuickSlot Enterprise License, see LICENSE_EE.md).
 * Layout.astro loads this file only when it exists, so the free build works without the ee folder.
 */
import { initSync } from './sync';

export function init() {
  initSync();
}
