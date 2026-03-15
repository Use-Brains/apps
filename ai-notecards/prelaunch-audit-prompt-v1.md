You are a principal engineer, product-minded auditor, mobile/web UX reviewer, security reviewer, QA lead, and launch readiness strategist.

I am at the root of my app repository. Your job is to thoroughly inspect this codebase and tell me exactly what remaining work needs to be done before this app is ready to market aggressively.

Do not give me a shallow summary. I want a serious launch-readiness audit based on the actual repository state.

## Product context

App name: AI Notecards

Tagline: AI-powered flashcard app with marketplace

Description:
Users can paste notes or type a topic, and AI generates study flashcards. Users can also buy and sell decks on a marketplace.

Current known context:

- There is a web app that has had substantial work done.
- There is also some iOS app work started, but I know it is incomplete and likely needs more work.
- I want to know what remains before I can confidently begin marketing this app.
- The standard is not merely “acceptable” or “industry standard.” I want the app to be clean, smooth, polished, trustworthy, and clearly above average compared with modern high-quality apps.

Current stack from PRD:

- Frontend: React 19, Vite 6, Tailwind CSS 3, react-router-dom v7, react-hot-toast, @react-oauth/google
- Backend: Node.js ES modules, Express 4, bcrypt + JWT via httpOnly cookies, multer memory storage, express-rate-limit, file-type validation
- Database: PostgreSQL on Supabase, custom migrations
- AI: Groq (llama-3.3-70b-versatile) primary, Google Gemini fallback, Gemini vision for photo-to-flashcard
- Payments: Stripe Checkout, Stripe Connect Express, destination charges, 50/50 split, platform + connect webhooks
- Storage: Supabase Storage
- Email: Resend for passwordless auth / magic link codes
- Deployment: Vercel frontend, Railway backend, Supabase PostgreSQL/storage, Sentry, Resend

## What I want you to do

Perform a full repo audit and produce a launch-readiness report.

You should inspect:

1. Product completeness
2. Web app completeness
3. iOS app completeness
4. UX / UI polish
5. Performance
6. Reliability / error handling
7. Security
8. Auth flows
9. Payments / subscriptions / marketplace flows
10. Email flows
11. AI generation quality and fallbacks
12. Database / migrations / production safety
13. Logging / observability / Sentry coverage
14. Environment config / secrets / deploy readiness
15. Analytics / marketing readiness
16. QA / testing readiness
17. App Store readiness for iOS
18. Legal / trust / support readiness if applicable
19. Anything else that would block a high-quality launch

## Important instructions

- Base your conclusions on the real codebase, not generic assumptions.
- Be skeptical and detail-oriented.
- Trace actual flows end-to-end where possible.
- Look for unfinished work, TODOs, placeholders, stubs, dead routes, mock data, incomplete settings pages, partial mobile screens, missing backend integration, broken edge cases, and weak production practices.
- Identify gaps between “works locally” and “ready for public users.”
- Identify anything that would create a poor first impression during marketing.
- Identify anything that would hurt retention, conversion, trust, app reviews, or operational stability.
- Evaluate whether the app feels premium and polished, not just functional.
- For iOS, specifically determine:
  - whether it is truly viable yet
  - what remains for MVP parity with web
  - whether it should launch now, later, or behind the web app
  - whether there are App Store blockers
- Call out where the current implementation appears good enough versus clearly below a launch-worthy bar.
- Prefer concrete evidence from files, routes, components, schema, config, and tests.

## Standards to evaluate against

Judge the app against a high bar:

- modern product quality
- smooth onboarding
- fast perceived performance
- polished UX
- strong empty/loading/error states
- mobile responsiveness
- production-safe backend behavior
- trustworthy auth + payments
- clear user value proposition
- low-friction activation
- retention-supporting core loops
- marketplace trust and safety basics
- premium-feeling details
- launch readiness for real users, not just friendly beta testers

Do not only assess “is this functional?”
Also assess:

- is this delightful?
- is this trustworthy?
- is this cohesive?
- is this conversion-friendly?
- is this resilient under real usage?
- is this good enough that marketing would amplify something strong rather than expose weaknesses?

## Specific deliverables

Produce your output in the following structure:

# 1. Executive verdict

Give me:

- overall launch-readiness score out of 10
- web app readiness score out of 10
- iOS readiness score out of 10
- confidence level in the audit
- whether I should start marketing now, after a short polish phase, or only after significant work

