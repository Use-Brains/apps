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

  // --- Trading ---
  profit: string;
  loss: string;

  // --- Overlays & shadows ---
  overlay: string;         // modal/sheet backdrop (e.g. rgba black at 0.4)
  overlayHeavy: string;    // heavier dimming (e.g. remove button bg)
  shadow: string;          // default shadow color
  destructive: string;     // system destructive action (archive/delete)

  // --- Glass card ---
  glassTint: string;       // base tint for frosted overlay (white or transparent)
  glassHighlight: string;  // top-edge refraction highlight
  glassShadow: string;     // glass card shadow color

  // --- Background gradient ---
  gradientStart: string;   // screen background gradient start
  gradientMid: string;     // screen background gradient middle
  gradientEnd: string;     // screen background gradient end

  // --- Ambient orbs (glass background) ---
  orbPurple: string;       // top-left ambient orb
  orbBlue: string;         // top-right ambient orb
  orbGreen: string;        // bottom ambient orb

  // --- Tab bar ---
  tabBarEdge: string;      // top border line on tab bar
};

export type AppTheme = {
  selection: ThemeSelection;
  colors: ThemeColors;
};
