# Generated-Pickup Trait Effects Implementation

## Status

Locked delivery plan grounded on base commit `9337dd4` and the source-complete
[run-impacting trait effects audit](../audits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md).
The audit correction and this plan must be committed before implementation
begins.

Independent adversarial review found no remaining P1 or P2 issue. It confirmed
that the plan corrects both live Artificer optionality leaks, replaces the
singular encounter-only pickup producer without adding another timeline,
preserves the source distinction between Pom Slices and full Poms, and can use
closed acquisition-site keys without changing authored schema 52.

A reuse-focused rereview additionally required the plural adapter to preserve
Echo Last Reward's structurally owned dormant option entries separately from
its one active selected instance. That correction is incorporated below; the
rereview found the one-pipeline generalization and retirement boundary sound.

This is temporary delivery authority. It must not be linked from `README.md`
or stable design documents. At phase closure, absorb the completed contracts
into the smallest durable catalog, reward, authored-project, lifecycle,
simulation, and workspace authorities; update the durable implementation
record; and delete this plan.

Owning stable authorities are:

- [`CATALOG_MODEL.md`](../design/CATALOG_MODEL.md);
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md);
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md);
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md);
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md);
- [`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md);
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md);
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md);
  and
- [`TRAIT_LEVELS_AND_POMS.md`](TRAIT_LEVELS_AND_POMS.md), for the existing Pom
  and Pom-Slice acquisition semantics.

## Objective

Close the remaining supported run-consequential trait effects in four ordered
gates:

1. correct Artificer so every generated replacement is a required pickup;
2. make Quick Buck and Buried Treasure create their exact same-room optional
   pickups after the selected trait acquisition;
3. make Sea Star author one duplicate-or-not result at every exact eligible
   normal pickup and materialize the correct second acquisition; and
4. absorb the finished model into durable authorities and close the temporary
   delivery plan.

The resulting product must use the existing acquisition-entry, Room Action,
ordinary reward settlement, Echo last-reward, Time Piece, Artificer, Pom, and
workspace systems. It must not add a generic reward-copy model, a second room
timeline, a timer simulator, or a general trait-effect language.

There is one generated-pickup pipeline. Narcissus, Echo Last Reward, Quick
Buck, Buried Treasure, and Sea Star differ in how a producer becomes active,
where its acquisition site is placed, whether its entries are required, and
how each entry's reward is derived. After that producer boundary, they use the
same authored acquisition-site state, Room Action references, acquisition-role
settlement, candidates, findings, and workspace rows.

## Included scope

- required Artificer replacement participation for optional and required
  sources;
- exact declaration-owned duplication capability on every concrete
  acquisition currently supported by the Planner;
- exact Quick Buck and Buried Treasure pickup declarations and producer
  bindings;
- multiple producer-owned instances of the existing acquisition-site pipeline
  in one occurrence, each owned by its exact source interaction rather than by
  a room-global singleton;
- existing `interactAcquisitionEntry` chronology for generated and duplicated
  pickups;
- Sea Star result authoring on eligible normal acquisition roles;
- distinct consumable/resource and loot duplication behavior;
- independent second-use Pom-Slice targets and fresh second-Pom targets;
- exact Echo last-reward, Time Piece, Artificer, requiredness, and ordering
  contacts;
- retained-invalid state, candidate support, findings, focus, save/load, and
  one-step Undo at the new semantic owners;
- schema-52 catalog-only migrations and checkpoint metadata/hash refreshes;
- compact manifest-backed N fixtures for the representative full product
  workflows; and
- durable documentation absorption and one complete closure gate.

## Explicit exclusions

- carried Gold, Ashes, Psyche, Bones, or other resource arithmetic;
- Quick Buck's later money multiplier and Buried Treasure's later resource
  multipliers;
- the ordinary external World Upgrade through which any eligible Bones pickup
  can add Max Magick; that numeric amount is simulation-neutral;
- Dream Dive topology, `CanSpawnDreamReward`, the Dream-required override, or
  teleport-before-delayed-spawn execution;
- modeling the `0.2`/`0.5` second delays as clocks or timers;
- simulating Sea Star probability, Luck, seeds, or likelihood; the Planner
  authors the realized proc result only;
- Wells, Shrines, or new pickup identities not already required by these three
  traits and the current supported concrete acquisition set;
- a recursive authored reward tree, generic clone command, effect registry,
  callback DSL, scheduler, service, or mutable capability ledger;
- changing ordinary reward bags, provider availability, Pom eligibility,
  trait rarity, or room topology; and
- broad Artificer redesign beyond the requiredness and Sea Star capability
  contacts proved by current source.

## Source facts and chosen Planner representation

### Generalize the existing generated-pickup adapter; do not reimplement it

The existing Narcissus and Echo Last Reward behavior already establishes the
correct shared mechanism:

- `RoomOccurrence.acquisitionSites` persists the generated entries;
- `interactAcquisitionEntry` places each participating pickup in room
  chronology;
- `settlePickupAcquisitionSite` applies the ordinary acquisition-role fold;
- the existing candidate and finding products own incomplete nested rewards;
  and
- the existing acquisition row renders and edits the pickup in the workspace.

Gate B generalizes only the producer adapter around that mechanism. Replace the
singular, encounter-only `selectedPickupProducer` query with a plural exact
producer-instance projection. Each instance supplies its semantic source
owner, acquisition-site address, lifecycle placement, producer lifecycle,
fixed or history-derived entries, and required-entry set. Migrate Narcissus
and Echo Last Reward through that projection before adding Quick Buck and
Buried Treasure.

The projection distinguishes structural ownership from active participation.
Echo Last Reward structurally owns one retained source-scoped entry for every
eligible offered option, while only the selected option activates its instance
and Room Action. Switching away from an Echo option must leave its authored
replay reward and nested children dormant so switching back reactivates the
same detail. The plural adapter therefore replaces both today's
`echoLastRewardPickupEntryKeys` structural query and its selected-producer
query; it must not derive structural persistence from active instances alone.

The settlement authority must accept the exact existing acquisition-site
address instead of constructing `roomExit` internally. Materialization and
simulation enumerate active producer instances and call that same authority;
they do not add trait-specific settlement functions. Once all current owners
use the generic acquisition-site product, remove the singular
`CanonicalAuthoredRoom.pickupSite` compatibility projection and the
`roomExit`-only selected-producer branches it supported. Narcissus keeps its
current `roomExit` address and behavior as one producer instance; reuse does
not mean forcing every producer onto the same lifecycle point.

This generalization must leave one acquisition-entry settlement authority, one
candidate/finding family, and one workspace acquisition-row family. A new
generated-pickup state union, result tree, settlement loop, candidate map, or
React row is out of scope.

### Artificer replacement is always required

Artificer remains one mutually exclusive disposition on the source acquisition
role. An optional source may still be left alone. If the player chooses
Artificer, however, the game destroys that source and creates a normal Run
Progress replacement object. That replacement is required even when the source
was optional.

The existing replacement entry and `interactAcquisitionEntry` row remain the
only authored replacement. Correct both current consumers:

- Room Action assembly must publish the replacement with required
  participation, retain its dependency after the converted source action, and
  retain only the source-derived lifecycle window; and
- reward settlement must receive required participation instead of the current
  hard-coded optional value.

The source action itself does not become mandatory merely because it could use
Artificer or retains an Artificer disposition while unpicked. The replacement
contribution becomes active only when that exact source action participates and
its disposition is Artificer. From that point the replacement row is mandatory
and blocks exit until settled. Removing the optional source action deactivates
the replacement while retaining structurally valid dormant detail. Do not add
an Artificer-specific order or replacement queue.

### Quick Buck and Buried Treasure equip and produce pickups

The current `producePickups` selected disposition is used by Narcissus
descriptors, which do not enter equipped-trait history. Extend that exact
closed disposition with an explicit `equipsSelection` boolean:

- every Narcissus declaration states `false`;
- Quick Buck and Buried Treasure state `true`.

The engine equips only the latter two while keeping one bounded pickup
declaration shape. Do not infer this distinction from provider kind or trait
key, and do not add a general composition-of-effects language.

Quick Buck declares one fixed generated entry:

```text
quickBuckGold -> RoomMoneyDrop
```

Buried Treasure declares six stable entries rather than a quantity mechanism:

```text
smallGold -> RoomMoneySmallDrop
tinyGold1 -> RoomMoneyTinyDrop
tinyGold2 -> RoomMoneyTinyDrop
minorHeal1 -> HealDropMinor
minorHeal2 -> HealDropMinor
bones -> MetaCurrencyDrop, outside a Story forced-reward context
```

The catalog owns the fixed identities, order of declaration, producer
lifecycle, source-specific acquisition overrides, and the narrow Bones
condition. The compiler validates exact ownership and rejects missing, extra,
renamed, reordered, or malformed entries. It must not introduce generic count,
chance, or arbitrary pickup-requirement syntax for these fixed lists.

All six Buried Treasure objects and Quick Buck Gold are optional in the
currently supported non-Dream product. Presence in the acquisition site means
the object was generated; membership in `roomActions.order` means the player
interacted with that optional object. Their pickup order is player-authored and
need not match spawn declaration order.

The generated site is keyed to the exact source trait acquisition, not to a
single occurrence-wide `roomExit` producer. This permits the same effect to be
selected from ordinary incoming rewards, Devotion roles, Shops, wheels,
Fields, Echo-derived entries, or later supported acquisition owners without a
source-name switch. Each active generated entry:

- uses the existing `AuthoredRewardState` and acquisition-entry address;
- depends on the source trait acquisition;
- becomes usable at the first existing Room Action window after that source;
- remains available through the room's ordinary cleanup boundary; and
- settles through the existing ordinary acquisition-role fold.

Selection in authored offer data is not sufficient to generate the objects.
The source acquisition role must participate, settle normally, and actually
acquire the selected trait. An unpicked optional offer, unpurchased Shop entry,
Time Piece conversion, Artificer conversion, missing child, or rejected trait
selection produces no active generated site. Once Quick Buck or Buried
Treasure has been acquired and its objects generated, later removal of that
equipped trait does not despawn the already-created pickups; activation is
owned by the historical acquisition checkpoint, not current equipped state.

The Planner does not add a combat-time interaction window to reproduce the
short source delay. A source acquired before combat publishes the generated
pickup at the next existing authorable pickup window. This is the bounded
Planner simplification until a future Dream/teleport feature supplies a real
room-ending fact.

The plural producer-instance projection supports every reached trait
acquisition owner. An occurrence may own multiple generated sites, but every
site has one semantic source acquisition and one declared producer. Keep
Narcissus's post-outgoing `roomExit` behavior unchanged through the shared
projection rather than a Narcissus-specific branch.

An ordinary selection command atomically establishes or removes the fixed
generated site for its selected producer. It also reconciles only the actions
owned by that site. It must not rewrite unrelated acquisition sites, Echo
children, Artificer replacements, or another selected producer in the same
occurrence.

### Exact Quick Buck and Buried Treasure acquisition effects

Add concrete acquisition declarations for `RoomMoneySmallDrop` and
`HealDropMinor`; keep the existing declarations for `RoomMoneyDrop`,
`RoomMoneyTinyDrop`, and `MetaCurrencyDrop`.

The supported matrix is:

| Generated pickup            | Sea Star | Echo last reward | Time Piece | Artificer |
| --------------------------- | -------- | ---------------- | ---------- | --------- |
| Quick Buck `RoomMoneyDrop`  | yes      | yes              | no         | no        |
| Buried `RoomMoneySmallDrop` | yes      | yes              | no         | no        |
| Buried `RoomMoneyTinyDrop`  | yes      | no               | no         | no        |
| Buried `HealDropMinor`      | no       | no               | no         | no        |
| Buried `MetaCurrencyDrop`   | yes      | yes              | yes        | no        |

Buried Treasure's producer-local Bones binding blocks Artificer despite the
ordinary `MetaCurrencyDrop` declaration supporting it elsewhere. Reuse the
existing producer-local conversion override rather than changing universal
Bones behavior.

Each normal eligible pickup updates Echo last-reward through the existing
concrete-acquisition declaration. Skipped optional rows and Time Piece
conversion do not. Consequently the authored order between small Gold, Bones,
and other last-reward participants remains semantically observable.

### Sea Star is an acquisition result, not a copied reward

Add one closed equipping selected disposition for Sea Star. The normalized
trait identity only declares that the equipped trait enables duplication.
Chance and Luck remain source evidence because simulation models possibility,
not probability.

Every normalized concrete acquisition declaration owns exact
`canDuplicate: boolean`. Populate and compiler-attest this fact for the entire
currently supported acquisition set. The engine must ask the resolved concrete
object and instance context; it must not infer duplication from reward type,
`loot` versus `consumable`, provider, label, or Time Piece eligibility.

At one reached acquisition role, Sea Star support exists only when all are
true at its pre-acquisition frontier:

1. Sea Star is currently equipped;
2. the source disposition is normal pickup, not Time Piece or Artificer;
3. the resolved concrete acquisition declares `canDuplicate`;
4. the producer instance has not disabled duplication; and
5. the source is not itself a Sea Star second acquisition.

If Sea Star is removed after a successful proc, the already-materialized
second object remains. Current equipped state controls whether the roll can
occur at the source frontier; it does not retroactively erase a realized
pickup.

Expose one authored `Sea Star procced` boolean in the existing pickup-outcome
control. Persist the positive result through the presence of one source-scoped
duplicate acquisition entry. Absence means the proc did not occur. Do not add a
separate random-result ledger or a boolean to every acquisition disposition.

Checking the control atomically creates the duplicate entry and its required
Room Action membership when applicable. Unchecking explicitly removes that
entry and its action as one undoable semantic command. Changing the parent to
Time Piece or Artificer makes the retained Sea Star result dormant and removes
it from active chronology without inventing a proc on the conversion path;
returning to normal may reactivate the retained result. Unrelated authored
children are never rewritten.

The duplicate entry is always ordered after its source action. It may appear
later among other legal actions in the same room; the game does not require
immediate adjacency.

### Consumable/resource success retains the same object

For a `consumable` or `resource` source, the first normal acquisition applies,
then the same world object remains for one more interaction with
`CanDuplicate = false`.

The Planner represents that second interaction as another acquisition entry
because it owns a second chronological effect, while its instance facts retain:

- the same concrete acquisition identity;
- the source object's required or optional participation;
- the source object's Time Piece and Artificer capability after producer
  overrides; and
- no Sea Star capability.

The second acquisition owns independent effect detail when the effect is
rerolled on use. In particular, a Pom Slice (`StoreRewardRandomStack`) retains
the same object and participation but authors a new random level target for its
second use. It is not treated as a full Pom loot object.

A second normal use updates ordinary acquisition and Echo last-reward history
again when the declaration supports it. If the retained object is Time Piece
or Artificer eligible, the player may instead choose that disposition for the
second interaction.

### Full Pom success creates a fresh required Pom

The only currently supported duplicable loot family is `StackUpgrade`,
`StackUpgradeBig`, and `StackUpgradeTriple`. On success, the game consumes the
first Pom and creates a fresh full Pom of the same game name.

The second Pom:

- is required regardless of whether the first Pom was required, optional, or
  paid;
- owns a fresh unresolved Pom result and therefore a separately authored
  target/choice;
- inherits declaration-owned Time Piece capability;
- is not Artificer eligible; and
- cannot trigger Sea Star recursively.

Do not copy the first Pom's price, Shop ownership, generated options, rarity
context, stack payload, or participation. Do not call this branch a Pom Slice.

### Artificer and Sea Star instance interaction

Time Piece or Artificer applied before normal pickup destroys or replaces the
source and never exposes a Sea Star result.

An Artificer replacement may expose Sea Star only when both the original
source instance and generated replacement declaration are duplication-capable.
The existing replacement settlement has both facts and derives the result; do
not persist mutable capability state. If Sea Star already retained the source,
that source instance has become nonduplicable, so a later Artificer replacement
cannot regain Sea Star eligibility.

This contact consumes Gate A's corrected required replacement row. It does not
change Artificer's bag, charge, or replacement-selection rules.

## Authored ownership, commands, and strict decoding

Continue using `RoomOccurrence.acquisitionSites`, `AuthoredAcquisitionSiteState`,
`AuthoredRewardState`, and `interactAcquisitionEntry`. Add closed source-scoped
site-key constructors/parsers for:

- trait-generated pickup sites; and
- Sea Star duplicate sites.

These keys are addresses for instances of the existing acquisition-site
shape, not new persisted site variants. Keep the existing Artificer site and
Narcissus `roomExit` site distinct. The decoder must identify each supported
site owner explicitly; it must not treat every non-`roomExit` site as
Artificer and must reject unknown encodings, duplicate semantic owners,
foreign entries, and malformed source addresses.

Use semantic commands for:

- toggling one Sea Star result, including its child and action membership; and
- the existing whole-offer trait selection, extended to reconcile only the
  generated sites owned by the changed offer.

Ordinary acquisition disposition, nested reward/Pom editing, Room Action
participation, movement, and Undo continue using their existing commands. Do
not add per-trait Quick Buck or Buried Treasure commands.

Schema remains `52`. The existing authored shapes already persist arbitrary
closed acquisition sites, reward entries, and action references. Each catalog
change uses the existing schema-52 metadata-only migration chain:

- Gate B: `0.32.1-run-impacting-traits -> 0.33.0-generated-trait-pickups`;
- Gate C: `0.33.0-generated-trait-pickups -> 0.34.0-sea-star`.

Refresh all strict checkpoint metadata and hashes at each independently green
catalog commit. Do not add compatibility fields or a second migration tool.

## Simulation, candidates, findings, and application projection

Each generated or duplicate entry must pass through the existing
acquisition-role settlement. That single path owns:

- normal history and use records;
- nested trait/Pom results;
- Echo last-reward updates;
- Time Piece and Artificer choices;
- branch-local candidate assessment; and
- continuation blocking for required children.

Extend the existing acquisition-role candidate product with exact Sea Star
support. Do not introduce an ambient Sea Star query or second candidate system.
A retained active result that is no longer legal publishes one finding at its
source acquisition role and one repair action. Dormant, unreached, unpicked,
or conversion-only roles publish no control, marker, or destination.

Application projection adapts these engine products only. React adds the
checkbox to the existing pickup-outcome neighborhood and renders generated
entries through the existing Room Timeline acquisition row. It does not decide
duplication eligibility, requiredness, recursion, source identity, or Pom
freshness.

Echo Last Reward and Narcissus remain regression witnesses for this shared
path. Their existing command, candidate, finding, Room Action, and workspace
behavior must remain on the same generalized code path used by the new
producers; parallel legacy and new paths are not an acceptable intermediate
or final state.

The full product workflow is:

```text
normal eligible pickup participates
  -> engine publishes Sea Star support
  -> user authors proc/no-proc
  -> proc materializes one source-scoped acquisition entry
  -> Room Timeline orders the second pickup after its source
  -> ordinary acquisition settlement folds its exact result
```

## Gate A — Correct Artificer replacement requiredness

### Deliverables

- replacement Room Action participation is always required;
- settlement receives required participation;
- activating Artificer inserts/proposes the required replacement after its
  source and prevents its removal while the disposition remains active;
- optional source omission remains legal before Artificer is chosen;
- current lifecycle windows, replacement identity, bag use, and conversion
  history remain unchanged; and
- stale documentation assertions and comments that say optionality is
  inherited are corrected or reserved for Gate D absorption.

### Primary tests

- participating optional Narcissus/Fields source -> Artificer -> required
  replacement;
- dormant/unpicked optional source with retained Artificer detail -> no active
  replacement requirement;
- required source -> required replacement;
- replacement is ordered after source and blocks Cleanup/exit if missing;
- removal is rejected while Artificer owns the replacement;
- normal replacement acquisition still owns its nested reward/trait/Pom and
  Echo history; and
- one-step Undo restores the prior source disposition and chronology.

### Commit

`fix(rewards): require artificer replacements`

## Gate B — Implement Quick Buck and Buried Treasure

### Deliverables

- catalog `producePickups.equipsSelection` closure;
- exact Quick Buck and Buried Treasure declarations, concrete acquisitions,
  producer lifecycle bindings, Bones override, and catalog regression;
- pluralize the existing producer-instance adapter, migrate Narcissus and Echo
  Last Reward through it, and delete the singular `selectedPickupProducer`,
  `pickupSite`, and `roomExit`-only compatibility path they displace;
- source-scoped trait-generated acquisition sites for every supported trait
  acquisition owner;
- multiple producers per occurrence without a room-global singleton;
- optional generated Room Actions with exact source dependencies;
- ordinary settlement, candidate, finding, navigation, save/load, and Undo;
- schema-52 catalog migration to `0.33.0-generated-trait-pickups`; and
- compact manifest-backed N checkpoints for Quick Buck and Buried Treasure.

### Primary tests

- compiler exact/malformed pickup lists and equipping ownership;
- Quick Buck equips, creates exactly one optional fixed Gold entry, and does
  not expose Time Piece or Artificer;
- Buried Treasure equips and creates exactly 1/2/2/1 fixed entries, with Bones
  omitted in the source Story context;
- all entries may remain unpicked; selected entries use one authored Room
  Action order independent of declaration order;
- selected-but-unacquired, Time-Pieced, or Artificer-converted Quick Buck or
  Buried Treasure produces no active pickup site;
- only Bones exposes Time Piece and no generated entry exposes Artificer;
- Quick Gold, small Gold, and Bones update Echo last reward normally; tiny Gold
  and minor heals do not;
- changing one source offer does not rewrite another generated site;
- Narcissus and Echo Last Reward retain their exact existing behavior through
  the plural producer adapter, with no second settlement or presentation
  path;
- switching an Echo Last Reward option away and back retains its exact replay
  entry and nested detail while dormant, then reactivates that same state;
- an incoming reward, one non-ordinary acquisition owner, and one multi-source
  occurrence prove the source-scoped adapter without duplicating the policy
  matrix; and
- UI pickup participation, nested editing, finding focus, save, and Undo use
  the existing acquisition-row components.

### Commit

`feat(traits): materialize generated pickup effects`

## Gate C — Implement Sea Star

### Deliverables

- exact normalized `canDuplicate` facts for the complete supported acquisition
  catalog and compiler closure against source;
- closed equipping Sea Star disposition;
- acquisition-role Sea Star candidate support and retained-invalid finding;
- one semantic proc toggle backed by a source-scoped duplicate entry;
- Sea Star duplicate entries feed the same generalized acquisition-site
  settlement, candidate, finding, Room Action, and workspace path as
  Narcissus, Echo, Quick Buck, and Buried Treasure;
- consumable/resource same-object participation and capability inheritance;
- full-Pom fresh required acquisition behavior;
- independent Pom-Slice and full-Pom second outcomes;
- Time Piece, corrected Artificer, Echo last-reward, Shop, optional, required,
  and no-recursion contacts;
- existing pickup-outcome checkbox and Room Timeline presentation;
- schema-52 catalog migration to `0.34.0-sea-star`; and
- manifest-backed N product checkpoints covering Quick Buck and Buried
  Treasure under active Sea Star.

### Primary tests

- direct capability matrix for every supported acquisition and malformed
  declaration mutation rejection;
- Sea Star appears only for a reached normal eligible pickup while active;
- Time Piece/Artificer first, absent Sea Star, unpicked optional sources, and
  ineligible declarations expose no active proc;
- Quick Buck Gold success produces an optional same-object second interaction,
  no recursion, and two chronological last-reward contacts when both uses are
  normal;
- Buried small/tiny/Bones support Sea Star, minor heals do not, and duplicated
  Bones retain Time Piece but not Artificer;
- a required consumable remains required and an optional consumable remains
  optional;
- Pom Slice retains its original participation and authors an independent
  second random level target;
- required, optional, and paid full Poms all create a fresh required Pom with
  an independent result and Time Piece support;
- an Artificer replacement exposes Sea Star only under the exact two-sided
  capability rule, and never after the source was already retained;
- switching the parent disposition deactivates without acquiring the dormant
  child; uncheck removes the child; Undo restores the exact prior document;
- branch disagreement does not publish false unified support; and
- real projection/UI workflows prove the checkbox, generated row, requiredness,
  nested Pom editor, finding destination, save, and Undo.

### Commit

`feat(traits): model sea star duplication`

## Gate D — Closure absorption

### Deliverables

- update the source audit's Planner disposition from deferred to implemented
  without erasing the Dream/teleport, probability, or external-profile facts;
- update `README.md` current-product coverage;
- absorb catalog capability, generated-site ownership, Artificer requiredness,
  Sea Star branch behavior, lifecycle chronology, findings, and workspace
  presentation into the smallest stable owning documents;
- update `IMPLEMENTATION_PROGRESS.md` with exact gate commits and truthful
  verification evidence;
- remove temporary gate language from production comments;
- delete this plan; and
- run one complete `npm run check` after all narrow implementation and review
  corrections are stable.

Gate D is documentation-only except for corrections required by the one final
closure gate. Do not rerun the complete suite merely to produce review evidence.

### Commit

`docs(traits): close generated pickup effects`

## Validation strategy

During implementation, use narrow owning lanes:

- catalog declaration/compiler tests for capability and producer closure;
- engine authored-command, codec, reward-processing, Room Action, Echo,
  Time Piece, Artificer, Pom, and progressive tests;
- fixture integrity for each metadata/hash update;
- planner projection/interaction tests for capability binding;
- UI tests for checkbox, pickup rows, finding focus, and Undo; and
- product tests only for representative cross-layer N workflows.

At each gate, run typecheck, lint/format/diff checks, and the proportional
package/build lanes required by the changed ownership. Do not claim a broad
lane passed when only focused tests completed or when the runner did not retain
its terminal result.

After Gate C is independently reviewed and remediated, run exactly one complete
repository gate in Gate D and record the actual result.

## Required independent review

Each implementation gate uses a fresh executor and a fresh read-only reviewer.
Review must specifically audit:

- no second acquisition scheduler or copy abstraction;
- Artificer source optionality versus replacement requiredness;
- exact site ownership for more than one producer in an occurrence;
- declaration-owned rather than category-inferred Sea Star capability;
- consumable/Pom-Slice versus full-Pom behavior;
- requiredness and exit blocking after source and duplicate actions;
- no recursive Sea Star path;
- branch-local candidate truth and retained-invalid repair;
- absence of application-owned eligibility or requiredness policy;
- no hidden Dream Dive, external-profile, probability, or resource-ledger
  expansion; and
- deletion or retirement of the singular encounter-only generated-pickup path
  and every superseded adapter.

The main session performs the final bird's-eye diff review and owns all commits.

## Stop conditions

Stop and return to planning instead of widening implementation if live code
shows that any of these are false:

- source-scoped acquisition sites can represent all supported trait-acquisition
  owners without a second persisted timeline;
- a Sea Star result can remain one non-recursive child entry rather than a
  recursive reward tree;
- full Pom freshness can reuse ordinary unresolved Pom authoring;
- same-object consumables can reuse ordinary acquisition settlement while
  carrying source participation and instance capability; or
- schema 52 can encode the closed sites and entries without a structural field
  addition.

Also stop if closing the three traits would require modeling Dream Dive,
external World Upgrades, carried resources, or probability. Those are explicit
future slices, not implicit acceptance criteria here.
