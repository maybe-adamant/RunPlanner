# Narcissus, Fields Chronology, and Artificer Implementation Plan

## Status

**Locked for execution.** This plan is grounded against clean commit `2ba17b2`,
authored-project schema 38, the completed Arcana/Circe, Time Piece, Echo, and
Shop-chronology deliveries, the installed Hades II scripts, and the installed
H map assets. Its room-action model and gate boundaries passed the final
adversarial read on 2026-08-16.

The source authority is
`../audits/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md`. The broad
Arcana board and Lazuli facts remain owned by
`../audits/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md`. Stable current ownership lives
in `../design/AUTHORED_PROJECT_MODEL.md`, `../design/REWARD_MODEL.md`,
`../design/ROOM_LIFECYCLE_MODEL.md`,
`../design/SIMULATION_AND_VALIDATION.md`, and
`../design/STRUCTURED_EDITOR_WORKSPACE.md`.

Do not link this temporary plan from `README.md` or stable design/audit
authorities while it is active. Commit the locked audit/plan before
implementation. At final closure, absorb only durable contracts into their
owning documents, record the delivery in `IMPLEMENTATION_PROGRESS.md`, and
delete this file.

## Objective

Deliver the successor sequence already established by the Shop-trait phase:

1. correct Narcissus so every pickup that matters to Time Piece, Artificer, or
   existing Echo last-reward history is represented as its own concrete world
   object;
2. replace H's fixed cage-completion/acquisition shortcut with one truthful
   player-authored room-action chronology;
3. add declaration-bounded Fields optional pickups from their own persistent
   bag and weave them into that chronology; and
4. implement The Artificer as a rank-scaled, run-local, mutually exclusive
   acquisition disposition that consumes the current `RunProgress` bag and
   creates a separately ordered replacement pickup.

The result must reuse the existing concrete acquisition, reward bag, trait and
Arcana state, Time Piece, semantic address, candidate, finding, workspace,
Redux, and Run State authorities. It must not add a generic event DSL, reward
callback registry, second reward-bag simulator, Fields-only acquisition fold,
Artificer-only room order, React-owned eligibility, or a hidden pending map.

## Included scope

- Narcissus's exact six currently consequential pickups: Ashes, Psyche,
  Bones, Max Magick, Max Health, and Death Defiance;
- a producer-owned Psyche concrete acquisition declaration without adding it
  to any counted store;
- Psyche's existing Time Piece and Echo last-reward behavior;
- exact H map capacities of two, three, or four optional pickups;
- the existing 19-entry `FieldsOptionalRewards` bag and its one-at-a-time,
  no-sibling-exclusion generation;
- an authored H action chronology that interleaves atomic cage completions, cage
  reward interactions, optional pickup interactions, and later Artificer
  replacement pickups;
- rank-III Artificer capacity three and rank-IV capacity four;
- Lazuli preserving spent uses and adding exactly one remaining use;
- source-instance Artificer eligibility, including free Narcissus and Fields
  pickups and eligible free Echo Gold duplicates;
- paid-Shop and Echo Reward Reward Reward producer exclusions;
- current mutable `RunProgress` bag consumption, append-refill semantics,
  Devotion/Spell exclusions, and generated-but-unacquired history separation;
- normal, Time Piece, and Artificer dispositions as one mutually exclusive
  acquisition choice;
- requiredness transfer for cage rewards and optionality preservation for
  optional/Narcissus sources;
- strict persistence, semantic commands, candidates, findings, inspector
  routing, Run State, UI, Redux undo/redo, and representative product loops;
  and
- final durable-document absorption and one complete phase-closure gate.

## Excluded scope

- numeric metaprogression gains, resource totals, or Gold totals;
- omitted Narcissus companion items that remain irrelevant to every modeled
  system: plants, ore, major heal, fabric, rerolls, Star Dust, Essences,
  Lotus, and Mystery Seeds;
- adding Psyche or Psyche Big to `MetaProgress`, `RunProgress`, or another
  counted store;
- a producer for `MemPointsCommonBigDrop`, which no supported source creates;
- weighted optional-reward chances, spawn-point selection, or map position;
- pickup interaction during an active combat wave;
- Artificer on paid Shop inventory, Echo Reward Reward Reward recreations,
  Eris catch-up drops, or Poseidon's explicitly blocked bonus drop;
