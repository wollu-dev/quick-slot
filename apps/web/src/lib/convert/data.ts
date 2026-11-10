/**
 * Conversion between data formats: JSON, YAML, CSV, TSV and XML.
 * Each source is parsed into plain JavaScript values, then written out in the target format.
 * The parsing libraries are loaded only when a data file is converted.
 */
import type { FormatId } from './formats';

/** Thrown with a code the UI translates */
export class DataError extends Error {
  code: 'parse' | 'data-not-tabular';
  constructor(code: 'parse' | 'data-not-tabular', detail?: string) {
    super(detail ?? code);
    this.code = code;
    this.name = 'DataError';
  }
}

const XML_OPTIONS = { ignoreAttributes: false, attributeNamePrefix: '@_', format: true, indentBy: '  ' };

async function parse(text: string, source: FormatId): Promise<unknown> {
  try {
    switch (source) {
      case 'json':
        return JSON.parse(text);
      case 'yaml': {
        const YAML = await import('yaml');
        return YAML.parse(text);
      }
      case 'csv':
      case 'tsv': {
        const Papa = (await import('papaparse')).default;
        const r = Papa.parse<Record<string, unknown>>(text.replace(/^﻿/, ''), {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          delimiter: source === 'tsv' ? '\t' : '',
        });
        if (r.errors.length && !r.data.length) throw new Error(r.errors[0].message);
        return r.data;
      }
      case 'xml': {
        const { XMLParser, XMLValidator } = await import('fast-xml-parser');
        const valid = XMLValidator.validate(text);
        if (valid !== true) throw new Error(valid.err.msg);
        // Drop the <?xml ...?> declaration so it doesn't show up as a data key
        return new XMLParser({ ...XML_OPTIONS, ignoreDeclaration: true, ignorePiTags: true }).parse(text);
      }
    }
  } catch (e) {
    throw new DataError('parse', (e as Error).message);
  }
  throw new DataError('parse');
}

/** Flatten nested objects into "a.b" keys so they fit in table columns; arrays become JSON text */
function flatten(obj: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Rows for CSV/TSV: an array of objects or plain values. Single-key wrappers are unwrapped first,
 * so { users: [...] } and XML like <library><book/><book/></library> ({ library: { book: [...] } })
 * work too. Anything else is refused rather than silently dropping the other keys.
 */
function toRows(value: unknown): Record<string, unknown>[] {
  let list = value;
  for (let depth = 0; depth < 5 && isPlainObject(list); depth++) {
    const values = Object.values(list);
    if (values.length !== 1) break;
    list = values[0];
  }
  if (!Array.isArray(list)) throw new DataError('data-not-tabular');
  return list.map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? flatten(item as Record<string, unknown>) : { value: item }));
}

async function serialize(value: unknown, target: FormatId): Promise<string> {
  switch (target) {
    case 'json':
      return JSON.stringify(value, null, 2) + '\n';
    case 'yaml': {
      const YAML = await import('yaml');
      return YAML.stringify(value);
    }
    case 'csv':
    case 'tsv': {
      const Papa = (await import('papaparse')).default;
      const rows = toRows(value);
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      return Papa.unparse(rows, { columns, delimiter: target === 'tsv' ? '\t' : ',' }) + '\n';
    }
    case 'xml': {
      const { XMLBuilder } = await import('fast-xml-parser');
      // XML needs a single root element
      const isSingleRoot = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1;
      const root = isSingleRoot ? value : { root: Array.isArray(value) ? { item: value } : value };
      return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLBuilder(XML_OPTIONS).build(root);
    }
  }
  throw new DataError('parse');
}

export async function convertData(file: Blob, source: FormatId, target: FormatId, mime: string): Promise<Blob> {
  const value = await parse(await file.text(), source);
  const text = await serialize(value, target);
  // CSV/TSV get a BOM so Excel opens non-ASCII text (Korean, Japanese) correctly
  const bom = target === 'csv' || target === 'tsv' ? '﻿' : '';
  return new Blob([bom + text], { type: `${mime};charset=utf-8` });
}
