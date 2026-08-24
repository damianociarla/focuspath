# Directories and outreach copy

<!-- markdownlint-disable MD013 MD034 MD036 -->

## The A11Y Project resource proposal

**Suggested category:** Development tools

**Title**

```text
FocusPath
```

**URL**

```text
https://damianociarla.github.io/focuspath/
```

**Description**

```text
An open-source Chromium CLI and TypeScript library that follows real Tab or Shift+Tab navigation, records observable focus stops, and produces a portable visual report. FocusPath is a diagnostic aid for keyboard accessibility review, not a WCAG conformance test.
```

**Proposal note**

```text
I am the maintainer of FocusPath and would like to propose it for the Development tools section. The project is MIT licensed, has a public repository and live bounded demo, documents its Chromium-only and opaque-boundary limitations, and explicitly positions itself as complementary to manual and established automated accessibility testing.
```

Submission guidance:
<https://www.a11yproject.com/contributing-guidelines/>

## awesome-accessibility pull request

**Suggested branch**

```text
add-focuspath
```

**Suggested commit**

```text
Add FocusPath keyboard traversal reporter
```

**Suggested list entry**

```markdown
- [FocusPath](https://damianociarla.github.io/focuspath/) - Open-source Chromium CLI and TypeScript library that visualizes observed Tab or Shift+Tab focus traversal in a portable report. Complements manual and rule-based accessibility testing.
```

**Pull request title**

```text
Add FocusPath keyboard traversal reporter
```

**Pull request body**

```text
## Resource

FocusPath is an MIT-licensed Chromium CLI and TypeScript library for observing keyboard focus traversal and generating portable visual reports.

## Why it belongs in this list

- directly supports keyboard accessibility testing;
- is open source and usable without an account;
- includes a live bounded demo and local CLI;
- documents Chromium-only behavior, opaque boundaries, privacy, and the fact that it does not certify WCAG conformance.

Project: https://damianociarla.github.io/focuspath/
Source: https://github.com/damianociarla/focuspath
```

Target list:
<https://github.com/lukeslp/awesome-accessibility>

## Accessibility Weekly pitch

Pitch the educational article rather than asking for a direct product listing.

**Subject**

```text
Link suggestion: observing keyboard focus order in a real browser
```

**Email**

```text
Hi David,

I would like to suggest a recent technical article about why DOM order does not always represent the route a keyboard user experiences, and what I learned while building an open-source Chromium tool to observe that route.

The article covers dynamic focus movement, opaque shadow/iframe boundaries, screenshot evidence, the limits of automation, and why the tool is deliberately positioned as complementary to manual and established rule-based accessibility testing.

Article: [insert published DEV or canonical article URL]

Project and live example: https://damianociarla.github.io/focuspath/

Disclosure: I wrote the article and maintain the open-source project described in it. FocusPath does not use AI and does not claim WCAG conformance.

Thank you for considering it,
Damiano Ciarla
```

Current editorial criteria:
<https://a11yweekly.com/good-links/>

## AlternativeTo submission

Only submit if AlternativeTo's moderators currently accept developer CLIs in
this category. Do not claim that FocusPath replaces a full accessibility suite.

**Name:** FocusPath

**Official URL:** <https://damianociarla.github.io/focuspath/>

**Source:** <https://github.com/damianociarla/focuspath>

**License:** MIT

**Platforms:** Linux, macOS, Windows; Node.js 24+; Chromium scanning engine

**Short description**

```text
Open-source keyboard focus traversal scanner and visual HTML reporter for web pages.
```

**Long description**

```text
FocusPath follows real Tab or Shift+Tab navigation in Chromium, records observable focus stops and deterministic findings, and generates a portable visual HTML report. It is designed to complement rule engines and manual accessibility testing rather than certify WCAG conformance.
```

**Tags:** accessibility, web-development, testing, command-line, open-source

Submission instructions: <https://alternativeto.net/faq/>

## LibHunt / JavaScript directory

**Title:** FocusPath

**URL:** <https://github.com/damianociarla/focuspath>

**Description**

```text
ESM TypeScript library and CLI that observes Tab or Shift+Tab traversal in Chromium and generates a portable visual focus-path report.
```

**Suggested categories:** Testing, CLI, Accessibility, Playwright

Contribution page: <https://js.libhunt.com/contribute>

## JavaScript or Node newsletter pitch

**Subject**

```text
Open-source project suggestion: FocusPath keyboard traversal reporter
```

**Body**

```text
Hi,

I maintain FocusPath, an MIT-licensed TypeScript CLI and library that follows real Tab or Shift+Tab navigation in Chromium and generates a self-contained visual report of the observed focus route.

Install: npx focuspath https://example.com
Source: https://github.com/damianociarla/focuspath
Demo: https://damianociarla.github.io/focuspath/

It is ESM-only on Node.js 24+, tested from the packed npm artifact on Linux x64, Windows x64, and macOS ARM64, and explicitly complements rather than replaces accessibility rule engines and manual testing.

Disclosure: I am the author.
```

## Direct practitioner outreach

Send this only to people with whom there is an existing relevant relationship.
Do not use it for bulk unsolicited outreach.

```text
Hi [name] — I have released an open-source tool for visualizing the focus route observed during real Chromium keyboard traversal.

Given your work on [specific project/topic], I would value your view on one narrow question: does the report communicate observable stops and opaque boundaries responsibly enough to support manual review?

There is no expectation to promote it. If you have time to try one complex page, concrete criticism would be very useful:
https://damianociarla.github.io/focuspath/

Source and limitations:
https://github.com/damianociarla/focuspath
```

## Repository discoverability

The repository already has a strong description, homepage, license, and core
topics. Consider adding these topics only if GitHub's topic limit permits and
they remain accurate:

- `focus-management`
- `developer-tools`
- `testing-tools`
- `command-line`

Do not remove the more specific existing topics `a11y`, `accessibility`,
`keyboard-navigation`, `playwright`, and `typescript`.
