---
title: feat: Multi-Layer Theme Overhaul (Mode, Style, Palette)
type: feat
status: active
date: 2026-03-10
feature_brief: docs/feature-briefs/2026-03-10-theme-overhaul-multi-mode-style-palette.md
risk_lane: B
---

# feat: Multi-Layer Theme Overhaul (Mode, Style, Palette)

## Overview

Implement a composable theming architecture that supports:
- Light and Dark modes
- Multiple visual style families (Classic, Modern, iOS Liquid Glass, Android Material, plus extensible presets)
- Multiple color palette variants

The implementation must apply globally across navigation and screen/component surfaces, persist user selections across app restarts, and maintain readable contrast.

## Problem Statement / Motivation

The current app uses static color tokens from a single exported object in `src/lib/theme.ts`, with direct imports throughout screens and components. This blocks user personalization and creates a maintenance bottleneck for a broad visual overhaul.

Primary pain points:
- No appearance customization in Settings
- No dynamic mode support (light/dark)
- No style families or palette variants
- Token changes require manual edits and risk inconsistent surfaces

## Research Findings

### Brainstorm Check

- No relevant brainstorm docs found in `docs/brainstorms/` (directory currently absent).

### Local Repo Context (Primary)

- Static theme tokens are centralized in [src/lib/theme.ts](/Users/kashane/app-dev/trade-journal/src/lib/theme.ts:1).
- Theme tokens are imported directly in many UI files via `from '@/lib/theme'` across `app/` and `src/components/`.
- Root, tabs, auth, and journal layouts all consume static color tokens:
  - [app/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/_layout.tsx:8)
  - [app/(tabs)/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/(tabs)/_layout.tsx:2)
  - [app/(auth)/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/(auth)/_layout.tsx:2)
  - [app/(tabs)/journal/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/(tabs)/journal/_layout.tsx:3)
- Settings screen is the natural control surface for theme preferences:
  - [app/(tabs)/settings.tsx](/Users/kashane/app-dev/trade-journal/app/(tabs)/settings.tsx:16)
- Existing local persistence is available through MMKV/SecureStore hybrid adapter:
  - [src/lib/mmkv.ts](/Users/kashane/app-dev/trade-journal/src/lib/mmkv.ts:84)
- Lane verification scripts already exist:
  - [package.json](/Users/kashane/app-dev/trade-journal/package.json:16)

### Institutional Learnings

- No `docs/solutions/` entries currently exist to apply.

### External Reference Research (2026-03-10)

This plan is now grounded in official platform guidance and implementation patterns from mature theming systems.

- Apple:
  - `Liquid Glass` overview (provided): `https://developer.apple.com/documentation/technologyoverviews/liquid-glass`
  - Apple platform design announcement with Liquid Glass behavior and control hierarchy updates: `https://www.apple.com/la/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/`
- Android:
  - Look and feel overview: `https://developer.android.com/develop/ui/views/theming/look-and-feel`
  - Dark theme behavior: `https://developer.android.com/develop/ui/views/theming/darktheme`
  - Dynamic color and harmonization: `https://developer.android.com/develop/ui/views/theming/dynamic-colors`
- Reference implementations and token systems:
  - Ionic theming and mode docs (`ios`/`md`, CSS variable architecture): `https://ionicframework.jp/docs/v7/theming/platform-styles`, `https://ionicframework.com/docs/theming/css-variables`, `https://ionicframework.com/docs/theming/dark-mode`
  - Konsta UI iOS/Material switching and theme provider: `https://konstaui.com/docs/theme`, `https://konstaui.com/docs/react/theme-provider`
  - Radix Themes appearance and high-contrast props: `https://www.radix-ui.com/themes/docs/components/theme`, `https://www.radix-ui.com/themes/docs/theme/color`
  - iTwinUI ThemeProvider and variable package guidance: `https://www.npmjs.com/package/@itwin/itwinui-react`, `https://www.npmjs.com/package/@itwin/itwinui-variables`
  - Tailwind multi-theme variable generation patterns: `https://github.com/L-Blondy/tw-colors`

Inferred translation to this React Native app:
- Use class/attribute-style mode switching concepts from Ionic/Konsta/tw-colors, adapted as `themeSelection` state and semantic token composition in JS.
- Use Radix-style separation between foundation scales and semantic roles.
- Use iTwin-style high-contrast mode as a first-class variant with explicit overrides, not ad hoc color tweaks.
- Use Android dynamic color principles for optional future palette generation and brand harmonization.

