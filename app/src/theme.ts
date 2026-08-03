// Green-accented palette on a white base (light default). Status stays
// distinguishable by ICON + WORD as well as colour (WCAG 1.4.1), so brand-green
// and safe-green coexist safely.
export type Palette = {
  bg: string; surface: string; surfaceAlt: string; border: string; hair: string;
  text: string; textSecondary: string; textMuted: string;
  brand: string; brandSubtle: string; onBrand: string;
  info: string;
  safe: string; safeBg: string; safeText: string;
  warn: string; warnBg: string; warnText: string;
  danger: string; dangerBg: string; dangerText: string;
  neutral: string; neutralBg: string; neutralText: string;
};

export const LIGHT: Palette = {
  bg: '#F1F4F2', surface: '#FFFFFF', surfaceAlt: '#E9EEEB', border: '#DCE3DF', hair: '#E6EBE8',
  text: '#0B1512', textSecondary: '#5A6B62', textMuted: '#8A968F',
  brand: '#16A34A', brandSubtle: '#E7F7EE', onBrand: '#FFFFFF',
  info: '#0EA5E9',
  safe: '#16A34A', safeBg: '#DCFCE7', safeText: '#15803D',
  warn: '#F59E0B', warnBg: '#FEF3C7', warnText: '#B45309',
  danger: '#EF4444', dangerBg: '#FEE2E2', dangerText: '#B91C1C',
  neutral: '#8A968F', neutralBg: '#EAEEEB', neutralText: '#5A6B62',
};

export const DARK: Palette = {
  bg: '#0A0F0D', surface: '#161C19', surfaceAlt: '#212925', border: '#2C3630', hair: '#2C3630',
  text: '#F2F5F3', textSecondary: '#A6B2AC', textMuted: '#7C8A83',
  brand: '#30B85A', brandSubtle: '#10291A', onBrand: '#FFFFFF',
  info: '#38BDF8',
  safe: '#30D158', safeBg: '#0E2A17', safeText: '#4ADE80',
  warn: '#FF9F0A', warnBg: '#2E2008', warnText: '#FFB03A',
  danger: '#FF453A', dangerBg: '#2E1310', dangerText: '#FF6B60',
  neutral: '#7C8A83', neutralBg: '#212925', neutralText: '#A6B2AC',
};

export const SUBJECT_COLORS = ['#16A34A', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444', '#6366F1'];
