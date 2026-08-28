# Boss and Postboss Topology Correction Plan

## Status

- **State:** locked for implementation; Gate A has not started
- **Base commit:** `6986256c8acd65df7d5788a3c9a7dd4a8a2e766c`
- **Current persistence boundary:** schema 67
- **Current catalog boundary:** `0.48.0-hex-talent-layouts`
- **Planned boundaries:** schema 68 and `0.49.0-completion-topology`

This is a temporary execution contract. It is not a durable design authority
and must be deleted during closure after its lasting decisions have been
absorbed by the owning design, biome, audit, and progress documents.

## Objective

Make Boss and modeled Postboss rooms ordinary authored `RoomOccurrence`s inside
the biome topology. Selecting a Preboss atomically creates the declaration-fixed
Boss, the run-type-and-position-fixed Postboss when one exists, and the fixed
room links between them. Everything after creation uses the same occurrence,
room-action, lifecycle, history, finding, candidate, source-index, and editor
paths as other rooms.

The user-visible outcomes are:

- Boss and Postboss rooms do not appear on the rail before a Preboss is selected;
- after Preboss selection, the exact reached Boss and optional Postboss appear in
  completion order and retain their current rail presentation;
- Boss and Postboss identity and links are fixed and have no authoring controls;
- Postboss timelines, fountains, Keepsake Racks, Pools, Wells, Shrines, traits,
  deliveries, findings, and reordering behave like occurrence-owned features in
  any other room; and
- the Aromatic Phial class of failure cannot recur because a Postboss finding is
  located through an ordinary topology occurrence rather than a parallel
  automatic-room region.

## Settled Source Facts

No new source audit is required. The game-data probe resolved the only open
modeling question, and the implementation plan records the evidence it depends
on:

1. `GameData.FullRunBiomeCount = 4`
   (`../../1GameData/Scripts/NarrativeData.lua:9077`). `EnteredBiomes` advances
   when a biome start room is entered
   (`../../1GameData/Scripts/RoomLogic.lua:1280-1283`).
2. A Dream Boss with `CanSpawnDreamReward` offers `DreamPointsDrop`
   (`../../1GameData/Scripts/RewardLogic.lua:61-73`). After that required pickup,
   `CheckDreamBiomeCompletion` runs before ordinary exit handling. At ordinal
   four it ends the run; otherwise it enters
   `RoomSets.Dream[EnteredBiomes + 1]`
   (`../../1GameData/Scripts/DreamRunLogic.lua:63-83`).
3. The Dream table is an exact ordinal mapping:
   `Dream_PostBoss01`, `Dream_PostBoss02`, `Dream_PostBoss03`
   (`../../1GameData/Scripts/RoomSets.lua:378-384`). It is not a lookup by the
   biome just completed.
4. Standard Underworld and Surface order is fixed. The first three positions use
   their ordinary inter-biome Postboss rooms. The fourth position has no
   **modeled recovery Postboss**.
5. `I_PostBoss01` and `Q_PostBoss01` are real physical ending-sequence rooms in
   standard runs. They are narrative/meta-progression continuations rather than
   the ordinary fountain/rack/shop recovery frontier. This plan continues to
   omit those terminal sequences from the supported planner topology; `none` at
   position four is therefore a deliberate planner disposition, not a claim
   that the game enters no physical room.
6. Boss identity does not vary between standard and Dream runs. Only the
   Postboss continuation changes.

The game performs Dream replacement after the Boss reward pickup. The planner
may materialize the fixed room chain when Preboss is selected because the
authored run type and biome ordinal already determine the exact resulting room.
This is an earlier representation of a fixed outcome, not a different outcome.

## Locked Modeling Decisions

### Exact route-position declaration data

The normalized route contract gains one array aligned one-to-one with
`biomeKeys`:

```ts
interface RouteDeclaration {
  key: string;
  label: string;
  biomeKeys: readonly string[];
  postbossRoomGameNames: readonly (string | null)[];
}
```

Current declarations are exact:

```text
Underworld: [F_PostBoss01, G_PostBoss01, H_PostBoss01, null]
Surface:    [N_PostBoss01, O_PostBoss01, P_PostBoss01, null]
```

The catalog compiler requires the array to match route length, requires each
nonterminal entry to resolve to a supported `PostBoss` room declaration, and
requires the terminal entry to be `null`. A future Dream route will declare:

```text
[Dream_PostBoss01, Dream_PostBoss02, Dream_PostBoss03, null]
```

This plan does not add that route or those declarations. The engine consumes
only the exact normalized room name or `null`; it receives no `IsDreamRun`,
`biomeDefault`, resolver callback, Postboss family, or fallback policy.

### Biome-owned Boss; route-owned Postboss

Each biome layout retains exactly one Boss room declaration and its transition
counter effects. The layout no longer declares a Postboss tail. Conceptually:

```ts
interface BiomeCompletionDescriptor {
  bossRoomGameName: string;
  transitionEffects: readonly BiomeTransitionCounterReset[];
}
```

The route position supplies the Postboss room name. The current supported
catalog removes `I_PostBoss01` because its terminal meta-progression sequence is
outside the modeled topology, just as `Q_PostBoss01` is already omitted.

### One narrow fixed-link topology relation

`BiomeTopology` gains one closed, intra-biome relation:

```ts
interface FixedRoomLink {
  sourceOccurrenceId: OccurrenceId;
  targetOccurrenceId: OccurrenceId;
}

interface BiomeTopology {
  startOccurrenceId: OccurrenceId;
  occurrences: readonly RoomOccurrence[];
  decisions: readonly NextRoomDecision[];
  fixedRoomLinks: readonly FixedRoomLink[];
}
```

A fixed room link is not an `ExitDecision`: it owns no reward store, reward bag,
generation, candidate picker, selected-exit state, or player-authored payload.
It is also not a revival of the old generic continuation model. It has only an
exact occurrence source and target and is used by declaration-fixed physical
room transitions.

The links persisted inside one biome are:

```text
selected Preboss -> Boss
Boss -> Postboss                 when the route-position entry is non-null
```

The last modeled occurrence's transition to the next configured biome or route
boundary remains a derived route-composition fact. It is not persisted as a
cross-biome occurrence link because the next biome may still have
`topology: null`.

### Atomic creation and deletion

Offering or creating an unpicked Preboss target creates only that Preboss
occurrence. It does not create a speculative Boss or Postboss chain. The
semantic command that commits the Preboss as the selected/entered continuation
is the only operation that creates the fixed completion chain. This covers an
ordinary selected peer such as I, an atomic takeover Preboss, and N's completed-
Hub handoff without giving their different authoring surfaces different
completion semantics.

That selection command atomically:

1. resolves the biome's Boss declaration;
2. resolves the route-position Postboss room name or `null`;
3. creates ordinary occurrences with complete declaration-owned defaults; and
4. creates the exact fixed room links.

The command derives fixed occurrence IDs from the selected Preboss occurrence
ID and role. React and application projections do not allocate hidden Boss or
Postboss IDs. The strict codec verifies the derived identities and exact chain.

Removing, replacing, or deselecting the selected Preboss removes its Boss,
optional Postboss, fixed links, and occurrence-owned descendants atomically.
Selecting another Preboss creates a fresh chain for that owner. Undo restores
the exact removed chain and all of its local state.

No command allows authors to add, remove, redirect, or replace an individual
fixed room link, Boss identity, or Postboss identity.

### Ordinary room declarations and lifecycle

Boss and Postboss declarations become ordinary occurrence templates. Add
`Boss` and `PostBoss` to the authored room-template domain and retire
`RoomMode.kind === 'automatic'` and its role discriminator. Candidate policy
continues to exclude these declarations from ordinary room pickers; only the
Preboss-selection closure creates them.

Boss and Postboss lifecycle profile selection comes from their normal room
template/declaration facts. Judgment, Crystal Figurine, encounter selection,
Steady Growth, delayed deliveries, and other Boss consumers use room kind and
lifecycle events rather than `automatic` mode checks. Postboss room actions and
features use the same occurrence-owned domains as Reprieve, Shop, Fields, Hub
side rooms, and other ordinary occurrences.

### One canonical progression sequence

Materialization walks selected `ExitDecision`s, Hub steps, and fixed room links
as one ordered progression. Its canonical product uses one chronological step
sequence containing batches, Hub decisions, and fixed room links. It does not
publish a separate `automaticRooms` array.

