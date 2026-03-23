AI Notecards — Legal Documents Package

iOS App Store Submission Ready | Drafted March 22, 2026

Executive Summary

Two submission-ready documents drafted: Terms of Service + Privacy Policy

Apple 2026 compliant: covers Guideline 5.1.2(i) (Nov 2025 AI consent requirement), Privacy Nutrition Labels, in-app account deletion, App Tracking Transparency

RevenueCat + Apple Sign In explicitly disclosed as required by App Store privacy rules

COPPA approach: general-audience app, 13+ age requirement — no child-directed designation, no K-12 targeting (avoids parental consent overhead)

AI liability: strong disclaimer on accuracy of AI-generated notecard content modeled on current AI-product best practices

No seller/creator terms — buyer-side marketplace only for v1, as instructed

Action required before deployment: insert effective dates and confirm the crash-reporting SDK named below before publishing

Research Findings

Apple App Store Requirements (2026)

Privacy policy URL mandatory at submission — must be live at ai-notecards.com/privacy

Privacy Nutrition Labels: disclose all data categories collected (including third-party SDKs like RevenueCat)

In-app account deletion required since June 2022

Guideline 5.1.2(i) (added Nov 13, 2025): Apps using third-party AI must disclose this and get user consent before processing user data with external AI services

Privacy manifests required for any APIs that could enable fingerprinting

RevenueCat Data Disclosure (Required)

Must mark "Purchases → Analytics + App Functionality" in App Store Connect

If using custom User IDs tied to Apple Sign In: must also declare "User ID"

RevenueCat is a data processor (not controller) — founder is the controller

RevenueCat does not sell CCPA personal data per their DPA

Apple Sign In Data

Developer receives: user's name (optional), email OR private relay address, unique stable user identifier

Binary fraud-prevention score on first sign-in (Apple-side, not stored by developer)

User can hide real email — developer gets @privaterelay.appleid.com address

COPPA Analysis

AI Notecards is a general-audience study app — not specifically marketed to under-13

Standard approach: 13+ age requirement in ToS, no "Kids Category" listing

FTC rule: operators of general-audience apps do NOT need to investigate user ages — COPPA only triggers if you gain actual knowledge of under-13 users

Recommendation: include 13+ requirement, avoid marketing to K-12 elementary, do not list in Kids category

Competitor Pattern Analysis

Quizlet: Users retain ownership, grant Quizlet broad perpetual license; mandatory arbitration; community guidelines by reference

AnkiApp: Minimal data collection disclosure, no in-app purchase subscription terms

Brainscape: Subscription terms with Pro upgrade; content ownership to users; age 13+

Key differentiator for AI Notecards: Must add AI-specific liability disclaimers and third-party AI consent (Apple 5.1.2(i)) — most legacy competitors predate this requirement

SECTION 1: TERMS OF SERVICE

Deploy to: ai-notecards.com/terms

Terms of Service

AI Notecards
Effective Date: [INSERT DATE]
Last Updated: March 22, 2026

1. Acceptance of Terms

