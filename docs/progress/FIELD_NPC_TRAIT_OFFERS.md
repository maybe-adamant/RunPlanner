# Field-NPC Trait Offer Expansion

## Status

**Active delivery plan.** Planning baseline: `3088b80`. Gate A (Artemis)
landed in `36fcfa4`; Gate B (Athena) landed in `1fc84dc`; Gate C (Bridal Glow)
landed in `3dcbf44`. Gate D (Icarus) is active on the completed shared
exact-one targeted-acquisition contract.

This is an isolated delivery document. Do not link it from the stable design or
progress indexes while implementation is active. At closure, absorb durable
contracts into their owning design, biome, and audit documents, record the
result in `IMPLEMENTATION_PROGRESS.md`, and retire this file.

## Objective

Add concrete three-choice trait offers for the already-supported Artemis,
Icarus, and Athena field encounters. A selected NPC encounter should expose one
encounter-owned trait offer, apply the selected trait to chronological trait
history when that encounter completes, participate in progressive trait
evaluation, and reuse the existing trait dialog and run-state presentation.

Before Icarus, correct the existing persistent-trait lifecycle for the narrow
game pattern shared by Hera's Bridal Glow and Icarus's Latest Model: acquiring
and retaining one source trait, randomly choosing exactly one eligible equipped
trait, and applying one declaration-owned transition to that target. The
planner authors which possible random target occurred; it does not model target
probability.

This is a trait-producer expansion, not a second NPC simulator. Encounter
eligibility, route cardinality, spacing, incoming-reward exclusions, placement,
and encounter history already belong to the concrete encounter declarations
and evaluator.

## Source Authorities

- `docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md` owns giver membership,
  dependencies, elements, rarity facts, and exceptional effect evidence.
- `docs/audits/ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md` owns encounter
  placement and run-history eligibility.
- Installed `NPCData_Artemis.lua`, `NPCData_Icarus.lua`,
  `NPCData_Athena.lua`, `TraitData_Hera.lua`, the corresponding
  `TraitData_*` files, and the target functions in `TraitLogic.lua` and
  `PowersLogic.lua` remain the primary source for the preflight corrections
  named below.

The baseline catalog contained 11 trait givers: the nine ordinary Olympians,
Hermes, and Weapon Upgrade. Artemis and Athena are now production givers;
Icarus remains the final giver in this slice. The complete field-NPC expansion
adds three givers and 25 pool members:

| Giver   | Supported encounters                                 | Trait count |
| ------- | ---------------------------------------------------- | ----------: |
| Artemis | `ArtemisCombatF`, `ArtemisCombatG`, `ArtemisCombatN` |           9 |
| Icarus  | `IcarusCombatO`, `IcarusCombatP`                     |           8 |
| Athena  | `AthenaCombatP`                                      |           8 |

### Artemis pool

`SupportingFireBoon`, `CritBonusBoon`, `DashOmegaBuffBoon`,
`HighHealthCritBoon`, `InsideCastCritBoon`, `OmegaCastVolleyBoon`,
`TimedCritVulnerabilityBoon`, `FocusCritBoon`, `SorceryCritBoon`.

### Icarus pool

`FocusAttackDamageTrait`, `FocusSpecialDamageTrait`, `OmegaExplodeBoon`,
`CastHazardBoon`, `BreakInvincibleArmorBoon`, `BreakExplosiveArmorBoon`,
`SupplyDropBoon`, `UpgradeHammerBoon`.

### Athena pool

`InvulnerabilityDashBoon`, `RetaliateInvulnerabilityBoon`,
`FocusLastStandBoon`, `DeathDefianceRefillBoon`, `AthenaProjectileBoon`,
`InvulnerabilityCastBoon`, `ManaSpearBoon`, `OlympianSpellCountBoon`.

## Locked Product Contract

### Declaration ownership

An encounter definition may declare one trait-offer producer with an exact
`giverKey`. Do not infer semantic production from `npcPresentationKey`, labels,
encounter-name prefixes, or a UI-maintained NPC table. `npcPresentationKey`
remains presentation-only.

The normalized compiler must prove that the referenced giver exists. By
closure, the six standard encounter definitions above declare their
corresponding giver. The currently collapsed intro/reweight variants do not
return as part of this work.

Field NPCs receive an explicit non-Olympian provider kind. They must not enter
the first-Olympian rule, ordinary-slot replacement composition, god-pool
source history, or reward-source support merely because Artemis and Athena are
Olympian characters.

