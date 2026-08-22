# Selene Spell Implementation

## Status

Locked delivery plan grounded on clean base
`0ebc9c5d2b05271fac9753e68204475b7b615966`. The plan was adversarially checked
against the live catalog, authored reward child, trait history/slot, Echo
replay, fixture, projection, and editor paths. That review corrected the Echo
boundary (`TalentDrop` replayable, `SpellDrop` not replayable) and replaced a
parallel spell ledger with the shared six-slot trait model before lock.

This is a temporary implementation plan. It must not be linked from the README
or stable design documents. At phase closure, absorb the completed model into
the smallest durable authorities and delete this file.

Owning evidence and stable authorities:

- [`SELENE_SPELL_GAME_DATA_AUDIT.md`](../audits/SELENE_SPELL_GAME_DATA_AUDIT.md)
- [`TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`](../audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md)
- [`CATALOG_MODEL.md`](../design/CATALOG_MODEL.md)
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md)
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md)
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)

## Objective

Make Selene's base Hexes real planner traits while reusing the existing
trait-offer, trait-history, reward-child, candidate, finding, and editor
machinery.

The user-visible result is:

- every non-Aspect-of-Selene Spell Drop owns three distinct choices from the
  exact eight-spell pool and one selected spell;
- choosing the Aspect of Selene starts the run with Sky Fall already equipped;
- Spell Drops acquired with that aspect remain real acquisitions but do not
  show a second spell selector because their Path of Stars outcome is outside
  this slice;
- the selected or starting spell affects later Artemis and Circe offer
  eligibility at the correct chronological checkpoint; and
- Reward Reward Reward never claims it can recreate a Spell Drop, while Talent
  Drop replay remains supported.

The feature must not create a Selene-specific authored offer type, parallel
spell ledger, candidate system, React eligibility rule, or Path of Stars
model. It extends the existing trait equipment-slot authority with the real
sixth `Spell` slot.

## Source facts and chosen simplifications

### The exact spell domain

The catalog declares nine real rarityless spell traits:

| Trait key             | Label          | Normal Spell Drop         |
| --------------------- | -------------- | ------------------------- |
| `SpellPolymorphTrait` | Twilight Curse | yes                       |
| `SpellMeteorTrait`    | Total Eclipse  | yes                       |
| `SpellTransformTrait` | Dark Side      | yes                       |
| `SpellLeapTrait`      | Wolf Howl      | yes                       |
| `SpellLaserTrait`     | Lunar Ray      | yes                       |
| `SpellSummonTrait`    | Night Bloom    | yes                       |
| `SpellTimeSlowTrait`  | Phase Shift    | yes                       |
| `SpellPotionTrait`    | Moon Water     | yes                       |
| `SpellMoonBeamTrait`  | Sky Fall       | no; Aspect of Selene only |

The planner retains its fully progressed save baseline. It does not model the
first-ever Selene pickup gates that temporarily narrow the eight-spell pool.
One normal Spell Drop offer contains exactly three distinct traits from those
eight and has no rarity, Pom level, ordinary-boon slot, element, god-pool, or
fallback-gold semantics.

### Aspect of Selene

`SuitHexAspect` owns one exact catalog link to `SpellMoonBeamTrait`. Route
initialization folds that linked trait into the existing trait history using
the existing direct-trait-grant event vocabulary at sequence zero. It must not
fabricate a trait offer or a reward acquisition.

For a Spell Drop reached under `SuitHexAspect`, the acquisition and use history
still settle. Its `self` trait-offer child is contextually dormant because the
game opens Path of Stars instead. `null` is therefore complete in this exact
context. A retained non-null spell offer remains preserved but dormant; it
emits no finding, candidate, control, or history effect. Switching to another
aspect makes that same child active again.

This uses the same persisted child shape in both contexts. Do not add a
persisted `deferred`, `pathOfStars`, or aspect-specific reward union merely to
represent unsupported talent authoring.

### Exact chronology

A normal spell enters `TraitHistoryState` and fills its `Spell` equipment slot
only when its Spell Drop acquisition is actually settled. Generating,
previewing, purchasing without interaction, or merely authoring the three
choices does not equip it. Downstream Artemis and Circe assessment consumes
that exact trait history through their existing `anyEquippedTrait`
requirements.

