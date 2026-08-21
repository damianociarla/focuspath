# FocusPath

FocusPath traverses a web page with Chromium, records its keyboard focus sequence, flags deterministic problems, and writes a portable visual HTML report.

```bash
npx focuspath https://example.com
```

FocusPath complements manual accessibility testing and established rule engines; it is not a WCAG conformance test.

## CLI

```bash
focuspath <url> [options]

-o, --output <file>          Report path (default: focuspath-report.html)
--max-steps <number>         Maximum observed focus stops (default: 50)
--max-tab-presses <number>   Maximum total Tab presses (default: 4 × max-steps)
--max-opaque-tab-presses <number> Repeated Tab limit per opaque host (default: 100)
--direction <forward|reverse> Keyboard traversal direction (default: forward)
--viewport <width>x<height>  Browser viewport (default: 1440x900)
--headed                     Show Chromium while scanning
```

If Chromium is not installed yet, run `npx playwright install chromium`.

Node.js 24+ is the intentional tested runtime for the CLI and library.

The command exits with code `1` when an error finding is present, `2` when scanning fails, and `0` otherwise.

## TypeScript API

```ts
import { generateHtmlReport, scanFocusPath } from "focuspath";

const report = await scanFocusPath("https://example.com", {
  maxSteps: 60,
  maxTabPresses: 240,
  maxOpaqueTabPresses: 120,
  direction: "reverse",
  focusSettleMs: 100,
  viewport: { width: 1440, height: 900 },
});

const html = generateHtmlReport(report);
```

The scanner currently targets Chromium and supports forward `Tab` or reverse `Shift+Tab` traversal. `maxSteps` limits observable report entries; `maxTabPresses` counts every Tab key press, including movement inside opaque hosts. Cross-origin frames and closed shadow roots inferred from repeated, uncanceled Tab movement use the independent `maxOpaqueTabPresses` budget. Canceled Tab events that leave focus in place are reported as stalled focus. Chromium DOM identity, not the display selector, drives stall and cycle detection. Stops affected by independently scrolling or clipping ancestors remain in the sequence with `scrollContexts`, including same-origin iframe viewports and parent-page scrollers, but are omitted from the final screenshot overlay because it represents a different scroll state. The deprecated `scrollContext` field mirrors the first entry for v0.4.1 compatibility. The report exposes its direction, effective limits, and exact stop reason. Computed outline and shadow values are recorded for manual review; FocusPath does not claim to automatically verify WCAG focus appearance.

Repository, documentation, and issue tracker: [github.com/damianociarla/focuspath](https://github.com/damianociarla/focuspath)

MIT © Damiano Ciarla
