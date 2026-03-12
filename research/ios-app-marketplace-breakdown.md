# iOS App Marketplace: Full Market Breakdown (March 2026)

---

## The Big Picture

The Apple App Store is a massive economy. Consumer spending on iOS reached roughly $117.6 billion in 2025, with the U.S. alone accounting for around $43 billion. There are approximately 1.9 million apps in the store, with about 1,250 new ones published daily. Around 1.56 billion iPhones are active globally, and the average U.S. iOS user spends about $140/year on apps.

The critical thing to understand: iOS users spend roughly **twice** what Android users do per app. This is why iOS-first is the default strategy for any subscription or IAP-based app — the audience has higher purchasing power and willingness to pay.

---

## How the Money Actually Works

### Apple's Cut

- **Standard commission:** 30% of all digital goods sold through In-App Purchase
- **Small Business Program:** 15% commission if you earn under $1M/year in proceeds (the vast majority of indie devs qualify)
- **Subscriptions after year one:** 15% (regardless of your revenue tier)
- **EU alternative terms:** As low as 10-13% under Digital Markets Act provisions
- **Mini Apps Partner Program (new Nov 2025):** 15% for qualifying web-based mini apps hosted within other apps
- **Developer Program fee:** $99/year

So for a solo dev earning under $1M, the effective take rate is 15%. On subscriptions you've retained past year one, it stays at 15% even if you exceed $1M. This is significantly better than it used to be.

### Post-Epic Games Ruling (April 2025)

Apple can no longer force developers to exclusively use IAP for U.S. purchases. You're now allowed to link users to external websites for purchases. However, RevenueCat ran one of the first large-scale A/B tests on this and found something important: **in-app purchases convert about 25-35% better than web-based flows.** The one-tap convenience of Apple Pay through IAP is hard to beat. Most apps still make more money going through Apple's system despite the commission, because the conversion lift outweighs the fee savings.

### Revenue Models That Work

**Subscriptions dominate.** Subscription-based apps represent roughly 44% of all App Store revenue. The model works because it aligns recurring value with recurring payment. About 95% of apps are free to download, using one or more of these monetization strategies:

- **Subscriptions:** The gold standard for apps delivering ongoing value. Health, fitness, productivity, education, and AI tools lean heavily on this.
- **In-App Purchases (consumable):** Dominant in gaming — virtual currencies, lives, power-ups. AI apps are increasingly using credit-based systems here too.
- **Freemium with IAP:** Free core + paid premium features. The most flexible model for indie devs.
- **Hybrid:** Combining subscription + consumable IAP + occasional ads. Becoming the norm among top-performing apps.
- **Advertising only:** Difficult unless you have massive scale. Revenue per user is low, and CPMs have been declining for non-premium placements.
- **Paid upfront:** Functionally dead for most categories. Only 4.6% of apps charge upfront, and users overwhelmingly prefer try-before-you-buy.

---

## Revenue by Category (2025 iOS Estimates)

Here's where the money actually flows on iOS, based on aggregated data from multiple sources:

| Category | Estimated iOS Revenue | Notes |
|---|---|---|
| Gaming | ~$52-82B | Still the single largest category by far. ~60% of all App Store revenue. |
| Social Networking | ~$16.7B | TikTok alone did ~$3B. Snapchat's premium subscription is the top social earner. |
| Entertainment / Streaming | ~$12.5B | YouTube, Disney+, HBO Max. Subscription-driven. |
| Shopping / E-commerce | ~$9.3B | Temu, Amazon. Transaction-driven. |
| Health & Fitness | ~$6.3B | Growing 24% YoY. MyFitnessPal and Strava lead. |
| Finance | ~$5.6B | Fintech apps, budgeting tools. |
| Productivity & Business | ~$4.8B | Notion, productivity suites. |
| Dating | ~$4.1B | Tinder ($1.2B alone), Bumble ($394M). |
| Generative AI | ~$5B+ | Nearly tripled YoY. ChatGPT dominates. |
| Education | ~$3.2B | Duolingo ($563M) far ahead of competitors. |
| Photo & Video | Significant | CapCut earned $815M in 2025. |
| Lifestyle | ~$2.6B+ | Broad category; subscriptions growing fast. |

---

## What's Oversaturated (High Competition, Diminishing Returns)

### Extremely Crowded — Avoid Unless You Have a Massive Edge

**Generic to-do / task management apps.** Hundreds of them. Competing with Apple Reminders, Todoist, Things 3, TickTick, and many others. Users have strong loyalty to their existing tool. Discovery is near-impossible without significant marketing spend.