### Authored ownership and dormancy

The exact `EncounterPhaseAddress` owns the NPC offer. Extend
`TraitOfferOwnerAddress` to admit an encounter phase; do not attach the offer
to the room's incoming reward or invent a synthetic reward acquisition.

`RoomEncounterState` retains sparse offers by phase key and concrete encounter
key. The intended shape is equivalent to:

```ts
traitOffersByPhase?: Readonly<
  Record<string, Readonly<Record<string, AuthoredTraitOffer>>>
>;
```

The concrete type may use a named nested product, but it must preserve these
semantics:

- an ordinary selected encounter does not eagerly serialize every potential
  NPC offer;
- selecting an NPC encounter atomically installs its complete declaration-owned
  default offer if no retained offer exists;
- selecting another encounter makes the old offer dormant rather than deleting
  it;
- selecting the same NPC encounter again restores the retained offer;
- retained entries are legal only for encounter definitions admitted by that
  exact phase and declaring that exact giver;
- room replacement retains an entry only when the replacement room preserves
  the same stable phase and legal concrete NPC definition;
- fixed/default resets use the same retention rule;
- only the currently selected, entered encounter publishes, evaluates, or
  acquires its offer.

This implements the general picked-room customization policy without filling
unpicked alternatives with speculative authored data.

Use one stable child role for the offer under its phase (for example
`selection`). Do not rename the existing `TraitOfferAddress` child field as
part of this feature unless a concrete type conflict makes that unavoidable.

### Persistence boundary

Gate A already bumped the project schema for sparse encounter-owned offers.
Gate C adds a persisted trait-option target, so it must bump schema 16 once
more and bump the catalog version with the targeted declaration. Follow the
repository's current exact-version policy: stale files are preserved and
rejected rather than passed through a production migration layer. Sparse empty
state and absent option targets should be omitted from encoded documents.

### Chronology

The selected NPC trait offer is reached at that exact encounter's existing
`encounterCompleted` event. The reward/trait branch processor should apply the
NPC offer before processing any encounter-local reward attached to the same
completion event. The ordinary incoming room reward continues at its declared
producer lifecycle point.

Under the current supported reward exclusions, no same-room modeled trait
offer competes with an Artemis, Icarus, or Athena offer. Therefore a fixed
encounter-completion ordering is equivalent for present simulation while
remaining explicit for later producers.

Do not add a duplicate NPC history ledger or a second trait fold. The existing
`TraitOfferEvent`, equipped-trait fold, derived element/rarity facts, selected
offer assessments, and candidate artifacts must consume the encounter-owned
offer.

### Exact-one targeted acquisition

`BoonDecayBoon` and `UpgradeHammerBoon` are persistent source traits with an
additional acquisition-time transition. Neither is an effect-only choice. The
game first adds the source trait, then randomly targets exactly one eligible
equipped trait. Model that common shape with one closed declaration-owned
product, equivalent to:

```ts
type TargetedTraitAcquisition =
  | {
      readonly kind: 'promoteGodTraitToHeroic';
      readonly target: 'superchargeableGodTrait';
    }
  | {
      readonly kind: 'upgradeHammerToRank2';
      readonly target: 'upgradableHammer';
    };
```

The exact spelling may follow the owning catalog-schema neighborhood, but the
contract is closed and exhaustive. Do not add callback names, arbitrary
arguments, an effect interpreter, a list of targets, or a generic scripting
language.

One authored trait option may retain one optional `targetTraitKey`. The field
is permitted only when that option's declaration owns a targeted acquisition.
It is structurally optional so an incomplete or newly selected acquisition can
remain editable. A retained target on an unselected option is dormant and has
no effect; changing back to that option restores and reevaluates it. The
selected targeted option requires exactly one valid target before acquisition
can fold. Arrays and target counts are not part of the authored contract.

Offer eligibility and acquisition-target validity are related but distinct:

- every offered targeted trait requires a nonempty eligible-target set in the
  exact pre-offer history, even when that alternative is not selected;
- only the selected option requires an exact authored `targetTraitKey`;
- missing or stale selected targets remain authored and receive a finding;
- an unselected targeted alternative is not invalid merely because it has no
  exact authored target;
- candidate evaluation derives both facts from one authoritative target
  predicate; React and application projections do not inspect equipped state.