By downloading, installing, or using AI Notecards (the "App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.

These Terms constitute a legally binding agreement between you and Mint Apps ("Company," "we," "us," or "our"), the developer of AI Notecards.

Important: These Terms include a mandatory arbitration clause and class action waiver. Please read Section 14 carefully.

2. Eligibility and Age Requirements

You must be at least 13 years of age to use the App. By using the App, you represent and warrant that you are 13 years of age or older. If you are between 13 and 18 years old, you represent that you have obtained parental or guardian consent to use the App.

We do not knowingly collect personal information from children under 13. If we learn that a user under 13 has provided personal information, we will promptly delete it. If you believe a child under 13 has used the App, please contact us at support@ai-notecards.com.

3. Account Registration

3.1 Apple Sign In

You may create an account using Sign In with Apple. When you do, Apple provides us with:

Your name (optional — you may edit this before sharing)

Your email address or an Apple-generated private relay address (at your discretion)

A unique user identifier specific to AI Notecards

You are responsible for all activity that occurs under your account.

3.2 Account Security

Keep your credentials confidential. Notify us immediately at support@ai-notecards.com if you suspect unauthorized access to your account.

3.3 Account Deletion

You may delete your account at any time from within the App via Settings → Delete Account. Account deletion will permanently remove your profile and associated data in accordance with our Privacy Policy.

4. AI-Generated Content

4.1 How AI Generation Works

The App uses artificial intelligence to generate notecard content based on text, images, audio, or video you provide as input ("Input"). The AI-generated output ("Generated Content") is produced by third-party AI service providers we use to operate AI generation features.

4.2 Third-Party AI — User Consent

By using the AI notecard generation features, you consent to your Input being transmitted to third-party AI service providers for processing. These providers operate under their own privacy policies and data processing terms. We do not use your Input to train AI models without your explicit consent.

This disclosure is required under Apple App Review Guideline 5.1.2(i).

4.3 No Accuracy Guarantee

AI-generated notecard content may be inaccurate, incomplete, outdated, or misleading. We make no representations or warranties regarding the accuracy, reliability, or fitness for any particular purpose of any Generated Content.

You are solely responsible for:

Reviewing Generated Content before use

Verifying factual accuracy against authoritative sources

Any decisions made based on Generated Content

Generated Content is not a substitute for professional advice (medical, legal, financial, academic, or otherwise).

4.4 Content Ownership

You retain all rights to:

The Input you provide

Notecard decks you create

By generating notecards using the App, you grant us a limited, non-exclusive, royalty-free license to process your Input solely to deliver the AI generation service to you. We do not claim ownership of your content.

4.5 Prohibited Input

You agree not to submit Input that:

Violates any applicable law or regulation

Infringes third-party intellectual property rights

Contains personally identifiable information of third parties without consent

Is sexually explicit, harmful, or abusive

We reserve the right to suspend accounts that submit prohibited content.

5. Subscription and In-App Purchases

5.1 Subscription Plans

The App offers subscription access to premium features ("Subscription") through Apple's in-app purchase system. Current plans, pricing, and features are displayed in the App and on the App Store listing.

5.2 Billing

Subscriptions are billed through your Apple ID account. Payment is charged to your Apple ID at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current billing period.

Your Apple ID account is charged for renewal within 24 hours prior to the end of the current subscription period. The subscription price may be changed with reasonable notice.

5.3 Managing and Canceling Subscriptions

You may manage or cancel your Subscription at any time through your Apple ID Account Settings. Cancellation takes effect at the end of the current billing period — you will not receive a prorated refund for unused time.

5.4 Free Trials

If offered, free trial periods will be disclosed in the App. Any unused portion of a free trial will be forfeited when a subscription is purchased.

5.5 Refunds

All purchases are processed by Apple. Refund requests must be submitted to Apple in accordance with Apple's applicable policies. We have no ability to issue refunds for purchases made through the App Store.

5.6 Price Changes

We reserve the right to change subscription pricing. We will provide reasonable advance notice before price changes take effect.

6. Marketplace — Deck Discovery (Buyer-Side)

6.1 Browse and Access

The App includes a marketplace feature where you can browse and access notecard decks created by other users or curated by us ("Marketplace Content"). In version 1.0 of the App, marketplace access is available to all users (buyer-side).

6.2 No Seller Terms at Launch

The ability to publish or sell your own decks to other users through the marketplace is not available in the current version of the App. Creator/seller functionality may be introduced in a future version under separate terms.

6.3 Marketplace Content Disclaimer

Marketplace Content is created by third parties. We do not verify the accuracy, completeness, or appropriateness of Marketplace Content. Use Marketplace Content at your own discretion and always verify facts against authoritative sources.

6.4 Reporting Inappropriate Content

If you encounter Marketplace Content that you believe violates these Terms or applicable law, please report it at support@ai-notecards.com.

7. Intellectual Property

7.1 App Ownership

The App, its design, interface, code, branding, and all content we create are the exclusive property of Mint Apps, protected by copyright, trademark, and other applicable intellectual property laws.

7.2 License to Use

We grant you a limited, non-exclusive, non-transferable, revocable license to use the App for personal, non-commercial study purposes, subject to these Terms.

7.3 Restrictions

You may not:

Copy, modify, distribute, sell, or sublicense the App

Reverse engineer or attempt to extract the App's source code

Use the App to build a competing service

Remove any proprietary notices from the App

8. User Conduct

You agree not to use the App to:

Violate any applicable law or regulation

Infringe the intellectual property rights of any party

Transmit harmful, offensive, or illegal content

Attempt to gain unauthorized access to our systems

Use automated means to access or scrape the App

Engage in any activity that disrupts or interferes with the App

9. Disclaimer of Warranties

THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

We do not warrant that:

The App will be uninterrupted, error-free, or secure

AI-generated content will be accurate or complete

Any defects will be corrected

The App will meet your requirements

Some jurisdictions do not allow the exclusion of implied warranties, so the above may not apply to you in full.

10. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, MINT APPS AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM OR RELATED TO:

(A) YOUR USE OF OR INABILITY TO USE THE APP

(B) INACCURACIES IN AI-GENERATED NOTECARD CONTENT

(C) UNAUTHORIZED ACCESS TO OR ALTERATION OF YOUR DATA

(D) ANY OTHER MATTER RELATING TO THE APP

IN JURISDICTIONS THAT DO NOT PERMIT SUCH LIMITATIONS, OUR LIABILITY IS LIMITED TO THE GREATER OF (I) THE AMOUNT YOU PAID FOR THE APP IN THE 12 MONTHS PRECEDING THE CLAIM, OR (II) $100 USD.

Nothing in these Terms limits liability for death, personal injury, or fraud caused by our negligence.

11. Apple-Specific Terms

The App is distributed through the Apple App Store. You acknowledge:

These Terms are between you and Mint Apps, not Apple, Inc. ("Apple")

Apple has no obligation to provide maintenance or support for the App

In the event the App fails to conform to any applicable warranty, you may notify Apple for a refund of your purchase price. To the maximum extent permitted by law, Apple has no other warranty obligation regarding the App

Apple is not responsible for investigating, defending, settling, or discharging any third-party intellectual property infringement claims

Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them against you

12. Termination

We may suspend or terminate your account at any time, with or without cause, with or without notice. Grounds for termination include, but are not limited to, violation of these Terms.

Upon termination, your right to use the App ceases immediately. Provisions that by their nature survive termination will do so, including Sections 4.3, 7, 9, 10, 13, and 14.

You may stop using the App and delete your account at any time.

13. Governing Law

These Terms are governed by the laws of the State of California, United States, without regard to its conflict of law provisions. Any disputes not subject to arbitration will be resolved in the state or federal courts located in California.

14. Dispute Resolution and Arbitration

14.1 Binding Arbitration

PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS.

Except for claims small enough for small claims court, you and Mint Apps agree that any dispute arising from these Terms or your use of the App will be resolved by binding individual arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules. The arbitrator's decision will be final and binding.

14.2 Class Action Waiver

YOU AND MINT APPS AGREE THAT EACH PARTY MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.

14.3 Opt-Out

You may opt out of arbitration within 30 days of first using the App by emailing support@ai-notecards.com with "Arbitration Opt-Out" in the subject line.

15. Changes to Terms

We may update these Terms from time to time. We will notify you of material changes by updating the "Last Updated" date and, where appropriate, via in-app notification or email. Continued use of the App after changes take effect constitutes acceptance of the updated Terms.

16. Contact

For questions about these Terms:

Mint Apps
Email: support@ai-notecards.com
Website: ai-notecards.com

SECTION 2: PRIVACY POLICY

Deploy to: ai-notecards.com/privacy

Privacy Policy

AI Notecards
Effective Date: [INSERT DATE]
Last Updated: March 22, 2026

Overview

This Privacy Policy explains how Mint Apps ("we," "us," "our") collects, uses, shares, and protects your information when you use the AI Notecards mobile application ("App").

We do not sell your personal information. We take your privacy seriously and designed this App to collect only what we need to provide the service.

1. Information We Collect

1.1 Account Information (Apple Sign In)

When you create an account via Sign In with Apple, we receive from Apple:

Data Notes
Unique User Identifier A stable ID Apple assigns per app. We use this to identify your account
Name Optional — you may choose not to share your name
Email Address Either your real email or an Apple-generated private relay address (@privaterelay.appleid.com) — your choice

We do not receive your Apple ID password. We do not receive your iCloud data.

1.2 Study Activity

We collect data about how you use the App:

Notecard decks you create, edit, or delete

Study sessions: cards studied, scores, progress metrics

Frequency and duration of study sessions

This data is used to power your study experience, spaced repetition scheduling, and progress tracking.

1.3 Deck Content and AI Inputs

When you create notecards using the AI generation feature:

The text, image, audio, or video you submit as Input may be transmitted to third-party AI services to generate notecard content

Your Input may be temporarily processed by AI providers to generate your requested output

We store the Generated Content (your notecard decks) in your account

We do not use your deck content or AI inputs to train machine learning models without your explicit, separate consent.

1.4 Subscription and Purchase Information

We use RevenueCat to manage subscriptions and in-app purchases. RevenueCat may collect:

Purchase history (required for subscription validation)

App user identifier (to link your subscription to your account)

Device type and operating system (for analytics and app functionality)

RevenueCat acts as a data processor on our behalf. See their privacy policy at revenuecat.com/privacy.

For Apple App Privacy Label compliance: We disclose "Purchases" data collected via RevenueCat, used for App Functionality and Analytics.

1.5 Device and Technical Information

We automatically collect:

Device type, operating system, and app version

Crash reports and error logs (for debugging and improving stability)

General usage analytics (e.g., which features are used, session counts)

This information does not identify you personally and is used to maintain and improve the App.

1.6 Information You Choose to Provide

If you contact us for support, we may collect your email address and any information you share in your message.

2. How We Use Your Information

Purpose Data Used
Provide the App — authenticate you, save decks, track progress Account ID, study activity, deck content
AI notecard generation — process your inputs and return generated content AI inputs (transmitted to third-party AI)
Manage your subscription — validate entitlements, prevent fraud Purchase data (via RevenueCat)
Improve the App — analyze crashes, understand usage patterns Device/technical data, anonymized analytics
Customer support — respond to your inquiries Email, support messages
Legal compliance — comply with applicable law Any data as required

We do not use your data for targeted advertising. We do not sell your data.

3. Third-Party Services

We share limited data with the following third-party services:

3.1 Apple (Sign In with Apple)

Provides authentication. Apple handles authentication on their servers; we receive only the data described in Section 1.1. Apple Privacy Policy

3.2 RevenueCat (Subscription Management)

Processes in-app purchase data to manage your subscription. RevenueCat is SOC 2 Type II certified. RevenueCat Privacy Policy

3.3 Third-Party AI Providers (AI Notecard Generation)

Your Input may be transmitted to AI service providers we use to operate AI generation features, such as Google, Groq, and other providers we may use in the future, to generate notecard content. These providers process your data under their own privacy policies and data processing agreements. They are contractually restricted from using your data to train their models without consent where required by our agreements and product settings.

3.4 Crash Reporting / Analytics

We may use third-party crash reporting tools (e.g., Firebase Crashlytics or similar) to receive technical error reports. These tools collect anonymized device and crash data. (Update this section with the specific tool you use before deployment.)

4. Apple Privacy Nutrition Label

The following data types are collected by this App or its third-party SDKs (as required to be disclosed in App Store Connect):

Data Type Purpose Linked to Identity?
Purchases App Functionality, Analytics (RevenueCat) No (anonymous)
User ID App Functionality (your account) Yes
Email Address Account management Yes (optional — relay available)
Usage Data Analytics, App Functionality No
Crash Data App Functionality (debugging) No

We do not collect: precise location, contacts, browsing history, search history, health/fitness data, financial info, messages, photos/videos (beyond AI input if user provides), audio/video recordings, or sensitive info.

5. Children's Privacy (COPPA)

AI Notecards is a general-audience application not specifically directed to children under 13 years of age. We require users to be 13 or older to create an account (see Terms of Service, Section 2).

We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected information from a child under 13, please contact us at support@ai-notecards.com and we will promptly delete it.

If you are a parent or guardian and believe your child has provided us with personal information without your consent, please contact us immediately.

6. Data Retention

Data Type Retention Period
Account information Until you delete your account
Notecard decks Until you delete them or delete your account
Study activity and progress Until you delete your account
Purchase history As required by Apple/RevenueCat for subscription validation
Crash logs and technical data 90 days (rolling)
Support communications 2 years

When you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required by law to retain it.

7. Your Rights and Choices

Depending on where you reside, you may have the following rights:

7.1 Access and Portability

You may request a copy of the personal information we hold about you.

7.2 Correction

You may update your account information directly in the App.

7.3 Deletion

You may delete your account from within the App (Settings → Delete Account), which will result in deletion of your personal data as described in Section 6. You may also contact us at support@ai-notecards.com to request deletion.

7.4 Opt-Out of Analytics

You may opt out of non-essential analytics by adjusting your device's privacy settings (e.g., iOS privacy settings for app tracking).

7.5 California Residents (CCPA/CPRA)

California residents have additional rights under the California Consumer Privacy Act:

Right to Know: What categories of personal information we collect and how we use it (see Sections 1 and 2)

Right to Delete: Request deletion of your personal information

Right to Opt-Out of Sale: We do not sell your personal information

Right to Non-Discrimination: We will not discriminate against you for exercising your rights

To exercise California privacy rights, contact us at support@ai-notecards.com with "California Privacy Request" in the subject line.

7.6 EEA / UK Residents (GDPR)

If you are in the European Economic Area or United Kingdom, your legal bases for our processing your data are: (a) performance of the contract between you and us (providing the App), (b) our legitimate interests (improving the App, fraud prevention), and (c) your consent (AI generation features). You have rights of access, rectification, erasure, restriction, portability, and objection. To exercise these rights, contact support@ai-notecards.com.

8. Data Security

We implement commercially reasonable technical and organizational measures to protect your data, including:

Encryption of data in transit (TLS)

Encryption of data at rest

Access controls limiting who can access user data

Regular security reviews

No method of transmission or storage is 100% secure. We cannot guarantee absolute security, but we are committed to protecting your information.

9. International Data Transfers

The App is operated from the United States. If you are located outside the United States, your information will be transferred to and processed in the United States. By using the App, you consent to this transfer. We apply appropriate safeguards for international transfers as required by applicable law.

10. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last Updated" date at the top of this policy and, where appropriate, via in-app notification. Continued use of the App after changes take effect constitutes acceptance of the updated policy.

11. Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy:

Mint Apps
Email: support@ai-notecards.com
Website: ai-notecards.com

For privacy-specific requests: email support@ai-notecards.com with "Privacy Request" in the subject line.

Deployment Checklist

Before submitting to App Store:

Insert effective date for both documents

Confirm which crash reporting SDK you use (Section 3.4) and name it

Deploy both docs at ai-notecards.com/terms and ai-notecards.com/privacy

Add both URLs to App Store Connect metadata fields

Configure App Store Connect Privacy Nutrition Labels matching Section 4 of the Privacy Policy

Enable in-app account deletion flow (Settings → Delete Account) — required by Apple

Add in-app consent dialog before first AI generation (required by Apple Guideline 5.1.2(i))

Legal Disclaimer

These documents are AI-generated drafts for review by the app developer. They are not legal advice and do not create an attorney-client relationship. You should have these reviewed by a licensed attorney before publication, particularly if you intend to collect data from users in the EU/UK (GDPR compliance) or California (CCPA), or if you plan to introduce marketplace/seller features in a future version. These drafts are grounded in current Apple App Review Guidelines (2026), COPPA requirements, and standard consumer app practices as of March 2026.
