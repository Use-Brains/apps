/**
 * withAlpha — apply an alpha channel to a hex color string.
 *
 * Usage:
 *   withAlpha('#FF0000', 0.5)  → 'rgba(255,0,0,0.5)'
 *   withAlpha('#F00', 0.5)     → 'rgba(255,0,0,0.5)'
 *
 * Components should NEVER hardcode rgba() strings. Instead:
 *   backgroundColor: withAlpha(colors.danger, 0.4)
 */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.trim().replace('#', '');
  const isShort = normalized.length === 3;
  const chars = isShort
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized.slice(0, 6);

  const int = Number.parseInt(chars, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r},${g},${b},${alpha})`;
}
