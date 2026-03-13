import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { decrypt } from './encryption.js';
import pool from '../db/pool.js';
import { ErrorCodes } from '../constants/errors.js';

const SYSTEM_PROMPT = `You are a flashcard generation expert. Given text or a topic, create study flashcards.

RULES:
- Return ONLY valid JSON. No markdown, no preamble, no explanation.
- Format: { "cards": [{ "front": "...", "back": "..." }] }
- Generate a maximum of 25 cards. For shorter inputs, 8-15 cards is ideal.
- If the content warrants more than 25 cards, split into multiple focused decks of ~15 cards each, naming them as Part 1, Part 2, etc. Return only the first part.
- For pasted notes: extract key concepts, definitions, relationships, and important details.
- For a topic name: generate foundational knowledge cards covering the most important concepts.
- Card fronts should be concise questions or terms (under 30 words).
- Card backs should be clear, concise answers or definitions (under 60 words).
- Cards should progress from basic to more advanced concepts.
- Avoid trivially obvious or overly niche cards.`;

const USER_PROMPT = (input) => `Generate flashcards from the following:\n\n${input}`;

// Per-provider timeouts (ms): iOS (120s) > server route (90s) > provider
const PROVIDER_TIMEOUTS = {
  groq: 30_000,
  gemini: 45_000,
  openrouter: 80_000,
};

function parseCards(text) {
  // Strip markdown code fences if the model wraps its response
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed.cards || !Array.isArray(parsed.cards)) {
    throw new Error('Response missing cards array');
  }
  for (const card of parsed.cards) {
    if (typeof card.front !== 'string' || typeof card.back !== 'string') {
      throw new Error('Invalid card format');
    }
  }
  // Hard cap: truncate to 30 cards if AI returns more
  if (parsed.cards.length > 30) {
    parsed.cards = parsed.cards.slice(0, 30);
  }
  return parsed.cards;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

async function generateWithGroq(input) {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const response = await withTimeout(
    client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT(input) },
      ],
    }),
    PROVIDER_TIMEOUTS.groq,
    'Groq'
  );

  return response.choices[0].message.content;
}

async function generateWithGemini(input) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `${SYSTEM_PROMPT}\n\n${USER_PROMPT(input)}`,
    }),
    PROVIDER_TIMEOUTS.gemini,
    'Gemini'
  );

  return response.text;
}

async function generateWithOpenRouter(input, apiKey, model) {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.CLIENT_URL || 'https://ainotecards.com',
      'X-Title': 'AI Notecards',
    },
  });

  const response = await withTimeout(
    client.chat.completions.create({
      model: model || 'anthropic/claude-sonnet-4-5',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT(input) },
      ],
    }),
    PROVIDER_TIMEOUTS.openrouter,
    'OpenRouter'
  );

  return response.choices[0].message.content;
}

/**
 * Generate flashcards from input text.
 * @param {string} input - The text to generate cards from
 * @param {object} [options] - Options for BYOK users
 * @param {string} [options.userId] - User ID (required for BYOK to decrypt key)
 * @param {boolean} [options.byok] - Whether this is a BYOK request
 */
export async function generateCards(input, options = {}) {
  // BYOK path: use user's own OpenRouter key
  if (options.byok && options.userId) {
    const { rows } = await pool.query(
      'SELECT openrouter_api_key_encrypted, preferred_model FROM users WHERE id = $1',
      [options.userId]
    );

    if (!rows[0]?.openrouter_api_key_encrypted) {
      const err = new Error('BYOK key required');
      err.code = ErrorCodes.BYOK_KEY_REQUIRED;
      throw err;
    }

    const apiKey = decrypt(rows[0].openrouter_api_key_encrypted, options.userId);
    const model = rows[0].preferred_model;

    let text;
    try {
      text = await generateWithOpenRouter(input, apiKey, model);
    } catch (err) {
      // Map OpenRouter HTTP errors to user-facing messages
      if (err.status === 401) {
        const e = new Error('Invalid API key');
        e.status = 401;
        throw e;
      }
      if (err.status === 402) {
        const e = new Error('Your OpenRouter account has insufficient credits.');
        e.status = 402;
        throw e;
      }
      if (err.status === 429) {
        const e = new Error('Rate limited by OpenRouter. Try again in a moment.');
        e.code = ErrorCodes.BYOK_RATE_LIMITED;
        throw e;
      }
      if (err.status === 502 || err.status === 503) {
        const e = new Error('The AI model is temporarily unavailable. Try a different model.');
        e.code = ErrorCodes.BYOK_PROVIDER_DOWN;
        throw e;
      }
      throw err;
    }

    try {
      return parseCards(text);
    } catch (err) {
      console.error('Failed to parse OpenRouter response:', text);
      throw new Error('Failed to parse AI-generated cards');
    }
  }

  // Platform path: Groq/Gemini with auto-fallback
  const provider = process.env.AI_PROVIDER || 'groq';
  let text;

  try {
    if (provider === 'gemini') {
      text = await generateWithGemini(input);
    } else {
      text = await generateWithGroq(input);
    }
  } catch (err) {
    // Auto-fallback: if primary fails (rate limit, etc.), try the other provider
    console.warn(`Primary provider (${provider}) failed: ${err.message}. Falling back...`);
    try {
      if (provider === 'groq') {
        text = await generateWithGemini(input);
      } else {
        text = await generateWithGroq(input);
      }
    } catch (fallbackErr) {
      console.error('Both AI providers failed:', fallbackErr.message);
      throw new Error('AI generation unavailable. Please try again later.');
    }
  }

  try {
    return parseCards(text);
  } catch (err) {
    console.error('Failed to parse AI response:', text);
    throw new Error('Failed to parse AI-generated cards');
  }
}
