import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are a flashcard generation expert. Given text or a topic, create study flashcards.

RULES:
- Return ONLY valid JSON. No markdown, no preamble, no explanation.
- Format: { "cards": [{ "front": "...", "back": "..." }] }
- Generate 8-15 cards depending on input length/complexity.
- For pasted notes: extract key concepts, definitions, relationships, and important details.
- For a topic name: generate foundational knowledge cards covering the most important concepts.
- Card fronts should be concise questions or terms (under 30 words).
- Card backs should be clear, concise answers or definitions (under 60 words).
- Cards should progress from basic to more advanced concepts.
- Avoid trivially obvious or overly niche cards.`;

const USER_PROMPT = (input) => `Generate flashcards from the following:\n\n${input}`;

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
  return parsed.cards;
}

async function generateWithGroq(input) {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 4096,
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT(input) },
    ],
  });

  return response.choices[0].message.content;
}

async function generateWithGemini(input) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: `${SYSTEM_PROMPT}\n\n${USER_PROMPT(input)}`,
  });

  return response.text;
}

export async function generateCards(input) {
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
