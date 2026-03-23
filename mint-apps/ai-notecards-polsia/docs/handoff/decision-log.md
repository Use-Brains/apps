# Decision Log

This log tracks collaboration-relevant decisions that should not be reconstructed from memory.

## 2026-03-22

### Web-core first collaboration boundary

Decision:

- Polsia collaboration starts from the web-core handoff layer, not blind whole-product ownership

Reason:

- the backend and web-core surfaces are now the most stable collaboration surface
- mobile, billing, and seller systems still contain decision-sensitive external dependencies

### Seller tools deferred by default

Decision:

- seller tools remain disabled by default in the handoff build

Reason:

- buyer marketplace value is strategically important
- seller onboarding and payout logic are operationally heavier and easier to defer safely

### Native/mobile parity is not first-pass Polsia scope

Decision:

- native/mobile parity is not required for first-pass Polsia engineering collaboration

Reason:

- iOS remains strategically important, but deeper ownership transfer is premature until the contract, env, and launch assumptions are clearer

### Unified Express-serves-client is the active web handoff shape

Decision:

- the handoff build assumes Express serves `client/dist`

Reason:

- this matches the current Polsia-target deployment shape better than the older split deployment assumption

### Marketplace buyer surface preserved, seller surface negotiable

Decision:

- buyer marketplace seriousness is preserved
- seller tooling is negotiable and deferred-by-default

Reason:

- this preserves actual product intent while still allowing launch prioritization

### iOS marketplace purchase behavior remains an explicit decision point

Decision:

- direct iOS marketplace purchase behavior is not treated as settled launch truth yet

Reason:

- the repo shows buyer marketplace intent clearly, but the current handoff implementation still uses placeholder purchase behavior and an iOS-specific availability gate
