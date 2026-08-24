# Changelog

## 0.6.9

- Share one 40-megapixel safety budget between Chromium capture and report rendering so every scanner result remains renderable.
- Clamp requested and unlimited screenshot heights using the actual capture width, preserving full source dimensions and marking `capture.truncated`.
- Cover 1440×30,000, 4000×11,000 and unlimited scans end to end, and move the memory gate to a near-limit 1440×27,777 capture.
- Report screenshot truncation in the CLI and document the package's intentional ESM-only contract.

## 0.6.8

- Replace the full-frame JavaScript JPEG decoder with synchronous native libjpeg-turbo validation, reducing a 1440×20,000 report from roughly 794 MiB to about 133 MiB peak RSS locally while rejecting truncated entropy streams.
- Gate CI and releases on a real 1440×20,000 Chromium screenshot staying below a conservative 384 MiB reporter budget.
- Add the `focuspath/reporter` entry point so report-only consumers do not load Playwright, while preserving the root export for compatibility.
- Reduce the untrusted saved-report pixel ceiling to 40 megapixels without changing the scanner's default 20,000px screenshot height.

## 0.6.7

- Fully decode saved-report JPEG evidence with strict entropy validation and explicit resolution and memory limits before rendering.
- Restrict portable reports to the JPEG format emitted by the Chromium scanner, rejecting superficially valid PNG or WebP payloads.
- Require both CI and CodeQL analysis before `main` can be merged.

## 0.6.6

- Enforce coherent saved-report counters, contiguous step identities, valid issue references, capture metadata and network totals before rendering.
- Bound saved-report arrays, text, coordinates, pixels and decoded screenshot bytes; verify PNG, JPEG or WebP structure and exact image dimensions.
- Fail closed when production state is unknown for every release trigger, with an explicit protected rollback as the only override.
- Add ESLint, dependency audit and CodeQL release gates, and enable repository Dependabot security updates.
- Keep the landing navigation on one line at 320px and cover the compact header in browser tests.

## 0.6.5

- Restrict the TypeScript scanner to HTTP(S) by default and require an explicit trusted-input opt-in for local protocols.
- Validate saved report objects at runtime before interpolating enum, numeric, SVG, CSS, or screenshot fields into portable HTML.
- Recover the deployed version from CloudFormation when API health is unavailable and fail closed for unapproved recovery with unknown state.
- Document the difference between request callbacks and the hosted service's DNS-pinned SSRF boundary.

## 0.6.4

- Reject embedded URL credentials in both the CLI and TypeScript scanner, and defensively redact userinfo from legacy report objects.
- Default schemeless public targets to HTTPS while preserving HTTP for local development hosts.
- Require protected rollback confirmation when production and the requested release are distinct artifacts with equal SemVer precedence.
- Keep the primary landing-page actions inside compact mobile viewports and test the 375×667 layout.
- Document that query strings, screenshots, accessible names, and report content may contain sensitive data.

## 0.6.3

- Compare release versions with tested SemVer 2.0.0 precedence, including prereleases and build metadata.
- Verify the version comparator behavior in CI instead of relying only on workflow text guardrails.
- Add `focuspath -V` and `focuspath --version`, and exercise the installed tarball version during release validation.
- Normalize SemVer build metadata into valid immutable ECR image tags.
- Describe the personal-repository rollback gate precisely as owner confirmation rather than independent review.

## 0.6.2

- Serialize every production release and recovery run so an older workflow cannot overtake a newer deployment.
- Refuse API downgrades by default and require an explicit, approval-gated rollback environment for intentional reversions.
- Restrict grouped Dependabot updates to minor and patch releases so incompatible majors arrive as isolated pull requests.
- Publish the hosted beta server in OpenAPI and verify that release metadata stays aligned.
- Reveal the landing-page headline and primary action sooner while preserving reduced-motion behavior.

## 0.6.1

- Route both tag releases and manual recovery through a protected GitHub environment so every AWS deployment emits the same immutable OIDC subject.
- Exercise AWS role assumption before the idempotent API preflight, covering the real recovery path instead of only the healthy-API skip.
- Move the bounded App Runner ECR role into the bootstrap stack and reduce the application CloudFormation role to exact `GetRole` and `PassRole` access.
- Repair the Dependabot configuration and validate every GitHub YAML file plus workflow shell with pinned, checksum-verified `actionlint`.

## 0.6.0

- Bound local scans to 500 requests and 20,000 screenshot pixels by default, expose both CLI limits, and require an explicit `--unlimited` opt-out.
- Emit report schema v4 capture metadata and explain when screenshot evidence is truncated while retaining every focus stop in the sequence.
- Admit hosted scans atomically across capacity and quotas so a `503` never consumes client, global or target allowance.
- Make `/v1` responses evolutionary, publish an explicit compatibility policy and keep request bodies strict.
- Deploy and health-check the reversible AWS service before npm publication; make ECR, npm and GitHub Release recovery idempotent.
- Scope GitHub Actions permissions per job, pin third-party actions to commit SHAs and support release recovery from an existing tag.
- Replace the broad CloudFormation role with enumerated service actions, FocusPath resource scopes and a permission boundary for application roles.

### Migrating from report schema v3

FocusPath `0.6.0` emits `version: 4`. `FocusReport.capture` records the source document size and whether `maxScreenshotHeight` truncated the captured pixels. The existing `document` field remains the exact JPEG dimensions, and the HTML reporter continues to accept saved v2 and v3 reports.

## 0.5.1

- Capture up to the configured 5,000px document budget through Chromium's beyond-viewport screenshot API.
- Keep visible controls plottable when decorative overflow does not clip or scroll them.
- Acquire scan capacity atomically and reject non-object JSON bodies with HTTP 400.
- Record request totals, blocked requests and blocked resource types so restricted rendering is explicit in reports and API responses.
- Display the live engine version on the website and coordinate API deployment, version health checks and Pages publication in the release pipeline.

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