## Proposed Solution

Build a layered theme system and migrate UI consumers incrementally.

### Theme Architecture

Create three composable layers:
1. `modeTokens`: core semantic colors for `light` and `dark`
2. `styleOverrides`: surface/border/elevation/shape nuances (`classic`, `modern`, `ios_glass`, `android_material`, etc.)
3. `paletteOverrides`: brand/accent semantic colors (primary/success/warning/danger and derived light variants)

Final theme is computed as:

```ts
// src/lib/theme/theme-composer.ts
finalTheme = composeTheme(mode, style, palette);
```

### Runtime Model

- Introduce `ThemeProvider` with `useTheme()` hook.
- Provider owns:
  - current selection `{ mode, style, palette }`
  - computed tokens
  - setter actions for each preference
- Persist selection through `storage` from `src/lib/mmkv.ts`.
- Hydrate selection early in app startup and apply default fallback if missing/corrupt.

### Migration Strategy

- Split theme module into smaller files to honor file-size constraints from [CLAUDE.md](/Users/kashane/app-dev/trade-journal/CLAUDE.md:53).
- Keep typography/spacing/radius mostly static and reusable.
- Migrate highest-impact surfaces first:
  - app root/layout chrome
  - settings screen
  - journal and trade detail surfaces
  - form and card primitives
- Replace direct `colors` imports with runtime `const { colors } = useTheme()`.

### Settings UI

Add an `Appearance` section in Settings with segmented/select controls:
- Mode: Light / Dark
- Style: Classic / Modern / iOS Liquid Glass / Android Material / High Contrast
- Palette: predefined palette options

Use instant preview-on-change and persisted state.

### Accessibility Guardrails

- Add a contrast utility and unit tests for key semantic combinations.
- Enforce readable text on background/surface for each shipped mode/style/palette permutation.
- Provide a safe fallback when a computed combo violates minimum threshold.

## Reference-Driven Design Decisions

### 1) Token Hierarchy (Radix + iTwin Pattern)

Define three token layers and keep them separate:

1. Foundation tokens
- Raw primitives (color ramps, radii, elevation levels, blur intensity, opacity levels)
- Example files:
  - `src/lib/theme/foundation/colors.ts`
  - `src/lib/theme/foundation/elevation.ts`

2. Semantic tokens
- Contextual meaning (`bg.canvas`, `bg.surface`, `text.primary`, `border.subtle`, `accent.primary`)
- Derived per `mode` and partially overridden by `style` and `palette`
- Example file:
  - `src/lib/theme/semantic.ts`

3. Component tokens
- Optional component aliases (`button.primary.bg`, `input.focus.ring`, `tab.active.text`)
- Keep thin and mapped from semantic tokens to prevent drift

Constraint:
- All UI code reads semantic or component tokens only. No direct foundation token reads in screens/components.

### 2) Mode and Look Switching (Ionic + Konsta Pattern)

Implement deterministic "look context" similar to `.ios` vs `.md`:
- `mode`: `light` | `dark`
- `style`: `classic` | `modern` | `ios_glass` | `android_material` | `high_contrast`
- `palette`: named accent set

Composition order:
1. base semantic defaults
2. mode overrides
3. style overrides
4. palette overrides
5. accessibility clamps (contrast fallback adjustments)

This mirrors CSS cascade intent from Ionic/tw-colors, implemented in TypeScript merge order.

### 3) Style Recipe Matrix (Apple + Android + Ionic + Konsta)

Define explicit style deltas instead of free-form edits.

`classic`
- Low blur, neutral surfaces, conservative elevation, current spacing rhythm

`modern`
- Slightly bolder accent use, sharper borders, stronger elevation contrast

`ios_glass`
- Elevated translucency and blur-inspired surface treatment
- Thin but visible borders around glass surfaces
- Reduced heavy shadow; rely more on layered translucency
- Preserve strict text contrast fallback to avoid readability loss

`android_material`
- Higher emphasis on tonal surfaces and elevation steps
- Clear pressed/focus states and stronger container boundaries
- Keep motion hooks and state colors aligned with material-like feedback cues

`high_contrast`
- Remove subtle borders/shadows that do not contribute to readability
- Increase edge contrast for inputs/cards/buttons/tabs
- Prefer solid backgrounds over translucent treatments
- Enforce larger contrast margins for secondary/tertiary text

