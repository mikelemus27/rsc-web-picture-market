# rsc harness learnings

Projects: `rsc-web-picture-market` (original — §1–§7), `rsc-RocketLandingSimulation` (adopted 2026-10-12 — §8) and `05_scrapy-docker-ESE-vag4-bkd1-tst2` (adopted 2026-10-16 — §9) — rsc-harness (`@ericrisco/rsc`) orchestrating multiple AI assistant targets in these repositories.

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

### 3.1 How the block gets into your file — `targets/_md-block.js`

The whole mechanism is a single 75-line module. It is surgery on a shared instructions file, not a rewrite, and it never touches a line of your own. Verified in 3.1.0:

- **Two literal markers** — `<!-- rsc-suggest:start -->` and `<!-- rsc-suggest:end -->` — plus a fixed seam of `\n\n`.
- **First wire: append.** With no start marker present, `doc += seam + block + '\n'` — your content stays exactly where it was and the block lands at the end. Measured here: `GEMINI.md` carries the start marker at line **121 of 240**, below all 120 lines of the project's own text. `AGENTS.md`, `CONVENTIONS.md` and `.github/copilot-instructions.md` carry it at **line 3**, because those files held nothing of their own before rsc wired them.
- **Re-wire: replace in place.** If the start marker exists, a non-greedy regex swaps `START…END` for the new block, wherever the region sits. A second `sync` never appends a second copy.
- **Between the markers is the only part of your file rsc owns — and it is replaced wholesale.** Anything you hand-write inside is gone at the next `sync` or onboard. Above the start marker and below the end marker, nothing is ever rsc's.
- **Wiring an empty file leaves two blank lines at the top.** The seam is written on the append path and an empty document takes it too, so the file begins `\n\n<!-- rsc-suggest:start -->`. Measured on all three files rsc created here — first ten bytes are `\n\n<!-- rsc`, each 122 lines.
- **Removal is exact.** `unwireHook` deletes the seam and the block, and stops. The source keeps the reason beside the code: an earlier version ended with a document-wide `\n{3,}` → `\n\n` pass that "tidied blank lines the author had put hundreds of lines away from anything of ours", and in issue **#249** that file was a project's hand-written constitution. The pass is gone. rsc does not reformat the rest of your document.

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

## 9. Field notes from a third project — `05_scrapy-docker-ESE-vag4-bkd1-tst2` (2026-10-16)

Local workspace of the `CloudDataObserver` remote. Installed at **3.1.0** into a tree that *already* was a git repository, so §8's not-yet-a-repo trap cannot fire here. What it exposed instead has nothing to do with this project: **rsc declares an install with one function and writes it with another, and the two disagree whenever a target has commands but no agents.** §8's damage was silent; this one is total — the verification rejects the install and rolls every byte back.

### 9.1 `onboard` cannot complete while an agent-less target is in the plan

Accepting the plan failed identically on every attempt:

```
RSC_ONBOARDING_INCOMPLETE: missing governed path .clinerules/workflows/python-review.md;
missing governed path .windsurf/workflows/python-review.md
```

Exit `4`, and then **no install at all**: no `.rsc.json`, no `.clinerules/`, no `.windsurf/`, an empty `02-DOCS/wiki/harness/`, every target directory at zero files, working tree clean. Not a crash — `restoreBackup` (`onboarding-apply.js:342`). The transaction noticed a difference and undid everything. The plan was the wrong half.

`plan.governedPaths` is built by flattening `managedPathsForInstall` over the targets (`onboarding.js:334`), and inside that function two adjacent branches are scoped differently (`install-apply.js:114-137`):

| Branch | Guard | Consequence |
| --- | --- | --- |
| agents | `if (targetHasAgents(target))` | scoped correctly |
| commands | **no such guard** | resolves the desired agents from installed skills, then declares `commandPath(...)` for a target that can never hold one |

