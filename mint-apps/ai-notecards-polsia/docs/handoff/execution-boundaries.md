# Execution Boundaries

This document defines what work Polsia can safely execute now versus what still requires founder approval or founder-owned credentials.

## Safe-now Polsia work

- documentation updates tied to current repo truth
- implementation audits
- launch-readiness audits
- web-core route and contract analysis
- environment/setup documentation
- deployment-shape preparation for the web-core handoff slice
- cleanup and hardening that does not require external account access

## Founder-only by default

- App Store Connect operations
- Apple capability setup
- Stripe account and webhook configuration
- RevenueCat dashboard configuration
- Expo / EAS account operations
- real production credential management
- legal-policy publishing and business-identity decisions

## Requires explicit founder approval before implementation

- changing launch scope around marketplace buyer behavior
- reviving seller tooling as a launch-critical surface
- changing subscription architecture
- changing auth architecture in ways that affect iOS session behavior
- changing purchase fulfillment semantics
- changing deployment target assumptions without updating the handoff docs

## Depends on real credentials or external access

- Apple Sign In verification
- RevenueCat package/reconcile verification
- Stripe checkout or Connect verification
- push-notification registration verification
- preview/production EAS build submission

## Working rule

If a task depends on any of the following, treat it as approval-sensitive:

- Apple
- RevenueCat
- Stripe
- Expo / EAS
- real production URLs
- real secrets

## Practical handoff rule

Polsia should default to:

- analysis
- planning
- audits
- documentation
- web-core collaboration

Polsia should not assume:

- direct ownership of mobile release operations
- direct ownership of monetization infrastructure
- authority to change buyer-vs-seller launch scope without founder confirmation
