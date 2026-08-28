# Test Execution Stability Plan

Status: locked for implementation

Base commit: `36058c27`

Scope owner: repository test configuration and test support only

## Objective

Stop treating correctness-test duration as a feature verdict. Run every
non-performance Vitest file under one fixed-worker correctness policy with a
generous hang watchdog, while keeping the existing product-performance
operations in one isolated, single-worker comparison lane.

The user-visible outcome is a complete gate that no longer requires moving
files between regular and heavy manifests or adding local timeout exceptions
when a correct route-scale witness takes longer under host contention.

## Current state

- `npm run test` executes separate regular, heavy, and performance lanes.
- `vitest.test-lanes.ts` names 57 heavy files individually.
- regular tests use four workers and Vitest's default five-second test/hook
  timeout; heavy tests use two workers and 30-second test/hook timeouts.
- the default configuration used by narrow commands uses two workers but still
  inherits the five-second timeout.
- fixture integrity has its own one-worker configuration and also inherits the
  five-second timeout.
- 28 correctness tests or hooks retain explicit 10–60 second overrides.
- the performance lane uses one worker and directly fails generic hosts against
  absolute 1,000 ms interaction and 50 ms cached-Undo targets.
- `TestProgressReporter` prints file start/completion and elapsed file time but
  has no long-running heartbeat or machine-readable timing output.

## Locked policy

### Correctness

- All non-performance Vitest files form one correctness lane.
- The shared correctness watchdog is 120 seconds for tests and hooks and 30
  seconds for teardown. It means probable non-termination, not slowness.
- Correctness has no per-test timeout overrides and no retry policy.
- Testing Library async queries use one shared 10-second functional wait. This
  remains a bounded missing-UI failure, not a performance measurement; local
  query timeout options are retired.
- Worker count is one fixed measured repository value. Start from four; compare
  complete correctness runs at four and six workers. Adopt six only if it is
  stable and materially faster. Test eight only if six produces at least a ten
  percent wall-time improvement without worker, memory, or teardown failures.
- Narrow catalog, engine, planner, UI, contract, product, changed-file, and
  fixture commands inherit the same watchdog and worker policy unless their
  semantic scope already requires fewer workers, as fixture integrity does.
- The progress reporter prints a 30-second heartbeat for active files and a
  slowest-file summary. These timings are diagnostic and never fail the lane.

### Performance

- Only the existing Underworld and Surface operation witnesses participate.
  No correctness test receives a timing baseline.
- Performance remains single-worker and records eight named metrics: full
  rebuild, cold candidate projection, representative edit publication, and
  cached Undo publication for each route.
- The raw Vitest snapshot command inherits the same 120-second test/hook and
  30-second teardown watchdogs. Operation duration never controls that
  watchdog.
- Full rebuild performs one unmeasured warmup and three measured calls. Each
  cold candidate, edit, and Undo sample receives a fresh application and
  prepared project state, then times only its named operation. Every sample
  retains the existing evaluation-work assertions. The candidate value is the
  median of three samples, so a repeated candidate load cannot become a cached
  substitute for the cold metric.
- Candidate and base snapshots run sequentially on the same host. The default
  base is the current `HEAD` for an uncommitted worktree and `HEAD^` for a clean
  worktree. CI or review may override it with an explicit base ref. A resolved
  clean base identical to the candidate revision is an error, not a successful
  comparison.
- A non-Undo metric regresses only when it is both more than 20 percent slower
  and at least 100 ms slower than base. Cached Undo regresses only when it is
  both more than 50 percent slower and at least 10 ms slower. Percentage tests
  are strict and absolute-delta tests are inclusive. A zero base therefore
  still requires the absolute delta; negative or non-finite durations make a
  snapshot incompatible.
- The 1,000 ms interaction and 50 ms cached-Undo product targets remain in the
  report. They are absolute health signals, not generic-host change verdicts.
  A dedicated canonical environment may explicitly enforce them.
