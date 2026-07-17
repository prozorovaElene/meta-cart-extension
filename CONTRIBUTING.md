# Contributing

Two of us working on this repo — a few light rules so we don't step on each
other.

## Branches

- `main` is always in a loadable state (`chrome://extensions` → Load
  unpacked should work on the tip of `main` at all times).
- No direct pushes to `main` — work in a branch, open a PR, merge from
  there. (Turn on "Require a pull request before merging" for `main` in
  GitHub repo Settings → Branches — needs to be done once by whoever has
  admin on the repo.)
- Branch naming: `feat/<short-name>`, `fix/<short-name>`,
  `chore/<short-name>`. Example: `feat/site-override-target`,
  `fix/dedupe-window`.

## Commits

- Small, focused commits over one giant commit. Message = what changed and
  why, not a restatement of the diff.

## Before opening a PR

```
npm install      # once, or after devDependencies change
npm run lint      # eslint .
npm run format:check
```

Fix anything either one flags (`npm run format` to auto-fix formatting).

## PRs

- Use the PR template (auto-filled when you open one).
- Tag the other person as reviewer. Small extension = fast reviews, don't
  let PRs sit.
- Merge with squash so `main` history stays one-commit-per-change.

## Where things live

- Extension code: this repo, root-level (`background.js`, `content.js`,
  `site-overrides.js`, `popup.*`, `options.*`).
- Backend: separate repo (not started yet — see [BACKLOG.md](BACKLOG.md)).
  The extension only needs the two HTTP endpoints documented in
  [README.md](README.md#auth-flow-oauth-style) and
  [README.md](README.md#item-capture-api-contract); it doesn't care how the
  backend is built.
- Task list / who's doing what: [BACKLOG.md](BACKLOG.md). Move items
  between sections as they're picked up / finished instead of leaving them
  stale.
