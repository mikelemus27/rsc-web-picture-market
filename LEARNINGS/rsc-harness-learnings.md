# rsc harness learnings

Projects: `rsc-web-picture-market` (original — §1–§7) and `rsc-RocketLandingSimulation` (adopted 2026-10-12 — §8) — rsc-harness (`@ericrisco/rsc`) orchestrating multiple AI assistant targets in these repositories.

Use this as an operational reference for how the rsc harness is installed, versioned, updated and repaired in these projects. Verify current versions and `.rsc.json` before copying commands; the harness changes with every release. Sections that describe one project name it; everything else is shared.

Sources: official README of the installed package (`@ericrisco/rsc`, 3.0.12 → **3.0.22**), GitHub releases of `ericrisco/rsc-harness`, and hands-on experience upgrading this repo 2.0.15 → 3.0.12 (2026-10-09) then 3.0.12 → 3.0.22 via background same-major updates (2026-10-11).

## 1. What rsc-harness is

A model is only the brain. Real work also needs project memory, tools, domain knowledge, rules and repeatable workflows. rsc-harness builds that harness per project through one guided flow (`onboard`):

- **You state the outcome**, no skill/hook/MCP vocabulary required.
- The wizard reads only the project root, asks how technical to talk (the one conversation setting), project kind, goal and assistants.
- A **proportional plan explains every choice** (selected / deferred / excluded, each with a reason). Nothing writes before you accept the exact plan (SHA-256 plan id; rerun with `--accept-plan <id>`).
- The result is verified; deterministic checks prove the installed harness matches the plan.
- It grows from evidence: a deferred capability is proposed later only if the project develops the need.

The unit of installation is **one skill**. Real skill files are written once to `.rsc/skills/<id>/`; each assistant gets a lightweight symlink back to that shared base (real copy when symlinks are impossible). The catalog ships 270 skills.

## 2. What is versioned vs machine-local (the split is the point)

**Commit these (the harness travels by git):**

| Path | Meaning |
| --- | --- |
| `.rsc.json` | The decision: which assistants (`targets`), which skills, **which catalog version** (`catalogVersion`), the tier, which gates you disarmed (`optOuts`), `agents`, `ownSkills`, `onboarding`, `version` |
| `01-TOOLS/` · `02-DOCS/` | Your tooling and your wiki (chaos → knowledge: `inbox/` → `raw/` → wiki; OKF-conformant markdown, also an Obsidian vault) |
| Skills and agents you wrote by hand | Yours. rsc does not claim, count as drift, or touch them |
| `.claude/rsc-bootstrap.mjs`, `AGENTS.md` (+ `GEMINI.md`, `CONVENTIONS.md`, `.github/copilot-instructions.md` on multi-target repos) | The wiring and the injected always-on layer |
| `.claude/settings.json` | Tracked (as rsc intends): the Claude Code hook wiring and the git-permissions allow list. It is the pair of `rsc-bootstrap.mjs` — see §2.2. `.claude/settings.local.json` is local by name (session-memory hooks) and is never tracked |

**Do not commit (rsc adds them to `.gitignore`):**

| Path | Why |
| --- | --- |
| `.rsc/` | Machine state: hook scripts, seals, logs, fallback memory, backups, `.version`, `.base-versions.json` |
| `.worktrees/` | Isolation worktrees for parallel sessions |
| The per-assistant skill links (`.claude/skills/`, `.opencode/agents/`, …) | Symlinks vs copies — machine-local shape |

### 2.1 `.mjs` and `rsc-bootstrap.mjs`

**`.mjs` = ES Module, forced.** `.js` is ambiguous — Node decides by the nearest `package.json` `"type"` field. `.mjs` removes the ambiguity and tells Node "parse this as ESM no matter what"; `.cjs` is the mirror image ("always CommonJS"). Same JavaScript language, different module semantics. It matters here because `rsc-bootstrap.mjs` is dropped into *any* host repo — one whose `package.json` may declare `"type": "commonjs"` or may not exist at all — so its top-level `import { existsSync } from 'node:fs'` must always parse.

**`rsc-bootstrap.mjs` is the one piece of the harness that travels in git.** `.rsc/` cannot travel: its contents are symlinks on one OS and real copies on another, so committing either shape breaks the other. rsc's response is to point the committed hook wiring at this committed shim, which then decides:

1. **Harness mounted** → delegate to the real script inside `.rsc/` and print *nothing*. The healthy case is almost everyone, every session, so it must cost zero bytes of context (one `existsSync`, no output).
2. **Harness not mounted** → say what is wrong as a *symptom*, name what `npx @ericrisco/rsc@<catalogVersion> sync` would install, ask once, and block nothing.

It never throws (a crash would make a safety guard indistinguishable from an allow) and fails open on the exit code, but reports a genuine crash on stderr rather than swallowing it.

### 2.2 The `.claude/settings.json` pairing

The bootstrap is only useful because `.claude/settings.json` references it in every hook (`SessionStart`, `PreToolUse`, `Stop`, …). **The two are a pair**: if `settings.json` is not committed, the hook wiring does not travel, so a fresh clone has no hooks at all and the bootstrap is never invoked — the "a clone is told the harness is missing" behaviour is dead.

- rsc's generated `.gitignore` therefore un-ignores **both** `!.claude/rsc-bootstrap.mjs` and `!.claude/settings.json`. Keep both tracked or the pair is broken.
- **This repo (2026-10-11): `settings.json` is tracked**, to keep the harness functional on any clone. (It was briefly untracked earlier the same day as a "solo dev, no clones" call; that was reverted because it silently disabled the clone-notice mechanism — the wiring is only as good as the file that carries it.)
- `.claude/settings.local.json` is local by name (session-memory hooks) and is never tracked — rsc does not un-ignore it.
- If `settings.json` is ever found missing from disk after an edit, recover it with `git show <commit>:.claude/settings.json > .claude/settings.json`, or regenerate the whole wiring with `npx @ericrisco/rsc@<catalogVersion> sync`.

A clone runs one command to get the exact harness the project pinned — **never `@latest`**:

```bash
npx @ericrisco/rsc@<catalogVersion> sync
```

The assistant tells a clone what is missing and asks before installing anything.

## 3. Always-on layers injected into every session

- **rsc-suggest** — tiny always-on skill injected at session start and after every compaction. Classifies every turn into one lane (Answer / FTD / SDD), spots a capability the user lacks and proposes the matching skill (`rsc add <id>` after a one-word confirm), notices a broken harness (doctor/repair), and handles first contact (`init` → `02-DOCS/wiki/harness/user-profile.md`, or `.rsc/.no-harness` to decline forever).
- **orient** — the always-on voice: short one-idea STE-style sentences in the user's language, every answer standalone, technical or with analogies (from `technical_level` in `user-profile.md`), every turn closes with the compass block (📍 today/next-step ❓).
- **unslop** — makes text you send to other people sound human, no AI tells.
- In Claude Code a hook re-asserts the **lane decisor** on every turn, so every request is classified before anything is written.

## 4. The lanes: Answer / FTD / SDD

Every turn takes exactly one lane and the agent names it:

1. **Answer** — read-only: explain, compare, investigate, audit, review, propose. Nothing is written. Ambiguity asks one question and stays here.
2. **FTD (Fast-Track Development)** — the default for ordinary authorised change: one feature document per feature in `02-DOCS` (intent, scope, checklist, evidence, next step); tasks checked against observed proof, never intention.
3. **SDD (ten-phase chain)** — for big or complex work where durable artifacts settle real ambiguity. The agent enters it on its own; the human still decides *what* gets built (approves spec + clarifications), then picks review-per-phase or autopilot. Publishing always asks.

Since 3.0 the agent chooses and says why; the human never has to pick a method.

## 5. rsc 3.0 — safe for teams by default

Four defaults changed, no new commands to learn:

| Feature | What happens | Turn off |
| --- | --- | --- |
| **Trunk policy** | If the repo shows CI, a deployment file, or ≥2 people in the last 50 commits, a commit on the default branch is refused for the agent and it asks: this branch, a new one, or unlock main? It never opens a branch on its own. The answer given at install wins over detection; saved in `.rsc.json`. Person commits in their own terminal are never touched. | `rsc main unlock` / `lock` |
| **One workspace per agent** | If another assistant session works in the same folder (detected via local-only memory, 30-min window, no content), new work goes to a worktree under `.worktrees/<branch>/`, never committed, removed when merged (post-merge hook cleans up on both landing paths). | `rsc isolation off` |
| **Agent picks the method** | Lane FTD/SDD chosen by the agent and declared. | Ask for the other lane |
| **Knowledge reaches everyone** | `01-TOOLS/`, `02-DOCS/wiki/`, `02-DOCS/attachments/` travel through one exchange branch `rsc/knowledge` (minus `01-TOOLS/_TEMPLATE/` and `user-profile.md`). | `rsc knowledge-sync off` |

