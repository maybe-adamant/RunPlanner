# Story Traits, Source Effects, and Death Defiance

## Status

**Active follow-up delivery plan.** Gates A-C are delivered. Follow-up planning
baseline: `fb3e7cf`.

This is an isolated delivery document. Do not link it from stable design,
biome, audit, or progress indexes while implementation is active. At closure,
absorb the durable contracts into their owning documents, record the completed
delivery in `IMPLEMENTATION_PROGRESS.md`, and retire this file.

## Objective

The delivered baseline added one narrow authored approximation for Death
Defiance-dependent offer conditions, corrected Athena and Shop eligibility,
and added complete three-choice trait offers for four fixed Story encounters.
The active extension now closes the producer-sensitive Nectar level effect and
uses the established reward, trait, level, and condition machinery for one
effect-backed Story encounter:

| Biome | Room        | Encounter            | Giver     |
| ----- | ----------- | -------------------- | --------- |
| F     | `F_Story01` | `Story_Arachne_01`   | Arachne   |
| N     | `N_Story01` | `Story_Medea_01`     | Medea     |
| I     | `I_Story01` | `Story_Hades_01`     | Hades     |
| P     | `P_Story01` | `Story_Dionysus_01`  | Dionysus  |
| G     | `G_Story01` | `Story_Narcissus_01` | Narcissus |

The planner authors whether the relevant Death Defiance predicate passed at a
specific source. It does not simulate Death Defiance capacity, consumption,
restoration, or combat outcomes.

This plan extends the existing encounter-owned trait-offer lifecycle. It does
not turn the structural incoming `Story` reward into a concrete acquisition and
does not introduce a second Story-choice model. Narcissus reuses the same
three-option authoring surface, but declaration-owned selected outcomes decide
whether a choice equips a persistent trait, emits concrete acquisitions, or
applies one of the closed mutations required by its source-backed benefits.

## Source Authorities

- `docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md` owns provider membership,
  labels, rarity, elements, offer requirements, and exceptional acquisition
  evidence.
- `docs/audits/REWARD_GAME_DATA_AUDIT.md` owns Shop option membership and reward
  acquisition identity.
- The installed `NPCData.lua`, `NPCData_Hades.lua`,
  `NPCData_Dionysus.lua`, `TraitData_Athena.lua`, `TraitData_Arachne.lua`,
  `TraitData_Medea.lua`, `TraitData_Hades.lua`, `TraitData_Dionysus.lua`,
  `TraitData_Narcissus.lua`, `ConsumableData.lua`,
  `WorldUpgradeData.lua`, `RewardLogic.lua`, `StoreLogic.lua`,
  `InteractLogic.lua`, `EventLogic.lua`, `RequirementsData.lua`,
  `RequirementsLogic.lua`, and English `TraitText.en.sjson` are the primary
  game sources for this delivery.

The progressed-save baseline continues to collapse profile, dialogue, lifetime
resource, and first-meeting gates. Current-run predicates named in this plan do
not disappear under that baseline.

## Scope Boundary

### Included

- one source-local `Death Defiance condition met` authored fact;
- Athena's `DeathDefianceRefillBoon` requirement;
- `LastStandDrop` eligibility in the `I_WorldShop` and `Q_WorldShop` Survival
  pools;
- the five fixed Story encounter producers above;
- 41 source-backed production choice declarations and five giver declarations;
- source-sensitive Nectar random-level behavior for ordinary room pickup and
  Shop purchase;
- the nine fixed-Common Narcissus benefit choices and their supported concrete
  acquisitions, random Pom, element, Death Defiance, and Mystery Boon effects;
- fixed and selectable rarity policies already supported by the trait editor;
- progressive candidates, findings, chronological acquisition, run-state
  projection, undo/redo, persistence, and focused product-loop coverage.

### Explicitly deferred

- Circe and her active Fear, Familiar, Arcana, and Hex predicates;
- the entire Echo provider. Four of its eight source choices require distinct
  missing capabilities: exact last-reward replay, prior-run trait state, a
  pending later-Shop duplication lifecycle, and prior-run keepsake state. The
  other four choices must not be published as an artificially restricted Echo
  pool;
- Narcissus reroll inventory/use and the numeric resource, money, healing,
  Life, and Magick quantities attached to his choices; their supported
  acquisition identities and route-observable effects remain included;
