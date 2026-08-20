# Contributing to FocusPath

Thanks for helping make keyboard accessibility easier to inspect.

## Before opening a change

1. Search existing issues and discussions.
2. Open an issue for behavior changes or new detection rules.
3. Keep findings deterministic: a rule should explain what was observed without claiming full WCAG conformance.

## Local checks

```bash
npm install
npm test
npm run typecheck
npm run build
```

Please include a small reproducible HTML fixture or a unit test for bug fixes.