### 4) Palette Strategy (Radix + tw-colors Pattern)

Use curated palette objects with controlled semantic slots:
- `accent.1`..`accent.12` scale (Radix-like granularity)
- Semantic mappings:
  - `primary` <- `accent.9`
  - `primaryHover` <- `accent.10`
  - `primarySubtleBg` <- `accent.3`
  - `primaryTextOnSubtle` <- `accent.11`

Benefits:
- Consistent palette behavior across styles
- Cleaner hover/pressed/focus derivations
- Easier future custom palettes

### 5) High Contrast as a First-Class Mode (Radix + iTwin Pattern)

Implementation rules:
- Theme selection persists `style = high_contrast` explicitly.
- For any chosen `mode`/`palette`, applying high contrast forces:
  - minimum border contrast threshold
  - no low-contrast text tokens
  - stronger focus ring color
  - optional disablement of translucent glass panels

### 6) Android Dynamic Color Future Hook

Not in initial scope, but design for extension now:
- Add optional `paletteSource` field to persisted settings:
  - `static`
  - `dynamic_android` (future)
- Keep composer API open for externally generated palette inputs:
  - `composeTheme(selection, dynamicPalette?)`

This allows Android dynamic color integration later without token API rewrite.

### 7) Storage Schema and Compatibility

Persist as one versioned JSON blob:

```json
{
  "v": 1,
  "mode": "dark",
  "style": "ios_glass",
  "palette": "ocean",
  "paletteSource": "static"
}
```

Rules:
- Unknown `v`: fall back to defaults and preserve raw blob for diagnostics.
- Unknown style/palette IDs: map via compatibility table, then persist normalized value.
- Avoid separate keys for mode/style/palette to prevent partial-write drift.

### 8) Theme Combination QA Matrix

Minimum coverage set:
- Modes: 2 (`light`, `dark`)
- Styles: 5 (`classic`, `modern`, `ios_glass`, `android_material`, `high_contrast`)
- Palettes: at least 5

Total combos: 50.

Testing approach:
- Full automated unit coverage on composer behavior for all combinations.
- Manual UI smoke on representative subset:
  - each style in light and dark
  - at least 2 palettes per style
  - all key screens and navigation states

## Implementation Phases

### Phase 1: Foundation (Theme Domain + Provider + Storage)

Deliverables:
- Theme domain types and token composition utilities
- Theme context/provider/hook
- Preference persistence + hydration

Tasks:
- [ ] Create `src/lib/theme/types.ts` with `ThemeMode`, `ThemeStyle`, `ThemePalette`, `ThemeSelection`.
- [ ] Create `src/lib/theme/tokens/base.ts` for semantic default tokens.
- [ ] Create `src/lib/theme/tokens/modes.ts` for light/dark maps.
- [ ] Create `src/lib/theme/tokens/styles.ts` for style-family overrides.
- [ ] Create `src/lib/theme/tokens/palettes.ts` for palette overrides.
- [ ] Create `src/lib/theme/theme-composer.ts` for deterministic merge behavior.
- [ ] Create `src/lib/theme/theme-context.tsx` for provider + `useTheme`.
- [ ] Add `src/lib/theme/compat.ts` for deprecated style/palette mapping and schema upgrades.
- [ ] Add `src/lib/theme/contrast.ts` for contrast evaluation and clamp helpers.
- [ ] Add storage keys and helper functions in `src/lib/mmkv.ts` (or dedicated theme-prefs file under `src/lib/theme/`).
- [ ] Wire `ThemeProvider` into [app/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/_layout.tsx:55).
- [ ] Add a temporary feature flag constant for staged rollout if migration needs partial release.

Success criteria:
- App boots with default theme when no preference exists.
- App restores persisted theme selection after restart.

Estimated effort:
- 0.5 to 1 day

### Phase 2: Navigation + Settings + Core Surface Migration

Deliverables:
- Dynamic theme applied to navigation shells and settings controls
- First complete end-to-end selection workflow