The exact-address trait candidate capability must therefore support two sibling
questions without exposing its retained pre-offer histories:

1. whether a proposed trait alternative has at least one eligible target; and
2. which exact equipped trait keys are possible targets for the selected
   alternative, with branch-aware support and retained-invalid evidence.

The target domain is the declaration-ordered union of eligible equipped keys
from the retained pre-offer branches plus the currently authored target when
it is no longer eligible. Support remains existential across valid branches,
matching the existing trait candidate contract. The application must not use
the public run-state projection to reconstruct this union.

The application projects the second product through the existing contextual
picker vocabulary. A focused trait choice remains selectable when a downstream
target choice can complete it; the complete offer remains unsupported until
its selected target is valid. This preserves the current compound-picker
contract without letting the application reinterpret a blocking finding.

Chronological replay validates the target against the pre-acquisition equipped
ledger, records the exact target transition on the ordinary `TraitOfferEvent`,
equips the source trait, applies the transition to that target, and then derives
the normal element, rarity, slot, and rarity-floor facts. There is no separate
target history or second fold.

For Bridal Glow, the exact supported target predicate is one equipped
persistent god trait that:

- has ranked rarity state and a supported next in-run rarity;
- is not `BlockInRunRarify`;
- is not `BlockStacking`.

The current `superchargeableTrait` evaluator omits the
`BlockInRunRarify` exclusion even though the game query requires it. Gate C
corrects that defect and makes the same predicate own both nonempty offer
eligibility and exact target candidates. If `superchargeableTrait` has no
remaining independent consumer after the targeted declaration owns that
predicate, retire it rather than retain duplicate policy.

Bridal Glow promotes the authored target to Heroic. Its level/stack grant and
the Hephaestus cooldown exception remain explicitly deferred. Bridal Glow
itself remains equipped with its authored rarity and Water contribution.

For Latest Model, the target predicate is an equipped Rank-I Hammer that the
catalog declares capable of Rank II. The transition changes only that target
to Rank II. Hammers remain player-facing rarityless: represent Rank I/II as
Hammer state rather than leaking the game's internal Common/Legendary encoding
into ordinary trait rarity. The selected `UpgradeHammerBoon` source itself
remains equipped at its fixed provider rarity.

### Evaluation and findings

- The existing exactly-three-distinct-options rule applies.
- Existing uniqueness and declaration-owned prerequisites apply.
- Field-NPC offers do not use first-Olympian composition or Olympian
  replacement composition.
- A context-invalid selected offer is preserved and receives the existing
  trait finding at its encounter-owned `TraitOfferAddress`.
- Progressive candidates are available only when simulation reaches the
  encounter-completion context for that exact selected phase.
- Changing away from the NPC encounter makes its offer dormant: it contributes
  no event, equipped trait, derived facts, candidate surface, or finding.
- Changing back restores and reevaluates it against the new chronological
  state.
- Invalid NPC trait authorship must not retroactively invalidate encounter
  selection candidates. The encounter remains a structurally representable
  choice; its nested trait finding explains the invalid leaf.

`SorceryCritBoon` and `OlympianSpellCountBoon` retain their exact spell/talent
dependency keys. Because the planner does not yet acquire those dependencies,
these options remain candidate-ineligible rather than having their requirements
deleted or treated as satisfied.

### UI

For a picked/entered room whose selected phase is Artemis, Icarus, or Athena:

- keep the existing encounter picker in room customization;
- show the existing `Edit Trait: <selected trait> · <rarity>` action beside
  that selected encounter phase;
- open the existing trait dialog and contextual picker;
- keep findings in the dialog's fixed finding region;
- expose the same offer in the route Traits index and make its navigation
  resolve to the containing room customization surface;
- include the acquired selection under run-state equipped traits and derived
  facts at later decisions.

When an offered option declares targeted acquisition:

- keep the trait unavailable in the trait picker when its exact pre-offer
  history has no eligible target;
- pin and explain an already-authored invalid trait instead of hiding its
  repair controls;
- when that option is selected for acquisition, render one `Target`
  contextual picker beneath its trait/rarity controls;
- populate that picker only from the bound engine target-candidate product and
  use catalog labels rather than declaration keys;
- omit the target picker for unselected alternatives while retaining their
  dormant authored target;
- keep missing/invalid target feedback in the dialog's fixed finding region;
- disable Save until the complete selected acquisition has one supported
  target;
