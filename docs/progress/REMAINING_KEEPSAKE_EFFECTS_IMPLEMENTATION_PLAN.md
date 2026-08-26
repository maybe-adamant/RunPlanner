# Remaining Keepsake Effects Implementation Plan

## Status

**Locked on 2026-08-26.** Execution begins from lock commit `3e1b87b0`
(`docs(keepsakes): lock remaining effects plan`). The live production code
reviewed by this plan remains base commit `5865cb05` (`refactor(engine): group
biome reward evaluation`); the intervening commits contain audited source
material and this execution contract only.

Gate A completed implementation and independent review on 2026-08-26. Its
catalog, schema-migration, focused engine/application, typecheck, formatting,
and diff-check lanes passed. The complete repository gate remains deferred to
phase closure as required by this plan.

Gate B implementation and bounded review remediation completed on 2026-08-26.
The focused Judgment/Crystal Figurine lifecycle witnesses cover terminal-Boss
suppression with pending-source retention, Fated filtering and authored
exclusion rejection, and Epic ordinary versus Heroic Cherished-advanced
activation. Verification passed with `npx vitest run
packages/planner-engine/test/simulation/judgment-arcana.test.ts` (1 file, 14
tests), `npx prettier --write
packages/planner-engine/test/simulation/judgment-arcana.test.ts`, and
`git diff --check`. The complete repository gate remains deferred to phase
closure as required by this plan.

Gate C implementation completed on 2026-08-26. Concave Stone now owns one
frozen residual result on its original trait offer, records only the original
published offer evaluation, and uses a distinct frozen secondary-acquisition
event for its consumed-before-callback pickup. Independent review corrections
preserve Calling Card's already-rarified frozen row and keep stale authored
results visible and repairable after the source disappears. Focused catalog,
strict codec, migration, engine, Echo, optional-result, stale retained-result,
Heroic forced-result application/UI, typecheck, formatting, and diff-check
lanes passed. The complete repository gate remains deferred to phase closure
as required by this plan.

Gate D implementation completed on 2026-08-26. Transcendent Embryo now has
its closed Chaos blessing declaration, immediate route-start/Postboss/Echo
results, exact eight-qualifying-encounter transformation result, direct marked
blessing acquisition/removal history, Heirloom and unequip behavior, and the
automatic lifecycle/UI and Run State products. Focused Embryo engine and
workspace interaction witnesses, catalog, migration, typecheck, formatting,
and diff-check lanes passed. The complete repository gate remains deferred to
phase closure as required by this plan.

The first phase contains Aromatic Phial, Crystal Figurine, Concave Stone, and
Transcendent Embryo. A later phase establishes the exact-name reward-pressure
infrastructure and immediately consumes it with all nine Olympian keepsakes.
The final phase adds the minimal Hex/Path point layer and consumes both that
layer and the reward-pressure queue with Moon Beam. Individual Hex talent-tree
nodes remain outside the executable scope.

## Objective

Implement the fourteen settled keepsake effects as complete vertical slices
through catalog declaration, authored state where an effect has a random
result, simulation, candidates and findings, application projection, editor
interaction, and durable documentation.

For each keepsake, “implemented” means all three source contacts are closed:

1. its ordinary route-start or Postboss-rack equip effect;
2. its exact Cherished Heirloom reconstruction and later-equip behavior; and
3. its exact Gift Gift Gift exclusion or replay behavior.

The user-visible result is that the planner authors every random result at the
exact lifecycle frontier where the game resolves it, presents required versus
possible outcomes truthfully, and carries the resulting trait, Arcana, rarity,
counter, reward-priority, and provider-pressure state through the rest of the
route. The nine Olympian keepsakes share one declared effect family and one
engine transition family; they are not nine copied implementations. Moon Beam
shares the same exact-name priority queue and one small Hex progress product;
it does not create a second reward or trait-offer subsystem.

## Included Scope

Phase one includes:

- Aromatic Phial (`FountainRarityKeepsake`);
- Crystal Figurine (`BossMetaUpgradeKeepsake`);
- Concave Stone (`UnpickedBoonKeepsake`); and
- Transcendent Embryo (`RandomBlessingKeepsake`).

Phase two includes:

- a run-global ordered queue of exact reward-type priorities, including
  duplicate entries, source-time counted-store refill, and offer-generation
  consumption;
- the shared provider-force and provider-specific one-use rarification source
  state needed by Olympian keepsakes;
- ordinary Boon and Devotion provider selection, and provider-force
  consumption at supported non-purchase loot-materialization frontiers; and
- Cloud Bangle, Iridescent Fan, Vivid Sea, Barley Sheaf, Harmonic Photon,
  Beautiful Mirror, Adamant Shard, Everlasting Ember, and Sword Hilt.

The implementation may extend only the existing seams enumerated in the
production change budget below, and every extension must ship with its named
consuming keepsake and primary witness in the same gate. Any other shared
product or lifecycle contact stops the gate for plan review. Gate E is
therefore one complete reward-pressure and Olympian keepsake slice, not an
infrastructure-only precursor for Moon Beam.

Phase three includes:

- a derived Hex progress product with semantic banked and invested Path point
  counts;
- exact one/three/five point settlement for Minor, ordinary, and Big Path
  acquisitions through the existing concrete-acquisition pipeline;
- the ordered ordinary Spell Drop's zero/one/two positional point bonus;
- Aspect of Selene's fixed spell and direct three-point `SpellDrop` Path
  settlement with no spell offer or positional bonus; and
- Moon Beam (`SpellTalentKeepsake`) across ordinary equip, Cherished Heirloom,
  Gift Gift Gift, and exact reward priority.

## Excluded Scope

- every other currently effect-neutral keepsake;
- individual Hex talent declarations, tree topology, prerequisites, node
  choices, duo/legendary talents, rerolls, or exact remaining tree capacity;
- combat, Magick, or other gameplay effects of invested Hex nodes;
- probabilistic simulation, RNG seeds, or displayed proc percentages beyond
  the support distinction between possible and forced outcomes;
- fountain healing, combat values, or other sim-neutral numeric effects;
- permanent Arcana progression outside the existing run-local Arcana model;
- a generic keepsake-effect interpreter, callback registry, or mutable service
  table; and
- migration compatibility shims for prior development schemas.

If another keepsake or full Hex-tree authoring is later added, this scope and
the gate contract must be reviewed and rewritten before that work is locked.
It is not implicitly covered by the current draft.

## Source Authorities

The implementation is audited against:

- `docs/audits/loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md` for the
  ordinary effects and rank profiles;
- `docs/audits/loadout-and-progression/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md`
  for reconstruction, preserved state, and Concave Stone same-offer ordering;
- `docs/audits/loadout-and-progression/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md`
  for replay exclusions, cadence, and unslotted-source lifetime;
- `docs/audits/loadout-and-progression/OLYMPIAN_KEEPSAKE_AND_MOON_BEAM_REWARD_PRESSURE_AUDIT.md`
  for exact reward-priority lifetime, store refill, provider ordering,
  materialization-time use consumption, provider-specific rarification,
  Cherished/Gift contacts, and Moon Beam's exact priority targets;
- `docs/audits/loadout-and-progression/PATH_OF_STARS_AND_SPELL_DROP_GAME_DATA_AUDIT.md`
  for exact Path reward values, the ordered initial Spell Drop bonus, Aspect of
  Selene routing, and every point-bank contact required before Moon Beam can be
  implemented;
- `docs/audits/loadout-and-progression/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md` for
  the random inactive-Arcana domain and temporary activation semantics;
- `docs/audits/traits/CHAOS_TRAIT_GAME_DATA_AUDIT.md` for Chaos blessing
  declarations, values, eligibility, and semantic effects; and