- recursive Artificer conversion, since `RunProgress` contains no eligible
  metaprogression source;
- rerolls, costs, animations, destruction presentation, or duplicate object
  position;
- Wells, exact Surface Shop delayed delivery, or other deferred producers;
- a generic lifecycle callback/effect registry; and
- compatibility decoding or migration for superseded schema versions.

## Current live-code baseline

- authored schema 38 has `FieldsCombatState.cages` only; the three cage values
  are complete retained leaves, while the active prefix comes from the batch
  Min/Max result;
- `FieldsCombatRoom` prepares the Passive and active cage phases, executes them
  in declaration order, and automatically acquires each cage reward at its
  matching `encounterCompleted` event;
- the current fixed sequence cannot represent choosing Cage 2 before Cage 1,
  leaving Cage 1's reward on the ground, or taking an optional pickup between
  two cage encounters;
- `FieldsOptionalRewards` is already a normalized exact 19-entry persistent
  store, but no room declaration, authored state, materializer, simulator, or
  editor consumes it;
- all fifteen supported H combat map assets are present. Their effective
  optional maxima are two, three, or four after capping physical spawn points
  by the source's four chance rolls;
- optional reward generation and cage reward generation use separate bags;
  cage offers are prepared before entry, while optional offers spawn after
  cage objects on entry;
- `AuthoredAcquisitionSiteState.order` already separates optional
  participation from payload and owns ordinary pickup/Shop chronology, but it
  cannot contain encounter activations and therefore cannot by itself express
  Fields;
- Narcissus already uses an occurrence-owned `roomExit` acquisition site and
  the shared pickup settlement path, but Heartfelt Condolences omits Ashes,
  Mystic Secrets omits Psyche, and Ancestral Offering omits Bones;
- `MemPointsCommonDrop` is not in the catalog, while Ashes and Bones already
  have concrete resource declarations, Time Piece eligibility, and Echo
  last-reward recreation;
- `ArcanaFearState` already records the resolved active Arcana set and Epic or
  Heroic run-local rarity, and Lazuli already promotes selected Epic cards to
  Heroic;
- The Artificer card is declared but has no capacity profile, spent-use ledger,
  acquisition disposition, replacement child, candidate product, or UI;
- every branch already carries the current persistent reward bags, including
  `RunProgress`, and `consumeCountedOffer` already owns the required
  append-with-leftovers refill semantics; and
- Time Piece currently authors `normal | gold` per acquisition role and
  consumes its retained keepsake ledger inside the shared acquisition fold.

## Planner interpretations

### Narcissus correction

Keep the selected Narcissus option as the producer descriptor and each
consequential world object as an independent `roomExit` acquisition entry.
The exact restored surface is:

| Selected option       | Represented entries                                           |
| --------------------- | ------------------------------------------------------------- |
| Heartfelt Condolences | `ashes` -> `MetaCardPointsCommonDrop`                         |
| Mystic Secrets        | `psyche` -> `MemPointsCommonDrop`, `maxMana` -> `MaxManaDrop` |
| Ancestral Offering    | `bones` -> `MetaCurrencyDrop`, `maxHealth` -> `MaxHealthDrop` |
| Life Savings          | `lastStand` -> `LastStandDrop`                                |

The other already-supported Narcissus options retain their current pickup
surface. Omitted companion objects remain deliberate effect-neutral
simplifications, not fake acquisitions.

`MemPointsCommonDrop` is a producer-owned concrete resource identity. It owns
normal consumable/use history, Time Piece eligibility, and exact Echo
last-reward recreation, but no reward-store entry. The Narcissus lifecycle
accepts Ashes, Psyche, and Bones alongside its existing reward identities.

Changing the selected Narcissus option continues to replace the complete
producer-owned entry set, retain compatible exact-key children, and remove
only entries/order membership no longer produced. The selected outer NPC
descriptor itself never enters equipped-trait history.

### Fields map capacity and optional state

The catalog records one declaration-owned `optionalRewardCapacity` for every
supported H combat room:

```text
capacity 4: H_Combat01, 03, 04, 05, 06, 10
capacity 3: H_Combat02, 07, 08, 12
capacity 2: H_Combat09, 11, 13, 14, 15
```

The authored Fields state owns:

- every declaration-bounded cage reward, as today;
- one selected optional count from zero through that room's capacity;
- a complete retained optional reward value for every capacity slot; and
- one complete room-action chronology.

Optional slots use stable declaration-bounded keys such as `optional1` through
`optional4`. The selected count activates a prefix only as a planner identity
convention; the game does not assign semantic order to physical spawn points.
Dormant values remain authored so lowering and later restoring the count does
not reroll them. Only the active prefix consumes the persistent optional bag
or publishes controls/findings.

The count models possibility, not chance. Every value from zero through the
declaration capacity is supported. The declaration-complete default is the
uniform planner value two because every supported map can realize it; it is
not asserted to be the modal effective result for every capacity class. Zero
and one remain legal even though they are uncommon; physical capacity is an
upper bound, not a minimum. No probability or weighted likelihood enters
validation or presentation.

### Fields room-action chronology

Fields requires one order that can contain two different semantic actions:

- complete one exact cage encounter from activation through reward unlock; and
- interact with an exact cage, optional, or derived replacement pickup.

Persist a closed discriminated action sequence on `FieldsCombatState`, using
stable phase and entry keys rather than rendered positions. Do not overload
the generic acquisition-site `order` with encounter actions and do not persist
a second cage-only order beside an acquisition order.

Structural decoding accepts only declaration-known action identities, with
each identity present zero or one time. It does not require currently active
actions. Selected simulation requires every active cage completion and its
required reward interaction exactly once. When a Fields occurrence is first
created, its default construction receives the containing selected cage count
and creates the current-behavior sequence `complete cage1 -> interact cage1 ->
...`. This deliberately extends today's room-default context; it must not
rederive the count from rendered topology or a later projection.

The Passive Fields phase remains fixed first. Concrete cage encounter
identities are still selected and recorded during room preparation in
declaration order, matching source preparation. The authored action sequence
then owns atomic cage-completion order and pickup chronology. A cage action
represents activation through encounter completion as one indivisible planner
step because the supported model permits no pickup during an active combat
wave. Do not persist separate start and finish actions.

```text
prepare all cage offers and encounter identities
enter room
generate active optional offers
complete Passive
execute authored Fields actions
generate outgoing batch
commit and exit
```

One action is atomic; the planner does not model pickup during an active combat
wave. It does preserve pickup before the first cage, between completed cages,
and after the final cage.

For the currently active cage prefix:

- every cage completion appears exactly once;
- a cage reward interaction may not precede its cage completion;
- every required cage reward is resolved exactly once by normal acquisition,
  Time Piece, or later Artificer plus its required replacement;
- inactive cage actions remain structurally representable and finding-backed
  after an upstream Min/Max or room change rather than being silently deleted;
  and
- optional pickup actions appear zero or one time and never require pickup to
  leave the room.

The engine owns action readiness plus bounded complete move, insertion, and
participation proposals relative to the current sequence. It must not
enumerate every legal total ordering: three cage completions, three required
rewards, and four optional pickups have a factorial legal-order surface.
React renders and dispatches the engine's local complete proposals; it does
not infer whether a cage is unlocked, a pickup is required, or an insertion
position is legal.

Later Min/Max changes retain the authored sequence. A newly active missing cage
completion or required interaction receives an insertion finding/proposal; an
inactive retained action receives a removal finding/proposal. Active required
cage actions cannot be toggled off. Move proposals are complete one-edit
sequences over the current order rather than a cross-product of all legal
orders. Inactive cage reward payload children remain dormant even while their
retained chronology action is visible as an exact repair row.

This chronology deliberately replaces the current automatic cage acquisition
at `encounterCompleted`. Cage and optional pickup actions both call the one
shared concrete-acquisition settlement authority. There is no Fields-private
reward history fold.

### Optional reward generation

At the room-entry optional-offer checkpoint, resolve every active optional
slot sequentially from the branch's current `FieldsOptionalRewards` bag.
Each slot:

- evaluates the store's current eligible remaining entries;
- uses the existing append-one-full-set refill when no eligible entry remains;
- consumes one exact matching bag entry when its authored offer is possible;
- receives no optional-sibling peer exclusion; and
- remains generated and bag-consuming even when the player never interacts
  with it.

Cage offers have already consumed `RunProgress` during target preparation.
Optional generation must not consume or refill `RunProgress`, and changing an
optional pickup cannot regenerate cage offers or the outgoing batch.

The optional inventory and the action chronology remain two views of one
authored room state: the inventory answers what spawned and exposes each
payload/disposition; chronology answers which optional pickups were used and
when. Optional interaction is derived from membership in that chronology, not
persisted as a second boolean. Checking an optional pickup inserts its action
through an engine-owned proposal; unchecking it removes only that action and
retains the complete payload and selected disposition. The UI mirrors the
established Shop inventory/chronology separation, but Fields actions remain an
engine-owned product because they also contain encounter phases.

Lowering the optional count atomically removes action membership for every
newly dormant slot while retaining its payload and selected disposition.
Raising the count restores the retained payload but leaves interaction
unchecked; it does not silently replay the earlier action membership. A
retained disposition on an un-interacted optional is dormant: it consumes no
Time Piece or later Artificer use and emits no contextual finding.

### Artificer declaration and use state

The `MetaToRunUpgrade` Arcana declaration owns the exact capacity profile:

```text
Epic (ordinary rank III): 3 total uses
Heroic (Lazuli rank IV):   4 total uses
```

Track exact Artificer-use evidence in canonical run-local Arcana state. Do not
persist a separate remaining-use counter or reset marker. Remaining uses are
derived from the current Artificer rarity minus the number of successfully
spent uses.

The use evidence must distinguish multiple interactions within one lifecycle
history sequence, using the owning acquisition entry and its room-order
ordinal rather than assuming one Arcana event per room. This is necessary for
several Fields conversions before any replacement pickup.

Lazuli continues to change only the active Arcana card's run-local rarity.
Because spent-use evidence is retained, Epic -> Heroic adds exactly one
remaining use for every spent-use count from zero through three. It never
resets remaining uses to four.

Run State shows Artificer only while the card is active and truthfully reports
its current rank, spent uses, capacity, and remaining uses. The Arcana loadout
remains the activation authority.

### Source-instance eligibility

Catalog concrete acquisition declarations own the inherited
Artificer-capable metaprogression family represented by supported producers:

- `GiftDrop`;
- `MetaCurrencyDrop` and `MetaCurrencyBigDrop`;
- `MetaCardPointsCommonDrop` and `MetaCardPointsCommonBigDrop`; and
- producer-owned `MemPointsCommonDrop`.

Eligibility is still resolved per concrete instance:

- free ordinary room, Fields, Narcissus, and eligible Echo Gold duplicate
  instances retain it;
- paid Shop inventory is blocked by paid provenance;
- Echo Reward Reward Reward's recreated consumable is blocked by its
  producer-lifecycle declaration; and
- unsupported Eris/Poseidon producer overrides do not become new planner
  surfaces merely to complete a theoretical matrix.

`MemPointsCommonBigDrop` remains outside the catalog until a supported producer
requires it. This does not add Psyche Big to a store.

### One acquisition disposition

Replace the current `normal | gold` conversion map with one exact role-owned
disposition:

```text
normal
timePiece
artificer { complete replacement reward }
```

Use a closed discriminated authored value so an Artificer replacement cannot
exist beside a normal or Time Piece disposition. This is a clean schema
replacement, not a compatibility extension to a misleading `gold` field.

The complete Artificer child is owned by the exact source acquisition role.
It contains one authored `RunProgress` replacement with its ordinary payload,
trait/Pom detail, and its own later acquisition disposition. Structural
validation forbids an Artificer replacement from recursively selecting
Artificer because no `RunProgress` output is an eligible metaprogression
source.

Normal acquisition records the source. Time Piece consumes its existing
keepsake charge and records no source acquisition. Artificer consumes one
Artificer use and one exact `RunProgress` bag entry, records no source
acquisition, and materializes the replacement as a separate stable derived
entry at the same acquisition site.

