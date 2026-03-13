# Release Checklist

## Always Required
- [ ] Feature brief exists and is up to date.
- [ ] Risk lane is set correctly.
- [ ] Required lane gates are complete.
- [ ] Known risks and deferred work are documented.
- [ ] Human acceptance check completed on primary platform.

## Lane A
- [ ] Manual sanity check completed.
- [ ] Targeted unit test added if logic changed.

## Lane B
- [ ] `npm run verify:lane:b` passes.
- [ ] Manual smoke check completed.

## Lane C
- [ ] `npm run verify:lane:c` passes locally.
- [ ] Maestro smoke flow report captured.
- [ ] Rollback procedure documented and reviewed.
- [ ] Human sign-off recorded for financial/business correctness.

## Weekly Cross-Platform Check
- [ ] Critical smoke journey validated on non-primary platform.
