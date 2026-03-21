import OpenAI from 'openai';
import { GoogleGenAI, Type } from '@google/genai';

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

let geminiClient;
function getGeminiClient() {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

const VISION_SYSTEM_PROMPT = `You are a flashcard generation expert. Examine the provided images carefully — they may contain handwritten notes, printed text, textbook pages, whiteboard photos, diagrams, or charts.

Extract the key concepts, facts, definitions, and relationships visible in the images. If additional text context is provided, use it to focus your card generation.

Generate 8-25 cards based on content density.
- Front: concise question or term (under 30 words)
- Back: clear answer or definition (under 60 words)
- Progress from basic to advanced concepts
- If an image is blurry or unreadable, skip it and work with what you can read`;

const FLASHCARD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING },
          back: { type: Type.STRING },
        },
        required: ['front', 'back'],
      },
    },
  },
  required: ['cards'],
};

function normalizeCardsPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.cards)) {
    return payload.cards;
  }
  return null;
}

export function parseCards(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  const cards = normalizeCardsPayload(parsed);
  if (!cards) {
    throw new Error('Response missing cards array');
  }
  for (const card of cards) {
    if (typeof card.front !== 'string' || typeof card.back !== 'string') {
      throw new Error('Invalid card format');
    }
  }
  return cards.slice(0, 30);
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
  } catch {
    console.error('Failed to parse AI response:', text);
    throw new Error('Failed to parse AI-generated cards');
  }
}

export async function generateCardsWithVision(input, files) {
  const ai = getGeminiClient();

  const contents = [];
  const userPrompt = input?.trim()
    ? `Generate flashcards from these images.\n\nAdditional context: ${input}`
    : 'Generate flashcards from the content in these images.';
  contents.push(userPrompt);

  for (const file of files) {
    contents.push({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.detectedMime || file.mimetype,
      },
    });
    file.buffer = null;
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Vision request timed out after 60 seconds.')), 60000);
  });

  let response;
  try {
    response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents,
        config: {
          systemInstruction: VISION_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseJsonSchema: FLASHCARD_SCHEMA,
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    err.code = err.code || 'VISION_PROVIDER_ERROR';
    err.visionMeta = {
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      fileCount: files.length,
      hasInputText: !!input?.trim(),
      message: err.message,
    };
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = response.text;
  if (!text || text.trim().length === 0) {
    const err = new Error('AI returned empty response. The image may have been blocked by content filters.');
    err.code = 'VISION_EMPTY_RESPONSE';
    err.visionMeta = {
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      fileCount: files.length,
      hasInputText: !!input?.trim(),
    };
    throw err;
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch (err) {
    err.code = 'VISION_INVALID_JSON';
    err.visionMeta = {
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      fileCount: files.length,
      hasInputText: !!input?.trim(),
      responseLength: text.length,
    };
    throw err;
  }

  const cards = normalizeCardsPayload(result);
  if (!cards?.length) {
    const err = new Error('No flashcards could be generated from the provided images.');
    err.code = 'NO_CARDS';
    err.visionMeta = {
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      fileCount: files.length,
      hasInputText: !!input?.trim(),
      responseShape: Array.isArray(result) ? 'array' : 'object',
      responseKeys: Array.isArray(result) ? Object.keys(result).slice(0, 30) : Object.keys(result),
    };
    throw err;
  }

  for (const card of cards) {
    if (typeof card.front !== 'string' || typeof card.back !== 'string') {
      const err = new Error('Vision response contained invalid card format.');
      err.code = 'VISION_INVALID_CARD_FORMAT';
      err.visionMeta = {
        provider: 'gemini',
        model: 'gemini-2.5-flash-lite',
        fileCount: files.length,
        hasInputText: !!input?.trim(),
        responseShape: Array.isArray(result) ? 'array' : 'object',
      };
      throw err;
    }
  }

  return cards.slice(0, 30);
}
