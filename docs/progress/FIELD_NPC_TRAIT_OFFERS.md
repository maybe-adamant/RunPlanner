# Field-NPC Trait Offer Expansion

## Status

**Draft implementation plan.** Baseline: `3088b80`.

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
  `NPCData_Athena.lua`, and their `TraitData_*` files remain the primary source
  for the preflight corrections named below.

The current catalog contains 11 trait givers: the nine ordinary Olympians,
Hermes, and Weapon Upgrade. The field-NPC slice adds three givers and 25 pool
members:

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

The normalized compiler must prove that the referenced giver exists. The six
standard encounter definitions above declare their corresponding giver. The
currently collapsed intro/reweight variants do not return as part of this work.

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

The persisted encounter shape changes, so bump the project schema once and
bump the catalog version with the new declarations. Follow the repository's
current exact-version policy: stale files are preserved and rejected rather
than passed through a production migration layer. Sparse empty state should be
omitted from encoded documents to avoid expanding every ordinary occurrence.

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
  persistence, undo/redo, and navigation.

Excluded:

- Artemis/Icarus/Athena intro and cross-run reweight identities;
- save/profile progression predicates already collapsed by the encounter
  baseline;
- probability and weighting of options or rarities;
- spell/Hex/Talent acquisition;
- trait mechanical effects, damage, armor, Death Defiance, consumable drops,
  levels, and stacks;
- Story-room givers, Arachne, Nemesis random events, Heracles rewards, Wells,
  Keepsakes, and other trait providers;
- a generic effect language or synthetic reward representation.

## Preflight Facts That Must Be Closed

Before the first production edit, update the trait audit with these exact
source-backed dispositions:

1. Fresh and equipped rarity domains for all three givers. In particular,
   distinguish provider roll possibilities from per-trait fixed Legendary
   identities and confirm whether field-NPC Heroic is ever a fresh offer.
2. Player-facing labels for all 25 traits and all three givers.
3. Element contributions, persistent-god classification, stacking/rarify
   flags, and every positive or negative offer requirement.
4. Whether each selected key remains in the hero's persistent trait inventory
   after acquisition. `UpgradeHammerBoon` is the required adversarial witness:
   record its Hammer-upgrade side effect as deferred, but do not equip the key
   if the game treats it as an effect-only transient choice.
5. Whether Artemis, Icarus, and Athena always present three choices under the
   supported progressed baseline. If a live provider can expose fewer than
   three for a reason inside current modeled state, stop and revise the authored
   offer cardinality contract before implementation.

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

### Gate B — Icarus extension

Add the eight Icarus declarations and attach the giver to `IcarusCombatO/P`.
Reuse Gate A's authored, simulation, candidate, and UI paths without an
Icarus-specific dispatcher.

Acceptance:

- both O and P exact encounter phases produce the offer at completion;
- P's multi-phase envelope addresses the actual selected Icarus phase;
- switching among Icarus, Athena, and ordinary identities in one legal phase
  retains each NPC's independent dormant offer;
- `UpgradeHammerBoon` follows the preflight's persistent/transient
  classification and never silently mutates Hammer state while that effect is
  deferred;
- no weapon/aspect Hammer pool is incorrectly substituted for the Icarus
  giver.

### Gate C — Athena extension

Add the eight Athena declarations and attach the giver to `AthenaCombatP`.

Acceptance:

- Athena uses the shared field-NPC path;
- exact equipped-trait prerequisites participate in progressive candidates;
- `OlympianSpellCountBoon` remains unavailable until its real dependency is
  modeled;
- Athena traits do not trigger first-Olympian or ordinary replacement rules;
- the P phase can retain separate dormant Icarus and Athena offers.

### Gate D — Closure

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

| Authority               | Complete matrix owner                          | Representative downstream witness |
| ----------------------- | ---------------------------------------------- | --------------------------------- |
| NPC trait facts         | catalog declaration/compiler tests             | one giver label/pool projection   |
| Dormant authored offers | authored encounter codec/command tests         | one undo/redo UI interaction      |
| Completion acquisition  | engine encounter/reward-trait simulation tests | one Artemis product loop          |
| Trait legality          | existing trait evaluator/candidate tests       | one invalid NPC dialog finding    |
| Presentation/navigation | structured-workspace and trait-dialog tests    | route Traits navigation witness   |

Do not copy all 25 trait requirement cases into simulation, React, or product
tests. Catalog tests own the declaration matrix; consumers retain contact and
chronology witnesses.

## Estimated Commit Shape

The expected delivery is **six to eight focused commits**, not another broad
campaign:

1. preflight audit closure;
2. Artemis catalog plus encounter-owned authored contract;
3. Artemis simulation/candidates;
4. Artemis application/UI closure;
5. Icarus extension;
6. Athena extension;
7. focused corrections, only if review finds a concrete defect;
8. documentation absorption and plan retirement.

If Gate A requires a second trait fold, a new NPC history model, generalized
effect execution, or pervasive reward-owner conditionals, stop. Those are
signals that the proposed ownership seam is wrong or that the scope has grown
beyond field-NPC trait offers.
