# Show HN launch copy

<!-- markdownlint-disable MD034 MD036 -->

## Submission

**Title**

```text
Show HN: FocusPath – Visualize the keyboard focus route of any web page
```

**URL**

```text
https://damianociarla.github.io/focuspath/
```

## First comment from the maker

Hi HN — I built FocusPath because DOM order and the route a keyboard user
actually experiences are not always the same thing.

FocusPath launches Chromium, follows forward Tab or reverse Shift+Tab
navigation, records each observable focus stop, and creates a self-contained
HTML report with the route drawn over the page.

You can try the bounded public demo from the link, or run the full local CLI:

```bash
npx focuspath https://example.com
```

The implementation ended up being mostly about preserving uncertainty rather
than drawing a line. Closed shadow roots and cross-origin frames are opaque,
scroll containers complicate screenshot evidence, smooth scrolling changes
geometry, and an element selector is not a stable identity for cycle
detection. Reports therefore include the engine, direction, traversal budgets,
network restrictions, capture dimensions, and explicit truncation state.

It is intentionally not a WCAG conformance test and does not replace axe,
Lighthouse, assistive-technology testing, or manual review. It focuses on one
question: what keyboard route did Chromium actually expose, and what evidence
can be preserved around it?

The package is TypeScript, ESM-only, Node 24+, MIT licensed, and tested as an
installed tarball on Linux x64, Windows x64, and macOS ARM64. The hosted API has
stricter budgets and a pinned egress proxy; the local CLI is the recommended
option for private or configurable scans.

Source: https://github.com/damianociarla/focuspath

I would value criticism of the traversal model and report evidence, especially
for menus, dialogs, custom elements, scrolling containers, and opaque browser
boundaries.

## Short answers for likely questions

### Why Node 24?

It is an intentional baseline shared by the package, CI, Playwright container,
and release workflow. Supporting older runtimes is possible later, but I chose
one tested environment over a wider unverified range for the first releases.

### Why not use axe?

I do use and recommend established rule engines. FocusPath answers a narrower
interaction question: which focus stops did real Tab traversal expose, in what
order, and where did they appear? It is complementary evidence.

### Why is the hosted demo limited?

A public browser service is an abuse and SSRF boundary. The demo restricts
concurrency, time, requests, observed stops, screenshot size, origins, and
destinations. The CLI has configurable limits and runs locally.

### Can it inspect closed shadow DOM or cross-origin frames?

No. It can observe focus moving through an opaque host but cannot inspect the
internal controls. The report makes that boundary explicit instead of
fabricating selectors or accessibility data.

### Why Chromium only?

The current model is deeply coupled to observable Chromium behavior. Firefox
and WebKit are roadmap work and should produce engine-labelled evidence rather
than being assumed equivalent.
