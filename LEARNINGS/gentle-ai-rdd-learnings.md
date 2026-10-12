# gentle-ai and Receipt-Driven Development (RDD) learnings

Project: `rsc-web-picture-market` — Gentle AI (`gentle-ai`, 4.0.0) installed as the agent orchestrator, with its native receipt-review subsystem (receipt-driven development) enabled by default.

Use this as an operational reference for what `gentle-ai` installs, what a "review receipt" actually is, and where the subsystem refuses. Verify the installed version before copying commands — the review contract is versioned and its schemas move between releases.

Sources: the installed binary itself (`gentle-ai --help`, `gentle-ai review --help`, `gentle-ai review capabilities`, `gentle-ai review schema reviewer|refuter|validator`, `gentle-ai review mode --help`), the orchestrator contract installed into this repo's OpenCode config, and hands-on experience running and being refused by the RDD preflight on 2026-10-11.

## 1. What gentle-ai is — and what it is NOT

`gentle-ai` is a CLI plus a harness layer. It configures AI coding agents on a machine and installs a workflow into them:

- **`gentle-ai install` / `uninstall`** — write or remove the managed agent files.
- **`gentle-ai sync`** — bring agent configs and skills up to the current version.
- **`gentle-ai skill-registry refresh`** — rebuild `.atl/skill-registry.md` with a cache-hit fast path.
- **`gentle-ai review …`** — the native receipt-review subsystem (the rest of this document).
- **`gentle-ai codegraph init`** — validate the project root before initializing a CodeGraph index. (Intelligence queries belong to the upstream `codegraph` CLI, not to `gentle-ai`.)

What it installs in this repo's OpenCode config: a `gentle-orchestrator` agent bound to a long orchestration contract, bounded delegation agents (`gentle-ai-explore`, `gentle-ai-worker`, `gentle-ai-verify`), adversarial review lenses (`refuter-correctness`, `refuter-security`, `refuter-tests`), and skills such as `branch-pr`, `chained-pr`, `work-unit-commits`, `judgment-day`, `rdd-defect-workflow` and `go-testing`.

**Do not confuse three separate systems that all live in this repo:**

| System | What it is | Its own review-ish thing |
| --- | --- | --- |
| **`gentle-ai`** | This document. Agent harness + native receipt review | `gentle-ai review …` |
| **rsc-harness (`@ericrisco/rsc`)** | The rsc control plane — see `rsc-harness-learnings.md` | `rsc review consolidate` (unrelated) |
| **Engram** | Persistent session memory (MCP + CLI) | none |

They are installed side by side, they overlap in *purpose* (both govern agent behaviour) and in *nothing else*. A refusal from one is not a refusal from another.

## 2. This machine's install at a glance

Read from `gentle-ai review capabilities` (2026-10-11):

| Field | Value |
| --- | --- |
| Package | `gentle-ai` **4.0.0**, `release_channel: stable` |
| Module path | `v4.0.0` (moved from `/v3` at the 4.0 line) |
| Binary | `/home/linuxbrew/.linuxbrew/bin/gentle-ai` |
| Build id | `sha256:b7d0d9dd51d9fd4752237aab7a6394b00900a2055cf587a0e8723bd2de3093f3` |
| Built with | `go1.25.10` |
| VCS revision | `ff77164d4f56f1665b22fb6fac51c2ccbb769400`, committed `2026-10-01T19:18:42Z`, `vcs_modified: false` |
| Executable hash | `sha256:50ba217b…` with `evidence: "self-reported"`, `verification: "compare-with-published-manifest"` |
| Capability schema | `gentle-ai.review-integration.capabilities/v1.5` |
| Executable block | The binary does **not** vouch for itself — it self-reports and tells you to compare against a published manifest |

The `stable` channel matters for defect reporting: a build string containing `-rc.` or `-main.` belongs to a different evidence channel than a plain `4.0.0`.

## 3. Receipt-driven development — the idea

**One line:** you stop advancing on a narrative ("the reviewer said it looks good") and start advancing on a receipt — a machine-verifiable record that a specific, immutable candidate was actually reviewed by a real reviewer run under a frozen plan.

Honesty note: this is *not* an industry-standard methodology like TDD. It is a coined name for the review lifecycle inside gentle-ai. The analogy to TDD is only in temperament: turn a hopeful assertion into an artifact that can fail.

