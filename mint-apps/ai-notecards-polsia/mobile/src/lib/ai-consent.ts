export const AI_GENERATION_CONSENT_VERSION = '2026-03-22';

type AiGenerationConsentRecord = {
  granted: boolean;
  version: string;
  granted_at?: string;
  updated_at?: string;
};

type PreferencesLike = Record<string, unknown> | null | undefined;

function isConsentRecord(value: unknown): value is AiGenerationConsentRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  return typeof record.granted === 'boolean' && typeof record.version === 'string';
}

export function hasGrantedAiGenerationConsent(preferences: PreferencesLike): boolean {
  const record = preferences?.ai_generation_consent;
  if (!isConsentRecord(record)) return false;

  return record.granted === true && record.version === AI_GENERATION_CONSENT_VERSION;
}

export function buildGrantedAiGenerationConsent() {
  return {
    ai_generation_consent: {
      granted: true,
      version: AI_GENERATION_CONSENT_VERSION,
      granted_at: new Date().toISOString(),
    },
  };
}

export function buildWithdrawnAiGenerationConsent() {
  return {
    ai_generation_consent: {
      granted: false,
      version: AI_GENERATION_CONSENT_VERSION,
      updated_at: new Date().toISOString(),
    },
  };
}