Sky Fall is present in the initial route trait history before any room or
offer checkpoint. No later Aspect-of-Selene Spell Drop adds or replaces a base
spell in this slice.

### Echo replay correction

`SpellDrop` is not `LastRewardEligible` and cannot be recreated by Reward
Reward Reward. Remove the current erroneous `lastRewardRecreation` declaration
from its acquisition catalog entry. `TalentDrop` is `LastRewardEligible` and
must retain its current replay declaration and behavior. This correction is
owned by the acquisition catalog and reward history; it must not be a special
Echo UI filter.

### Closed second-Spell-Drop guard matrix

The game prevents a second spell through source-specific acquisition guards,
not through a spell-replacement menu. The planner must preserve the complete
supported matrix:

- normal reward and store eligibility requires zero prior `SpellDrop` uses;
- one room/shop cannot offer or select Spell Drop twice: current reward,
  pending Spell Drop, current shop options, Hub board, and already-offered
  reward facts all participate at their existing exact checkpoints;
- Travel Deal's same-shop refill consumes those exact already-offered and
  acquisition-history facts, so buying Spell Drop cannot refill another;
- Reward Reward Reward cannot replay Spell Drop because it is not
  `LastRewardEligible`;
- Gold Gold Gold explicitly excludes Spell Drop from its duplicated purchase;
- the existing Artificer replacement domain excludes Spell Drop;
- Aspect of Selene routes a later Spell Drop to Path of Stars rather than a
  second base-spell choice; and
- Dream-run rotating Spell Drops remain outside this phase.

These guards remain owned by reward requirements, source declarations, and
settlement chronology. Do not replace them with a global UI rule. The shared
Spell slot is the final structural attestation that no supported history can
contain two simultaneously equipped base Hexes.

### Explicit exclusions

This phase does not implement:

- Path of Stars talents, talent points, or `allSpellInvested`;
- Moon Water use counts or fountain refresh;
- spell damage, charge, mana, or cast behavior;
- Dream-run rotating spell drops;
- first-ever Selene progression gates;
- the Aspect-of-Selene Path of Stars editor;
- Transcendent Embryo, Chaos traits, or Chaos maturation;
- a second concurrent spell slot or a spell-replacement offer flow; or
- new Shop, Travel Deal, Gold Gold Gold, Artificer, or Time Piece policy.

Existing disposition behavior remains authoritative. A Spell Drop converted
before acquisition does not equip a spell, and the existing Artificer
exclusion remains unchanged.

## Locked ownership and model

### 1. Catalog owns spell identity and provider facts

Add one exact rarityless Selene trait giver keyed by the acquisition game name
`SpellDrop`. It owns the ordered eight-trait normal pool, an empty priority
set, and no rarity policy. Extend the closed provider-kind vocabulary with
`spell`; do not classify Selene as an NPC, Olympian, Hermes, or Hammer merely
to reuse presentation behavior.

Add all nine `TraitDeclaration`s with the existing equip disposition and explicit
rarityless facts. Every spell declares the shared `Spell` equipment slot.
Remove the nine base spell keys from deferred operands while leaving every
Path of Stars talent deferred.

Extend the aspect declaration with one optional exact linked starting trait.
Only `SuitHexAspect` supplies `SpellMoonBeamTrait` and identifies `SpellDrop`
as its provider. The catalog compiler must validate that the linked trait and
provider exist, that the provider kind is `spell`, and that the linked trait is
not in the normal Spell Drop pool. An exact catalog regression owns the
source-specific assertion that the link is Sky Fall. No generic
starting-traits bag is added.

### 2. Authored state reuses the existing trait-offer child

`SpellDrop`'s existing `self` acquisition role resolves to the new `SpellDrop`
giver. Consequently every newly created concrete Spell Drop reward contains:

```text
traitOffersByAcquisitionRole: { self: null }
```

The existing `AuthoredTraitOfferTraits` shape remains authoritative. Strict
decode and semantic commands enforce:

- kind `traits`;
- giver `SpellDrop`;
- exactly three options;
- distinct trait keys;
- every option in the exact eight-trait giver pool;
- no option rarity; and
- one selected existing option.

No winner-only shortcut or separate `AuthoredSpellOffer` is introduced.

### 3. Spell extends the shared equipment-slot model

Generalize the normalized trait slot vocabulary from the five existing player
slots to the six real equipment slots:

```text
Melee | Secondary | Ranged | Rush | Mana | Spell
```

The catalog declaration and `TraitHistoryState` use one shared slot field and
one derived equipped-slot ledger. Retire the narrower normalized
`ordinaryBoonSlot`/`ordinaryBoonSlots` names rather than adding a parallel
`spellSlot` field. Player-facing presentation may continue to label the slots
Attack, Special, Cast, Sprint, Magick, and Spell.

The normalized types are explicit: `TraitEquipmentSlot` owns all six values,
while `TraitOrdinaryBoonSlot` remains the five-value subset used by ordinary
requirements and replacement transitions. `TraitDeclaration.equipmentSlot`
and `TraitHistoryState.equippedSlots` are the sole complete products. Any
ordinary-only view is derived from them by a pure helper; it is not stored as a
second ledger.

The original five slots remain an explicit ordinary-boon subset. Priority/core
offer guarantees, replacement offers, god-pool rules,
`ordinaryBoonSlotOccupied` requirements, Pom behavior, rarity counts, and
ordinary-slot findings continue to inspect only
`Melee | Secondary | Ranged | Rush | Mana`. Merely adding `Spell` to the shared
ledger must not make a Hex an ordinary boon.

Normal route initialization leaves `Spell` empty. A selected normal Hex fills
it at pickup. Aspect of Selene initializes it to Sky Fall. The closed reward
guard matrix prevents a supported second normal Spell Drop from reaching trait
settlement; any malformed authored attempt remains invalid at its existing
reward/source boundary. The slot fold must still fail closed rather than
accumulate a second simultaneous Hex, but this phase adds no redundant
slot-occupied picker, replacement command, or React rule. Aspect-of-Selene
Spell Drops bypass the spell offer entirely for their deferred Path of Stars
outcome.

### 4. Schema 50 is a clean protocol boundary

Adding the required `self` child changes the exact reward shape. Bump the
strict document schema from 49 to 50 and the catalog version from
`0.27.0-arcana-fear-loadout` to `0.28.0-selene-spells`. Production keeps no
schema-49 compatibility decoder or runtime migration shim.

Migrate the 14 readable checkpoint artifacts with a temporary schema-bump
transformer and an explicit per-checkpoint intent ledger:

1. parse schema-49 JSON as `unknown`;
2. add `self: null` to every concrete Spell Drop reward child;
3. change only the schema/catalog version fields;
4. strict-decode as schema 50;
5. use the production `ReplaceTraitOffer` command to author deterministic,
   legal three-spell offers where a checkpoint intends to be complete;
6. retain `null` only where the checkpoint intentionally owns an unresolved
   frontier or its loadout is Aspect of Selene;
7. canonical-encode, update manifest hashes, and run fixture integrity; and
8. delete the transformer in the same gate.

The ledger must name each changed Spell Drop owner and its intended selected
spell. Do not replay full route-building command chains and do not mass-fill a
preferred first candidate.

### 5. Engine owns aspect context and trait history

Route branch initialization derives the aspect-linked starting trait through
one pure catalog-backed helper shared by every initialization call. It appends
an existing `directTraitGrant` history event at sequence zero, then folds the
normal trait history product. Run State and all later requirements therefore
consume the same event/history authority.

The direct-grant validator accepts this event through the exact compiled aspect
link, not through membership in the provider's random offer pool. Its equipped
provider kind still comes from the linked `SpellDrop` giver. Do not fabricate a
one-option Sky Fall offer or add Sky Fall to the eight-spell random pool merely
to satisfy the existing direct-grant validation shortcut.

At Spell Drop settlement, the engine decides whether the child is active from
the exact route loadout and catalog aspect link:

- non-Selene aspect: `null` blocks at the existing `TraitOfferAddress`; a valid
  offer evaluates and fills an empty `Spell` slot with only its selected spell
  at acquisition;
- `SuitHexAspect`: the child is dormant, acquisition history settles, and Sky
  Fall remains the equipped spell.

The application receives only the resulting active child/candidate products.
It must not inspect `SuitHexAspect` or suppress controls itself.

### 6. Existing trait assessment remains generic

The new `spell` provider follows the existing fixed-three rarityless behavior:

- fixed-three structural assessment applies;
- Olympian priority, god-pool, Duo/Legendary, replacement, sparse-offer,
  Calling Card, denial, and rarity systems do not apply;