**The problem it exists to kill.** An approval written as prose binds to nothing. Three failures follow, and all three are normal:

1. **Drift** — code changes after review and the approval still "counts".
2. **Replay** — the same "LGTM" gets reused for a different change.
3. **Self-grading** — the thing being reviewed controls what the reviewer saw and how the result is read.

A receipt fixes all three by construction: it names the candidate it covers, and it cannot be spent twice.

## 4. The review lifecycle, end to end

| Stage | What actually happens |
| --- | --- |
| **Preflight** | `review status` inspects the worktree and returns **one exact START invocation**. Authority is never discovered from ambient state. |
| **Freeze** | `review start` snapshots the candidate into immutable trees and captures a **lineage**, revision and target binding. Reviewers inspect *that*, never your live worktree, index or `HEAD`. |
| **Consent** | Asked **per candidate**, before a review that would do work. Medium/high risk asks; passive content does not. |
| **Frozen plan** | Go decides the plan: zero, one or four lenses with frozen identities. Not the agent, not the author. Four lenses is long work and gets a cost forecast first. |
| **Capture** | Reviewer results are admitted one at a time (`capture-result --lens --order`). The **final** capture closes and burns its review. |
| **Correction** | At most **one** bounded correction. `capture-correction-plan` records the positive line forecast *before* editing. No loop-until-clean. |
| **Refutation** | Inferential blockers share one read-only refuter batch (`capture-refuter`). Deterministic blockers need none. |
| **Targeted validation** | `capture-validation` admits validator evidence; a passing capture closes and burns its review. |
| **Acknowledge & burn** | The approved capture commits one pending acknowledgement token. Running that exact invocation once burns the authority and artifacts. A replay refuses. |

Between every step the agent re-queries STATUS with the tokens the previous step returned. Nothing is reconstructed from prose or from a transcript.

## 5. The five invariants

1. **Authority is one-shot and non-transferable.** An approval for candidate X is worth nothing for candidate X′. There is a terminal reason code for exactly this: `target_already_acknowledged`.
2. **Bind by token, never by inference.** Every later step must present the exact tokens the previous step issued, and a command must be run with the arguments the provider returned — never rebuilt from the prompt.
3. **Fail closed.** Unknown risk is treated as high; unavailable proof never becomes an invented PASS; an unassessable assessment is treated as due.
4. **One writer of truth.** Go owns evidence, binding, schema, admission, causality, validation and closure. The agent only transports opaque bytes. **The AI cannot grade its own homework.**
5. **Receipt ≠ delivery authority.** After a receipt burns, commit, push, PR, merge and release are still ordinary human decisions. Gates (`post-apply`, `pre-commit`, `pre-push`, `pre-pr`, `release`) are informational/compatibility only — they never allow, approve, block or govern delivery.

## 6. The command surface

Only **five** operations are public:

```
review.capabilities   review.status   review.start   review.validate   review.repair
```

Notice what is missing: **there is no `review approve` command.** Reduction, election, correction and acknowledgement are transitions *returned inside envelopes*, never invocable verbs. You never get a command that says "approve this".

Verbs as the CLI spells them:

```bash
# Read-only, safe to run any time
gentle-ai review capabilities
gentle-ai review mode status  [--cwd <repo>] [--scope global|clone] [--json]
gentle-ai review status       [--cwd <repo>]
gentle-ai review validate --gate <gate> [--cwd <repo>]   # syntax only; delivery stays human

# Lifecycle (mutating — only via provider-returned arguments)
gentle-ai review start [--cwd <repo>] [--base-ref <ref>] \
  [--focus risk|resilience|readability|reliability] [--locale en|es]
gentle-ai review capture-result      --lineage <id> --target <id> --lens <lens> --order <n> --input <review.json>
gentle-ai review capture-correction-plan --lineage <id> --target <id> --expected-revision <rev> --request-hash <hash> --correction-lines <n>
gentle-ai review capture-refuter     --lineage <id> --target <id> --expected-revision <rev> --input <refuter.json>
gentle-ai review capture-validation  --lineage <id> --target <id> --expected-revision <rev> --request-hash <hash> --input <validator.json>
gentle-ai review inspect-candidate   --repository-context <handle> --expected-revision <rev> \
  --lineage <id> --target <id> --lens <lens> --order <n> --operation <operation>
```