- never silently choose among multiple possible random outcomes.

Changing the option's trait clears an incompatible target. Selecting another
offer option makes the prior target dormant; selecting the original option
restores and reevaluates it. The entire offer, including its target, is saved
through the existing single semantic `ReplaceTraitOffer` command and therefore
remains one undoable edit. Do not add a target-only Redux or React command.

Do not show an NPC trait action for an unpicked room, an unvisited Ephyra room,
an inactive encounter alternative, or a dormant retained offer. Do not create
a new NPC-specific modal or duplicate trait picker.

## Explicit Scope Boundaries

Included:

- the six standard encounter identities already present in production sets;
- exact three-option authored offers and one selected option;
- exact trait labels, pool membership, rarity domains, elements, flags, and
  currently representable requirements;
- chronological acquisition, equipped state, candidates, findings, run state,
  persistence, undo/redo, and navigation;
- one exact authored acquisition target for Bridal Glow and Latest Model;
- Bridal Glow's target-to-Heroic transition and Latest Model's Hammer Rank-II
  transition.

Excluded except for the narrow Gate C/D transitions stated above:

- Artemis/Icarus/Athena intro and cross-run reweight identities;
- save/profile progression predicates already collapsed by the encounter
  baseline;
- probability and weighting of options or rarities;
- spell/Hex/Talent acquisition;
- trait mechanical effects, damage, armor, Death Defiance, consumable drops,
  levels, and stacks. Gate C admits only the exact-one targeted acquisition
  contract required by Bridal Glow and Latest Model; Bridal Glow's level/stack
  grant remains deferred;
- Story-room givers, Arachne, Nemesis random events, Heracles rewards, Wells,
  Keepsakes, and other trait providers;
- a generic effect language or synthetic reward representation.

## Preflight Facts That Must Be Closed

Close these facts from source before the production gate that consumes them.
Artemis facts were closed in Gate A and Athena facts in Gate B. Bridal Glow's
target facts belong to Gate C; Icarus facts belong to Gate D:

1. Fresh and equipped rarity domains for all three givers. In particular,
   distinguish provider roll possibilities from per-trait fixed Legendary
   identities and confirm whether field-NPC Heroic is ever a fresh offer.
2. Player-facing labels for all 25 traits and all three givers.
3. Element contributions, persistent-god classification, stacking/rarify
   flags, and every positive or negative offer requirement.
4. Whether each selected key remains in the hero's persistent trait inventory
   after acquisition. Source execution confirms `BoonDecayBoon` and
   `UpgradeHammerBoon` both remain equipped while their acquisition functions
   target another trait; do not classify either as effect-only.
5. Whether Artemis, Icarus, and Athena always present three choices under the
   supported progressed baseline. If a live provider can expose fewer than
   three for a reason inside current modeled state, stop and revise the authored
   offer cardinality contract before implementation.
6. The exact Rank-II-compatible Hammer inventory. Do not infer that every
   normalized Hammer can be upgraded merely because it belongs to the Hammer
   giver or matches the active weapon/aspect.

This preflight corrects the stable audit. It must not create production
`unknown`, `unsupported`, or guessed defaults merely to unblock delivery.

## Delivery Gates

### Gate A — Artemis contract slice

Deliver the complete encounter-owned trait-offer path with Artemis as the
vertical witness:

- source-audit corrections required by the preflight;
- field-NPC giver/provider schema and Artemis's nine declarations;
- explicit producer declarations on `ArtemisCombatF/G/N`;
- schema/version bump and sparse encounter-owned authored offers;
- select/reset/replacement reconciliation and trait commands;
- materialization through `EncounterPhaseAddress`;
- encounter-completion evaluation, acquisition, findings, and candidates;
- structured-workspace control, existing dialog, route index, run state, and
  semantic navigation;
- F/G/N engine and one representative product-loop witness.

Acceptance:

- selecting Artemis creates one complete default offer;
- editing it is one semantic undoable command;
- switching to ordinary combat hides but retains it;
- switching back restores it;
- only a reached Artemis encounter equips the selected trait;
- later trait offers see the Artemis trait and its derived element facts;
- an invalid Artemis option remains authored and points to the exact trait
  control;
- no reward owner or `npcPresentationKey` becomes semantic authority.

### Gate B — Athena extension

Add the eight Athena declarations and attach the giver to `AthenaCombatP`.
Reuse Gate A's authored, simulation, candidate, and UI paths without an
Athena-specific dispatcher or another schema change.

