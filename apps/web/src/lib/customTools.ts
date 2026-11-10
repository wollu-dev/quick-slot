/**
 * Custom tools: links to external websites that the user adds as their own tools.
 * Stored only in this browser (localStorage). QuickSlot never loads anything from these sites
 * (no favicons, no previews); they are opened in a new tab only after the external-tool warning.
 */
import { useEffect, useState } from 'react';
import { removeFromSlots } from './slots';

export interface CustomTool {
  /** Random id. In Quick Slots the tool is stored as `custom:<id>` */
  id: string;
  name: string;
  /** Always an http(s) URL (checked by normalizeUrl) */
  url: string;
  /** Index into CUSTOM_COLORS */
  color: number;
  /** The user chose "don't warn me again" for this tool */
  trusted?: boolean;
}

export const MAX_CUSTOM_TOOLS = 50;
export const MAX_NAME_LENGTH = 40;
export const SLOT_PREFIX = 'custom:';

const KEY = 'quickslot:custom-tools';
const EVENT = 'quickslot:custom-tools-changed';

export const slotIdOf = (tool: CustomTool) => SLOT_PREFIX + tool.id;
export const isCustomSlot = (slug: string) => slug.startsWith(SLOT_PREFIX);

/**
 * Turns what the user typed into a safe URL, or null.
 * Only http and https are allowed (never javascript:, data:, file: …). A missing scheme means https.
 */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.href;
  } catch {
    return null;
  }
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

function isValid(x: unknown): x is CustomTool {
  if (!x || typeof x !== 'object') return false;
  const t = x as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.name === 'string' && typeof t.url === 'string' && normalizeUrl(t.url) === t.url;
}

export function readCustomTools(): CustomTool[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (Array.isArray(raw)) return raw.filter(isValid).map((t) => ({ ...t, color: Number(t.color) || 0 }));
  } catch {
    /* Storage unavailable or broken value */
  }
  return [];
}

function write(list: CustomTool[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* Storage unavailable: applies to this page only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: list }));
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** Adds a tool. Returns false when the list is full */
export function addCustomTool(tool: Omit<CustomTool, 'id'>): CustomTool | null {
  const list = readCustomTools();
  if (list.length >= MAX_CUSTOM_TOOLS) return null;
  const created = { ...tool, id: newId() };
  write([...list, created]);
  return created;
}

export function updateCustomTool(id: string, patch: Partial<Omit<CustomTool, 'id'>>) {
  write(readCustomTools().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function removeCustomTool(id: string) {
  write(readCustomTools().filter((t) => t.id !== id));
  removeFromSlots(SLOT_PREFIX + id);
}

export const getCustomTool = (slotId: string, list = readCustomTools()) =>
  isCustomSlot(slotId) ? list.find((t) => t.id === slotId.slice(SLOT_PREFIX.length)) : undefined;

export function useCustomTools() {
  const [list, setList] = useState<CustomTool[]>([]);
  useEffect(() => {
    setList(readCustomTools());
    const onChange = (e: Event) => setList((e as CustomEvent).detail);
    const onStorage = (e: StorageEvent) => e.key === KEY && setList(readCustomTools());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return list;
}

/** Opens the tool in a new tab without giving the external site access to this page or the referrer */
export function launchCustomTool(tool: CustomTool) {
  window.open(tool.url, '_blank', 'noopener,noreferrer');
}
