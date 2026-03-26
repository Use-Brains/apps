# Next.js App Blueprint

## Recommended stack
- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Supabase Postgres
- Supabase Auth
- Supabase Storage

## Route map
- `/` landing page
- `/dashboard` walkthrough list
- `/walkthroughs/new` new walkthrough intake
- `/walkthroughs/[id]/review` extracted details review
- `/walkthroughs/[id]/outputs` generated outputs
- `/settings/company` company defaults

## Core server actions or API routes
- createWalkthrough()
- uploadWalkthroughAsset()
- transcribeWalkthroughAudio()
- summarizeWalkthroughPhotos()
- extractWalkthroughData()
- updateExtractedWalkthrough()
- generateBidPackage()
- saveCompanyPreset()

## Pipeline
1. User submits walkthrough
2. Audio is transcribed
3. Images are summarized
4. Structured JSON is extracted
5. User reviews and edits extracted data
6. Final outputs are generated from approved structured data
