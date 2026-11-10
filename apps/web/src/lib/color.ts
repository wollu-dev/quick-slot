/**
 * Color math for the color converter. Colors are sRGB.
 * RGB channels are 0–255, alpha 0–1, hue 0–360, saturation / lightness / value 0–1.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}
export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255), a };
}

/** `hue` is kept when the color is gray (where hue is undefined), so dragging stays smooth */
export function rgbToHsv({ r, g, b, a }: Rgba, hue = 0): Hsva {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = hue;
  if (d) {
    if (max === R) h = 60 * (((G - B) / d + 6) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  return { h, s: max ? d / max : 0, v: max, a };
}

export function rgbToHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const { h, s: sv, v } = rgbToHsv({ r, g, b, a: 1 });
  const l = v * (1 - sv / 2);
  const s = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number, a: number): Rgba {
  const v = l + s * Math.min(l, 1 - l);
  return hsvToRgb({ h, s: v ? 2 * (1 - l / v) : 0, v, a });
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');
export const toHex = ({ r, g, b }: Rgba) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();
export const toHex8 = (c: Rgba) => `${toHex(c)}${hex2(c.a * 255).toUpperCase()}`;

/** sRGB channel (0–1) to linear light, as game engines use for lighting */
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance and contrast ratio */
const luminance = ({ r, g, b }: Rgba) => 0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255);
export function contrast(a: Rgba, b: Rgba): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** A number in a color function: "50%" → 0.5 × scale, "128" → 128, "0.5" → 0.5 */
function num(token: string, percentScale: number): number {
  const t = token.trim();
  if (t.endsWith('%')) return (parseFloat(t) / 100) * percentScale;
  return parseFloat(t);
}

/**
 * Reads the color formats people copy around: #RGB, #RGBA, #RRGGBB, #RRGGBBAA (with or without #),
 * rgb()/rgba(), hsl()/hsla(), hsv(), comma or space separated, and plain "r, g, b[, a]" (0–255).
 * Unity / Unreal style floats like "Color(0.2, 0.4, 0.6, 1)" are read as 0–1 values.
 * Returns null when it can't read the input.
 */
export function parseColor(input: string): Rgba | null {
  // "new Color(…)" as written in C#
  const s = input.trim().toLowerCase().replace(/^new\s+/, '');
  if (!s) return null;

  const hex = s.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1 };
  }

  const fn = s.match(/^([a-z0-9_:]*)\s*\(([^)]*)\)\s*;?$/);
  const name = fn ? fn[1] : '';
  const body = (fn ? fn[2] : s).replace(/\bf\b|(?<=\d)f/g, '');
  const parts = body.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const alpha = parts[3] !== undefined ? round3(clamp(num(parts[3], 1), 0, 1)) : 1;
  if (parts.some((p) => Number.isNaN(parseFloat(p)))) return null;

  if (name.startsWith('hsl')) {
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
    return hslToRgb(h, clamp(num(parts[1], 1), 0, 1), clamp(num(parts[2], 1), 0, 1), alpha);
  }
  if (name.startsWith('hsv') || name.startsWith('hsb')) {
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
    return hsvToRgb({ h, s: clamp(num(parts[1], 1), 0, 1), v: clamp(num(parts[2], 1), 0, 1), a: alpha });
  }
  const raw = parts.map((p) => parseFloat(p));
  const byte = (v: number) => clamp(Math.round(v), 0, 255);
  const fromBytes = (alphaIsByte: boolean): Rgba => ({
    r: byte(num(parts[0], 255)),
    g: byte(num(parts[1], 255)),
    b: byte(num(parts[2], 255)),
    a: parts[3] === undefined ? 1 : alphaIsByte ? round3(clamp(raw[3] / 255, 0, 1)) : alpha,
  });
  const fromFloats = (linear: boolean): Rgba => {
    const conv = (c: number) => (linear ? linearToSrgb(clamp(c, 0, 1)) : clamp(c, 0, 1));
    return { r: byte(conv(raw[0]) * 255), g: byte(conv(raw[1]) * 255), b: byte(conv(raw[2]) * 255), a: alpha };
  };

  // Unreal FLinearColor: linear light floats
  if (name.includes('linearcolor')) return fromFloats(true);
  // Unity Color32, Unreal FColor: bytes, alpha too
  if (name === 'color32' || name.endsWith('fcolor')) return fromBytes(true);
  // Unity / Godot Color: sRGB floats 0–1
  if (name.endsWith('color')) return fromFloats(false);
  // CSS rgb() / rgba(): bytes or percentages, alpha 0–1
  if (name.startsWith('rgb')) return fromBytes(false);
  if (name) return null;
  // Bare numbers: floats when all are 0–1 and written with a decimal point, otherwise bytes
  const floats = raw.slice(0, 3).every((v) => v <= 1) && parts.slice(0, 3).some((p) => p.includes('.'));
  return floats ? fromFloats(false) : fromBytes(raw[3] !== undefined && raw[3] > 1);
}

/** Linear light back to an sRGB channel (0–1) */
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
