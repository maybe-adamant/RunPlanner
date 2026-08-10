# Story Traits and Death Defiance

## Status

**Implementation-ready delivery plan.** Planning baseline: `d7a034d`.

This is an isolated delivery document. Do not link it from stable design,
biome, audit, or progress indexes while implementation is active. At closure,
absorb the durable contracts into their owning documents, record the completed
delivery in `IMPLEMENTATION_PROGRESS.md`, and retire this file.

## Objective

Deliver one narrow authored approximation for Death Defiance-dependent offer
conditions, use it to correct Athena and Shop eligibility, and add complete
three-choice trait offers for four fixed Story encounters:

| Biome | Room        | Encounter           | Giver    |
| ----- | ----------- | ------------------- | -------- |
| F     | `F_Story01` | `Story_Arachne_01`  | Arachne  |
| N     | `N_Story01` | `Story_Medea_01`    | Medea    |
| I     | `I_Story01` | `Story_Hades_01`    | Hades    |
| P     | `P_Story01` | `Story_Dionysus_01` | Dionysus |

The planner authors whether the relevant Death Defiance predicate passed at a
specific source. It does not simulate Death Defiance capacity, consumption,
restoration, or combat outcomes.

This plan extends the existing encounter-owned trait-offer lifecycle. It does
not turn the structural incoming `Story` reward into a concrete acquisition and
does not introduce a second Story-choice model.

## Source Authorities

- `docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md` owns provider membership,
  labels, rarity, elements, offer requirements, and exceptional acquisition
  evidence.
- `docs/audits/REWARD_GAME_DATA_AUDIT.md` owns Shop option membership and reward
  acquisition identity.
- The installed `NPCData.lua`, `NPCData_Hades.lua`,
  `NPCData_Dionysus.lua`, `TraitData_Athena.lua`, `TraitData_Arachne.lua`,
  `TraitData_Medea.lua`, `TraitData_Hades.lua`, `TraitData_Dionysus.lua`,
  `ConsumableData.lua`, `RequirementsData.lua`, `RequirementsLogic.lua`, and
  English `TraitText.en.sjson` are the primary game sources for this delivery.

The progressed-save baseline continues to collapse profile, dialogue, lifetime
resource, and first-meeting gates. Current-run predicates named in this plan do
not disappear under that baseline.

## Scope Boundary

### Included

- one source-local `Death Defiance condition met` authored fact;
- Athena's `DeathDefianceRefillBoon` requirement;
- `LastStandDrop` eligibility in the `I_WorldShop` and `Q_WorldShop` Survival
  pools;
- the four fixed Story encounter producers above;
- 32 source-backed trait declarations and four giver declarations;
- fixed and selectable rarity policies already supported by the trait editor;
- progressive candidates, findings, chronological acquisition, run-state
  projection, undo/redo, persistence, and focused product-loop coverage.

### Explicitly deferred

- Circe and her active Fear, Familiar, Arcana, and Hex predicates;
- Narcissus, including Mystery Boon, random Pom targeting, elements, rerolls,
  and his Death Defiance benefit;
- Echo, trait levels, previous-run boons, previous rewards, Shop duplication,
  keepsakes, and Death Defiance restoration;
- Death Defiance counts, maximum capacity, current availability, spent uses,
  restoration effects, Arcana configuration, or room-local consumption;
- Arachne armor amount, combat damage, armor depletion, or costume removal;
- numeric combat effects, money, healing, resource grants, and other effects
  not already represented by the equipped-trait ledger;
- save/profile progression inputs and Dream Run variants;
- reroll probability, offer weighting, and priority probability;
- a generic Story-benefit interpreter or arbitrary trait-effect language.

Circe, Narcissus, and Echo must remain absent from production giver and
encounter-producer declarations in this delivery. Their audited keys remain
source evidence only.

## Audited Provider Baseline

All four providers offer three distinct choices. Arachne and Medea use their
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

All eight are persistent god traits and contribute one Water. Tipsy Shot keeps
its exact cast-shape exclusions. `RandomBaseDamageBoon` is commented as
Legendary in the source pool but is not a Legendary-rarity trait; the supported
fresh domain remains Common/Rare/Epic. Dionysus does not enter the ordinary god
pool and does not receive first-Olympian or replacement composition.

## Locked Product Contract

### One authored predicate outcome, not a Death Defiance simulator

The user-facing control is one checkbox labeled:

> Death Defiance condition met

The fact means only that the declaration-owned Death Defiance predicate for
this exact source passed. Its source interpretation is intentionally local:

- Athena, and later Narcissus/Echo: at least one Death Defiance is missing;
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

Changing the checkbox is a semantic command, participates in undo/redo, and
retains every authored trait option, selected option, Shop reward, and purchase
order. It changes only candidate support and evaluation.

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

### Trait-offer ownership and chronology

Each fixed Story Encounter Definition declares its giver through the existing
`traitOfferProducer`. Its exact `EncounterPhaseAddress` owns the authored offer,
using the existing `selection` acquisition role.

The existing room-encounter state, commands, codec, candidate capability,
simulation event, workspace projection, interaction binding, and trait dialog
remain the sole path. Do not add Story-specific authored room state or a second
trait editor.

