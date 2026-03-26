# Scope Pilot: Transcription + image observation pipeline

> completed on 2026-03-23 18:00 PT

**engineering**

Build the AI intake pipeline that processes uploaded walkthrough audio and photos.

**Depends on:** Task #440810 (schema) and the walkthrough intake task (file uploads to R2) must be completed first.

---

## What to build

### Audio transcription endpoint

API route that:

- Takes a walkthrough ID, finds all audio assets from `walkthrough_assets`
- Sends audio to transcription provider (Whisper API or equivalent)
- Saves transcript text to `walkthrough_transcripts` table, linked to source asset
- Logs the operation in `generation_logs` (`step_name='transcription'`, `model_name`, `status`)
- Handles failures gracefully — save error status, allow retry
- Returns transcript text to frontend

### Image observation endpoint

API route that:

- Takes a walkthrough ID, finds all photo assets from `walkthrough_assets`
- Sends photos to vision-capable model (GPT-4o or equivalent)
- Uses this prompt for each image: _"You are reviewing photos taken during a commercial cleaning site walkthrough. Your task is to identify visible observations relevant to drafting a cleaning scope. Focus on: room or area type, visible flooring type, visible restroom fixtures/count hints, breakroom or kitchen indicators, glass/entry/lobby/hallways, trash/recycling presence, high-touch surfaces, visible special conditions, anything that needs confirmation."_
- Saves image observations into `generation_logs` (`step_name='image_observation'`)
- Handles low-quality or unrecognizable images gracefully — note limitations rather than inventing details
- Returns observations to frontend

### UI integration

On the walkthrough detail or review page:

- Show transcription status (pending/processing/complete/failed)
- Display transcript text when available
- Show image observation summaries
- "Retry" button for failed transcriptions
- Processing indicator while AI is working

### Pipeline trigger

After user submits a walkthrough (moves from draft), automatically kick off transcription and image observation in parallel.

---

## Key constraints

- Never fabricate details from images — report visible observations only
- Log every AI call in `generation_logs` for debugging and evaluation
- Abstract provider calls behind service modules for future swapability (Risk 14 mitigation)

**Tech:** Express API, R2 for reading uploaded files, external AI APIs for transcription and vision.

---

Results:

The AI intake pipeline is live at mintapps.polsia.app.

What's working end-to-end:

Submit a walkthrough → audio and photos are automatically sent to AI in parallel (no waiting)
Audio files transcribed via Whisper — transcripts stored per-asset, displayed on the review page
Photos analyzed via GPT-4o with the site walkthrough observation prompt — results stored in generation_logs
Every AI call logged with model, duration, tokens, and cost for full debuggability
The review page shows live per-asset status (processing → complete / failed) with 3-second auto-polling
Retry button on any failed asset; "Re-run all" button to re-process everything
This is the core AI layer — the pipeline that turns messy voice memos and photos into structured text ready for extraction. Task #440924 (structured extraction + review/edit screen) is the logical next step.
