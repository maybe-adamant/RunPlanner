# Agent Workflow Cleanup

Status: locked 2026-10-25. Base commit: `18358d70a`.

## Objective

Every agent reads `AGENTS.md`, so it carries only the rules every agent needs
(about 250 of today's 504 lines). Orchestration, testing mechanics and the
documentation lifecycle move to the files whose readers need them. Agent roles
are defined once, platform-agnostically, with thin per-platform wrappers.
Workflow rules kept in the main session's private notes move into the tracked
orchestration guide.

## Target

- **`docs/agents/ORCHESTRATION.md`:** the main-session workflow in generic
  terms (delegate, background agent, one writer at a time): today's
  "Main-Session Orchestration Only" section plus the workflow rules from the
  private notes (executor rotation, scoped acceptance mid-gate, narrow lanes
  before commit, iterate shape before lanes, closure docs by the finishing
  executor, separate dev-server cache for screenshots, explicit-path staging
  while an executor works, interval progress checks and time boxes for
  best-effort tuning, subset loops, settle shape before spikes, independent
  review per gate, read-only investigations to the investigator role).
- **`docs/agents/roles/`:** one plain-Markdown file per role — investigator,
  engine executor, planner/UI executor, docs executor, reviewer — stating
  purpose, what it may change, what it reads first, its rules and its report
  shape. No model or tool names.
- **`docs/agents/PLATFORM_NOTES.md`:** short notes on platform-specific
  mechanics (for example how a Claude Code subagent's context size is read
  from its transcript, repurposing a read-only agent).
- **`.claude/agents/<role>.md`:** thin wrappers — frontmatter (description,
  model, tools) and a body pointing at the role file. Committed.
- **`docs/TESTING.md`:** the shared test execution policy, performance
  comparison thresholds, equivalence and draft-corpus mechanics.
  Generated-fixture discipline moves to a README beside the execution fixtures.
  `AGENTS.md` keeps the lane list with one-line triggers and the narrow-lane
  rule.
- **`CONTRIBUTING.md`:** the documentation and audit/plan lifecycle detail;
  `AGENTS.md` keeps the core documentation rules.
- **`AGENTS.md`:** lanes, placement, construction, refactoring, modeling
  rules, application state, UI, the test lane list, core documentation rules,
  Git, and pointers to the files above. Repository-wide conventions currently
  only in private notes (brief self-contained comments, brief commit messages)
  are added if missing.

## Gates

1. **Agents and orchestration** (main session): `docs/agents/`, the wrappers,
   and the private-notes pruning of rules now in the guide.
2. **AGENTS.md and testing** (docs executor): slim `AGENTS.md`, create
   `docs/TESTING.md`, the fixtures README and the `CONTRIBUTING.md` section;
   independent fact-preservation review; delete this plan.

Lane: `npm run format:check` and the relative-link sweep; the test-policy
architecture test if it reads `AGENTS.md` or the test configuration text.

## Non-goals

- Changing any rule's meaning; moves and wording only.
- Retiring testing checklists or investigations (separate pass).