Acceptance:

- the source preflight records Athena's exact labels, rarity domains, elements,
  persistence flags, and requirements before declarations are added;
- Athena uses the shared field-NPC path;
- P's multi-phase envelope owns the offer at the exact selected Athena phase;
- switching between Athena and an ordinary identity hides but retains the
  Athena offer, and switching back restores it;
- exact equipped-trait prerequisites participate in progressive candidates;
- `OlympianSpellCountBoon` remains unavailable until its real dependency is
  modeled;
- Athena traits do not trigger first-Olympian or ordinary replacement rules;
- a reached Athena encounter equips its selected persistent trait at
  `encounterCompleted` and later state sees its derived facts;
- the existing workspace control, dialog, route index, navigation, and run
  state consume Athena without provider-specific UI.

### Gate C — Bridal Glow exact-one targeted acquisition

Use the already-modeled `BoonDecayBoon` as the first complete witness for the
shared contract. This gate is a correction to the existing trait lifecycle,
not Icarus production work.

Before production edits, correct the trait audit with the installed
`HasSuperchargeableBoon` and `HeraSuperchargeBoon` predicates, exact-one random
target cardinality, source-trait persistence, Heroic promotion, and explicit
level/stack deferral.

Catalog and authored model:

- add the closed targeted-acquisition declaration product;
- declare Bridal Glow's exact superchargeable-god target and Heroic transition;
- add one optional `targetTraitKey` to `AuthoredTraitOption`;
- update both ordinary reward-owned and encounter-owned codecs, structural
  command validation, immutable copying, and schema fixtures;
- bump project schema 16 once for the persisted option shape, bump the catalog
  version, and follow the exact-version rejection policy; do not add a
  migration layer;
- permit the target only for a declaration with targeted acquisition, while
  preserving a missing selected target as structurally editable.

Engine evaluation and chronology:

- extract one authoritative Bridal Glow target predicate and correct its
  missing `BlockInRunRarify` exclusion;
- make nonempty target membership part of Bridal Glow's ordinary offer
  eligibility for all three option positions;
- validate an exact target only for the selected option;
- extend the exact-address candidate capability with branch-aware target
  candidates without exposing or reconstructing pre-offer history;
- keep focused trait selection possible when a later target step can complete
  it, while keeping the complete offer invalid until the selected target is
  valid;
- record one exact derived target transition on the ordinary trait event;
- equip Bridal Glow, promote only its authored target to Heroic, and recompute
  the existing derived ledger in the same chronological fold;
- publish missing and invalid target findings at the containing
  `TraitOfferAddress`, including the exact target key as evidence when one was
  authored.

Application and UI:

- extend the trait-domain projection with an engine-backed target domain;
- include `targetTraitKey` in every complete-option equality, revision, and
  candidate/cache identity while keeping trait/rarity aggregation independent
  of the downstream target step;
- render the target with the existing contextual-picker component only for the
  selected targeted option;
- use the existing unavailable disclosure, selected-invalid pinning, fixed
  feedback region, lazy activation, stale-result protection, and dialog-local
  draft behavior;
- save the complete offer through the existing interaction and semantic
  command;
- show the promoted target rarity in later run-state equipped traits.

Acceptance:

- zero eligible targets makes Bridal Glow unavailable as an offer option;
- one eligible target can complete deterministically; multiple targets require
  the author to choose the observed random outcome;
- an unselected Bridal Glow alternative needs no exact target;
- a selected missing or stale target keeps the picker visible and prevents
  Save/acquisition until repaired;
- Common, Rare, and Epic legal targets become Heroic at the exact acquisition
  point, while Heroic, `BlockInRunRarify`, `BlockStacking`, non-god, and Hammer
  traits are excluded;
- Bridal Glow remains equipped and contributes its normal rarity and Water
  element facts;
- replay, undo/redo, persistence, progressive evaluation, later trait
  candidates, and run state agree on the promoted target;
- one ordinary Hera reward product loop proves the contract is not coupled to
  encounter-owned field-NPC offers;
- no target policy appears in React, Redux, application projection, or a
  parallel history fold.

### Gate D — Icarus implementation

After Gate C is complete, close the Icarus source audit, add the eight Icarus
declarations, and attach the giver to `IcarusCombatO/P`. Reuse the
encounter-owned offer and exact-one target paths. Extend the closed transition
union only with Hammer Rank II; do not generalize Gate C into an effect
interpreter.