`--focus` accepts exactly the four lens names — independent confirmation of the lens identities.

`--locale en|es` on `review start` is why a review can render in the operator's language while the artifacts stay structured.

## 7. Legacy compatibility verbs

Shipped for reading older authority, and **read-only by design**:

```bash
gentle-ai review-start  --cwd <repo> --lineage <id> --policy-file <path>   # rejects NEW v1 authority
gentle-ai review-step   --cwd <repo> --lineage <id> --operation <op> --input <json>  # rejects mutation
gentle-ai review-resume --cwd <repo> --lineage <id>                        # reads shipped v1 authority, no mutation
```

They exist to read history, never to write it.

## 8. The wire protocol

It is a protocol, not a prompt pattern:

| Field | Value |
| --- | --- |
| Contract | `gentle-ai.review-integration/v1` |
| Protocol | major **1**, minor **5** |
| Modes | `compact-v2` (live), `legacy-v1` (read-only) |
| Legacy window | `state: active`, `read_only: true`, `deprecation_started: true`, `removal: "not-scheduled"`, `minimum_compatibility_releases: 1` |
| Version compatibility | `minimum_protocol_major: 1`, `maximum_protocol_major: 1` |
| Evolution law | `additive_minor_policy: "optional-fields-only"` |
| Unknown fields | `unknown_mandatory: "reject"`, `unknown_optional: "ignore"` |
| Projections | `staged`, `workspace` |
| Gates | `post-apply`, `pre-commit`, `pre-push`, `pre-pr`, `release` |

The evolution law is the whole reason a CLI from one version can talk to assets from another: **a mandatory field you do not know means refuse; an optional field you do not know means shrug.**

## 9. The eighteen envelope schemas

`review capabilities` enumerates 18 schemas in three families:

| Family | Schemas |
| --- | --- |
| **Transport / lifecycle** | `integration.operation/v1`, `integration.projection/v1`, `integration.status/v2`, `integration.start/v2`, `integration.failure/v1`, `integration.repair/v1`, `integration.capabilities/v1.5` |
| **Authority & evidence** | `review-receipt/v1`, `review-authority-status/v1`, `review-authority-repair-assessment/v1`, `review-admitted-result/v1`, `review-artifact-subject/v1`, `review-result-artifact/v2`, `review-targeted-validation-request/v1`, `review-gate-request/v1` |
| **Provider** | `reviewer/v1`, `refuter/v1`, `validator/v1` |

Only the three provider schemas are dumpable: `gentle-ai review schema <reviewer|refuter|validator|capture-result-dry-run>`. Calling it with no name errors with the accepted list — that is how you discover the four without guessing.

## 10. The capability surface is a dependency graph

`review capabilities` splits features into **mandatory** (the contract is void without them) and **optional**, and every optional feature declares `requires`.

- **Mandatory (7):** `compact_v2_authority`, `immutable_snapshot`, `legacy_v1_target_scoped_read_only`, `repository_independent_capabilities`, `restart_safe_projection`, `target_scoped_status`, `uniform_failure_envelope`.
- **Optional (14):** `base_ref_workspace_overlay`, `bounded_process_waits`, `classified_authority_repair`, `native_frozen_candidate_context`, `native_low_risk_verification`, `native_next_transition`, `opaque_repository_context`, `provider_artifact_admission`, `provider_targeted_validation_request`, `recovered_correction_evidence`, `risk_reasons`, `scope_change_diagnostics`, `validating_result_reopen`.

Two of them explain behaviour you will actually observe:

- **`restart_safe_projection` + `target_scoped_status`** — a restarted session re-queries and gets the *same* operation/token/revision back. The prompt is never the state.
- **`native_next_transition`** — the returned "next move" is provider-owned, and its compact-v2 target types (`base_ref`, `workspace_overlay_base_ref`, `workspace_overlay_base_tree`) are declared `parent_only: true` with `unsupported_outcome: "unsupported-capability"`. The parent orchestrator routes; nobody below it may re-invent a transition.

Because `requires` is a graph, a host **feature-detects** and refuses cleanly rather than half-running a review. That is why a refusal arrives as a tidy typed envelope instead of a corrupted half-transaction.

## 11. The provider schemas — where the anti-gaming lives

This is the most instructive part, because every rule is enforced by JSON Schema, not by convention.

