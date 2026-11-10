/**
 * File converter: turns a file into another format by actually converting its content.
 *
 * Safety rules:
 * - The source format is read from the file's bytes, never trusted from its extension.
 * - If the source and target are the same format, the file is only renamed (no re-encoding,
 *   so no quality loss). Example: photo.jpeg → photo.jpg.
 * - Otherwise the content is converted, so the new extension always matches what's inside.
 * - Combinations that can't be converted are refused instead of producing a mislabeled file.
 */
import { convertData } from './data';
import { FORMATS, TARGETS, type FormatId } from './formats';
import { convertImage, type ImageOptions } from './image';
import { convertMedia, type MediaQuality } from './media';

export * from './formats';
export type { ImageOptions, MediaQuality };
export { DataError } from './data';
export { loadFFmpeg } from './media';

export interface ConvertOptions {
  image: ImageOptions;
  media: MediaQuality;
}

export interface ConvertResult {
  blob: Blob;
  name: string;
  /** true when the format already matched and the file was only renamed */
  renamed: boolean;
}

const baseName = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

export function canConvert(source: FormatId, target: FormatId): boolean {
  return source === target || TARGETS[FORMATS[source].kind].includes(target);
}

/** Whether this conversion needs the large audio/video engine */
export const needsMediaEngine = (source: FormatId, target: FormatId) =>
  source !== target && (FORMATS[source].kind === 'audio' || FORMATS[source].kind === 'video');

export async function convertFile(
  file: File,
  source: FormatId,
  target: FormatId,
  opts: ConvertOptions,
  onProgress?: (ratio: number) => void,
  onEngineDownload?: (ratio: number) => void,
): Promise<ConvertResult> {
  const t = FORMATS[target];
  const name = `${baseName(file.name)}.${t.exts[0]}`;

  if (source === target) return { blob: file, name, renamed: true };
  if (!canConvert(source, target)) throw new Error('encode-unsupported');

  const kind = FORMATS[source].kind;
  let blob: Blob;
  if (kind === 'image') blob = await convertImage(file, source, target, opts.image);
  else if (kind === 'data') blob = await convertData(file, source, target, t.mime);
  else blob = await convertMedia(file, FORMATS[source].exts[0], target, t.exts[0], opts.media, t.mime, onProgress, onEngineDownload);

  onProgress?.(1);
  return { blob, name, renamed: false };
}