`targetHasAgents` only knows `claude, junie, cursor, opencode, gemini, copilot, kiro, codex` (`targets/agents.js:33`). The *other* list, `COMMAND_TARGETS`, adds `cline` and `windsurf` (`targets/commands.js:5`). So the planner declares a workflow command for exactly those two, derived from an agent they cannot have. Here the entity was `python-reviewer` (skill `python`) → `python-review.md`.

The **writer** resolves commands from installed state instead:

```js
const desiredCommands = resolveCommands({ target, skills: …, agents: state.agents, … });   // install-apply.js:586
```

For an agent-less target `state.agents` is `[]` — `reconcileAgents` early-returns `names: []` (`targets/agents.js:362`) — so `stackAliases` yields nothing (`targets/commands.js:104`) and the file is never written. `verifyOnboarding` (`onboarding-apply.js:199`) requires every declared path to exist, names those two, and the rollback follows.

The sharpest framing: **the verifier already knows the rule.** `expectedAgentsFor` filters with `targetHasAgents` (`onboarding-apply.js:51`) — the agents half of the same check is scoped correctly, and only the governed-path list was not. That same predicate on the commands branch is the minimal fix.

The repro class is structural, not project-specific: any plan that includes a target with commands but no agents, while the agents/skills side produces a command derived from an agent. Measured here: 2 targets × 1 alias-producing agent = 2 phantom paths, and the error names both.

**The only lever is the target list.** `--force` and `--dry-run` never reach this code, and no release newer than 3.1.0 was available. Regenerate the plan without the agent-less targets, accept it, then re-add them outside the plan (§9.2). The exit message is the diagnostic: it already prints the exact phantom paths.

### 9.2 `sync --target` adds a target the plan could never hold

With the remaining 11 targets applied cleanly, the two dropped ones came back in one command:

```bash
npx @ericrisco/rsc@3.1.0 sync --target cline,windsurf
```

Exit `0` — and that is a property of the code path, not luck. **No caller of `verifyOnboarding` lives on the sync route.** It has exactly two: the transactional apply (`onboarding-apply.js:338`) and a read-only readiness probe (`rsc.js:155`). `sync` re-materialises catalog content from the manifest and never re-derives the accepted plan's path list, so the over-declaration has nowhere to surface.

Measured on disk afterwards:

| | `.clinerules/` | `.windsurf/` |
| --- | --- | --- |
| workflow files | 13 | 13 |
| `state.commands` | the same 13 | the same 13 |
| `python-review.md` | **absent** | **absent** |

Writer and recorded state agree, and neither holds the file the plan declared — it was never going to exist. The lesson generalises: the plan's own path list is the least trustworthy artifact in this flow. **Disk wins.** Re-read the target directories after a sync instead of trusting either list.

### 9.3 `--dry-run` previews the planner, not the writer

Both dry runs return the planner's list — the same function §9.1 blames:

```js
if (dryRun) return { dryRun: true, skills: skillIds, agents: agentIds, paths: managedPaths };   // install-apply.js:264
```

`managedPaths` at `:259` is `managedPathsForInstall`, and `syncInstalled` calls that function directly for its dry run (`install-apply.js:726`). So the preview inherits the over-declaration.

Measured: `sync --dry-run --target cline,windsurf` listed `.clinerules/workflows/python-review.md` and `.windsurf/workflows/python-review.md` among 164 paths — the two files the real run then declined to create (§9.2). Same asymmetry, one layer up: a dry run shows what the *declaring* function believes, not what the writer will do.

Read a dry run for shape (skills, agents, actions), not for its path count, and confirm against disk after the real run.

### 9.4 The split is applied for you — verify it in bulk

Two plans are worth comparing. The 13-target plan declared **625** governed paths; the 11-target plan that finally applied declared **531** — the two dropped targets were 94 of them. Of the 531, **514 are excluded** and **17 are left to git**, which `git status` agrees with exactly:

```bash
git status --porcelain -uall     # 17 entries
```