- Death Defiance counts, maximum capacity, current availability, spent uses,
  restoration effects, Arcana configuration, or room-local consumption;
- Arachne armor amount, combat damage, armor depletion, or costume removal;
- numeric combat effects, money, healing, resource grants, and other effects
  not already represented by the equipped-trait ledger;
- save/profile progression inputs and Dream Run variants;
- reroll probability, offer weighting, and priority probability;
- a generic Story-benefit interpreter or arbitrary trait-effect language.

Circe and Echo remain absent from production giver and encounter-producer
declarations. Narcissus is complete only against the declared current-run
planner baseline; deferred numeric combat/resource effects are not described
as exact simulation.

## Audited Provider Baseline

The four delivered providers offer three distinct choices. Arachne and Medea use their
manual fixed-Common choice screens. Hades is effectively Common-only in the
supported normal-run state. Dionysus uses the ordinary Common/Rare/Epic fresh
rarity support. None participates in ordinary Olympian first-offer composition,
core replacement probability, or the ordinary god-pool source cap merely
because some of its traits are god traits.

### Arachne — fixed Common

| Trait               | Label           |
| ------------------- | --------------- |
| `VitalityCostume`   | Emerald Dress   |
| `ManaCostume`       | Azure Dress     |
| `AgilityCostume`    | Lavender Dress  |
| `IncomeCostume`     | Gilded Dress    |
| `CastDamageCostume` | Fuchsia Dress   |
| `HighArmorCostume`  | Onyx Dress      |
| `SpellCostume`      | Moonlight Dress |
| `EscalatingCostume` | Crimson Dress   |

These are non-god, non-slot traits with no element contribution. The game
removes a costume when its associated armor is depleted. Combat damage is not
modeled, so the selected costume remains in the planner's equipped-trait ledger
for the rest of the modeled route. This is the explicit approximation; do not
add an armor ledger in this gate.

Only `Story_Arachne_01` produces this offer. The existing `ArachneCombatF` and
`ArachneCombatG` cocoon encounters do not produce costume choices.

### Medea — fixed Common

| Trait                         | Label                   | Supported requirement  |
| ----------------------------- | ----------------------- | ---------------------- |
| `HealingOnDeathCurse`         | Life from the Dead      | none                   |
| `MoneyOnDeathCurse`           | Wealth from the Dead    | none                   |
| `ManaOverTimeCurse`           | Traces of Spirit        | none                   |
| `SpawnDamageCurse`            | Suffering on Sight      | none                   |
| `ArmorPenaltyCurse`           | Corrosion on Sight      | none                   |
| `SlowProjectileCurse`         | Enfeeblement of Cowards | none                   |
| `DeathDefianceRetaliateCurse` | Malice in Kind          | Death Defiance fact    |
| `NewStatusDamage`             | Harm for the Afflicted  | profile gate collapsed |

Medea's Death Defiance source predicate is that at least one use is currently
available. The planner intentionally records only the resulting local boolean.
The eight curses are non-god, non-slot, elementless persistent ledger entries
for the supported acquisition model.

### Hades — fixed Common

| Trait                            | Label           | Supported requirement  |
| -------------------------------- | --------------- | ---------------------- |
| `HadesLifestealBoon`             | Life Tax        | none                   |
| `HadesCastProjectileBoon`        | Howling Soul    | cast exclusions        |
| `HadesPreDamageBoon`             | Old Grudge      | none                   |
| `HadesChronosDebuffBoon`         | Deep Dissent    | none                   |
| `HadesDashSweepBoon`             | Gigaros Dash    | none                   |
| `HadesDeathDefianceDamageBoon`   | Last Gasp       | Death Defiance fact    |
| `HadesManaUrnBoon`               | Cinerary Circle | none                   |
| `HadesInvisibilityRetaliateBoon` | Unseen Ire      | profile gate collapsed |

Hades's Death Defiance source predicate is historical: the run has had Death
Defiance capability. The same authored local boolean represents that result;
the planner does not derive it from route state. Last Gasp's damage scaling by
spent uses remains outside this delivery.

