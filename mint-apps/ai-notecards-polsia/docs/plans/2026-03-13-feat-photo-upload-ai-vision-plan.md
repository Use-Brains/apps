---
title: 'feat: Photo Upload AI Vision Generation'
type: feat
date: 2026-03-13
---

<!-- FINISHED -->

# feat: Photo Upload AI Vision Generation

## Enhancement Summary

**Deepened on:** 2026-03-13
**Research agents used:** Gemini Vision API, Multer Security, Client Image Resize, Security Sentinel, Performance Oracle, Code Simplicity Reviewer, Context7 SDK Docs

### Key Improvements from Research

1. Use Gemini's `responseMimeType: 'application/json'` with schema for guaranteed valid JSON — eliminates flaky parsing
2. Add `file-type` package for magic byte validation — MIME type alone is spoofable
3. Resize to 1568px (not 2048px) — matches Gemini's internal tiling threshold, saves tokens
4. Process images sequentially on client — iOS Safari crashes with parallel canvas operations
5. Make `request()` handle FormData natively — avoids duplicated error handling
6. Null out `file.buffer` after base64 encoding — prevents memory buildup
7. Add rate limiter to generate endpoint — currently unprotected
8. Use `config.systemInstruction` — proper Gemini SDK pattern, better instruction following
9. CSRF defense: send `X-Requested-With: XMLHttpRequest` header on all requests, validate server-side — multipart POST bypasses CORS preflight
10. Conditional multer middleware — only apply multer on multipart requests so JSON text-only flow is unaffected
11. Multer error-handling middleware — map `MulterError` codes to user-friendly JSON responses
12. Concurrency semaphore — limit concurrent vision requests to prevent OOM and Gemini rate exhaustion
13. Server-side request timeout — cap Gemini call at 60s to prevent zombie requests

### New Risks Discovered

- CSRF: multipart `POST` is a CORS "simple request" — browser sends cookies without preflight. **Mitigated:** custom `X-Requested-With` header required on all requests, validated server-side.
- iOS Safari canvas limit: 16MP max area, 384MB total budget. Sequential processing + cleanup mandatory.
- JPEG chroma subsampling: quality below 1.0 blurs text in Chromium. Use quality 1.0 at 1568px (files still small: 200-800KB).
- JSON/multipart coexistence: multer must only run on multipart requests; JSON text-only requests must bypass multer or `req.body` will be empty.
- Vercel proxy body limit: Vercel rewrites enforce ~4.5MB request body limit. Client-resized photos (200-800KB each, ~1-4MB total for 5) should fit, but must validate in staging.

---

## Overview

Add photo upload to the Generate page so users can snap photos of notes, textbooks, or whiteboards and get AI-generated flashcards. Photos are sent to Gemini's vision API. Text-only generation continues using Groq as primary. No storage infrastructure needed — photos are transient.

## Problem Statement / Motivation

Users currently must type or paste text to generate flashcards. The most common study scenario — photographing handwritten notes or textbook pages — requires manual transcription first. Photo-to-card generation removes this friction and is a major differentiator.

## Proposed Solution

Route photo-containing requests to Gemini (`gemini-2.5-flash-lite`) which natively supports vision. Photos are resized client-side (1568px max, JPEG quality 1.0), uploaded via FormData/multer, base64-encoded on the server, and sent to Gemini with structured JSON output enforced via schema. Cards are returned in the same format as text generation — no schema changes needed.

## Technical Approach

### Files to Modify

| File                            | Change                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `client/src/pages/Generate.jsx` | Photo upload UI, preview, camera capture, form validation                          |
| `client/src/lib/api.js`         | Make `request()` handle FormData, add `generateWithPhotos` method                  |
| `client/src/lib/imageResize.js` | New file — canvas resize utility (~20 lines)                                       |
| `server/src/routes/generate.js` | Multer middleware, magic byte validation, rate limiter, route to vision or text AI |
| `server/src/services/ai.js`     | New `generateCardsWithVision()` function, vision prompt, JSON schema               |
| `server/package.json`           | Add `multer`, `file-type` dependencies                                             |

