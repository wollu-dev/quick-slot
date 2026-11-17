/**
 * Unicode normalization for file names and text. macOS stores Korean file names decomposed (NFD:
 * ᄒ+ᅡ+ᆫ), which Windows and many web services show as separated letters (ㅎㅏㄴ). NFC composes them.
 */

export type Form = 'NFC' | 'NFD' | 'NFKC' | 'NFKD';

export const needsNfc = (s: string) => s !== s.normalize('NFC');

let graphemes: Intl.Segmenter | undefined;
/**
 * Number of visible characters that change when the text is converted. Counting per grapheme keeps a
 * syllable written as three jamo (or a letter plus an accent) as one character.
 */
export function changedCount(text: string, form: Form): number {
  if (text === text.normalize(form)) return 0;
  graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let n = 0;
  for (const { segment } of graphemes.segment(text)) if (segment !== segment.normalize(form)) n++;
  return n;
}

// Conjoining jamo (U+1100…) → compatibility jamo (U+3131…), which is how a system that doesn't
// compose them shows the letters
const LEAD = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWEL = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const TAIL = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

/** How a decomposed Korean name looks where jamo aren't combined: "한글" in NFD → "ㅎㅏㄴㄱㅡㄹ" */
export function asSeparated(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x1100 && c <= 0x1112) out += LEAD[c - 0x1100];
    else if (c >= 0x1161 && c <= 0x1175) out += VOWEL[c - 0x1161];
    else if (c >= 0x11a8 && c <= 0x11c2) out += TAIL[c - 0x11a8];
    else out += ch;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Renaming inside a folder (File System Access API)                   */
/* ------------------------------------------------------------------ */

export interface RenameItem {
  /** Folder that holds the entry */
  parent: FileSystemDirectoryHandle;
  handle: FileSystemHandle;
  /** Path from the chosen folder, as it is now */
  path: string;
  from: string;
  to: string;
  depth: number;
}

export type RenameOutcome = 'renamed' | 'conflict' | 'failed';

/** Every entry under `root` whose name is not NFC, deepest first (children before their folders) */
export async function scanFolder(root: FileSystemDirectoryHandle): Promise<RenameItem[]> {
  const out: RenameItem[] = [];
  const walk = async (dir: FileSystemDirectoryHandle, prefix: string, depth: number) => {
    for await (const [name, handle] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') await walk(handle as FileSystemDirectoryHandle, path, depth + 1);
      if (needsNfc(name)) out.push({ parent: dir, handle, path, from: name, to: name.normalize('NFC'), depth });
    }
  };
  await walk(root, '', 0);
  return out.sort((a, b) => b.depth - a.depth);
}

type Movable = FileSystemHandle & { move?: (a: string | FileSystemDirectoryHandle, b?: string) => Promise<void> };

const entriesOf = (dir: FileSystemDirectoryHandle) => (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries();

/** Copies a file into `dir` under `name` */
async function copyFile(file: FileSystemFileHandle, dir: FileSystemDirectoryHandle, name: string) {
  const data = await file.getFile();
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(data);
  await w.close();
}

/** Copies a folder's contents into `target`, moving files where the browser can */
async function copyInto(from: FileSystemDirectoryHandle, target: FileSystemDirectoryHandle) {
  for await (const [name, h] of entriesOf(from)) {
    if (h.kind === 'directory') await copyInto(h as FileSystemDirectoryHandle, await target.getDirectoryHandle(name, { create: true }));
    else if ((h as Movable).move) await (h as Movable).move!(target, name);
    else await copyFile(h as FileSystemFileHandle, target, name);
  }
}

async function exists(dir: FileSystemDirectoryHandle, name: string, kind: FileSystemHandleKind): Promise<FileSystemHandle | null> {
  try {
    return kind === 'file' ? await dir.getFileHandle(name) : await dir.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

/**
 * Renames one entry to its NFC name. Uses handle.move() where the browser supports it for that kind of
 * entry; otherwise the entry is copied to the new name and the old one removed. An existing, different
 * entry that already has the new name is left alone.
 */
export async function renameItem(it: RenameItem): Promise<RenameOutcome> {
  const other = await exists(it.parent, it.to, it.handle.kind);
  // Some file systems treat both spellings as the same name: then it's the same entry, not a conflict
  if (other && !(await other.isSameEntry(it.handle))) return 'conflict';
  try {
    const h = it.handle as Movable;
    if (h.move) {
      try {
        await h.move(it.to);
        return 'renamed';
      } catch {
        // e.g. folders can't be moved in some browsers: fall back to copying
      }
    }
    if (it.handle.kind === 'file') await copyFile(it.handle as FileSystemFileHandle, it.parent, it.to);
    else await copyInto(it.handle as FileSystemDirectoryHandle, await it.parent.getDirectoryHandle(it.to, { create: true }));
    await it.parent.removeEntry(it.from, { recursive: true });
    return 'renamed';
  } catch {
    return 'failed';
  }
}