Acceptance:

- both O and P exact encounter phases produce the offer at completion;
- P's multi-phase envelope addresses the actual selected Icarus phase;
- switching among Icarus, Athena, and ordinary identities in one legal phase
  retains each NPC's independent dormant offer;
- ordinary Icarus traits use the existing equipped-trait path;
- all eight source traits, including `UpgradeHammerBoon`, follow their audited
  persistent classification;
- the exact Rank-II-compatible Hammer matrix is declaration-owned and checked
  against the chosen weapon/aspect inventory;
- no eligible Rank-I Hammer makes Latest Model unavailable as an offer option;
- selecting Latest Model renders the shared exact-one target picker and one
  authored Hammer target;
- the selected Hammer becomes Rank II at encounter completion, is no longer an
  eligible Latest Model target, and appears as Rank II in later run state;
- no weapon/aspect Hammer offer pool is substituted for the Icarus giver;
- no provider-name conditional is added to shared simulation or React;
- O and P share identical acquisition semantics despite different encounter
  topology.

### Gate E — Closure

- Run focused catalog, authored codec/command, encounter simulation, trait
  candidate, workspace, UI, and product-loop suites during development.
- Run `npm run check` once after the three-giver phase is complete.
- Inspect encoded fixture growth and ensure sparse encounter offers did not
  duplicate defaults across ordinary occurrences.
- Audit production LOC growth against displaced/extended seams; reject any
  second trait evaluator, NPC ledger, or UI policy matrix.
- Absorb stable contracts into catalog, authored-project, simulation,
  candidate, editor, contextual-UX, and F/G/N/O/P biome authorities.
- Record completion in `IMPLEMENTATION_PROGRESS.md` and delete this file.

## Primary Test Ownership

| Authority                    | Complete matrix owner                          | Representative downstream witness |
| ---------------------------- | ---------------------------------------------- | --------------------------------- |
| NPC trait facts              | catalog declaration/compiler tests             | one giver label/pool projection   |
| Dormant authored offers      | authored encounter codec/command tests         | one undo/redo UI interaction      |
| Completion acquisition       | engine encounter/reward-trait simulation tests | one Artemis product loop          |
| Trait legality               | existing trait evaluator/candidate tests       | one invalid NPC dialog finding    |
| Target declaration/structure | catalog compiler plus authored codec tests     | one rejected mismatched target    |
| Exact target eligibility     | engine trait evaluator/candidate tests         | one unavailable picker option     |
| Target transition chronology | engine trait-history fold tests                | later run-state rarity/rank       |
| Target picker interaction    | trait-domain and dialog interaction tests      | one Bridal Glow product loop      |
| Presentation/navigation      | structured-workspace and trait-dialog tests    | route Traits navigation witness   |

Do not copy all 25 trait requirement cases or the complete target matrix into
simulation, React, or product tests. Catalog tests own declarations, engine
trait tests own exact target eligibility and transitions, and consumers retain
contact and chronology witnesses. Test helpers must not recreate the target
predicate to manufacture expected candidates.

## Estimated Commit Shape

The remaining delivery is expected to take **three to five focused commits**,
not another broad campaign:

1. Bridal Glow catalog/authored/engine targeted-acquisition slice;
2. Bridal Glow application contextual picker and product-loop closure;
3. a focused correction only if adversarial review finds a concrete defect;
4. Icarus source closure, declarations, Hammer Rank-II transition, and shared
   UI path;
5. documentation absorption and plan retirement.

Gate C may be one commit only if its engine and application surfaces remain
small enough to review as one vertical slice. Do not land a context-only schema
or forwarding commit whose behavior is deferred to the next commit.

Stop before implementation broadens if the work requires any of the following:

- multiple targets, target counts, arbitrary callback arguments, or a generic
  effect interpreter;
- application or React traversal of equipped-trait history;
- a second target/effect history alongside `TraitOfferEvent`;
- provider-name conditionals in shared simulation;
- Hammer rarity leaking into authored option rarity or ordinary god-boon
  rarity counts;
- target policy duplicated between offer eligibility and target candidates;
- all three unselected alternatives requiring speculative target authorship.

Those are signals that the exact-one targeted-acquisition seam has been lost or
the scope has grown beyond Bridal Glow and Latest Model.
