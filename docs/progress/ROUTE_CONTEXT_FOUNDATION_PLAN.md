# Route Context and Ordinal Effects Foundation

## Status and objective

Proposed execution contract, awaiting approval and commit. Implementation has
not started. Commit the approved plan before source changes.

- Planner base: `8439c9c8cad046788680dbf981688ab263d83989`.
- Game-module base: `95c479b6c599863aeba7968f0593bb4f5871709b`.
- Baseline authored schema: 84; execution protocol: 40.
- Source/code inventory: `docs/investigations/DREAM_DIVE_SCOPE.md`, especially
  section 8. This plan is self-contained; the broader inventory is not scope.

Make route position an explicit engine authority used immediately by Underworld
and Surface. Resolve opening rewards/encounters, NPC effect variants and
completion rooms from that context. Move the first room's identity/reward setup
into Loadout without moving its acquisition out of the room timeline.

Dream exists internally as a mode applied to an explicitly supplied itinerary.
This work does not determine how that itinerary is chosen or whether its order
is legal for a playable Dream run. No public Dream authoring or publication is
enabled by this delivery.

## Governing authorities

Before engine work read `docs/design/SIMULATION_AND_VALIDATION.md` in full, then
the relevant sections of:

- `CATALOG_MODEL.md`: routes/layouts/rooms, traits and normalized declarations.
- `AUTHORED_PROJECT_MODEL.md`: route scope, loadout, fixed completion links,
  trait outcomes, reconciliation and codecs.
- `ROOM_LIFECYCLE_MODEL.md`: counter timing, opening and Boss/Postboss contacts.
- `REWARD_MODEL.md`: incoming rewards, generated pickups and NPC acquisitions.
- `CANDIDATE_EVALUATION_MODEL.md`: exact trait and reward candidate contacts.
- `STRUCTURED_EDITOR_WORKSPACE.md`: bound controls and finding destinations.
- `GAME_INTEGRATION_BOUNDARY.md`: declarative outcomes and downstream steering.

These documents describe the current system. This plan explicitly changes
fixed-order context and the named consumer contracts, not their ownership lanes.

## Locked scope and invariants

### Route position

The engine resolves mode plus a complete ordered itinerary into positions with
biome identity, one-based ordinal, previous/next, first/last, and contextual
start/completion facts. Catalog declarations own game mappings. Persisted route
input owns the chosen sequence; derived positions are not separately persisted.
Ordinary presets initialize their current fixed sequences.

The configured biome prefix remains distinct from that complete sequence.
`ConfigureRoutePrefix` retains its current expansion/shrink behavior; shrinking
authorship never changes the run's terminal biome. Preserve unique-biome
identity and existing semantic addresses. No reorder command, repeated-biome
identity redesign, registry, dependency container or catalog-per-permutation.

Internal supplied itineraries require structural integrity (known distinct
biomes and supported position bounds). Dream game-order restrictions are not
part of this foundation. Public New Project continues to offer only the two
ordinary presets. Public loading must not accidentally become an alternate
entry to unsupported Dream authoring. Enforce public admission in the
application's new/open/import/restore workflow (starting with
`apps/planner/src/workspace/projectOperations.ts` and session initialization),
not by rejecting structurally valid internal Dream inputs in the engine decoder.
Commands, structural decoding and evaluation must accept the supplied contexts
needed by production-path tests. Execution publication remains separately gated.

Use one resolved authority; do not independently recover ordinals from room
names, catalog arrays, UI order or history lengths. Actual observed history and
configured-prefix coverage are still separate products, not synonyms for route
position. Resolve source-sensitive effects from the actual predecessor's facts.

### Starting rooms

| Context                    | Reward profile          | Encounter profile                        |
| -------------------------- | ----------------------- | ---------------------------------------- |
| Ordinary first F/N opening | Existing opening reward | Existing opening combat                  |
| Ordinary later Intro       | None                    | Existing Intro encounter                 |
| Dream first Intro          | Opening reward          | Declaration-backed Dream start encounter |
| Dream later starting room  | None                    | Existing Intro; F/N use `OpeningEmpty`   |

P first uses `PIntroDreamRunEmpty`; later P retains its normal Intro behavior.
N PreHub remains a separate room. Preserve ordinary F/N entered-store-history
differences. Entry counter values must follow native creation/entry timing, not
a guessed universal `isFirst ? 0 : 1` formula.

Only the route's first room identity/reward controls move into Loadout. Keep
occurrence IDs, incoming acquisition, nested traits/Poms, encounter and room
timeline ownership intact. Opening identity/reward findings navigate to Loadout;
acquisition-child findings navigate to their Timeline repair. Existing loadout
readiness still governs opening edits despite their new visual location. Retain
later-biome entry controls and optional read-only rail summaries; remove the
duplicate first-room editor from its old location.

