# Theme Style Reference Notes

Date: 2026-03-10  
Scope: External references for multi-mode, multi-style, multi-palette theme system in Trade Journal.

## Source Matrix

| Source | What to copy | How to apply in this app |
| --- | --- | --- |
| Apple Liquid Glass docs + announcement | Layered translucent material, dynamic adaptation to context, refreshed control hierarchy | Add `ios_glass` style recipe with translucent surfaces, thin border definition, and strict contrast fallback |
| Android look-and-feel + dark theme + dynamic colors | Material system consistency, DayNight support, dynamic palette extraction and harmonization | Add `android_material` style recipe, support `system` appearance option, design `paletteSource` extension for future Android dynamic color |
| Ionic theming docs | Mode switching (`ios`/`md`) and CSS variable driven theming architecture | Mirror with `style` switch and deterministic token composition order in TypeScript |
| Konsta UI theme docs | Runtime `ios`/`material` mode state and component variants | Use one global appearance state, avoid per-component ad hoc style branching |
| Radix Themes docs/repo | `appearance`, `accentColor`, `grayColor`, scale-based palettes, high contrast support | Use palette scale approach and make high contrast a first-class style option |
| iTwinUI docs/packages | Theme provider model, high contrast via user/device preference, decoupled variable packages | Keep provider-driven global theming and explicit token-layer separation |
| tw-colors repo | Multi-theme config, CSS variable generation, nested theme support | Apply config-driven palette definitions and keep semantic token contract stable |

## Key Patterns to Adopt

## 1) Separate Foundation and Semantic Tokens

- Foundation tokens:
  - raw scales (`accent.1..12`, grays, spacing, elevation levels, radius sets)
- Semantic tokens:
  - role-based values (`bg.surface`, `text.primary`, `border.default`, `accent.primary`)

Reason:
- Easier to add styles and palettes without rewriting component styles.

## 2) Deterministic Theme Composition Order

Apply token layers in fixed order:
1. Base semantic defaults
2. Mode (`light` or `dark`)
3. Style (`classic`, `modern`, `ios_glass`, `android_material`, `high_contrast`)
4. Palette (`ocean`, `emerald`, etc.)
5. Accessibility clamps (contrast-safe fallback)

Reason:
- Predictable behavior and easier debugging.

## 3) High Contrast Is a Mode, Not a Color Toggle

High contrast should:
- increase border and text contrast
- avoid subtle/translucent surfaces that reduce readability
- strengthen focus rings and disabled/pressed state distinctions

Reason:
- Matches accessibility-first patterns in Radix and iTwin.

## 4) Platform Look Recipes Instead of Platform Conditionals Everywhere

Create style recipes:
- `ios_glass`: translucency, layering, fine borders, low heavy shadow usage
- `android_material`: tonal surfaces, clear elevation steps, stronger interaction state cues

Reason:
- Keeps platform language centralized and maintainable.

## 5) Palette Scale Strategy

Adopt scale tokens similar to `1..12`:
- low numbers for subtle backgrounds
- mid/high numbers for interactive emphasis
- highest values for strong contrast text/overlays

Reason:
- More robust than a single `primary` color when supporting many palettes.

## 6) Persist a Versioned Theme Selection Object

Persist as one blob:

```json
{
  "v": 1,
  "mode": "dark",
  "style": "ios_glass",
  "palette": "ocean",
  "paletteSource": "static"
}
```

Reason:
- Prevents partial-write corruption and enables future migration paths.

## 7) Build for Future Android Dynamic Color

Do not implement dynamic extraction yet, but keep API ready:
- composer accepts optional external palette object
- setting can track `paletteSource` (`static` now, dynamic later)

Reason:
- Enables future platform-native personalization without architectural rewrite.

## Suggested Initial Palette Set

- `ocean`
- `emerald`
- `amber`
- `ruby`
- `slate`

Each should define:
- neutral surface/text tokens for both light and dark
- accent scale `1..12`
- semantic status colors (`success`, `warning`, `danger`) tuned for accessibility

## Validation Notes

- Source availability:
  - All links above were reviewed except `emmalexandria/tailthemes`, which could not be validated during this pass.
- Apple Liquid Glass implementation details in this note are interpreted from official Apple design messaging and should be validated against the latest Apple developer docs during implementation.

## Links

- Apple Liquid Glass overview: https://developer.apple.com/documentation/technologyoverviews/liquid-glass
- Apple new design announcement: https://www.apple.com/la/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- Android look and feel: https://developer.android.com/develop/ui/views/theming/look-and-feel
- Android dark theme: https://developer.android.com/develop/ui/views/theming/darktheme
- Android dynamic colors: https://developer.android.com/develop/ui/views/theming/dynamic-colors
- Ionic platform styles: https://ionicframework.jp/docs/v7/theming/platform-styles/
- Ionic CSS variables: https://ionicframework.com/docs/theming/css-variables
- Ionic dark mode: https://ionicframework.com/docs/theming/dark-mode
- Ionic repo: https://github.com/ionic-team/ionic-framework
- Konsta theme: https://konstaui.com/docs/theme
- Konsta React Theme Provider: https://konstaui.com/docs/react/theme-provider
- Konsta repo: https://github.com/konstaui/konsta
- Radix Theme component: https://www.radix-ui.com/themes/docs/components/theme
- Radix color system: https://www.radix-ui.com/themes/docs/theme/color
- Radix repo: https://github.com/radix-ui/themes
- iTwinUI React package: https://www.npmjs.com/package/@itwin/itwinui-react
- iTwinUI variables package: https://www.npmjs.com/package/@itwin/itwinui-variables
- iTwinUI repo: https://github.com/iTwin/iTwinUI
- tw-colors repo: https://github.com/L-Blondy/tw-colors
