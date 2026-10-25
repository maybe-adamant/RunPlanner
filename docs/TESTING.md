# Testing

The test lanes and when to run them are in
[`AGENTS.md`](../AGENTS.md#testing). This document owns the shared execution
policy and the mechanics of the opt-in measurement lanes.

## Shared test execution policy

All package and application Vitest files run through the single
`npm run test:correctness` lane; the performance witness and the opt-in
equivalence and draft corpus lanes are its only excluded files. The repository
uses the calibrated eight-worker setting, 120-second test and hook watchdogs, a
30-second teardown watchdog, and zero retries. These values detect probable
hangs; they are not correctness performance budgets. Fixture integrity
intentionally remains a one-worker command, and all correctness tests use the
shared watchdogs. Do not add local timeout or retry overrides. Testing Library
asynchronous queries use the shared ten-second functional wait. The progress
reporter's heartbeat and slowest-file output are diagnostic and never determine
pass/fail.

## Equivalence

`npm run test:equivalence` compares digests of the `simulateProject` product,
the encoded execution plan and a candidate-session probe for the execution
fixtures, checkpoints and the listed route builders with the committed
`packages/planner-engine/test/equivalence/baseline.json`. `EQUIVALENCE_WRITE=1`
rewrites the baseline, only for an intended product change.

## Draft corpus

`npm run test:draft-corpus` drafts a fixed corpus of specs and seeds, prints
target, order, purchase, attempt and time aggregates with deltas against the
committed `packages/planner-engine/test/draft-corpus/baseline.json`, and fails
only on a refusal, a throw, a failed draft or a redrafted seed's changed plan.
`DRAFT_CORPUS_WRITE=1` rewrites the baseline; `DRAFT_CORPUS_ONLY=<regex>`
drafts a subset of specs.

## Performance

Performance is measured separately, outside `npm run check`, with
`npm run test:performance:snapshot` and judged by
`npm run test:performance:compare`; `npm run test:performance:absolute` is
reserved for an explicitly canonical environment.

The snapshot covers the eight Underworld/Surface rebuild, cold-candidate, edit,
and cached-Undo operations. Full rebuild uses one warmed application and a
freshly decoded copy of the project for one warmup plus three measured calls,
so no cached biome is reused; each cold-candidate, edit, and cached-Undo sample
uses a fresh prepared application and state, with medians reported.

The generic comparison runs base and candidate sequentially on the same host,
resolves dirty worktrees to `HEAD` and clean worktrees to `HEAD^` unless the
`RUN_PLANNER_PERFORMANCE_BASE_REF` environment variable or `--base-ref`
overrides the base, and rejects an identical clean base. It requires both a
strict percentage increase and an inclusive absolute increase: 20%/100 ms for
non-Undo metrics and 50%/10 ms for cached Undo. The canonical 1,000 ms
interaction and 50 ms cached-Undo targets are report-only in generic
comparisons.