Tasks:
- [ ] Refactor [app/(tabs)/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/(tabs)/_layout.tsx:1) to consume `useTheme`.
- [ ] Refactor [app/(auth)/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/(auth)/_layout.tsx:1) to consume `useTheme`.
- [ ] Refactor [app/(tabs)/journal/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/(tabs)/journal/_layout.tsx:1) to consume `useTheme`.
- [ ] Add appearance controls to [app/(tabs)/settings.tsx](/Users/kashane/app-dev/trade-journal/app/(tabs)/settings.tsx:16).
- [ ] Add preview swatches to each style and palette option for faster user scanning.
- [ ] Add optional `Use System Appearance` toggle (maps to system color scheme) while keeping manual override available.
- [ ] Ensure Settings controls call provider actions and immediately re-render UI.
- [ ] Ensure controls and labels remain accessible and legible in dark mode.

Success criteria:
- Selecting mode/style/palette in settings updates tab/header/surface tokens immediately.
- Selection persists and restores correctly on relaunch.

Estimated effort:
- 1 day

### Phase 3: Component and Screen Migration Sweep

Deliverables:
- Major journal/trade components use runtime tokens
- Static `colors` usage removed or isolated behind compatibility layer

Tasks:
- [ ] Refactor `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `app/(auth)/forgot-password.tsx`.
- [ ] Refactor `app/(tabs)/journal/index.tsx`, `app/(tabs)/journal/[id].tsx`, `app/(tabs)/journal/import.tsx`.
- [ ] Refactor `src/components/TradeForm.tsx`.
- [ ] Refactor `src/components/TradeCard.tsx`.
- [ ] Refactor `src/components/JournalStats.tsx`.
- [ ] Refactor `src/components/JournalViewTabs.tsx`.
- [ ] Refactor `src/components/FilterBar.tsx`.
- [ ] Refactor `src/components/TagInput.tsx`.
- [ ] Refactor `src/components/PnlBadge.tsx`.
- [ ] Refactor remaining theme import consumers from `rg -n "from '@/lib/theme'"`.
- [ ] Replace hardcoded `#fff` usage in image/trade components with semantic inverse tokens.
- [ ] Audit focus, pressed, and disabled states to ensure style-specific feedback remains visible.

Success criteria:
- No visual regressions on key flows in light and dark.
- No direct reliance on frozen static `colors` for migrated files.

Estimated effort:
- 1 to 1.5 days

### Phase 4: Quality Hardening (Tests, Contrast, Verification)

Deliverables:
- Unit + integration coverage for theme behavior
- Lane B verification evidence

Tasks:
- [ ] Add `__tests__/unit/theme-composer.test.ts` for deterministic merges and fallback behavior.
- [ ] Add `__tests__/unit/theme-contrast.test.ts` for semantic contrast checks.
- [ ] Add `__tests__/unit/theme-compat.test.ts` for schema migration and deprecated ID mapping.
- [ ] Add `__tests__/integration/theme-settings.test.ts` for preference change/persist flows.
- [ ] Add integration checks for navigation chrome updates when theme changes.
- [ ] Add manual QA checklist artifact in `docs/plans/checklists/theme-qa-matrix.md`.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run test:integration`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run verify:lane:b`.

Success criteria:
- Required Lane B gates pass.
- No failing tests introduced by theme migration.

Estimated effort:
- 0.5 day

## Alternative Approaches Considered

1. Hardcode complete theme object per combination (`mode x style x palette`)
- Pros: straightforward implementation
- Cons: combinatorial growth, high maintenance, poor extensibility
- Decision: rejected

2. Keep static theme exports and only toggle light/dark via simple branching
- Pros: minimal refactor
- Cons: does not satisfy style-family and palette goals cleanly
- Decision: rejected

3. Full adoption of external design system/theming framework
- Pros: mature theming primitives
- Cons: migration overhead and dependency churn for current app size
- Decision: rejected for now

## System-Wide Impact

### Interaction Graph

1. User selects theme option in Settings  
Action chain: `Settings control` -> `ThemeProvider action` -> `setSelection` -> `persistSelection(storage.set)` -> `context value changes` -> `all useTheme consumers rerender` -> `Expo Router header/tab options recompute`.

2. App startup with persisted theme  
Action chain: `Root layout mount` -> `ThemeProvider hydrate()` -> `storage.getString(theme-pref-key)` -> `parse/validate selection` -> `composeTheme` -> `render tree with hydrated tokens`.

### Error & Failure Propagation

- Storage read failure (MMKV unavailable): fallback defaults in provider, app remains usable.
- Corrupt/unknown persisted value: validation fallback to default selection.
- Missing token key in style/palette override: composer falls back to base/mode token.
- Navigation options using stale token closure: require options to depend on `theme` values in render path.

