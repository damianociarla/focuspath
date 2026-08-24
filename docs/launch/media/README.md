# Launch media

These assets were captured from the public FocusPath `v0.7.2` site and live
scanner on 2026-08-24. Re-capture version-bearing assets after a visible or
engine-version change.

## Files

- `homepage-desktop.jpg` — 1440×900 desktop first viewport.
- `homepage-mobile.jpg` — 390×844 compact first viewport.
- `homepage-full.jpg` — 1440px-wide full landing page reference.
- `demo-01-idle.jpg` — live scanner before a URL is entered.
- `demo-02-ready.jpg` — Example Domain URL entered.
- `demo-03-progress.jpg` — active scan state.
- `demo-04-result.jpg` — completed Example Domain scan.
- `demo.gif` — compact four-state animation for posts that support GIF.
- `demo.mp4` — H.264 version for platforms that prefer video.

The canonical 1200×630 social image remains:

```text
apps/web/public/social-card.png
```

## Recommended use

- Product Hunt cover: `apps/web/public/social-card.png`
- Product Hunt gallery: result, desktop, mobile, then animation
- DEV cover: deployed social card URL
- Reddit: `demo.gif` or `demo-04-result.jpg`
- LinkedIn: upload `demo.mp4` natively, with the English or Italian post
- Bluesky/Mastodon: result screenshot plus descriptive alt text

## Alt text

Use the platform-specific alt text in
[`../community-posts.md`](../community-posts.md). Do not put the complete post
copy into the alt field; describe only the visual content and meaningful text.

## Refresh procedure

1. Use the production site, not a local mock.
2. Capture the first viewport at 1440×900 and 390×844.
3. Scan `https://example.com` through the live interface.
4. Capture idle, entered URL, progress, and completed states.
5. Verify that the visible engine matches the current release.
6. Rebuild the GIF and MP4 and inspect both before publishing.