- `docs/audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md` for
  fountain, Boss-defeated, encounter-end, and Postboss-rack chronology.

The phase-one installed game-data anchors include
`InteractLogic.lua:741-779`, `TraitLogic.lua:2859-2964`,
`PowersLogic.lua:4869-4895`, `CombatLogic.lua:3953-3978`,
`MetaUpgradeLogic.lua:499-575`, and the four declarations in
`TraitData_Keepsake.lua`. Gate E additionally audits the nine Olympian
declarations and `BaseBoonUpgradeKeepsake` in `TraitData_Keepsake.lua`,
`RewardStoreAddPriority`, `ChooseRoomReward`, and `SetupRoomReward` in
`RewardLogic.lua`, `GiveLoot` in `RoomLogic.lua`, provider rarification in
`UpgradeChoiceLogic.lua`, and the producer contacts named by the focused
reward-pressure audit. Gate F additionally consumes `SpellTalentData` and
`SuitHexAspect`, `OpenSpellScreen`/`AcceptAndCloseSpellScreen`,
`OpenTalentScreen`, the three Path consumable declarations, and Moon Beam's
declaration/acquisition callback through the focused Path audit.

## Current-Code Audit

### Catalog

`packages/hades2-catalog/src/declarations/keepsakes.ts` declares all 33 rack
identities, but its normalized effect union currently contains only Jeweled
Pom, Experimental Hammer, Calling Card, Time Piece, Fig Leaf, and Gorgon
Amulet. The four phase-one keepsakes still compile as effect-neutral for
ordinary simulation, and three still compile as effect-neutral Gift targets.
Aromatic Phial is already correctly excluded from Gift Gift Gift.

`packages/hades2-catalog/src/compiler/keepsakes.ts` deliberately validates the
closed six-effect declaration surface. Each gate must extend that exact
compiler contract only for its own declaration and must reject extra, missing,
or incorrect rank data.

The nine Olympian identities currently compile as effect-neutral even though
their source declarations form one uniform effect family. Their normalized
effect should carry provider identity, exact `Boon` priority, one provider-force
use, and the Common/Rare/Epic maximum-rarity rows once. Moon Beam also compiles
as effect-neutral today. Gate F replaces that disposition with one explicit
point-and-priority effect after Gate E has established the generic exact-name
queue.

### Authored project and immediate equip products

The current strict project schema is 59. `AuthoredKeepsakeEquipResults` owns
only Jeweled Pom and Experimental Hammer immediate results. Route start,
Postboss rack selection, and the Echo biome-start replay already have exact
selection addresses and candidate products, but their closed result vocabulary
must be extended before Embryo can author an immediate Chaos blessing.

Fountain results, Figurine Boss results, Concave Stone residual-offer results,
and Embryo transformation results do not yet have persisted semantic owners.
New state must use occurrence/phase/offer identities rather than rendered row
positions.

Olympian reward pressure has no authored random result of its own. The existing
authored reward and trait-offer objects already state the generated reward,
provider, rolled rows, selected row, and row-level rarification actions. Gate E
must constrain and settle those existing objects at their exact chronological
frontiers rather than persist a second “forced reward” choice.

Gate F likewise needs no authored random result. The normal `SpellDrop` child
already persists three ordered option rows and one selected option; its option
key supplies the zero/one/two bonus. Aspect of Selene correctly suppresses
that child. Path rewards and Moon Beam point/priority mutations are automatic
consequences of existing equip and acquisition choices.

### Keepsake state and three-contact chronology

`packages/planner-engine/src/simulation/keepsakes.ts` owns the current keepsake,
selection history, removed keys, Fated status, and six effect ledgers.
`keepsakeRankForEquip`, `advanceCurrentKeepsake`, rack transitions, route-start
initialization, and Echo replay all use explicit closed dispatch. The four
phase-one effects and Gate E's shared Olympian family must extend those same
transitions explicitly; they must not establish a parallel effect runner.

The state shape may distinguish an ordinary current source from an Echo-created
unslotted source where the game distinguishes their lifetime. A boolean such as
“effect active” is insufficient when rank, use consumption, acquisition
identity, or replay eligibility differs by source.

### Reusable lifecycle and mutation seams

- `fountainUsed` already exists as an exact required room-action event, but the
  reward chronology currently has no Phial-specific transition or candidate.
- `bossDefeated` already owns Judgment before generic encounter-end effects.
  The game runs Judgment's `PostBossCards` activation first and Crystal
  Figurine's two-card activation second, so Figurine must consume the Arcana
  frontier produced by Judgment at the same Boss.
- Steady Growth already proves the encounter-end pattern needed for a forced
  random target at a reached `RoomsPerUpgrade` threshold.
- The trait-history rarity fold already supports exact rarity mutation and the
  catalog already declares the Hephaestus cooldown-cap eligibility shared by
  Pom-like rarity effects.
- Judgment already supplies a random-inactive-Arcana candidate and temporary
  Arcana activation fold.
- Ordinary trait offers already retain the complete rolled option rows,
  selected option, rarification actions, and selected-acquisition chronology.
- Sea Star already proves the editor pattern of exposing a proc control after a
  legal source interaction, but its generated-pickup semantics do not apply to
  Concave Stone.
- Chaos offers already normalize blessing declarations, rarity-derived values,
  eligibility requirements, and downstream semantic tags. Embryo needs a
  blessing-only acquisition/removal transition rather than a fabricated Chaos
  curse pair.

### Reward-pressure and provider seams

The reward kernel already owns counted-store bags, exact reward-type entries,
eligibility, refill invariants, sibling suppression, and offer-generation
consumption. `RewardBranchState` is the run-chronological product that already
carries bags, history, traits, Arcana, and keepsake state. It does not yet carry
the game's ordered `RewardPriorities` queue or the source-time full-store append
that occurs when an inserted exact priority has no remaining matching entry.

Ordinary generated rewards already pass through one counted offer-generation
transition, so pending priority support belongs immediately around that kernel
contact. Fixed rewards, shops, Shrine inventories, and direct pickups bypass
that contact and must not consume a priority merely because their reward type
matches.

Trait offers already own provider identity and row-level rarification actions.
Calling Card currently settles those actions through its own retained ledger.
Gate E must introduce one provider-specific source ledger and resolve it before
Calling Card without changing the authored action shape. The existing offer,
Devotion, Fields-cage, fixed-loot, purchase, and Mystery-Boon producer paths are
the materialization contacts that determine whether a matching provider-force
use is spent; pickup optionality is not that boundary.

### Hex/Path seams

The catalog already declares the three concrete Path reward types and the
eight normal rarityless spell traits. Normal `SpellDrop` uses the existing
ordered three-row trait-offer product. Aspect of Selene already installs fixed
Sky Fall at route start, while `isAspectSpellDropDormant` suppresses a second
spell selector on its later `SpellDrop`.

Every acquired Path reward already reaches the shared concrete-acquisition
settlement after pickup, purchase, delivery, replay, or duplication policy has
resolved. That is the one point-grant contact. Conversion or forfeiture paths
that do not emit a concrete acquisition must not grant points.

The branch currently carries no Hex progress product. Run State therefore
cannot distinguish Moon Beam points waiting for a Path screen from points
already invested. Gate F adds only those semantic counts. Aspect of Selene
does not create a separate pending-point product: its `SpellDrop` settles a
semantic three-point Path screen directly. Gate F does not copy
`CurrentRun.Hero.SlottedSpell.Talents`, fabricate node capacity, or turn the
current `allSpellInvested = false` support baseline into a false exact tree
model.

## Cross-Gate Modeling Contract

### Production change budget

