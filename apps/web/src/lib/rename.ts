import { splitName } from './files';

/** File renaming rules, shared by Batch Rename and the File Refinery */

export type CaseMode = 'none' | 'lower' | 'upper';

export interface RenameOptions {
  find: string;
  replace: string;
  useRegex: boolean;
  ignoreCase: boolean;
  /** {name} = name after find and replace, {n} = running number, {date} = YYYYMMDD of `date` */
  pattern: string;
  start: number;
  pad: number;
  caseMode: CaseMode;
  spaceToUnderscore: boolean;
  extLower: boolean;
}

export const RENAME_DEFAULTS: RenameOptions = {
  find: '',
  replace: '',
  useRegex: false,
  ignoreCase: false,
  pattern: '{name}',
  start: 1,
  pad: 3,
  caseMode: 'none',
  spaceToUnderscore: false,
  extLower: false,
};

/** Characters Windows doesn't allow in file names */
export const INVALID_NAME = /[\\/:*?"<>|]/;

const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/**
 * The new name of the `index`-th file. A bad regular expression is reported as `regexError`
 * (the engine's message) and the name is left unchanged.
 */
export function buildName(fileName: string, index: number, o: RenameOptions, date?: Date): { name: string; regexError?: string } {
  const { base, ext } = splitName(fileName);
  let b = base;
  if (o.find) {
    try {
      const re = o.useRegex
        ? new RegExp(o.find, o.ignoreCase ? 'gi' : 'g')
        : new RegExp(o.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.ignoreCase ? 'gi' : 'g');
      b = b.replace(re, o.replace);
    } catch (e) {
      return { name: fileName, regexError: (e as Error).message };
    }
  }
  const n = String(o.start + index).padStart(Math.max(0, o.pad), '0');
  b = (o.pattern || '{name}')
    .replaceAll('{name}', b)
    .replaceAll('{n}', n)
    .replaceAll('{date}', date ? ymd(date) : '');
  if (o.caseMode === 'lower') b = b.toLowerCase();
  if (o.caseMode === 'upper') b = b.toUpperCase();
  if (o.spaceToUnderscore) b = b.replace(/\s+/g, '_');
  const e = o.extLower ? ext.toLowerCase() : ext;
  return { name: e ? `${b}.${e}` : b };
}
