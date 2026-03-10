# Feature Brief: Theme Overhaul (Mode + Style + Palette)

## Metadata
- Date: 2026-03-10
- Owner: kashane
- Risk Lane: B
- Target platform for feature QA: iOS

## Problem
The app currently uses a single static theme token set with no user-selectable appearance options. Users cannot switch between light/dark modes, visual style families, or accent palettes to match preference and readability needs.

## User Outcome
Users can personalize app appearance by choosing:
- Main mode: `Light` or `Dark`
- Style family: `Classic`, `Modern`, `iOS Liquid Glass`, `Android Material`, and additional presets
- Color palette: selectable accent/token palette options

Selections persist across app restarts and apply consistently across app screens.

## Scope In
- Introduce a composable theme model with three layers:
  - mode (`light` | `dark`)
  - style family (e.g., `classic`, `modern`, `ios_glass`, `android_material`)
  - palette variant (e.g., `blue`, `green`, `amber`, etc.)
- Add theme state management and persistence using existing local storage patterns.
- Add settings UI controls for mode, style, and palette selection.
- Apply dynamic theme tokens across shared layout/screen/component surfaces currently using static `colors`.
- Integrate theme values into navigation containers (headers, tabs, background surfaces).
- Add accessibility guardrails for minimum contrast on text/interactive states.

## Scope Out
- Full typography system redesign beyond theme token hooks.
- Motion/animation redesign tied to each style family.
- Per-component custom overrides editor.
- Server-side sync of theme preference across devices/accounts.
- New business logic, trading calculations, or data model changes.

## Impacted Files
- `src/lib/theme.ts`
- `src/lib/mmkv.ts`
- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/settings.tsx`
- `app/(tabs)/journal/_layout.tsx`
- `src/components/TradeForm.tsx`
- `src/components/TradeCard.tsx`
- `src/components/JournalStats.tsx`
- `src/components/JournalViewTabs.tsx`
- `src/components/FilterBar.tsx`
- `src/components/TagInput.tsx`
- `src/components/PnlBadge.tsx`
- `__tests__/unit/theme.test.ts`
- `__tests__/integration/theme-settings.test.ts`

## Data/Schema/Auth Impact
- Schema changes: no
- Auth/security changes: no
- PnL/business logic changes: no

## Gate Plan
- Required lane gates:
  - [x] Feature brief complete
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] Maestro smoke flow (Lane C)
  - [ ] Manual smoke/sanity
  - [ ] Rollback steps (Lane C)
  - [ ] Human sign-off (Lane C)

## Test Plan
### Unit
- Theme composer merges mode + style + palette tokens deterministically.
- Unsupported theme keys fall back to safe defaults.
- Contrast helper validates text color against background token thresholds.
- Preference serialization/deserialization for storage remains stable.

### Integration
- Changing mode/style/palette in Settings updates visible screen tokens immediately.
- Theme preference persists after app restart and is restored on boot.
- Navigation chrome (tab/header backgrounds and text colors) updates with selected theme.

### Smoke E2E
- N/A for Lane B.

### Manual Acceptance
- User can select Light and Dark modes and see immediate global update.
- User can switch between at least 4 style families and see distinct visual changes.
- User can switch between multiple palette options and see consistent accents.
- Theme choices persist after app relaunch.
- Key screens remain readable in all shipped combinations.

## Rollback Plan
Revert the theme-overhaul commit(s) to restore static token usage from the previous single-theme implementation and remove settings toggles.

## Known Risks
- Large surface-area token migration can cause inconsistent styling if some components keep static imports.
- Some style/palette combinations may fail contrast targets without explicit accessibility checks.
- iOS/Android-specific look presets may diverge from platform expectations if not tuned on-device.

## Deferred Work
- Cloud sync of theme preferences per authenticated user.
- Additional curated style families and community/shared presets.
- Optional per-screen overrides for advanced users.
- Theme preview gallery with screenshots before apply.

## Final Behavior Deltas (Update After Implementation)
- Added a multi-layer theme engine under `src/lib/theme-system`:
  - mode (`light`/`dark`)
  - style family (`classic`, `modern`, `ios_glass`, `android_material`, `high_contrast`)
  - palette (`ocean`, `emerald`, `amber`, `ruby`, `slate`)
- Added `ThemeProvider`, `useTheme`, and `useThemedStyles` with persisted theme selection.
- Added Settings appearance controls for mode, look, and palette selection.
- Migrated app layouts, auth screens, journal screens, settings, and shared components to consume runtime theme tokens.
- Added tests:
  - `__tests__/unit/theme-composer.test.ts`
  - `__tests__/unit/theme-selection.test.ts`
  - `__tests__/integration/theme-settings.test.ts`