# 2. What is already strong

List the areas that appear solid and launch-helpful.

# 3. Critical blockers before marketing

List the issues that should be fixed before I actively market the app.
These should be the highest-severity gaps.

For each blocker include:

- title
- why it matters
- evidence from codebase
- affected platform: web / iOS / backend / infra / cross-platform
- severity: critical / high / medium
- recommended fix
- rough effort: XS / S / M / L

# 4. Remaining work by category

Break down all remaining work into categories such as:

- core product
- onboarding / activation
- flashcard generation flow
- marketplace
- subscriptions / payments
- auth
- profile / settings
- mobile responsiveness
- iOS app
- performance
- analytics
- trust / legal / support
- QA / testing
- deployment / ops
- observability
- App Store readiness

# 5. Web app polish review

Review the web app specifically for:

- UX smoothness
- consistency
- visual polish
- responsiveness
- loading states
- empty states
- error states
- form quality
- conversion friction
- accessibility basics
- premium feel
- anything that feels amateur, dated, clunky, brittle, or inconsistent

# 6. iOS app review

Review the iOS app specifically for:

- current scope and completeness
- missing screens / flows
- missing integrations
- UX quality
- architectural soundness
- whether it is shippable
- exact remaining work to reach launch quality
- whether it should be marketed yet

# 7. Security and trust review

Review:

- auth/session handling
- cookie security
- API protections
- upload handling
- Stripe webhook safety
- Supabase/storage exposure risks
- rate limits / abuse risks
- marketplace fraud/trust issues
- email auth risks
- secrets/config handling
- privacy basics

# 8. Production readiness review

Assess:

- environment setup
- deploy assumptions
- migration safety
- rollback risk
- logging
- monitoring
- Sentry coverage
- background jobs / retries if any
- error boundaries
- failure handling for AI, payments, email, storage, and webhooks

# 9. Missing analytics / growth readiness

Tell me what is missing before marketing from a growth perspective, such as:

- product analytics
- funnel tracking
- attribution basics
- onboarding metrics
- activation metrics
- retention metrics
- subscription metrics
- marketplace metrics
- support/contact flows
- feedback collection
- SEO / landing readiness if relevant
- referral / waitlist / sharing hooks if relevant

# 10. Prioritized action plan

Create a prioritized launch plan with:

- Phase 1: must fix before marketing
- Phase 2: should fix very soon after launch
- Phase 3: nice-to-have polish / optimization

For each task include:

- task
- reason
- impacted platform
- severity
- effort
- dependencies

# 11. Fastest path to “ready to market”

Give me the minimum realistic set of changes required to reach a strong launch threshold without overbuilding.

# 12. Exceed-the-standard recommendations

Tell me what would make this app feel truly top-tier rather than merely competent.
Focus on details that create a premium, modern, high-trust experience.

# 13. Final go/no-go recommendation

Tell me plainly:

- Can I market the web app now?
- Can I market the iOS app now?
- If not, what exact items stand between today and a confident launch?

## Audit method

As you work:

- inspect package files, lockfiles, configs, routes, components, pages, hooks, services, migrations, schemas, API endpoints, env examples, tests, CI/CD, mobile folders, native configs, Stripe/Supabase/Sentry/Resend integrations, and any PRD/docs if present
- search for TODO, FIXME, XXX, HACK, mock, placeholder, temp, later, not implemented
- note missing tests and missing guards
- infer product flows from code, not just docs
- identify abandoned or half-built features
- flag duplicated or messy areas that may cause launch risk
- call out assumptions clearly when evidence is incomplete

## Output style

- Be direct and high signal.
- Prefer concrete findings over generic advice.
- Use bullets and tables where useful.
- Reference specific files and code locations whenever possible.
- Separate evidence-backed findings from reasonable inferences.
- Do not be overly polite or vague. I want a real audit.
- Do not rewrite the app for me yet unless necessary.
- Focus on what remains to be done before marketing and what quality bar I am actually at today.

Begin by mapping the repo structure, identifying web and iOS surfaces, and then produce the full audit.

Before writing the final audit, create a concise inventory of:

- all major user-facing flows
- which flows exist on web
- which flows exist on iOS
- which flows appear incomplete
- which flows appear untested

At the very end, include a “7-day launch sprint” plan and a “30-day post-launch hardening” plan.
