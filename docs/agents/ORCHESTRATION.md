# Orchestration

How the main session runs delivery with delegated agents. Agents other than
the main session follow `AGENTS.md`, their role file under [roles](roles/) and
their task packet; they never take on this role.

## When to orchestrate

Use gated delegation for substantial cross-lane features, foundational model
corrections, schema changes and explicitly gated plans. A small focused fix one
agent can implement and review safely does not need it.

Before delegating a spike or open-ended investigation, settle with the owner
the shape decisions that bound the search: scope, simplifications, banned
paths. A spike then measures only what the agreed shape leaves open.

## What the main session owns

Scope, authority selection, locked plans, task packets, finding dispositions,
final review, Git operations and owner communication. It decides whether a
reported contract conflict needs a plan amendment, a narrower scope or the
owner's input. Delegation does not replace its own reading of the live diff.

## Task packets

Each packet is self-contained: the exact gate, ownership, deliverables,
exclusions, acceptance lanes, expected deletions, starting files or symbols and
the governing document sections. It omits the parent history. Inventory the
base and worktree before writing it.

- **Read-only work** (audits, inventories, game-fact checks, reviews) goes to
  the [investigator](roles/investigator.md) role. To turn a read-only agent
  into a writer, start a writer instead, or quote the owner's approval in the
  packet.
- **Best-effort or loosely specified work** (for example draft tuning): the
  packet tells the executor to stop and ask, with options and a lean, when
  something is unclear, unexpected or larger than the packet implies, and to
  send short milestone notes. It sets a time box (about 30–40 minutes, then
  report). Watch the worktree at an interval and intervene early; prefer
  narrowing the goal over building for edge cases.
- **Tuning loops** iterate on a small subset of the measurement corpus (the
  specs the change touches plus one heavy and one Duo spec, about 8 seeds),
  report after each round (setting, numbers, next idea), run comparisons one
  after another, never in parallel, and run the full corpus once to confirm.
  Say plainly when a heuristic stops paying.
- **Shape iteration** (the owner reviewing screenshots): the executor
  implements, typechecks and screenshots only — no test rewrites, lanes or
  docs — and leaves the work uncommitted until the owner approves the shape.
  Then tests, lanes and docs in one pass.
- **Experimental directions** that are cheap to remove are implemented simply
  and judged on merit: no shadow modes, debug relaxers or hardening rounds
  before the direction is wanted.

## Agents and the worktree

- One write-capable agent works in the shared worktree at a time; bounded
  read-only investigations may run beside it.
- While an executor is mid-task, commit only explicit paths, never a commit of
  all tracked changes, and check the commit's file list afterwards.
- A screenshot dev server uses its own port and its own dependency cache
  directory; sharing the owner's cache breaks their running dev server.
- The executor that finishes a job also does its closure: docs, plan
  retirement, testing checklists. A separate agent just for docs re-reads what
  the executor already knows.

## Standing executors

Keep a standing executor per lane (engine; planner application and UI; catalog
and game-source research; execution plan, fixtures and game module) and a
reviewer per lane (engine and execution; planner and UI), as a session roster
with each one's task count and approximate size.

Retire an executor when its ownership or design changes materially, after
about ten tasks, after its second compaction, or when it visibly regresses by
forgetting or reopening a settled decision. An executor continuing the same
design whose decisions live in a written plan keeps working through its first
compaction, since a fresh agent must re-read everything. Within a gated plan,
retire only at a gate boundary and hand off through the plan. When a large
lane agent has gone cold and the task is small, prefer a fresh agent with a
tight packet.

## Review

Review stabilized work with the lane's standing reviewer, never an agent that
executed the change. Use a fresh independent reviewer for schema changes,
execution-protocol changes, foundational model corrections, documentation
restructures and plan closure. Run one bounded remediation pass, not an
open-ended loop.

## Verification

- Mid-gate slices run only the lanes they touch; pick them from the diff and
  state which ran.
- The full `npm run check` runs for shared-package or broad changes,
  test/configuration changes, phase closure, push and release.
- `npm run check` stays core correctness. Measurement, corpus-style and
  full-route draft coverage live in opt-in lanes; moving one slow file out of
  the gate saves little, because the gate is bound by total test work.
- The main session owns broad phase-closure checks and the final review of
  contract fidelity, ownership, superseded paths, tests, growth and docs.
