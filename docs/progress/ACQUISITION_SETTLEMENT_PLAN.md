# Acquisition settlement correction and decomposition

## Status and objective

Status: locked; Slice A complete and independently reviewed. Slice B is next.
Production base: `088ee598`.
Evidence: `docs/investigations/ACQUISITION_SETTLEMENT_BOUNDARIES.md`.
The worktree also contains the requested retirement of older trait investigations;
preserve those changes and do not reopen their implementation.

Correct Artificer's unsupported pending-sibling bag bypass, then make acquisition
settlement easier to maintain through complete ownership boundaries. Preserve
one explicit chronological role fold and the existing repair/candidate evidence.

User-visible change: an Artificer conversion cannot select a reward absent from
the eligible current bag merely because a previous matching conversion remains
uncollected. Legitimate remaining copies and normal refills remain supported.
All other authoring, simulation, and editor behavior is preserved.

Commit the approved plan before implementation. Keep the semantic correction
and behavior-preserving refactoring in separate commits.

## Authorities and source facts

- `docs/design/ARCHITECTURE.md`: Product Construction and package boundaries.
- `docs/design/SIMULATION_AND_VALIDATION.md`: Ordered State-Flow Ownership.
- `docs/audits/rewards-and-acquisition/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md`:
  RunProgress bag semantics and Multiple-Hammer Fields consequence.
- `docs/audits/rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md`:
  acquisition and counted-bag disposition.

Local source evidence is available under `../../1GameData/Scripts/`:
`GiftLogic.lua` calls `ChooseRoomReward` at each conversion, excluding Devotion
and SpellDrop and ignoring forced room rewards. `RewardLogic.lua` filters the
remaining bag, refills when no eligible entry remains, and removes the selected
entry immediately. Pickup timing affects acquisition-history eligibility, not
whether a consumed bag entry still exists.

The native function has a final fallback after repeated refills. This plan does
not expand the engine's existing supported refill model or redesign its kernel.

## Ownership and hard boundaries

All production changes belong to planner-engine. Catalog remains unchanged:
the needed game facts already exist. Authored schemas, addresses, commands,
execution protocol, fixtures' wire format, UI, and game module do not change.
An existing structurally valid plan may become context-invalid under the
Artificer correction; retain it for repair rather than migrating or deleting it.

Keep the role coordinator responsible for order, branch aggregation, recursion,
blocked-child retention, and frontier publication. It must visibly compose:
offer support and concrete resolution; Forfeit substitution; Sea Star/provider
materialization; conversion; concrete effects; trait settlement; event and
repair evidence. No shared mutable coordinator context crosses an extraction.

Reuse reward-kernel bag operations and the existing Anvil, trait, level,
keepsake, and Path authorities. No registry, effect bus, generic middleware,
candidate-only simulator, or per-biome acquisition fold.

## Delivery slices

### A — Correct Artificer bag consumption

Starting point: `simulation/rewards/acquisition-settlement.ts`, the
`applyProducerRoleHistory` Artificer branch.

- Remove `latestSiblingSequence`, `hasPendingSibling`, the supporting
  replacement-name scan, and the fallback to the unchanged bag.
- Generate only from states returned by the existing counted-bag transition.
- Preserve use consumption, Forfeit, generation events, deferred pickup,
  replacement lifecycle, and retained-source repair behavior.
- Do not add the removed rule to candidate support or modify exception handling.

Primary test owner: `test/simulation/artificer.test.ts`.
Characterize with existing builders and real role settlement:

1. A first conversion consumes the last entry of an identity; with another
   eligible identity remaining, the second matching conversion is rejected even
   while the first object is uncollected. No second use or offer is generated.
2. Two legitimate eligible copies allow two conversions before collection, each
   decrementing the bag and spending a use.
3. No eligible entries permits the existing refill and subsequent conversion.
4. Candidate support and settlement agree for the exhausted-entry case.

Strengthen existing coverage rather than duplicating refill/Forfeit matrices.
Review independently, then commit this focused behavior correction.

Delivered: removed the pending-sibling bypass; covered exhausted uncollected
entries, legitimate duplicate copies, and candidate agreement. Corrected the
existing Fields Hammer workflow to retain the exact second-conversion finding:
its authored route has only one eligible late-Hammer entry, not three.
Validation: Artificer 22 tests, H materialization 28 tests, full engine 143 files /
1,856 tests, workspace/fixture typechecks, formatting and diff checks passed.
Independent review passed, including a separate 50-test run. Full repository
closure remains deferred until the refactoring slices finish.