Howling Soul retains its exact negative equipped-trait exclusions. Do not
replace them with a Hades-specific UI rule. Hades traits use their source-backed
god-trait and slot facts, but Hades remains outside ordinary Olympian offer
composition and god-pool acquisition.

Life Tax has a combat-consumed source limit in the game. Because the planner
does not simulate lifesteal usage, it remains in the equipped-trait ledger for
the rest of the modeled route. Do not add remaining-use state in this gate.

### Dionysus — selectable Common, Rare, or Epic

| Trait                     | Label            |
| ------------------------- | ---------------- |
| `CastLobBoon`             | Tipsy Shot       |
| `HiddenMaxHealthBoon`     | Worry Free       |
| `FirstHangoverBoon`       | Drunken Stupor   |
| `CombatEncounterHealBoon` | Bounce Back      |
| `PowerDrinkBoon`          | Bottomless Drink |
| `FogDamageBonusBoon`      | Happy Haze       |
| `BankBoon`                | Personal Loan    |
| `RandomBaseDamageBoon`    | Reckless Abandon |

All eight use boon rarity, are not core god traits, and contribute one Water.
Tipsy Shot keeps its exact cast-shape exclusions. `RandomBaseDamageBoon` is
commented as Legendary in the source pool but is not a Legendary-rarity trait;
the supported fresh domain remains Common/Rare/Epic. Dionysus does not enter
the core god pool and does not receive Pom levels, first-Olympian, or
replacement composition.

### Narcissus — fixed Common, effect-backed

The exact nine-choice pool, labels, requirements, and outputs are owned by the
trait audit. The author still records three distinct offered choices and one
selection through `Story_Narcissus_01`. The selected `NarcissusA..I` key is a
benefit descriptor, not a persistent equipped trait.

The current-run observable outcomes are closed:

- `NarcissusA` emits the real `StoreRewardRandomStack` acquisition and one
  random `+1` level resolution;
- `NarcissusD`, `NarcissusE`, and `NarcissusH` emit their exact supported
  consumable acquisitions; H reuses the source-local Death Defiance fact;
- `NarcissusG` emits two `ElementalBoost` effects, folding two Air, Earth,
  Fire, and Water contributions into downstream trait facts;
- `NarcissusI` emits `BlindBoxLoot`, owns one authored hidden ordinary-god
  source, and owns that source's fresh trait offer at unwrap time; and
- the remaining resource, money, healing, and reroll outputs retain their
  explicit simplified/deferred dispositions and do not manufacture shadow
  counters.

The provider uses the existing progressive three-choice surface. Nested
Mystery Boon and random-Pom controls are option-local resolutions and remain
dormant unless their option is selected. Switching the selected benefit must
retain those authored children so switching back restores the work.

### Echo — audited and deferred as one provider

The trait audit records all eight fixed-Common Echo choices and their exact
source behavior. This plan deliberately publishes none of them. Reward Reward
Reward, Boon Boon Boon, Gold Gold Gold, and Gift Gift Gift each require a
different missing lifecycle or input. Publishing only the other four choices
would distort Echo's actual offer composition and would prematurely make a
partial provider look complete.

After Narcissus lands, use its delivered outcome shape to reassess Echo and
write a dedicated plan for the remaining replay, prior-run, pending-Shop, and
keepsake authorities. Do not add dormant Echo declarations or placeholder
outcomes in the current delivery.

## Locked Product Contract

### One authored predicate outcome, not a Death Defiance simulator

The user-facing control is one checkbox labeled:

> Death Defiance condition met

The fact means only that the declaration-owned Death Defiance predicate for
this exact source passed. Its source interpretation is intentionally local:

- Athena and Narcissus: at least one Death Defiance is missing;
- Medea: at least one Death Defiance is currently available;
- Hades: the run has had Death Defiance capability;
- Shop `LastStandDrop`: the missing-Death-Defiance offer and purchase condition
  is satisfied.

Do not put this fact in route settings, trait history, reward history, run-state
projection, or a derived counter. Do not infer one occurrence's value from an
earlier acquisition. Each applicable source owns its authored result.

The authored model adds the same direct optional
`deathDefianceConditionMet: boolean` field to `AuthoredTraitOffer` and
`ShopState`. Applicability is declaration-derived: an applicable active source
always owns the complete boolean with a false default; an inapplicable source
omits it, and the codec and commands reject it if supplied. Do not replace these
two narrow fields with an open string-keyed condition bag.

