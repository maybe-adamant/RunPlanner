# Run-start reward ownership

Status: Gates A and B implemented and independently reviewed; Gate C pending.
Base: `92697cdd`.

## Objective

Author the starting reward in Loadout before selecting an entry-room variant.
Select a multi-choice entry room in its biome Overview at every route ordinal.
Single-choice entries remain automatic. Resolve the starting reward into the
first entry occurrence without changing acquisition timing or execution output.

This is an ownership correction, not a second reward system or a presentation-only
move. Public Dream creation remains out of scope; internal itinerary witnesses
exercise the same contract across all biome starts.

## Established facts and decisions

- Entry variants share the starting reward domain. Current F and intro-first
  declarations repeat the RunProgress binding and its exclusions.
- Today `RouteLoadout` has no reward. `AuthoredRewardState` combines its offer,
  acquisition dispositions, trait offers and level resolutions on the occurrence.
  An unset multi-choice start has null topology, so it cannot store that reward.
- `resolveStartingRoomDeclaration` currently switches reward binding, template,
  lifecycle and entered-store history as well as Dream encounter overrides.
  Retire the whole first/later profile structure, not just its reward fields.
  Preserve its effects through the shared entry resolution described below.
- Run start will own one reward-domain declaration and one persisted reward
  choice. Entry declarations themselves have no intrinsic incoming reward.
  They retain only their source-backed entered-store participation policy: N
  records none; F and the other first intros record the resolved run-start offer.
- Only the route's first entry realizes that choice. Later entries remain
  rewardless. Full itinerary position, not biome name or configured-prefix end,
  determines first entry.
- Acquisition stays in the first room: dispositions, trait/level outcomes,
  actions, candidate context and effects do not move into Loadout.
- Export continues to describe the same resolved incoming reward, room actions,
  transactions and conformance. No game-module behavior or protocol change is
  planned; equivalence is an acceptance requirement, not an assumption.

## Ownership and implementation boundaries

### Catalog

Declare the starting reward binding once in the run-start catalog neighborhood,
using existing reward binding/store contracts. It owns the RunProgress store
selection and domain filters. Entry rooms declare no intrinsic incoming reward
or store identity, while retaining their narrow source-backed entered-store
participation policy (`resolvedOffer` for F and other first intros; `none` for
N). Remove `StartingRoomProfile`, `StartingRoomProfiles`, their raw
counterparts, normalization and all per-room first/later profiles. Normalize
the run-start declaration once.

Retain only genuine contextual encounter differences as narrow encounter-owned
declarations, resolved using route mode and position:

| Entry        | Contextual encounter rule                                                                     |
| ------------ | --------------------------------------------------------------------------------------------- |
| F/N          | Dream uses `OpeningEmpty` at every ordinal; otherwise retain the normal opening encounter     |
| P            | Dream-first uses `PIntroDreamRunEmpty`; otherwise retain the normal entry encounter selection |
| Other intros | Retain their empty encounter envelopes                                                        |

These are source-backed rules to encode in declarations, not biome-name branches
in consumers. Do not replace the removed profiles with another full room override
object or a generic contextual patch framework.

### Shared entry resolution

One engine authority composes the rewardless entry declaration, contextual
encounter resolution and route-first starting reward binding into the complete
resolved entry product consumed by commands, decoding, materialization, history
and candidates. Replace the current profile resolver and migrate its consumers
together; no old/new parallel resolution paths.

| Retired profile field         | Replacement authority                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `incomingReward`              | Single run-start declaration, bound only to the first entry                                                                      |
| `forcedRewardStoreKey`        | Run-start reward declaration                                                                                                     |
| `enteredRewardStoreHistory`   | Entry declaration's participation policy, resolved from the run-start binding only at the first entry; none for later entries    |
| `templateKey`                 | Entry materialization composes the route offer with occurrence acquisition payload; no first/later persisted reward-state switch |
| `lifecycleProfileKey`         | Central selection from resolved encounter envelope and route-first reward binding                                                |
| `dreamEncounterDefinitionKey` | Narrow contextual encounter declarations above                                                                                   |

Reuse the existing lifecycle definitions. For an entry with a single encounter,
the starting reward uses `OpeningRewardRoom`; a later rewardless entry uses
`RewardlessCombatRoom`. Empty envelopes use `OpeningRewardNoEncounterRoom` or
`RewardlessRoom`, respectively. The reward-bearing forms add the pickup point
after entry and before encounter execution, where an encounter exists. Preserve
that order, counter effects and entered-store history. A required but unauthored
starting reward is incomplete, not a reason to select a rewardless lifecycle.

No general lifecycle composition engine is needed. Retain existing lifecycle
declarations while deriving their selection once, rather than repeating their
keys in every entry's first/later profile.