The 17 are the declaration (`AGENTS.md`, `CONVENTIONS.md`, `.rsc.json`), the skeleton (`01-TOOLS/` — six files — plus `02-DOCS/wiki/harness/decisions.md`, `02-DOCS/wiki/harness/installation-plan.md` and `02-DOCS/wiki/sdd/constitution.md`), the modified `.gitignore` and `GEMINI.md`, and the three per-target copies of the always-on layer: `.clinerules/rsc-suggest.md`, `.junie/guidelines.md`, `.kiro/steering/rsc-suggest.md`. Those three surface only because this project's own ignore list covers `.gemini/ .codex/ .cursor/ .opencode/ .windsurf/ .zed/` but not `.clinerules/ .junie/ .kiro/` — and rsc neither ignores nor un-ignores them. `.gitignore` is the only file that grew — **+552 lines** of rsc-owned block (§8.2) — and nothing else needed a per-path verdict.

Two habits:

- `-uall` is not optional. Without it git collapses each new directory to one line, and those 17 files read as 10.
- Verify in bulk, not one call per path: `git check-ignore --stdin < <(sort -u planned-paths.txt)`.

### 9.5 Committing the install — what is required, and what decides what git sees

Settled only when the 17 files were actually committed, as `1d7969b` (17 files, 3655 insertions).

**`.rsc.json` alone is enough to rebuild the harness.** It is the declaration — 13 targets, 31 skills, 6 agents, `catalogVersion` — and `sync` re-materialises every machine-local path from it. Measured in §9.2: two targets that were never in the accepted plan got their 13 workflows each, from the manifest. So the sufficiency claim is not a reading of the docs, it is §9.2's observed behaviour. What `sync` cannot put back is the repo's **front door**: the always-on layer (`AGENTS.md`, `GEMINI.md`, `CONVENTIONS.md`, `.github/copilot-instructions.md`) and the project's own content (`01-TOOLS/`, `02-DOCS/`). Those are what a human or an assistant reads before running any command, so they are the ones to commit on purpose. Everything else in the 17 is a copy rsc can make again.

**Which always-on copies git sees is decided by your ignore file, not by rsc.** rsc's generated block contains **no negation (`!`) lines** in this project, so it never reaches for a file to un-ignore. What it does contain is the exclusion of the machine-local half — and the *pre-existing* list decides the rest, because it already ignores whole assistant directories:

```
.rsc/  .rag/  .gemini/  .antigravity/  .codex/  .cursor/  .dsh/  .opencode/  .windsurf/  .zed/
```

`.clinerules/`, `.junie/` and `.kiro/` are absent from that list. That is the *entire* reason `.clinerules/rsc-suggest.md`, `.junie/guidelines.md` and `.kiro/steering/rsc-suggest.md` appear in `git status` while the `.gemini/`, `.codex/`, `.cursor/`, `.opencode/`, `.windsurf/` and `.zed/` copies of the same layer never do: same catalog content, same 122 lines each, different visibility, decided by nobody but your own ignore rules. **rsc neither ignores nor un-ignores them.** Contrast §2.2, where rsc *does* un-ignore `.claude/rsc-bootstrap.mjs` and `.claude/settings.json` — it writes a negation only when a target needs one to work.

**A project without `claude` has no clone-notice mechanism.** §2.2's bootstrap pair is the thing that tells a fresh clone the harness is missing and offers `sync`. With `claude` not among the targets there is no `.claude/` directory at all — verified: `.claude/` absent, and a full-tree search for any `*bootstrap*` artefact returns nothing. `.codex/hooks.json` and `.gemini/settings.json` exist, but neither is a bootstrap. So nothing announces the gap; the "a clone is told, and asked before installing anything" paragraph of §2.2 simply does not fire here. A clone discovers the situation by having `.rsc.json` and no `.rsc/`, and the recovery is the documented one — `sync`, never `@latest`.

**Prove "no symlink is in this commit" from the index, not the diff.** Every target here materialises 33–62 entries, and the per-assistant skill links among them are symlinks (§2). The index records the file mode, which is what makes the claim provable:

```bash
git ls-files -s | awk '$1=="120000" {print}'   # 120000 == symlink; empty output == clean
git diff --cached --name-only | while read -r p; do git check-ignore -q "$p" && echo "staged but ignored: $p"; done
```