The history composer consumes that same sequence. A fixed link completes its
source room lifecycle, creates and enters its target, and then continues. The
last modeled room completes before biome transition effects. The selected
Preboss-to-Boss link preserves the target declaration's existing entered-store
policy, including resolved-store inheritance for G/O/P and fixed-store behavior
where declared.

Materialized prefixes use the same steps. A reached Boss/Postboss is therefore
an ordinary assessed occurrence region, so progressive candidates and findings
require no completion-only ancestry or location exceptions.

### Presentation-only completion grouping

The application may retain `completionOutline` as a presentation product, but
it derives that list by walking the realized fixed links after the selected
Preboss. It is never sourced from a second authored container.

The rail behavior is:

- no selected Preboss: no Boss or Postboss cards;
- selected nonterminal Preboss: Boss then Postboss cards;
- selected I/Q terminal Preboss: Boss only;
- deleting the selected Preboss removes the cards; and
- undo restores them with their prior occurrence-local state.

Outgoing labels derive from the engine's fixed-link/route-boundary status. The
UI renders the link but exposes no room, reward, or link authoring control.

## Current-State Inventory and Required Deletions

The live implementation splits completion authority across all three lanes:

- `BiomeLayout.completion.rooms` carries Boss and optional Postboss;
- every configured biome eagerly creates `completionOccurrences`, even with
  `topology: null`;
- the strict codec has a dedicated completion-occurrence decoder;
- materialization publishes `automaticRooms` after a target marked
  `startsCompletion`;
- history appends the tail through `appendAutomaticTail`;
- progressive finding location contains completion-only ownership exceptions;
- the application source index has an `automaticRooms` overlay; and
- workspace assembly projects `completionOutline` unconditionally, causing the
  premature rail cards.

Completion requires deletion, not aliases. The final production diff must
remove:

- `AuthoredBiomePlan.completionOccurrences`;
- `completion-occurrences.ts` and `createDefaultCompletionOccurrences`;
- the dedicated completion-occurrence codec path;
- `CanonicalTargetContinuation.startsCompletion`;
- canonical/prefix `automaticRooms`;
- `automaticTailForSelectedPreboss` and `appendAutomaticTail`;
- `RoomMode` and `AuthoredRoomRole` automatic variants;
- completion-only candidate, command, source-index, coverage, and progressive
  unions/exceptions;
- application `fixedAutomatic` vocabulary; and
- unconditional completion-outline construction.

No compatibility property, forwarding adapter, shadow completion list, or
second occurrence lookup may remain after Gate A.

## Persistence and Migration

Schema 68 adds `topology.fixedRoomLinks` and removes
`AuthoredBiomePlan.completionOccurrences`. The strict decoder accepts only
schema 68. Catalog version `0.49.0-completion-topology` carries the route tables,
Boss/Postboss template correction, and I terminal-room disposition.

The schema-67-to-68 migration performs a structural selected-spine walk for
each biome:

- when the selected spine reaches a Preboss, move the old Boss occurrence and
  the route-position-valid Postboss occurrence into `topology.occurrences`,
  preserve their complete local state, and add the exact fixed room links;
- at I/Q position four, preserve the Boss and retire the old terminal Postboss;
- when no selected Preboss is reached, remove the old dormant completion
  occurrences rather than preserving an unreachable draft container; and
- add an empty `fixedRoomLinks` array to topology that has no realized chain.

The migration reports counts for moved Boss occurrences, moved Postboss
occurrences, added fixed links, retired terminal Postboss occurrences, and
retired dormant completion occurrences. A migration mutation test must prove
that reached Pool, Well/Shrine, fountain, Keepsake Rack, Arcana, encounter, and
room-action state survives byte-for-byte at its semantic leaves.

Retiring an unreachable dormant completion draft is intentional. Preserving it
would require the exact parallel state container this correction removes. The
plan does not add a compatibility stash or hidden future-room draft.

## Ownership

### Hades II catalog

Owns:

- exact Underworld and Surface Postboss arrays;
- exact per-biome Boss room names;
- Boss/Postboss ordinary room-template declarations;
- compiler validation of route alignment, terminal `null`, room existence,
  room kind, lifecycle bindings, and catalog closure; and
- the catalog version bump and declaration regression matrix.

It does not own authored chain creation, selected-spine traversal, migration,
or UI grouping.

### Planner engine

Owns:

- schema 68, fixed room links, strict relational decoding, and semantic
  commands;
