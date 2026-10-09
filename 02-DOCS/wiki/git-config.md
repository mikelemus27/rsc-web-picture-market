# Git configuration for this repository

This repository follows an explicit git workflow: topic branches off `dev`,
PRs always target `dev` (never `main`), the human merges every PR, and `dev`
advances in a straight line (`fast-forward`). The git configuration below
makes **that contract explicit on every machine that works on this repo**,
so behaviour never depends on inherited or implicit defaults.

> ⚠️ **Git configuration does not travel with clones.** These settings live in
> `.git/config` (repo) and `~/.gitconfig` (global) — they are **not committed**.
> After cloning on a new machine, re-apply them and verify (see below).

## Repo-level (`git config …`, applied in this clone)

| Config | Value | Effect | Why for this repo |
| --- | --- | --- | --- |
| `pull.ff` | `only` | `git pull` never rebases and never creates an implicit merge: if the local branch has diverged, it **fails loudly** instead of guessing | After a PR merge, syncing `dev` is a pure fast-forward; any divergence is a signal to inspect, never something to auto-merge |
| `merge.ff` | `only` | Same contract for bare `git merge` (e.g. `git merge origin/dev`) | Same guarantee when syncing without `pull` |
| `fetch.prune` | `true` | Each fetch drops remote-tracking refs for branches deleted on the remote | Every merged PR deletes its branch on GitHub; without pruning, dead `origin/fix/…` refs accumulate locally forever |

Apply with:

```bash
git config pull.ff only
git config merge.ff only
git config fetch.prune true
```

## Global level (`git config --global …`)

| Config | Value | Effect | Why |
| --- | --- | --- | --- |
| `push.autoSetupRemote` | `true` | `git push` on a new branch creates the upstream automatically (Git ≥ 2.37) | Topic branches are ephemeral here; no more `-u` |
| `push.default` | `current` | `git push` without arguments pushes the current branch under its own name, explicitly | Removes any dependency on tracking-rule inference |

Apply with:

```bash
git config --global push.autoSetupRemote true
git config --global push.default current
```

## Verify (read-only)

```bash
git config pull.ff; git config merge.ff; git config fetch.prune
git config --global push.autoSetupRemote; git config --global push.default
```

## Resulting daily workflow

```bash
git switch dev                       # or after a PR merge:
git fetch && git merge --ff-only origin/dev   # dev advances only if line is straight
git switch -c fix/dev-<kebab> origin/dev      # topic branch for the next change
```

The PR merge → `dev` sync step is now safe **by contract**: `git pull` on
`dev` can only fast-forward, and any real divergence makes the command fail
so the maintainer decides — nothing is ever merged or rebased implicitly.

Recorded 2026-10-08 together with the db-healthcheck TTY/color fix
(PR #32). See `02-DOCS/wiki/ftd/db-healthcheck-tty-hang-colors.md` for the
change that motivated settling this configuration.