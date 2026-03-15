---
status: pending
priority: p1
issue_id: "058"
tags: [code-review, security, mobile, mmkv, storage]
dependencies: []
---

# MMKV Encryption Key: PRNG + Data-Loss Bug in Catch Path

## Problem Statement

Two bugs in `mobile/src/lib/mmkv.ts`'s `getOrCreateEncryptionKey()`:

**Bug 1 — Not a CSPRNG:** `generateEncryptionKey()` uses `Math.random()` to produce the symmetric encryption key for MMKV. The V8 PRNG is deterministic and produces predictable output; the key has far less than claimed entropy.

**Bug 2 — Data-loss vector in catch path:** If `SecureStore.setItem` fails during the first key write (device freshly set up, keychain error), execution falls to the catch block. The catch generates a new key (still via Math.random()) but never persists it to SecureStore. On the next app launch, `getOrCreateEncryptionKey()` runs again, generates *another* different key, and opens MMKV with a mismatched key — making all previously written data permanently unreadable. This is a data-loss vector masked as an encryption error.

**Performance agent correction:** The plan proposes `Crypto.getRandomBytesAsync(16)` but this is wrong — async key generation breaks the synchronous module-level `export const storage = createStorage()` initialization. **Use `Crypto.randomUUID()` instead** — it is synchronous, backed by the native CSPRNG (≥122 bits of randomness), available in Expo SDK 55, and requires no changes to the initialization architecture.

## Findings

- **Architecture Strategist (Review Round 3):** P1-B — confirmed in `mmkv.ts` lines 18–36, 81
- **Security Sentinel (Review Round 3):** P2 — Math.random() weakness + catch path never persists key
- **Performance Oracle (Review Round 3):** P2 — `getRandomBytesAsync` breaks sync init; use `Crypto.randomUUID()` instead

Affected: `mobile/src/lib/mmkv.ts` lines 18–36, 81

## Proposed Solutions

### Option A: Replace with Crypto.randomUUID() (Recommended)

```typescript
import * as Crypto from 'expo-crypto';

function generateEncryptionKey(): string {
  // Synchronous CSPRNG — randomUUID() is backed by the native secure RNG
  return Crypto.randomUUID().replace(/-/g, '');  // 32 hex chars, 122 bits entropy
}
```

Also fix the catch path to persist the generated key on first failure:
```typescript
async function getOrCreateEncryptionKey(): Promise<string> {
  // ... existing try block unchanged ...
  // In catch: generate, attempt to store, return key even if storage fails
  // to prevent generating a different key on next launch
  const newKey = generateEncryptionKey();
  try { SecureStore.setItem(ENCRYPTION_KEY_ID, newKey); } catch { /* log */ }
  return newKey;
}
```

**Pros:** Synchronous; CSPRNG; no cascade into async initialization; fixes data-loss bug
**Cons:** UUID format (with dashes removed) vs original hex format — functionally identical for MMKV
**Effort:** Small
**Risk:** Low — one function changed; no interface changes

### Option B: Keep Math.random() with comment

Document the weakness and defer fix.

**Cons:** Data-loss bug remains unaddressed; security debt carried into production
**Effort:** Minimal
**Risk:** Unacceptable — data-loss vector survives

## Acceptance Criteria

- [ ] `generateEncryptionKey()` uses `Crypto.randomUUID()` (synchronous CSPRNG)
- [ ] `expo-crypto` installed via `npx expo install expo-crypto` (not `npm install`)
- [ ] Catch path in `getOrCreateEncryptionKey` persists the generated key before returning
- [ ] `export const storage = createStorage()` remains synchronous (no async propagation)
- [ ] MMKV opens successfully on clean install and on subsequent launches
