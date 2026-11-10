/**
 * Unit tables for the unit converter. Each unit converts to and from its category's base unit.
 * Names live in the i18n dictionaries (unitConv.names), keyed by the unit id; symbols are shown as is.
 */

export type CategoryId = 'length' | 'weight' | 'area' | 'volume' | 'temperature' | 'speed' | 'data';

export interface Unit {
  id: string;
  symbol: string;
  /** Value of 1 of this unit in the base unit (linear units) */
  factor?: number;
  /** Non-linear units (temperature) */
  toBase?: (v: number) => number;
  fromBase?: (v: number) => number;
}

export interface Category {
  id: CategoryId;
  units: Unit[];
  /** Unit selected when the category is opened */
  defaultUnit: string;
}

const u = (id: string, symbol: string, factor: number): Unit => ({ id, symbol, factor });

export const CATEGORIES: Category[] = [
  {
    id: 'length',
    defaultUnit: 'm',
    units: [
      u('mm', 'mm', 0.001),
      u('cm', 'cm', 0.01),
      u('m', 'm', 1),
      u('km', 'km', 1000),
      u('in', 'in', 0.0254),
      u('ft', 'ft', 0.3048),
      u('yd', 'yd', 0.9144),
      u('mi', 'mi', 1609.344),
      u('nmi', 'nmi', 1852),
      // Traditional unit used in Korea and Japan: 1 ja / shaku = 10/33 m
      u('ja', '자 · 尺', 10 / 33),
    ],
  },
  {
    id: 'weight',
    defaultUnit: 'kg',
    units: [
      u('mg', 'mg', 0.000001),
      u('g', 'g', 0.001),
      u('kg', 'kg', 1),
      u('t', 't', 1000),
      u('oz', 'oz', 0.028349523125),
      u('lb', 'lb', 0.45359237),
      u('st', 'st', 6.35029318),
      // Korea / Japan: 1 geun / kin = 600 g (meat), 1 don / monme = 3.75 g (gold), 1 nyang = 37.5 g
      u('geun', '근 · 斤', 0.6),
      u('don', '돈 · 匁', 0.00375),
      u('nyang', '냥', 0.0375),
    ],
  },
  {
    id: 'area',
    defaultUnit: 'm2',
    units: [
      u('cm2', 'cm²', 0.0001),
      u('m2', 'm²', 1),
      u('km2', 'km²', 1_000_000),
      u('a', 'a', 100),
      u('ha', 'ha', 10_000),
      u('ft2', 'ft²', 0.09290304),
      u('yd2', 'yd²', 0.83612736),
      u('acre', 'ac', 4046.8564224),
      // Korea / Japan: 1 pyeong / tsubo = 400/121 m² (about 3.3058 m²)
      u('pyeong', '평 · 坪', 400 / 121),
    ],
  },
  {
    id: 'volume',
    defaultUnit: 'l',
    units: [
      u('ml', 'mL', 0.001),
      u('l', 'L', 1),
      u('m3', 'm³', 1000),
      u('tsp', 'tsp', 0.00492892159375),
      u('tbsp', 'tbsp', 0.01478676478125),
      u('floz', 'fl oz', 0.0295735295625),
      u('cup', 'cup', 0.2365882365),
      u('pt', 'pt', 0.473176473),
      u('gal', 'gal', 3.785411784),
      u('galuk', 'gal (UK)', 4.54609),
    ],
  },
  {
    id: 'temperature',
    defaultUnit: 'c',
    units: [
      { id: 'c', symbol: '°C', toBase: (v) => v, fromBase: (v) => v },
      { id: 'f', symbol: '°F', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      { id: 'k', symbol: 'K', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
  {
    id: 'speed',
    defaultUnit: 'kmh',
    units: [u('ms', 'm/s', 1), u('kmh', 'km/h', 1 / 3.6), u('mph', 'mph', 0.44704), u('kn', 'kn', 1852 / 3600), u('fts', 'ft/s', 0.3048)],
  },
  {
    id: 'data',
    defaultUnit: 'mb',
    units: [
      u('bit', 'bit', 1 / 8),
      u('b', 'B', 1),
      u('kb', 'KB', 1e3),
      u('mb', 'MB', 1e6),
      u('gb', 'GB', 1e9),
      u('tb', 'TB', 1e12),
      u('kib', 'KiB', 1024),
      u('mib', 'MiB', 1024 ** 2),
      u('gib', 'GiB', 1024 ** 3),
      u('tib', 'TiB', 1024 ** 4),
    ],
  },
];

export const getCategory = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

export function convert(value: number, from: Unit, to: Unit): number {
  const base = from.toBase ? from.toBase(value) : value * from.factor!;
  return to.fromBase ? to.fromBase(base) : base / to.factor!;
}

/** Lowest valid value per category, if there is one (absolute zero for temperature) */
export function belowMinimum(category: CategoryId, value: number, unit: Unit): boolean {
  if (category === 'temperature') return (unit.toBase ? unit.toBase(value) : value) < -273.15 - 1e-9;
  return value < 0;
}

/** Reads user input: spaces and thousands separators are ignored, exponents like 1e6 are fine */
export function parseNumber(input: string): number | null {
  const s = input.replace(/[\s,_]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Rounds away floating point noise (0.30000000000000004 → 0.3) keeping 12 significant digits */
export const clean = (n: number) => (n === 0 ? 0 : Number(n.toPrecision(12)));
