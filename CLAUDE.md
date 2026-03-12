# Apps Workspace

Indie app development workspace. The goal is to build and ship revenue-generating apps, automating as much of the process as possible with Claude Code.

## Playbook

The operating manual lives at `research/indie-ios-app-playbook.md`. It defines 7 phases:

1. **Niche Discovery** — identify underserved markets using demand signals, review mining, and market sizing
2. **Validation** — competitive teardowns, user conversations, smoke tests
3. **Build MVP** — one core feature, subscription monetization from day one
4. **Pre-Launch ASO** — keyword strategy, store listing assets, localization
5. **Launch** — TestFlight soft launch, App Store submission, review seeding
6. **Growth** — monthly ASO cycles, community marketing, data-driven iteration
7. **Scale / Portfolio** — expand to 2-4 focused apps with cross-promotion

## Automation Goals

Claude Code should assist across all phases, with Phase 1 (Niche Discovery) as the first automation target:

- **Research automation**: scrape and analyze App Store reviews, Reddit threads, Google Trends, and auto-complete suggestions
- **Market sizing**: structure demand signals into the $500K market sizing formula
- **Competitive analysis**: catalog competitor apps, ratings, update frequency, pricing, and complaint patterns
- **Keyword research**: identify high-volume, low-competition keywords from multiple sources
- **Validation artifacts**: generate structured reports for each candidate niche

## Current Apps

### ai-notecards (`ai-notecards/`)

AI-powered flashcard app. Paste notes or type a topic, AI generates study flashcards.

- **Frontend**: React (Vite), Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **AI**: Claude (Anthropic API)
- **Payments**: Stripe (scaffolded)

## Conventions

- Each app gets its own subdirectory with a `CLAUDE.md` describing its stack and conventions
- Research docs, playbooks, and strategy artifacts go in `research/`
- Prefer simple stacks: minimize dependencies, use proven tools
- Monetization infrastructure (RevenueCat, Stripe, etc.) should be set up before building features
- Ship MVPs in 4-8 weeks — one core feature done well, not many features done poorly
- All apps should track retention and conversion as primary metrics