Every new semantic production product is listed below with the concrete effect
that consumes it and its primary test owner. A gate must stop for plan review
before adding a shared state product, event family, authored wrapper, candidate
surface, or UI model not covered by this table. Private functions and modules
that implement one listed product are placement decisions, not permission to
introduce another abstraction.

| New semantic product                                                     | Immediate concrete consumer                                       | Primary witness named by this plan                                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Phial declaration and one-use source                                     | Aromatic Phial at `fountainUsed`                                  | Phial catalog matrix and fountain engine matrix                              |
| occurrence-owned Phial target result/address/candidate                   | the exact next eligible fountain                                  | codec/command/candidate tests plus Reprieve and Postboss UI witnesses        |
| Figurine declaration and pending source                                  | Crystal Figurine at nonterminal `bossDefeated`                    | Figurine catalog and ordinary/Heirloom/Gift engine matrix                    |
| Boss-phase Figurine Arcana result/address/candidate                      | the exact post-Judgment inactive-card frontier                    | codec/command/candidate tests and independent Boss UI witness                |
| Stone declaration and one-use source                                     | Concave Stone after a qualifying primary trait acquisition        | rank-support and ordinary/Heirloom/Gift engine matrix                        |
| offer-owned Stone proc result/candidate                                  | no-proc or one residual row from that frozen offer                | strict offer codec, retained-invalid candidate, and frozen residual UI tests |
| Embryo declaration and active driver                                     | Transcendent Embryo equip and eight-room transformation           | Embryo catalog and lifecycle matrix                                          |
| Embryo immediate equip-result variant                                    | route start, Postboss rack, and Echo replay blessing              | equip-result codec/candidate and three-owner UI tests                        |
| phase-owned Embryo transformation result                                 | the exact reached eighth qualifying encounter                     | threshold codec/candidate and transformation UI tests                        |
| marked Embryo blessing identity and direct blessing fold                 | remove only the driver-owned blessing and acquire its replacement | Chaos-domain coexistence, same-key, and source-owned replacement tests       |
| Olympian declaration family                                              | the nine named god keepsakes                                      | complete nine-provider catalog matrix                                        |
| ordered exact-name reward-priority queue and insertion/refill transition | nine `Boon` priorities and Moon Beam's three exact targets        | reward-kernel ordering, refill, eligibility, and consumption tests           |
| bounded active Olympian provider-source collection                       | at most one ordinary and one Gift-created source                  | ordinary/Gift coexistence and first/last provider-order tests                |
| provider-materialized transition at existing producer contacts           | automatic force-use consumption for the nine Olympian keepsakes   | the complete materialization matrix in Gate E                                |
| provider-specific rarification settlement                                | one existing row action on a matching Olympian offer              | precedence, cap, consumption, and Gift-removal trait-offer tests             |
| Moon Beam declaration/effect transition                                  | ordinary, Cherished, and Gift Moon Beam                           | Moon Beam catalog and three-contact lifecycle tests                          |
| 1/3/5 Path grants and ordered 0/1/2 spell bonuses                        | concrete Path acquisitions and ordinary `SpellDrop` selection     | catalog matrix and exact acquisition/position tests                          |
| two-field Hex progress product and shared settlement                     | Moon Beam banking plus aggregate Path investment                  | bank/transfer tests, Aspect/Q edge witnesses, and Run State product test     |

The table deliberately excludes generic timer registries, generic keepsake
interpreters, a second reward or loot pipeline, a second trait-offer model,
Hex-node state, total-awarded/remaining-capacity Path ledgers, and React-owned
policy. None has an included consumer.

### Complete three-contact delivery

No gate is complete after implementing only the ordinary rank-III path. Its
primary engine test owner must contain the complete matrix:

| Contact            | Required evidence                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary equip     | route start, Postboss replacement, rank-III state, use/counter initialization, and immediate result when applicable                          |
| Cherished Heirloom | current reconstruction, pending versus consumed preservation, exact rank-IV behavior, and later ordinary equip while Heirloom remains active |
| Gift Gift Gift     | exclusion or Common replay, exact biome-start cadence, unslotted-source lifetime, consumption/removal, and later replay eligibility          |

Representative UI and product tests should witness these contacts without
copying the complete matrix away from the engine owner.

### Possibility rather than probability

The planner does not roll 25% or 75%. A positive nonunit chance admits both
proc and no-proc authored outcomes. A 100% chance with a nonempty target domain
admits only the proc outcome. Candidate evaluation, not React, decides which
outcomes remain supported at the reached frontier.

### Exact authored random results

Persist only the domain identity selected by the authored random outcome:
trait key, Arcana keys, existing offer option key, or Chaos blessing key.
Rarity, numeric values, labels, and eligibility remain derived from the catalog
and chronological state unless an existing authored contract already requires
the value itself. Missing reached outcomes remain incomplete. Retained
context-invalid outcomes remain visible and repairable rather than being
silently discarded after an upstream edit.

### Declaration data and explicit dispatch

Rank tables, use counts, target rarity, interval length, and provider/domain
facts belong to catalog declarations and their compiler. The engine owns
source-instance state, chronology, candidates, mutations, and findings. The
application projects engine products and dispatches semantic commands. React
does not reconstruct eligibility, requiredness, or replay schedules.

### Persisted schema

Each gate that introduces persisted authored state advances the strict project
schema and catalog version in that gate, updates strict codecs/defaults and
named fixtures, and rejects malformed shapes. It does not add a compatibility
decoder for superseded development schemas. A schema bump cannot be separated
from the complete behavior that consumes its new field.

Gate E and Gate F add only derived run state and declaration data. Neither may
bump the authored-project schema unless live implementation proves that an
existing authored reward, ordered spell offer, or rarification action cannot
express a source-backed outcome; that contradiction stops the gate for plan
review rather than silently adding a parallel authored model.

## Gate A — Aromatic Phial

### Outcome

An active unused Aromatic Phial observes the next required fountain use. When
the source guard and random-target domain contain at least one exact eligible
Common god trait, the planner requires one authored target, consumes Phial's
single use, and promotes that trait directly to Heroic. The game has one narrow
guard/target discrepancy for cooldown-capped Hephaestus traits, so empty-target
behavior must distinguish “do not consume” from “consume with no mutation.”

### Catalog ownership

Add one explicit `fountainRarity` keepsake effect declaring:

- one use;
- Common, Rare, and Epic target-rarity levels 2, 3, and 4;
- no Heroic declaration row; and
- the source `MaxRarity = 1` restriction.

The ordinary planner baseline equips Epic and therefore targets Heroic.
Cherished Heirloom does not invent a Heroic Phial row. Gift Gift Gift remains
declaration-excluded.

The compiler owns the exact keys and values. Fountain healing remains
sim-neutral and is not added merely because it shares the game declaration.

### Authored and address ownership

Add a fountain-rarity outcome address derived from the exact occurrence's
`fountainUsed` room-action address. Persist at most one target trait key beneath
that occurrence. The semantic command accepts a trait key or clears the sparse
result; it validates only structural ownership and known identity. Reached
eligibility remains simulation-owned.

Ordinary Reprieve and automatic Postboss fountains use the same address and
command product. There is no Postboss-only Phial field and no rendered-row
address.

### Simulation ownership

Initialize a one-use Phial source on route-start or rack equip. Remove its live
effect on ordinary replacement. Preserve pending or consumed state during
Cherished reconstruction; because Phial has no Heroic row, reconstruction is a
no-op and later equips remain Epic. Keep the existing Gift exclusion exact.

At `fountainUsed`, build two exact domains from the pre-use trait frontier.
The **consumption guard** follows `HasRarifiableTraits`:

- equipped god trait under the source's `ForShop` classification;
- current rarity Common because Phial's maximum source rarity is one;
- not `BlockInRunRarify`;
- and a declared Heroic value.

