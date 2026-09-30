# Catalog Model

## Responsibility

The catalog answers two questions: what supported Hades II facts are declared,
and how are those facts made complete for the engine to consume?

`packages/hades2-catalog` owns source-backed declarations and compilation.
The engine defines the normalized interfaces it needs; catalog construction
implements those interfaces. The catalog owns no authored choices, simulation
counters, candidate policy or application behavior. See
[Architecture](ARCHITECTURE.md) for package direction and
[Planner Engine](SIMULATION_AND_VALIDATION.md) for consumption.

## Evidence and Modeling Decisions

Explicit TypeScript declarations are the application's catalog authority.
Game scripts, focused [audits](../audits/README.md) and targeted native probes
provide evidence. Do not maintain a parallel Lua catalog.

Local source inspection uses `../../1GameData/Scripts/`. When scripts leave a
relevant engine behavior uncertain, retain a bounded audit question and probe
it. Do not turn uncertainty into a permissive production default.

Each relevant source distinction has an explicit disposition:

| Disposition | Meaning                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------- |
| Exact       | Preserve the distinction and every modeled consequence.                                       |
| Simplified  | Collapse alternatives only while all current consumers observe equivalent results.            |
| Deferred    | A relevant effect is not implemented; state the supported baseline or suppression explicitly. |
| Excluded    | Outside the modeled inputs and outputs, such as external profile progression.                 |

A simplification must name what new consumer would invalidate it. Different
history, counters, rewards or eligibility are not equivalent merely because
the current UI renders them alike. Unknown current-run behavior is not
external-state exclusion.

The production catalog represents the supported fully progressed, non-bounty
baseline. Unlocks, prior-run narrative state and unrelated save inventory do
not become predicates without deliberately modeled inputs. Loadout choices
inside the project are different: their normalized facts remain explicit.

## Compilation Pipeline

```text
source evidence
  → readable raw declarations
  → local family normalization
  → immutable family collections
  → relational closure across completed collections
  → immutable Catalog
```

The composition entry is
`packages/hades2-catalog/src/compiler/createCatalog.ts`. Family normalizers
live with rooms, layouts, encounters, traits, rewards and the other declaration
families. Local normalization installs supported defaults and resolves raw
shorthand. Relational closure validates references and policies that require
a complete collection. Neither stage discovers missing facts through hidden
registration or asks a consumer to finish normalization.

Declarations select closed semantic kinds and data. Their materializers,
evaluators and projectors are code owned by the corresponding consumer; a
declaration contains no callback. Closed effect descriptors are not an
extensible event bus or generic effect interpreter.

Raw data must stay auditable. Shared helpers may reduce repetition only when
the room's exits, binding or trait effect remain readable at its declaration
site. Ordering is explicit whenever it affects semantics. Normalized maps,
arrays and nested products are immutable.

## Identity and Default Contracts

Game identities and display labels are separate required fields. A label is
not derived from an internal identifier. One unique Room Declaration per
`gameName` may be referenced by many authored occurrences; the catalog does
not allocate spare maps to simulate repetition.

Global biome identity is not route-qualified. A route owns ordered biome
references, while a biome owns its declarations. Current routes do not repeat
the same biome within one route. Supporting that would require a placement
identity, not renamed global biome keys.

Defaults have an owner and a purpose:

- deterministic active leaves have complete declaration-owned defaults;
- unresolved player choices use the supported required initialization;
- a set default is a structural default, not a promise of contextual legality;
- optional or dormant data does not activate merely because a default exists;
- declaration order alone is not a default unless that selection is explicitly
  part of the contract.

The [authored model](AUTHORED_PROJECT_MODEL.md) owns installation, retention and
replacement. The catalog must not implement commands or select UI focus.

## Routes, Layouts and Rooms

### Layout facts

A layout declares:

- biome-entry counter baselines and completion transition effects;
- an authored-choice or fixed-authored start;
- generated or persistent-Hub progression;
- eligibility-driven or staged target support;
- standard, Fields or Clockwork batch policy and its required fields;
- authored-base-store, source-offer-point or no-store reward policy;
- fixed Boss and route-position Postboss resolution;
- bounded Hub entry, board, visit, restore and handoff facts where applicable.

