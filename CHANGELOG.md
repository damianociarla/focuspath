# Changelog

## 0.5.0

- Stabilize the final capture at scroll position zero, interrupting in-flight smooth focus scrolling before geometry and screenshot collection.
- Bound pinned proxy connections, address attempts, response inactivity and total HTTP duration while cancelling upstream work when Chromium disconnects.
- Protect DNS validation with separate client/global preflight quotas and canonical target-host keys.
- Emit report schema v3: `rect` is final screenshot geometry and `observedRect` preserves traversal-time geometry; the HTML reporter continues to accept saved v2 reports.
- Add `reportVersion`, viewport and capture dimensions to hosted responses, plus an opt-in structured format with the screenshot instead of duplicated HTML.
- Clarify the hosted API beta limits, local package capabilities and visual-evidence guarantees across the site and documentation.

### Migrating from report schema v2

FocusPath `0.5.0` emits `version: 3`. In v3, `FocusStep.rect` always describes the final screenshot state; use `FocusStep.observedRect` for the position seen during keyboard traversal. Consumers that validate hosted responses must also accept the new response metadata. Request `{ "format": "structured" }` to receive screenshot pixels directly, or omit `format` to retain the portable `reportHtml` response.

## 0.4.4

- Re-measure final focus geometry through Chromium border quads so sticky elements and transformed iframes align with the screenshot.
- Classify visual evidence as plotted, partially visible, outside capture, or sequence-only while retaining traversal-time coordinates.
- Treat `overflow:hidden` and `overflow:clip` ancestors as clipping contexts.
- Route hosted Chromium traffic through a local DNS-pinning proxy that connects only to the validated public IP.
- Test the production documentation build at 390 px with DM Mono loaded and long commands contained inside their own scrollers.

## 0.4.3

- Size screenshot evidence from the JPEG pixels Chromium actually captured when a page locks root scrolling.
- Omit focus stops outside the captured image from the visual overlay while retaining them as sequence-only evidence.
- Prevent focus-path lines and the report viewport from extending into fabricated blank space.

## 0.4.2

- Follow scrolling and clipping contexts across same-origin iframe viewports and parent documents.
- Record multiple `scrollContexts` per focus stop while retaining the v0.4.1 `scrollContext` compatibility alias.
- Keep iframe steps out of the final screenshot overlay whenever nested viewport or parent-scroller state can differ.
- Cover internal iframe scrolling, external parent scrollers, and combined contexts in forward and reverse traversal.

## 0.4.1

- Separate Chromium DOM identity from human-readable selectors when detecting stalls and cycles.
- Mark stops inside independently scrollable containers as sequence-only instead of plotting them over a different final screenshot state.
- Exercise reverse traversal across positive tabindex, open and closed shadow roots, and same- and cross-origin frames.
- Run the development CLI from its generated bundle and smoke-test the documented workflow in CI.
- Commit client, global, and target-host quotas atomically so rejected requests do not consume unrelated capacity.

## 0.4.0

- Add reverse keyboard traversal with `Shift+Tab` to the TypeScript API and CLI.
- Record traversal direction in schema v2 reports, rendered HTML, and hosted API responses.
- Document and compile-check bidirectional scanning examples.

## 0.3.4

- Install Tab-cancellation instrumentation before page scripts execute.
- Detect capture listeners that combine `preventDefault()` with `stopImmediatePropagation()`.

## 0.3.3

- Report canceled Tab events as stalled focus instead of inferring a closed shadow root.
- Correct the documented TypeScript report export and verify the public API example in tests.
- Prevent horizontal overflow in the mobile documentation layout and cover it in Chromium.

## 0.3.2

- Infer closed shadow roots only after repeated focus, preserving deterministic findings on ordinary custom elements.
- Separate observable focus stops from total Tab presses and expose both traversal budgets in reports and the API.
- Make total and per-opaque-host Tab limits configurable with precise stop reasons and step references.
- Continue beyond large cross-origin frames under the expanded default opaque-host budget.
- Add public documentation for CLI, library, API, privacy, and operational security limits.

## 0.3.1

- Continue keyboard traversal beyond cross-origin iframes and closed shadow roots with bounded opaque-host handling.
- Report opaque focus hosts explicitly instead of misclassifying internal focus movement as a stall.
- Cover CORS, origin verification, quotas, capacity, and timeout HTTP responses end to end.
- Align the OpenAPI URL input and configurable result limits with runtime behavior.

## 0.3.0

- Distinguish focusable elements with generic roles from named controls.
- Traverse same-origin iframes and open shadow roots while preserving stable selectors.
- Correct full-page coordinates for fixed focus targets.
- Expand browser fixtures and add HTTP API end-to-end tests.
- Publish complete OpenAPI schemas for scan steps, findings, geometry, and focus styles.
- Align all workspace versions and add a tag-driven trusted publishing workflow.

## 0.2.0

- Use Chromium's accessibility tree for computed control names and roles.
- Distinguish document exhaustion, completed cycles, step limits, and stalled focus.
- Apply the configured timeout to the complete scan and make focus settling configurable.
- Parse CLI options strictly, regardless of their position.
- Revalidate target DNS on every browser request and apply client quota after input validation.
- Ship a self-contained npm README and license, with a CI tarball-content check.
- Document scanner limitations, live-service privacy, and manual focus-appearance review.

## 0.1.0

- Initial public release.