Important limits: the refusing hook (branch-guard) runs only in **Claude Code**. In Codex, Gemini, Cursor and OpenCode the same rules are carried by skills + session memory, but nothing enforces them. Knowledge sync works in all of them.

The first session after upgrading to 3.0 does three things once: explains the changes, rescues commits stranded on a closed main to `rescue/main-<date>` (restoring main to remote state), and moves old worktrees into `.worktrees/`.

### knowledge-sync in detail

- **When a turn ends**: your changes in those folders are committed on your branch as `📝 docs(auto): …` and sent to `rsc/knowledge` on origin, from any branch. Only the copy on `rsc/knowledge` carries `[skip ci]`; the commit on your branch does not, so your ordinary push still runs CI.
- **Before each message**: what teammates sent is brought into the branch you are on as `📥 docs(auto): sync`, told in one line. If the last fetch is >10 min old, it fetches first. A branch opened later catches up on its first message.
- **It reaches `main` the normal way** — inside your ordinary PRs. No extra PR from `rsc/knowledge`.
- **What it will not do by design**: push to main (never), push your code or unpushed commits (only knowledge folders go up), trigger CI (all `rsc/knowledge` commits say `[skip ci]`), bring anybody else's code down (only knowledge paths), sync `user-profile.md`, overwrite a file you are editing, or run where it has no business (no origin, no knowledge folders, rebase in progress, cloud agent).
- Off is a **project** switch that travels: `rsc knowledge-sync off` writes `.rsc/.no-knowledge-sync` and records it in `.rsc.json` — commit that. It is separate from `rsc memory off` (local session memory never touches the network; this exists only to talk to origin).

### git-permissions (commit/push/PR without a prompt)