The **random mutation domain** follows `AddRarityToTraits` and adds the shared
Hephaestus cooldown-cap exclusion already declared for the planner's other
rarity/level effects. This is a source discrepancy, not two independently
authored choices.

If the consumption guard is empty, no authored target is required and the use
remains pending. If the guard is nonempty but the mutation domain is empty,
Phial consumes its use and produces no rarity mutation. Otherwise a missing
target produces one exact finding and blocks later chronology, while an
unavailable target produces a repairable finding. A valid target emits the
existing rarity-mutation meaning with a Phial-owned source role, consumes the
use before later room actions, and makes the Heroic trait visible immediately.

### Application and UI

Project the target selector as a nested result of the existing **Use fountain**
action. Show it only when the reached candidate says Phial is pending and the
mutation domain is nonempty. A reached consume-without-target outcome requires
no invented selector. Reuse the existing single random-trait target control
shape where appropriate; do not add a second fountain action or a general
keepsake configuration panel.

Run State shows Phial as pending or consumed while it is the live source and
shows the resulting Heroic trait through the ordinary equipped-trait view.

### Primary tests

- Catalog declaration/compiler regression for the three-row rank table, one
  use, and Gift exclusion.
- Strict codec and semantic-command tests for the occurrence-owned result.
- Engine matrix for route-start/rack equip, empty guard, nonempty guard with an
  empty Hephaestus-capped mutation domain, exact Common eligibility, direct
  Heroic promotion, one-use consumption, no-Heroic Heirloom behavior, and Gift
  exclusion.
- Fountain chronology witnesses for ordinary Reprieve and automatic Postboss.
- Focused projection/UI test authoring and undoing the target from **Use
  fountain**.

### Intended commit

`feat(keepsakes): model Aromatic Phial fountain rarity`

## Gate B — Crystal Figurine

### Outcome

One pending Crystal Figurine activates up to two distinct currently inactive
Arcana at the next nonterminal Boss-defeated seam. The activated cards use the
Figurine source rank. Judgment resolves first at the same Boss; Figurine draws
from the resulting inactive-card frontier.

### Catalog ownership

Add one explicit `crystalFigurine` keepsake effect declaring:

- one use;
- two requested cards; and
- Arcana rarity levels Common/Rare/Epic/Heroic for keepsake ranks
  Common/Rare/Epic/Heroic.

The declaration also replaces Figurine's effect-neutral Gift disposition with
its audited conditional Common replay schedule.

### Authored and address ownership

Add a Figurine Arcana outcome address beneath the exact automatic Boss
occurrence and phase's `bossDefeated` boundary. Persist its selected Arcana keys
separately from Judgment's keys; the two effects have different source rank,
use, Gift, and finding semantics even though they share domain helpers.

The semantic command stores a declaration-canonical distinct set. It does not
allow a player-authored order to imply game ordering between the two random
cards.

### Simulation ownership

Represent the one pending source with its origin, rank, and pending/consumed
status so ordinary and Echo-created lifetimes cannot be conflated.

At a qualifying nonterminal `bossDefeated` event:

1. apply Judgment exactly as today, including Barren and Fated restrictions;
2. recompute the inactive-card frontier from the post-Judgment Arcana state;
3. exclude Fated-incompatible cards while Fated, using the shared
   `AddRandomMetaUpgrades` domain;
4. require `min(2, eligible inactive count)` distinct Figurine results;
5. activate them at the source rank and refresh Fated state; and
6. consume Figurine's one use even when the eligible domain is empty.

The full-run terminal Boss triggers neither Judgment nor Figurine because both
are inside the same source outer guard.

Cherished Heirloom changes an unused current Figurine from pending Epic to
pending Heroic, preserves an already-consumed source, and makes later legal
ordinary equips Heroic. It does not activate cards at acquisition time.

Gift Gift Gift creates a Common pending source only when no Echo-created
Figurine source remains. Boss consumption removes that unslotted source, so a
later biome start may replay Figurine again. Remaining equipped ordinary
Figurine state continues to block a duplicate re-equip through the game's
ordinary trait-identity rule.

### Application and UI

Reuse the Judgment multi-Arcana selection presentation and inactive-card
labels, but render a distinct **Crystal Figurine** child at the same Boss
defeated boundary. Its required count and rank come from the engine candidate.
Do not merge the two selections into one combined Arcana picker.

Run State identifies the pending source and rank, then shows its consumed state
or removal according to ordinary versus Echo source lifetime.

### Primary tests

- Catalog/compiler regression for the four-rank Arcana profile, count two, and
  conditional Gift schedule.
- Strict codec/command/candidate tests for a distinct Boss-phase selection.
- Engine witnesses for Judgment-then-Figurine ordering, post-Judgment target
  exclusion, fewer-than-two remaining cards, empty-domain consumption,
  terminal-Boss suppression, Fated filtering, rank-III and rank-IV activation,
  consumed Heirloom preservation, and later Heroic equip.
- Echo witness covering Common replay, Boss removal, and a later replay after
  the source disappears.
- Focused Boss UI test that keeps Judgment and Figurine independently
  authorable and undoable.

### Intended commit

`feat(keepsakes): model Crystal Figurine boss activation`

## Gate C — Concave Stone

### Outcome

After the primary option of a qualifying god-trait offer is fully acquired, an
unused Concave Stone resolves its chance for that screen. At Common, Rare, or
Epic, proc and no-proc are both possible. A no-proc result does not consume the
use, so Stone remains eligible at a later qualifying screen. At Heroic, proc is
mandatory whenever an unpicked non-replacement row remains. A successful proc
directly acquires one random residual row from the already-generated offer and
consumes the use.

### Catalog ownership

Add one explicit `concaveStone` keepsake effect declaring:

- one use; and
- proc support values 25, 50, 75, and 100 for
  Common/Rare/Epic/Heroic.

The declaration replaces Stone's effect-neutral Gift disposition with one
successful Common replay. The percentages are declaration evidence used only
to distinguish zero, nonunit, and forced support; the planner does not compute
probability.

### Authored ownership

Persist one offer-owned Stone result on `AuthoredTraitOfferTraits`:

- no proc; or
- proc with one existing `TraitOptionKey` from that same offer.

The offer already owns all rolled rows, their rarities, replacement state,
Calling Card actions, and primary selection. Do not persist a second trait
offer or copy the residual rows into another authored object.

The semantic command changes or clears only this Stone result. Structural
validation proves that a referenced option exists and differs from the primary
selection. Progressive candidate evaluation owns qualifying-provider,
replacement, chance, and remaining-use checks. A result retained after changing
the primary option remains visible and repairable when it becomes invalid.

### Simulation ownership and exact chronology

Represent Stone's one source use and rank, distinguishing current ordinary and
Echo-created unslotted lifetimes. Evaluate it only after the primary option has
completed the ordinary trait-acquisition fold:

```text
freeze original rolled offer
  -> acquire primary selected option
  -> finish its acquisition callbacks, including Cherished Heirloom
  -> read Stone's resulting rank and remaining use
  -> derive residual option keys from the frozen offer
  -> resolve no-proc or one random residual option
  -> consume Stone before acquiring a successful secondary option
  -> directly acquire that existing option
```

The residual domain contains only original unpicked, non-replacement options.
Those rows were legal when the screen was generated; the game does not rerun
trait eligibility after the primary acquisition before choosing the second
button. It is commonly two rows but must not encode “exactly two” as a rule.
The second acquisition uses the row's already-authored rarity and detail. It
does not recompose an offer, reroll or revalidate a row, permit new Calling
Card actions, create another loot object, or expose Artificer, Sea Star, or
Time Piece.

