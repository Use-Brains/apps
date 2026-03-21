export type ThemeMode = 'light' | 'dark';

export type ThemeStyle =
  | 'parchment'
  | 'modern'
  | 'ios_glass'
  | 'high_contrast';

export type ThemePalette = 'sage' | 'gold' | 'ocean' | 'ruby' | 'slate';

export type ThemeSelection = {
  mode: ThemeMode;
  style: ThemeStyle;
  palette: ThemePalette;
};

export type ThemeColors = {
  // --- Semantic UI colors ---
  primary: string;
  primaryLight: string;
  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;

  // --- Surfaces & backgrounds ---
  background: string;
  surface: string;
  border: string;
  borderLight: string;

  // --- Text ---
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // --- Study mode ---
  studyBackground: string;
  studyText: string;

  // --- Overlays & shadows ---
  overlay: string;
  overlayHeavy: string;
  shadow: string;
  destructive: string;

  // --- Glass card ---
  glassTint: string;
  glassHighlight: string;
  glassShadow: string;

  // --- Background gradient ---
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;

  // --- Ambient orbs (glass background) ---
  orbPurple: string;
  orbBlue: string;
  orbGreen: string;

  // --- Tab bar ---
  tabBarEdge: string;
};

export type AppTheme = {
  selection: ThemeSelection;
  colors: ThemeColors;
};
