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
--max-steps <number>         Maximum Tab presses (default: 50)
--viewport <width>x<height>  Browser viewport (default: 1440x900)
--headed                     Show Chromium while scanning
```

If Chromium is not installed yet, run `npx playwright install chromium`.

The command exits with code `1` when an error finding is present, `2` when scanning fails, and `0` otherwise.

## TypeScript API

```ts
import { generateHtmlReport, scanFocusPath } from "focuspath";

const report = await scanFocusPath("https://example.com", {
  maxSteps: 60,
  focusSettleMs: 100,
  viewport: { width: 1440, height: 900 },
});

const html = generateHtmlReport(report);
```

The scanner currently targets Chromium. It detects accessible names using Chromium's accessibility tree, positive `tabindex`, repeated focus, and traversal stop conditions. Computed outline and shadow values are recorded for manual review; FocusPath does not claim to automatically verify WCAG focus appearance.

Repository, documentation, and issue tracker: [github.com/damianociarla/focuspath](https://github.com/damianociarla/focuspath)

MIT © Damiano Ciarla
