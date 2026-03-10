export type ThemeMode = 'light' | 'dark';

export type ThemeStyle =
  | 'classic'
  | 'modern'
  | 'ios_glass'
  | 'android_material'
  | 'high_contrast';

export type ThemePalette = 'ocean' | 'emerald' | 'amber' | 'ruby' | 'slate';

export type ThemeSelection = {
  mode: ThemeMode;
  style: ThemeStyle;
  palette: ThemePalette;
};

export type ThemeColors = {
  primary: string;
  primaryLight: string;
  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  background: string;
  surface: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  profit: string;
  loss: string;
};

export type AppTheme = {
  selection: ThemeSelection;
  colors: ThemeColors;
};
