# Community and social copy

<!-- markdownlint-disable MD013 MD018 MD034 MD036 -->

Every community has different self-promotion rules. Check them immediately
before posting. When approval is uncertain, ask the moderators and disclose
that you are the author.

## Reddit: r/webdev

**Title**

```text
I built an open-source Chromium tool to visualize the keyboard focus route — looking for technical feedback
```

**Body**

I kept running into a gap between static focusability checks and the order a
keyboard user actually experiences after JavaScript, custom controls, dialogs,
and scroll containers get involved.

I built FocusPath to follow real Tab or Shift+Tab navigation in Chromium and
generate a portable HTML report with the observed route drawn over the page.

```bash
npx focuspath https://example.com
```

It records observable stops, roles, accessible names, geometry, Tab counts,
scroll contexts, capture limits, and why traversal ended. Closed shadow roots
and cross-origin frames remain explicitly opaque.

This is not a WCAG compliance claim and it does not replace axe, Lighthouse,
manual testing, or assistive technologies. It is meant to make one interaction
easier to reproduce and review.

Demo: https://damianociarla.github.io/focuspath/

Source: https://github.com/damianociarla/focuspath

I would be particularly interested in examples where the reported route is
technically accurate but hard to understand, or in interaction patterns you
think should be represented differently.

## Reddit: r/accessibility

**Title**

```text
Seeking accessibility-practitioner feedback on an open-source visual keyboard-route tool
```

**Body**

Disclosure: I am the author of this open-source tool.

FocusPath follows real keyboard navigation in Chromium and creates a visual
report of the observable focus route. I built it as supporting evidence for
manual accessibility work, not as a compliance scanner.

The report labels the browser, direction, traversal limits, blocked resources,
opaque boundaries, screenshot truncation, and reasons the scan stopped. It
cannot inspect closed shadow roots or cross-origin frames, automatically judge
focus-indicator contrast, replace assistive-technology testing, or certify
WCAG conformance.

I would value feedback from practitioners and keyboard or assistive-technology
users on whether the report communicates those boundaries responsibly and
whether the visual route is useful during review.

Demo: https://damianociarla.github.io/focuspath/

Source and limitations: https://github.com/damianociarla/focuspath

If tool-feedback posts are not appropriate here, I am happy to remove this.

## Reddit: r/opensource or r/coolgithubprojects

**Title**

```text
FocusPath: an MIT-licensed CLI that turns keyboard traversal into a portable visual report
```

**Body**

FocusPath is a TypeScript/Chromium scanner for observing keyboard focus order.
It follows Tab or Shift+Tab, records observable stops, and generates a
self-contained HTML report with the route overlaid on a screenshot.

```bash
npx focuspath https://example.com
```

Repository: https://github.com/damianociarla/focuspath

Live bounded demo: https://damianociarla.github.io/focuspath/

It is ESM-only on Node 24+, MIT licensed, and tested from its packed npm artifact
on Linux x64, Windows x64, and macOS ARM64. It is deliberately a diagnostic
tool rather than a WCAG conformance claim.

Contributions and concrete test cases are welcome. Current roadmap items
include SARIF/GitHub Actions, path comparison, dialog focus restoration, and
additional browser engines.

## LinkedIn — English

Keyboard order is not always just DOM order.

JavaScript, dialogs, custom elements, tabindex, scrolling containers, and
embedded content can change the route a keyboard user actually experiences.

I built **FocusPath**, an open-source Chromium tool that follows real Tab or
Shift+Tab navigation and turns the observed route into a portable visual
report.

```text
npx focuspath https://example.com
```

FocusPath is not a WCAG certification tool and it does not replace established
rule engines, assistive-technology testing, or manual review. Its job is
narrower: make the keyboard route visible, reproducible, and easier to discuss.

Try the live beta: https://damianociarla.github.io/focuspath/

Source: https://github.com/damianociarla/focuspath

I would value feedback from frontend, QA, design-system, and accessibility
teams working with complex keyboard interactions.

#a11y #accessibility #webdev #opensource #typescript #playwright

## LinkedIn — Italian

L'ordine da tastiera non coincide sempre con il semplice ordine del DOM.

JavaScript, dialog, custom element, tabindex, contenitori con scroll e contenuti
incorporati possono modificare il percorso che una persona compie realmente
premendo Tab.

Per renderlo osservabile ho creato **FocusPath**, uno strumento open source che
segue la navigazione Tab o Shift+Tab in Chromium e produce un report visuale
portabile.

```text
npx focuspath https://example.com
```

FocusPath non certifica la conformità WCAG e non sostituisce rule engine, test
con tecnologie assistive o verifiche manuali. Ha uno scopo più preciso: rendere
il percorso da tastiera visibile, riproducibile e più facile da discutere.

Demo: https://damianociarla.github.io/focuspath/

Codice: https://github.com/damianociarla/focuspath

Mi interessano soprattutto feedback da chi lavora su frontend, QA, design
system e accessibilità.

#a11y #accessibility #webdev #opensource #typescript

## Bluesky

I built FocusPath, an open-source Chromium tool that follows real Tab or
Shift+Tab navigation and turns the observed keyboard route into a portable
visual report. It complements rule engines and manual testing; it does not
claim WCAG conformance.

https://damianociarla.github.io/focuspath/

## Mastodon

Keyboard order is not always just DOM order.

FocusPath is an open-source Chromium tool that follows real Tab or Shift+Tab
navigation and turns the observed route into a portable visual report.

It complements rule engines, assistive-technology testing, and manual review;
it does not certify WCAG conformance.

Try it: https://damianociarla.github.io/focuspath/

Source: https://github.com/damianociarla/focuspath

#a11y #accessibility #webdev #opensource

## X

I built FocusPath: an open-source Chromium tool that follows real Tab or
Shift+Tab navigation and turns the observed keyboard route into a portable
visual report. It complements rule engines and manual testing.

https://damianociarla.github.io/focuspath/

## Short demo caption

```text
One URL. Real keyboard traversal. A portable visual route.
```

## Image alt text

**Social card**

```text
FocusPath logo beside the words “See where keyboard navigation breaks” on a dark background. A dotted green focus route connects three circular stops, with the middle stop highlighted in red.
```

**Live scanner result**

```text
FocusPath live scanner after scanning Example Domain. The panel reports one focus stop, two Tab presses, zero errors, and zero warnings, with Engine 0.7.2 displayed above the result.
```

**Homepage desktop**

```text
Dark FocusPath homepage with the headline “See where keyboard navigation breaks,” a command to run the package, and a dotted green focus route across the right side.
```

**Homepage mobile**

```text
Compact mobile view of the FocusPath homepage, preserving the logo, headline, package command, and primary action within the first screen.
```
