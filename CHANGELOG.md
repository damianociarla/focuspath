# Changelog

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