### NPC effects

Resolve declared modeled effects at acquisition ordinal for ordinary and Dream
modes through the same path. Do not assign artificial boon rarity to rarityless
NPC traits. Retain the acquired parameters needed by lasting effects; a later
biome does not retune an already acquired Supply Chain.

| Modeled effect                                      | Ordinal 1 / 2 / 3 / 4 |
| --------------------------------------------------- | --------------------- |
| Narcissus Pom / Max Magick / Max Life pickup counts | 1 / 1 / 2 / 4         |
| Narcissus elemental-boost pickup counts             | 2 / 2 / 3 / 4         |
| Narcissus Last Stand pickup counts                  | 1 / 1 / 2 / 3         |
| Narcissus Mystery Box                               | One at every position |
| Circe random Arcana / Fear suppression counts       | 1 / 1 / 2 / 3         |
| Circe Arcana promotion count                        | 2 / 2 / 3 / 5         |
| Icarus Ingenious Strike/Flourish levels             | 3 / 3 / 3 / 5         |
| Icarus Supply Chain interval                        | 7 / 7 / 7 / 3         |
| Icarus Latest Model targets                         | 1 / 1 / 1 / 2         |

Counts are source maxima; exhausted eligible domains and multi-selection order
must follow each native effect's rules. Do not fabricate targets to meet a count
or silently apply a generic truncation rule to all effects. Fixed incidental
pickups in mixed Narcissus rewards do not multiply unless their native field
scales. Preserve stable generated pickup identity and existing reconciliation.

Arachne/Medea combat/armor amounts and Echo's unmodeled numeric effects remain
unmodeled. Existing Echo replay semantics remain unchanged. Hades and actual
rarity-bearing Artemis/Athena/Dionysus screens are not included in this scaling.
Bridal Glow must not inherit Latest Model's new multi-target policy.

### Completion and source facts

