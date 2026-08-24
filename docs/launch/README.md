# FocusPath launch kit

This directory contains the publication-ready launch material for FocusPath.
The copy is deliberately written in English because the primary audience is
international frontend, testing, open-source, and accessibility communities.

## Positioning

**Primary promise:** Make the keyboard route visible.

**One-sentence description:** FocusPath follows real `Tab` or `Shift+Tab`
navigation in Chromium and turns the observed focus route into a portable
visual report.

**Category:** Open-source developer tool for keyboard accessibility testing.

**Primary audience:** Frontend engineers, accessibility specialists, QA
engineers, design-system teams, and open-source maintainers.

**Primary call to action:** Try the live scanner or run:

```bash
npx focuspath https://example.com
```

**Required qualification:** FocusPath is a diagnostic tool. It complements
rule engines and manual testing; it does not certify WCAG conformance.

## Message hierarchy

1. Keyboard order is an interaction, not just a DOM property.
2. FocusPath observes that interaction in a real Chromium session.
3. The report preserves the route, evidence, and deterministic findings.
4. The tool is open source, local-first, bounded, and explicit about limits.
5. Try it on one public page or install the npm package.

## Contents

- [`dev-article.md`](dev-article.md): long-form educational article for DEV,
  Hashnode, a personal blog, or newsletter pitches.
- [`show-hn.md`](show-hn.md): Show HN submission and first-maker comment.
- [`product-hunt.md`](product-hunt.md): every Product Hunt field, maker comment,
  FAQ, and gallery captions.
- [`community-posts.md`](community-posts.md): Reddit, LinkedIn, Bluesky,
  Mastodon, and X copy.
- [`directories-and-outreach.md`](directories-and-outreach.md): A11Y Project,
  awesome list, AlternativeTo, LibHunt, and newsletter submissions.
- [`checklist.md`](checklist.md): phased launch calendar, final checks, and
  measurement plan.
- [`media/`](media/README.md): real product screenshots and demo animation.

## Links to use

- Product: <https://damianociarla.github.io/focuspath/>
- Documentation: <https://damianociarla.github.io/focuspath/docs.html>
- GitHub: <https://github.com/damianociarla/focuspath>
- npm: <https://www.npmjs.com/package/focuspath>
- OpenAPI: <https://github.com/damianociarla/focuspath/blob/main/docs/openapi.yml>
- Social card: <https://damianociarla.github.io/focuspath/social-card.png>

## Voice rules

- Lead with the observed keyboard route, not compliance anxiety.
- Say "observes", "records", and "visualizes" rather than "guarantees".
- Avoid "AI-powered", "fully automated", and "WCAG-compliant scanner".
- Name Chromium, opaque boundaries, and manual testing without burying them.
- Prefer a real example and a command over feature lists.
- Do not ask for stars. Ask people to try a page and report where the evidence
  is unclear.

## Recommended publication order

1. Publish the DEV article and use it as the educational reference.
2. Submit Show HN two or three days later while available to answer questions.
3. Apply the strongest feedback to copy or onboarding.
4. Launch on Product Hunt roughly one week later.
5. Submit the durable directory entries and newsletter pitch.
6. Share community-specific posts gradually, after checking each community's
   current self-promotion rules.

Do not publish every item on the same day. A phased launch produces distinct
feedback cycles and avoids repeating identical promotional copy everywhere.
