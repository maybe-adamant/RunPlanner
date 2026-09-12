# Shop settlement ownership cleanup

## Status and objective

Status: locked; Slice A complete and independently reviewed. Slice B is next.
Production base: `89920fb4`.
Evidence: `docs/investigations/SHOP_SETTLEMENT_BOUNDARIES.md`.

Make Shop settlement easier to maintain without changing authored behavior,
legality, chronology, or candidate/repair evidence. Separate inventory generation
and complete derived-reward transitions from the ordered purchase coordinator.
The user-visible result is unchanged behavior with smaller ownership boundaries.

Commit this approved plan and its investigation before implementation.

## Authorities and scope

- `docs/design/ARCHITECTURE.md`: Product Construction, Reorganization Contract,
  and engine dependency rules.
- `docs/design/SIMULATION_AND_VALIDATION.md`: Ordered State-Flow Ownership and
  the Echo/Travel acquisition rules.
- `docs/audits/traits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md`:
  Contract and Travel source facts.
- `docs/audits/rooms-and-routes/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md`:
  indexed Shop profiles and rarity-bearing options.

All implementation belongs to planner-engine. Existing source-backed game facts
and planner simplifications remain unchanged. This is not a new native-game
audit, a commerce redesign, or an executor change.

Preserve authored schemas, catalog declarations, execution protocol, UI,
schedulers, branch equivalence, and fixture products. Do not extend this work to
Wells, Shrines, Pools, or unrelated reward coordinators.

## Final ownership and placement

Use `simulation/rewards/shop/` from the first implementation slice. It is a
sibling of `acquisition/`, not a child: inventory generation is Shop-owned,
while concrete acquisition settlement remains shared with other producers.

- Inventory owns joint support assessment, generated-offer history, initial
  pending witnesses, and its finding emissions.
- Ordered settlement owns traversal, current-entry agreement cohorts, indexed
  witnesses, surviving branches, role/child evidence, and pending continuation
  or completion. Keep `completePendingShopAcquisitionSite` with this owner.
- Derived-reward transitions own Travel refill derivation and Gold materialization
  when extracted. They return complete products and never receive a mutable
  `ShopExecution`, findings map, frontier list, or coordinator callback.
- Reward kernel remains authoritative for generation and purchase gates.
  Acquisition and trait authorities remain authoritative for concrete effects,
  source resolution, conversions, and trait/Pom/Anvil settlement.

Use concrete modules such as `inventory.ts`, `settlement.ts`, and
`derived-rewards.ts`. A small shared contract module is justified only for actual
shared inputs/products. Do not create a module per special entry or an index
barrel. Pending-state types may remain in `branch-primitives.ts`; moving them is
not an objective and must not introduce runtime cycles or another branch model.

## Invariants to preserve

1. Inventory generation and acquisition are distinct. Unpurchased inventory
   does not apply acquisition effects; unresolved inventory handling remains
   with its existing lifecycle caller.
2. Inventory support preserves exact slot/group witnesses, option identity and
   boosted rarity context. Do not collapse distinct rarity witnesses.
3. Pending Shop state survives partial settlement calls and interleaved room
   actions. Do not replay the whole Shop or recompute source-time facts on resume.
4. Gold materializes before source acquisition, consumes its one-use trait,
   and retains pre-source history and repair evidence. Candidate-only probes
   do not acquire the duplicate or advance the real branch.
5. Travel derives after successful first normal purchase settlement, from the
   original slot. Preserve its exclusion/retry policy and frozen generation facts.
   A newly acquired Travel Deal does not retroactively trigger its own refill.
6. Spell can trigger Travel without consuming Gold. A later refill can source
   Gold. Contract remains free and does not become a normal-purchase trigger.
7. Gold pickup remains separate from materialization, including its source-time
   Pom targets and existing disappeared-target behavior. Preserve paid/free
   provenance, Mystery Boon acquisition resolution, and exact timeline owners.
8. Preserve original cohort sizes, pre-entry agreement branches, finding order,
   missing-versus-invalid classification, and evidence from eliminated branches.
9. Final room exit closes unpurchased pending inventory and retains the existing
   divergent-pending-presence contract check.

## Delivery slices

### A — Complete inventory product and final directory

Starting points: `rewards/shop-settlement.ts:processShopInventory`,
`ShopProcessingContext`, and the three direct biome consumers below.

- Return branches and ordered finding emissions from inventory processing;
  remove the caller-owned findings argument. Reuse `mergeRewardFindingEmissions`
  at the original caller seam.
- Preserve unsupported individual-slot findings versus joint-inventory failure,
  chronology, generation events and pending witnesses.