### No Changes Needed

- Database schema (cards remain text-only, `source_text` is already nullable — will be `null` for photo-only decks, or the user's text for photo+text decks)
- Plan middleware (same generation limits apply)
- Auth middleware
- Express global middleware — the `cors` package's default behavior reflects `Access-Control-Request-Headers` back, so `X-Requested-With` is automatically allowed in preflight responses. If CORS config is ever locked down with explicit `allowedHeaders`, `X-Requested-With` must be included.
- No new env vars required (same `GEMINI_API_KEY`). Optional: `MAX_CONCURRENT_VISION` to tune concurrency semaphore (default 3).

---

### Step 1: Make `request()` handle FormData + add upload method

**`client/src/lib/api.js`** — modify the existing `request()` helper to detect FormData and omit the JSON Content-Type header. This avoids duplicating error-handling logic.

```javascript
// client/src/lib/api.js — modify request()
async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const { headers: optHeaders, ...restOptions } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: isFormData ? { 'X-Requested-With': 'XMLHttpRequest', ...optHeaders } : { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...optHeaders },
    credentials: 'include',
    ...restOptions
  });
  // ... existing error handling unchanged
}
```

**CSRF defense:** The `X-Requested-With` header is sent on all requests. Any custom header forces a CORS preflight — the server's CORS policy only allows `CLIENT_URL`, so cross-origin requests from attacker sites are blocked before cookies are sent. This is critical for multipart POST, which would otherwise be a CORS "simple request."

**Header destructuring:** `options.headers` is destructured out separately so that `...restOptions` does not re-spread headers and overwrite the computed headers object. This prevents future callers from accidentally reintroducing `Content-Type: application/json` on FormData requests.

Then `generateWithPhotos` becomes a one-liner like every other method:

```javascript
generateWithPhotos: (input, title, files) => {
  const form = new FormData();
  if (input) form.append('input', input);
  if (title) form.append('title', title);
  files.forEach(f => form.append('photos', f));
  return request('/generate', { method: 'POST', body: form });
},
```

### Research Insights — API Layer

- **Why modify `request()` instead of bypassing it:** The original plan duplicated 12 lines of error-handling code. If error handling changes later, you'd need to update two places. The FormData check is 1 line. _(Source: Simplicity Review)_
- **`X-Requested-With` on all requests:** Multipart `POST` is a CORS "simple request" — browsers send cookies without preflight. Adding any custom header forces a preflight, which the server's CORS policy will reject for unauthorized origins. This also protects future non-JSON endpoints. _(Source: Security Review)_
- **Destructure headers from options:** Using `const { headers, ...rest } = options` prevents `...options` from re-spreading `headers` and overwriting the computed header object. Without this, any caller passing `options.headers` for a FormData request would reintroduce JSON content-type. _(Source: Architecture Review)_

---

### Step 2: Add client-side image resize utility

**`client/src/lib/imageResize.js`** — canvas-based resize. Process images **sequentially** (not in parallel) to avoid iOS Safari memory crashes.

```javascript
// client/src/lib/imageResize.js
export async function resizeImage(file, maxDimension = 1568, quality = 1.0) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close(); // free memory immediately

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

  // iOS Safari: explicitly release canvas memory
  canvas.width = 1;
  canvas.height = 1;

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

// Process multiple images sequentially (NOT in parallel)
export async function resizeImages(files, maxDimension = 1568) {
  const results = [];
  for (const file of files) {
    results.push(await resizeImage(file, maxDimension));
  }
  return results;
}
```

### Research Insights — Client Resize

- **1568px instead of 2048px:** Gemini internally tiles images into 768x768 blocks. At 1568px, a typical photo produces 4 tiles (~1,032 tokens). At 2048px, it's 6-9 tiles (~1,548-2,322 tokens) with no meaningful quality improvement for text recognition. Output files at 1568px are 200-800KB at quality 1.0. _(Source: Gemini Vision API Research)_
- **JPEG quality 1.0 instead of 0.85:** Chromium and Safari use chroma subsampling at quality < 1.0, which blurs sharp text edges. At 1568px, quality 1.0 still produces small files (200-800KB). This is critical for handwriting/textbook readability. _(Source: Client Resize Research — whatwg/html #5395)_
- **`createImageBitmap` + `bitmap.close()`:** More memory-efficient than `new Image()`. Explicit `close()` frees decoded image data immediately. _(Source: Client Resize Research)_
- **Canvas cleanup (width=1, height=1):** iOS Safari retains canvas bitmap memory even after DOM removal. Setting dimensions to 1x1 forces release. Total iOS canvas budget is 384MB — five 2048px canvases could exhaust it. _(Source: Client Resize Research — PQINA canvas memory article)_
- **Sequential processing:** Parallel canvas resizing on mobile can spike memory 300-500MB and crash Safari. Process one at a time. _(Source: Performance Oracle, Client Resize Research)_
- **HEIC handling:** Do NOT include `image/heic` in the `accept` attribute. iOS Safari auto-converts HEIC to JPEG when `accept` lists only JPEG/PNG/WebP. The canvas resize also converts any format to JPEG as a final safety net. _(Source: Client Resize Research — Apple Developer Forums)_

---

### Step 3: Update Generate.jsx with photo upload UI

Add to the existing Generate page:

- **State:** `const [photos, setPhotos] = useState([])` — array of File objects
- **File input:** Hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>` triggered by a button. Separate `capture="environment"` input for mobile camera.
- **Feature detection:** Check `typeof createImageBitmap === 'function'` on mount. If unsupported, hide the photo upload button entirely (Safari 14 and below).
- **Preview:** Horizontal row of thumbnails with remove (X) buttons. Show count badge "3/5". Create thumbnail URLs via `URL.createObjectURL(file)`. **Revoke URLs** via `URL.revokeObjectURL()` when a photo is removed and on component unmount (via `useEffect` cleanup) to prevent memory leaks on mobile.
- **Accessibility:** Add `aria-label` to upload button ("Upload photos"), camera button ("Take photo"), and each remove button ("Remove photo 1 of 3"). Add `alt="Photo 1 of 3"` on preview thumbnails. Ensure all buttons are keyboard-accessible.
- **Validation:** Submit enabled when `input.trim() || photos.length > 0`. Remove `required` from textarea.
- **Double-submit guard:** Use `const submitting = useRef(false)` to prevent re-entry. Check and set in `handleGenerate` before `setLoading(true)`, reset in `finally`. React state updates are async — the `disabled` prop alone may not prevent a second click within the same event loop tick.
- **Submit:** If `photos.length > 0`, call `resizeImages(photos)` (sequential) inside a try/catch (resize can fail on corrupted images — show toast "Could not process one of your photos. Try removing it."), then `api.generateWithPhotos(input, title, resizedFiles)`. Else use existing `api.generate(input, title)`.
- **Loading copy:** When photos are attached, show "Reading your photos... This usually takes 10-20 seconds" instead of the default message.
- **Input text max length:** Enforce 50,000 character limit on the textarea (both client-side `maxLength` and server-side validation).

---

### Step 4: Add multer middleware + security to generate route

**`server/package.json`** — add `multer` and `file-type`

**`server/src/routes/generate.js`** — multer with memory storage, magic byte validation, rate limiter:

```javascript
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import rateLimit from 'express-rate-limit';

// CSRF defense — reject requests without X-Requested-With header
// Any custom header forces a CORS preflight, which the server's CORS policy will block for unauthorized origins
function requireXHR(req, res, next) {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Rate limiter — generate endpoint is currently unprotected
// Returns JSON (not plain text) to match the API's error format
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fieldSize: 250 * 1024, parts: 15 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type. Accepted: JPEG, PNG, WebP.'));
    }
    cb(null, true);
  }
});