### B — Return complete site settlement products

Starting points: `AcquisitionSettlementProduct`, all site entry points in
`acquisition-settlement.ts`, and `findings.ts:addRewardFinding`.

- Add returned findings to the site product and remove caller-owned findings
  map parameters from site settlement functions.
- Update all production callers and primary tests in the same slice, including
  recursive/composed site paths. Each caller merges once at the original
  chronological point.
- Reuse the existing finding merger, preserving identity, region, chronology,
  and all distinct Pom evaluation evidence. Place the narrowly named merge
  operation with findings if renamed/moved; remove the old entry point.
- Preserve role, pickup, and derived frontiers, timeline facts, branch order,
  and blocked-child evidence. Local maps remain permitted.

Caller neighborhoods: shop settlement; biome generation; authored sites;
offer-lifecycle/reached settlement; encounter acquisition. Use a symbol search
to enumerate exact call sites before editing, not a broad application rewrite.

Tests: existing Pom divergent-cohort/repair evidence tests, Artificer deferred
replacement, and Hermes unresolved Mystery Boon contact. Add only missing
complete-product/merge assertions. Review independently and commit.

### C — Decompose acquisition responsibilities

Use a focused acquisition directory under `simulation/rewards/`; choose final
names from responsibilities, not a file-per-effect quota.

- Site owner: producer/owned entry construction, ordered pickup traversal, and
  acquisition-resolved source binding. Keep their ordering and candidate-only
  probes intact.
- Conversion owner: existing eligibility functions and Artificer generation.
  Return generated branches, findings, and replacement source/roles. The role
  coordinator handles immediate recursion; no injected recursive callback.
- Role owner: retain the explicit branch fold and repair/candidate publication.
- Shared contracts: move only those needed across these concrete owners. Keep
  private histories and evaluators on their existing internal artifact boundary.

Artificer candidate and settlement may reuse a narrow bag-preparation operation
after A. Do not equate the full operations: settlement spends uses, records
events, and materializes children; candidate evaluation only assesses support.
Preserve existing caller-specific error treatment unless separately justified.

The inline concrete-effect block may move as one complete transition only if
its explicit inputs/result are smaller and clearer than keeping it inline.
It is not a required extraction. Do not create one wrapper per fixed grant.

Update internal imports directly. Delete superseded implementations and the old
monolithic module once its responsibilities have moved. No forwarding facade,
interface-only commit, or alternate route retained for compatibility. Leave
unrelated trait settlement, acquisition-artifact attestation, and scheduler work
alone. Review independently and commit this behavior-preserving slice.

## Tests and audit-againsts

Primary policy suites remain with their existing authority: Artificer/Sea Star,
Time Piece, Anvil, Pom, traits, and Hermes acquisitions. Consumer tests provide
representative contacts, not copies of those full matrices. Keep existing fixture
serialization; no fixture regeneration unless the actual semantic result changed.

At each slice verify:

- conversions precede original acquisition effects;
- deferred generation is distinct from collection;
- unpicked candidate probes do not mutate real branches or spend uses;
- missing versus invalid authored details retain exact repair owners;
- eliminated branches retain their distinct candidate/Pom evidence;
- paid/free and producer provenance survive complete transport;
- no new policy appears in callers, projections, or execution assembly.

Use narrow tests and typecheck during implementation. At final closure run one
complete `npm run check`, with performance comparison against the pre-work base
where supported. Investigate regressions rather than weakening gates. Do not
rerun broad checks merely to furnish each reviewer fresh evidence.

## Orchestration and closure

Main session owns scope, commits, finding dispositions, and broad closure. Use
one write-capable executor with a focused packet naming each slice's symbols,
authorities, exclusions, and tests. Reuse it for bounded remediation; obtain a
fresh independent review after each slice stabilizes. No implementation starts
until the proposed plan has been approved and committed.

Final review judges explicit ownership and reduced change coupling, not target
line counts. Absorb complete site-product and acquisition ownership rules into
the existing design document. The Artificer audit's bag facts are already correct;
adjust its disposition only if needed. Delete this plan and its investigation
at closure, recording truthful verification in the closure commit. Do not retire
unrelated progress documents as part of this work.

## Overengineering check

This plan contains one source-backed bug fix and two refactoring slices. It does
not standardize every effect family, redesign branch state, add public APIs for
future consumers, or require a new end-to-end fixture library. If an extraction
needs mutable coordinator state passed around to function, keep that work in
the coordinator. Any newly found behavioral defect beyond A requires explicit
disposition rather than being hidden inside the cleanup.