### State Lifecycle Risks

- Partial write risk: if mode/style/palette are stored separately, one write may fail and create invalid combinations.
  - Mitigation: persist as one versioned JSON blob.
- Migration risk: old static imports can produce mixed surfaces.
  - Mitigation: migration checklist + `rg` audit before completion.
- Hydration flicker risk: default renders before persisted selection loads.
  - Mitigation: optional provider hydration guard for first paint.

### API Surface Parity

Interfaces that must remain consistent:
- `src/lib/theme` public exports used by screens/components
- navigation styles in router layouts
- settings presentation controls

Parity strategy:
- Introduce a stable `ThemeTokens` shape and ensure all style families and palettes populate required semantic keys.

### Integration Test Scenarios

- Theme change in Settings updates active Journal tab/header colors without navigation reset.
- Theme persists after simulated app restart (rehydration path).
- Invalid persisted theme value falls back to default without crash.
- Switching between extreme combos (e.g., dark + ios_glass + amber) keeps critical text readable.
- Auth flow screens and tabbed screens both render consistently after theme switch.

## SpecFlow Analysis (Flow Completeness + Edge Cases)

### Primary User Flows

- Flow A: Open Settings -> choose Dark -> UI updates globally -> relaunch app -> Dark remains active.
- Flow B: Choose style family -> verify card/surface/border personality changes while functional layout remains intact.
- Flow C: Choose palette -> verify accent colors update for buttons, active tabs, badges, highlights.

### Edge Cases

- User switches theme rapidly across options (ensure no stale renders/crashes).
- Persisted selection references removed style/palette in future releases.
- Device/system mode changes while app uses explicit user mode.
- Transparent/glass styles over varied backgrounds reducing legibility.
- High contrast selected with translucent style collisions (enforce deterministic precedence).
- Android dynamic palette unavailable or partially generated (fallback to static curated palette).

### Gap Fixes to Include

- Add versioned schema for stored theme selection.
- Add compatibility fallback mapping for deprecated style/palette IDs.
- Add contrast assertion tests for key semantic pairs.

## Acceptance Criteria

### Functional Requirements

- [ ] Users can select `Light` and `Dark` modes in Settings.
- [ ] Users can select at least 4 style families (including `Classic`, `Modern`, `iOS Liquid Glass`, `Android Material`).
- [ ] Users can select multiple palette options.
- [ ] Theme changes apply immediately across current screen and navigation chrome.
- [ ] Theme selection persists across app restarts.

### Non-Functional Requirements

- [ ] No crashes from missing/invalid theme preferences.
- [ ] Themed text/background semantic pairs meet defined contrast threshold targets.
- [ ] Theme composition logic is deterministic and side-effect free.

### Quality Gates

- [ ] Lane B gate criteria satisfied per feature framework.
- [ ] `npm run verify:lane:b` passes.
- [ ] Feature brief updated with final deltas after implementation.

## Success Metrics

- Theme preference adoption visible via manual QA acceptance (all controls functional).
- 0 regressions in existing unit/integration test suites after migration.
- Manual smoke across core flows (auth, journal list/detail, add/edit trade, settings) passes in both light and dark.

## Dependencies & Prerequisites

- Existing MMKV/SecureStore storage path ([src/lib/mmkv.ts](/Users/kashane/app-dev/trade-journal/src/lib/mmkv.ts:84)).
- Existing Expo Router layout structure for dynamic navigation tokens.
- Time budget for migrating numerous static `colors` imports.

## Risk Analysis & Mitigation

- Risk: Wide migration footprint increases regression chance.
  - Mitigation: phase migration, prioritize core screens, run `verify:lane:b` at each milestone.
- Risk: File size sprawl violating repository guidance.
  - Mitigation: split theme logic into focused modules.
- Risk: Inconsistent visual language across components.
  - Mitigation: central semantic tokens + checklists for migrated files.

## Rollout and Rollback Plan

### Rollout

1. Ship foundation/provider behind default selections.
2. Ship settings controls and navigation integration.
3. Complete migration sweep and QA.
4. Merge after Lane B verification and manual acceptance.

### Rollback

- Revert theme-overhaul commits to restore previous static `src/lib/theme.ts` consumption.
- Remove appearance controls from settings.
- Confirm baseline app rendering with previous static tokens.