Changing the checkbox is persisted through a semantic command, participates in
undo/redo, and retains every authored trait option, selected option, Shop
reward, and purchase order. The trait dialog includes it in the existing
atomic `ReplaceTraitOffer` save; the inline Shop control uses its own bound
command. It changes only candidate support and evaluation.

### Declaration ownership

The catalog declares which exact trait or Shop option consumes the condition.
React must not switch on `DeathDefianceRefillBoon`,
`DeathDefianceRetaliateCurse`, `HadesDeathDefianceDamageBoon`,
`LastStandDrop`, giver names, or Shop profile names.

The normalized trait requirement consumes the field through the existing trait
offer-context evaluator. The `LastStandDrop` Shop option consumes the same
named field through the reward requirement evaluator. Share the narrow input
fact, but do not merge the independent trait and reward requirement languages,
add a second evaluator, or introduce an arbitrary condition registry. Derive
whether a giver or Shop profile exposes the control from its normalized
requirements; do not maintain parallel giver/profile allowlists.

Generalize the existing non-ordinary NPC provider kind from `fieldNpc` to
`npc`. The live consumers use the kind only to keep these providers outside
ordinary Olympian and Hammer policy; field and Story providers have identical
offer-composition behavior. Do not add a `storyNpc` kind solely to describe
room topology. Encounter definitions already own the field/story distinction.

### Source-sensitive acquisition effects

Concrete acquisition identity and an acquisition's source-local semantic
effect are separate facts. Keep the existing declaration-owned universal Pom
effects on `StackUpgrade`, `StackUpgradeBig`, `StackUpgradeTriple`, and
`StoreRewardRandomStack`. Add a narrow producer/lifecycle override for effects
that exist only when that producer creates the same acquisition in a special
mode.

For progressed-baseline Nectar:

- `RoomReward + GiftDrop + roomRewardPickup` owns one random `+1` effect;
- ordinary Shop purchase of `GiftDrop` owns no level effect.

The producer-local Nectar effect is `randomTargetIfAvailable`: a non-empty
Pom-eligible domain requires exactly one authored target, while an empty domain
is complete and performs no mutation. Do not weaken the existing strict
`randomTarget` contract used by `StoreRewardRandomStack`, whose supported
producers are guarded by `StackUpgradeLegal`.

Resolve the effective effect from the exact producer profile, offer, role, and
lifecycle binding before creating defaults, decoding authored children,
evaluating candidates, or applying history. Do not add the effect globally to
`GiftDrop`, infer it from an address kind, or make React distinguish room and
Shop Nectar. The reward history writes one `GiftDrop`; the trait history writes
one separate level mutation only after a valid target resolution.

### Closed selected-outcome classification

The existing ordinary path implicitly equips every valid selected option. Make
that result declaration-owned without introducing an open effect language.
Every trait choice normalizes to one member of a closed selected-outcome union:

- equip the selected trait, which remains the default for existing providers;
- emit declaration-owned concrete acquisition roles;
- apply one of the exact closed trait/element mutations required by Narcissus.

The union belongs to the catalog schema and is exhaustively compiled and
dispatched by the engine. It is not a string function name, callback registry,
generic property-change interpreter, or application-side switch. A selected
effect-backed key still appears in the trait-offer evaluation trace, but only
the `equip` outcome enters the persistent equipped-trait ledger.

When an outcome needs authored detail, retain it on its exact offered option:
the random Pom target or Mystery Boon hidden source and fresh offer. Inactive
option children are dormant, preserved, and restored when reselected. Commands
and codecs reject children on outcome kinds that cannot consume them. Use the
existing trait, level-resolution, and resolved-reward value types inside this
closed owner; do not copy their validation into an NPC-specific model.

### Trait-offer ownership and chronology

Each fixed Story Encounter Definition declares its giver through the existing
`traitOfferProducer`. Its exact `EncounterPhaseAddress` owns the authored offer,
using the existing `selection` acquisition role.

The existing room-encounter state, commands, codec, candidate capability,
simulation event, workspace projection, interaction binding, and trait dialog
remain the sole path. Do not add Story-specific authored room state or a second
trait editor.