**Basic weather apps.** Apple's built-in Weather app has improved dramatically. The market leaders (Weather Underground, Carrot Weather, etc.) have loyal users. Low willingness to pay in a category where the free default is good enough.

**Simple calculators and unit converters.** Commoditized. No monetization path unless you add significant unique value.

**Generic social media apps.** The "next Facebook/Instagram/TikTok" is a trap. Network effects make these winner-take-all markets. Even well-funded startups fail here.

**Casual puzzle/match-3 games.** While gaming is the largest revenue category overall, casual games are brutally competitive. Candy Crush has been dominant for over a decade. The genre requires massive UA budgets to compete. Installs grew 3% YoY but average session length increased 15% — users are sticking with existing games, not trying new ones.

**Basic meditation/mindfulness apps.** Headspace and Calm have locked up the general market. The generic "calm sounds and guided meditation" app is saturated.

**Generic photo editors.** The free tier from Snapseed, Apple Photos, and others covers most casual needs. CapCut dominates the creative/video space.

**Standard note-taking apps.** Apple Notes, Notion, Obsidian, Bear — the general-purpose market is full. Users rarely switch.

### Crowded but Still Possible with the Right Angle

**Fitness/workout apps.** Crowded in general, but niche verticals within fitness still work. More on this below.

**Habit trackers.** Many exist, but there's room if you deeply serve a specific use case rather than generic "track any habit."

**Budget/expense tracking.** Incumbents are strong, but niche audiences (freelancers, specific demographics, multi-currency users) remain underserved.

---

## What's Underserved (Genuine Opportunities)

### High-Growth Categories with Room for Indie Devs

**Femtech and Women's Health.** Industry experts identify this as one of the strongest growth categories for 2026. Period tracking apps are evolving beyond simple calendars into intelligent health companions. Niche opportunities include hormonal health management, fertility tools, pelvic floor health, menopause-specific wellness, and life-stage-specific experiences. The broad players serve everyone poorly; the focused players are winning.

**AI-Enhanced Utility Tools.** Generative AI app downloads doubled YoY to 3.8 billion, and IAP revenue nearly tripled to over $5 billion. But most AI apps are generic ChatGPT wrappers. The opportunity is in AI applied to a specific workflow: AI-powered document scanning that actually categorizes and files things, AI writing tools for a specific profession, AI meal planning that integrates with grocery delivery. The wrapper approach is dying; the deep integration approach is thriving.

**Health & Fitness Micro-Niches.** Health & fitness grew 24% YoY and generates $6.3B+. The general market is competitive, but highly specific audiences are underserved: fitness for seniors, exercise programs for people with chronic conditions, sleep tools for shift workers, nutrition tracking for specific dietary needs (kidney disease diets, FODMAP tracking), post-surgical rehabilitation guidance.

**Creator Economy Tools.** YouTubers, podcasters, newsletter writers, and social media creators need specialized tools for production, scheduling, analytics, and monetization. Creator tools often command premium subscription prices because they pay for themselves — the user makes money with the tool, so they're willing to pay.

**Vertical B2B Utilities Disguised as Consumer Apps.** Construction payment tracking, specialized invoicing for specific trades, compliance tools for niche industries. Markets worth $500K/year that big companies will never pursue — but that's life-changing money for a solo dev.

**Utilities with Deep Apple Integration.** Apps that leverage HealthKit, Shortcuts, Widgets, Live Activities, and other Apple-specific APIs well have a natural competitive moat. The more deeply integrated with iOS, the harder to replicate and the stickier the user base.

**Localized/Regional Apps.** Hyper-local knowledge is a competitive moat that big companies can't easily replicate. Tools serving specific regional needs, local business types, or cultural use cases.

---

## The Indie Developer Reality Check

The data paints a realistic — sometimes harsh — picture for individual developers:

### Retention Is the Existential Challenge

Only about 25% of users return after day one. By day 30, just 3.7% are still active. Over 90% of users churn within the first month. This means your onboarding experience and immediate value proposition matter more than almost any feature you could build. The apps that win are the ones that deliver obvious value in the first session.

### Revenue Distribution Is Extremely Skewed

RevenueCat's 2026 State of Subscription Apps report shows that the top 10% of apps grew 306% while the median grew just 5.3%. Apps launched before 2020 account for 69% of all subscription revenue. Apps launched in 2025 or later contribute just 3% despite a massive surge in new supply. The app economy is very much a "rich get richer" environment.

### Marketing Beats Code, Every Time

One indie developer's 2025 recap is instructive: 8 apps shipped, $1,464 total revenue, with the best-performing app earning about $700. The consistent lesson across every indie developer postmortem: a great app nobody knows about is invisible. ASO (App Store Optimization), content marketing, community building, and distribution strategy matter as much as the product itself.

