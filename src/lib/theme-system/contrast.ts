import type { ThemeColors, ThemeMode } from './types';

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace('#', '');
  const isShort = normalized.length === 3;
  const isLong = normalized.length === 6;

  if (!isShort && !isLong) return null;

  const chars = isShort
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized;

  const int = Number.parseInt(chars, 16);
  if (Number.isNaN(int)) return null;

  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(foreground: string, background: string): number {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  if (!fg || !bg) return Number.POSITIVE_INFINITY;

  const fgLum = relativeLuminance(fg);
  const bgLum = relativeLuminance(bg);

  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);

  return (lighter + 0.05) / (darker + 0.05);
}

export function ensureAccessibleText(colors: ThemeColors, mode: ThemeMode): ThemeColors {
  const minRatio = 4.5;
  const ratio = contrastRatio(colors.text, colors.background);

  if (ratio >= minRatio) {
    return colors;
  }

  return {
    ...colors,
    text: mode === 'dark' ? '#F8FAFC' : '#0F172A',
    textSecondary: mode === 'dark' ? '#CBD5E1' : '#475569',
    textTertiary: mode === 'dark' ? '#94A3B8' : '#64748B',
  };
}

export function getContrastRatio(foreground: string, background: string): number {
  return contrastRatio(foreground, background);
}