Only a reached picked Story occurrence publishes and applies its selected
outcome. Retained state on an unpicked or replaced occurrence remains dormant
and is restored if the occurrence becomes active again. The outcome occurs at
that fixed encounter's existing `encounterCompleted` event. Persistent
selections fold into the one chronological equipped-trait ledger; effect-backed
selections emit their exact reward, level, or element events at the same
chronology without equipping the descriptor key.

The structural incoming `Story` producer continues to resolve no concrete
acquisition. The encounter choice is a sibling encounter-local event, not a
replacement reward.

### Shop ownership and timing

Only `I_WorldShop` and `Q_WorldShop` currently contain `LastStandDrop`, each in
one Survival group. The Shop occurrence owns one condition checkbox whenever
its normalized profile supports a condition-dependent option. Render it once
near the Shop inventory controls, not once per offer row.

The same Shop-local value is used for both source checks the game performs:
inventory eligibility and purchase eligibility. This is an explicit
approximation because Death Defiance changes are not simulated.

- false excludes `LastStandDrop` from contextual Shop candidates;
- true admits it when all other Shop rules pass;
- a retained authored `LastStandDrop` while false remains visible and receives
  the existing exact Shop-offer finding;
- purchase-order validation uses the same value and must not bypass the
  declaration requirement.

The checkbox must remain reachable when the current Shop is invalid, including
when `LastStandDrop` itself causes the finding. Findings must not hide their
repair control.

### Persistence

Gate A already bumped the persisted contract for authored condition state. The
current baseline schema is 19 after the later trait-level delivery. Gate D's
Nectar correction reuses the existing level-resolution value shape and needs
only a catalog-version change. Gate E bumps the schema exactly once, from 19 to
20, when option-local selected-outcome resolutions first enter authored state.
Do not introduce a migration registry, compatibility reader, or production
forwarding model.

Every gate that changes normalized catalog declarations updates the catalog
version according to the existing exact-match policy. Encoded condition state
must round-trip canonically; malformed condition state, condition state on an
unsupported owner, and stale catalog/schema versions fail at their normal
contact boundaries.

### Presentation and repair behavior

The trait dialog renders the checkbox only when the projected giver consumes
the condition. Place it in the stable source/context area above the three
options and the fixed finding region. It must not alter dialog width, introduce
horizontal scrolling, or attach its finding to one option row.

The Shop editor renders the one profile-level checkbox beside its existing
inventory controls without widening the row layout. Application projection
publishes the control from normalized capabilities; React only renders and
invokes the bound semantic intent.

Progressive contextual pickers exclude condition-dependent alternatives while
the checkbox is false. A retained invalid value remains present as the current
selection with its finding, following the established contextual-picker
contract.

Effect-backed Story providers use the same dialog and three-card picker. The
selected option's nested resolution appears in the stable detail region below
the offer; it must not expand one card unevenly or hide the other choices.
Reuse the existing contextual picker and level-resolution dialog products for
Mystery Boon and Pom targets. Findings stay in the dialog's fixed finding
region and never replace the control needed to repair them.

The run-state panel shows only state that exists before its decision. It may
therefore expose Narcissus results only at later decisions: exact reward
history, element counts, and changed levels. It must not list `NarcissusA..I`
as equipped traits.

## Delivery Gates

### Gate A — Death Defiance condition and existing corrections (delivered)

Deliver one vertical slice across catalog, authored state, commands, codec,
materialization, candidate evaluation, simulation validation, workspace
projection, interaction binding, and React:

1. add the closed source-local condition contract and complete false defaults;
2. add semantic commands for applicable trait offers and Shops;
3. correct Athena's `DeathDefianceRefillBoon` declaration;
4. add the requirement to both `LastStandDrop` Shop options;
5. carry the Shop-local fact through inventory candidates and ordered purchase
   validation;
6. render the condition control in the trait dialog and applicable Shop editor;
7. bump schema and catalog versions and update focused fixtures.

Gate A must land with no Story giver enabled. This isolates the model
correction from provider expansion and proves both trait and reward consumers.

### Gate B — First Story reuse proof: Arachne and Medea (delivered)