- selected spell equip uses the existing trait-offer history event;
- no spell is Pom-eligible or counted as an ordinary god boon; and
- normal spell authoring remains reachable only while the exact reward guard
  matrix says Spell Drop is legal.

Use exhaustive provider-kind switches to make the new category explicit.
Do not scatter `giverKey === 'SpellDrop'` conditionals across generic trait
assessment.

### 7. Editor reuses the current trait offer workflow

The structured workspace projects an active Spell Drop child through the same
trait-offer requirement, interaction binding, navigation, finding, and undo
paths as other reward-owned offers.

Presentation differences are derived from the engine/catalog product:

- the action control says `Edit spell`;
- the dialog presents exactly three rarityless spell rows;
- rarity, fallback-gold, sparse-offer, rarification, replacement, target, and
  god-pool controls are absent; and
- one successful edit dispatches one existing `ReplaceTraitOffer` command and
  creates one semantic history entry.

Under Aspect of Selene, no spell control or missing-offer finding is projected.
React owns only labels/layout; it does not own the pool or aspect rule.

## Delivery gates

### Gate A — Catalog, schema, engine, and fixtures

Deliver one complete domain/protocol slice:

- nine spell declarations and one Selene spell giver;
- exact Aspect-of-Selene starting-trait link;
- one shared six-slot trait declaration/history product, with the original
  five-slot ordinary-boon subset preserved;
- `spell` provider support through compiler and engine exhaustiveness;
- schema 50 and catalog version bump;
- strict Spell Drop `self` offer ownership;
- starting Sky Fall history;
- normal/aspect Spell Drop settlement behavior;
- Artemis/Circe chronological dependency contact;
- Spell Drop removal from Echo last-reward recreation with Talent Drop
  preservation; and
- all checkpoint/manifest migration with temporary transformer deletion.

Because the normalized slot field and history product are supported package
contracts, Gate A also performs the mechanical downstream rename in existing
application projections and tests so the commit typechecks without a
compatibility alias. Those contacts must preserve their prior five-slot UI and
behavior; the new Spell row and Spell Drop editing workflow remain Gate B.

Primary owners:

- catalog trait/compiler/regression tests;
- authored reward codec and trait-offer command tests;
- trait assessment/history tests;
- reward settlement and biome lifecycle tests;
- Artemis, Circe, Echo, Shop, and disposition-focused engine contacts; and
- checkpoint integrity; plus
- focused application contract/Run State tests proving the slot rename alone
  did not change the original five-slot presentation.

Required acceptance witnesses:

1. catalog contains exactly nine named spell traits in the `Spell` equipment
   slot; the normal giver contains exactly the ordered eight and excludes Sky
   Fall;
2. `SuitHexAspect` alone links Sky Fall, with compiler failures for unknown or
   in-pool links;
3. fresh Spell Drop owns `self: null` and strict decode rejects missing/extra
   roles, wrong giver, wrong count, duplicate, out-of-pool, and rarity-bearing
   options;
4. one `ReplaceTraitOffer` command authors a legal choice and Undo restores the
   prior value;
5. normal `self:null` blocks at the exact child with eight candidates and no
   rarity/fallback/sparse controls;
6. the shared `Spell` slot is empty before a normal pickup and contains exactly
   the selected Hex immediately after it;
7. Artemis/Circe spell-dependent traits are unavailable before and correctly
   assessed after the relevant spell pickup;
8. Aspect of Selene starts with `Spell = Sky Fall` before the first room and a
   later Spell Drop records acquisition without a selector, finding, or second
   trait;
9. a retained non-null Spell Drop offer is dormant under the aspect and active
   again after switching away;
10. the complete guard matrix rejects a second Spell Drop through its owning
    source boundary: prior use, same-room/shop pending/offered state, Travel
    Deal refill, Reward Reward Reward, Gold Gold Gold, and Artificer each have a
    direct witness; malformed settlement never accumulates a second equipped
    Hex, while a converted/unacquired Spell Drop does not fill the slot;
11. the original five ordinary slots retain their priority, replacement,
    requirement, rarity, and Pom behavior without treating `Spell` as ordinary;
12. Spell Drop never updates `lastRewardRecreation`, while Talent Drop still
    does and Reward Reward Reward can still recreate Talent Drop;
13. all checkpoint files strict-decode, re-encode canonically, and match their
    manifest hashes and intent ledger; and
