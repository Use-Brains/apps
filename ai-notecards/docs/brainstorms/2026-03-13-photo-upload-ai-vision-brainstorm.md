# Photo Upload + AI Vision Generation

<!-- FINISHED -->

**Date:** 2026-03-13
**Status:** Brainstorm complete

## What We're Building

Allow users to upload up to 5 photos alongside text input when generating flashcards. The AI reads the photos (notes, textbooks, whiteboards, diagrams) and generates flashcards from the combined text + image content.

This is the **first phase** of a larger photo feature. Phase 2 (future) would add displaying images on card fronts/backs as visual aids.

## Why This Approach

**Gemini-only for photo requests (Approach A):**

- Route photo-containing requests to Gemini (`gemini-2.5-flash-lite`), which natively supports vision input
- Text-only requests continue using Groq (`llama-3.3-70b-versatile`) as primary
- Photos are base64-encoded on the server and sent directly to Gemini — no storage infrastructure needed
- Gemini SDK (`@google/genai`) is already a dependency in the project

**Rejected alternatives:**

- Groq vision models — newer, less battle-tested, may differ in card generation quality
- OCR-then-text pipeline — two API calls (slower), loses visual context from diagrams/charts

## Key Decisions

1. **MVP scope: AI reads photos only** — no image display on cards yet (Phase 2)
2. **Up to 5 photos per generation** — covers multi-page notes
3. **Text + photos together** — user can type context AND attach photos in the same generation
4. **Gemini handles all photo requests** — Groq stays primary for text-only
5. **FormData/multipart upload** — standard file upload via `multer` on server. More efficient than base64 (no 33% bloat). New dev dependency.
6. **No storage infrastructure** — photos are transient (sent to AI, not persisted). No Supabase Storage needed for Phase 1.
7. **Fail clearly if Gemini is down** — if photo processing is unavailable, show error: "Photo processing is temporarily unavailable. Remove photos to generate from text only, or try again in a few minutes." No silent fallback.
8. **BYOK (future): disable photos for non-vision models** — when BYOK is implemented, photo upload will be greyed out with a tooltip for text-only models. No fallback to platform models.

## Cost Analysis

- Gemini vision input: ~$0.0001 per image (~260 tokens per photo)
- Per generation with 5 photos: ~$0.003-0.005 total
- At 100 users, 5 gens/day: ~$0.45-0.75/day
- Essentially negligible cost impact

## Scope of Changes

- **Client Generate page:** Add file input (up to 5 photos), image preview/remove, camera capture support for mobile (`capture="environment"`), send as `FormData`
- **Client API wrapper (`api.js`):** New method that sends `FormData` instead of JSON for photo generations
- **Server generate route:** Add `multer` middleware for multipart parsing, extract photos + text, route to vision or text AI accordingly
- **AI service (`ai.js`):** New `generateWithVision(input, images)` function that sends text + image parts to Gemini vision API. Prompt should handle bad images gracefully (blurry, irrelevant content).
- **Server dependency:** Add `multer` for multipart form parsing
- **No database changes** — cards remain text-only for Phase 1
- **No storage changes** — photos are transient (sent to AI, not persisted)

## Open Questions

- Should photo generations count the same toward daily limits, or cost more (e.g., 2 credits per photo gen)?
- Max file size per photo? Gemini accepts up to 20MB but should cap at 5-10MB for UX. Multer config enforces this server-side.
- Should we compress/resize photos on the client before upload to reduce bandwidth? (Canvas API resize to ~1500px wide is common)
- Accepted image formats: JPEG, PNG likely minimum. HEIC (iPhone) — does Gemini accept it natively or do we need server-side conversion?
- Should text input be required when uploading photos, or optional? (e.g., user uploads a whiteboard photo with no additional context)

## Phase 2 (Future)

- Display images on card fronts/backs as visual aids
- Requires: Supabase Storage bucket, `image_url` columns on cards table, image rendering in Study/DeckView pages
- Estimated additional cost: Supabase Storage free tier (1GB/2GB bandwidth)
