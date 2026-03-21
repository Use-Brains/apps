import { storage } from './mmkv';
import { createHaptics } from './haptics-core';

const HAPTICS_ENABLED_KEY = 'haptics-enabled';

function readHapticsEnabled() {
  const stored = storage.getString(HAPTICS_ENABLED_KEY);
  return stored == null ? true : stored !== 'false';
}

export function setHapticsEnabled(enabled: boolean) {
  storage.set(HAPTICS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function isHapticsEnabled() {
  return readHapticsEnabled();
}

export const haptics = createHaptics(readHapticsEnabled);