### Artificer replacement chronology

The derived replacement key is collision-safe and source-owned by exact site,
entry, and acquisition role. It is not a global pending map. On a producer
with an authored room-local order, the source interaction must precede the
replacement in that order.

At source interaction time, the engine:

1. proves the source instance is free and Artificer-eligible;
2. proves an active Artificer card has a remaining use;
3. evaluates the authored replacement against the current branch's
   `RunProgress` bag and current acquisition history;
4. excludes `Devotion` and `SpellDrop` and ignores the room's forced reward;
5. consumes the exact reachable bag entry, using the ordinary append-refill
   rule only when the whole current eligible support is empty;
6. records one spent-use event;
7. destroys the source semantically without folding its resource/history; and
8. publishes the derived replacement entry for later chronology.

The conversion operation itself never acquires the replacement. Its ordinary
concrete history settles only at a distinct later checkpoint:

- a mandatory singleton ordinary room reward has no competing room-local
  action, so its required replacement settles at the next fixed producer
  checkpoint before outgoing generation and gains no artificial order UI;
- a required cage source transfers required participation to a later Fields
  replacement action; and
- optional Fields, Narcissus, or Echo Gold sources create optional replacement
  entries that may remain unpicked.

Several source conversions may precede every replacement acquisition. Bag
consumption occurs at each conversion, but generated rewards do not update
loot/use/trait history until their later pickup. This preserves the audited
multiple-late-Hammer possibility.

The existing acquisition-site order remains authority for Narcissus and Shop
pickup sites. Mandatory singleton producers use their fixed lifecycle rather
than persisting a meaningless one-row order. The Fields room-action chronology
adapts the same derived source/replacement dependency into its acquisition-
action rows. All three consume one engine-owned source/replacement product;
Artificer does not gain a private order implementation.

### Authoring and UI

Ordinary reward, Narcissus, Fields, and Gold inventory rows own their concrete
payload and disposition controls. The Fields chronology owns only ordered
action participation and movement. A source selecting Artificer publishes one
adjacent derived replacement inventory row with a complete ordinary reward
editor. Ordered sites expose its pickup participation separately; a mandatory
singleton shows the fixed required child without inventing a checkbox or order.

The Fields optional inventory begins with one count control whose domain is
zero through the selected room declaration's capacity. It then renders one
active row per spawned optional slot. Each row owns its complete reward editor,
an interaction checkbox derived from action membership, and one resolution
control. The player-facing resolution choices are `Pick up normally`, `Time
Piece` when available, and later `Artificer` when Gate D extends the shared
engine product. The checkbox means interaction rather than ordinary
acquisition: Time Piece and Artificer destroy the source instead of picking it
up. Inactive retained slots publish no row, interaction, or finding.

The acquisition disposition control offers only engine-supported choices:

- `Acquire normally`;
- `Time Piece` when the exact free role and charge state permit it; and
- `Artificer` when the exact free role, active card, and remaining-use state
  permit it.

Structurally retained but context-invalid selections stay visible with exact
findings and repair candidates. Dormant optional slots, inactive cage reward
payloads, and not-yet-materialized Artificer children publish no phantom
interaction or finding destination. A retained inactive cage chronology action
is the deliberate exception: it publishes its exact removal repair row without
publishing the dormant reward payload beneath it.

Finding navigation opens the containing Narcissus acquisition workbench,
Fields inventory/chronology, or Shop supplemental row and focuses the exact
source or replacement control. Redux undo/redo records each semantic authored
edit; focus, expansion, and candidate search remain UI-session state.

## Delivery gates and intended commits

### Gate A — Narcissus acquisition correction

**Commit:** `fix: complete narcissus conversion pickups`

Deliver a complete vertical correction without Artificer machinery:

- declare `MemPointsCommonDrop` as a producer-owned concrete resource with
  Time Piece and Echo last-reward facts but no counted-store membership;
- extend the exact Time Piece and Echo recreation compiler matrices;
- extend `NarcissusPickup` and the three affected Narcissus descriptors;
- preserve one complete entry per represented pickup and existing
  room-exit order semantics;
- update strict defaults, codec/commands, candidates, findings, workspace,
  Run State, and Redux/product witnesses only where the larger entry set
  reaches them; and
