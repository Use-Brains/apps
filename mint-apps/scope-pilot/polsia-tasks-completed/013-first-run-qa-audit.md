# First-run QA audit: test Scope Pilot experience as a new prospect (desktop + mobile)

> completed on 2026-03-25 20:00 PT

**browser**

**Type:** Browser

---

## Objective

Perform a real first-run experience audit of Scope Pilot as if you are a small commercial cleaning company owner clicking through from a cold email for the first time.

This audit should determine whether the live product is good enough for:

- unsupervised evaluation by a non-technical prospect
- recording the demo video honestly
- async follow-up outreach to proceed

**App:** https://mintapps.polsia.app

---

## Dependency

Run this task only after the pilot readiness package has shipped to production. Do not audit an intermediate or assumed state. Audit the real deployed experience only.

---

## Pass gate for downstream tasks

This task counts as **PASSED** only if:

- final verdict is "Ready to record demo video: YES"
- final verdict is "Ready for async outreach: YES"
- no blocking issue remains in signup/access, demo/sample walkthrough, trust model visibility, next-step clarity, support path, or mobile usability
- the sample/demo walkthrough is clearly labeled as sample and remains read-only
- the upload privacy / recording-consent notice is visible on the real intake path
- the support/contact path is visible from the authenticated first-run experience

If any of the above is not true, mark the audit as **NOT PASSED** and stop downstream tasks.

---

## Context

We are moving to an async-first outreach motion. Prospects may come from a cold email, watch a demo video, and click into the product without talking to anyone first. Before recording that video or sending follow-ups, we need an honest assessment of whether the first-time product experience is trustworthy, clear, and usable enough for unsupervised evaluation.

---

## Audit lens

Test this as a real prospect would:

- cold entry
- no internal context
- no founder guidance
- no product knowledge
- practical, skeptical small-business mindset

Judge the product based on:

- clarity
- trust
- usability
- honesty of the workflow
- whether it matches the product's actual promise

---

## Required tested entry paths

- Public landing page -> signup/login -> first authenticated dashboard
- Exact app URL intended for outreach emails
- Dashboard sample walkthrough -> review -> outputs
- Sample walkthrough -> "Try your own" / "New Walkthrough" CTA path
- New Walkthrough -> upload section -> privacy / recording-consent notice
- Help/support path from the first-run flow

---

## Required device contexts

- Desktop browser: unauthenticated and authenticated first-run flow
- Real phone-sized mobile portrait flow, not desktop responsive viewport alone
- If tablet or landscape materially changes the verdict, include that separately

---

## Desktop audit

### Cold-entry path

- Start from the same URL and path a prospect would likely use from outreach
- Note exactly what URL/path was tested
- Is the first impression coherent and trustworthy?
- Is the messaging aligned with "walkthrough-to-bid copilot," draft generation, and review-required workflow?

### Signup / access flow

- Can a brand-new user successfully sign up or access the product?
- Are there any blockers, confusion points, or dead ends?
- Is the auth flow acceptable for a non-technical business owner?
- If signup is required before seeing value, is that friction acceptable?

### Landing / dashboard clarity

- After signup or entry, what does the user see first?
- Is it immediately clear what the product does?
- Is there a visible "start here" or first-use explanation?
- Is there a clear path to demo/sample value before the user has to do real work?

### Demo walkthrough / sample experience

- Is a demo or sample walkthrough visible?
- Can a new user see the full sample flow and outputs without confusion?
- Is demo data clearly labeled as demo/example content?
- Is the sample clearly read-only or clearly separated from real data?
- Does the sample actually help the user understand the product quickly?

### Trust model and review workflow

Check whether the product clearly communicates:

- confirmed / inferred / missing
- draft-only outputs
- review required before anything goes out

These are critical. If they are absent, weak, or hard to notice, flag that explicitly.

### Obvious next step

- After viewing the demo/sample, is the next action obvious?
- Is "New Walkthrough" or equivalent clearly visible?
- Would a non-technical user know what to do next?
- Is the flow self-explanatory enough to reduce founder support burden?

### Trust / confusion / brand issues

Check for:

- references to Polsia
- "autonomous" language
- developer-facing wording
- empty or broken-looking states
- unclear privacy posture
- missing upload consent / recording-consent notice
- anything that would make a cleaning company owner hesitate to trust the product

### Support path

- Is there a visible way to get help or ask a question?
- Is the contact/support path clear and sufficient for a pilot user?

---

## Mobile audit

Repeat the key checks on mobile:

- cold entry
- signup/access
- dashboard clarity
- demo/sample visibility
- next-step clarity
- trust/support visibility
- layout and usability issues

Test as a realistic phone user, not just a responsive viewport in theory.

---

## Required output: QA report

Create a report with type `first_run_qa_audit`.

The report must include:

### A. Tested paths

- exact URLs / entry points tested
- device contexts tested
- whether authenticated or unauthenticated flow was used

### B. Area-by-area verdicts

For both desktop and mobile, give a verdict for each area:

- Pass
- Pass with concerns
- Fail

**Areas:**

- cold-entry impression
- signup/access
- dashboard clarity
- demo/sample walkthrough
- trust model visibility
- next-step clarity
- trust/brand/privacy issues
- support path
- mobile usability

### C. Evidence

For every fail or concern:

- screenshot or detailed description
- why it matters
- whether it affects video recording, outreach readiness, or both

At minimum capture screenshots for:

- public landing / first authenticated dashboard
- sample/demo labeling on dashboard
- review screen showing confirmed / inferred / missing treatment
- outputs page showing draft/review-required treatment
- upload privacy / recording-consent notice
- visible support/contact path
- narrow mobile navigation state on a real phone-size screen

### D. Blocking issues

List anything that must be fixed before:

- recording the demo video
- sending follow-up outreach

### E. Non-blocking issues

List improvements that are worth making but do not prevent the next step.

### F. Separate verdicts

Provide four separate final verdicts:

- Ready to record demo video: YES / NO
- Ready for async outreach: YES / NO
- Overall first-run experience: READY / NOT READY
- Audit status: PASSED / NOT PASSED

**Rule:**

- "PASSED" is only allowed if both "Ready to record demo video" and "Ready for async outreach" are YES.
- Otherwise mark "NOT PASSED" and list the blockers.

### G. Recommendations

- what to fix before recording the video
- what to fix before outreach
- what can wait until after pilot traffic starts

---

## Important constraints

- Audit the product honestly as deployed, not as intended
- Do not assume readiness because tasks say features shipped
- If the product has friction, the report should say so clearly
- If the product is good enough but imperfect, say exactly why
- Prioritize trust, clarity, and practical usability over cosmetic polish

---

## Definition of done

- [ ] Full cold-entry-to-demo-to-next-step flow tested on desktop
- [ ] Key first-run flows tested on mobile
- [ ] Trust model (confirmed / inferred / missing) explicitly evaluated
- [ ] Draft-only / review-required messaging explicitly evaluated
- [ ] Privacy / recording-consent notice explicitly evaluated
- [ ] Support/contact path explicitly evaluated
- [ ] QA report created via `create_report()`
- [ ] Separate desktop and mobile verdicts included
- [ ] Separate "ready to record video" and "ready for outreach" verdicts included
- [ ] Blocking issues listed clearly if any verdict is NO
- [ ] Report is queryable for downstream tasks

---