- Put inventory and the existing ordered settlement in their final Shop
  directory. Keep shared declaration-binding validation with a sensible owner;
  no import cycle or generic helper neighborhood.
- Update direct production/test imports and inventory-result consumers together.
  Remove root `shop-settlement.ts`; no forwarding or compatibility path.
- Do not yet decompose the ordered fold's internal derived transitions.

Production contacts:

- `biome/offer-lifecycle/shop-offer-point-materialized.ts`;
- `biome/generation/authored-site-settlement.ts`;
- `biome/lifecycle-transitions/room-exited.ts`.

Primary tests: `shop-trait-reward-settlement.test.ts` and shared
`shop-trait-purchase-support.ts`, with Contract/Travel and chronology consumers.
Add only a missing inventory local-emission/merge witness; retain the existing
inventory-versus-purchase and unresolved-child cases. Review and commit this
complete boundary change independently.

Delivered: inventory returns branches and finding emissions; the production
caller merges once at the existing seam. Inventory, context and unchanged ordered
settlement now live in their final Shop directory; the old root module is removed.
One focused witness preserves the exact inventory finding owner and chronology.
Validation: engine 143 files / 1,858 tests, focused Shop 4 files / 61 tests,
engine typecheck and diff checks passed. Independent review passed, including
37 tests. Full repository closure remains deferred to Slice B.

### B — Complete derived-reward transitions and closure

Starting points inside ordered settlement: `deriveTravelRefill`,
`materializeGold`, their two paid-source call sites, and the surrounding entry fold.

- Extract Travel derivation with exact branch/profile/slot/source inputs and
  its existing returned descriptor. Do not pass the execution builder.
- Extract Gold materialization as a complete returned transition: updated branch,
  pending materialization, and derived candidate frontiers. Return any other
  products actually consumed; do not promote discarded candidate-only findings
  into real settlement findings.
- Preserve the already-materialized/no-trigger path without clearing prior
  state or duplicating frontiers. The coordinator applies the returned product
  at the original pre-acquisition point.
- Keep `settlePaid`, Contract settlement, branch selection, role collection,
  immediate acquisition delegation, and continuation publication in the ordered
  fold unless an additional extraction demonstrably simplifies a complete
  transition. They are not mandatory file-size reductions.
- Remove displaced closures in the same change. No injected recursive callback,
  event bus, mutable context transport, or parallel candidate simulator.

Primary tests: `shop-purchase-chronology.test.ts` and
`infernal-contract-travel-deal.test.ts`. Reuse their existing policy matrices.
Trace existing product coverage for partial-call continuation and room-exit
cleanup. If absent, add one focused witness using generated inventory, split
settlement calls and an actual interleaved acquisition. Assert preserved pending
source facts/frontiers and final cleanup; do not hand-build impossible witnesses
or duplicate the full Shop matrix.

Review independently, then perform final verification and documentation closure
before committing this behavior-preserving slice.

## Bounded unresolved question

The omitted-order convenience path traverses derived room-action order but
publishes entries from `context.order ?? []`. Production supplies explicit order.
Characterize this contact before changing it; preserve its behavior in this
cleanup unless a separate correction is approved. Do not turn an unproven
direct-call concern into a schema change or silently normalize all callers.

## Verification and orchestration

Baseline investigation: four Shop simulation suites passed, 60 tests. Kernel
policy remains primarily tested in `test/reward-kernel/behavior.test.ts`.
Consumer tests should prove contacts, not reproduce that matrix.

Use the narrow owning suites and typecheck during edits. Each slice gets a
fresh independent review; reuse one executor for adjacent implementation and
bounded remediation. Packets must name the exact slice, files, full direct
consumer allowance, exclusions, expected deletions and tests. Only one agent
writes production at a time. Main session owns scope, docs, commits and closure.

After stable review, run one complete `npm run check`. Compare performance
against the pre-work base with the supported explicit `--base-ref` option;
do not globally override performance-test environment defaults. No fixture
regeneration is expected. Inspect any changed semantic result as a potential
behavioral regression, not routine refactor churn.

## Closure and overengineering check

Success means smaller, explicit ownership boundaries with the ordered invariant
still readable. It is not a line-count target, a universal commerce API, or a
requirement to eliminate every local mutable builder. If a proposed extraction
only renames access to outer mutable state, keep that code in the coordinator.

Promote the durable Shop ownership rules into the existing design authorities.
Delete this plan and its investigation at final closure; preserve unrelated
progress documents and source audits. Record independent-review and truthful
verification results in the closure commit. Do not leave temporary gate language
in production comments or add these documents to the root README.