Room-local exits, rewards, caps and eligibility do not move into layout merely
because several rooms share them. The containing route determines the next
biome. Completion resets are explicit ordered effects, not implicit simulator
behavior. Route declarations map completion rooms by biome and ordinal; the
engine applies those mappings to the authored full itinerary, independently of
its configured prefix. A physical room family is not its route position.

Every route also declares the save profile its run starts from. Underworld,
Surface and Dream start from a mature save. `FreshFile` is the first
Underworld attempt on a brand-new profile: a fixed F → G → H → I route with the
pre-true-ending `I_PreBoss01`, the aspectless Staff as its fixed weapon and
`F_Opening01` as its one opening. The engine owns what that profile means for
loadout authorship, start resolution and initial history.

Content a fresh profile's first attempt can never reach is closed on the
existing declaration by route availability, never by a separate store, Shop
profile or room: a `routeKeyEquals` negation in room eligibility, encounter
requirements, Chaos and Zagreus Contract source requirements, store and Shop
option requirements and god `lootRequirement`; `routeKeyNot` trait
eligibility; and `excludedRouteKeys` on resource support, the Anomaly source,
room features (`roomShop`, `purgingPool`, `keepsakeRackExcludedRouteKeys`),
single-choice boss customization choices and the ordinary boon replacement
roll (`boonReplacement`). A counted store entry may name the `routeKeys` whose
bag holds it. Every listed route key must be a declared route.

