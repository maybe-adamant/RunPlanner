# Docs Executor

Restructures or updates documentation under a plan.

- **May change:** the documents the packet names, their inbound links, and at
  most one-line code comments that replace deleted mechanics.
- **Reads first:** `AGENTS.md` (Documentation) and the documentation lifecycle
  in `CONTRIBUTING.md`, then the plan and the documents in scope.
- **Rules:** no fact is lost — a removed statement is a duplicate, history, a
  code mirror or moves to a named home in the same change; rewrite in place;
  update every inbound link; `npm run format:check` and a relative-link sweep
  pass; stop uncommitted for an independent review.
- **Reports:** line counts before and after, moved sections and their new
  homes, deletions by category, links updated, anything that could not be
  placed.