Do not equate a rewardless declaration with an encounterless room. Do not move
game reward filters or store selection into React, or create per-biome copies of
the common run-start domain.

### Authored engine

Persist a nullable run-start reward offer on route-start configuration, independent
of topology. Keep its acquisition payload on the receiving occurrence, without
a second persisted offer. Reuse existing acquisition payload shapes; do not
split every ordinary reward in the model merely to support this one binding.

Introduce the narrow semantic owner and command for selecting/replacing the
starting offer. Commands validate its declaration-owned domain without requiring
an entry occurrence. When an entry exists, reconcile the corresponding acquisition
payload and required action atomically through existing authorities.

Creating the entry binds the retained choice and initializes its acquisition
payload. Replacing the variant preserves compatible payload and occurrence
identity using existing replacement policy. Clearing topology discards that
room's payload/actions but preserves the route-owned choice; recreating the room
initializes fresh payload. Configuring zero biomes retains the route choice and
does not manufacture an occurrence. Undo restores each edit as one snapshot.

Use one explicit resolved binding for downstream consumers. Materialization may
compose the route offer with room payload into the existing resolved reward
product; it must not write a copy back into persisted room state. Commands,
decoding and candidates must consume the same ownership rule, not reverse-engineer
the first-room offer from UI state or special-case F.

### Simulation, candidates and findings

Resolve the starting offer's domain and generation context from run-start catalog
and loadout inputs without requiring a chosen variant. Acquisition candidates
continue to use the exact room lifecycle contact. Selecting the starting offer
does not acquire it or advance bags, god pools, elements or counters in Loadout.
Realization preserves existing offer/store history and acquisition order exactly.

Missing starting reward belongs to Loadout. Missing entry identity belongs to
biome Overview. Missing trait/target/disposition detail belongs to the room
Timeline. Preserve existing readiness boundaries: unresolved room acquisition
must not become a route-loadout blocker merely because its source moved.
Reward and identity must both be repairable without a dependency cycle, including
when both are unset. No fabricated room or candidate-only simulation.

### Application

Loadout shows Starting reward, with no starting-room variant control. Biome
Overview owns multi-choice entry selection and replacement at every ordinal.
Fixed entries remain automatic. First-room Timeline retains acquisition
disposition, trait and level interactions; it derives the source from the route
binding, with no second offer selector.
Finding navigation and inline highlighting share exact destinations.

### Migration and delivery

Use one authored-schema bump for the new persisted ownership. Migrate the old
first occurrence's offer to run start and retain its acquisition payload, IDs,
actions and downstream state. Missing/null starts migrate to an unset choice;
do not invent a reward. Later entries are not sources for migration.
Follow existing schema migration tooling and fixtures rather than adding runtime
legacy decoding. No execution protocol bump for an unchanged wire contract.

## Starting source packet

- Catalog declarations: `packages/hades2-catalog/src/declarations/rooms/f.ts`,
  `n/fixed.ts`, and `g.ts` through `q.ts`; compiler
  `rooms/starting-room-facts.ts`, `normalize-room.ts`, and `lifecycles.ts`;
  raw room types and `declarations/lifecycles/standard.ts`.
- Engine: `src/catalog-schema/index.ts`; authored `model.ts`,
  `room-state/starting-room-profile.ts`, `topology/construction.ts`,
  `commands/occurrence/incoming-reward.ts`, `commands/acquisition/reward-source.ts`,
  `commands/project-state.ts`, defaults, codecs and ordered reconciliation.
- Simulation: `materialization/rooms/templates.ts`, existing incoming-reward
  producer/materialization consumers, `candidates/start-room.ts`, reward
  candidates and progressive semantic chronology.
- App: `ui/shell/RouteOverview.tsx`, `RouteWorkspace.tsx`,
  `ui/editor/biome/BiomeEntryPicker.tsx`, `BiomeInspectorControls.tsx`,
  `BiomeInspectorNode.tsx`, and structured-workspace start/reward interaction
  assembly and finding destinations.
- Migration: `schema/migrate-project-84-to-85.*` as the current tooling example;
  do not overwrite historical migrations.

Before implementation, read `SIMULATION_AND_VALIDATION.md` in full and the
relevant sections of `AUTHORED_PROJECT_MODEL.md` (Route Scope, Starts,
Occurrence State, Addresses, Ordered reconciliation), `REWARD_MODEL.md`
(Producer Bindings, Offer and Acquisition), and the candidate/lifecycle
authorities for touched contacts. Paths above are entry points, not permission
for broad unrelated refactors.

## Delivery gates and intended commits

### A — Authoritative ownership and migration

