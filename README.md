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

FocusPath is an early diagnostic tool, not a WCAG conformance test. It currently runs Chromium and follows forward `Tab` navigation. Cross-origin iframes and closed shadow roots are represented as opaque focus hosts so traversal can continue, but their internal controls cannot be inspected. Dynamic interfaces, platform-specific widgets, reverse navigation, and focus appearance still require manual and cross-browser testing. Outline and box-shadow values are evidence for a reviewer; FocusPath does not automatically certify WCAG focus appearance.

## Usage

```bash
# Default report: ./focuspath-report.html
npx focuspath https://example.com

# Choose a viewport and maximum number of stops
npx focuspath localhost:3000 --viewport 390x844 --max-steps 80

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

The response contains scan metadata, focus stops, findings, and a self-contained `reportHtml` document. `GET /health` reports API readiness. The beta API intentionally accepts only public HTTP(S) targets on ports 80 and 443, revalidates DNS for browser requests, limits scan duration and request volume, and rate-limits clients and target hostnames. Complete SSRF containment still requires infrastructure-enforced egress filtering; see the AWS infrastructure notes.

The response contract and error statuses are documented in [OpenAPI 3.1](docs/openapi.yml).

## Roadmap

- [ ] GitHub Action with SARIF annotations
- [ ] Compare focus paths between two builds
- [ ] Detect focus restoration after dialogs close
- [ ] Export JSON alongside the visual report
- [ ] Test Firefox and WebKit

## Contributing

Bug reports and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a contribution.

## License

[MIT](LICENSE) © Damiano Ciarla
