---
title: DOM order is not always keyboard order — I built a Chromium scanner to visualize it
published: false
description: FocusPath follows real keyboard navigation, records the observed focus route, and produces a portable visual report.
tags: accessibility, webdev, opensource, testing
cover_image: https://damianociarla.github.io/focuspath/social-card.png
---

The DOM can tell you where elements are. It cannot always tell you the exact
route a keyboard user will experience.

Positive `tabindex` values can reorder controls. JavaScript can redirect focus.
Dialogs can fail to restore it. A custom element may contain an open, closed, or
cross-origin boundary. A scroll container can move the active control outside
the evidence captured in the first viewport.

Static rules are essential, but keyboard navigation is also an interaction. I
wanted a way to observe that interaction and preserve what happened.

So I built **FocusPath**, an open-source TypeScript tool that follows `Tab` or
`Shift+Tab` navigation in a real Chromium session, records the observable focus
stops, and generates a portable HTML report with the route drawn over the page.

```bash
npx focuspath https://example.com
```

The live beta is available at
[damianociarla.github.io/focuspath](https://damianociarla.github.io/focuspath/),
and the source is on
[GitHub](https://github.com/damianociarla/focuspath).

![FocusPath live scanner showing the completed route for Example Domain](https://raw.githubusercontent.com/damianociarla/focuspath/main/docs/launch/media/demo-04-result.jpg)

## The question FocusPath answers

FocusPath does not ask only, "Which elements look focusable?"

It asks:

> Starting from this document, what focus movement can Chromium actually
> observe when a keyboard user presses Tab?

For every observed stop, the report records information such as:

- sequence number and total Tab presses;
- element identity, selector, role, and computed accessible name;
- traversal-time and final screenshot geometry;
- scroll and clipping contexts;
- computed outline and shadow values;
- deterministic findings linked back to the relevant stop.

The report also explains why traversal ended: the document was exhausted,
focus stopped moving, a cycle appeared, or a configured safety budget was
reached.

## Why not derive the route from the DOM?

DOM analysis is useful, but several important cases are dynamic.

Imagine an icon-only button after a custom menu. The menu intercepts Tab,
moves focus internally, and later sends focus to an element outside its DOM
subtree. Sorting elements by source position or `tabindex` does not reproduce
that behavior.

Closed shadow roots and cross-origin frames add another constraint: an external
scanner cannot inspect their internal controls. FocusPath treats these as
opaque boundaries and reports only what can be observed from the host page. It
does not invent internal evidence.

That distinction became one of the central design rules of the project:

> Missing evidence must remain missing evidence, not become a confident guess.

## A report should preserve its limits

Visual evidence is persuasive, which also makes it easy to overstate.

FocusPath reports include the engine, direction, viewport, traversal budgets,
request totals, blocked resource types, capture dimensions, and truncation
state. A screenshot that does not cover the complete source document is marked
as truncated. A stop outside captured evidence remains in the sequence instead
of being silently dropped.

The scanner and reporter share a hard evidence budget. Saved reports are
runtime-validated before rendering, including counters, step references,
geometry, capture metadata, and JPEG dimensions.

These constraints make the output less magical and more reviewable.

## FocusPath complements rule engines

FocusPath is not a replacement for axe, Lighthouse, Accessibility Insights,
screen-reader testing, or manual review.

Those tools answer different questions. Rule engines are excellent at finding
many deterministic violations in page state. FocusPath concentrates on the
route produced by keyboard traversal and the evidence surrounding it.

A practical workflow can use both:

1. Run established automated rules.
2. Generate a FocusPath report for important journeys.
3. Inspect the route and any deterministic focus findings.
4. Test manually across browsers and assistive technologies.
5. Review focus appearance, content, and interaction semantics with people.

No automated tool, including FocusPath, certifies WCAG conformance.

## Running it locally

FocusPath is ESM-only and currently targets Node.js 24 or newer.

```bash
# Create focuspath-report.html
npx focuspath https://example.com

# Use a mobile viewport
npx focuspath localhost:3000 --viewport 390x844

# Inspect reverse traversal
npx focuspath example.com --direction reverse

# Bound traversal explicitly
npx focuspath example.com \
  --max-steps 80 \
  --max-tab-presses 320 \
  --max-opaque-tab-presses 160
```

The CLI exits with code `1` for an error finding, `2` when scanning fails, and
`0` otherwise, so it can participate in scripted workflows without pretending
that every warning should block a build.

The library API is available too:

```ts
import { scanFocusPath } from "focuspath";
import { generateHtmlReport } from "focuspath/reporter";

const report = await scanFocusPath("http://localhost:3000", {
  viewport: { width: 1440, height: 900 },
  direction: "reverse",
  maxSteps: 60,
  maxTabPresses: 240,
});

const html = generateHtmlReport(report);
```

The separate reporter entry point does not load Playwright, which keeps
report-only consumers smaller and easier to deploy.

## The hosted scanner is intentionally narrower

The public beta accepts public HTTP(S) pages and runs one bounded, forward-only
scan. It uses stricter limits than the local CLI, blocks font and media requests
to control resource use, and discloses those restrictions in every report.

Submitted URLs are validated before scanning, Chromium traffic passes through
a pinned egress proxy, and private, loopback, link-local, and cloud-metadata
destinations are rejected. The service intentionally has no application-level
report store, although infrastructure providers may retain request metadata.

The local package remains the right choice for private projects, configurable
limits, reverse traversal, and sensitive pages.

## What I would like feedback on

The current release focuses on deterministic traversal and portable evidence.
The roadmap includes:

- a GitHub Action with SARIF annotations;
- comparison between two focus paths;
- focus restoration after dialogs close;
- Firefox and WebKit coverage.

I am especially interested in pages with complex menus, dialogs, scroll
containers, custom elements, and embedded content. If the report makes an
observable boundary or stop unclear, that is useful feedback.

Try the [live scanner](https://damianociarla.github.io/focuspath/), inspect the
[source](https://github.com/damianociarla/focuspath), or install
[`focuspath` from npm](https://www.npmjs.com/package/focuspath).

The goal is not to replace human accessibility judgment. It is to make one
important part of the interaction easier to see, reproduce, and discuss.