**Reviewer** — `required: [subject_hash, inspection, findings, evidence]`

- `subject_hash` binds the verdict to the frozen bytes. Not "the branch" — the bytes.
- `inspection.status ∈ {completed, unavailable}`. The schema's own description calls it *"the typed admission-completeness signal; evidence prose is not a substitute for it."* `completed` asserts **every** changed path was actually inspected; `unavailable` requires a non-empty `reason`. `inspection.paths` must be the complete unique unordered set of every changed path.
  → A reviewer that only *mentions* an access failure in prose while leaving `status: completed` is a **false completion**, and is treated as one.
- `evidence`: `minItems: 1`, each item must match `\S`, and must **not** match `n/a|none|todo|tbd|pass|passed|success|placeholder`. **You cannot file "PASS" as evidence.**
- Findings: `required: [location, severity, claim, proof_refs]`, `severity ∈ {BLOCKER, CRITICAL, WARNING, SUGGESTION}`. If severity is `BLOCKER` or `CRITICAL`, the schema **additionally forces** `evidence_class` and `causal_disposition` — a severe claim with no stated causality is structurally rejected.
- `lens ∈ {risk, resilience, readability, reliability}` plus `review-` prefixed spellings.

**Refuter** — `required: [refuter_request_hash, results]`, each result `{finding_id, outcome ∈ corroborated|refuted|inconclusive, proof_refs[≥1]}`.
→ Hash-bound to the request: it **cannot answer a question it was not asked**. And even `inconclusive` must carry at least one proof ref — you cannot shrug for free.

**Validator** — `required: [targeted_validation_request_hash, correction_target_identity, original_criteria, correction_regression, follow_ups]`.
→ `correction_target_identity` makes goalpost-moving impossible. `original_criteria` judges the fix against the **original bar**, not the bar the fix conveniently redefined. `follow_ups[]` items require `{observation, proof_refs}`.

## 12. The causality and evidence taxonomy

| Field | Enum | What it decides |
| --- | --- | --- |
| `severity` | `BLOCKER`, `CRITICAL`, `WARNING`, `SUGGESTION` | Only candidate-caused severe findings block |
| `evidence_class` | `deterministic`, `inferential`, `insufficient` | Routing: deterministic blockers need no refuter; inferential blockers share one read-only refuter batch |
| `causal_disposition` | `introduced`, `behavior-activated`, `worsened`, `pre-existing`, `base-only`, `unknown` | `base-only` demotes to a follow-up; `unknown` **escalates**; only candidate-caused blocks |
| `inspection.status` | `completed`, `unavailable` | The only admission-completeness signal |
| refuter `outcome` | `corroborated`, `refuted`, `inconclusive` | Whether a finding survives |
| `lens` | `risk`, `resilience`, `readability`, `reliability` | Four independent adversarial viewpoints |

## 13. The failure envelope is self-describing

`uniform_failure_envelope` guarantees every refusal carries its own retry semantics:

`code`, `phase`, `operation`, `next_action`, `mutation_outcome`, `authority_applicability`, `retry_safe`, `replayability`, `required_inputs`, `cause`.

This is why a refusal can be reported honestly: the tool declares whether it mutated, whether a retry is safe, and whether the outcome is replayable **about itself**. Observed in this repo: `phase: preflight`, `next_action: stop`, `retry_safe: false`, `replayability: not_replayable`, `mutation_outcome: not_started`, `authority_applicability: not_evaluated`, `required_inputs: []`.

## 14. Consent, correction, acknowledgement

- **Consent is per candidate.** From `review mode --help`: *"`review start` asks per candidate before a review that would do work; accepting covers that candidate only and nothing is granted for later candidates, 'not now' applies to that candidate only and persists nothing, turning reviews off for good needs a deliberate `gentle-ai review mode disable`, and a session without a terminal reviews the change and says so instead of asking."*
- **A decline is candidate-scoped, never the kill switch.** Declining must not be silently reopened as "just this once".
- **Correction is zero or one.** The forecast (`--correction-lines`) is recorded *before* editing, and only corroborated frozen findings may be addressed.
- **Acknowledgement burns authority.** Snapshot **after** it. Once burned, the target is ineligible forever (`target_already_acknowledged`, terminal).

## 15. The user-owned switch