## Verification Plan

Run in this order:

```bash
npm run test:unit
npm run test:integration
npm run typecheck
npm run verify:lane:b
```

Manual checks:
- iOS: auth flow, journal list/detail, new trade, settings appearance.
- Android sanity pass (recommended before release).

## Documentation Plan

- Update feature brief final deltas section after implementation:
  - [docs/feature-briefs/2026-03-10-theme-overhaul-multi-mode-style-palette.md](/Users/kashane/app-dev/trade-journal/docs/feature-briefs/2026-03-10-theme-overhaul-multi-mode-style-palette.md)
- Add external-style reference notes:
  - [docs/references/2026-03-10-theme-style-reference-notes.md](/Users/kashane/app-dev/trade-journal/docs/references/2026-03-10-theme-style-reference-notes.md)
- Add a short developer note in `src/lib/theme/README` (or inline docs) describing:
  - theme token contract
  - composer order
  - adding new style/palette variants safely

## References & Research

### Internal References

- Theme tokens: [src/lib/theme.ts](/Users/kashane/app-dev/trade-journal/src/lib/theme.ts:1)
- Root layout integration point: [app/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/_layout.tsx:55)
- Tabs layout theme consumers: [app/(tabs)/_layout.tsx](/Users/kashane/app-dev/trade-journal/app/(tabs)/_layout.tsx:1)
- Settings screen for controls: [app/(tabs)/settings.tsx](/Users/kashane/app-dev/trade-journal/app/(tabs)/settings.tsx:16)
- Storage adapter: [src/lib/mmkv.ts](/Users/kashane/app-dev/trade-journal/src/lib/mmkv.ts:84)
- Repo constraints and commands: [CLAUDE.md](/Users/kashane/app-dev/trade-journal/CLAUDE.md:49), [package.json](/Users/kashane/app-dev/trade-journal/package.json:16)

### External References

- Apple Liquid Glass overview (provided): [developer.apple.com/documentation/technologyoverviews/liquid-glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
- Apple Liquid Glass announcement and design summary: [apple.com/la/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design](https://www.apple.com/la/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- Android look and feel: [developer.android.com/develop/ui/views/theming/look-and-feel](https://developer.android.com/develop/ui/views/theming/look-and-feel)
- Android dark theme: [developer.android.com/develop/ui/views/theming/darktheme](https://developer.android.com/develop/ui/views/theming/darktheme)
- Android dynamic colors: [developer.android.com/develop/ui/views/theming/dynamic-colors](https://developer.android.com/develop/ui/views/theming/dynamic-colors)
- Ionic platform styles and theming:
  - [ionicframework.jp/docs/v7/theming/platform-styles](https://ionicframework.jp/docs/v7/theming/platform-styles/)
  - [ionicframework.com/docs/theming/css-variables](https://ionicframework.com/docs/theming/css-variables)
  - [ionicframework.com/docs/theming/dark-mode](https://ionicframework.com/docs/theming/dark-mode)
- Ionic repo (reference target): [github.com/ionic-team/ionic-framework](https://github.com/ionic-team/ionic-framework)
- Konsta theme docs and repo:
  - [konstaui.com/docs/theme](https://konstaui.com/docs/theme)
  - [konstaui.com/docs/react/theme-provider](https://konstaui.com/docs/react/theme-provider)
  - [github.com/konstaui/konsta](https://github.com/konstaui/konsta)
- Radix Themes:
  - [radix-ui.com/themes/docs/components/theme](https://www.radix-ui.com/themes/docs/components/theme)
  - [radix-ui.com/themes/docs/theme/color](https://www.radix-ui.com/themes/docs/theme/color)
  - [github.com/radix-ui/themes](https://github.com/radix-ui/themes)
- iTwinUI:
  - [npmjs.com/package/@itwin/itwinui-react](https://www.npmjs.com/package/@itwin/itwinui-react)
  - [npmjs.com/package/@itwin/itwinui-variables](https://www.npmjs.com/package/@itwin/itwinui-variables)
  - [github.com/iTwin/iTwinUI](https://github.com/iTwin/iTwinUI)
- Tailwind multi-theme pattern repo:
  - [github.com/L-Blondy/tw-colors](https://github.com/L-Blondy/tw-colors)
- Additional candidate from user notes (not validated during research pass):
  - `emmalexandria/tailthemes`