At Common 25%, Rare 50%, or Epic 75%, both no-proc and any supported residual
selection are valid authored possibilities. No-proc preserves the use for the
next qualifying offer. At Heroic 100%, no-proc is invalid when the residual
domain is nonempty. With an empty residual domain, no second trait is required
and the use remains pending; the source does not fabricate or consume a result.

The same-offer Cherished cases are mandatory regression owners:

- **Cherished selected first:** its synchronous acquisition reconstructs an
  unused current Epic Stone to Heroic before the Stone check; with a nonempty
  residual domain, proc is forced and the use is consumed.
- **Stone grants Cherished second:** Stone consumes its use before recursively
  acquiring Cherished; reconstruction preserves zero uses and cannot grant a
  third trait.

Gift Gift Gift creates one Common source with a 25% chance and one use. A
no-proc result preserves that source and use for later qualifying offers. A
successful proc consumes the use but leaves the unslotted source present, so
Gift does not create a fresh Stone replay afterward.

### Application and UI

Borrow Sea Star's post-source timeline disclosure, not its generated-pickup
domain machinery:

- show **Concave Stone procced** after the primary trait selection;
- at 25/50/75 support, expose an authorable checkbox;
- at 100% with a nonempty domain, render proc as required/checked and do not
  offer a legal unchecked intent;
- when procced, show a second frozen trait-screen projection containing the
  original residual rows and one authored random result; and
- keep that screen read-only except for selecting the random result.

Requiredness, residual rows, and retained-invalid findings come from the engine
candidate. React must not infer that Cherished was selected or recalculate
Stone's rank.

### Primary tests

- Catalog/compiler regression for the four chance values, one use, and Common
  Gift replay.
- Strict offer codec coverage that accepts an omitted dormant result and
  rejects malformed tags, missing required fields, and out-of-range residual
  option references.
- Command/candidate tests for optional versus forced proc support and retained
  invalid results.
- Engine matrix for each rank support class, qualifying versus nonqualifying
  offers, replacement exclusion, no post-primary row revalidation, frozen
  rarities, repeated no-proc opportunities, Calling Card nonreplay,
  use-before-secondary ordering, and both exact Cherished same-screen cases.
- Echo witness for one Common replay and nonrecurrence after successful
  consumption.
- Focused UI/product witness for checkbox, forced proc, frozen residual screen,
  second acquisition, and undo/redo.

### Intended commit

`feat(keepsakes): model Concave Stone residual boon`

## Gate D — Transcendent Embryo

### Outcome

Equipping Transcendent Embryo immediately grants one eligible random Chaos
blessing at the source rank. While its driver remains active, each eight
qualifying `RoomsPerUpgrade` completions removes the currently marked
Embryo-created blessing and grants another eligible random blessing at the
driver's current transformation rarity.

### Catalog ownership

Add one explicit `transcendentEmbryo` keepsake effect declaring:

- Chaos as the blessing source;
- Common/Rare/Epic/Heroic blessing rarity by keepsake rank; and
- an interval of eight qualifying rooms.

The declaration replaces Embryo's effect-neutral Gift disposition with one
successful Common replay. The catalog reuses the existing Chaos blessing
collection and declaration-owned rarity operands; it does not duplicate the
blessing list under the keepsake.

### Authored and address ownership

Extend the exact keepsake-equip result vocabulary with an Embryo blessing key
for route start, Postboss replacement, and Echo replay. The result candidate is
computed from the exact pre-equip trait/Arcana/Fated frontier and source rank.
Persist only the selected blessing identity; derive rarity and values.

Add a sparse phase-owned Embryo transformation result keyed to the exact
qualifying encounter-end phase, parallel to Steady Growth's threshold result.
Its command stores or clears one blessing key. Missing state is dormant before
the threshold and incomplete only when that exact phase reaches a required
transformation.

Do not represent either result as a Chaos trait offer. Embryo grants a blessing
without a curse, duration, or three-row player menu.

### Trait history and keepsake state

Introduce a direct Chaos-blessing acquisition/removal event that feeds the
existing mature Chaos blessing state and semantic-tag effects. Mark the exact
driver-owned blessing instance by acquisition identity so transformation
removes only that instance. Other ordinary matured Chaos blessings and an
older blessing whose Embryo marker was detached by unequip must remain intact.

The live Embryo source records:

- ordinary or Echo origin;
- source rank / next transformation rarity;
- progress from zero through seven;
- and the marked blessing acquisition identity.

Echo's existing captured-key and replay-count state owns whether a Common
replay has already been established. Embryo must not duplicate that fact in its
driver.

This state is not a generic timer registry. It is one explicit keepsake
transition using the same exact encounter-end checkpoint pattern as Steady
Growth.

### Simulation chronology

On ordinary route-start or rack equip, require and apply the immediate blessing
result at Common/Rare/Epic/Heroic according to the exact equip rank, starting
progress at zero. A later ordinary rack replacement performs the source
unequip behavior: stop the driver, leave the current blessing equipped, and
detach it from future Embryo transformation ownership.

At each qualifying encounter-end event, advance active Embryo progress once.
At eight:

1. derive the eligible blessing domain from the current state after removing
   the marked blessing;
2. require one authored blessing key when the domain is nonempty;
3. remove only the marked old blessing;
4. acquire the selected new blessing at the driver rarity with
   declaration-derived values and semantic effects; and
5. reset progress to zero.

The domain may contain the same blessing identity that was just removed when
it remains eligible; transformation must not impose an invented no-repeat
rule. Room declarations that suppress `RoomsPerUpgrade` progress use the same
source-backed lifecycle exclusion already consumed by Steady Growth.

Cherished Heirloom preserves the current blessing and exact progress, changes
only the next transformation rarity to Heroic for the active current driver,
and makes a later legal ordinary equip immediately grant Heroic. It does not
replay the equip callback during reconstruction.

Gift Gift Gift creates one Common unslotted driver and one immediate Common
blessing when no replayed Embryo source already exists. That driver follows the
same eight-room Common transformation lifecycle and remains the one successful
replay source. Its immediate result is owned by the exact biome-start replay
address.

### Application and UI

Reuse the existing immediate keepsake-result interaction for route start,
Postboss rack, and Echo replay, with a Chaos-blessing-only selector and derived
rarity/value summary.

At a reached eighth qualifying encounter, render an **Embryo transformation**
selector after End encounter beside other automatic lifecycle outcomes such as
Steady Growth. It is not a room action and cannot be reordered. Run State shows
the source origin, current marked blessing, transformation rarity, and progress
to eight; the blessing itself also appears in the existing Chaos blessing
presentation.

### Primary tests

- Catalog/compiler regression for the four-rank blessing profile, interval
  eight, Chaos source, and one-shot Gift schedule.
- Strict codec/command/candidate tests for immediate and phase transformation
  blessing identities.
- Exact Chaos-domain tests for eligibility, declaration-derived values,
  semantic tags, same-key reselection, and coexistence with ordinary Chaos
  blessings.
- Engine route-start and rack witnesses for immediate Epic/Heroic grants,
  eight qualifying increments, source-owned removal/replacement, suppressed
  rooms, counter reset, and ordinary unequip leaving the blessing while
  stopping future transformations.
- Cherished witness acquired before the eighth threshold proving unchanged
  blessing/progress and a Heroic next transformation.
- Echo witness for one Common replay, exact biome-start result, continued
  Common transformations, and no duplicate replay while its source remains.
- Focused projection/UI tests for all three immediate-result owners, reached
  transformation authoring, missing-result navigation, and Run State progress.

### Intended commit

`feat(keepsakes): model Transcendent Embryo transformations`

## Gate E — Exact Reward Pressure and the Nine Olympian Keepsakes

### Outcome

The planner models the game's three independent Olympian-keepsake effects:

