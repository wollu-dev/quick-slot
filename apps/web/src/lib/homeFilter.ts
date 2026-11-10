/**
 * The category filter last selected on the home page. The "‹ Tools" link on tool pages returns to it.
 * Kept in sessionStorage so it is forgotten when the tab is closed.
 */
const KEY = 'quickslot:home-filter';

export function readHomeFilter(): string {
  try {
    return sessionStorage.getItem(KEY) || 'all';
  } catch {
    return 'all';
  }
}

export function saveHomeFilter(filter: string) {
  try {
    sessionStorage.setItem(KEY, filter);
  } catch {
    /* Storage unavailable */
  }
}