- atomic Preboss-chain creation/removal and topology closure;
- canonical fixed-link materialization, prefix coverage, lifecycle/history,
  candidates, findings, and occurrence outgoing status;
- route-position lookup against the exact normalized catalog array; and
- the schema migration and engine-owned tests.

It does not expose picker sections, rail positions, or React focus policy.

### Planner application and React

Owns:

- adapting generic topology occurrences and fixed-link status into the
  completion rail group;
- normal occurrence inspectors/timelines for Boss and Postboss;
- fixed outgoing labels and focus destinations; and
- product witnesses for creation, deletion, undo, navigation, and Phial repair.

It does not reconstruct the route table, infer completion rooms from game
names, allocate completion IDs, or repair fixed links.

## Delivery Gates

### Gate A — Complete production model correction

**Commit boundary:** one coherent refactor commit across catalog, engine, and
application. This is intentionally one production gate: splitting the
persisted model from canonical traversal or application sourcing would require
the shadow/compatibility paths this plan prohibits.

Deliverables:

1. Add and validate the exact route-position Postboss arrays.
2. Reduce biome completion declarations to Boss plus transition effects.
3. Convert Boss/Postboss to ordinary templates and remove automatic room mode.
4. Add schema-68 fixed room links, strict codec rules, migration, deterministic
   fixed occurrence identities, and atomic command closure.
5. Replace completion-tail materialization/history with one generic progression
   sequence and generic fixed-link traversal.
6. Move every Boss/Postboss command, candidate, room-action, feature, finding,
   coverage, and source lookup to ordinary topology occurrence ownership.
7. Derive the application completion grouping from realized topology and remove
   premature rail cards.
8. Delete every superseded production path named in the deletion inventory.

Primary tests and representative witnesses:

- catalog route/layout/regression tests own the exact mapping and mutation
  matrix;
- authored codec, relational topology, topology command, project-state, room
  action, Keepsake, Pool, Well/Shrine, fountain, and Arcana tests own persisted
  shape and atomic closure;
- F, G, I, N, O, P, and Q materialization/history tests own nonterminal,
  terminal, Hub handoff, store inheritance, and transition ordering;
- progressive assembly/finding and Aromatic Phial tests own generic occurrence
  ancestry;
- structured workspace source-index, semantic assembly, contract,
  `BiomeWorkspace`, inspector, and application-interaction tests own rail and
  navigation behavior; and
- migration tests own schema-67 preservation and deliberate dormant-tail
  retirement.

Required representative cases:

1. A new or incomplete biome with no selected Preboss contains and renders no
   Boss/Postboss occurrence.
2. Selecting F and N Prebosses creates `Preboss -> Boss -> Postboss`; selecting
   I and Q Prebosses creates `Preboss -> Boss` only.
3. F/G/H/N/O/P use the exact route-position room, including when the configured
   project prefix ends at that nonterminal route position.
4. Removing or switching the selected Preboss deletes/recreates the exact chain;
   undo restores occurrence-local state.
5. Boss and Postboss cannot be selected from an ordinary room picker, replaced,
   or individually unlinked.
6. G/O/P Boss entered-store inheritance remains unchanged.
7. N's completed-Hub handoff creates the same ordinary Boss/Postboss chain as an
   ordinary selected Preboss.
8. Judgment, Crystal Figurine, Steady Growth, delayed delivery, encounter
   counters, and transition resets retain their current event ordering.
9. Postboss Fountain, Aromatic Phial, Keepsake Rack, Pool, Well, Shrine, and
   trait findings resolve through the generic occurrence region and remain
   reorderable where their lifecycle permits.
10. The rail shows completion rooms only after selection and its outgoing labels
    resolve Boss, Postboss, next configured biome, and route boundary correctly.

Gate validation uses focused owning-lane Vitest files plus `npm run typecheck`,
`npm run lint`, `npm run format:check`, and `git diff --check`. Do not run the
complete correctness lane yet.

### Gate B — Saved-state and documentation closure

**Commit boundary:** one closure commit after Gate A review findings are stable.

Deliverables:

1. Canonically migrate all checkpoint fixtures and their manifest to schema 68
   and the new catalog version; do not add fixture hashes or compatibility
   wrappers.