1. ordinary equip or Gift replay appends one exact `Boon` reward priority;
2. the active source steers a qualifying Boon to its declared Olympian until
   matching non-purchase loot materialization spends its provider-force use;
   and
3. the same source permits one provider-specific row rarification up to its
   rank-owned cap.

The generic reward-priority product uses exact reward names rather than a
god-keepsake tag. Gate E exercises it with `Boon`; Gate F reuses it for
`SpellDrop`, `TalentDrop`, and `TalentBigDrop` without changing the queue
contract. Gate E does not implement Moon Beam or Path points.

### Catalog ownership

Add one `olympianRewardPressure` keepsake effect family declaring:

- the exact priority reward name `Boon`;
- one provider-force use;
- one provider-specific rarification use;
- the Common/Rare/Epic maximum-rarity levels 1/2/3 and no Heroic row; and
- the exact provider trait-giver key for each of the nine identities.

The nine declarations use that family with Zeus, Hera, Poseidon, Demeter,
Apollo, Aphrodite, Hephaestus, Hestia, and Ares respectively. The compiler
validates the complete key/value matrix and rejects a mismatched provider,
priority name, use count, or rank table. It must not copy nine closed compiler
branches or infer provider identity by parsing the keepsake key.

Replace each identity's effect-neutral Gift disposition with a successful
Common replay of this same declared effect. Moon Beam stays `modeledNeutral`
for ordinary simulation and Gift replay until Gate F installs the minimal Hex
progress product.

### Ordered exact-name reward-priority state

Add one run-global ordered priority queue to the chronological reward branch,
separate from the currently equipped keepsake and from provider-source state.
Each entry stores only its exact reward-type name. Preserve duplicate entries
and insertion order; do not key or deduplicate the queue by source keepsake.

At an ordinary Olympian equip or Gift replay:

1. append one `Boon` entry;
2. inspect the default `RunProgress` counted bag using its implicit full base
   state when it has not yet been materialized; and
3. if no remaining exact `Boon` entry exists, append one complete base-store
   set by increasing every entry count once while preserving leftovers.

This source-time append is not the reward kernel's ordinary empty-bag refill
and must not wait until a later offer. The implementation should extend the
bag authority with a narrow exact-priority insertion transition rather than
mutating bag counts ad hoc from keepsake code.

At each counted offer generation, compute exact reward eligibility first. If
the current store supports one or more pending priority names, require the
generated authored reward to match the **oldest** supported pending entry,
consume exactly that one queue entry, and consume the ordinary bag entry. If
the current store has no eligible exact match, leave the entire priority queue
pending and run normal reward generation. One generated reward consumes at
most one priority.

The queue is consumed at offer generation even when the player does not take
that exit, wheel option, or Fields cage. It survives source unequip and biome
transitions. Fixed rewards, direct pickups, purchases, Shop and Shrine
inventories, and other paths that bypass counted-store selection neither
satisfy nor consume it.

### Provider-source state and selection

Represent each active Olympian source explicitly with:

- keepsake key and provider key;
- ordinary slotted or Gift-created unslotted origin;
- stable acquisition order;
- zero or one remaining provider-force use;
- zero or one remaining provider-specific rarification use; and
- its effective maximum-rarity level.

This collection must permit at most one current ordinary source and at most one
retained Gift-created source to coexist, matching the authoring freedom the
planner actually exposes. It is not derived from the priority queue: priority
may survive after the source is removed, while a provider source may survive
after its priority is consumed.

For an ordinary generated Boon, select the first qualifying active source in
acquisition order whose provider is not already excluded by an earlier sibling
Boon in the same generated batch. Bind that provider to the existing authored
reward/trait-offer product. Generating the door does not spend the provider
force, so an unchosen forced-provider exit leaves it active.

For Devotion, start from the providers already present in loot history and use
the last qualifying active source in acquisition order as Loot A. Loot B must
remain a different provider. Preserve this source-backed ordering difference;
do not normalize Devotion to ordinary first-source selection.

An authored provider or trait offer that disagrees with the reached forced
provider is retained and receives one exact repairable finding at its existing
semantic owner. No new authored “which keepsake forced this” field is added.

### Provider-force materialization consumption

Spend every matching active provider-force use when the concrete provider's
non-purchase loot object is materialized. The engine transition belongs to the
producer/materialization lifecycle and runs before optional pickup or trait-row
selection. Gate E must close the source-audit matrix for all already-modeled
producers:

- entered ordinary Boon room rewards spend at post-combat loot spawn;
- unchosen exits and Nemesis-suppressed room rewards do not spend because no
  corresponding loot object spawns;
- Fields cages spend when their locked loot object is created;
- Fields optional Boons are not provider-steered by generic bonus generation,
  but an independently selected matching provider still spends at spawn;
- Devotion spends when its two initial loot objects materialize, before the
  player chooses between them;
- fixed or direct free god loot does not change provider but spends a matching
  source when materialized;
- standard purchases do not spend provider force; and
- Mystery Boon does not use provider steering, but a matching unwrap result
  spends force at its existing post-purchase loot-materialization contact.

This is an automatic chronological transition. It creates no checkbox and is
not controlled by the reward's required-versus-optional pickup disposition.
Implement one narrow provider-materialized transition and invoke it only from
the existing source-owned chronology contacts reached by this matrix: selected
room reward/fixed/cage/Devotion materialization, Fields optional offer-point
materialization, and Mystery Boon's existing `afterUnwrap` role. No new generic
loot event, authored state, or parallel pipeline is permitted. If one of those
contacts does not carry enough provider/provenance information in live code,
the gate stops for plan review instead of adding an unplanned transport model.

### Provider-specific rarification

Reuse the existing row-level `rarificationActions` authoring and trait-offer
UI. On a matching provider offer, resolve an available provider-specific source
before Calling Card. A successful legal action upgrades the selected row one
step, respects the source's declared maximum, and spends the source's one
nested rarification use. An unavailable or excess authored action remains
repairable through the existing Calling-Card-style action finding rather than
creating a second keepsake selector.

Provider-force use, provider-rarification use, and reward priority are
independent. Spending one must not spend either of the others. When a Gift
source's nested rarification use reaches zero, remove that unslotted source as
the game does; this can permit a later biome-start Gift replay even if the
provider-force use was spent earlier. A slotted source remains the current
keepsake with its independently spent fields.

### Ordinary, Cherished, and Gift contacts

Ordinary route-start and Postboss-rack equip use the keepsake's Epic row, add a
new priority, and create one provider-force plus one rarification use. Replacing
the keepsake removes that slotted provider source but leaves every previously
inserted priority pending.

Cherished Heirloom reconstruction:

- adds no priority because it does not replay the `FromLoot` callback;
- preserves an unspent or spent provider-force use exactly;
- resets the non-preserved provider-specific rarification use to exactly one;
- does not add one to an already-unspent rarification use; and
- leaves the Olympian effect at Epic because its declaration has no Heroic
  row. A later ordinary Olympian equip while Cherished is active also uses the
  Epic declaration row.

Gift Gift Gift creates one Common unslotted source, one `Boon` priority, one
provider-force use, and one Common-cap rarification use. Spending provider
force alone does not remove that source or permit another replay. Spending its
rarification use removes the unslotted source and permits a later replay under
the existing every-biome Gift schedule. An ordinary different-god keepsake may
coexist, and acquisition order must govern ordinary and Devotion provider
selection deterministically.

### Application and UI

Do not add a new result editor. Project the reached effective reward and forced
provider through the existing reward and trait-offer controls, and reuse the
existing row rarification action. Candidates and findings, not React, enforce
priority/provider support and source precedence.

