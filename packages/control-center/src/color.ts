import { canonicalizeColor } from '../../colors/src';

const numeric = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/;

function number(value: string, scale: number, percentOnly = false): number | undefined {
  const percent = value.endsWith('%');
  const raw = percent ? value.slice(0, -1) : value;
  if ((percentOnly && !percent) || !numeric.test(raw)) return undefined;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0 || amount > (percent ? 100 : scale)) return undefined;
  return percent ? (amount / 100) * scale : amount;
}

function hex(channels: readonly number[]): string {
  return (
    '#' +
    channels
      .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function fromHsl(hue: number, saturation: number, lightness: number): readonly number[] {
  const h = (((hue % 360) + 360) % 360) / 60;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs((h % 2) - 1));
  const intercept = lightness - chroma / 2;
  const sectors = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ];
  return (sectors[Math.floor(h)] ?? sectors[0] ?? []).map(
    (component) => (component + intercept) * 255,
  );
}

/** Accepts opaque CSS HEX, RGB or HSL. The canonical value is safe in native settings and the DOM. */
export function parseColor(value: string): string | undefined {
  const input = value.trim();
  const normalized = canonicalizeColor(input);
  if (normalized) return normalized;
  if (input.length > 80) return undefined;
  const match = /^(rgb|hsl)\(\s*(.*?)\s*\)$/i.exec(input);
  if (!match?.[2]) return undefined;
  const pieces = match[2].includes(',') ? match[2].split(/\s*,\s*/) : match[2].split(/\s+/);
  const [first, second, third] = pieces;
  if (pieces.length !== 3 || !first || !second || !third) return undefined;
  if (match[1]?.toLowerCase() === 'rgb') {
    const a = number(first, 255);
    const b = number(second, 255);
    const c = number(third, 255);
    return a === undefined || b === undefined || c === undefined ? undefined : hex([a, b, c]);
  }
  const hue = first.replace(/deg$/i, '');
  if (!numeric.test(hue) || !Number.isFinite(Number(hue))) return undefined;
  const saturation = number(second, 1, true);
  const lightness = number(third, 1, true);
  return saturation === undefined || lightness === undefined
    ? undefined
    : hex(fromHsl(Number(hue), saturation, lightness));
}

function luminance(color: string): number {
  const linear = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