2. Add/retain the smallest checkpoint witnesses for a nonterminal Postboss
   feature lane and a terminal I/Q Boss-only lane. Existing fixtures should be
   reused when they already prove the case.
3. Update migration provenance and durable implementation progress truthfully.
4. Rewrite the completion sections of `AUTHORED_PROJECT_MODEL.md`,
   `ROOM_LIFECYCLE_MODEL.md`, `SIMULATION_AND_VALIDATION.md`,
   `STRUCTURED_EDITOR_WORKSPACE.md`, and affected biome rules.
5. Amend the existing Room Action Order audit's planner disposition without
   erasing its source evidence: ordinary first-three Postboss rooms, physical
   terminal I/Q ending rooms outside supported topology, and the probed Dream
   ordinal mapping.
6. Search production and stable docs for superseded completion vocabulary and
   dispose every hit intentionally.
7. Delete this temporary plan.

Closure validation:

- checkpoint fixture integrity and schema migration tests;
- focused product witnesses after canonical fixture replacement;
- one final `npm run check` after all review remediation is stable; and
- no repeat of the full gate when unchanged component lanes have already passed
  sequentially.

## Adversarial Review

### Rejected: normal ExitDecision for fixed rooms

A normal batch would incorrectly introduce reward-store, bag, generation,
selection, and authoring semantics. The narrow fixed room link is smaller and
truthful.

### Rejected: forced Boss/Postboss room authoring

Room force pressure governs generated room choices; the source uses linked
rooms for this transition. Requiring authors to create a normal outgoing batch
and select its only legal Boss/Postboss target would expose choices they do not
have, admit impossible incomplete states, and make normal batch counts,
eligibility, reward stores, bags, candidates, and findings participate only to
be neutralized again. Offering an unpicked Preboss therefore remains cheap,
while committing it atomically installs the non-negotiable fixed topology.

### Rejected: compute completion rooms only in simulation

That recreates `automaticRooms` under a new name and leaves authored room
features outside topology. It does not solve the Phial ownership failure or the
premature rail source.

### Rejected: route callback or smart Postboss resolver

The game data is an exact one-to-one run-type/position table. A callback,
family discriminator, biome fallback, or terminal inference adds freedom the
source and authoring model do not have.

### Rejected: key Dream Postboss by completed biome

Dream selects `Dream_PostBoss01/02/03` by entered-biome ordinal. The biome just
completed is irrelevant to that room identity.

### Rejected: derive terminal behavior from configured project length

A configured F-only project still represents route position one and therefore
owns `F_PostBoss01`; it merely exits to the current authored route boundary.
Only the catalog route position determines whether a Postboss exists.

### Rejected: preserve automatic RoomMode

Keeping the mode would retain special defaulting, materialization, lifecycle,
Arcana, and candidate branches even after occurrences move into topology. The
creation/link policy already supplies the only special fact needed.

### Rejected: preserve dormant completion drafts

A hidden draft container would leave two occurrence ownership models and keep
the same source-index/finding ambiguity. Schema 68 preserves reached semantic
state and retires unreachable drafts explicitly.

### Rejected: implement Dream Dive now

Dream route construction, randomized biome order, Dream Points, Dream room
declarations, and runtime transfer chronology are separate features. This plan
adds only the exact route-position contract already consumed by standard runs.

### Rejected: broad route graph or generic continuation framework

The concrete requirement is two fixed intra-biome links and one existing
route-order transition. A graph abstraction, cross-biome persisted edge, or
open continuation union would exceed current authoring freedom and has no
additional concrete consumer.

## Explicit Non-Goals

- Dream Dive route implementation or Dream Points simulation;
- terminal I/Q narrative or meta-progression sequences;
- Boss reward quantities or optional Quick Buck timing in Dream Boss rooms;
- player-authored Boss/Postboss identity or fixed-link editing;
- changes to normal reward bags, ExitDecision semantics, or route probability;
- cross-biome persisted occurrence links;
- a compatibility decoder inside the strict schema-68 engine codec; or
- unrelated cleanup discovered while touching large topology/history files.

## Gate Lock

User review locked the plan with these decisions:

- the exact current route arrays and position-four `null` disposition;
- deliberate retirement of unreachable schema-67 completion drafts;
- one production gate is preferable to a temporary dual model; and
- the named deletion inventory and representative witnesses cover every current
  completion consumer without adding Dream implementation scope.