New installs let the agent run `git commit`, `git push`, `gh pr create` without asking (those close every lane); a force-push still asks. Per assistant: Claude Code `.claude/settings.json` allow list; Codex `.codex/rules/rsc-git.rules`; Gemini `.gemini/settings.json`; OpenCode `opencode.json` permissions (rsc's rules go before yours; v1.x uses `permission.bash`; an `opencode.jsonc` is read but never rewritten). Cursor and DeepSeek are not covered. Commands: `rsc git-permissions status|on|off`. In Claude Code, rsc's guards still refuse a commit on a closed main whatever the permission says.

## 6. Updating the harness — the model that matters

**rsc updates itself**, from a session-start hook (Claude Code, Codex, Gemini CLI, Cursor, OpenCode, DeepSeek) or via `node .rsc/auto-update.mjs` on the first turn in other assistants:

- **Same major** (`2.1.0 → 2.1.1`): installs that exact version in the background; takes effect next session and tells you.
- **New major** (`2.x → 3.0.0`): can change how the harness works, so the assistant asks first.
- **Failed**: asks instead, retries once a day, output in `.rsc/auto-update.log`.
- Disable with `.rsc/.no-auto-update` (project decision, travels in `.rsc.json`).

Manual update between majors:

```bash
rsc upgrade --dry-run          # preview: prints npm install + rsc sync lines, writes nothing
npm install -g @ericrisco/rsc@latest   # global install: pull the newest catalog
rsc sync                       # refresh managed skills + hooks (auto-detects assistant)
# multi-target repos: rsc sync --target "$(jq -r '.targets | join(",")' .rsc.json)"
```

**Every sync snapshots the project first** (`.rsc/backups/<timestamp>-<action>/`) — a bad update is always reversible:

```bash
rsc backups                    # list project-local snapshots
rsc restore latest --dry-run   # preview restoring the newest
rsc restore <snapshot-id>      # restore it
```

Other maintenance commands: `rsc agents status` (which agents you edited), `rsc agents reset <agent>` (take rsc's version; yours is backed up first), `rsc doctor` (harness health vs onboarding readiness — exit code follows health only), `rsc repair --dry-run` (fixes only what was already declared; asks before anything that changes a decision; never touches hand-written skills), `rsc reassess` (check deferral triggers, never installs), `rsc memory status|save|resume|off|on`, `rsc review consolidate`, `rsc add <id>`, `rsc consult "<task>"` (lexical recommendation only — never decides; silence ≠ "no skill exists"), `rsc capabilities`, `rsc list`, `rsc agent-model opencode <model>`.

### Gotchas learned in the field (this repo, 2.0.15 → 3.0.22)

- `rsc upgrade` **only prints the guide** — it does not execute anything. Run the two commands yourself.
- After `npm install -g`, the CLI reports `installed in this project: 2.0.15 (behind)` until you run `rsc sync` in the repo. `catalogVersion` in `.rsc.json` and `.rsc/.version` must both move to the new version.
- The sync modifies tracked files: `AGENTS.md`, `GEMINI.md`, `CONVENTIONS.md`, `.github/copilot-instructions.md`, `.gitignore`, `.rsc.json`, `.github/rsc/.rsc-state.json` — and **rsc never commits them for you** (deliberate: the git decision stays human). They show up as ` M` (modified, unstaged) in `git status` — what that state means and how to park/discard it: see `git-github-gh-commands-best-practices.md` §35. Leaving them uncommitted is the main post-upgrade cleanup task.
- **Same-major updates install themselves in the background**: a newer 3.0.x appeared mid-session (3.0.12 → 3.0.18) and re-synced the managed files without asking (only a new major asks). Stash the resulting churn with a message and decide separately — it must not ride inside a feature PR.
- The background updates kept coming: by 2026-10-11 the committed state had moved to **3.0.22** (`.rsc.json catalogVersion`, `.github/rsc/.rsc-state.json` `version`, `.rsc/.version` all agree). The churn landed as plain working-tree modifications to `.rsc.json`, `.github/rsc/.rsc-state.json`, and `.gitignore` — **rsc never commits them** (the git decision stays human, §6). In this repo the clean-up was committed directly on `dev` as config, not folded into a feature PR.
- The 3.x catalog retired three skills (merged into others): `eli5` and `show-me` became part of `orient`, `bro` became part of `unslop`; the sync removes the old copies it installed (we saw `.github/rsc/{bro,eli5,show-me}` deleted).
- `rsc sync` preserves your edited agents (e.g. `refuter-correctness`, `refuter-security`, `refuter-tests` in `.opencode/agents/`) and prints how to take the official version (`rsc agents reset <agent>`).
- In this repo the long-term session memory is **Engram (MCP)**, which is separate from rsc's own local session journal (30 days, ≤4096 bytes, git-excluded, no network). Do not confuse the two.
- Broken-harness symptoms (wrong target in `.rsc.json`, skills you never asked for, a hook running several times, template lines inside a hand-written `AGENTS.md`) all share one fix: `npx @ericrisco/rsc@latest repair`. A *fresh clone* is not broken: "nothing is broken there, the harness was simply never built on that machine", and the assistant says so.

## 7. This project's harness at a glance

- Targets (18): `aider,amp,antigravity,claude,cline,codex,continue,copilot,cursor,gemini,jules,junie,kiro,opencode,roo,windsurf,zed` + `deepseek` (18th, via `dsh`).
- Version: `3.0.22` (CLI global, `.rsc/.version`, `.rsc.json catalogVersion`) — was `2.0.15` before the 2026-10-09 upgrade, then `3.0.12`/`3.0.18` via background same-major updates.
- Working flow: PRs target `dev`; trivial docs-only/config changes commit directly on `dev` (no issue/branch/PR). The harness config update (3.0.18 → 3.0.22) and the `.claude/` wiring (track `rsc-bootstrap.mjs` **and** `settings.json`) were committed directly on `dev` on 2026-10-11.
- Session memory: Engram MCP, project-scoped (`mem_save` / `mem_search` / `mem_session_summary`).

## 8. Field notes from a second project — `rsc-RocketLandingSimulation` (2026-10-12)

This project adopted the harness in a workspace that was **not yet a git repository**. Every rule in §1–§7 assumes `.git/` already exists, so a non-git bootstrap exposes behaviour the earlier sections do not describe. Claims attributed to the package below are quoted from `scripts/install-apply.js` (3.0.22) — note the path: it is `scripts/`, **not** `scripts/lib/`.

### 8.1 Until the folder is a git repo, the harness writes no `.gitignore` at all

`ignoreLocalState()` opens with a hard guard, verbatim:

```js
if (!existsSync(join(cwd, '.git'))) return null;
```

So in a workspace with no `.git/`, rsc installs the entire harness and leaves the ignore block unwritten — deliberately. It will not create a `.gitignore` in a directory that is not a git repository.

Measured here *before* `git init`:

| Metric | Value |
| --- | --- |
| candidate files git would see | 3,371 |
| of which `.rsc/backups/` snapshots | 3,038 |
| workspace size | 617 MB (579 MB of it the project's `.venv`) |
| root `.gitignore` | **absent** |

**That is the trap.** The harness reports healthy and `rsc doctor` is satisfied, but nothing is excluded — every snapshot the harness itself took sits in plain view of a `git add -A`.

The fix is an *order*, not a file:

```bash
git init                                   # creates .git/, so the guard stops firing
npx @ericrisco/rsc@<catalogVersion> sync   # now rsc writes the ignore block
```

After that pair, the same workspace offered **29 files / 296 KB** to git: the 3,038 backups and the 579 MB venv gone from view. Do not hand-write the `.gitignore` to shortcut this — the block is the harness's to own and it scales with your target list (§8.2).

### 8.2 The block is generated, append-only, and idempotent

The header is a constant in the package:

```
# rsc local state (hooks, seals, logs) and managed skill links — machine-local
```

then `.rsc/`, `.worktrees/`, then one entry per managed target × skill/agent/command/prompt. Measured: **440 lines** for this project's 11 targets (header + 2 + 438 managed entries). Spellings are normalised (`.rsc`, `/.rsc` and `.rsc/` are one rule), which is what keeps a re-run idempotent against a `.gitignore` you wrote yourself.

Two entries are in *this* block rather than in git's local exclude, and the source says why:

- **`.worktrees/`** — "Nothing ignored it, so in a teammate's clone it surfaced as `?? .worktrees/` — one `git add -A` from committing a whole checkout. It goes in THIS block, the committed one, so every clone inherits it with its first pull; `.git/info/exclude` would only ever cover the machine that ran the installer."
- **`.rsc/`** — machine state: hook scripts, seals, logs, fallback memory, backups, plus the automation-gap log, which is prose about what happened in the project. A routine `git add -A` would publish it.

Appending your own lines is safe. rsc removes only *its* block on uninstall — "Lines the user wrote are never part of a block" — and never reorders what it finds. Put yours at the end.

### 8.3 Shared directories are excluded entry by entry — to protect *your* files

`.claude/skills/` and `.cursor/rules/` are shared with you: your own skills and rules live there too. So rsc does not ignore the directory; it ignores the entries it manages, one by one, because excluding the whole directory "would quietly stop versioning their work".

Practical consequence: if you add `.claude/skills/` to `.gitignore` yourself, you silently stop versioning your own skills and nothing warns you.

### 8.4 A clone that "has no agents" is not broken

Subagents, commands and prompts are **catalog content, re-materialised by every install and sync** — the verbatim comment beside the code that ignores them. On disk here:

| Path | On disk | Committed |
| --- | --- | --- |
| `.github/agents/` | 5 | 0 |
| `.github/prompts/` | 13 | 0 |
| `.opencode/agents/` | 5 | 0 |
| `.opencode/commands/` | 16 | 0 |

So "my clone has none of the refuters" is expected, not drift: one `rsc sync` rebuilds them. The deeper reason is §2 — the same entry is a symlink on Linux and a real copy on Windows, so committing either shape breaks the other.

### 8.5 Two exclusion layers, two different questions

§2 covers the first layer (`.gitignore`, committed: what *travels*). The second is git's own local exclude, `.git/info/exclude` — **per-clone and never committed**, so it decides what a clone *sees at all*. rsc uses it for machine state that should not need a repo edit to stay private. Observed here:

| Entry | Why it is not even advertised |
| --- | --- |
| `.rsc/memory/` | local session journal |
| `02-DOCS/wiki/harness/user-profile.md` | your technical-level profile — personal, not team knowledge |
| `.rsc/session-memory*.mjs`, `.rsc/auto-update.mjs`, `.rsc/knowledge-sync.mjs`, `.rsc/trunk-policy.mjs` | hook scripts, machine-local by nature |
| `.opencode/plugins/rsc-*.js`, `.dsh/hooks.json`, `.cursor/hooks.json`, `.cursor/rules/rsc-memory.mdc` | per-assistant hook wiring |

The decision rule that falls out — and the one rsc itself applies — is: **committed `.gitignore` when every clone should agree the path is excluded and inheriting it on first pull is the point; `.git/info/exclude` when the file is machine-local and nobody else's business.**

`rsc doctor` diagnoses the failure this prevents. Its `worktreeHygiene()` probes with `git check-ignore` and, when that fails, says *"`.worktrees/` is not ignored by git here: run `npx @ericrisco/rsc sync` … and commit .gitignore so every clone gets it."* The "commit .gitignore" half is the part people miss.

### 8.6 Re-opening one file inside an excluded directory needs the full incantation

Git does not descend into an excluded directory, so a bare `!.claude/settings.json` under `.claude/` rescues nothing. The package's own comment is blunt about the earlier attempt: a negation that was "INERT in every case it fired… Measured, not argued — and the lesson is the one this repo keeps relearning, that a rule believed and untrue is worse than no rule."

When it detects that wholesale-ignored state for either of the two files that carry the harness, it appends this chain, in exactly this order:

```
!.claude/
.claude/*
!.claude/rsc-bootstrap.mjs
!.claude/settings.json
```

Reorder those lines and the rescue stops working. It also asks **git** whether the files are still ignored (`git check-ignore -q`) rather than reasoning about pattern spellings — copy that habit: after any bootstrap, verify with `git check-ignore -v <path>` instead of trusting the file.

### 8.7 The two tracked files run on the reviewer's machine

`rsc-bootstrap.mjs` plus the `.claude/settings.json` hook wiring that calls it are tracked on purpose (§2.2). That makes them the one part of the harness that executes on *someone else's* machine — every session start, every shell call. Review a PR touching them the way you review a CI workflow, not the way you review a README. Move fast on the docs; move slow here.

### 8.8 Sharing this file across projects without publishing a dead link

This document is the shared copy; other projects reach it through a symlink in their own `LEARNING/`. Two rules keep that honest:

- **Relative symlink**, not absolute, so moving the repo tree does not break it.
- **Exclude the symlink** — in `.git/info/exclude` (§8.5), never in the committed `.gitignore`.

Exclusion is not cosmetic. Git stores a symlink as a blob whose *content is the target path text* (mode `120000`). Verified in a scratch repo: `git cat-file -p HEAD:shared.md` printed the path string, a clone carried that one blob and no file, and once the external source was removed the clone held a dangling link and zero content. A committed symlink to a machine-local file is therefore a broken link on GitHub and on every other machine, permanently. The knowledge travels through the canonical copy's own repository, never through the pointer.

### 8.9 The CLI reports the *project's* version, not its own

`npx @ericrisco/rsc --version` prints the version installed **in the project**, not the version of the code you just invoked — so it cannot tell you what you are about to run. Measured here: the command answered `installed in this project: 3.0.22` while the global npm install was **3.0.12**, and `~/.npm/_npx` held 2.0.8, 3.0.12, 3.0.18 and 3.0.22 side by side.

That is why every command in this document names the version explicitly:

```bash
npx @ericrisco/rsc@$(jq -r .catalogVersion .rsc.json) sync
```

A bare `rsc sync` from a stale global install runs older code against newer project state. Trust `catalogVersion` in `.rsc.json`, not the CLI's self-report.

### 8.10 Project snapshot after bootstrap

| Field | Value |
| --- | --- |
| Workspace before | not a git repo · harness installed · no root `.gitignore` |
| Targets | 11 — `antigravity, cline, continue, copilot, cursor, deepseek, junie, kiro, opencode, windsurf, zed` |
| Pinned version | `catalogVersion 3.0.22`, agreeing with `.rsc/.version` and `.github/rsc/.rsc-state.json` |
| Global CLI | `3.0.12` — older than the pin |
| `git init` branch | `master` (`init.defaultBranch` unset) |
| Committed set | 29 files / 296 KB |
| Secret scan of that set | clean |

One artifact not worth hunting: `.rsc/memory/.notice-without-git` exists in this project (its content is a bare ISO timestamp). It is **not** produced by any installed rsc version — 2.0.8, 3.0.12, 3.0.18 and 3.0.22 were each searched — and `git init` + `sync` does not remove it. It lives inside the ignored `.rsc/`, so it is inert; do not read it as state to act on.