Implement catalog binding, route choice, room payload binding, commands, codec,
migration, materialization, candidates and finding chronology as one coherent
engine slice. Retire the full profile structure and replace its resolver with
the shared entry resolution, including narrow contextual encounter rules and
derived lifecycle/store-history selection. Adapt the existing app consumer sufficiently to build and retain
current workflows; do not leave a production compatibility copy for Gate B.
Primary tests belong to catalog/engine/migration owners.

Acceptance:

- Set reward with F topology absent; create each variant and realize it once.
- Select/change the reward with zero configured biomes, expand the prefix and
  verify exactly one first-room realization.
- Change variant without losing compatible trait outcomes or resetting the offer.
- Replace reward, clear/recreate entry, shrink/re-expand prefix and Undo without
  duplicate actions, stale acquisition children or lost route choice.
- Underworld/Surface and internal Dream first/later entry matrix preserves
  encounter, store, offer and acquisition chronology. Dream F/N stay OpeningEmpty;
  Dream-first P uses PIntroDreamRunEmpty while later P retains normal selection.
- Reward-bearing single/empty-envelope entries retain their exact pickup contact;
  missing starting authorship stays incomplete rather than becoming rewardless.
- No first/later room profile declarations, types, normalizer or parallel resolver
  remain. Entry declarations are intrinsically rewardless, with no duplicated
  starting domain or reward-driven persisted room-state switch.
- Migration retains a fully authored boon/hammer payload, an incomplete payload,
  and null/unconfigured starts; current decoder rejects duplicate ownership.
- Capture equivalent old/new execution products from representative complete
  plans. Compare full wire products and relevant history, not just reward labels.

### B — Consistent authoring and repair

Move identity controls to biome Overview, expose the independent starting reward
in Loadout, and update exact bindings, focus destinations and readiness consumers.
Remove the superseded first-entry identity presentation path.

Representative application/product witnesses:

- Choose starting reward before F variant, then choose a variant in Overview,
  author its trait in Timeline, replace the variant and Undo.
- Starting reward remains editable with entry unset; missing identity points to
  Overview; missing trait points to Timeline, not Loadout.
- Fixed N entry and a later internal Dream F entry use the same policy without
  new start buttons or F branches. Existing loadout incompleteness remains gated.
- No duplicated editable reward, no temporary UI reward draft as domain storage,
  and no opening reward in later entries.

### C — Closure

Fresh independent review of ownership, chronology, migration, deletion and wire
equivalence after implementation stabilizes. Main session runs one complete
`npm run check` after narrow lanes and remediation. Do not regenerate unrelated
execution fixtures; changed products follow repository formatting/mirroring policy.
If any wire difference is necessary, stop and amend scope before game-module work.

Update the owning authored/reward design explanations, including stale claims
about null initialization or first-room identity in Loadout. Delete this plan at
closure. Leave unrelated pending plans and manual game-test obligations alone.

## Audit-againsts and non-goals

- No duplicate route/room offer ownership, hidden sidecar or fake opening variant.
- No new reward scheduler, acquisition system or generalized DI/producer registry.
- No replacement room-profile wrapper, generic contextual override framework or
  lifecycle-composition machinery; keep the genuine encounter rules explicit.
- No early acquisition in Loadout; no loss of source history or lifecycle timing.
- No public Dream creation, itinerary editing, NPC scaling or postboss redesign.
- No hard-coded F behavior, unrelated UI polish or executor changes.
- Keep occurrence acquisition repairs available; do not gate them behind their
  own missing child findings through the new route owner.
- Defaults must not silently choose an F variant or an unauthored reward.

Gate executors receive bounded ownership packets. Use one writer at a time and
reuse it for remediation. Independent review must challenge the shared binding
and first-room export equivalence, not merely count passing synthetic tests.

## Delivery evidence

The execution contract was committed as `e43bf14f`. Implementation remains
uncommitted for inspection. Gate A review findings were remediated and independently
verified; the independent Gate B review reported no additional findings. The final
rail preview uses the composed acquisition source without restoring an editable
room-owned reward.

Focused verification passed:

- Execution compiler: 71 tests, including all 11 unchanged byte-stable wire products.
- Starting-reward command/candidate/ownership witnesses: 7 tests.
- Contextual entry resolution: 7 tests.
- Migration aggregate: 39 tests; authored checkpoint integrity: 22 tests.
- Repository typechecks and changed-file lint/formatting.
- App contract and focused Loadout/identity UI: 48 tests, plus the positive
  reward-before-room and Undo workflow.
- Final BiomeWorkspace and structured workspace contract run: 68 tests.

Gate C still owns the complete repository check, durable document updates and
retirement of this plan. No execution fixtures or game-module files were changed.