Add the eight source-backed costume declarations and Arachne giver, bind only
`Story_Arachne_01`, and prove fixed Common three-choice authoring through the
existing encounter lifecycle. Generalize `fieldNpc` to the behavior-based
`npc` provider kind in this first provider-expansion gate, including the three
existing field providers. Keep the armor-depletion collapse in this isolated
plan through Gate F's documentation absorption; add no armor state.

Add the eight source-backed curse declarations and Medea giver, bind
`Story_Medea_01`, and use Gate A's authored condition only for
`DeathDefianceRetaliateCurse`. Prove false/true progressive candidate behavior
and downstream chronological acquisition.

After Gate B, audit the actual change neighborhood before continuing. If both
providers required only declaration files, exact encounter bindings, and
focused fixtures on the established path, keep the remaining providers
combined in Gate C. Split Gate C only if the delivered code exposes a concrete
new lifecycle or product seam; provider identity alone is not a reason to add a
gate.

### Gate C — Remaining provider expansion: Hades and Dionysus (delivered)

Add the eight source-backed Hades declarations and giver, bind
`Story_Hades_01`, retain Howling Soul's exact exclusions, and use Gate A's
condition only for `HadesDeathDefianceDamageBoon`. Do not model spent-use damage
or ordinary god-pool participation.

Add the eight source-backed Dionysus declarations and giver, bind
`Story_Dionysus_01`, preserve Common/Rare/Epic authoring, Water contributions,
and Tipsy Shot exclusions, and prove that the provider does not activate
ordinary Olympian first-offer or replacement composition.

### Gate D — Producer-sensitive Nectar level effect

Deliver the smallest cross-lane correction before adding another provider:

1. normalize a narrow producer/lifecycle level-effect override without moving
   universal Stack/Pom effects or changing acquisition identity;
2. opt ordinary `RoomReward` `GiftDrop` pickup into random `+1` under the
   progressed baseline while leaving every Shop `GiftDrop` purchase untouched;
3. make defaults, codecs, commands, candidate evaluation, simulation,
   findings, structured workspace, and the existing level-resolution UI
   consume the resolved effective binding;
4. prove that room Nectar records `GiftDrop` plus one valid level mutation when
   a target exists, records only `GiftDrop` as a legal no-op when none exists,
   Shop Nectar always records only `GiftDrop`, and a missing target in a
   non-empty domain stays repairable; and
5. bump only the catalog version and run the focused catalog, engine, planner,
   and UI lanes.

Gate D must not add Narcissus, Echo, last-reward state, or a generic semantic
effect bag. It establishes the source-sensitive seam those providers can reuse.

### Gate E — Narcissus effect-backed Story choices

Add the closed selected-outcome classification and the nine Narcissus
declarations in one vertical slice:

1. keep ordinary providers on the default persistent-equipped outcome;
2. add option-local authored outcome resolutions, schema 20 persistence,
   semantic replacement commands, dormant-state retention, and exact ownership
   validation;
3. bind only `Story_Narcissus_01` to the new giver and preserve its fixed-Common
   three-choice offer;
4. apply selected effect outcomes at encounter completion without equipping
   `NarcissusA..I`;
5. reuse the existing random-Pom path for A, add exact supported acquisition
   roles for D/E/H, fold G's two all-element contributions, and reuse the
   existing Blind Box payload/unwrap/trait-offer path for I;
6. reuse the Death Defiance condition only for H and retain the audited
   simplified dispositions for rerolls and numeric resource/stat effects; and
7. project selected-option detail through the existing dialog, findings,
   navigation, undo/redo, and run-state products.

Do not build a generic consumable-drop interpreter or add one authored field
per Narcissus choice. Echo remains outside this gate and must not influence the
closed outcome surface beyond capabilities Narcissus genuinely requires.

### Gate F — Post-Narcissus reassessment and closure

Run the complete repository gate and audit the final diff for parallel paths,
descriptor keys incorrectly entering equipped state, and deferred-provider
leakage. Reassess Echo against the delivered Narcissus shape, but do not add an
Echo giver or placeholder declarations in this gate. Record any remaining Echo
work in a fresh dedicated plan only after identifying the exact missing
authorities for replay, prior-run state, later-Shop duplication, and keepsakes.

Absorb the durable Nectar and Narcissus rules into the owning design, biome,
and audit documents, update `IMPLEMENTATION_PROGRESS.md`, and retire this plan.

## Primary Test Ownership

### Catalog

