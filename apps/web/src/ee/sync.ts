/**
 * Sync between devices (Pro, QuickSlot Enterprise License): the Quick Slot layout and custom tools.
 *
 * - Runs only for signed-in Pro users; everyone else keeps everything in this browser as before.
 * - The first time a device syncs, its data is merged with the account's (custom tools are combined,
 *   free slots are filled) so nothing is lost. After that, a change made here wins, and other devices
 *   pick it up when they are opened or brought back to the front.
 * - Tells the page how it's going with a `quickslot:sync-status` event (shown in the account settings).
 */
import { ACCOUNT_EVENT, getUser, maybeSignedIn } from '../lib/account';
import { getPlan } from '../lib/billing';
import { CUSTOM_TOOLS_EVENT, MAX_CUSTOM_TOOLS, readCustomTools, replaceCustomTools, type CustomTool } from '../lib/customTools';
import { readSlots, replaceSlots, SLOT_COUNT, SLOTS_EVENT } from '../lib/slots';

type Key = 'slots' | 'customTools';
const ITEMS: Record<Key, { read: () => unknown[]; write: (d: unknown[]) => void; event: string }> = {
  slots: { read: readSlots, write: replaceSlots, event: SLOTS_EVENT },
  customTools: { read: readCustomTools, write: replaceCustomTools, event: CUSTOM_TOOLS_EVENT },
};
const KEYS = Object.keys(ITEMS) as Key[];

/** Status for the page: { state, at }. A 'quickslot:sync-status-request' event asks for it again. */
export const SYNC_STATUS_EVENT = 'quickslot:sync-status';
export type SyncState = 'off' | 'syncing' | 'on' | 'error';
let last: { state: SyncState; at: number } = { state: 'off', at: 0 };

/** Per device: whose data this browser holds and the versions it last saw */
const STATE_KEY = 'quickslot:sync';
interface State {
  userId: string;
  versions: Partial<Record<Key, number>>;
}
let state: State | null = null;
let active = false;
let applying = false;
const timers: Partial<Record<Key, number>> = {};
const pending = new Set<Key>();

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isEmpty = (d: unknown[]) => d.every((x) => x === null);

function status(s: SyncState) {
  last = { state: s, at: Date.now() };
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: last }));
}
function load(): State | null {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null');
  } catch {
    return null;
  }
}
function save() {
  try {
    if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STATE_KEY);
  } catch {
    /* storage unavailable: sync again from scratch next time */
  }
}
function apply(key: Key, data: unknown[]) {
  applying = true;
  try {
    ITEMS[key].write(data);
  } finally {
    applying = false;
  }
}

/** First sync of a device: keep what the account has and add what only this device has */
function merge(key: Key, server: unknown[], local: unknown[]): unknown[] {
  if (key === 'customTools') {
    const ids = new Set((server as CustomTool[]).map((t) => t.id));
    return [...server, ...(local as CustomTool[]).filter((t) => !ids.has(t.id))].slice(0, MAX_CUSTOM_TOOLS);
  }
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => (server[i] ?? null) as string | null);
  for (const slug of local as (string | null)[]) {
    if (!slug || slots.includes(slug)) continue;
    const free = slots.indexOf(null);
    if (free < 0) break;
    slots[free] = slug;
  }
  return slots;
}

async function push(key: Key, data: unknown[], baseVersion: number, retry = true): Promise<void> {
  const res = await fetch(`/api/sync/${key}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data, baseVersion }),
    credentials: 'same-origin',
  });
  if (res.ok) {
    state!.versions[key] = ((await res.json()) as { version: number }).version;
    save();
    return;
  }
  if (res.status === 409 && retry) {
    // Another device saved in between. The change made here is the newest, so it wins.
    const body = (await res.json()) as { version: number };
    return push(key, data, body.version, false);
  }
  throw new Error(`sync ${key} ${res.status}`);
}

async function pull() {
  if (!active || !state) return;
  status('syncing');
  try {
    const res = await fetch('/api/sync', { cache: 'no-store', credentials: 'same-origin' });
    if (res.status === 401 || res.status === 403) return stop();
    if (!res.ok) throw new Error(`sync ${res.status}`);
    const { items } = (await res.json()) as { items: Partial<Record<Key, { data: unknown[]; version: number }>> };
    for (const key of KEYS) {
      if (pending.has(key)) continue;
      const server = items[key];
      const local = ITEMS[key].read();
      const known = state.versions[key];
      if (!server) {
        if (!isEmpty(local) && local.length) await push(key, local, 0);
        continue;
      }
      if (known === undefined) {
        const merged = merge(key, server.data, local);
        if (!same(merged, local)) apply(key, merged);
        state.versions[key] = server.version;
        if (!same(merged, server.data)) await push(key, merged, server.version);
      } else if (server.version > known) {
        apply(key, server.data);
        state.versions[key] = server.version;
      }
    }
    save();
    status('on');
  } catch {
    status('error');
  }
}

function onChange(key: Key) {
  if (!active || applying || !state) return;
  pending.add(key);
  clearTimeout(timers[key]);
  timers[key] = window.setTimeout(async () => {
    status('syncing');
    try {
      await push(key, ITEMS[key].read(), state?.versions[key] ?? 0);
      status('on');
    } catch {
      status('error');
    } finally {
      pending.delete(key);
    }
  }, 800);
}

function stop() {
  active = false;
  status('off');
}

async function start() {
  if (!maybeSignedIn() && !state) return stop();
  let user = null;
  try {
    user = await getUser();
  } catch {
    user = null;
  }
  if (!user) {
    // Signed out: forget which account this browser was synced with (the data itself stays here)
    if (state) {
      state = null;
      save();
    }
    return stop();
  }
  if ((await getPlan())?.plan !== 'pro') return stop();
  const saved = load();
  state = saved && saved.userId === user.id ? saved : { userId: user.id, versions: {} };
  active = true;
  await pull();
}

let started = false;
export function initSync() {
  if (started) return;
  started = true;
  for (const key of KEYS) window.addEventListener(ITEMS[key].event, () => onChange(key));
  window.addEventListener(ACCOUNT_EVENT, () => start());
  window.addEventListener('quickslot:sync-status-request', () => window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: last })));
  state = load();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && pull());
  start();
}