// Conditional multer — only apply on multipart requests so JSON text-only flow is unaffected
function optionalMulter(req, res, next) {
  if (req.is('multipart/form-data')) {
    return upload.array('photos', 5)(req, res, err => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large. Maximum 5MB per photo.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Maximum 5 photos.' });
        }
        if (err.code === 'LIMIT_FIELD_VALUE') {
          return res.status(400).json({ error: 'Text input too large.' });
        }
        return res.status(400).json({ error: 'Upload error.' });
      }
      if (err) {
        // fileFilter errors (unsupported file type)
        return res.status(422).json({ error: err.message });
      }
      next();
    });
  }
  next();
}

// Magic byte validation middleware — runs after multer
async function validateImageContent(req, res, next) {
  if (!req.files?.length) return next();
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  for (const file of req.files) {
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !allowedMimes.includes(type.mime)) {
      return res.status(422).json({ error: 'File content does not match an allowed image format.' });
    }
    file.detectedMime = type.mime;
  }
  next();
}

// Concurrency semaphore — prevent OOM and Gemini rate exhaustion from concurrent vision requests
// At ~40-70MB per vision request and Gemini free tier 15 RPM, limit concurrent requests.
// Default 3 for Railway free tier (512MB), increase to 4-5 on Railway pro (8GB).
let activeVisionRequests = 0;
const MAX_CONCURRENT_VISION = parseInt(process.env.MAX_CONCURRENT_VISION, 10) || 3;
```

**Middleware chain:**

```
generateLimiter → requireXHR → authenticate → checkTrialExpiry → checkGenerationLimits → optionalMulter → validateImageContent → handler
```

**Handler updates:**

- Read `input` and `title` from `req.body` (multer parses form fields too; for JSON requests, `express.json()` already parsed them)
- Validate input text length: `if (input && input.length > 50000)` → 400 (**applies to both JSON and multipart paths**)
- Validate title length: `if (title && title.length > 200)` → 400
- Check `req.files?.length` to decide text vs vision path
- Input validation: `if (!input?.trim() && (!req.files || req.files.length === 0))` → 400
- **Concurrency check** (vision path only): if `activeVisionRequests >= MAX_CONCURRENT_VISION`, return 503 `{ error: 'Photo processing is busy. Please try again in a moment.' }`. Otherwise increment before call, decrement in `finally`.
- If files present: call `generateCardsWithVision(input, req.files)` **with 60-second timeout** (see Step 5)
- If text only: call existing `generateCards(input)`
- **Deck title fallback:** `const deckTitle = title || (input ? input.slice(0, 60).trim() + (input.length > 60 ? '...' : '') : 'Photo flashcards')`
- **Acquire DB connection only after AI call completes** (not before)
- Rest of flow (deck creation, card insertion) is identical

### Research Insights — Server Security & Performance

- **Magic byte validation is critical:** Multer's `file.mimetype` comes from the client's Content-Type header, which is trivially spoofable. An attacker can send any file with `Content-Type: image/jpeg`. The `file-type` package reads actual file signatures (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`). _(Source: Security Sentinel, Multer Security Research)_
- **`fileFilter` must throw Error, not return false:** Calling `cb(null, false)` silently skips the file. Always pass an `Error` to `cb` for rejections so the handler can return a meaningful error message. _(Source: Multer Security Research — multer issue #659)_
- **5MB per file instead of 10MB:** Client-side resize to 1568px JPEG produces 200-800KB files. 5MB is generous and halves worst-case memory. _(Source: Security Sentinel, Performance Oracle)_
- **Rate limiter on generate endpoint:** Currently unprotected. An attacker with a free account can flood 50MB multipart payloads. The per-day generation counter only runs after multer buffers files. _(Source: Security Sentinel)_
- **DB connection timing:** Do NOT acquire a pool connection before the Gemini API call. Gemini takes 15-30s for vision — holding a connection that long with a 12-connection pool will cause pool exhaustion at ~12 concurrent requests. Acquire only for the final DB write. _(Source: Performance Oracle)_
- **`fieldSize: 250 * 1024`:** Limits text field size in multipart requests to 250KB. Without this, an attacker can send a 1MB text string via multipart that bypasses `express.json()` limits. Set to 250KB (not 100KB) because the 50,000 character text limit can reach ~200KB with multi-byte UTF-8 characters (CJK, emoji). _(Source: Security Sentinel, Flow Analysis)_
- **Conditional multer (`optionalMulter`):** Multer must only run on `multipart/form-data` requests. If multer runs on a `application/json` request, it will not parse the body and `req.body` will be empty — breaking the existing text-only flow entirely. The conditional wrapper checks `req.is('multipart/form-data')` and skips multer for JSON requests. _(Source: Architecture Review, Flow Analysis)_
- **Multer error handling:** Multer throws `MulterError` with codes like `LIMIT_FILE_SIZE` and `LIMIT_FILE_COUNT`. Without explicit error handling, these surface as generic 500 errors. The `optionalMulter` wrapper catches these and returns user-friendly JSON responses with appropriate HTTP status codes (413, 400, 422). _(Source: Architecture Review, Security Review)_
- **CSRF `requireXHR` middleware:** Multipart POST is a CORS "simple request" — browsers send cookies without preflight. An attacker on another origin can craft a form that POSTs to `/api/generate` with the victim's session cookie. The `X-Requested-With` custom header forces a CORS preflight, which the server's CORS policy rejects for unauthorized origins. _(Source: Security Review)_
- **Concurrency semaphore:** Each vision request holds ~40-70MB of memory for 15-30 seconds. Without a limit, 10 concurrent vision users = 400-700MB — enough to OOM on Railway. The semaphore caps concurrent vision requests at 4, returning 503 with a retry message when full. _(Source: Performance Review)_
- **Rate limiter JSON response:** The default `express-rate-limit` response is plain text. The client's `request()` calls `res.json()` on errors, which fails to parse plain text. Configure `message: { error: "..." }` to match the API's JSON error format. _(Source: Flow Analysis)_
- **Null out buffers after encoding:** After `file.buffer.toString('base64')`, set `file.buffer = null` to allow garbage collection. This prevents holding both the raw buffer and the base64 string simultaneously. _(Source: Performance Oracle, Multer Security Research)_

---

### Step 5: Add vision generation to AI service

**`server/src/services/ai.js`** — new exported function using Gemini's proper SDK patterns:

```javascript
import { GoogleGenAI, Type } from '@google/genai';

// Lazy-initialized singleton — avoids creating a new SDK client per request
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
          back: { type: Type.STRING }
        },
        required: ['front', 'back']
      }
    }
  },
  required: ['cards']
};

export async function generateCardsWithVision(input, files) {
  const ai = getGeminiClient();

  // Build multimodal contents array
  const contents = [];
  const userPrompt = input?.trim() ? `Generate flashcards from these images.\n\nAdditional context: ${input}` : 'Generate flashcards from the content in these images.';
  contents.push(userPrompt);

  // Add image parts, null out buffers after encoding
  for (const file of files) {
    contents.push({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.detectedMime || file.mimetype
      }
    });
    file.buffer = null; // free memory immediately
  }

  // 60-second timeout — Gemini SDK retries up to 5 times with 60s backoff,
  // worst case a single request could hang 5+ minutes without this cap.
  // Timer must be cleared on success to prevent unhandled promise rejection.
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
          maxOutputTokens: 8192
        }
      }),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timeoutId);
  }

  const text = response.text;
  if (!text || text.trim().length === 0) {
    throw new Error('AI returned empty response. The image may have been blocked by content filters.');
  }

  const result = JSON.parse(text);
  if (!result.cards?.length) {
    // Custom error class to distinguish "no cards" from infrastructure failures
    const err = new Error('No flashcards could be generated from the provided images.');
    err.code = 'NO_CARDS';
    throw err;
  }

  return result.cards.slice(0, 30); // hard cap, same as text generation
}
```

**Note:** `parseCards()` is not used here because Gemini's `responseJsonSchema` enforcement guarantees valid JSON matching the schema at output — strictly stronger than `parseCards()`'s markdown-stripping and manual validation.

**No fallback to Groq** for vision requests. Error handling in the route:

```javascript
// Concurrency guard for vision requests
let cards;
if (req.files?.length) {
  if (activeVisionRequests >= MAX_CONCURRENT_VISION) {
    return res.status(503).json({ error: 'Photo processing is busy. Please try again in a moment.' });
  }
  activeVisionRequests++;
  try {
    cards = await generateCardsWithVision(input, req.files);
  } catch (err) {
    // "No cards" = content issue (blurry photos), not infrastructure failure
    if (err.code === 'NO_CARDS') {
      return res.status(422).json({ error: err.message });
    }
    return res.status(502).json({
      error: 'Photo processing failed. Try clearer photos, or remove them to generate from text.'
    });
  } finally {
    activeVisionRequests--;
  }
} else {
  try {
    cards = await generateCards(input);
  } catch (err) {
    // text-only errors handled by existing catch block
    throw err;
  }
}

// Deck title with fallback for photo-only generations
const deckTitle = title || (input ? input.slice(0, 60).trim() + (input.length > 60 ? '...' : '') : 'Photo flashcards');
```

### Research Insights — Gemini Vision API

- **`config.systemInstruction` instead of concatenating:** The Gemini SDK has a dedicated field for system instructions. Using it gives better instruction-following behavior than concatenating into the user prompt. _(Source: Gemini Vision Research, Context7 SDK Docs)_
- **`responseMimeType: 'application/json'` + `responseJsonSchema`:** Gemini enforces the JSON schema at output, guaranteeing valid JSON matching the schema. This eliminates the need for `parseCards()`'s markdown-stripping and JSON-recovery logic. _(Source: Gemini Vision Research)_
- **Temperature 0.2:** For extracting content from notes/textbooks, faithfulness matters more than creativity. 0.2 minimizes hallucination while allowing natural card phrasing. _(Source: Gemini Vision Research)_
- **`gemini-2.5-flash-lite` confirmed for vision:** Official docs confirm it supports text, images, audio, video, and PDF. It's the fastest and cheapest multimodal model in the 2.5 family. No model change needed. _(Source: Gemini Vision Research — Gemini Model Card)_
- **Token costs:** A typical phone photo at 1568px costs ~1,032 tokens (2 tiles). Five photos ≈ 5,000 tokens input. At free tier (250K TPM), that's ~50 requests/minute before hitting the token limit. The 15 RPM limit is the actual bottleneck. _(Source: Gemini Vision Research)_
- **Built-in retry:** The SDK automatically retries 429 and 5xx errors with exponential backoff (5 attempts, up to 60s delay). You only need to handle errors that exhaust retries. _(Source: Gemini Vision Research)_
- **`file.buffer = null` after encoding:** Release the raw buffer immediately after base64 encoding. Each 5MB file creates a ~6.7MB base64 string. Without nulling, both are held in memory simultaneously — peak 58MB for 5 files. With nulling, peak drops to ~40MB. Actual per-request memory is ~40-70MB depending on GC timing, not the previously claimed 200MB. _(Source: Performance Oracle)_
- **Use `file.detectedMime`:** After magic byte validation, use the verified MIME type (not the client-declared one) when sending to Gemini. _(Source: Security Sentinel)_
- **Module-scope Gemini client:** Instantiate `GoogleGenAI` once via lazy singleton, not per-request. Avoids connection pool churn and potential memory leaks from accumulated client instances under load. The existing `generateWithGemini` has the same per-request pattern — this fixes it for the vision path. _(Source: Security Review, Architecture Review)_
- **60-second request timeout via `Promise.race`:** The Gemini SDK retries up to 5 times with exponential backoff (up to 60s between attempts). Without a timeout, a single vision request could hang 5+ minutes, holding ~40-70MB of memory the entire time. `Promise.race` with a 60s timeout cap prevents zombie requests. The timer **must** be cleared in a `finally` block — a dangling `setTimeout` fires on every successful request, creating an unhandled promise rejection that crashes Node.js 22+ with `--unhandled-rejections=throw`. Note: the timeout does not cancel the underlying Gemini SDK call (it doesn't support `AbortSignal`), so an orphaned request may continue consuming memory until it naturally completes. This is bounded by the concurrency semaphore. _(Source: Performance Review, Security Review)_
- **`err.code = 'NO_CARDS'` for empty results:** Distinguishes "photos were unreadable" (content issue, 422) from "Gemini is down" (infrastructure issue, 502). Without this, blurry photos show "Photo processing is temporarily unavailable" — misleading the user into thinking the service is broken. _(Source: Flow Analysis)_

---

## Acceptance Criteria

### Core Functionality

- [x] User can upload 1-5 photos on the Generate page
- [x] Photos are previewed as thumbnails with remove buttons
- [x] User can submit photos alone (no text required)
- [x] User can submit photos + text together
- [x] Text-only generation works exactly as before (no regression)
- [x] Photo generations count toward the same daily generation limit
- [x] Mobile users can use camera capture to take photos directly
- [x] Loading state shows appropriate message for photo uploads (~10-20 seconds)
- [x] Deck title defaults to "Photo flashcards" when no text or title provided

### Client-Side

- [x] Photos are resized to 1568px max and JPEG quality 1.0 client-side before upload
- [x] Images processed sequentially on client (not parallel)
- [x] File input does NOT include `image/heic` (iOS auto-converts)
- [x] `URL.revokeObjectURL` called on photo removal and component unmount
- [x] Double-submit prevented via `useRef` guard (not just `disabled` prop)
- [x] Resize failure shows toast error, does not crash
- [x] Photo upload button hidden in browsers without `createImageBitmap` support
- [x] Upload/remove buttons have `aria-label` attributes; preview thumbnails have `alt` text
- [x] `X-Requested-With: XMLHttpRequest` header sent on all requests (JSON and FormData)

### Server Security

- [x] Server validates `X-Requested-With: XMLHttpRequest` header (CSRF defense)
- [x] Server validates file magic bytes (not just MIME type) via `file-type`
- [x] Server enforces 5MB per file, 5 files max
- [x] Multer errors (file too large, too many files, unsupported type) return user-friendly JSON, not 500
- [x] Multer only runs on `multipart/form-data` requests (JSON requests bypass multer)
- [x] Rate limiter on generate endpoint (30 req/15 min per IP) with JSON error response
- [x] Input text limited to 50,000 characters (both JSON and multipart paths)
- [x] Title limited to 200 characters

### Server Performance

- [x] Vision requests use Gemini with JSON schema enforcement
- [x] DB connection acquired only after AI call (not during)
- [x] `file.buffer` nulled after base64 encoding
- [x] Concurrency semaphore limits simultaneous vision requests (default 3, configurable via `MAX_CONCURRENT_VISION` env var)
- [x] 60-second timeout on Gemini API call prevents zombie requests
- [x] Gemini SDK client instantiated once (module-scope singleton), not per-request

### Error Handling

- [x] If Gemini fails on a photo request, user sees "Photo processing failed" (502)
- [x] If photos produce no cards (blurry/unreadable), user sees specific message (422)
- [x] If vision concurrency limit reached, user sees "Photo processing is busy" (503)
- [x] If rate limit hit, user sees JSON error (not plain text)

### Pre-Launch Validation

- [ ] Test 5 worst-case photos (800KB each, ~4MB total) through Vercel proxy in staging

## Success Metrics

- Photo-to-card generation produces readable, relevant flashcards from handwritten notes and textbook pages
- No regression in text-only generation speed or quality
- Upload + generation completes in under 30 seconds for 5 photos on a typical connection
- Server memory stays under 70MB per vision request (~210MB + baseline at 3 concurrent, safe within Railway 512MB free tier)

## Dependencies & Risks

| Risk                                            | Mitigation                                                                                                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini vision quality varies with image quality | Vision prompt handles blurry images. JSON schema enforces output format. Temperature 0.2 for faithfulness. Distinct 422 error for "no cards generated" vs 502 for infrastructure failure. |
| Large uploads on slow mobile connections        | Client-side resize to 1568px reduces 5 photos from ~40MB to ~1-4MB total                                                                                                                  |
| Server memory pressure from concurrent uploads  | 5MB file limit, buffer nulling, rate limiter, **concurrency semaphore (default 3, env-configurable)**, 60s request timeout, `parts: 15` limit on multer                                   |
| iOS Safari canvas memory crashes                | Sequential processing, bitmap.close(), canvas cleanup (1x1), createImageBitmap feature detection                                                                                          |
| MIME type spoofing / malicious file upload      | Magic byte validation via `file-type`, fileFilter rejects non-images                                                                                                                      |
| CSRF on multipart endpoint                      | **`X-Requested-With` header required on all requests + validated server-side.** Custom header forces CORS preflight, which server rejects for unauthorized origins.                       |
| JPEG chroma subsampling blurs text              | Quality 1.0 at 1568px avoids subsampling while keeping files small (200-800KB)                                                                                                            |
| DB connection pool exhaustion during AI calls   | Acquire connection only after Gemini returns, not before                                                                                                                                  |
| JSON/multipart coexistence on same route        | Conditional multer middleware (`optionalMulter`) only runs on multipart requests; JSON text-only requests bypass multer entirely                                                          |
| Multer errors surface as 500                    | Error-handling callback in `optionalMulter` maps `MulterError` codes to user-friendly JSON responses                                                                                      |
| Vercel proxy body limit (~4.5MB)                | Client-resized photos are 200-800KB each (~1-4MB total for 5). Validate with 5 worst-case photos in staging before launch.                                                                |
| Zombie vision requests from Gemini SDK retries  | 60-second `Promise.race` timeout caps total wall-clock time per request                                                                                                                   |
| Photo-only generation with no title             | Deck title falls back to "Photo flashcards" when no text input or explicit title provided                                                                                                 |
| Double-submit on slow connections               | `useRef` guard in `handleGenerate` prevents re-entry before React re-renders                                                                                                              |

## Token Cost Reference

| Image scenario                         | Tiles | Tokens                     | Cost at Gemini free tier |
| -------------------------------------- | ----- | -------------------------- | ------------------------ |
| Small screenshot (≤384px)              | 1     | 258                        | negligible               |
| Phone photo at 1568px                  | 2-4   | 516-1,032                  | ~$0.0001                 |
| 5 phone photos at 1568px               | 10-20 | 2,580-5,160                | ~$0.0005                 |
| Gemini 2.5 Flash-Lite free tier limits | —     | 250K TPM / 15 RPM / 1K RPD | —                        |

## References & Research

- Brainstorm: `docs/brainstorms/2026-03-13-photo-upload-ai-vision-brainstorm.md`
- Existing AI service: `server/src/services/ai.js`
- Existing generate route: `server/src/routes/generate.js`
- Existing generate page: `client/src/pages/Generate.jsx`
- Existing API wrapper: `client/src/lib/api.js`
- [Gemini SDK (`@google/genai@0.14.1`)](https://github.com/googleapis/js-genai) — `contents` accepts mixed text + `inlineData` parts
- [Gemini Image Understanding Docs](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [multer (Express middleware)](https://github.com/expressjs/multer)
- [file-type (magic byte detection)](https://www.npmjs.com/package/file-type)
- [iOS Safari Canvas Memory Limits (PQINA)](https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit)
- [JPEG Chroma Subsampling in Canvas (whatwg/html #5395)](https://github.com/whatwg/html/issues/5395)
