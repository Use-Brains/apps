# AI Feature Delivery Output Contract

For every feature implementation, AI output must include:

## Required Summary Fields
- Impacted files
- Risk lane classification (A/B/C)
- Required gate list for the lane
- Verification command results
- Residual risks and deferred work

## Required Verification Reporting
For each executed command, report:
- Command name
- Pass/fail
- Key failure summary if failed

## Required Human Handoff
AI must always include:
- Explicit human sign-off items still required
- Any assumptions made during implementation
- Rollback considerations for risky changes

## Standard Output Template
1. Change summary
2. Risk lane and why
3. Gate results
4. Test evidence
5. Residual risks
6. Human sign-off checklist