Normal route room choices remain unchanged. Dream uses ordinal
`Dream_PostBoss01/02/03`, no fourth Postboss, with Wells, fountain and keepsake
rack but no Hermes Shrine or purging pool. Include the supporting declarations
and contextual Preboss choice (including I's alternate physical map).

Physical room-set identity and authored itinerary ownership are distinct. Allow
the exact route-resolved completion room, not arbitrary foreign rooms. Preserve
the existing Preboss → Boss → optional Postboss occurrence/link model. Rivals
uses route ordinal while normal/Rivals boss maps remain biome declarations.

Native evidence is under `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`:
`DreamRunLogic.lua`, `RoomDataDream.lua`, starting-room declarations,
`EncounterData.lua:OpeningEmpty`, `EncounterData_Opening.lua:PIntroDreamRunEmpty`,
`EventLogic.lua` NPC rarity rewrite and `TraitData_{Narcissus,Circe,Icarus}.lua`.
The six-menu native rarity rewrite is interpreted as effect scaling, not a new
authored rarity. The matured-state planner omits the Dream prologue.

## Exclusions

- Dream order selection UI, game-order restrictions or previous-run predicates.
- Public Dream project creation, import/edit workflow, publishing, executor
  startup/navigation/resync support or deployment.
- Dream shop inventories, trait/item exclusions and resource suppression.
- Boss-room Supply Chain deferral and other Dream lifecycle exceptions.
- Dream Points economy or bespoke completion system; later integration treats
  `DreamPointsDrop` as the ordinary boss-material replacement.
- Biome-local topology rewrites, generalized NPC simulation, new schedulers,
  automatic plan repair, or changing user interaction order.
- Closing unrelated plans whose live-game acceptance is still pending.

## Delivery gates and commit boundaries

Each gate is a complete consumer slice, reviewed independently before its commit.
One executor owns writes at a time; reuse it for adjacent work/remediation and
give a fresh read-only reviewer a focused packet. Main session owns commits,
scope, broad closure and finding dispositions. Internal mixed-itinerary tests
exercise production resolution; do not build a test-only second resolver.

### A — Route authority and existing chronological consumers

Implement explicit mode/full itinerary and a narrow resolved position product.
Migrate ordinary initialization, structural decoding, prefix commands, project
evaluation/replay, encounter ordinal facts, Rivals, terminal delivery and
Boss-effect checks. Keep existing ordinary execution outputs semantically
unchanged. Separate public preset selection from internal mode support.

Starting points: `catalog-schema/index.ts::RouteDeclaration`, catalog
`declarations/routes.ts`, `compiler/routes.ts`, authored `model.ts`, `defaults.ts`,
`codec.ts`, `commands/project-state.ts`, `completion-boss.ts`; simulation
`evaluation/{project,biome-evaluation}.ts`, `encounters/preparation.ts`,
`occurrence-outgoing.ts`, `history/compose.ts::initialCounters`; terminal checks
in room action domain/state, acquisition-site, occurrence codec and room-entered.

Audit source timing before changing start counter baselines. Update navigation
and prefix projections to consume route order where applicable, without adding
Dream creation. Replace Moon Beam's I/Q predecessor inference with the actual
resolved preceding Postboss and the existing physical-room effect policy.

Acceptance: ordinary full and partial routes retain behavior; all consumers
agree on ordinal; incomplete prefix is not terminal; exact replay uses the same
position as full evaluation; supplied mixed orders exercise chronology products
and migrated consumers at currently supported contacts. Do not require full
mixed-route simulation before B/C supply contextual start/completion products.
Those complete contact witnesses land in B/C, with cross-gate evaluation at
closure. Catalog/codec, completion-boss, project-evaluation,
terminal-delivery and Echo Gift tests own these policies.

Delete superseded independent ordinal/terminal calculations and adjacency
inference. Do not mechanically remove genuinely biome-specific conditions.

### B — Contextual starting-room profiles and Loadout presentation

Replace unconditional FixedIntro/FixedOpening reward assumptions with one
declaration-backed contextual resolution used by defaulting, codecs, commands,
action roster, materialization, generation, settlement and candidate products.
Supply the concrete encounter profile through the existing encounter resolver.
Move first-room identity/reward controls with their exact bindings/destinations
into Loadout; retain room-owned child editors and chronological readiness.

Starting points: catalog room declarations, `compiler/rooms/core-facts.ts`,
`declarations/lifecycles/standard.ts`; engine room-state defaults/codec,
`commands/occurrence/incoming-reward.ts`, `room-actions/lifecycle-structure.ts`,
`materialization/rooms/templates.ts`, incoming-generation and reward-producer
candidates; application `occurrence-reward-assembly.ts`,
`BiomeInspectorControls.tsx::StartRoomIdentityEditor`, `RouteOverview.tsx`,
`panelForOrigin`, finding-routing and inspector destinations.

Acceptance: all contextual profile rows above; F's three variants and fixed N;
N PreHub unaffected; ordinary reward-before-combat chronology unchanged;
reward changes/Undo retain correct children and candidates; loadout blockers
cannot be bypassed; one finding destination/inline marker path reaches each
relocated control, while trait/Pom findings still reach Timeline. Primary tests
are catalog normalization, F/N materialization/candidates, incoming commands,
readiness and focused workspace/UI witnesses.

Delete the old first-room editing mount and superseded static-only template
constraints, not the occurrence or incoming acquisition machinery.

### C — Contextual completion chains

Add the three Dream Postboss declarations and mode/position completion mapping.
Replace physical-host equality assumptions with exact resolved identity checks
in compiler, takeover, replacement, decoding, completeness and materialization.
Ordinary chains use the same resolver with unchanged identities and features.

Starting points: catalog routes/room normalization and completion declarations;
engine `commands/topology/takeover.ts::completionChainForSelection`,
`commands/topology/ordinary.ts`, `commands/room-replacement.ts`,
`topology/decoding/coordinator.ts`, completeness and biome materialization.

Acceptance: all ordinary chains; supplied Dream positions 1–3 and terminal 4;
I/Q nonterminal and another biome terminal; contextual I Preboss; exact allowed
cross-family room versus rejected arbitrary foreign room; create/remove/reselect
completion preserves existing closure and compatible state; rack/fountain/Well
leaves have ordinary authoring and candidate contacts. Cover source-declared
features only, without implying full Dream simulation support.

Primary owners: catalog room/route tests, completion-boss and topology
structure/relational/command tests, representative materialization witness.
Remove duplicated parallel-array/room-family reconstruction at migrated callers.

### D — Acquisition-ordinal NPC variants

Deliver in bounded coherent subcommits:

1. **D1: effect resolution, pickups and retained clocks.** Declaration-owned
   ordinal values feed Narcissus structural pickup producers and Icarus immediate
   levels/Supply Chain. Capture only facts needed by an acquired ongoing effect.
   Preserve the existing acquisition and timed-maturity pipelines.
2. **D2: Circe multi-outcome contracts.** Scale domains, authored payloads,
   selected settlement, joint Arcana candidates, UI and emitted outcomes together.
   Fear suppression becomes capable of multiple selections; do not introduce
   independently wired trait-specific state in every projection layer.
3. **D3: Latest Model multi-target contract.** Extend its own payload, target
   candidates, transitions, UI and publication; apply native target selection
   and exhaustion semantics without broadening other targeted traits.

Starting points: catalog NPC declarations, `catalog-schema/traits.ts`, trait
compiler constraints; `acquisition/pickup-producers.ts`, `traits/state.ts`,
`simulation/arcana-fear.ts`, trait-settlement encounter-child/coordinator,
trait offers/history transitions, candidate capability; application Circe and
selected-outcome editors/bindings; execution model/reward codecs/transactions.

Update downstream NPC decoder/steering consumers in each corresponding slice
without releasing the format: game module `src/mods/protocol/rewards.lua` and
`room/timeline/acquisitions/npc/{circe,icarus}.lua`. Native effects still own
mutation/count execution; adapters select the published targets, not recreate
NPC effects. No general Dream runtime admission is added.

Acceptance: declared ordinal matrix at its primary owner; ordinary positions
produce existing effects; exhausted and incomplete multi-target repairs remain
authorable; candidates and settlement use the same pre-effect variant; generated
entries retain stable IDs across unrelated edits; acquisition → next biome →
Supply Chain maturity retains interval/output; removing an owning selection
reconciles generated descendants; existing shared target carriers remain valid.
Representative UI, publication and Lua selector-loop witnesses cover handoffs.

Primary tests: catalog trait-dispositions, authored pickup-producers/carrier
children, Narcissus pickups, Circe/Arcana-Fear, trait-level-effects and focused
candidate suites. Reuse a small representative lifecycle fixture, not a matrix
of full-route saves. Retire literal 3-level/7-interval/single-target restrictions
where superseded; no compatibility execution path for the intermediate format.

### E — One migration, wire alignment and closure

Finalize the single authored migration and execution contract bump described
below. Regenerate only affected products, mirror them, finish independent
cross-gate review and run the complete closure checks once fixes are stable.
Audit for old order inference, UI-owned policy, duplicated resolution, retained
stale authoring, schema drift and internal Dream mode leaking into public entry.

Promote source facts to the smallest existing owning audits and update current
design sections for route input/position, contextual room products and acquired
NPC variants. Rewrite superseded explanations rather than append a fix diary.
Delete this plan at closure, recording verification in the closure commit.
The broader Dream investigation may remain only for its concrete later inventory,
authoring and lifecycle work; remove delivered foundation checklist material
after promoting its durable result. Do not retire unrelated pending live tests.

## Schema, protocol and fixture policy

The user explicitly permits locally broken intermediate commits to avoid repeated
schema/protocol migrations and fixture churn. No push, release or deployment.

- Treat all gates as one unreleased transition: authored schema 84 → 85 and,
  for the changed NPC wire payloads, protocol 40 → 41 at closure. If another
  task changes the base versions, reconcile that explicitly before implementation.
- Preserve representative baseline saves as migration inputs before evolving
  their shape. Migrate baseline directly to final: initialize ordinary full
  itinerary/mode; preserve IDs, prefix, loadout and timeline; translate old
  singleton payloads without inventing choices. Retain existing older migrations.
- Do not write migrations between temporary gate shapes or production dual-read
  fallbacks. Saves produced by intermediate code are disposable, not supported
  migration sources. Keep automatic fixture refreshes bounded or deferred.
- Focused tests use the evolving model. Record each known stale fixture/format
  failure by name and cause in gate handoffs; allowance for stale products is
  not permission to ignore behavioral failures or unrelated build breakage.
- At closure finalize both codecs, regenerate affected execution fixtures using
  the planner builder and `encodeExecutionPlan`, then repository Prettier JSON
  formatting with trailing newline. Mirror planner products byte-for-byte to
  the game module and verify with `cmp`. Inspect numstat and representative diffs.
- No wholesale fixture rebuild if semantics did not change; version-only fields
  use bounded mechanical edits. Ensure normal-route publication and module
  decoding/steering agree before declaring the phase closed.

## Review and verification

Review this plan adversarially before implementation. Per gate, use the narrow
owning catalog/engine/planner/UI/contract/product tests. Main session supplies
bounded executor packets with exact owners, files, exclusions and deletions;
fresh reviewers inspect the stabilized gate, followed by bounded remediation.

At closure run `npm run test` and `npm run check`, plus the game module's required
checks for changed consumers under its own AGENTS guidance. Use the established
same-host performance comparison when evaluating broad evaluation-path changes;
do not change watchdogs or invent local timing budgets. Record truthful results,
including any remaining manual checks. Automated supplied-itinerary witnesses
prove this foundation, not completed Dream gameplay. Full Dream in-game testing
belongs to the later end-to-end feature delivery.

Plan review completed before handoff: clarified engine structural acceptance
versus public application admission, and bounded Gate A's supplied-itinerary
witnesses so they do not depend on B/C products. No unresolved review blocker.