Run State should expose only the state needed to understand future authored
outcomes: the ordered pending exact reward names and each active provider
source's provider, origin, force-use status, rarification-use status, and cap.
It must not expose bag-internal indices, producer callbacks, or a manually
editable force toggle.

### Primary tests

- Catalog/compiler matrix covering all nine keepsake/provider mappings, the
  shared exact `Boon` priority, 1/2/3/no-Heroic rank profile, both use counts,
  and Common Gift replay.
- Reward-kernel tests for priority insertion with matching leftovers,
  source-time full-set append without discarding leftovers, duplicate queue
  order, oldest-supported selection, ineligible exact entries, and one
  consumption per generated reward.
- Engine generation tests proving unpicked offers consume priority, unequip
  does not, unsupported stores retain it, and fixed rewards, purchases, Shops,
  and Shrines bypass it.
- Provider-selection tests for ordinary first-source ordering, sibling
  provider exclusion, Devotion's prior-history requirement and last-source
  ordering, retained mismatched authoring, and coexistence of ordinary/Gift
  sources.
- The complete materialization matrix above, with purchase provenance and
  Mystery Boon as separate witnesses.
- Trait-offer tests for provider-specific precedence over Calling Card, legal
  one-step caps at Common/Rare/Epic, successful-use consumption, invalid extra
  actions, and Gift-source removal only after its rarification use is spent.
- Full ordinary/Cherished/Gift lifecycle witnesses, including swap with a
  pending priority, spent versus unspent force preservation, rarification
  reset-to-one, no Heroic Olympian row, duplicate priorities, and later Gift
  replay after unslotted-source removal.
- Focused Run State and product-loop witnesses showing a forced generated Boon
  and provider without adding a second authoring control.

### Intended commit

`feat(keepsakes): model Olympian reward pressure`

## Gate F — Minimal Hex Progress and Moon Beam

### Outcome

The planner accounts for Path points without authoring Hex-tree nodes, and
Moon Beam becomes a complete effect rather than a priority-only partial:

- Moon Beam point grants are visible before the next writable Path screen;
- Aspect of Selene's routed `SpellDrop` settles the same three Path points as a
  normal `TalentDrop`, without a spell offer or positional bonus;
- the ordered ordinary `SpellDrop` selection contributes its exact positional
  bonus;
- every acquired Minor, ordinary, or Big Path settles its exact point amount
  through the existing acquisition pipeline; and
- Moon Beam applies its point grant and exact reward priority across ordinary,
  Cherished, and Gift contacts.

Gate F depends on Gate E's exact-name reward-priority queue. It must not reopen
or specialize that queue around Selene state.

### Catalog ownership

Extend normalized declarations with the smallest source-backed facts:

- `MinorTalentDrop`, `TalentDrop`, and `TalentBigDrop` concrete acquisitions
  declare semantic Path grants 1, 3, and 5;
- the `SpellDrop` giver declares ordered option bonuses `[0, 1, 2]`;
- Aspect of Selene's existing fixed Sky Fall and direct-`SpellDrop` branch
  identify the routed three-point Path settlement without adding an Aspect
  point-bank declaration; and
- Moon Beam declares point grants Common/Rare/Epic/Heroic = 3/4/5/7 plus exact
  priority targets `SpellDrop`, `TalentDrop`, and the H/P Postboss
  `TalentBigDrop` overrides.

The keepsake compiler validates Moon Beam's complete point/priority profile and
its Gift schedule. Reward/acquisition and trait-giver compilers each validate
their own local fact; the existing Aspect declaration needs no new point field.
Do not place every Hex fact inside the keepsake declaration merely because Moon
Beam is the first consumer.

Replace Moon Beam's effect-neutral ordinary and Gift dispositions with one
explicit `moonBeam` effect. Gift uses the existing
`oneShotAfterUnequipped` schedule at Common: biome starts are no-ops while an
ordinary Moon Beam trait is still present, and the first later biome start that
can create Echo's unslotted copy owns the point and priority mutations. It is
not an every-biome point grant.

### Minimal Hex progress product

Add one explicit run-chronological Hex progress product to each reward branch:

- **banked Path points** are semantic selections already awarded but waiting
  for a writable Path screen; and
- **invested Path points** are the cumulative semantic selections settled into
  unmodeled nodes.

Both fields have an included consumer: banked points alter the next concrete
Path screen, while invested points preserve the requested aggregate Path
progress afterward for Run State. Do not add total-awarded, pickup-count,
remaining-capacity, or per-Hex variants; they have no included behavior or
test.

This is a normalized stable-frontier product, not a byte-for-byte copy of
`CurrentRun.NumTalentPoints`. The game represents each screen's first point
implicitly; the planner stores full semantic point amounts so 1/3/5 remain
1/3/5 rather than 0/2/4. The product does not duplicate equipped spell
identity, which remains in trait history.

Because this plan keeps `allSpellInvested = false` as its explicit supported
baseline, every reached writable Path screen applies all currently banked
points plus its new grant to `investedPathPoints`, then clears the bank. This is
a deliberate simplification of unknown remaining tree capacity. It must be
documented as such in Run State and tests and must not be described as exact
node investment. Exact tree-capacity and overflow state remain excluded.

Begin-biome branch carryover preserves both counts. No separate pickup-count
ledger is added; existing reward history already records concrete acquisition
counts by reward type.

### Route-start and ordinary Spell Drop chronology

At route start:

1. initialize the Hex progress product;
2. preserve the existing fixed-Sky-Fall trait-history transition when Aspect of
   Selene is selected, without adding Path points; and
3. apply a starting Moon Beam keepsake, if present, at its ordinary rank through
   the same stable point product.

Aspect selection therefore does not alter the route-start Hex bank. Its three
semantic points are introduced only when the routed `SpellDrop` is concretely
acquired.

For a non-Aspect ordinary `SpellDrop`, retain the existing three distinct
ordered rows and selected option. After the selected spell is successfully
installed, derive its bonus from the selected option key:

- option 1 banks zero;
- option 2 banks one; and
- option 3 banks two.

No new authored bonus field or checkbox is allowed. Changing row order remains
a semantic offer edit because the bonus follows position. A missing or invalid
selected spell blocks the acquisition as today and cannot grant a bonus.

For Aspect of Selene, preserve the absence of a spell child. On concrete
`SpellDrop` acquisition, run the shared semantic three-point Path settlement:
combine three new points with the existing bank, move the total to invested
points under the supported-capacity simplification, and clear the bank. Retain
`SpellDrop` as the acquisition-history identity even though its settlement
reuses the normal `TalentDrop` point value. `CreateSpellButtons` and its
zero/one/two bonus remain completely absent. This replaces the current
“unsupported Path” dormant behavior without exposing a second Sky Fall offer
or a standalone Aspect point allocation.

### Concrete Path acquisition settlement

Apply Path grants only after a concrete acquisition of `MinorTalentDrop`,
`TalentDrop`, or `TalentBigDrop` succeeds. At that shared frontier:

1. read the declaration-owned 1/3/5 grant;
2. combine it with all banked points;
3. add the combined amount to invested points under the supported-capacity
   simplification; and
4. clear the bank.

The Aspect-routed `SpellDrop` calls this same settlement with the semantic
three-point value while retaining `SpellDrop` in acquisition history. It does
not add a fourth concrete Path reward declaration.

Because the transition is attached to concrete acquisition, it automatically
works for required and optional pickups, purchases, Hermes Shrine delivery,
Echo reward recreation, and Sea Star duplicates that actually settle through
the shared pipeline. A skipped optional pickup, Time Piece conversion,
Artificer replacement of the source, forfeiture, or destroyed reward grants no
points because it emits no matching concrete acquisition.

