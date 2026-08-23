# Natural Selection, Ransoms, and Steady Growth Implementation

## Status

Locked delivery plan grounded on base commit `e828577`, the source-complete
[run-impacting trait effects audit](../audits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md),
and the existing Pom, Hephaestus cooldown, and Proper Upbringing evidence in
[trait offer pools and dependencies](../audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
and the
[boon rarity ledger audit](../audits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md).
The audit and this plan must be committed before execution begins.

This is temporary delivery authority. It must not be linked from `README.md`
or stable design documents. At phase closure, absorb the completed contracts
into the smallest durable catalog, authored-project, lifecycle, simulation, and
workspace authorities; update the durable implementation record; and delete
this plan.

Owning stable authorities are:

- [`CATALOG_MODEL.md`](../design/CATALOG_MODEL.md);
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md);
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md);
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md);
- [`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md);
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md);
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md);
  and
- [`TRAIT_LEVELS_AND_POMS.md`](TRAIT_LEVELS_AND_POMS.md), retained as the
  historical authority for the current level and Pom collapse.

## Objective

Make the three bounded trait effects real in chronological simulation:

1. Natural Selection distributes up to eight successful levels through one
   legal round-robin core-slot outcome authored at its acquisition, stopping
   early only when every target has become ineffective;
2. Queen's and King's Ransom deterministically remove the opposite provider's
   current traits and grant `4 x removed identities` levels to every eligible
   trait from the buffed provider; and
3. Steady Growth advances at qualifying `encounterEndEffectsApplied`
   checkpoints and, at its rarity-dependent threshold, automatically promotes
   one exact eligible trait rarity.

The resulting user experience is:

- Natural Selection exposes one selected-trait outcome editor that walks up to
  eight legal level targets, stops only when its engine domain is exhausted,
  and shows the resulting per-trait allocation;
- each Ransom shows a read-only acquisition preview because its exact removals
  and level gains are derived from the current run frontier; and
- a reached Steady Growth threshold appears as a fixed automatic row after the
  owning encounter's End encounter checkpoint, with one contextual rarity
  target editor when a random target exists.

All three effects mutate the existing chronological trait history. None adds a
mutable final-state ledger, generic effect callback language, or second room
action order.

## Included scope

- exact catalog declarations and compiler closure for the three effects;
- the minimum level-bearing expansion required by the two Ransoms;
- Natural Selection authored outcome, strict codec, command, candidate,
  finding, focus, and selected-option editor;
- provider-indexed Ransom removal and deterministic level mutation;
- Steady Growth derived progress, phase-owned authored target, candidate,
  finding, focus, fixed timeline row, and Run State preview;
- declaration-owned Hephaestus in-run upgrade limits consumed by ordinary
  Poms, Natural Selection, Bridal Glow, and Steady Growth, while Proper
  Upbringing retains its separate source-backed rarity-floor behavior;
- schema `51 -> 52`, catalog version `0.31.0-chaos-traits ->
0.32.0-run-impacting-traits`, checkpoint migration, and migration CLI
  support;
- ordinary reward, Shop, Devotion, Echo Reward Reward Reward, and Echo Boon
  Boon Boon acquisition contacts wherever the selected trait can legally
  occur;
- retained-invalid, dormant, repair, save/load, and one-step Undo behavior;
- narrow extraction and reuse of the existing All Together compound-outcome
  editor and Pom random-target presentation; and
- durable documentation absorption after the implementation is stable.

## Explicit exclusions

- Sea Star, Buried Treasure, and Quick Buck generated pickups;
- carried-money arithmetic, Quick Buck's money multiplier, and Dream Dive
  optional-pickup loss;
- a generic trait-effect registry, callback DSL, scheduler, timer service, or
  effect-state bag;
- broadening ordinary Pom target eligibility beyond the existing supported
  core-god collapse; this slice does correct the three declaration-owned
  Hephaestus cooldown-cap exclusions already shared by the game's Pom-derived
  and in-run rarity-upgrade paths;
- modeling any other combat-value curve or Natural Selection saturation edge
  that the current Pom model deliberately omits;
- making Steady Growth draggable, removable, optional, or part of
  `roomActions.order`;
- changing encounter composition, Fig Leaf, Chaos clock, Experimental Hammer,
  Shrine delivery, Shop, Well, or room-topology semantics; and
- probability display, RNG seeds, or likelihood simulation.

Sea Star, Buried Treasure, and Quick Buck remain a deliberate later decision.
Their source contacts are retained in the owning audit so deferral does not
turn into a claim that they are effectless.

## Source facts and chosen planner representation

### Catalog ownership stays closed and declaration-specific

Replace the three traits' current ordinary-equip-only declarations with three
closed normalized disposition families:

- Natural Selection equips, then distributes up to eight successful core-slot
  levels;
- each Ransom equips, then sacrifices one declared provider index and grants a
  declared number of levels per removed identity to the other provider; and
- Steady Growth equips with its exact rarity-to-interval table and advances
  only through the lifecycle contract below.

The raw declarations own the exact slots, count, giver directions, level
factor, and interval table. The compiler validates those facts against the
exact trait identities and rejects moved, duplicated, missing, or extra
configuration. Engine dispatch is exhaustive over the normalized disposition;
it must not recognize `GoodStuffBoon`, either Ransom key, or `BoonGrowthBoon`
through string comparisons in simulation.

These are closed additions to the existing `TraitSelectedDisposition` family,
not a generic trait-effect registry. Natural Selection and the Ransoms settle
at acquisition. Steady Growth's declaration remains discoverable from its
equipped identity when an existing end-effects event is folded.

### Natural Selection is one bounded acquisition result

The game collects occupied Attack, Special, Cast, Sprint, and Magick slots,
shuffles them once, and cycles through that order until eight successful level
increments have been applied. A target cannot repeat until every other still
eligible target has received its current-round increment.

The Planner retains its existing supported Pom collapse:

```text
eligible Natural Selection target
  = occupied ordinary core slot
  + core-god trait
  + not blockStacking
  + next level remains effective under any declaration-owned in-run upgrade limit
```

The normalized catalog does not model the complete numeric tooltip curves used
by the game's final saturation check. This slice retains that collapse except
for the three Hephaestus cooldown traits whose exact rarity/level thresholds
are already source-backed and shared with ordinary Pom eligibility. A
Hephaestus target leaves the Natural Selection domain as soon as its next level
would no longer improve the two-second-capped cooldown. The remaining targets
continue the same round without requiring the now-ineligible target, and no
remaining target may repeat until the other still-eligible members of that
round have received an increment.

Natural Selection, normal Poms, Bridal Glow, and Steady Growth must all consume
one engine-owned eligibility helper over the target declaration and current
rarity/level. Natural Selection must not copy the Hephaestus table into its
result assessment or React draft.

Persist one complete nonempty successful-target sequence beneath the selected
Natural Selection option:

```ts
naturalSelectionTargets?: readonly string[];
```

The structural length is `1..8`. The sequence is the exact successful
increment order, not eight independent choices. The game can stop below eight:
its offer gate requires only one currently effective slotted target, while
`DistributeLevels` removes targets whose next processed value would not change
and terminates when the shuffled list becomes empty. Simulation validates the
authored sequence against one immutable pre-acquisition trait frontier:

- every key is currently equipped and Natural-Selection-eligible;
- each round uses every eligible key exactly once before any key repeats; and
- the stable relative order comes from the first shuffled round and survives
  later dynamic target removal; and
- the sequence contains eight increments unless its exact engine-backed next
  target domain is empty after the final authored increment.

The selected option equips Natural Selection first, then appends one to eight
ordered level-mutation events at the same acquisition checkpoint. Later
history sees the resulting levels immediately.

The authored value belongs to one exact `NaturalSelectionResultAddress` under
the existing `TraitOfferAddress` and option key. The existing whole-offer
`ReplaceTraitOffer` command commits it; do not add a Natural-Selection-specific
project command. Missing selected detail is an ordinary blocking child
finding. Unselected detail remains dormant and survives switch-away/switch-back.

Echo Boon Boon Boon's selected nested option may also own this exact result.
Reuse the same normalized result and candidate semantics there; do not create
an Echo-specific Natural Selection implementation.

### Level-bearing state is broader than Pom eligibility

The current `EquippedTrait.level` is initialized only for the supported Pom
domain, which is limited to core god traits. Ransoms can level any current
non-`BlockStacking` trait indexed by Hera or Zeus, including non-core passive
traits.

Separate two engine-owned predicates:

```text
level-bearing trait
  = ranked trait
  + member of a normalized Olympian giver
  + not blockStacking

Pom target
  = level-bearing trait
  + isCoreGodTrait
  + next level remains effective under any declaration-owned in-run upgrade limit

Natural-Selection target
  = Pom target
  + equipmentSlot is one of the disposition's five declared ordinary slots
```

Fresh level-bearing traits start at level `1`; level remains a derived folded
fact. Pom candidate enumeration and `upgradableTraitCount` continue to consume
the narrower core predicate. This is not an expansion of ordinary Pom
eligibility.

Generalize level-mutation folding to the level-bearing predicate so Ransoms can
level non-core Hera/Zeus traits. Run State may consequently show a level for a
stackable Olympian passive that previously omitted the field. Hammers,
rarityless traits, NPC-only traits, Spells, Chaos pairs, and `BlockStacking`
traits remain outside this level axis unless an existing replacement retains a
level under the already-landed replacement rule.

### Ransoms are deterministic current-frontier transforms

Declare two closed acquisition dispositions:

```text
Queen's Ransom
  remove giver = Zeus
  buff giver = Hera
  levels per removed identity = 4

King's Ransom
  remove giver = Hera
  buff giver = Zeus
  levels per removed identity = 4
```

At the acquisition checkpoint, after equipping the selected Ransom:

1. derive every distinct current equipped trait key contained in the removed
   giver's normalized `traitKeys`;
2. remove each current identity through chronological trait-removal events;
3. let `N` be the number of removed distinct keys;
4. derive every surviving current trait contained in the buff giver's
   `traitKeys` and eligible for levels; and
5. append a `+4 x N` level mutation to each such target.

The selected trait's recorded `giverKey` or acquisition origin is not the
membership authority. Provider index membership is. A Duo indexed by Apollo
and Zeus is removed by Queen's Ransom even when Apollo granted it.

Extend the existing trait-removal event with an explicit match mode rather
than adding a Ransom-only ledger:

- exact acquisition-identity removal remains the owner for Jeweled Pom and
  similar lifecycle cleanup; and
- current-trait-key removal owns Ransom's exact acquisition-time transform.

Removal changes current equipped state, slots, elements, rarity counts,
active-floor facts, and future candidates. It must not erase loot use history,
provider encounter history, Denial history, or the historical acquisition
event. The Ransom itself is indexed by the buffing provider, blocks stacking,
and is neither removed nor levelled.

Ransoms have no authored random child, no contextual picker, and no persisted
result. The application may present the engine-derived removed keys, `N`,
level bonus, and buff targets as a read-only selected-acquisition preview.

### Steady Growth uses the existing end-effects event

The catalog owns the exact interval table:

| Steady Growth rarity | Required qualifying end effects |
| -------------------- | ------------------------------: |
| Common               |                               6 |
| Rare                 |                               5 |
| Epic                 |                               4 |
| Heroic               |                               3 |

Steady Growth starts at progress zero and advances only when simulation
processes an existing qualifying `encounterEndEffectsApplied` event. Do not add
a new lifecycle event or infer progress from room entry, room exit, depth, or
`encounterCompleted`.

Normalize the source room fact corresponding to `SkipRoomsPerUpgrade` and
consume it at this checkpoint. N subrooms with that source flag do not advance
Steady Growth. Existing lifecycle behavior remains authoritative for
noncombat, phase-local skipped end effects, Fig Leaf, and multi-encounter room
phases. Each qualifying emitted end-effects event advances once.

Progress is derived trait history keyed to the equipped Steady Growth
acquisition identity. It is not persisted as a mutable counter. Removing the
trait removes its active progress. Reacquiring it starts a new identity at
zero.

When the next increment reaches the current interval, simulation exposes one
automatic outcome at that exact phase before continuing later chronology. The
target domain is every currently equipped trait that:

- is a recognized god/shop trait with a ranked current rarity;
- does not set `blockInRunRarify`;
- declares its next rarity; and
- satisfies any declaration-owned current-level limit.

`blockStacking` does not exclude a Steady Growth rarity target. When more than
one target is eligible, Steady Growth removes itself from its own target
domain; when it is the sole eligible target, it remains selectable. An empty
domain produces the derived no-target outcome and does not block continuation.

The three Hephaestus cooldown limits currently live under Bridal Glow's
targeted acquisition declaration even though the game applies the same
two-second effectiveness boundary to ordinary Pom-derived level increments and
to `AddRarityToTraits`. Move one complete closed table onto each affected
target trait declaration:

| Target                                       | Common | Rare | Epic | Heroic |
| -------------------------------------------- | -----: | ---: | ---: | -----: |
| Hephaestus Attack — `HephaestusWeaponBoon`   |      9 |    7 |    5 |      3 |
| Hephaestus Special — `HephaestusSpecialBoon` |     11 |    9 |    7 |      5 |
| Hephaestus Sprint — `HephaestusSprintBoon`   |      8 |    7 |    6 |      5 |

Each cell is the maximum current level from which another source-backed in-run
upgrade remains effective. The catalog compiler requires all four equipped
rarities and rejects this field on any other trait. One engine-owned helper
consumes the table for:

- ordinary Pom target eligibility;
- Natural Selection's next-position target eligibility;
- Bridal Glow's rarity target eligibility; and
- Steady Growth's rarity target eligibility.

The caller retains its other rules: Poms and Natural Selection still require
their core/Pom target domain, while Bridal Glow and Steady Growth still require
a next rarity and their own source-specific constraints. The table is not a
generic rarity-mutation prohibition.

Proper Upbringing deliberately does not consume this helper. Its source
`UpgradeAllCommon` path promotes eligible equipped Common god traits to Rare
without consulting `UnmodifiedCooldown` or whether the processed value would
change. It can therefore promote a cooldown-capped Common Hephaestus trait to
Rare while leaving its effective cooldown unchanged. That promoted trait
remains unavailable to later Pom, Natural Selection, Bridal Glow, and Steady
Growth targeting whenever its current Rare level is beyond the declaration's
Rare threshold.

After a valid target is selected:

1. append one rarity-mutation event at the end-effects checkpoint;
2. reset Steady Growth progress to zero; and
3. recompute all equipped, rarity, element, and candidate facts before later
   chronology.

If Steady Growth itself changes rarity before a threshold, preserve remaining
uses exactly as `CreditAccumulatedTime` does:

```text
new remaining = min(old remaining, new interval)
new progress = new interval - new remaining
```

If it targets itself at its own threshold, the already-reset progress remains
zero under the new interval.

## Persisted contract

Advance the strict authored document once, from schema `51` to `52`.

### Natural Selection

Add the complete successful-target result to ordinary `AuthoredTraitOption` and
the existing Echo last-run nested option shape. Structural decoding requires a
nonempty array of at most eight known nonblank trait keys. Contextual order,
early-completion legality, and current eligibility remain simulation policy so
upstream edits can retain an invalid but repairable sequence.

### Steady Growth

Persist only random targets, never progress:

- ordinary occurrences store a sparse `steadyGrowthTargetByPhase` map on
  `RoomEncounterState`; and
- a derived Boss completion stores one optional
  `bossCompletionSteadyGrowthTarget` on its owning biome plan.

Values are nonblank known trait keys. Absence means unresolved only when that
reached phase has a nonempty Steady Growth target domain; absence is the
complete derived no-op when the domain is empty. A semantic
`ReplaceSteadyGrowthTarget` command writes or clears the exact phase-owned
value in one history entry.

The exact `SteadyGrowthOutcomeAddress` contains the ordinary occurrence or
Boss completion owner plus its declaration phase key. Codec and command
validation reject unknown structural owners and phase keys but preserve
context-invalid known targets.

### Migration

The `51 -> 52` migration changes schema/catalog metadata only. It does not
invent Natural Selection sequences or future Steady Growth targets. Existing
selected Natural Selection and reached Steady Growth frontiers therefore load
as structurally valid unresolved authoring and receive ordinary exact findings.

Update the JSON migration CLI and its direct tests. Migrate all named schema-51
checkpoints, refresh canonical hashes and metadata, and prove:

- each exact schema-51 fixture migrates to strict schema 52;
- strict decode and canonical re-encode succeed; and
- no semantic field other than explicitly authored new outcomes changes during
  migration.

Do not add a schema-51 compatibility decoder or runtime repair.

## Simulation, candidates, and findings

### One acquisition pipeline

Apply immediate selected-trait effects through the existing generic selected
trait settlement, after the outer trait is equipped and before later
acquisitions. Natural Selection and Ransoms must work for every supported
source that can select those traits, including ordinary rewards, Shops,
Devotion, recreated Echo rewards, and Echo's nested previous-run boon path.

Do not switch on reward game names or create source-specific effect handlers.

### Natural Selection candidate product

Publish one exact candidate capability at `NaturalSelectionResultAddress`.
Given the current complete draft prefix, it returns only targets legal for the
next round-robin position and whether the prefix is complete. Completion is
true at eight targets, or earlier only when the next-target domain is empty.
The application may walk that capability through an up-to-eight-step transient
draft, but it cannot derive which keys remain in the round or decide that a
short prefix is complete.

The complete selected assessment validates every authored position and its
terminal condition against one pre-acquisition history. Branch support must
preserve one complete sequence; the application cannot union per-position
candidates from incompatible branches.

Findings distinguish missing and unavailable complete results and route to the
selected trait dialog. A valid result appends exactly the one to eight authored
level mutations.

### Ransom derived product

Publish a data-only acquisition assessment containing:

- removed trait keys;
- removed count;
- total level bonus;
- buffed target keys; and
- the resulting trait history.

The policy matrix remains in engine tests. The application consumes the
assessment only for read-only presentation and must not recalculate provider
membership or level totals.

### Steady Growth checkpoint product

At each reached qualifying threshold, publish:

- exact occurrence/completion and phase owner;
- progress and required interval before settlement;
- the authored target, if present;
- selected assessment and findings; and
- an opaque branch-aware target capability.

An unavailable or missing target blocks at that exact end-effects frontier and
preserves the prefix needed to render its timeline row and repair control. An
empty domain settles as a no-op. A valid target applies one rarity mutation and
continues from the changed trait state.

Retained outcome values in unreached phases, phases before Steady Growth was
acquired, phases after it was removed, and non-threshold phases remain dormant:
no finding, control, marker, or history mutation.

## Application and UI contract

### Natural Selection

Render its active result in the existing selected-trait outcome region. Use a
compound contextual draft with up to eight positions and one final whole-offer
commit. The engine capability decides whether another position is required or
the current short result is complete. This is the same interaction language
already used by All Together: one compact outcome summary, an active contextual
picker, local incomplete draft state, and one complete trait-offer save. Do not
add a second Natural Selection dialog or a parallel compound-draft controller.

Narrowly extract the existing `AllTogetherOutcomeEditor` workflow into a
shared selected-trait compound-outcome presentation used by both consumers.
Keep only presentation mechanics in that shared leaf:

- ordered compact result rows;
- opening or resuming one row's contextual picker;
- local cancel/reset behavior;
- advancing to the next incomplete row; and
- one callback when the complete authored result is ready.

All Together continues to supply its four independent declaration-set rows and
domains. Natural Selection supplies up to eight ordered positions and reloads
the next engine-backed domain against the current complete draft prefix. The
shared React leaf does not infer early completion, round completion, candidate
exclusion, set membership, or whether one draft is supported. Those remain in
their existing engine/application owners.

The Natural Selection summary aggregates repeated targets into resulting
per-trait level counts so it stays compact instead of rendering eight verbose
cards. Individual positions remain reopenable for repair through the same
compound editor.

The picker consumes only engine-published next-position candidates. Canceling
does not persist a partial sequence. Saving adds one history entry; Undo
restores the exact prior offer. Invalid retained values stay visible and
repairable.

Do not change All Together's authored result, addresses, candidate policy, or
semantic command merely to share this presentation. Natural Selection is not
an All Together result, a Pom pickup, or eight independent Poms. The shared
leaf is deliberately not a generic trait-effect editor.

### Ransoms

Render one compact read-only selected outcome, for example:

```text
Removes: Zeus — 3 traits
Hera level gain: +12 each
```

The preview may list affected trait labels on expansion, but it has no editor,
remove button, timeline action, or persisted result. Run State after the
acquisition is the authority for the resulting equipped set and levels.

### Steady Growth

Extend the engine-owned Room Timeline product with a fixed automatic-effect
entry. It is placed after the exact phase's End encounter boundary and before
the next phase or Cleanup. In a derived Boss timeline it follows End encounter;
Judgment remains earlier at Boss defeated.

The row is neither ranked nor included in `roomActions.order`. It has no drag
handle, position selector, participation checkbox, or delete action. It shows:

```text
Steady Growth · Increase rarity
<target preview or Edit target>
```

The target control uses the existing contextual trait picker language, with
rarity-eligible candidates rather than Pom candidates. Missing/unavailable
styling follows the existing grey/red/green trait-outcome convention. Finding
navigation focuses the row and reopens its editor.

Extract the smallest single-random-trait-target presentation from
`PomResolutionEditor` and use it for both the Pom random branch and Steady
Growth. The shared leaf owns only the target picker, current label, feedback
slot, and save/cancel presentation. Each caller retains its own interaction:

- Pom continues to load `LevelResolution` candidates and dispatch
  `ReplaceLevelResolution`; and
- Steady Growth loads the phase-owned rarity-target capability and dispatches
  `ReplaceSteadyGrowthTarget`.

Do not register Steady Growth in the Pom/level-resolution interaction map, call
it a Pom, or route it through a fabricated reward acquisition. Similar UI
shape does not make their engine semantics interchangeable.

Run State exposes Steady Growth's current progress and interval on the equipped
trait so users can understand why a future fixed row appears. React does not
count events or predict the threshold.

## Delivery gates

### Gate A — Catalog, schema, and engine semantics

Deliver one coherent engine-owned semantic slice:

- catalog version `0.32.0-run-impacting-traits` and strict declaration/compiler
  products;
- level-bearing versus Pom-target predicates;
- target-owned Hephaestus in-run upgrade limits and shared consumption by
  Poms, Natural Selection, Bridal Glow, and Steady Growth, with Proper
  Upbringing explicitly outside that restriction;
- schema 52, migration CLI, checkpoint migration, exact addresses and commands;
- Natural Selection result assessment, candidates, findings, and one-to-eight
  successful level mutations;
- Ransom removal/level transforms and derived assessment;
- Steady Growth progress, end-effects settlement, authored target candidates,
  findings, and rarity mutation;
- ordinary occurrence and Boss-completion storage contacts; and
- data-only evaluation products required by the application.

Primary Gate-A tests:

- catalog closure and mutation tests for all exact constants, ownership, and
  illegal extra/missing declaration fields;
- schema-52 codec, migration, canonical encode, command, one-step Undo, and
  retained-invalid tests;
- Natural Selection one/five-target round matrices, no repeat before a round
  completes, stable surviving order, ordinary eight-mutation completion,
  source-valid early exhaustion, invalid voluntary early stop, dormant child,
  branch agreement, and Echo nested acquisition contact;
- Ransom Apollo/Zeus Duo origin-independence, distinct removal count,
  non-core buff target, block-stacking exclusion, self retention, opposite
  direction, and unchanged historical provider/use facts;
- removal recomputation of slots, elements, rarity counts, and downstream
  candidates;
- Steady Growth `6/5/4/3` intervals, qualifying versus skipped end effects,
  N subroom exclusion, multi-encounter phases, acquisition timing, empty and
  nonempty target domains, self low-priority rule, Hephaestus two-second
  exclusion, progress credit after rarity change, Boss ordering, and removal;
- exact Common/Rare/Epic/Heroic Hephaestus boundaries through ordinary Pom and
  Natural Selection level targets plus Bridal Glow and Steady Growth rarity
  targets, including dynamic Natural Selection removal after a target reaches
  its cap;
- Proper Upbringing promotion of a cooldown-capped Common Hephaestus trait to
  Rare without making the shared in-run upgrade helper a universal rarity
  guard;
- branch-local missing/unavailable Steady threshold artifacts at ordinary and
  Boss owners, exact sparse command/Undo contacts for both owner shapes, and
  the shared progressive child-retention path witnessed once by the real
  Natural Selection workflow; and
- fixture migration/integrity.

During implementation use focused catalog/engine/fixture tests and changed-file
static checks. Before Gate A is committed, run the catalog, engine, fixture,
typecheck, lint, formatting, and diff-check lanes once. Do not run the complete
repository suite repeatedly.

Intended commit:

```text
feat(traits): model selection ransom and steady growth effects
```

### Gate B — Workspace and React authoring

Deliver the application projection and editor slice over Gate A's supported
products:

- Natural Selection result requirement, candidate binding, compound draft,
  finding marker, focus destination, save, and Undo workflow;
- extraction of the current All Together compound-outcome presentation and its
  reuse by both All Together and Natural Selection, with no parallel Natural
  editor;
- Ransom read-only derived preview;
- Steady Growth fixed timeline entry for ordinary and Boss owners, contextual
  target interaction, finding route, and progress presentation in Run State;
- extraction of the Pom random-target presentation and its reuse by Steady
  Growth without sharing Pom domain or command semantics;
- no generic Poms, Room Actions, or effect-policy reconstruction in the app;
  and
- deletion of any temporary or superseded adapter path added during the gate.

Primary Gate-B tests:

- interaction binding dispatches one complete Natural Selection offer and one
  exact Steady target command;
- selected/unselected Natural child ownership and finding navigation;
- one real trait-dialog workflow with eight legal positions, one early-exhausted
  result, one history entry per saved result, and Undo;
- an unchanged All Together workflow through the extracted shared compound
  presentation;
- one Ransom acquisition preview whose labels and totals come from engine data;
- one ordinary multi-encounter timeline showing the Steady row at the exact
  phase without move/remove controls;
- one Boss timeline proving `Boss defeated -> Judgment -> End encounter ->
Steady Growth`;
- retained-invalid Steady target repair and no row at dormant/non-threshold
  phases;
- one Pom random-target regression proving the extracted shared target leaf
  preserves existing Pom behavior; and
- representative product-loop continuation after each of the three effects.

Use focused planner, contract, UI, and product tests while developing. Before
Gate B is committed, run only the proportional changed lanes, typecheck, lint,
formatting, build, and diff check. The full repository gate remains reserved
for closure.

Intended commit:

```text
feat(editor): author automatic trait outcomes
```

### Gate C — Durable absorption and phase closure

After Gates A and B are stable:

- absorb the new catalog, authored, lifecycle, simulation, candidate, and UI
  ownership into their smallest stable documents;
- update the run-impacting trait audit's Planner disposition without erasing
  source facts or the Sea Star/Buried Treasure/Quick Buck deferral;
- update `IMPLEMENTATION_PROGRESS.md` with exact commits and truthful
  validation evidence;
- delete this temporary plan; and
- run one complete `npm run check` closure gate.

Do not rerun the full gate for documentation-only corrections after a clean
closure result unless code, tests, fixtures, configuration, or generated
artifacts change.

Intended commit:

```text
docs(traits): absorb run-impacting trait effects
```

## Adversarial guard rails

The implementation is not accepted if it:

- persists final equipped state, Ransom removed sets, Ransom level totals, or
  Steady progress snapshots;
- lets Natural Selection repeat a target before the current eligible round is
  exhausted;
- lets Natural Selection stop below eight while an engine-backed next target
  remains, or fabricates further targets after the domain is exhausted;
- derives Ransom membership from acquisition origin instead of provider index
  membership;
- broadens ordinary Pom eligibility while expanding the level-bearing ledger;
- duplicates the Hephaestus cooldown limits in any Pom, Natural Selection,
  Bridal Glow, or Steady Growth consumer instead of reading the target
  declaration;
- applies the Hephaestus in-run upgrade threshold to Proper Upbringing or any
  other rarity transition whose source path does not consult that check;
- treats `encounterCompleted` as the Steady Growth clock;
- creates an authored/movable Room Action for Steady Growth;
- invents a generic automatic-effect scheduler or generic trait-effect DSL;
- adds a bespoke Natural Selection compound editor beside the existing All
  Together workflow;
- duplicates the Pom random-target picker for Steady Growth or reuses Pom's
  engine address/command for it;
- makes application or React code calculate candidates, counters, provider
  membership, level totals, or fixed-effect placement;
- hides incomplete/context-invalid authored state instead of preserving its
  exact repair path; or
- begins Sea Star, Buried Treasure, Quick Buck, money, or generated-pickup
  modeling inside these gates.

The intended production growth is one closed catalog fact family, two small
authored outcome shapes, one reuse of existing chronological level/removal/
rarity events, and their exact candidate/presentation contacts. Any broader
framework requires a demonstrated current consumer and deletion of an existing
parallel path.