Only a reached picked Story occurrence publishes and acquires its selected
trait. Retained state on an unpicked or replaced occurrence remains dormant and
is restored if the occurrence becomes active again. Acquisition occurs at that
fixed encounter's existing `encounterCompleted` event and folds into the one
chronological equipped-trait ledger.

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

Adding authored condition state changes the persisted project contract. Bump
schema 17 once in the Death Defiance gate and follow the repository's current
exact-version policy. Do not introduce a migration registry, compatibility
reader, or production forwarding model.

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

## Delivery Gates

### Gate A — Death Defiance condition and existing corrections

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

### Gate B — First Story reuse proof: Arachne and Medea

Add the eight source-backed costume declarations and Arachne giver, bind only
`Story_Arachne_01`, and prove fixed Common three-choice authoring through the
existing encounter lifecycle. Generalize `fieldNpc` to the behavior-based
`npc` provider kind in this first provider-expansion gate, including the three
existing field providers. Keep the armor-depletion collapse in this isolated
plan through Gate D's documentation absorption; add no armor state.

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

### Gate C — Remaining provider expansion: Hades and Dionysus

Add the eight source-backed Hades declarations and giver, bind
`Story_Hades_01`, retain Howling Soul's exact exclusions, and use Gate A's
condition only for `HadesDeathDefianceDamageBoon`. Do not model spent-use damage
or ordinary god-pool participation.

Add the eight source-backed Dionysus declarations and giver, bind
`Story_Dionysus_01`, preserve Common/Rare/Epic authoring, Water contributions,
and Tipsy Shot exclusions, and prove that the provider does not activate
ordinary Olympian first-offer or replacement composition.

### Gate D — Closure and absorption

Run the complete repository gate, audit the final diff for parallel paths and
deferred-provider leakage, absorb the durable rules into the owning design,
biome, and audit documents, update `IMPLEMENTATION_PROGRESS.md`, and retire
this plan.

## Primary Test Ownership

### Catalog

- exact four provider pools, labels, order, rarity policy, elements, slots,
  exclusions, and defaults;
- exact encounter-to-giver bindings;
- Athena and both Shop `LastStandDrop` requirements;
- unsupported condition ownership rejected at compilation;
- no Circe, Narcissus, or Echo production giver.

### Authored project and commands

- complete false defaults only on applicable owners;
- semantic toggle, no-op behavior, undo/redo, JSON round trip, and malformed
  ownership rejection;
- selected values and dormant encounter state survive condition changes;
- schema-version contact behavior.

### Simulation and candidates

- Athena conditional option unavailable/available under false/true;
- I and Q Shop `LastStandDrop` unavailable/available under false/true;
- ordered purchase validation consumes the same Shop-local fact;
- each fixed Story provider emits exactly one reached encounter offer and one
  selected chronological acquisition;
- Arachne/Medea/Hades fixed rarity, Dionysus selectable rarity;
- Medea and Hades condition checks remain provider-local despite sharing one
  authored boolean shape;
- Dionysus Water and supported god-trait derived facts appear downstream;
- unpicked Story alternatives do not alter trait history.

### Planner and UI

- condition controls are capability-driven and absent from unrelated offers;
- controls remain reachable beside their own findings;
- contextual pickers retain invalid current values and filter unsupported
  alternatives;
- fixed Story rooms reuse the existing trait dialog and Customize navigation;
- one representative Story product-loop witness plus focused projection/UI
  tests; do not duplicate all catalog and engine matrices in React.

Use `npm run test:catalog`, `npm run test:engine`, `npm run test:planner`, and
`npm run test:ui` according to each gate's owning lane. Use
`npm run test:changed` during focused iteration. Gate D runs `npm run check`.

## Closure Audit

Before retiring this plan, verify all of the following:

- no Death Defiance counter, route setting, history ledger, or inferred state
  was added;
- no generic string-keyed authored-condition bag or effect interpreter exists;
- Athena and both Shop profiles consume declaration-owned requirements;
- purchase-order validation does not bypass the Shop condition;
- exactly the four scoped Story encounters publish Story trait offers;
- Arachne combat encounters remain non-producers;
- the structural `Story` reward still resolves no acquisition;
- one selected Story choice reaches the existing equipped-trait ledger at the
  fixed encounter-completion point;
- `fieldNpc` was generalized once to behavior-based `npc`; no redundant
  `storyNpc` kind was added and encounter-specific field-NPC terminology was
  otherwise left intact;
- React contains no provider, trait-key, encounter-key, or Shop-profile policy
  switches;
- Circe, Narcissus, and Echo remain deferred without placeholders;
- no complete game-fact matrix was duplicated outside its primary catalog or
  engine test owner;
- production growth corresponds to declarations, commands, and supported
  products rather than shadow auditing or test-only infrastructure.

## Expected Commit Shape

The default sequence is four focused commits: Gate A, the Arachne/Medea reuse
proof, the Hades/Dionysus expansion, and Gate D documentation closure. The
post-Gate-B audit may split the remaining expansion only when it identifies a
real semantic seam or independently reviewable behavior correction. Circe,
Narcissus, and Echo receive their own later plans or focused provider documents
after this plan closes.
