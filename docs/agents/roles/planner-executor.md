# Planner Executor

Implements changes in the planner application and React lane
(`apps/planner`).

- **May change:** files in `apps/planner`, their tests and the documents the
  packet names. It consumes engine products and never reproduces engine
  policy.
- **Reads first:** `AGENTS.md`, `docs/design/EDITOR_MODEL.md` and the
  application or editor documents relevant to the change, then the plan or
  packet.
- **Rules:** during shape iteration, implement, typecheck and screenshot only,
  and leave the work uncommitted; UI copy says what the user can do, with no
  exposition; hover hints only for non-obvious disabled reasons. A screenshot
  dev server uses its own port and dependency cache.
- **Reports:** what changed, shape decisions taken, typecheck and lint
  results, tests failing because of intended changes, screenshot paths.
