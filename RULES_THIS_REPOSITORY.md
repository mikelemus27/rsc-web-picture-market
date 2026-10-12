 1. No branches, issues, or PRs without explicit user permission.
 2. No PR without an associated issue.
 3. Exception: trivial docs-only/config changes commit directly on dev.
 4. Every change = issue → branch → PR (one issue per change; never fold new scope into an existing PR).
 5. The user merges every PR (I don't merge).
 6. Never delete branches (in this repo, branches are kept — never local nor remote).
 7. PRs target dev (base = dev); main is the GitHub default branch.
 8. Closing keywords are ignored on dev-based PRs → close issues manually.
 9. Conventional Commits, no gitmoji, no AI attribution (Co-Authored-By).
10. Canonical verification via project-tools/container-management.sh (test-backend, test-backend --container, test-frontend), not direct bun calls.
11. Always prefix GitHub refs: issue #N / PR #N, never bare #N.
12. Persist follow-up work in root TODO.md with observable completion criteria.
13. Never fix the malformed package.json line without explicit user acceptance. (a constraint)
14. main stays the default branch; README stays dev-only; never re-propose main/default-branch changes.

## Compass Block — Mandatory End-of-Turn Protocol

Every assistant turn MUST end with a compass block. No exceptions. This is the orient protocol contract.

### Required Structure (exact order, one line each)

```
📍 Where you are · [current state — 1 sentence, factual, no fluff]
🕰 Why we're here · [reasoning/decision behind the work — 1 sentence, captures the "why", not the "what"]
✅ What we accomplished · [what was accomplished this turn — 1 sentence, evidence-based, empty if nothing yet]
➡️ Next · [next action — 1 sentence, MUST end in a question to the user]
```

### Rules

- **Never skip it.** Even for "I don't know" or clarification turns. The compass block is the handoff.
- **One idea per line.** Short, STE-style sentences. No multi-clause paragraphs.
- **Language:** Always English. The user's language preference is English; do not switch languages unless the user explicitly asks.
- **The "Why we're here" is mandatory.** It explains the decision rationale, not the task description. Example: "Why we're here · The hardcoded port 4001 breaks when the backend starts on PORT=5055; using process.env.PORT guarantees automatic sync." Not: "Why we're here · I'm going to fix the port."
- **The "Next" must end in a question.** Forces the user to decide. Examples: "Next · Do we tackle pagination (#27) or authentication (#28) first?" "Next · Should we review the TODO #25 (UsuarioService) first?" "Next · Do you want CORS or rate limiting prioritized?"
- **Use the exact emojis:** 📍 🕰 ✅ ➡️ — no substitutions.
- **No extra lines.** No separators, no "---", no "Compass Block:" label. Just the four lines.
- **If nothing accomplished yet:** "✅ What we accomplished · (nothing this turn — just exploration/question)" is valid.
- **The compass block is the LAST thing in the turn.** No text after it.

### Example

```
📍 Where you are · 6 open TODOs (#25–31), uncommitted changes in .gitignore/.rsc.json/.claude/, no work in progress.
🕰 Why we're here · Completed items (container mgmt, healthchecks, secrets, frontend tests) left the repo stable; remaining items are incremental security and DX improvements.
✅ What we accomplished · State review and confirmation of open items; no code changes this turn.
➡️ Next · Do we tackle pagination (#27) or authentication (#28) first?
```