### New Subscription App Launches Are Exploding

Monthly subscription app launches have grown roughly 7x since early 2022, reaching over 14,700 per month by January 2026. iOS accounts for about 77% of these. AI-assisted development tools have dramatically lowered the barrier to building and shipping apps, which means more competition than ever.

### But Small Niches Still Work

A market worth $500K/year isn't worth a big company's time, but for a solo developer it's transformative. The key insight from successful indie developers: specificity beats scale. A workout app for people with arthritis will outperform a generic workout app from a solo dev, because the large generic audience is already served and the specific audience is grateful for something built for them.

---

## Conversion and Pricing Benchmarks

### What Gets People to Pay

- **Hard paywalls convert 5x better than freemium** (10.7% vs 2.1% download-to-paid by day 35) with nearly identical year-one retention. However, freemium still makes sense when free users drive word-of-mouth or network effects.
- **80% of trial starts happen on day one.** If users don't start a trial in their first session, they likely never will. Your paywall placement and messaging in onboarding is critical.
- **Trial-to-paid conversion varies dramatically by category:** Health & Fitness leads at 35%, while Entertainment trails at 19.1%.
- **Weekly plans convert 1.7-7.4x better than annual plans.** They also now generate 55.5% of all subscription app revenue (up from 43.3% in 2023). But weekly plans have terrible long-term retention — only about 40% make it past three renewals vs. ~52% for monthly.

### Pricing Benchmarks (Global Medians)

- Weekly: ~$7.48
- Monthly: ~$12.99
- Annual: ~$38.42

Higher prices don't necessarily kill conversion. High-tier weekly plans generate 5.2x more revenue per install than low-tier ones. European apps charge 29-39% more than North American ones.

### Subscription Retention

- Annual trial subscribers: 19.9% still active at day 380
- Monthly trial subscribers: 14.2% at day 380
- Weekly trial subscribers: 5.5% at day 380
- Trial subscribers retain 1.4-1.7x better than direct buyers across all plan types
- Utilities have the best first-renewal retention at 58.1%; Health & Fitness has the worst at 30.3%

---

## Strategic Playbook: What Actually Works for Smaller Developers

### 1. Pick a Niche You Understand Deeply

Domain expertise is your biggest advantage. You'll build a better product for an audience you're part of because you understand their pain points intuitively. Big companies can't replicate lived experience.

### 2. Validate Before You Build

Check competition levels, estimated revenue, and user demand before writing a line of code. Tools like RevenueCat's reports, Sensor Tower, and niche research tools can show you what competitors earn and how they monetize.

### 3. Subscription-First, Free Trial, Hard Paywall

The data overwhelmingly supports this: offer a free trial with a hard paywall in onboarding. Most of your trial starts will happen day one. Make the value proposition immediately obvious.

### 4. Invest in ASO Like It's Your Job

App Store Optimization — keywords, screenshots, app name, subtitle, description — is your primary organic discovery channel. Localized listings increase installs by up to 49%. Most indie devs underinvest here.

### 5. Build for Retention, Not Downloads

Downloads mean nothing if nobody sticks around. Personalization, regular updates, push notifications done well (not spammy), and genuine ongoing value are what separate apps that make money from apps that don't.

### 6. Consider a Portfolio Approach

Rather than going all-in on one app, some successful indie devs build multiple smaller apps targeting different niches. This diversifies risk and gives you more surface area for learning what works.

### 7. Leverage Apple's Ecosystem

Deep integration with iOS features (Widgets, Shortcuts, HealthKit, iCloud sync, Live Activities) creates stickiness and differentiates you from cross-platform competitors. Apple also tends to feature apps that showcase its platform capabilities.

---

## Emerging Trends to Watch

- **Web-to-app and app-to-web purchase flows** are exploding post-Epic ruling, though IAP still converts better for most apps.
- **AI "vibecoded" apps** are flooding the store at unprecedented rates, increasing competition but also opening up previously unviable micro-niches.
- **Super apps** are consolidating user attention — users increasingly prefer a few core apps that do many things.
- **Apple Vision Pro / visionOS** has exceeded 4,200 AR/VR apps, creating an early-mover opportunity in a nascent platform.
- **Third-party app stores in the EU** have adoption rates below 3%, so the App Store remains the dominant distribution channel for the foreseeable future.

---

*Sources: RevenueCat State of Subscription Apps 2025/2026, Business of Apps, Sensor Tower, AppsFlyer, Adjust Mobile App Trends 2026, Apple Developer documentation, Adapty State of In-App Subscriptions 2025, various industry analyses.*