14. schema 49 and the old catalog version are rejected with no compatibility
    path.

Validation while implementing uses focused catalog/engine/fixture tests and
`test:changed`; finish the gate with catalog and engine owning lanes,
typecheck, lint, format check, and diff check. Do not run the full repository
gate yet.

Commit boundary: one Conventional Commit for Gate A after independent
adversarial review and bounded remediation.

### Gate B — Workspace, editor, and product contact

Deliver the application vertical slice without introducing policy:

- project the engine-owned active Spell Drop child;
- bind the existing semantic trait-offer command;
- add the compact `Edit spell` presentation;
- route exact findings/focus into the existing reward owner; and
- show starting/selected spell identity in existing Run State presentation.

Primary owners:

- occurrence/reward structured-workspace assembly;
- interaction requirements and binding;
- TraitOfferEditor presentation;
- finding/navigation contract tests;
- one occurrence UI workflow; and
- one representative product-loop workflow.

Required acceptance witnesses:

1. normal Spell Drop projects one exact active interaction and destination;
2. its editor shows three spell choices with no rarity or unrelated trait
   controls;
3. editing selection is one command/one Undo and does not evaluate work merely
   by opening the editor;
4. missing normal choice navigates to the existing spell editor;
5. Aspect-of-Selene Spell Drop projects no selector or missing-child finding;
6. Run State shows the shared Spell slot as empty/filled, with Sky Fall at
   Aspect-of-Selene route start and a normal selected spell only after pickup;
   and
7. no React/app code inspects aspect identity, duplicates the eight-spell pool,
   or filters Echo last-reward options.

Validation uses focused planner/contract/UI/product tests, then the owning
planner, contract, product, and UI lanes plus typecheck, lint, format, build,
and diff check. Do not run the full repository gate yet.

Commit boundary: one Conventional Commit for Gate B after independent
adversarial review and bounded remediation.

### Gate C — Durable absorption and phase closure

Update only the durable authorities that own the completed facts:

- catalog spell/provider/aspect link;
- schema-50 Spell Drop child ownership;
- initial and acquisition-time trait history;
- candidate/settlement chronology;
- editor projection and aspect-deferred behavior;
- Echo replay correction; and
- the implementation progress record.

Update the Selene audit's planner disposition without erasing source evidence.
Delete this temporary plan and leave no references to it. Do not absorb Chaos
implementation decisions into this closure.

Run the single full `npm run check` closure gate after docs are stable, record
its truthful result, and perform an independent docs/deletion review.

Commit boundary: one docs-only Conventional Commit for Gate C.

## Deletion and non-growth requirements

The finished diff must contain none of the following:

- `AuthoredSpellOffer`, `SpellCandidate`, or a Selene-specific picker state;
- a production schema-49 migration or compatibility decoder;
- a second trait history, parallel spell ledger, or duplicate spell-slot
  product;
- app/React copies of the eight-spell domain or Aspect-of-Selene rule;
- `SpellDrop` special-casing in Echo presentation;
- permanent fixture regeneration builders; or
- implemented Path of Stars placeholders.

The expected permanent growth is catalog declarations, one optional aspect
link, the provider-kind extension, a narrow generalization of the existing
trait slot field/ledger, initialization/settlement context, and representative
tests. Existing trait-offer and editor machinery should carry the majority of
the feature.

## Final audit-againsts

Before phase closure, verify:

- catalog construction remains `catalog -> pure engine <- application/React`;
- no engine import reaches catalog implementation or application code;
- one persisted trait-offer child and one trait history remain authoritative;
- one shared six-slot ledger exists, while every ordinary-boon rule still uses
  the exact original five-slot subset;
- missing normal choices remain representable and repairable;
- aspect-deferred children remain preserved rather than normalized away;
- all loadout-based starting history uses the same initialization helper;
- Artemis/Circe read exact checkpoint history rather than route-wide final
  state;
- `SpellDrop` is absent and `TalentDrop` present in last-reward recreation;
- prior-use, room/shop, Travel Deal, Echo, Gold Gold Gold, Aspect, and Artificer
  guards all remain engine/catalog owned and prevent a supported second Spell
  Drop;
- all nine base spells are real while every unsupported talent remains
  deferred; and
- schema/catalog/checkpoint version contacts are complete and no temporary
  migration source survives.