- The comparator owns temporary-worktree creation and cleanup. It must accept
  an explicit base ref, create an isolated base worktree, bootstrap it with
  `npm install --ignore-scripts --prefer-offline`, and invoke the versioned
  `npm run test:performance:snapshot` command introduced by Gate A. It fails
  clearly when the base lacks that command or cannot produce a compatible
  snapshot, cleans temporary worktrees and output on bootstrap/run failure as
  well as success, and never alters the caller's worktree.

## Included changes

- replace the regular/heavy configurations with the default correctness
  configuration;
- remove the heavy manifest and its file-existence/overlap machinery;
- add shared correctness watchdogs and remove all local correctness timeout
  arguments;
- configure the one shared Testing Library async wait and remove its local
  override;
- update root and narrow scripts so no correctness entry point falls back to a
  five-second timeout;
- add a small test-policy witness preventing retired lane scripts/configs and
  local timeout overrides from returning;
- add heartbeat and slow-file diagnostics to the existing reporter;
- extract the existing performance operations into a snapshot-capable test
  support product;
- add a same-host base/candidate comparator with focused synthetic threshold
  tests;
- update the durable Vitest policy in `docs/design/ARCHITECTURE.md` and the
  contributor testing rules in `AGENTS.md`;
- record final validation in `IMPLEMENTATION_PROGRESS.md` and delete this plan
  at closure.

## Excluded scope

- production catalog, engine, application, or React behavior;
- changing test assertions or reducing semantic coverage to improve duration;
- retries, quarantines, skipped tests, or pass-on-rerun policy;
- per-test or per-file correctness performance baselines;
- a committed hardware-specific timing manifest;
- distributed CI, sharding, or a new test framework;
- enforcing the absolute product target on unknown local hardware;
- optimizing production code merely to make this infrastructure delivery
  green.

## Gate A - unified correctness execution

Deliver one complete correctness policy:

- default/shared/fixture Vitest configuration changes;
- package-script replacement of regular/heavy with `test:correctness`;
- removal of the heavy manifest, both retired configs, and all local timeout
  overrides;
- reporter heartbeat and slowest-file diagnostics;
- a repository policy witness for lane closure and timeout ownership; and
- raw single-worker performance snapshot support needed by Gate B, without yet
  changing the performance verdict.

Primary verification:

- focused configuration/policy tests;
- focused reporter tests with injected output, clock, and timer scheduling for
  heartbeat, slowest-file ordering, and timer disposal after passing and failed
  runs;
- fixture integrity;
- complete correctness runs at four and six workers, sequentially;
- a raw performance snapshot containing all eight metrics; and
- typecheck, lint, and formatting for changed infrastructure.

Intended commit:

```text
test: unify correctness execution policy
```

## Gate B - relative performance verdict

Deliver the base/candidate comparison as the only generic-host performance
verdict:

- pure metric comparison and report formatting;
- explicit base-ref and temporary-worktree orchestration;
- package scripts separating raw snapshot, relative comparison, and optional
  absolute enforcement; and
- synthetic tests for unchanged, percentage-only, absolute-only, true
  regression, exact percentage and absolute boundaries, zero-base behavior,
  invalid duration, missing metric, identical base, and incompatible snapshot
  cases.

Primary verification:

- comparator unit tests;
- candidate versus Gate A base on the same host;
- one deliberate synthetic regression that proves the command exits nonzero;
- `npm run test` as correctness plus relative performance comparison; and
- unchanged production build output.

Intended commit:

```text
test: compare performance against repository base
```

## Gate C - durable closure

- absorb the final correctness/performance policy into `ARCHITECTURE.md` and
  `AGENTS.md`;
- record the selected worker count, exact lane counts, comparison result, and
  complete gate in `IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan; and
- run one complete `npm run check` after independent review remediation.

Intended commit:

```text
docs(testing): close execution stability work
```

## Review requirements

Each implementation gate receives a fresh executor and independent reviewer.
The final review must confirm:

- no production behavior changed;
- every former correctness file remains selected by complete and narrow lanes;
- the 120-second value is only a watchdog;
- no assertion was removed to obtain green timing;
- no local timeout or heavy classification path survives;
- performance snapshots are deterministic in identity and explicit in units;
- relative thresholds require both percentage and absolute deltas;
- absolute targets remain visible; and
- temporary worktrees and output files are cleaned on success and failure.
