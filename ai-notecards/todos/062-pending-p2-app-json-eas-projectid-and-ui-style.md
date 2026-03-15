---
status: pending
priority: p2
issue_id: "062"
tags: [code-review, mobile, expo, configuration]
dependencies: []
---

# app.json: Empty EAS projectId + Wrong userInterfaceStyle

## Problem Statement

Two configuration bugs in `mobile/app.json`:

**Bug 1 — `eas.projectId` is empty string.** EAS Build, OTA updates, and push notifications require a non-empty project ID. Every EAS workflow will fail silently or with a confusing error until this is set. The project must be registered with the `blue-expos-organization` account and the returned project ID entered here.

**Bug 2 — `userInterfaceStyle: "light"` conflicts with theme system.** The mobile app's theme system supports a `dark` mode (`ThemeMode.dark`). Setting `userInterfaceStyle: "light"` prevents React Native from receiving OS dark mode signals — `Appearance.getColorScheme()` returns `"light"` permanently regardless of device setting. When dark mode is implemented (even as an opt-in setting), this configuration will silently block it. The value should be `"automatic"` to let the OS signal correctly.

## Findings

- **Architecture Strategist (Review Round 3):** P2-E — empty `eas.projectId` blocks all EAS Build workflows
- **Architecture Strategist (Review Round 3):** P2-F — `"light"` conflicts with theme system's dark mode support

Affected: `mobile/app.json` lines 38, 9

## Proposed Solutions

### Option A: Register project + fix userInterfaceStyle (Recommended)

1. Run `npx eas init` in `mobile/` to register the project with `blue-expos-organization` and populate `projectId`
2. Change `"userInterfaceStyle": "light"` → `"userInterfaceStyle": "automatic"`

**For Bug 2, acceptable to defer to brainstorm #2 if dark mode is not being implemented now — but the userInterfaceStyle fix is a 1-character change with no risk.**

**Pros:** Unblocks EAS Build; correctly signals OS theme to React Native
**Cons:** Registering with EAS requires account access
**Effort:** Small (EAS init + config edit)
**Risk:** Low

## Acceptance Criteria

- [ ] `app.json` `extra.eas.projectId` is a valid non-empty UUID from the blue-expos-organization account
- [ ] `app.json` `userInterfaceStyle` set to `"automatic"`
- [ ] `eas.json` profiles remain unchanged