- keep schema 38 if no persisted shape changes. Do not bump a schema merely
  because declaration-complete defaults changed.

Primary ownership/tests:

- catalog acquisition/lifecycle/Narcissus matrices and mutation tests;
- real G Narcissus option changes and exact entry reconciliation;
- all six consequential pickups through normal/Time Piece dispositions;
- Psyche acquisition -> latest reward -> later Echo Reward recreation;
- acquisition workbench visibility, ordering, finding focus, and undo/redo.

### Gate B — Fields cage action chronology

**Commit:** `feat: order fields cage actions`

Correct the existing cage-only lifecycle before adding optional rewards:

- advance authored schema 38 -> 39 with the closed Fields action sequence;
- keep complete cage reward leaves and current Min/Max activation authority;
- extend occurrence default construction with the selected active cage count
  and default to the current interleaved completion/reward sequence;
- retain declaration-order encounter preparation, then execute atomic active
  cage completions and cage reward interactions in authored order;
- remove automatic cage acquisition from generic `encounterCompleted` only
  for the new Fields lifecycle product;
- enforce exactly-once active cage completion, reward readiness, required cage
  resolution, inactive retained-invalid repair, and outgoing generation after
  required actions;
- expose engine-owned bounded move/insertion/participation proposals and exact
  findings without enumerating every legal total ordering;
- add the Fields chronology editor without duplicating cage reward editors;
  and
- preserve existing non-Fields encounter and acquisition lifecycle behavior.

Primary ownership/tests:

- strict schema-39 codec/default/replacement/command invariants;
- two- and three-cage legal permutations and impossible reward-before-cage
  orders;
- declaration-order encounter recording versus player-authored cage-completion
  order;
- Time Piece cage resolution and proof that every active Experimental Hammer
  advances exactly at each authored cage-completion checkpoint regardless of
  where cage reward acquisitions are interleaved;
- Min/Max and room-replacement retained-invalid repair;
- candidate/selected branch agreement, finding navigation, UI movement, and
  Redux undo/redo;
- regression of ordinary, wheel, Shop, and Narcissus lifecycles.

### Gate C — Fields optional rewards

**Commit:** `feat: add fields optional pickups`

Add optional generation to the settled Fields chronology:

- advance authored schema 39 -> 40 with declaration-complete optional count
  and retained slot values;
- normalize the exact per-room capacities from installed map assets;
- support the full zero-through-capacity domain for each room, using two as
  the declaration-complete default without treating it as a source minimum;
- materialize active optional offers at room entry from the persistent
  `FieldsOptionalRewards` bag, independently of cages and without sibling
  exclusions;
- weave optional pickup interactions before, between, or after cage actions;
- keep unpicked optionals bag-consuming but history-neutral;
- expose normal and Time Piece dispositions through shared acquisition
  settlement;
- add the count control, complete active-slot inventory editors, interaction
  checkboxes derived from chronology membership, shared resolution controls,
  and chronology UI from engine products;
- make count reduction atomically remove newly dormant action membership while
  preserving payload/disposition, and leave restored slots unchecked; and
- retain inactive optional values without publishing dormant children.

Primary ownership/tests:

- exact 15-room capacity matrix and exact 19-entry store mutation tests;
- zero through capacity support plus default-two witnesses for representative
  2/3/4-capacity rooms;
- independent sequential bag consumption, refill with leftovers, duplicate
  optional siblings, and cage/optional bag separation;
- optional-before-first-cage, between-cages, and post-final-cage histories;
- unpicked optional neutrality and Time Piece conversion;
- real H projection, findings, navigation, UI, Redux, persistence, and
  progressive branch agreement.

### Gate D — Artificer

**Commit:** `feat: implement artificer conversions`

Implement the complete supported effect only after Gates A-C are committed:

- advance authored schema 40 -> 41 with the clean acquisition disposition and
  complete Artificer replacement child;
- declare exact Artificer capacity and source-instance eligibility facts;
- add canonical spent-use evidence and derive remaining capacity;
- consume the current `RunProgress` bag at conversion time and settle the
  replacement only at its later ordered action;
