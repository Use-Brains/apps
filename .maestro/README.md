# Maestro Smoke Flows

These flows cover the Lane C critical journal journey:
- login
- add trade
- edit trade
- filter trade
- delete trade

## Prerequisites
- Maestro CLI installed: `curl -Ls "https://get.maestro.mobile.dev" | bash`
- Emulator/simulator running and app installed.
- Test account credentials available.

## Environment Variables
- `MAESTRO_TEST_EMAIL`
- `MAESTRO_TEST_PASSWORD`

## Run
- `npm run test:smoke`
- or `maestro test .maestro/flows/smoke-lane-c.yaml`

## Notes
- These are smoke checks, not exhaustive E2E coverage.
- Keep selectors aligned with `testID` props in app components.