Do not implement separate point callbacks in Shop, Shrine, Echo, Sea Star, or
room code. Representative contact tests prove they converge on the shared
transition; the complete 1/3/5 matrix remains owned by the acquisition/catalog
test.

### Moon Beam ordinary equip and priority

An ordinary Moon Beam equip performs two automatic mutations in source order:

1. bank 3/4/5/7 Path points for Common/Rare/Epic/Heroic; and
2. call Gate E's priority insertion transition with one exact reward name.

Choose that exact name from the reached equip frontier:

| State at equip                                           | Priority name   |
| -------------------------------------------------------- | --------------- |
| no acquired `SpellDrop`                                  | `SpellDrop`     |
| acquired `SpellDrop` in `H_PostBoss01` or `P_PostBoss01` | `TalentBigDrop` |
| acquired `SpellDrop` anywhere else                       | `TalentDrop`    |

The test is acquisition history, not an offered or pending `SpellDrop`. Moon
Beam never queues `MinorTalentDrop`, and the priority queue remains exact-name
rather than treating all Path sizes as one family.

Route-start ordinary Moon Beam therefore banks five Epic points and prioritizes
the first `SpellDrop`. A legal later rack equip uses the reached rank, banks its
points immediately, and reevaluates history/current room for priority. Swapping
Moon Beam away does not retract already banked points or its queued priority.

Moon Beam's partial/expired tray text after Spell/Path interaction has no later
sim-altering callback and does not justify a second use ledger. Its functional
point and priority outputs were created at equip.

### Cherished Heirloom and Gift Gift Gift

When Cherished Heirloom reconstructs a current Epic Moon Beam:

- bank exactly two additional points, the Epic-to-Heroic delta;
- do not replay the acquisition callback;
- add no reward priority; and
- preserve all previously banked or invested Hex progress.

A later legal ordinary Moon Beam equip while Cherished is active uses the
Heroic row, banks seven points, and performs the ordinary exact priority
callback.

Gift Gift Gift cannot replay Moon Beam while an ordinary Moon Beam trait is
still present. At the first biome start after that source has been unequipped,
its successful Common replay:

- banks three Common points;
- reevaluates `SpellDrop` history and the current room at that replay frontier;
- inserts the resulting exact priority through Gate E; and
- records the replay through the existing Echo replay event.

The replay is one-shot. The unslotted replayed Moon Beam remains present in the
game and blocks another successful replay; the planner's existing replay count
is sufficient evidence and no removable Moon-Beam-source ledger is added. A
biome-start no-op while ordinary Moon Beam is still equipped neither grants
points nor inserts priority nor consumes the future replay.

### Application and UI

No new editor control is introduced. The existing ordered Spell offer already
authors the only random choice; all point and priority changes are derived.

Add a compact **Hex progress** section to Run State showing:

- the currently equipped base spell from existing trait state;
- banked Path points; and
- invested Path points, labeled as aggregate/sim-neutral rather than exact
  nodes.

Moon Beam remains visible through ordinary keepsake chronology and Echo replay
status. React must not calculate positional bonuses, Path values, Aspect
routing, or priority targets.

### Primary tests

- Catalog/compiler tests for exact 1/3/5 acquisition grants, ordered `[0,1,2]`
  spell bonuses, Moon Beam's 3/4/5/7 profile, exact priority matrix, and
  one-shot Common Gift replay. Aspect requires no new point declaration.
- Hex progress tests for route-start defaults, biome carryover, semantic full
  point amounts rather than raw 0/2/4 bank deltas, and the supported-capacity
  transfer from banked to invested.
- Ordinary `SpellDrop` tests for each selected position, reordered spell
  identities, immediate banking after successful spell installation, and no
  grant from a missing or invalid child.
- Aspect witnesses proving fixed Sky Fall, no route-start Path mutation, no
  spell offer or positional bonus, retained `SpellDrop` acquisition identity,
  and an exact three-point routed settlement through the shared Path
  transition. Include the Q edge: before any concrete `SpellDrop`, its
  `TalentBigDrop` alternative is ineligible; the first Aspect Selene
  acquisition is therefore `SpellDrop` for three points, while a later legal
  Q Big Path grants five.
- Concrete-acquisition tests for Minor/ordinary/Big values, optional skip,
  purchase, one generated duplicate/recreation contact, and conversion or
  forfeiture producing no point mutation.
- Moon Beam route-start/rack tests before and after `SpellDrop`, including H/P
  Postboss Big priority, ordinary Talent priority elsewhere, exact queue
  consumption, no Minor-family match, and swap preserving points/priority.
- Cherished tests for exactly +2 with no priority replay and a later Heroic
  equip producing +7 plus ordinary priority.
- Gift tests for no mutation while ordinary Moon Beam remains equipped, +3 and
  frontier-time priority reevaluation at the first biome start after unequip,
  one replay event, and no later repeated grant.
- Focused Run State and product-loop witnesses showing ordered Spell selection,
  banked points before a Path, and aggregate invested points afterward without
  any Hex-node editor.

### Intended commit

`feat(keepsakes): model Moon Beam and Path points`

## Cross-Gate Review and Validation

### Gate review routine

Each implementation gate uses a fresh executor and a fresh independent
reviewer under the repository's multi-agent delivery routine. The main session
owns the gate specification, accepted finding dispositions, Git operations,
and final bird's-eye diff review. Executors may run narrow owning-lane tests;
reviewers remain read-only.

Every review receives:

- the gate base commit and exact diff;
- this plan's gate section;
- the keepsake, reward-pressure, Path/Spell, and gate-specific lifecycle
  authorities;
- narrow validation results; and
- explicit exclusions from this plan.

One bounded remediation and verification pass follows accepted material
findings. There is no open-ended review loop.

### Narrow validation during implementation

Use the narrowest truthful lanes:

- `npm run test:catalog` for declaration/compiler changes;
- focused `vitest` files and `npm run test:engine` for authored schema,
  candidates, lifecycle, and simulation;
- `npm run test:planner` for projections, Redux, and interaction binding;
- `npm run test:ui` for focused React editor behavior; and
- a representative `npm run test:product` witness only when a gate changes a
  cross-layer product loop.

Do not run the complete repository gate after every adjustment. Test/config
changes or a shared change with broad downstream impact still require the
appropriate broader lane before the gate is committed.

### Final closure after Gate F

After all six gates are stable:

1. run one complete `npm run check` phase-closure gate;
2. update the owning keepsake, Cherished, Gift, reward-pressure, Path, and
   Selene audits from deferred disposition to the truthful implemented boundary
   without deleting source facts or claiming Hex-node coverage;
3. update the smallest owning design authorities only where a stable authored
   or lifecycle contract changed;
4. record the fourteen delivered effects and exact validation result in
   `docs/progress/IMPLEMENTATION_PROGRESS.md`;
5. remove temporary gate language from production comments; and
6. delete this temporary plan in the closure commit after its durable knowledge
   has been absorbed.

The closure review must confirm:

- all fourteen ordinary/Heirloom/Gift matrices are implemented;
- no effect remains declared `modeledNeutral` for these fourteen identities;
- Moon Beam consumes both the exact-name priority queue and the Hex progress
  product, with no priority-only partial implementation;
- Path point accounting is truthful about aggregate investment and does not
  imply individual Hex-node coverage;
- no duplicated eligibility or rank policy exists in React or application
  projections;
- no parallel Chaos, Arcana, rarity, or timeline subsystem was introduced;
- superseded branches and stale “six supported effects” comments/tests were
  removed or updated; and
- production growth is explained by the fourteen concrete behaviors, the exact
  reward-pressure product, and the minimal point account they consume rather
  than a speculative full Hex framework or machinery for excluded keepsakes.

### Intended closure commit

`docs(progress): close modeled keepsake effects`
