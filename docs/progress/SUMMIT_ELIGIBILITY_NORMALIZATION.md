# Summit eligibility normalization

Status: locked after read-only implementation inventory and independent challenge.
Base: `e6ec8b5c`. One delivery gate; no save migration or protocol change.

## Outcome and evidence

Q ordinary rooms use exact `biomeDepthCache` eligibility and the common room
selection/replacement workflow. Q_PreBoss01 keeps its forced depth-7 atomic
width-one takeover. Remove the redundant generated stage model, preserving N's
bounded Hub entry and every physical door, reward, cap, source clock and fixed
completion link.

Native RoomDataQ.lua names ForceAtBiomeDepth for fork/miniboss groups.
RunLogic.lua:953 also rejects those rooms outside the exact depth; :906 separately
supplies force priority. Normalization preserves supported Q routes while
intentionally removing ordinary force-pressure presentation. The existing stage
list currently masks broad room eligibility and excludes fixed bosses.

Exact normalized domains:

- 1: Q_Combat10/11.
- 2: Q_Combat03/05/15.
- 3: Q_MiniBoss02/05.
- 4: Q_Combat01/02/04/06/07/08/09/16.
- 5: Q_Combat12/13/14.
- 6: Q_MiniBoss03/04.
- 7: no ordinary support; required Q_PreBoss01 takeover.

The fixed Intro remains fixed and its inert declaration force need not change.

## Ownership and boundaries

Catalog owns explicit per-room depth predicates, layout normalization and
relational closure. Generated progression is eligibility-driven; separately
retain the staged bounded Hub-entry contract. Delete Q's stage list and generated
staged compiler path, preserving shared runtime branches still used by N.

Engine owns ordinary candidate support, representability, validation and repair.
Exclude Boss/PostBoss from generic ordinary candidates, matching existing
structural command ownership. This can correct diagnostic support in other
biomes; inspect equivalence changes instead of assuming Q-only hashes.

Wrong-depth ordinary Q choices remain structurally representable and receive
reached eligibility findings. Commands/codec no longer reject them solely by Q
stage. Keep start, room-kind, physical-key, capacity and atomic takeover guards.
Valid existing saves remain valid without version changes. Application consumes
engine candidates; no Q-specific UI policy or hidden repair is permitted.

Catalog width closure currently depends on Q's last stage. Replace that inference
with conservative declaration-based source exclusion: only direct source and
Preboss biomeDepthCache ranges can prove disjointness after shifting the source
range by a proven uniform predecessor commit increment. Outgoing generation
precedes the current room commit, so its own increment is not that shift. Prove
uniformity across possible ordinary/start predecessors; unknown or nonuniform
increments, unknown predicates and fixed starts remain conservatively admitted. Use this proof only where declared direct progression has no intervening
detour/restore path; otherwise keep the conservative source set. Do not introduce
another room-group list, Q-name branch, or general symbolic evaluator. Preserve
`remainingOffers: none` width-one validation and its counted counterpart.

## Delivery packet

One sole write-capable executor owns catalog, engine, focused tests, representative
application witness and owning documents. Other agents are read-only. Main owns
plan, Git, review dispositions, complete checks and retirement.

Starting seams:

- packages/hades2-catalog/src/declarations/{rooms,layouts}/q.ts.
- packages/hades2-catalog/src/compiler/layouts/generated-progression.ts and
  compiler/rooms/layout-closure.ts.
- packages/planner-engine/src/catalog-schema/index.ts and authored topology
  query/decoding, commands/room-replacement.ts.
- packages/planner-engine/src/simulation/generation/target-policy.ts and reward
  layout assumptions that currently couple standard no-store behavior to staging.
- Existing Q simulation, catalog layout/room/relational, topology/replacement and
  application room-picker tests.

Authorities: full SIMULATION_AND_VALIDATION.md; CATALOG_MODEL.md layout and
normalization; Q_GAME_RULES.md; GAME_GENERATION_RULES.md candidate/door, ordinary
progression and shared takeover support; AUTHORED_PROJECT_MODEL.md representable
invalid states, replacement and topology; EDITOR_MODEL.md projection ownership.

## Acceptance and primary test ownership

Catalog owns the complete depth/group matrix and ordinary force absence. Assert
retained Preboss force and unchanged N bounded entry. Width mutation tests must
reject a two-door Q source moved to depth 6, and reject unproven width-one
closure after a predecessor increment mutation breaks uniformity. Retain
conservative handling for unproven predicates/paths.

Engine owns exact support through all six established pools, absent ordinary
force evidence, depth-7 required takeover from an empty envelope, both fixed
bosses excluded, and stable execution of valid Q routes. Replacement/codec tests
must preserve wrong-depth authored state and expose exact eligibility repair,
including retained suffixes; do not recreate stage rejection under a new name.
Keep shared N and ordinary Preboss behavior covered.

One application witness shows common candidate/repair behavior without a parallel
Q policy. No exhaustive matrix duplication in React tests.

Baseline equivalence:149 passed. Before-change full products copied to
/tmp/summit-equivalence-before-products. After implementation, inspect changed
simulation/candidate fields and verify all encoded execution hashes unchanged.
Only then refresh intended equivalence digests; do not regenerate execution JSON
fixtures or hide unexplained differences. Main owns one full npm run check after
narrow tests and independent review; use focused remediation if it reveals a
failure rather than repeating unrelated successful gates.

## Closure

A fresh independent reviewer checks the stabilized vertical slice. One bounded
remediation pass follows. Update the smallest owning stable documents, including
Q rules and their native-normalization explanation; remove obsolete generated
stage claims and no-store coupling. Keep native source facts distinct from
planner simplification. Delete this completed plan in the closure commit and
record truthful verification in commit history. Preserve the unrelated untracked
BOSS_OPENING_MOVES.md investigation.
