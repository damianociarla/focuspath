# FocusPath

**See where keyboard navigation breaks.**

FocusPath traverses a web page with Chromium, records the keyboard focus stops it reaches, flags deterministic accessibility problems, and generates a portable visual report.

```bash
npx focuspath https://example.com
```

> FocusPath is an early open-source release. It complements—not replaces—manual accessibility testing and established rule engines.

## What it reports

- The observed focus sequence drawn over a page screenshot
- Focusable controls with no computed accessible name
- Positive `tabindex` values that override natural document order
- Focus cycles and cases where focus stops moving
- Element selector, Chromium accessibility role and name, position, and computed focus styles at every observed step

## Scope and limitations

FocusPath is an early diagnostic tool, not a WCAG conformance test. It currently runs Chromium and follows either forward `Tab` or reverse `Shift+Tab` navigation. Cross-origin iframes are represented as opaque hosts; closed shadow roots are inferred only when repeated, uncanceled Tab movement makes them observable. A canceled Tab event that leaves focus in place is reported as stalled focus. Internal opaque controls cannot be inspected. Traversal is bounded separately by observable stops, total Tab presses, and repeated presses within one opaque host. Dynamic interfaces, platform-specific widgets, comparisons between directions, and focus appearance still require manual and cross-browser testing.

## Usage

```bash
# Default report: ./focuspath-report.html
npx focuspath https://example.com

# Choose a viewport and maximum number of stops
npx focuspath localhost:3000 --viewport 390x844 --max-steps 80

# Bound total traversal and one large opaque widget independently
npx focuspath example.com --max-tab-presses 320 --max-opaque-tab-presses 160

# Start at the end and inspect the Shift+Tab route
npx focuspath example.com --direction reverse

# Choose the report path
npx focuspath https://example.com --output reports/home.html
```

Playwright may ask you to install Chromium the first time:

```bash
npx playwright install chromium
```

FocusPath exits with code `1` when it finds an error, `2` when the scan itself fails, and `0` otherwise.

## Use as a library

```ts
import { generateHtmlReport, scanFocusPath } from "focuspath";

const result = await scanFocusPath("http://localhost:3000", {
  viewport: { width: 1440, height: 900 },
  maxSteps: 60,
  maxTabPresses: 240,
  maxOpaqueTabPresses: 120,
  direction: "reverse",
  focusSettleMs: 100,
});

const html = generateHtmlReport(result);
```

## Development

Requirements: Node.js 24+. This is an intentional project baseline so the CLI, CI, Playwright container, and release workflow use the same runtime; broader compatibility can be considered once it has its own tested matrix.

```bash
npm install
npx playwright install chromium
npm test
npm run build
npm run dev
```

To exercise the CLI directly from the TypeScript workspace, run the generated bundle through the development command:

```bash
npm run dev --workspace focuspath -- https://example.com
```

The monorepo contains:

- `packages/focuspath`: scanner, report generator and CLI
- `apps/web`: FocusPath landing page and interactive sample report
- `apps/api`: protected live-scanner HTTP API
- `infra/aws`: Docker/App Runner deployment and production migration notes

## Live scanner

Run the API beside the web app:

```bash
npm run build --workspace focuspath
npm run dev:api
npm run dev
```

The frontend uses `http://localhost:8787` during local development. In production, set `VITE_API_URL` while building the web app. See [infra/aws](infra/aws/README.md) for the AWS deployment.

### HTTP API

```http
POST /v1/scans
Content-Type: application/json

{"url":"https://example.com"}
```

The default response contains report schema version, engine version, viewport and capture dimensions, traversal metadata, focus stops, findings, network restrictions, and a self-contained `reportHtml` document. Send `{"url":"https://example.com","format":"structured"}` to receive screenshot pixels directly instead of embedded HTML. Schema v3 uses `rect` for final screenshot geometry and `observedRect` for traversal-time geometry; screenshots extend beyond the first viewport up to the configured height budget. The hosted beta scans forward under a 25-second deadline and stricter quotas than the local package. It blocks font and media requests to bound cost, and reports those restrictions because fallback fonts can change layout geometry. DNS validation is preflight-limited, target keys are canonicalized, and Chromium traffic passes through a bounded local proxy that connects only to validated public IPs. Infrastructure egress filtering remains recommended defense in depth for a general-purpose service.

FocusPath does not intentionally persist submitted page content or generated reports. AWS and GitHub may retain request metadata according to their operational logging policies; no application-level report store is configured for the beta.

The response contract and error statuses are documented in [OpenAPI 3.1](docs/openapi.yml).

## Roadmap

- [ ] GitHub Action with SARIF annotations
- [ ] Compare focus paths between two builds
- [ ] Detect focus restoration after dialogs close
- [x] Export structured JSON and screenshot evidence from the hosted API
- [ ] Test Firefox and WebKit

## Contributing

Bug reports and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a contribution.

## License

[MIT](LICENSE) © Damiano Ciarla
