# Demo assets

The poster and product film in this directory are generated from the real
landing-page DOM with Playwright. They contain only the repository's synthetic,
provider-neutral scenario.

Regenerate all assets from the repository root:

```bash
npm run capture:demo
```

The command starts the web app, drives each research-film chapter in a fixed
order, records a 1440×810 WebM master, and creates an H.264 MP4 derivative.
Browser and video encoder binaries are development dependencies; generated
caches remain outside the repository.
