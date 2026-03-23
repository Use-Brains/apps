import { describe, expect, it } from 'vitest';

import {
  AI_GENERATION_CONSENT_VERSION,
  hasGrantedAiGenerationConsent,
} from '../../src/lib/ai-consent';

describe('AI generation consent', () => {
  it('requires a granted consent record with the current version', () => {
    expect(hasGrantedAiGenerationConsent({})).toBe(false);
    expect(hasGrantedAiGenerationConsent({
      ai_generation_consent: {
        granted: true,
        version: 'old-version',
      },
    })).toBe(false);
    expect(hasGrantedAiGenerationConsent({
      ai_generation_consent: {
        granted: true,
        version: AI_GENERATION_CONSENT_VERSION,
      },
    })).toBe(true);
  });

  it('treats withdrawn or malformed consent as not granted', () => {
    expect(hasGrantedAiGenerationConsent({
      ai_generation_consent: {
        granted: false,
        version: AI_GENERATION_CONSENT_VERSION,
      },
    })).toBe(false);
    expect(hasGrantedAiGenerationConsent({
      ai_generation_consent: 'bad-shape',
    })).toBe(false);
  });
});