First-attempt content a fresh profile does reach uses the same ordinary
facts. `F_Combat01` is forced on `FreshFile` by a `routeKeyEquals` force (its
native `ForceIfEncounterNotCompleted = "FIntroFight"` holds only before that
encounter's first completion) and resolves `FIntroFight` through a
first-position contextual encounter rule. Its counted producer declares the
native `ForcedRewards` Apollo boon under a save-file Apollo use requirement,
and its `firstRunOffer` names the `ForceLootTableFirstRun` table and
`ForceCommonLootFirstRun` rarity on that route.

The G and I combat choices name `FishmanIntro` and `ClockworkIntro` as their
`FreshFile` first-biome identity (`firstBiomeEncounterDefinitionKeyByRoute`,
beside I's mature `GeneratedIChronosIntro` default), so the route resolves the
native `AlwaysForce` intros instead of the Chronos variant that needs
`ClockworkIntro` completed. Each key must be a member of its choice and each
route a declared route. `H_Bridge01` declares a `FreshFile` route overlay: its
native Story reward needs lifetime `RoomsEntered.H_Boss01`, so a fresh profile
realizes the Shop fallback (Shop kind and template, WorldShop binding,
`BridgeShop`, no lifecycle profile). Normalization builds the overlaid room as
a complete declaration and accepts it only when every other normalized fact,
including eligibility, force and caps, is unchanged. The GiftDrop producer
bindings exclude `FreshFile` from their random boon level, which needs the
`WorldUpgradeGiftDropRunProgress` upgrade.

`G_Intro`, `H_Intro` and `I_Intro` declare a `FreshFile` `erisHost`: the curse
trait (`ErisCurseTrait`, rarityless and offered by no giver), the gift reward
type and its `ErisCursePickup` producer lifecycle. Normalization requires an
Intro room, a declared route, a rarityless curse, and a payload-free gift the
producer supports.

The catalog declares one counted run-start reward binding; entry rooms have no
intrinsic incoming reward. A fresh profile's first entry has no run-start
reward. Narrow contextual encounter rules express genuine route-mode and
first-position differences without replacing the whole room declaration; a
route overlay replaces only kind, template, label, reward binding and encounter,
and every consumer of kind, template, label, reward, encounter and lifecycle
facts reads it through the route's room lookup. The engine
resolves these facts with itinerary position into one entry product:
reward binding, lifecycle and declaration-owned entered-store participation.
Editor visibility is not an alternate room declaration.

N's fixed Hub mapping, open-set rules and visit order are separate from ordinary
room pools. Side-slot availability rank describes physical generation pressure;
it is not player visit order or an ordered reward-bag draw. Concrete details
belong to [biome authorities](../biomes/) and
[Game Generation Rules](GAME_GENERATION_RULES.md).

### Room facts

A room declares its game identity and label, authoring mode/template,
structural tags, physical exits, requirements, force/caps, encounter bindings,
incoming producer, local slots, realization policy, dormant defaults and
entered-store-history policy. It does not own occurrence IDs, selected state,
topology links, authored rewards or UI grouping.

The room's offer-reward binding is one closed choice:

- `none`;
- `incomingReward`; or
- `localRewardGroup` naming a supported bounded group on that exact room.

Ordinary bindings derive from the incoming producer; none and Shop producers
have no incoming offer editor. Fields combat can expose its active cage group.
Normalization verifies the named group and its `fieldsCages` capability.
Wheels, Shop inventory, fixed-room slots and Fields optional rewards are not
interchangeable offer groups. This is metadata describing existing leaves, not
a second reward owner.

Bounded reward groups retain stable slots and complete dormant values.
Declaration capacity and effective capacity are distinct; activating a prefix
does not delete the remainder. Miniboss rarity overrides likewise belong to the
room, not copied incoming rewards or givers. They apply through the exact
offer context.

Boss and Postboss are real declarations with real encounters, rewards, exits
and history policies. Commands create their fixed-linked occurrences;
simulation does not synthesize them from constants. Route-position selection
and Rivals variants remain declaration-backed, without extra player map choices.

### Exits and detours

Physical exit types select explicit source/target constraints. An unconstrained
type still has a normalized policy; a missing policy is not permissive.
Room-set identity is not route placement or ordinary candidate eligibility.

Chaos uses one gate kind with distinct `canHost` and `canSpawn` facts. Chaos
and Zagreus Contract exits may each declare a source-local `requirement`,
evaluated at the reached source's placement assessment.
Ixion-generated presence does not add a second Chaos type. Anomaly is a closed
G replacement; Zagreus Contract is a closed additional exit. Their automatic
returns, preview behavior and encounter effects are declared independently.
They do not enter ordinary room pools through a generic special-exit escape
hatch. [Generation](GAME_GENERATION_RULES.md) and
[lifecycle](ROOM_LIFECYCLE_MODEL.md) own their behavior.

## Encounter Composition

The four contracts must remain separate:

| Product              | Owns                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| Encounter Envelope   | Ordered stable slots, structural activation and reward/wheel attachments              |
| Room slot binding    | Exactly one fixed definition or selectable set per slot                               |
| Encounter Definition | Exact identity, kind, requirements, counter/sequence effects and NPC presentation key |
| Encounter Set        | Ordered unique membership and one complete static default                             |

An envelope does not supply encounter identity, counter effects or timing.
A set is not a consumed bag; source weighting is evidence, not normalized
probability state. Only selectable slots need persisted selections. Empty
envelopes and fixed slots use the same contract without fake choices.

Lifecycle profiles execute supported envelope shapes; they do not fill missing
room bindings. H cage phases, O ship phases and P's two-phase composition remain
explicit rather than inferred from a template name. NPC grouping keys are
presentation metadata, never requirement or history identity.

Definitions may additionally declare optional generated-composition decisions:
wave/budget bounds, shared-highlight rules, fixed seeds, native enemy costs/caps,
ordered type exclusions, Fangs pools/filters and Menace mappings/replacement pools.
Normalization preserves family-specific depth/hard
context and fixed-template rules; it does not turn every Combat-room encounter
into a generic generator. A mixed profile declares its fixed leading waves
(spawns with fixed counts), its named generated seeds and native
`RequireCompletedIntro`; the wave bounds are an exact total that exceeds the
fixed waves. An all-fixed combat identity declares `fixedRoster` instead: its
native SpawnWaves in order, each spawn an enemy identity some generated pool
declares, with a positive count. It excludes generated composition, belongs
only to combat identities and is not execution input; every combat identity
declares generated composition, another customization or a fixed roster.
An enemy choice may name its native introduction, which must be a
declared definition; a definition marked as an enemy-triggered introduction must
be named by some enemy. An enemy choice may also declare an admission
requirement for its native profile gate. An authoring profile may name the only
routes that offer it (`routeKeys`); other routes' domains omit it and reject
selecting it. Each biome declares its `MinDepthBeforeIntros`.
Introduction gates use `encounterCompletionCount` (route completions) beside
`encounterKeyCount` (route or biome records); both are admitted only in
Encounter Definition requirements and enemy `admission` requirements. The
[composition matrix](../audits/rooms-and-routes/COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md)
owns the supported inventory. Engine assessment, not catalog declarations,
determines whether an authored composition is possible in its exact context.

## Rewards and Acquisitions

Reward declarations compose payload domains, reward types, concrete acquisition
roles, stores/bags or Shop groups, producer bindings and producer lifecycles.
[Reward Model](REWARD_MODEL.md) owns their behavioral distinctions.

A reward type owns its identity, payload shape, complete offer default,
optional offer projection, source-support policy/resolution point and named
acquisition roles. Each role resolves self, fixed or typed-payload-source
identity. Concrete acquisitions separately declare exact history projection
(`lootAndUse` or `consumableAndUse`) and base capabilities, including a
`resourceGrant` of whole resource amounts by resource key. A producer lifecycle
may declare `resourceBonusExempt` (source `NPCDrop`), `duplicationExempt`
(source `CanDuplicate = false`) or per-acquisition `resourceGrantOverrides`; a trait may declare a rarity-resolved
`resourceRewardBonus` whose resources some pickup must grant.

The source-support vocabulary is closed: `ordinaryBoonPeer`,
`ordinaryNoPeer`, `ordinaryInteracted` and `devotionAcquiredPair`. An ordinary
god's concrete loot acquisition may declare a `lootRequirement` (source LootData
`GameStateRequirements`); its keys must be ordinary gods, and the save-file god
records (`lifetimeGodUseRecord`, `lifetimeGodPickupRecord`) are admitted only
there. The `resourceGains` record is admitted in loot, reward-store and Shop
requirements, where reward history is evaluated, and rejected elsewhere. A source-bearing payload needs
a compatible policy and resolution point. Blind Box resolves at its
`hiddenSource` acquisition role; its inventory identity is not an acquired
god. Producer-specific authoring remains in Reward Model.

Offer projections describe exact extra writes caused by an offer, such as
Devotion spacing. Common offer history and bag depletion remain kernel
behavior, not repeated per-reward declarations. Acquisition kind does not
stand in for its history projection, and no generic `acquiredAs` alias
replaces concrete identities.

Counted entries own requirements, multiplicity and duplicate policy. Shop
groups instead own counts and without-replacement membership; their emitted
slots have explicit keys, labels, groups and distinct valid defaults. Neither
slot identity nor default selection is inferred from option order.

A producer lifecycle enumerates supported reward types and binds every role
exactly once, with explicit per-type overrides. Producer bindings choose
stores, fixed sources, Shop profiles and filters. Positive and negative filters
must be compatible and disjoint; a filter that excludes the ordinary default
requires an explicit allowed default, not the first surviving member.

Concrete acquisition capability is only the base fact. Time Piece, Artificer,
Sea Star and Echo replay may be narrowed by producer lifecycle and instance
provenance. A paid purchase and a free pickup inside the same Shop are not
equivalent instances.

## Traits, Loadout and Supported Effects

Trait declarations are giver-neutral facts: requirement origins, fresh/equipped
rarity domains, slot, elements, core-god and boon-rarity classification,
stacking/rarify flags, rarity-count exclusions, targeted effects and
weapon/aspect compatibility.

Requirements retain their source origin in two coherent collections:
`eligibilityRequirements` for current-state/context conditions, and
`linkedBoonRequirements` for the native positive boon graph. Ordinary offers
use both; Echo replay retains eligibility but bypasses linked prerequisites.
A predicate referring to a trait is not necessarily linked: Hex state,
elemental conditions and cast exclusions retain their actual source ownership.
Keep each Boolean group intact rather than attaching bypass flags to individual
operands.

`optionalLinkedPriority` declares a separate optional initial-generation path.
Its boolean support is sufficient; the exact nonzero native probability belongs
in source evidence. Personal Loan's `nonFinalBossRarityBlock` is a lifecycle
descriptor, not a declaration-wide permanent rarity ban; the equipped-instance
block is derived by simulation.

Givers own ordered membership, priority sets, rarity policy and complete
defaults for their supported loadouts. Rarity policies are selectable, fixed
or none. Player rarity and Hammer Rank I/II are different axes. Field NPCs are
not Olympians merely because they offer ranked boons. Calling Card menu
participation is also a separate fact, not an alias for ordinary god behavior.

Provider bases, sparse room/item rarity overrides, additive/multiplicative
contributions and supported fresh domains remain distinct data. The engine
combines them at an exact offer frontier. Equipped Heroic is not a fresh roll;
replacement and explicit promotion supply their own transitions.
[The rarity audit](../audits/traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md) and
[trait-pool audit](../audits/traits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
own source matrices.

Supported NPC effects declare acquisition-ordinal values, not an authored
rarity proxy. The engine resolves immediate counts at acquisition and retains
ongoing producer values on the acquired instance. Later biome movement cannot
retune Supply Chain. Combat-only numeric NPC effects remain native.

Targeted acquisitions and selected dispositions form closed unions.
Examples include Bridal Glow's god-trait promotion, Latest Model's Hammer
upgrade, Natural Selection's ordered levels, Ransoms' provider effects,
All Together's direct pairs and Travel Deal's refill. Normalize each descriptor
and its referenced domains; do not create callbacks or a generic effect
registry to avoid an exhaustive case. Shared Hephaestus upgrade limits are
declaration data consumed by a shared engine predicate, not copied into each
target editor.

Keepsake identity coverage is broader than effect coverage. The ordinary rack
is complete under the unlocked baseline, with a fixed Epic starting rank and
Fated disposition. Supported rank profiles, Cherished Heirloom advancement and
Gift eligibility/replay descriptors are explicit data. Gift eligibility and
its effect schedule are separate axes. Capability facts stay with the family
that answers the question—trait giver, concrete acquisition or encounter—not
duplicated on the keepsake. Exact values and exclusions live in the
[keepsake audits](../audits/README.md#loadout-and-progression).

Arcana and Fear are separate collections. Cards declare board location, Grasp,
ordinary activation and supported rank/effect profiles; Vows declare bounded
ranks and suppressibility. Live activation, bans, consumption and suppression
are simulation state. Spell/Hex declarations similarly describe pools, slots,
layout domains and aspect links, not live tree closure or delivery clocks.
All such effects must be normalized before entering production; an identity
alone does not justify an unsupported effect transition.

## Requirement and Closure Obligations

Requirements are typed expressions over run ledgers and, where a scope admits
them, derived save-file records. Unknown kinds and missing
evaluators fail construction; a missing required evaluation context is a
contract failure, not ineligibility. Boolean composition, counters, record
counts, current options/reward, peer order and Clockwork facts remain explicit
operands. No requirement reads application state or disguises an unmodeled
external predicate as a depth bound.

Normalization must establish the following before returning the catalog:

| Family         | Closure required                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Identity       | Unique keys/game names, required labels, valid referenced keys                                                               |
| Rooms/layouts  | Complete template inputs/defaults, valid modes, compatible local groups and fixed links, sufficient structural bounds        |
| Encounters     | Unique slots, exactly one binding per slot, valid set members/defaults, compatible envelope execution                        |
| Rewards        | Compatible payload/source policies, concrete role resolution, exact role-complete lifecycle bindings, valid filters/defaults |
| Bags/Shops     | Explicit ordering and duplicate policy, valid group cardinality, complete stable slots and distinct group defaults           |
| Traits/loadout | Valid pool/priority membership, rarity domains, loadout defaults, target/disposition references and rank profiles            |
| Operations     | Registered closed requirement, lifecycle and effect kinds; no missing implementation fallback                                |

Exact declaration order and membership matrices are attested by catalog tests.
Production closure validates supported shapes and relationships, not a second
hand-maintained inventory manifest. Compiler type checks and exhaustive
dispatch protect closed vocabularies.

## Extending and Maintaining the Catalog

Begin in the nearest declaration family. If an existing contract expresses the
fact, add data and focused declaration/normalization tests. Do not add an engine
kind or UI branch merely to identify another room or item.

For a new semantic kind, establish the normalized contract and its consumer
before production assembly admits the declaration. A production route implies
a complete authored, simulation, candidate, editor and persistence path;
development-status flags and placeholders are not catalog values.

Local normalizers return complete family products. Put cross-family checks in
relational closure after those products exist. Keep the full rejection matrix
at the catalog boundary, with representative downstream consumption witnesses.

Catalog compatibility identity changes when declaration semantics change.
Strict loading either accepts the supported identity, uses an explicit supported
migration, or requires user action. Never silently reinterpret an old plan.
The execution artifact likewise carries its exact admitted catalog identity.

Document surprising source/model differences in the owning audit and update
the model owner when semantics change. Do not repeat exact counts and numeric
profiles across architecture documents: declarations, audits and their tests
are the place to inspect them.
