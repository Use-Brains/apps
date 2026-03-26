# AI Notecards Source-Of-Truth Notice

Do not treat either of these folders as the active source of truth going forward:

- `apps/ai-notecards`
- `apps/mint-apps/ai-notecards-polsia`

After the Polsia import, the canonical engineering repo for AI Notecards is intended to be the Polsia-managed `mintapps` repo.

Practical rule:

- Do not make new source-of-truth product changes in `apps/ai-notecards`.
- Do not make new source-of-truth product changes in `apps/mint-apps/ai-notecards-polsia`.
- If changes are needed after handoff, make them in the Polsia canonical repo and sync only intentionally.

This notice exists to prevent drift and accidental split-brain development.
