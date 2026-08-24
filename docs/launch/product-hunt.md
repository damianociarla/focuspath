# Product Hunt launch copy

<!-- markdownlint-disable MD013 MD036 -->

Recheck Product Hunt's current field and media limits before submission. Keep
the meaning below if the interface requires shorter copy.

## Core fields

**Product name**

```text
FocusPath
```

**Tagline**

```text
Make the keyboard route visible
```

**Website**

```text
https://damianociarla.github.io/focuspath/
```

**Description**

```text
FocusPath follows real Tab or Shift+Tab navigation in Chromium and turns the observed focus route into a portable visual report. Use the live beta or run the open-source CLI locally. Built for frontend, QA, design-system, and accessibility teams.
```

**Topics to prefer when available**

- Developer Tools
- Open Source
- Accessibility
- Testing
- Productivity

**Pricing**

```text
Free · Open source · MIT licensed
```

## Maker first comment

Hello Product Hunt — I built FocusPath to make an interaction that is easy to
miss visible: the route a keyboard user actually follows through a page.

Static accessibility rules are essential, but focus order can also be changed
by JavaScript, custom elements, dialogs, positive tabindex values, scrolling
containers, and opaque browser boundaries. FocusPath follows real keyboard
navigation in Chromium and preserves the observed route in a self-contained
HTML report.

You can try one bounded public scan from the website or run it locally:

```bash
npx focuspath https://example.com
```

The report includes the focus sequence, Tab count, element role and accessible
name, geometry, scroll contexts, deterministic findings, capture limits, and
the reason traversal ended.

An important qualification: FocusPath is not a WCAG certification tool. It
complements axe, Lighthouse, manual keyboard testing, screen readers, and
cross-browser review. The current release is Chromium-based and makes opaque
or missing evidence explicit.

FocusPath is written in TypeScript, distributed through npm, and released under
the MIT license. I would love feedback on the report and on complex pages with
menus, dialogs, custom controls, or embedded content.

## Gallery order and captions

1. **Social card** — "See where keyboard navigation breaks."
   Use `apps/web/public/social-card.png`.
2. **Live scanner result** — "One URL becomes an observed keyboard route and a
   portable report." Use `media/demo-04-result.jpg`.
3. **Desktop homepage** — "Try the bounded live beta or install the local CLI."
   Use `media/homepage-desktop.jpg`.
4. **Mobile homepage** — "The product and documentation remain fully usable on
   a compact viewport." Use `media/homepage-mobile.jpg`.
5. **Demo animation** — "Idle → URL → scan → evidence." Use `media/demo.gif` or
   `media/demo.mp4`, depending on current Product Hunt support.

## FAQ

### What does FocusPath detect?

It records the observed focus sequence and flags a small set of deterministic
problems such as missing computed accessible names, positive tabindex values,
focus cycles, and stalled focus. The report also preserves contextual evidence
for manual review.

### Is it an alternative to axe or Lighthouse?

It is a complement. Rule engines analyze many accessibility requirements;
FocusPath concentrates on the keyboard route observed during real Chromium
traversal.

### Can I scan private or local applications?

Yes, with the local CLI or TypeScript API. The hosted beta accepts only public
HTTP(S) pages and applies much stricter safety budgets.

### Does FocusPath certify WCAG compliance?

No. It is a diagnostic tool. Conformance requires broader automated, manual,
cross-browser, content, and assistive-technology testing.

### What platforms are supported?

The package requires Node.js 24+ and is smoke-tested as an installed npm
tarball on Linux x64, Windows x64, and macOS ARM64. Scanning currently uses
Chromium.

### Is scanned content stored?

The local CLI runs on the user's machine. The hosted beta intentionally has no
application-level report store, but infrastructure providers may retain
request metadata. Reports can contain sensitive page evidence and should be
reviewed before sharing.

## Launch-day replies

Use answers from [`checklist.md`](checklist.md), but respond in the commenter's
language and address the specific concern before linking documentation. Avoid
copying the same canned paragraph repeatedly.