```bash
gentle-ai review mode status                    # read-only; reports both sources + effective mode
gentle-ai review mode disable [--scope clone]   # opt out
gentle-ai review mode enable  [--scope global]  # opt back in
```

- **On by default and opt-out.** Nobody has to ask for it.
- **Any OFF wins.** A repository may disable it *for this clone* but can never require it, and no other clone inherits that override.
- **`status` never mutates** — it reports the deciding source and the effective mode.
- **Enabling applies to future candidates only.**
- **Never toggle it on the user's behalf.** Disabling is also not "the kill switch" for a single candidate — that is a decline.

## 16. Cross-repository lifecycle root

A session in repository A may review an explicitly selected nested target in unrelated repository B, but only after explicit user authorization. Native Go resolves the requested path to the canonical B worktree root; the host advertises B as the lifecycle root from preflight through acknowledgement and burn, and never falls back to A. Provider-issued commands are run **exactly** as given — never append, remove or rebuild their arguments, and when a command omits `--cwd`, run it with B as the process working directory. The same lineage text in A and B is independent, and burning B leaves A untouched.

## 17. Gotchas learned in the field (this repo, 2026-10-11)

- **The compiled capability surface never declares which runtimes may review.** Grepping the entire `review capabilities` JSON for `transport|runtime|claude|codex|opencode|pi|lens` returns only `native_low_risk_verification` and `risk_reasons`. So a refusal like `immutable_review_transport_unsupported` does **not** come from the declared capabilities — it comes from a separate eligibility gate that the contract does not advertise. Do not try to diagnose this from `capabilities` alone.
- **On this machine only `claude-code` and `codex` are eligible** for immutable receipt review; the refusal names them as `supported immutable review runtimes`. The installed orchestrator contract, by contrast, is rendered for exactly four runtimes (Claude Code, Codex, OpenCode, Pi) — a real asymmetry, reported upstream as issue **#4805** (`Gentleman-Programming/gentle-ai`), with occurrence records in **#4984** and **#5117**. Related history: **#2479** shipped the OpenCode transport in stable `v2.3.0`; **#2242** was closed as not planned; **#2209** declares OpenCode natively/bundled supported. Treat this as a *possible regression on a build that should contain the fix*, never as a proven root cause.
- **A refusal does not block delivery.** The refused preflight here left `mutation_outcome: not_started`, created no lineage, receipt, tombstone or worktree change, and the work proceeded under ordinary repository policy. Review is information, not permission.
- **Do not retry blindly after a typed failure.** Read `retry_safe` and `replayability` from the envelope rather than guessing; several reason codes (`target_already_acknowledged`, `correction_context_budget_exceeded`, `captured_artifacts_unverifiable`) are terminal or need a different continuation entirely.
- **`normalize before freeze` is not optional.** Any source-mutating normalizer must run **before** START. After START, only check-only steps (formatting checks, typecheck, tests) are allowed. A byte, path or mode change invalidates the receipt and requires a fresh review — never formatter-only tolerance.
- **Read-only commands are the safe exploration set.** `review capabilities`, `review mode status`, `review status`, `review schema …`, `review inspect-candidate` and `review validate` do not create authority. Everything named `capture-*`, plus `start`, `repair`, `recover`, `abandon`, `invalidate`, `reclaim`, `store-reset` and `reopen-results` can mutate.
- **Privacy discipline when reporting upstream.** A provider-defect report must exclude raw argv, absolute paths, private project names, usernames, hostnames, credentials, diffs, source contents and environment values. Rewrite commands with `<repo>` / `<base-ref>` placeholders, keep typed envelope codes, versions and OS/architecture. Run a final grep for the forbidden strings **immediately before** the GitHub call.
- **Unverified observation:** the failure envelope we received self-identified as `gentle-ai.review-integration.failure/**v2**`, while `capabilities.schemas` enumerates `gentle-ai.review-integration.failure/**v1**`. Not reconciled; re-check against the installed build before citing either.

## 18. Related learning

- `rsc-harness-learnings.md` — the other harness in this repo, including its own switch-and-permission model.
- `git-github-gh-commands-best-practices.md` — how issues, branches and PRs are opened here, and the `gh` mechanics used to file the upstream report.
- `02-DOCS/wiki/ftd/frontend-port-single-source.md` — the work unit this review preflight was run against (issue #48 / PR #49).
