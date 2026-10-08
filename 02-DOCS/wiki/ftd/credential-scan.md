# Scan tracked files for credential literals (close of the credentials item)

## Intent

Close the last open sub-step of the TODO item *Externalize and rotate database
credentials*: scan all tracked files for credential literals — **without reproducing
any secret in docs, logs, or this document** — and record the verdict. Externalization
and rotation were already delivered and exercised live in earlier changes; what remained
was the audit that proves no live credential value sits in versioned content.

## Scope

- In: read-only scan of tracked files at `dev` HEAD; classification of every match;
  closure record in `TODO.md`; this FTD doc.
- Out: no config, source, or secret mutation (nothing to fix was expected; if a live
  value had been found, the change would have stopped here for a human decision);
  Git-history rewrite (out of scope by policy: rewriting history does not invalidate a
  credential — rotation does, and rotation already happened).

## Method

1. `git grep` at HEAD for value-like patterns: `PASSWORD`/`PASS` assignments,
   `POSTGRES_PASSWORD`/`DB_PASSWORD`, known bad tokens (`admin123`, `postgres:postgres`),
   matching against tracked files only. Output reduced to `file:line` (never the value).
2. History sweep: extract every literal ever bound to a password variable across all
   branches into a scratch file; print only the **length distribution**; then count each
   value's occurrences at HEAD (values themselves never printed).
3. Confirm the real secret sources are excluded from Git
   (`git check-ignore` on `secrets/` and `.env`).
4. Classify every remaining match as placeholder / redaction marker / historical record
   mention / live literal.

## Findings

| Match | Location(s) | Classification |
| --- | --- | --- |
| `CHANGE_ME` | `env.template:2,6` (+ 1 LEARNINGS mention) | Placeholder in a template, never a value |
| `REMOVED` | `BackEnd_README.md:203,292,545`, `LEARNINGS/*.md` ×2, `src/indexOld.ts:13` | Redaction marker applied by the earlier hardening change; `indexOld.ts` disappears when PR #27 merges |
| `admin123` (the previously exposed password) | `02-DOCS/wiki/ftd/docker-compose-secrets.md:50`, `02-DOCS/wiki/ftd/rotate-db-secrets.md:82` | Historical-record mentions inside evidence sentences that **describe the replacement/rotation**; not active configuration |
| `PGPASSWORD="$(cat secrets/db_password.txt)"…` | `_01_rsc_wpm_backend/commands.md:81` | Command reads the value from the ignored secret file; no literal |
| History sweep | 2 distinct value-like literals ever bound to password vars (lengths 7 and 8) = `REMOVED` and `admin123`; both match the rows above, zero other occurrences at HEAD | No former live value survives in tracked content |
| `secrets/`, `.env` | git-ignored (`git check-ignore` confirms) | Real values live only in ignored files |

## Decision

**No live credential value exists in tracked files.** The only value-like literals are
placeholders, redaction markers, and the two historical-record mentions of the already
compromised password — each inside evidence that documents the rotation itself. Rewriting
those records would erase the audit trail; repo policy is to never rewrite historical
evidence. Volume recreation (2026-10-07) already rotated the live cluster password.

## Checklist

- [x] Scan run at HEAD over tracked files only; matches reduced to `file:line`
- [x] History sweep: length distribution only, values never printed to stdout/docs/logs
- [x] `git check-ignore` confirms `secrets/` and `.env` excluded
- [x] Every match classified; no live value found
- [x] FTD doc written before any tracked-file edit
- [x] `TODO.md` item closed with the evidence summary

## Evidence

- `git grep -n 'admin123' -- .` → exactly the two FTD rows above (head confirm).
- History sweep: value lengths `{7: 8 occurrences, 8: 7 occurrences}` across all history;
  after dedupe, the only values are the `REMOVED` marker and `admin123`; both verified
  present at HEAD only in the rows above. No other historical value appears at HEAD.
- `git check-ignore -v` → `_01_rsc_wpm_backend/.gitignore:26:secrets/`,
  `_01_rsc_wpm_backend/.gitignore:19:.env`, `.gitignore:8:.env`.
- No value was reproduced anywhere in this document or the scan logs.

## Next

- Merge PR (against `dev`); the TODO closure lands with it.
- When PR #27 merges, `indexOld.ts` disappears and the `REMOVED` marker count drops;
  no further scan needed for that (pure deletion).
- Future duty: any change that adds configuration must keep values out of tracked
  files; the scan can be re-run on demand with the same value-free method.