Measured on `1d7969b`: 17 paths staged, **zero** mode-`120000` entries in the whole index, and no staged path reported as ignored. Reading the index instead of `git status` is what turns "no symlink was committed" from a plausible claim into a provable one.

### 9.6 The branch guard: declared, installed, and enforced nowhere

§5's trunk policy is the harness's most "team-like" default, and in this project it does nothing at all.

| §5 says | What is true here |
| --- | --- |
| A commit on the default branch is refused and the agent asks: this branch, a new one, or unlock main? | Nothing refuses anything. §5's own limit line applies — "the refusing hook (branch-guard) runs only in **Claude Code**. In Codex, Gemini, Cursor and OpenCode the same rules are carried by skills + session memory, **but nothing enforces them**" — and `claude` is not among the 13 targets, so there is no `.claude/` to hold a hook (§9.5). The branch rules in this repo are prose in the always-on layer. That is the whole enforcement surface |
| It fires when the repo shows CI, a deployment file, or ≥2 people in the last 50 commits | The condition is on the *repo*, not on owning a `.rsc.json`. Measured here: no `.github/workflows`; none of `Dockerfile`, `docker-compose.yml`, `compose.yaml` at the root; one author across the repo's 5 commits. All three absent → this repo would not be guarded even if `claude` were installed. A harness does not inherit the guard by being installed |
| Turn it off with `rsc main unlock` | Nothing to unlock. The command exists; its subject does not. |

**Declared ≠ enforced, and ≠ committable.** Both policy files are declared managed paths in `.rsc.json` and both are on disk: `.rsc/trunk-policy.mjs` (4,801 bytes) and `.rsc/.no-trunk-open` (0 bytes, an empty marker). But all of `.rsc/` is machine-local (§2), so no clone carries them until it runs `sync` — the harness's own git decisions are precisely the ones it refuses to version, and no branch policy is reviewable in a diff.

**The flow this repo actually runs**, recorded here once because the harness will not state it: `main` holds verified state and is level with `origin/main`; `dev` was created from `main`@`1d7969b` on 2026-10-16 as the integration branch; work leaves `dev` and returns by PR. The precedent for the shape is §7's line — "PRs target `dev`; trivial docs-only/config changes commit directly on `dev`". `.worktrees/` is already ignored (`.gitignore:44`), so §5's isolation half needs no setup here: a second session on another branch lands in `.worktrees/<branch>/` and stays out of `git status`.

## 10. Adopting rsc in a repo that has never had it (the clean-repo flow)

Verified 2026-10-17 against `@ericrisco/rsc@3.1.0` and its CLI. **Git history decides nothing; the tracked `.rsc.json` decides everything** — the number of clones a repository passed through is irrelevant, because a clone of a clone stays "clean" exactly as long as nobody ever committed `.rsc.json`.

```bash
git ls-files .rsc.json    # prints `.rsc.json` → sync;  prints nothing → onboard
```

| Where you are | Command | Why |
| --- | --- | --- |
| Brand-new, empty directory | `git init` **first**, then `npx -y @ericrisco/rsc@<v> onboard --target <assistant>` | rsc writes *tracked* files and never commits them (§6), so a repo that already exists puts the whole harness in one separable, revertable commit. `onboard` would offer `git init` mid-flow otherwise (its Phase 4 ground check), interleaving scaffold and history — and §8.1 records that until the folder is a git repo rsc writes no `.gitignore` at all |
| Cloned repo, zero rsc (the use case asked about) | `npx -y @ericrisco/rsc@<v> onboard --target <assistant>` | nothing to rebuild; the wizard must ask its four questions and produce a plan |
| Clone of an rsc repo (`.rsc.json` tracked) | `npx -y @ericrisco/rsc@<catalogVersion> sync` | `.rsc.json` already answers all four wizard questions (§1), so `sync` asks nothing |

**Pin the version you resolve; don't let a tag float.** A fresh install has no `catalogVersion` to inherit — that pin does not exist yet — so resolve first, then pin what you resolved:

```bash
npm view @ericrisco/rsc version     # → 3.1.0 (published 2026-10-14; registry check 2026-10-17, `dist-tags` has only `latest`)
npx -y @ericrisco/rsc@3.1.0 onboard --target <assistant>
```

Same bytes `@latest` would give you today, but reproducible: `onboard` writes that version into the new `.rsc.json`, and every later `sync`/upgrade follows *your* pin instead of npm's moving tag. This is the same discipline as §6, where a clone runs `sync` against the exact `catalogVersion` "never `@latest` — a release nobody here adopted is drift"; the difference is that at first adoption you *create* the pin rather than inherit it. Later releases reach a repo through the auto-updater (§6), not through re-running bare `npx`.

**`--target` is not decoration on a fresh directory.** Without it, the CLI "uses the assistant already installed here; if two are, it asks instead of guessing" — an empty directory has no installed assistant, so the flag is what prevents a guess. Comma-separate for several.

**What the two flows feel like:** `onboard` asks technical level / project kind / goal / assistants and stops at the plan gate — nothing writes until you accept the SHA-256 plan id (§1); on an existing small codebase, read the plan's deferred/excluded rows before accepting, because a minimal repo is where a misjudged stack shows up first. `sync` asks nothing and starts from `.rsc.json`.

## 11. Leaving rsc — the three exits, by intent (verified 2026-10-17)

The CLI offers three different verbs; they match three different intentions, and only the last one deletes.

| Intent | Command | What actually happens | Undo |
| --- | --- | --- | --- |
| "The agent stops driving this repo" | create an empty `.rsc/.no-harness` | The always-on layer's own contract: the repo is never re-onboarded, `init` never auto-starts ("Use `rsc onboard` to re-enable the harness for this project"). Nothing is deleted | delete the file |
| "Drop skills I never use, keep the harness" | `rsc uninstall <id...>` | Per-skill mirror of `add <id...>` (§6's command list); the harness stays | `rsc add <id...>` |
| "Remove the harness from this repo" | `npx -y @ericrisco/rsc@3.1.0 purge` | **Backs up first**, then removes — its own output: "Created backup `<id>` (`<N>` files)… Use `rsc backups` to see them, `rsc restore <id\|latest>` to bring any back" | `rsc restore <id\|latest>`, then git |

**`.no-harness` is machine-local — a correction.** It does *not* travel to the next clone, however natural that assumption is: it lives under `.rsc/`, which is ignored wholesale here (`.gitignore:17 .rsc/`; `git ls-files '.rsc/*'` → 0 files), and `.rsc.json` carries no trace of it (its `optOuts` is `["trunk-open"]`, unrelated). What travels is the *instruction* — the always-on block that tells an agent to create it is in every tracked target file (`AGENTS.md`, `GEMINI.md`, `CONVENTIONS.md`, …) — but the state must be recreated per machine. Two markers, two lifetimes: `.no-auto-update` is a project decision that §6 records as travelling in `.rsc.json`, `.no-harness` is a local refusal that does not.

**For a full removal, git is the real undo** — rsc never commits for you (§6), so nothing is final until you do, and the sequence is a `git status` exercise, not a trust exercise:

```bash
git status                      # clean tree first, so the resulting diff is only rsc's
npx -y @ericrisco/rsc@3.1.0 purge
git status && git diff          # the file-level truth: what it removed, what it edited in place
git add -A && git commit -m "chore(rsc): remove the harness"
```

Read that diff before staging it: rsc may leave `.gitignore` entries it generated (inert, but noise worth deleting in the same commit), and `01-TOOLS/` / `02-DOCS/` carry *your* content — profile, decisions log, wiki — which is project material even when the harness around it goes.

**Unverified, deliberately:** the exact file list `purge` removes. The shipped package has no README and no per-command help (`rsc purge --help` falls back to the general usage line), and `dist/cli.js` is minified; rather than execute a destructive verb to find out, this section records only what the CLI states about its own behaviour (the backup) and lets `git status` after the run supply the real inventory.