# rsc harness learnings

Project: `rsc-web-picture-market` — rsc-harness (`@ericrisco/rsc`) orchestrating multiple AI assistant targets in this repository.

Use this as an operational reference for how the rsc harness is installed, versioned, updated and repaired in this project. Verify current versions and `.rsc.json` before copying commands; the harness changes with every release.

Sources: official README of the installed package (`@ericrisco/rsc` 3.0.12), GitHub releases of `ericrisco/rsc-harness`, and hands-on experience upgrading this repo 2.0.15 → 3.0.12 (2026-10-09).

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
| `.claude/settings.json`, `.claude/rsc-bootstrap.mjs`, `AGENTS.md` (+ `GEMINI.md`, `CONVENTIONS.md`, `.github/copilot-instructions.md` on multi-target repos) | The wiring and the injected always-on layer |

**Do not commit (rsc adds them to `.gitignore`):**

| Path | Why |
| --- | --- |
| `.rsc/` | Machine state: hook scripts, seals, logs, fallback memory, backups, `.version`, `.base-versions.json` |
| `.worktrees/` | Isolation worktrees for parallel sessions |
| The per-assistant skill links (`.claude/skills/`, `.opencode/agents/`, …) | Symlinks vs copies — machine-local shape |

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

### Gotchas learned in the field (this repo, 2.0.15 → 3.0.12)

- `rsc upgrade` **only prints the guide** — it does not execute anything. Run the two commands yourself.
- After `npm install -g`, the CLI reports `installed in this project: 2.0.15 (behind)` until you run `rsc sync` in the repo. `catalogVersion` in `.rsc.json` and `.rsc/.version` must both move to the new version.
- The sync modifies tracked files: `AGENTS.md`, `GEMINI.md`, `CONVENTIONS.md`, `.github/copilot-instructions.md`, `.gitignore`, `.rsc.json`, `.github/rsc/.rsc-state.json` — and **rsc never commits them for you**. Leaving them uncommitted is the main post-upgrade cleanup task.
- The 3.x catalog retired three skills (merged into others): `eli5` and `show-me` became part of `orient`, `bro` became part of `unslop`; the sync removes the old copies it installed (we saw `.github/rsc/{bro,eli5,show-me}` deleted).
- `rsc sync` preserves your edited agents (e.g. `refuter-correctness`, `refuter-security`, `refuter-tests` in `.opencode/agents/`) and prints how to take the official version (`rsc agents reset <agent>`).
- In this repo the long-term session memory is **Engram (MCP)**, which is separate from rsc's own local session journal (30 days, ≤4096 bytes, git-excluded, no network). Do not confuse the two.
- Broken-harness symptoms (wrong target in `.rsc.json`, skills you never asked for, a hook running several times, template lines inside a hand-written `AGENTS.md`) all share one fix: `npx @ericrisco/rsc@latest repair`. A *fresh clone* is not broken: "nothing is broken there, the harness was simply never built on that machine", and the assistant says so.

## 7. This project's harness at a glance

- Targets (18): `aider,amp,antigravity,claude,cline,codex,continue,copilot,cursor,gemini,jules,junie,kiro,opencode,roo,windsurf,zed` + `deepseek` (18th, via `dsh`).
- Version: `3.0.12` (CLI global, `.rsc/.version`, `.rsc.json catalogVersion`) — was `2.0.15` before the 2026-10-09 upgrade.
- Working flow: PRs target `dev`; trivial docs-only changes commit directly on `dev` (no issue/branch/PR); the harness update itself is pending a commit decision.
- Session memory: Engram MCP, project-scoped (`mem_save` / `mem_search` / `mem_session_summary`).