- share one source/dependent-entry capability across ordinary acquisition
  sites and Fields actions;
- integrate every supported source producer in the same gate: ordinary free
  meta pickups, Narcissus, Fields optionals, and eligible Echo Gold duplicates;
- preserve paid-Shop and Echo Reward exclusions;
- make Lazuli add one remaining use by retaining spent-use evidence;
- publish exact Run State, candidates, findings, editor controls, navigation,
  and Redux/product behavior; and
- delete or rename the superseded `conversionByAcquisitionRole` vocabulary in
  the same commit. No compatibility alias remains.

Primary ownership/tests:

- exact Epic/Heroic 3/4 capacity and spent-use/Lazuli table;
- exact source/producer eligibility matrix and paid/replay exclusions;
- normal/Time Piece/Artificer mutual exclusion and invalid retained state;
- current-bag consumption, no premature refill, append-refill with leftovers,
  Devotion/Spell exclusion, and no recursion;
- source destroyed without history, replacement generated without history,
  and later ordinary replacement acquisition;
- mandatory ordinary MetaProgress reward -> fixed required replacement before
  outgoing generation, without a synthetic acquisition-order control;
- required cage transfer versus optional Fields/Narcissus/Gold replacement;
- multiple conversions before pickup, including the audited H multiple-Hammer
  possibility and the inverse history-first rejection;
- Ephyra Hub Hammer independence from `RunProgress` before acquisition;
- exact branch attestation, candidate/selected agreement, finding focus,
  Run State, persistence, UI, and Redux undo/redo.

### Gate E — Phase closure

**Commit:** `docs: close narcissus fields and artificer delivery`

- perform a fresh ownership and anti-pattern audit across catalog -> engine <-
  application;
- confirm there is one Fields chronology, one acquisition fold, one
  `RunProgress` bag transition, and no Artificer pending registry;
- absorb durable facts into the smallest owning design, biome, and audit
  documents;
- update `README.md` current product and `IMPLEMENTATION_PROGRESS.md` with
  exact gate commits/schema/test totals;
- delete this temporary plan only after all behavior gates are committed; and
- run `npm run check` exactly once after review remediation and document
  absorption are final.

## Cross-gate invariants

- Catalog construction -> pure engine <- application/React remains intact.
- Persisted state contains game-domain identities and decisions, never UI row
  positions, labels, expanded state, or candidate caches.
- Every generated offer consumes its owning bag at generation time; every
  concrete acquisition changes history only at its ordered interaction.
- Cage preparation, atomic cage completion, source interaction, Artificer generation,
  and replacement acquisition remain distinct checkpoints.
- Structurally representable incomplete/context-invalid state remains visible
  and repairable; projections never silently reroll or discard it.
- Candidate products are branch-attested and selected evaluation uses the same
  owning transition.
- No temporary partial Artificer eligibility matrix lands: Gate D covers every
  supported producer already present after Gate C.
- Each policy matrix has one primary owner; integration/product tests keep
  representative contacts rather than copying exhaustive catalog/engine
  tables.
- Each gate starts from the exact preceding clean commit, uses a fresh executor
  and fresh independent reviewer, and is committed only after accepted
  remediation plus the main-session final review.

## Final acceptance

The phase is complete only when:

- Narcissus exposes all six consequential pickups and Psyche participates in
  Time Piece and Echo last-reward without entering a counted store;
- every supported Fields combat room owns its exact optional capacity;
- atomic cage completion and all supported pickup interactions share one truthful
  action chronology;
- Fields optional offers consume only `FieldsOptionalRewards` at generation
  and unpicked values remain history-neutral;
- Artificer uses derive from active Arcana rarity and retained spent-use
  evidence;
- every supported eligible free source can create one exact later
  `RunProgress` replacement while blocked producers cannot;
- the H multi-Hammer ordering consequence is representable without bypassing
  the production bag/history folds;
- Lazuli adds one remaining use and never resets spent uses;
- every active child has one inspector, interaction, and finding destination,
  while dormant children publish none;
- superseded automatic Fields acquisition and `conversionByAcquisitionRole`
  paths are deleted rather than retained in parallel; and
- the final complete repository gate passes and the temporary plan is removed.
