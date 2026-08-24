# Launch checklist and calendar

## Success definition

The launch succeeds if FocusPath gains qualified users who run scans, file
useful issues, or adopt it in a frontend workflow. Stars and upvotes are useful
distribution signals, not the product outcome.

Track, without adding invasive analytics:

- GitHub unique visitors, clones, stars, and issue quality;
- npm weekly downloads;
- live scanner completions and bounded error categories from existing
  operational metadata;
- clicks from tagged campaign links, if privacy-preserving analytics are later
  added;
- recurring questions that should become documentation.

Record a baseline immediately before the first publication so launch traffic
can be compared with the previous seven days.

## T-7 to T-4 days: prepare

- [ ] Verify the live scanner, GitHub repository, npm page, docs, and OpenAPI.
- [ ] Confirm `npx focuspath https://example.com` works in a clean project.
- [ ] Review every launch text for the current version and Node requirement.
- [ ] Create or warm up the Product Hunt maker account; new accounts may have
      a waiting period before they can launch.
- [ ] Check current self-promotion rules for every chosen subreddit.
- [ ] Prepare short, honest answers for Chromium-only scope, privacy, SSRF
      protection, rule engines, and manual testing.
- [ ] Capture the pre-launch metrics baseline.

## T-3 to T-1 days: stage

- [ ] Upload the social card and demo animation where each platform can render
      them natively.
- [ ] Preview the DEV article on desktop and mobile.
- [ ] Test every link from the staged article.
- [ ] Prepare the Show HN link submission and keep the first comment ready.
- [ ] Populate Product Hunt fields without publishing.
- [ ] Choose a four-to-six-hour window when the maker can answer comments.

## Day 1: educational article

- [ ] Publish `dev-article.md` on DEV.
- [ ] Add the canonical URL if cross-posting from a personal blog.
- [ ] Share the article once on LinkedIn and one short-form network.
- [ ] Answer questions; do not cross-post the same generic announcement yet.

## Day 3 or 4: Show HN

- [ ] Submit the homepage using the exact Show HN title.
- [ ] Add the prepared first comment immediately.
- [ ] Stay available and answer technical criticism directly.
- [ ] Turn repeated questions into README or documentation improvements.
- [ ] Do not ask people to upvote the submission.

## Day 7 to 10: Product Hunt

- [ ] Recheck Product Hunt's current launch timing and asset requirements.
- [ ] Publish the prepared listing and maker comment.
- [ ] Upload the social card, scanner result, homepage, and mobile images.
- [ ] Reply as the maker throughout the day.
- [ ] Share the launch link without asking for upvotes.

## Weeks 2 and 3: durable distribution

- [ ] Submit the A11Y Project resource proposal.
- [ ] Open the awesome-accessibility pull request.
- [ ] Submit the educational article to Accessibility Weekly.
- [ ] Add accurate AlternativeTo and LibHunt entries if their current category
      rules fit a developer CLI.
- [ ] Share tailored posts in at most one Reddit community at a time.
- [ ] Contact design-system and accessibility practitioners who can provide
      expert feedback; do not send bulk unsolicited messages.

## Comment-response bank

### Does this replace axe or Lighthouse?

No. Rule engines detect many classes of accessibility problems. FocusPath
observes the keyboard route a real Chromium session follows and preserves that
route as visual evidence. They solve different, complementary problems.

### Does it prove WCAG compliance?

No. FocusPath is a bounded diagnostic tool, not a conformance test. Manual,
cross-browser, assistive-technology, content, and focus-appearance testing
remain necessary.

### Why Chromium only?

The first release prioritizes a deterministic, deeply tested traversal model.
Firefox and WebKit are roadmap items; current reports identify Chromium so the
evidence is not misrepresented as platform-independent.

### What happens to scanned pages?

The CLI runs locally. The hosted beta intentionally has no application-level
report store, applies strict resource and traversal budgets, and documents that
infrastructure providers may retain request metadata. Reports can contain page
pixels and accessible names and should be reviewed before sharing.

### What should I test first?

Use a page with menus, dialogs, custom controls, scroll containers, or embedded
content. Compare the resulting route with what the interface visually implies.

## Post-launch review

After 14 days, write down:

- which channel produced actual scans or issues;
- the three most common objections;
- where installation or first-run friction occurred;
- which report evidence users misunderstood;
- whether the next release should prioritize integration, browser coverage, or
  report comparison.

Repeat a launch only for a meaningful new capability, not for patch releases.