- exact five implemented provider pools, labels, order, rarity policy, elements,
  slots, selected-outcome classification, and defaults;
- exact encounter-to-giver bindings;
- Athena and both Shop `LastStandDrop` requirements;
- unsupported condition ownership rejected at compilation;
- exact universal versus producer-local level-effect ownership for Stack/Pom,
  room Nectar, and Shop Nectar;
- exact Narcissus effect roles;
- no Circe or Echo production giver or choice.

### Authored project and commands

- complete false defaults only on applicable owners;
- semantic toggle, no-op behavior, undo/redo, JSON round trip, and malformed
  ownership rejection;
- selected values and dormant encounter state survive condition changes;
- option-local effect resolutions survive selection changes and reject
  incompatible outcome children;
- schema-version contact behavior, including the one 19-to-20 bump.

### Simulation and candidates

- Athena conditional option unavailable/available under false/true;
- I and Q Shop `LastStandDrop` unavailable/available under false/true;
- ordered purchase validation consumes the same Shop-local fact;
- each fixed Story provider emits exactly one reached encounter offer and one
  selected chronological outcome;
- Arachne/Medea/Hades fixed rarity, Dionysus selectable rarity;
- Medea and Hades condition checks remain provider-local despite sharing one
  authored boolean shape;
- Dionysus Water and supported god-trait derived facts appear downstream;
- unpicked Story alternatives do not alter trait history;
- room versus Shop Nectar preserves exact source-sensitive random-level
  behavior, including Nectar's legal empty-target no-op, without acquisition
  aliases;
- Narcissus descriptor keys never enter equipped state; A, G, H, and I retain
  representative random-level, element, condition, and nested Mystery Boon
  witnesses.

### Planner and UI

- condition controls are capability-driven and absent from unrelated offers;
- controls remain reachable beside their own findings;
- contextual pickers retain invalid current values and filter unsupported
  alternatives;
- fixed Story rooms reuse the existing trait dialog and Customize navigation;
- option-local outcome details reuse existing trait/level contextual controls
  and fixed finding regions;
- one representative Narcissus product-loop witness plus focused projection/UI
  tests; do not duplicate catalog and engine matrices in React.

Use `npm run test:catalog`, `npm run test:engine`, `npm run test:planner`, and
`npm run test:ui` according to each gate's owning lane. Use
`npm run test:changed` during focused iteration. Gate F runs `npm run check`.

## Closure Audit

Before retiring this plan, verify all of the following:

- no Death Defiance counter, route setting, history ledger, or inferred state
  was added;
- no generic string-keyed authored-condition bag or effect interpreter exists;
- Athena and both Shop profiles consume declaration-owned requirements;
- purchase-order validation does not bypass the Shop condition;
- exactly the five scoped Story encounters publish Story trait offers;
- Arachne combat encounters remain non-producers;
- the structural `Story` reward still resolves no acquisition;
- every selected Story outcome is applied at the fixed encounter-completion
  point, while only declaration-owned persistent outcomes reach the equipped
  ledger;
- `fieldNpc` was generalized once to behavior-based `npc`; no redundant
  `storyNpc` kind was added and encounter-specific field-NPC terminology was
  otherwise left intact;
- React contains no provider, trait-key, encounter-key, or Shop-profile policy
  switches;
- room Nectar attempts its exact random level mutation with a legal no-op on
  empty support, Shop Nectar does not, and both record only `GiftDrop`
  acquisition identity;
- `NarcissusA..I` never appear as equipped traits;
- Mystery Boon reuses the existing resolved-reward and trait-offer authorities
  rather than a parallel NPC offer model;
- Circe and the complete Echo provider remain deferred without placeholders;
- no complete game-fact matrix was duplicated outside its primary catalog or
  engine test owner;
- production growth corresponds to declarations, commands, and supported
  products rather than shadow auditing or test-only infrastructure.

## Expected Commit Shape

Gates A-C are already delivered. The follow-up default is three focused
commits: producer-sensitive Nectar, Narcissus and its closed outcome owner, and
post-Narcissus reassessment/documentation closure. Gate E must not be split
into one commit per benefit key. Circe and the complete Echo provider remain
later work; Echo receives a fresh plan only after this delivery reveals the
right ownership shape for its four missing capabilities.
