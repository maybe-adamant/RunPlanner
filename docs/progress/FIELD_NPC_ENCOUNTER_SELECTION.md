# Encounter Authoring and NPC Encounter Support

## Status

Implementation-ready temporary progress plan, rewritten 2026-08-03 and revised
2026-08-04.

This document owns the Run Planner interpretation, implementation sequence,
commit boundaries, and acceptance gates for concrete encounter authoring. NPC
encounters exercise that same contract; they are not a parallel selection
system. The stable source facts are owned by
`docs/audits/ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md`.

Do not link this temporary plan from the broader documentation map while work
is active. After completion, absorb durable catalog, authored-project,
simulation, history, biome, and editor contracts into their owning design
documents, record delivery history, and delete this file.

## Outcome

Every structurally owned combat-bearing room instance has a complete concrete
encounter selection for each potential authored encounter phase. A room
instance is either a top-level Room Occurrence or a parent-local child such as
an N side room. The selected key is one normalized Hades II Encounter
Definition from that phase's legal Encounter Set.

A predecessor-materialized incoming or free reward offer is the exceptional
offer-time leaf: it is editable when its declared offer owner exists, including
before its target room is selected or entered. This is an activation-timing
distinction, not a claim that all rewards occur before a room; room-owned
wheels, Shops, cages, acquisition, and future in-room details retain their own
lifecycle points.

All non-offer-time room-local authoring, beginning with encounter selection,
becomes active when its room instance is structurally active: a fixed/start
instance exists, a linked instance exists, an ordinary target is selected, a
Hub room is in the authored visit sequence, or an N local child is in its
authored entry order. This remains separate from evaluated entry: an invalid
upstream prefix must not hide or deactivate a structurally active room's local
controls. Evaluation validates selections against the current route state. An
invalid authored encounter remains visible and editable, contributes no
encounter effects or history, and is never silently replaced.

The initial program supports:

- concrete ordinary encounter authoring across F, G, H, I, N, O, P, and Q;
- Artemis combat in F, G, and N;
- Arachne cocoon encounters in F and G;
- Heracles combat in N, O, and P;
- Icarus combat in O and P;
- Athena combat in P;
- Nemesis combat in F, G, H, and I;
- one active-room `Customize` surface and one read-only route NPC index.

Nemesis random events, Shop appearances, NPC interaction outcomes, Gold,
enemy-pool authoring, and exact waves remain outside this program.

## Locked Product Interpretation

### Encounter Sets parallel reward stores without bag state

The game source uses weighted encounter lists. Run Planner models possibility,
not probability, so the production Encounter Set is the unique support of the
selected source projection:

```text
source LegalEncounters list
  -> remove unsupported progression/reweighting identities
  -> collapse repeated occurrences of the same concrete identity
  -> unique normalized Encounter Set
```

This is analogous to reward-store normalization with one important difference:

- a reward bag retains entry multiplicity because offers consume counted bag
  state and different copies can produce different later states;
- an encounter set is not consumed as a bag, so repeated weights do not affect
  later support and are not retained in production.

The source audit remains the authority for raw multiplicity. Production sets
contain no probability or weight field.

### Catalog products

The catalog extension has three complementary products. “Envelope” means
room-local encounter topology; it must not be confused with biome topology,
Room Occurrences, decisions, or exits.

```text
Encounter Envelope
  ordered stable potential slot topology
  declarative structural-activation dispositions
  phase-owned reward attachment points

Encounter Definition
  one normalized concrete game encounter identity
  requirements
  effective encounter kind
  encounter-depth and sequence effects
  optional NPC presentation key

Encounter Set
  unique Encounter Definition keys
  one static declaration-owned default key
```

Every Room Declaration binds one Encounter Envelope, including rooms whose
envelope is empty or contains only fixed positions. Every non-empty envelope
publishes a complete slot binding for every potential phase. A pool-backed slot
binds one Encounter Set; a fixed slot binds one Encounter Definition directly.
O, P, and H bind per slot because one room-local envelope uses more than one
source set.

An Encounter Envelope is reusable only when its potential slot structure and
phase-owned room mechanics are genuinely the same. It must not infer a biome
set, concrete identity, effective kind, encounter-depth effect, or eligibility
from its key. The selected Encounter Definition owns whether a resolved slot is
combat or non-combat and how it affects encounter counters or the remaining
sequence.

An Envelope declares potential slots and their named reward attachments; it
does not execute room lifecycle timing or independently evaluate room state.
The owning room template/materializer determines current structural activation
from its authored state, and a valid resolved Encounter Definition may trim a
suffix through its declared sequence effect. The Room Lifecycle Profile remains
the sole authority for when preparation, encounter start, acquisition, and
completion operations execute.

“Slot” names the stable authored position in an envelope. A valid resolved slot
becomes an encounter phase in lifecycle history. Commands and findings continue
to address that stable position even when its selection is dormant or invalid;
they never address a rendered or resolved ordinal.

Raw declarations may share a named source set and add explicit room-local
members, as P does for map-specific pre-combat identities. Normalization must
publish the complete unique set and default visible to consumers; lifecycle,
candidates, and React must not recreate `CombineTables` behavior.

The normalized composition is explicit:

```text
Room Declaration
  + Encounter Envelope
  + exact slot -> Encounter Set or fixed Encounter Definition bindings
  -> complete room-local encounter contract
```

No consumer may recover a slot binding from envelope name, biome name, Room
Declaration name, rendered order, or a baseline encounter.

### Existing profile disposition

Gate A replaces the current profile-as-baseline model rather than wrapping it:

| Current construct                                                                            | Gate A disposition                                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SingleCountedCombat`                                                                        | retire; replace with a neutral one-slot `SingleEncounter` envelope whose selected definition owns effective kind and encounter-depth effects                              |
| O `ShipCombat` encounter profile                                                             | replace with a Ship envelope containing `Intro`, `Combat1`, and structurally optional `Combat2`; retain the `ShipCombat` room template and its authored wheel/count state |
| P use of `SingleCountedCombat`                                                               | retire; bind a P envelope containing `Intro` and `Combat`                                                                                                                 |
| `H_FieldsCombatCage2/Cage3` profiles                                                         | consolidate into one complete Fields envelope containing `Passive`, `Cage01`, `Cage02`, and `Cage03`; cage outcome activates the prefix and retains the suffix dormantly  |
| `EphyraSideRoom/EphyraSideRoomHard` profiles                                                 | collapse to the neutral one-slot envelope; keep distinct Room Declaration Encounter Set bindings                                                                          |
| `NoEncounter`                                                                                | retire; bind the shared empty Encounter Envelope                                                                                                                          |
| fixed Shop, Story, miniboss, boss, completion, restore, and remaining fixed opening profiles | retire as profiles; bind a neutral fixed-position envelope and its exact Encounter Definition directly, without an authored selection leaf                                |
| `SourceRewardStorePolicyOverride.sourceEncounterProfileKey`                                  | replace with `sourceRoomTemplateKey`; O's `ShipCombat` template remains the explicit discriminator for the `lastActiveWheel` outgoing reward-store policy                 |

The room templates `StandardCombat`, `ShipCombat`, `FieldsCombat`,
`ClockworkCombat`, `EphyraCombat`, and `EphyraSideRoom` remain. They own real
authored room state, rewards, local children, and materialization behavior;
they do not select concrete encounters.

`EncounterEnvelope` replaces `EncounterProfile` as the normalized room-local
composition product universally. Gate A does not leave an `EncounterProfile`
collection for fixed or non-combat rooms and does not introduce an
envelope-to-profile adapter. Empty rooms use the shared empty envelope. Fixed
one-position rooms use a neutral one-slot envelope with a direct exact
definition binding. Their existing lifecycle behavior remains fixed and
non-editable.

Delete the old normalized profile authorities:

- `baselineEncounterKey`;
- profile-owned effective `kind`;
- profile-owned `countsEncounterDepth`;
- materialization logic that derives selected encounter count or identity from
  an Encounter Profile.

Fixed encounter slots still bind a concrete Encounter Definition and resolve
through the common path without gaining an editable leaf.

Each fixed Room Declaration binds its current normalized definition directly.
Source alternatives that depend solely on a pre-run Shrine or other difficulty
setting are outside the normalized projection: they are neither authored
candidates nor runtime resolver branches, and cannot coexist with the chosen
baseline in one run. Catalog closure verifies one direct definition binding for
every supported fixed slot.

Room Lifecycle Profiles may declare which Encounter Envelopes they can execute.
That compatibility validates lifecycle shape only; it must not recover a
concrete identity, Encounter Set, effective kind, or counter effect.

Biome progression policy must not retain an encounter-profile selector after
that collection is deleted. O's reward-store override matches the source Room
Declaration's `ShipCombat` template through `sourceRoomTemplateKey`. The room
template owns the wheel-bearing authored behavior; the Ship Encounter Envelope
declares the exact phase attachment points. The override does not infer either
fact from the other, and replacement, topology construction, strict decoding,
and reward-store commands all consume the same normalized selector.

Concrete encounter authoring is bounded to pool-backed combat-bearing
composition. Universal envelope normalization does not make fixed Shops,
Stories, bosses, minibosses, restore rooms, or completion encounters editable,
redesign biome topology, or introduce a second lifecycle/history system. It
removes the old parallel normalized representation so every room lifecycle
executes one encounter-composition contract.

### Fully progressed catalog projection

External save/profile progression is one catalog-normalization assumption, not
authored route state. NPC encounter support is part of the catalog and does not
require a route-level enable mode.

The completed program's normalized projection:

- omits first-time intro, Dream-run, narrative, and other identities whose
  support requires unmodeled external profile state;
- removes `2`/`02` identities whose purpose is cross-run reweighting;
- removes commented source entries;
- excludes Nemesis random events and Shop events because their observable
  interaction, reward, and economy effects are outside this program;
- retains distinct ordinary concrete game identities even when their current
  difference is enemy composition, preserving the source seam for later room
  customization;
- retains standard NPC combat and Arachne identities under the documented
  progressed, non-bounty route assumption.

The progress assumption belongs in catalog documentation and tests. It does
not create generic `unsupported` state, per-NPC unlock flags, or a route setting.
It is a curated static projection, not an assertion that every external
predicate is favorable: retained standard NPC progression prerequisites are
normalized satisfied under the progressed baseline, bounty is inactive, and
pre-run Shrine/difficulty alternatives remain out of scope.

### Concrete authored identity

Every authored phase stores its exact normalized Encounter Definition key. It
does not store a category sentinel or NPC grouping value:

```ts
interface RoomEncounterState {
  readonly encounterKeyByPhase: Readonly<Record<string, string>>;
}

type EncounterRoomOwner = OccurrenceAddress | LocalChildAddress;

interface RoomOccurrence {
  // existing occurrence identity, declaration, and room-template state
  readonly encounters: RoomEncounterState;
}

interface EphyraSideRoomState {
  // existing generation, entry-order, and offer state
  readonly encounters: RoomEncounterState;
}
```

The exact names may be tightened during implementation, but the persisted
semantics are fixed:

- schema 12 places top-level encounter authoring directly on
  `RoomOccurrence.encounters` and parent-local N authoring directly on
  `EphyraSideRoomState.encounters`; encounter selections do not live in a
  simulator side table, UI-session state, or a second occurrence collection;
- the map contains exactly the declaration's pool-backed potential slots,
  including currently dormant slots; empty envelopes and directly bound fixed
  slots store no redundant selection key;
- the selected key is concrete, such as `GeneratedP`, `GeneratedP_Large`, or
  `ArtemisCombatF`;
- the persisted value never stores an Encounter Set key;
- optional NPC presentation metadata supplies grouping, labels, and the route
  index only;
- eligibility, history, cardinality, and spacing reference exact Encounter
  Definition keys and never consume the presentation grouping key;
- no runtime resolver translates an authored NPC key into a biome-specific
  concrete identity.

This matches concrete reward authorship: the room owns the chosen outcome and
validation proves that it is currently supported.

### Complete static defaults may be invalid

Every authored potential phase has one complete declaration-owned default
Encounter Definition. Defaults are static and deterministic. They do not read
route history during project construction and do not attempt to choose a
currently eligible candidate.

Examples:

- the P main set defaults to `GeneratedP`; the current eight-combat P
  progression reaches its terminal combat at depth 9, where `GeneratedP` and
  `GeneratedP_Large` intentionally overlap, so Large is currently a valid
  terminal alternative rather than an invalid-default repair. If later
  declaration data permits a P combat at depth 10, the static `GeneratedP`
  default will remain invalid there and the same exact-candidate correction
  contract applies without a model change;
- an I set may default to its non-Goal generator; a Clockwork Goal room requires
  the corresponding Goal generator;
- P opening may default to `PIntroCombat01` while retaining the other normalized
  opening encounters as candidates.

This is the same policy used when Run Progress initially authors an Apollo Boon
even if later context makes it invalid. A default provides complete authored
state; it is not a promise of eligibility.

Do not add a context-sensitive baseline resolver, automatic repair, or
declaration-order fallback. If repetitive correction later becomes a real UX
problem, an explicit semantic “select valid default” command can be considered
without changing the persisted model.

### Invalid authored encounter behavior

The select command accepts only a currently eligible candidate. A retained
selection can later become invalid because the incoming reward, depth, visit
order, active phase prefix, or prior encounter history changes.

An active invalid selection:

- remains persisted;
- remains visible and editable on its exact phase;
- publishes a phase-owned finding with typed evidence;
- does not resolve to another definition;
- emits no encounter occurrence, start, completion, counter, phase-owned reward
  effect, or NPC-index row;
- prevents that active room instance from joining the complete-valid canonical
  prefix.

The editor must continue to project structurally reachable controls after an
earlier invalid prefix, following the existing details-active ownership
contract.

### Potential ownership, activation, and dormancy

A room instance owns selections for its declaration's complete potential
authored phase set. Top-level rooms store that state on their Room Occurrence.
An N side room remains a parent-local child and stores its state inside the
corresponding `EphyraSideRoomState`; it does not acquire an independent
Occurrence ID or enter global biome topology.

### Local-child application of the activation boundary

The global activation boundary above does not relocate existing semantic
owners. A reward offer retains its declared target, local-reward, or other
offer-time address; it simply becomes editable at its offer-time lifecycle
point. Room-local configuration remains owned by its room instance and
activates only when that instance becomes structurally active.

For N, a generated side door exposes its declaration-owned offer-time reward
selection under the existing side-room rule. It does not activate the side
room's encounter or any other room-local detail. `enteredOrdinal` is the local
child's authored membership in the parent-local traversal order—the local-child
analogue of selecting a top-level target, not a claim that simulation has
entered the room. Placing that specific slot in authored entry order activates
its retained room-local state; evaluation then either resolves it in its actual
lifecycle position or emits findings without hiding its controls.

- Unpicking a surviving top-level occurrence retains its encounter state.
- Repicking that occurrence restores the exact selections.
- Every potential N side-room slot receives its declaration-owned encounter
  defaults when the parent occurrence is constructed.
- A not-generated side room, and a generated-but-unentered side room, retain
  their encounter selections dormantly. A generated side-door offer remains
  active under the existing offer-time reward rule, but that does not activate
  the child room or any room-local authoring. `enteredOrdinal !== null` is this
  local child's structural-activation condition for encounter validation,
  customization, history, and effects.
- Removing a side room from the entered order retains its selections. Reentry
  restores them, and changing the order changes when their resolved effects
  enter history without changing ownership.
- Structurally trimming an optional phase retains its selection dormantly.
- Reactivation restores that selection.
- A dormant selection contributes no active control, candidate, finding,
  history, counter, phase-owned reward effect, or NPC-index row.
- Deleting a top-level occurrence removes both its own selections and all
  parent-local selections nested beneath it.
- Replacing a Room Declaration reconciles its owned phase keys and installs the
  new declaration defaults rather than transferring incompatible values. A
  parent replacement likewise reconciles its declared local-child slots.
- Undo/redo restores each room instance and its encounter state together.

Fixed singleton identities need no editable leaf. They still resolve
through the common encounter product and history path.

### Room-local encounter envelopes

The required potential envelope topology is:

```text
SingleEncounter
  Encounter

ShipEncounter
  Intro
  Combat1
  Combat2?      authored optional

PEncounter
  Intro         non-counting in ordinary definitions
  Combat        counting in ordinary definitions

FieldsEncounter
  Passive       non-counting
  Cage01
  Cage02
  Cage03        structurally dormant under the two-cage outcome
```

The comments describe the ordinary definitions, not immutable envelope
behavior. For example, `HeraclesCombatO` makes Ship `Intro` counting and
`HeraclesCombatP` makes P `Intro` counting while terminating the remaining
`Combat` suffix.

O and H already expose most of these shapes, but their current profiles also
carry baseline identity and counting authority. P currently collapses its two
positions into `SingleCountedCombat`. Gate A must publish the neutral envelopes
and exact slot bindings rather than preserving those old authorities.

For O, the Ship envelope binds:

```text
Intro     -> OEncountersIntros
Combat1   -> OEncountersDefault
Combat2?  -> OEncountersDefault
```

When the Ship room's authored count includes `Combat2`, the source's pre-room
`BiomeEncounterDepth` requirement permits it only at depths `2` through `5`.
That is a resolution gate, not structural dormancy: a retained third-phase
selection and its control remain visible as an invalid, repairable phase with a
phase-owned finding when the gate fails, while emitting no encounter history or
effects until corrected.

This admits authored sequences such as ordinary Intro plus ordinary Combat,
Heracles plus ordinary Combat, ordinary Intro plus ordinary Combat plus
Icarus, or ordinary Intro plus Icarus plus ordinary Combat. Heracles does not
terminate the O suffix. Icarus in one main slot makes Icarus in a later active
slot ineligible through exact encounter history.

H cage reward ownership must be explicit and independent of encounter-depth
counting. `Passive` has no cage reward. Each `CageNN` phase binds its exact local
reward slot and Encounter Set. Materialization must not discover cages by
scanning resolved definitions for counting behavior or by parsing phase names.

Structural authoring trims O's optional combat and H's inactive cage suffix
before encounter validation while retaining their authored selections
dormantly. A valid `HeraclesCombatP` selection on Intro then terminates the
remaining P suffix through its Encounter Definition's sequence effect.

An invalid P Intro is not a sequence effect. It leaves P Combat structurally
active, candidate-addressable, and editable; its candidate support evaluates
against the pre-Intro resolved history because the invalid Intro emitted no
provisional effect. Canonical resolution remains blocked at the invalid Intro,
so neither Combat nor any later slot contributes history or effects until the
prefix is corrected. Only a valid resolved Encounter Definition with a suffix
terminating sequence effect—currently `HeraclesCombatP`—may trim P Combat.

### Resolution and history timing

Encounter selection resolves during active-room preparation, while encounter
counters change only when the corresponding encounter starts. The canonical
history makes those checkpoints explicit:

```text
post-predecessor-commit history fold
  + structurally active room instance (per the shared activation hierarchy)
  + active Encounter Envelope slots
  + exact slot Encounter Set or fixed-definition bindings
  + concrete authored Encounter keys for pool-backed slots
  + incoming reward and room facts
  -> validate first active slot at its preparation checkpoint
  -> append encounterRecorded with exact definition, envelope, slot, and owner
  -> apply only preparation-time sequence effects such as BlockMultipleEncounters
  -> validate the next active slot against that recorded-occurrence prefix
  -> continue until the active envelope is prepared or blocked
  -> enter room
  -> append encounterStarted for each executable prepared slot in lifecycle order
  -> apply that definition's encounter-depth effect at encounter start
  -> append encounterCompleted at the declared completion point
```

Preparation and execution are successive checkpoints in one ordered canonical
history, not two ledgers. A later O, P, or H slot observes every exact
`encounterRecorded` identity before it in the same room, so an earlier NPC can
exclude a duplicate through an occurrence-based route or biome requirement. It
does not observe an encounter-depth increase from that earlier slot because no
encounter in the room has started yet.

Requirement views at a later preparation position are deliberately distinct:

- route/biome occurrence requirements use the extended preparation prefix and
  therefore include earlier `encounterRecorded` identities from the same room;
- previous-room spacing requirements use committed predecessor room origins
  only and exclude every position owned by the room currently being prepared;
- counter requirements use the post-predecessor-commit counter snapshot until
  the corresponding encounter-start operation advances it.

All three are immutable projections of the same canonical history at named
checkpoints. They are not separate ledgers, mutable overlays, or semantic NPC
family state. In O, this permits `HeraclesCombatO` in `Intro` followed by
`IcarusCombatO` in a main position when the prior-room spacing window is clear,
while an `IcarusCombatO` recorded in `Combat1` still makes Icarus in `Combat2`
ineligible through Icarus's route-occurrence exclusion.

If an active selection is invalid, canonical preparation stops at that slot;
later authored selections remain structurally reachable and editable but emit
no history or effects until the prefix is valid. A valid sequence-terminating
definition may trim a suffix during preparation. It still cannot advance an
encounter counter before its start checkpoint.

The one canonical history carries the distinctions required by lifecycle:

- `encounterRecorded` carries the exact Encounter Definition key, Encounter
  Envelope key, stable slot key, and exact room-instance origin;
- `encounterStarted` identifies when the prepared definition begins;
- the definition's declared encounter-depth effect is applied only by the
  lifecycle's start operation;
- `encounterCompleted` identifies the later completion point.

Requirement evaluation receives an immutable view derived by folding this
history at a named checkpoint. It must not read or mutate an ambient
"current counters" object, provisional counter slate, or per-room counter
overlay. The Encounter Definition declares whether and how it advances
encounter depth; it does not contain mutable counter state. The existing
lifecycle history and fold must expose the exact occurrence and structural-slot
views, analogous to loot history. Do not add a persisted ledger, a second
simulator history, or a profile baseline followed by an NPC side channel. An
invalid or dormant selection emits no substitute encounter.

An entered N side room resolves at its existing local-child lifecycle position:
after the parent room's outgoing side-room generation, in `enteredOrdinal`
order, and before the corresponding parent restore. Its resolved encounter
therefore contributes history seen by later entered side rooms. Generated but
unentered side rooms publish offers but no encounter resolution.

Planner history records concrete Encounter Definition identities, never a
semantic NPC-family identity. At the next planner decision, the mandatory room
interactions for Artemis, Heracles, Icarus, Athena, and Arachne have completed,
so their source completion/use records and exact encounter occurrence are
equivalent for the supported requirements. Nemesis combat already uses
encounter occurrence. No independent NPC-use ledger, family occurrence, or
family counter is added.

### Structural recent-slot requirement

Gate A retires `recentEncounterPhaseCount` with `EncounterProfile`. O's existing
room rule becomes `recentEnvelopeSlotCount` with an explicit `envelopeKey`,
`slotKey`, `roomWindow`, and numeric range. It counts started slots grouped by
exact room-instance origin from the same canonical history fold.

This requirement asks whether recent rooms executed the structural Ship
`Intro` position; it does not ask which concrete Intro definition was selected.
Heracles therefore counts as an O Intro exactly as the ordinary generated Intro
does. Do not preserve this policy by retaining profile keys or by enumerating
current concrete Intro definition keys. The structural view and the exact
definition view are projections of the same history, not separate histories.

### Counter authority

Room and encounter counters remain separate authorities:

- room lifecycle owns entry, exit, reward acquisition, restoration,
  `biomeDepthCache`, room-history ordinal, and other room-based effects;
- each resolved Encounter Definition declares its encounter-depth effect and
  any preparation-time sequence effect;
- lifecycle applies sequence effects during preparation and encounter-depth
  effects at encounter start; the canonical history fold derives the resulting
  views and counters at each checkpoint;
- an Encounter Envelope owns no effective kind or counter value.

The simulator must not also calculate a competing whole-room encounter count
from envelope length, legacy profile phases, or room template. A whole-room
total is only the sum of the resolved definitions' effects. This preserves
ordinary O Intro as non-counting, Heracles O as counting without suffix
termination, Arachne and `Empty` as non-counting, H Passive as ordinarily
non-counting, and resolved H cages as ordinarily counting.

### Exact semantic ownership

One Encounter Phase Address contains:

- biome key;
- one exact room-instance owner:
  - a Room Occurrence ID; or
  - a local-child identity consisting of parent Room Occurrence ID, group key,
    and slot key;
- stable phase key.

Commands, candidates, findings, workspace ownership, focus, customization, and
the NPC index use that address. They never use rendered phase order or room
game name as instance identity. Local children retain their existing
`LocalChildAddress`; encounter authorship does not promote them into topology.

### Application surface

A details-active room instance exposes `Customize` when it has at least one
meaningful supported room-local section. The initial Encounter section renders
active ordered phases and each phase's current concrete Encounter Definition
plus valid candidates.

For this surface, a meaningful Encounter selection has two or more
declaration-owned choices. A singleton set remains a persisted, phase-addressed
engine product with its marker and exact focus destination, but it does not
publish a no-op selector or reset interaction. A singleton phase with a live
phase-owned finding instead appears as read-only diagnostic information inside
the containing `Customize` surface. This boundary uses declared choice
cardinality, never the current eligible-candidate count: an invalid retained
selection in a multi-choice set remains visible and correctable.

React receives labels, selected values, typed findings, and complete bound
semantic intents. It does not inspect Encounter Set membership, evaluate
requirements, classify NPCs, terminate phases, or calculate counters.

The route NPC tab is a read-only index. It groups resolved standard NPC
encounters by an optional declaration-owned presentation key and navigates to
the exact room instance and phase. Arachne can have one row per eligible biome.
The index is not a second authoring surface, and its grouping key is never an
eligibility or history operand.

Room customization is the future home for generated enemy distribution,
additional encounter details, room features, and items when those products
gain real data. Do not render empty placeholder sections.

## Supported Normalized Projection

The exact declaration spelling can follow the existing biome-oriented files,
but the support below must be explicit and compiler-checkable.

### Concrete encounter pool projection

| Source support            | Retained concrete identities for this program                                   | Default interpretation     |
| ------------------------- | ------------------------------------------------------------------------------- | -------------------------- |
| F openings                | `OpeningGeneratedF`                                                             | `OpeningGeneratedF`        |
| F Combat01 inline         | `GeneratedF`                                                                    | `GeneratedF`               |
| `FEncountersDefault`      | `GeneratedF`, `ArtemisCombatF`, `ArachneCombatF`, `NemesisCombatF`              | `GeneratedF`               |
| `GEncountersDefault`      | `GeneratedG`, `ArtemisCombatG`, `ArachneCombatG`, `NemesisCombatG`              | `GeneratedG`               |
| `HEncountersDefault`      | `GeneratedH`, `GeneratedH_Treant2`, `GeneratedH_Screamer2`, `NemesisCombatH`    | `GeneratedH`               |
| `HEncountersPassive`      | `GeneratedH_Passive`                                                            | `GeneratedH_Passive`       |
| `HEncountersPassiveSmall` | `GeneratedH_PassiveSmall`                                                       | `GeneratedH_PassiveSmall`  |
| `IEncountersDefault`      | `GeneratedI`, `GeneratedI_GoalReward`, `NemesisCombatI`                         | `GeneratedI`               |
| `IEncountersSmaller`      | `GeneratedI_Small`, `GeneratedI_Small_GoalReward`, `NemesisCombatI`             | `GeneratedI_Small`         |
| N opening                 | `OpeningGeneratedN`                                                             | `OpeningGeneratedN`        |
| N PreHub                  | `PreHubGeneratedN`                                                              | `PreHubGeneratedN`         |
| `NEncountersDefault`      | `GeneratedN`, `ArtemisCombatN`, `HeraclesCombatN`                               | `GeneratedN`               |
| `NEncountersSmaller`      | `GeneratedN_Smaller`, `ArtemisCombatN`, `HeraclesCombatN`                       | `GeneratedN_Smaller`       |
| `NEncountersBigger`       | `GeneratedN_Bigger`, `ArtemisCombatN`, `HeraclesCombatN`                        | `GeneratedN_Bigger`        |
| `NEncountersSubRoom`      | `GeneratedNSubRoom`, `GeneratedNSubRoom_Bigger`                                 | `GeneratedNSubRoom`        |
| `NEncountersSubRoomLight` | `GeneratedNSubRoom`, `Empty`                                                    | `GeneratedNSubRoom`        |
| N heavy side rooms        | direct fixed `GeneratedNSubRoom_Bigger` binding                                 | `GeneratedNSubRoom_Bigger` |
| `OEncountersIntros`       | `GeneratedO_Intro01`, `HeraclesCombatO`                                         | `GeneratedO_Intro01`       |
| `OEncountersDefault`      | `GeneratedO`, `IcarusCombatO`                                                   | `GeneratedO`               |
| P opening                 | ordinary `PIntroCombat*` identities and one `Empty`; Dream-run identity removed | `PIntroCombat01`           |
| P first position          | `GeneratedP_PreCombat`, room-local pre-combat identities, `HeraclesCombatP`     | `GeneratedP_PreCombat`     |
| `PEncountersDefault`      | `GeneratedP`, `GeneratedP_Large`, `AthenaCombatP`, `IcarusCombatP`              | `GeneratedP`               |
| `QEncountersDefault`      | `GeneratedQ`                                                                    | `GeneratedQ`               |
| `QEncountersIslands`      | `GeneratedQ_Islands`                                                            | `GeneratedQ_Islands`       |
| `QEncountersPreBoss`      | `GeneratedQ_Large`                                                              | `GeneratedQ_Large`         |

`Empty` in N side and P opening support is a real concrete encounter identity,
not missing data. The N heavy key must use the source spelling
`GeneratedNSubRoom_Bigger`.

### Exact-history interpretation

NPC encounters are ordinary members of their phases' Encounter Sets. Their
requirements use the same exact-key history machinery as other authored
outcomes. The initial normalized requirements preserve:

- exact phase/set membership;
- Indoor/Outdoor and other existing structural room facts;
- incoming reward exclusions;
- `biomeDepthCache` and `biomeEncounterDepth` gates;
- route-scoped exclusion of explicit prior Encounter Definition keys;
- biome-scoped exclusion of explicit prior Encounter Definition keys;
- `previousRoomEncounterKeyCount` over an explicit Encounter Definition key set,
  room window, and numeric range.

`previousRoomEncounterKeyCount` examines the immediately preceding committed
room origins at the preparation checkpoint. Within each origin it observes the
exact encounter keys recorded for that room; it never includes a phase owned by
the room currently being prepared. This is the normalized equivalent of the
source `SumPrevRooms` boundary, not a general minimum-distance calculation over
the latest occurrence event.

For example, each Artemis definition route-excludes
`ArtemisCombatF`, `ArtemisCombatG`, and `ArtemisCombatN`. Including its own key
prevents the same Artemis variant anywhere later in the route; including the
sibling keys prevents another biome variant later in the route. Arachne uses a
narrower biome exclusion—F excludes `ArachneCombatF` and G excludes
`ArachneCombatG`—while its five-previous-room spacing requirement observes both
exact keys.

The ordinary encounter-candidate query returns every currently eligible member
of the active phase's Encounter Set, whether generated, NPC, or non-combat. One
semantic select-encounter command accepts an exact candidate key. There is no
NPC candidate endpoint, NPC replacement command, unlock flag, or second
evaluator; an NPC becomes available precisely when its ordinary encounter
requirements pass.

They use the existing requirement evaluator and the canonical history facts;
Gate B adds only the exact-key exclusion and
`previousRoomEncounterKeyCount` operands that have a real NPC consumer. The
previous-room operand excludes the room currently being prepared even though
occurrence exclusions include its earlier recorded positions. Do not introduce
a generic encounter-condition DSL, save-profile model, bounty state, keepsake
state, NPC-use ledger, semantic encounter-family ledger, or service registry.

Nemesis combat definitions retain encounter identity, counter behavior,
exact-key exclusions, and spacing. Their Gold wager is documented but has no
modeled effect while Gold remains outside the simulator.

## Ownership

### Hades II catalog

Owns:

- raw Encounter Envelope, Encounter Definition, and Encounter Set declarations;
- fully progressed normalization dispositions;
- unique set construction and static defaults;
- complete Room Declaration envelope and slot bindings, including empty and
  fixed cases;
- definition requirements, effective kinds, counter effects, sequence effects,
  labels, and optional NPC presentation metadata;
- strict construction closure over every supported non-empty envelope slot.

It does not own authored selections, route history, candidates, commands,
findings, or editor products.

### Planner engine

Owns:

- schema-12 strict authored normalization and new-project defaults;
- room-instance-owned concrete encounter selections on top-level occurrences
  and parent-local children;
- exact phase addresses;
- semantic select/reset commands and undo/redo behavior;
- active/dormant phase classification;
- ordered active-room and within-envelope encounter resolution;
- invalid-selection findings and valid candidate queries;
- canonical encounter record/start/completion history, its exact-definition and
  structural-slot views, and its checkpointed counter fold;
- exact-key route/biome occurrence exclusions and previous-room-window
  requirements;
- engine-owned authoring queries.

It does not import the Hades II catalog implementation or return component,
dialog, focus, or picker-section products.

### Planner application and React

Owns:

- room-customization composition and presentation;
- binding engine candidates to complete semantic interactions;
- the read-only route NPC index;
- exact focus/navigation into the containing room and phase;
- editor-session reconciliation when an owner disappears.

React must not reproduce set membership, requirements, NPC classification,
counter effects, or sequence termination.

## Delivery Gates

Commit counts are estimates, not quotas. Every commit must leave the product
usable and close one authority with its actual consumers. Do not land
context-only types, compatibility paths, or a catalog product that later code
must repair before invalid authored defaults can be edited.

### Gate A — Complete ordinary encounter-authoring vertical

Expected size: one intentionally broad vertical commit. Split only if every
resulting commit keeps invalid defaults reachable and editable through the full
product loop without a temporary fallback path.

Deliver:

- ordinary Encounter Envelopes, Encounter Definitions, unique Encounter Sets,
  static defaults, and compiler closure for the Gate A supported projection;
- complete F-through-Q Room Declaration envelope-slot bindings, including empty
  and directly bound fixed envelopes;
- universal retirement/consolidation of `EncounterProfile` according to the
  disposition table, with no retained collection, forwarding adapter, or
  compatibility profile path;
- replacement of the O progression override's
  `sourceEncounterProfileKey` selector with `sourceRoomTemplateKey`, including
  topology construction, room replacement, strict decoding, and reward-store
  command validation;
- lifecycle compatibility updated to validate executable envelope shapes
  without regaining identity, set, kind, or counter authority;
- deletion of pooled `baselineEncounterKey`, profile-owned effective kind and
  count authority, and profile-derived encounter-count logic;
- pooled-slot effective kind, encounter-depth, and sequence-effect authority on
  the selected Encounter Definition;
- fixed encounter identity integration through the common resolver;
- direct definition bindings and closure for every fixed slot,
  with pre-run Shrine/difficulty variants excluded from the projection;
- neutral single-slot, Ship, P `Intro`/`Combat`, and complete Fields envelopes;
- P opening and ordinary P envelope bindings;
- room-specific P first-position members;
- explicit H Passive/cage topology, dormant `Cage03` retention, and cage reward
  ownership;
- corrected N heavy source key;
- schema-12 `RoomOccurrence.encounters` and nested
  `EphyraSideRoomState.encounters` concrete selections with strict decoding and
  no migration from older schemas; only pool-backed potential slots persist;
- construction, replacement, deletion, dormant retention, and undo/redo rules;
- semantic select/reset commands;
- existing ordinary encounter requirements and valid candidates;
- generic exact `encounterRecorded` history plus started structural-envelope
  slot history;
- replacement of profile-based O `recentEncounterPhaseCount` with
  `recentEnvelopeSlotCount` over the canonical started-slot view;
- invalid-selection findings with no fallback;
- incremental within-envelope preparation where each later slot observes exact
  occurrences recorded by earlier slots but the same pre-room counter snapshot;
- one canonical history fold with distinct record, start, counter-effect, and
  completion checkpoints, with no provisional counter slate, parallel ledger,
  or whole-room count calculation;
- active-room Encounter customization across representative ordinary, O, P, H,
  I Goal, entered N side-room, and Q cases.

Gate A intentionally includes the editor surface: a context-invalid static
default must be correctable in the same usable commit that begins validating
it.

Acceptance:

- every supported Room Declaration binds one complete Encounter Envelope and
  every non-empty potential slot is fixed or bound to exactly one normalized
  Encounter Set;
- `EncounterProfile`, `SingleCountedCombat`, `NoEncounter`, the two H cage-count
  profiles, and the two baseline-only Ephyra side-room profiles no longer exist
  as normalized encounter authorities;
- the Ship and Fields room templates retain their authored reward/state
  responsibilities without selecting encounter identity or count behavior;
- production sets contain unique identities and no weights;
- every editable phase has a complete static default;
- I Goal defaults can remain authored-invalid and offer the exact valid
  correction; the modeled P terminal boundary preserves the declared
  `GeneratedP`/`GeneratedP_Large` overlap at depth 9 rather than inventing an
  unsupported late-P invalid-default witness;
- invalid selections emit no substitute identity, encounter history, counter,
  or reward effect;
- NPC-free selections preserve existing reward behavior and derive the same
  encounter counter totals solely from resolved definitions;
- P ordinary rooms resolve non-counting Intro plus counting Combat and still
  acquire one room reward;
- an invalid P Intro leaves Combat structurally active and candidate-addressable
  without allowing either slot to emit canonical history or effects;
- H cage rewards remain attached to exact cage phases independently of selected
  encounter count behavior;
- O wheel ownership remains on its existing addressed combat phase;
- a later active O/P/H slot observes exact encounters recorded earlier in the
  same room while retaining the post-predecessor-commit counter snapshot;
- canonical occurrence history retains exact room origins so the current
  preparation prefix and committed predecessor-room window remain
  distinguishable for Gate B requirements;
- all active H cages prepare against the same post-predecessor encounter-depth
  snapshot, and each cage advances encounter depth only when that cage starts;
- O's recent-Intro rule counts started Ship `Intro` slots through
  `recentEnvelopeSlotCount`, including Heracles O, without retaining a profile
  key or enumerating concrete Intro definitions;
- O normal-room decisions retain `sourceOfferPoint` reward-store ownership
  through the explicit `ShipCombat` room-template override across construction,
  replacement, decoding, and semantic commands;
- no profile/envelope length or room template independently calculates a
  whole-room encounter count;
- N side rooms retain their existing parent-local `LocalChildAddress`; every
  potential slot owns defaults, while only slots in authored entry order expose
  room-local encounter controls, validation, history, or effects; generated
  side-room offer-time reward selections remain separately active;
- side-room encounter effects enter history in authored entry order before each
  parent restore and can affect a later entered side room;
- P opening is no longer represented as no encounter;
- exact encounter occurrence history and structural started-slot history are
  complete generic engine products rather than an NPC-specific ledger or
  evaluator; NPC-only exact-key exclusion and spacing operands wait for Gate B;
- no NPC encounter candidate or route index exists yet.

### Gate B — Artemis, Arachne, and the generic NPC index

Expected size: one or two commits.

Deliver:

- exact encounter-key route/biome occurrence exclusions and
  `previousRoomEncounterKeyCount` requirement evaluation over Gate A's
  canonical history;
- Artemis F/G/N definitions and requirements;
- Arachne F/G definitions and requirements;
- the corresponding unique set-member extensions;
- definition-owned NPC presentation keys for the read-only index only;
- Artemis route-history exclusions listing the exact F/G/N Artemis keys on
  every variant;
- Arachne biome-history exclusions listing the exact local-biome key;
- shared six-room Artemis spacing and five-room Arachne spacing over explicit
  exact-key sets;
- Arachne counting-to-non-counting behavior;
- generic read-only route NPC index and exact phase navigation.

Acceptance:

- F `F_Combat01`, F/N openings, N PreHub, N side rooms, fixed combat, and
  unpicked rooms never expose Artemis or Arachne encounter candidates;
- one `ArtemisCombatF` selection makes a later `ArtemisCombatF`,
  `ArtemisCombatG`, or `ArtemisCombatN` candidate ineligible through exact
  route history;
- Arachne may occur once in F and once in G when the cross-biome five-room
  spacing requirement permits it;
- `previousRoomEncounterKeyCount` examines only the requested immediately
  preceding committed room origins and excludes the room currently being
  prepared;
- changing an earlier room can leave a selected NPC invalid and editable with
  no fallback or substitute history;
- removing or changing NPC presentation metadata cannot alter any candidate or
  resolved-history result;
- the NPC index navigates to the exact active room instance and phase.

### Gate C — Heracles, Icarus, and Athena phase behavior

Expected size: one or two commits.

Deliver:

- Heracles in N combat, O Intro, and P Intro;
- Icarus in O active main combat and P Outdoor Combat;
- Athena in P Combat;
- the corresponding unique set-member extensions;
- exact self-and-sibling route-history exclusions, depth, reward, and room-tag
  requirements;
- expansion of shared six-room exact-key lists to include the newly supported
  Heracles, Icarus, and Athena definitions;
- NPC presentation keys consumed only by the read-only index;
- O Heracles counter increase without suffix termination;
- P Heracles `BlockMultipleEncounters` suffix termination;
- dormant retained main-phase selections under P Heracles;
- exact O wheel and P singular-reward preservation.

Acceptance:

- Heracles is never selected from P main support;
- Icarus and Athena never replace P Intro;
- only one Icarus can resolve in an O room or route;
- Heracles O in `Intro` does not by itself violate Icarus O's previous-six-room
  spacing requirement in a later position of that same room;
- Icarus O in `Combat1` still makes Icarus O in active `Combat2` ineligible
  through the route-occurrence exclusion;
- Heracles O adds one whole-room encounter-depth count while later O positions
  remain;
- Heracles P changes Intro to counting, removes the normally counting Combat,
  and leaves the whole-room total at one;
- a trimmed P Combat selection has no active product and restores exactly when
  the suffix becomes active again.

### Gate D — Nemesis combat closure

Expected size: one commit, with a focused second only if H reveals a real
pre-existing cage defect.

Deliver:

- `NemesisCombatF`, `NemesisCombatG`, `NemesisCombatH`, and `NemesisCombatI`;
- the corresponding unique set-member extensions;
- exact self-and-sibling route-history exclusions and source-backed spacing;
- expansion of shared six-room exact-key lists to include all supported Nemesis
  combat definitions;
- an NPC presentation key consumed only by the read-only index;
- F/G/I ordinary combat placement;
- H placement on an active cage phase only;
- ordinary room and cage reward preservation;
- explicit absence of modeled Gold-wager effects.

Acceptance:

- Nemesis combat never appears on H Passive, an inactive cage, Bridge, Shop, or
  Q;
- a Nemesis H occurrence recorded for Cage01 makes the same retained selection
  in Cage02 invalid during preparation, while Cage01's encounter-depth effect
  remains unapplied until Cage01 starts;
- selecting Nemesis combat preserves ordinary F/G/I incoming rewards and the H
  cage-local reward;
- `NemesisRandomEvent`, reward suppression, interactions, Bridge behavior,
  Shop behavior, and Gold outcomes have no production declarations or authored
  fields;
- the generic NPC index represents Nemesis through the same presentation-only
  grouping metadata and exact navigation path as earlier NPCs.

### Gate E — Closure, documentation absorption, and plan retirement

Expected size: one documentation commit after the complete repository gate.

Deliver:

- full matrix and product-loop verification;
- stable contract absorption into catalog, authored-project, lifecycle,
  simulation, relevant biome, and editor design documents;
- implementation-history update;
- deletion of this temporary plan.

Do not copy the full source matrices into design documents. They remain owned
by the stable audit.

## Audit-Against Matrix

| Risk                                      | Required evidence                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw weight leakage                        | normalized Encounter Sets contain unique keys and no count, weight, ratio, or probability field                                                                                                                                                                                                                               |
| Source evidence mixed with interpretation | exact raw multiplicity remains only in the audit; production projection and defaults remain only in design/progress authorities                                                                                                                                                                                               |
| Meta-progression state leakage            | no route mode, per-NPC unlock, narrative, bounty, keepsake, or lifetime-use authored state                                                                                                                                                                                                                                    |
| Implicit room mapping                     | every supported Room Declaration publishes an exact envelope and complete non-empty slot bindings, including empty and directly bound fixed cases                                                                                                                                                                             |
| Envelope policy leakage                   | Encounter Envelopes carry only room-local slot topology, declarative activation, and named reward attachments—not set, identity, effective kind, eligibility, count policy, or lifecycle operation timing                                                                                                                     |
| Compatibility-profile residue             | `EncounterProfile` is absent from the normalized catalog; retired profiles have no forwarding aliases, envelope adapters, compatibility lookup, or second materialization path                                                                                                                                                |
| Progression-selector residue              | O reward-store overrides use `sourceRoomTemplateKey: ShipCombat`; no layout, topology, codec, or command path retains or reconstructs `sourceEncounterProfileKey`                                                                                                                                                             |
| Empty/non-combat member mismatch          | N side and P opening `Empty` selections resolve definition-owned kind/effects without changing the stable phase address                                                                                                                                                                                                       |
| Context-sensitive default repair          | I Goal defaults remain authored-invalid until an explicit valid command changes them; the current P terminal preserves its declared depth-9 `GeneratedP`/`GeneratedP_Large` overlap without automatic substitution                                                                                                            |
| Silent fallback                           | invalid encounter emits no substitute definition, history, counter, reward, or NPC-index row                                                                                                                                                                                                                                  |
| Concrete identity loss                    | authored state and resolved history carry the exact normalized game encounter key                                                                                                                                                                                                                                             |
| Semantic family ledger                    | requirements and history use exact Encounter Definition keys; optional NPC grouping metadata is consumed only by presentation and navigation                                                                                                                                                                                  |
| Same-variant repeat                       | each route-once NPC definition excludes its own exact key as well as every supported sibling-biome key                                                                                                                                                                                                                        |
| Cross-variant repeat                      | selecting one route-once NPC variant makes every supported sibling-biome variant ineligible through exact route history                                                                                                                                                                                                       |
| Fixed-variant leakage                     | each fixed slot binds one exact definition directly; pre-run Shrine/difficulty alternatives have no normalized definition binding, candidate, resolver branch, or authored state                                                                                                                                              |
| Activation-boundary leakage               | materialized incoming/free reward offers remain editable before entry; structurally inactive room instances retain encounter data but expose no active encounter control, candidate, finding, history, counter, or NPC-index row; structurally active room-local controls remain reachable behind invalid evaluation prefixes |
| Local-child topology promotion            | N side rooms keep `LocalChildAddress` ownership and never acquire independent Occurrence IDs or global topology entries                                                                                                                                                                                                       |
| Persisted-owner ambiguity                 | schema 12 stores pool-backed potential selections only on `RoomOccurrence.encounters` or nested `EphyraSideRoomState.encounters`; fixed and empty slots have no redundant authored key                                                                                                                                        |
| Side-room lifecycle ordering              | entered N side encounters resolve in `enteredOrdinal` order before each parent restore; generated-unentered rooms emit none                                                                                                                                                                                                   |
| Dormant-phase leakage                     | inactive O/H/P phase selections retain data but have no active semantic product                                                                                                                                                                                                                                               |
| Wrong checkpoint                          | occurrence exclusions include the current preparation prefix, previous-room spacing excludes the current room owner, and counters remain post-predecessor until `encounterStarted`; none use a provisional counter slate                                                                                                      |
| Stale within-room history                 | every later active O/P/H slot sees exact occurrences recorded by earlier slots for occurrence-based requirements without leaking them into predecessor-room windows or encounter counters                                                                                                                                     |
| Structural-history loss                   | O's recent-Intro rule uses `recentEnvelopeSlotCount` over started Ship `Intro` slots from canonical history, not retained profile keys or an exact-definition enumeration                                                                                                                                                     |
| Parallel history                          | lifecycle emits record, start, counter-effect, and completion checkpoints through one canonical fold, not a profile baseline, mutable per-room slate, NPC side channel, or persisted second ledger                                                                                                                            |
| Counter double authority                  | Encounter Definitions declare encounter-depth effects and lifecycle applies them at start; envelope length, room templates, preparation, and whole-room helpers cannot independently calculate or advance the total                                                                                                           |
| P topology regression                     | ordinary P has non-counting Intro, counting Combat, and one reward; only a valid suffix-terminating definition trims Combat, while an invalid Intro leaves Combat active without canonical effects                                                                                                                            |
| H reward/encounter coupling               | cage reward ownership is explicit and independent from selected definition count behavior                                                                                                                                                                                                                                     |
| UI policy duplication                     | React consumes bound candidate interactions and never evaluates Encounter Sets or requirements                                                                                                                                                                                                                                |
| Test helper policy                        | helpers observe products but do not reproduce encounter eligibility, sequence, focus, or topology                                                                                                                                                                                                                             |
| Production audit growth                   | exhaustive closure and source/projection comparison live in tests, not runtime manifests                                                                                                                                                                                                                                      |
| Deferred Nemesis leakage                  | no random-event, interaction, reward-suppression, Shop, Bridge, or Gold schema enters production                                                                                                                                                                                                                              |

## Test Ownership

### Catalog primary tests

- exact empty, neutral single-slot, fixed single-slot, Ship, P, and complete
  Fields envelope shapes;
- explicit deletion of the normalized `EncounterProfile` collection and
  consolidation of retired profile keys and pooled baseline fields;
- definition and set uniqueness;
- defaults are members of their sets;
- complete Room Declaration envelope-slot binding closure;
- fixed-slot direct-definition binding closure with pre-run difficulty variants
  excluded;
- O reward-store override normalization and closure by `ShipCombat` room
  template, with no encounter-profile selector;
- raw duplicate-weight entries do not survive normalization;
- external progression and deferred Nemesis identities do not enter the
  supported projection;
- exact F-through-Q room/phase set matrix;
- P room-local first-position membership;
- N heavy source spelling;
- definition requirements, counters, sequence effects, exact exclusion/spacing
  key closure, and optional NPC presentation metadata.

### Engine primary tests

- schema-12 defaults and strict decoding;
- exact top-level `RoomOccurrence.encounters` and nested
  `EphyraSideRoomState.encounters` placement, with empty/fixed slots omitted;
- O `ShipCombat` source-offer-point policy through topology construction, room
  replacement, strict decoding, and reward-store command validation;
- occurrence and nested local-child creation, replacement, deletion,
  unpick/repick, enter/unenter/reorder, dormant phase, and undo/redo behavior;
- exact address command routing;
- static-invalid default and later-invalid retained selection behavior;
- no fallback resolution;
- ordered P/O/H phase resolution with later slots observing earlier exact
  recorded occurrences but unchanged pre-room counters;
- distinct record/start/depth-effect/completion checkpoint ordering with no
  mutable provisional counter slate;
- H Cage01 exact-key exclusion affecting Cage02 during preparation while its
  encounter-depth effect remains unavailable until start;
- previous-room encounter windows exclude the room under preparation while
  route/biome occurrence views include earlier positions from that room;
- O Heracles Intro plus Icarus main remains spacing-valid, while Icarus in
  Combat1 excludes Icarus from Combat2 through occurrence history;
- `recentEnvelopeSlotCount` preserving O recent-Intro behavior for ordinary and
  Heracles Intro definitions;
- invalid P Intro retains active, candidate-addressable Combat without
  provisional or canonical encounter effects;
- exact encounter history with no family occurrence or family counter;
- definition-owned encounter-counter folding with no whole-room double count;
- Gate B-D exact-key route/biome exclusion, spacing, depth, reward, and room-tag
  matrices;
- same-variant and sibling-variant route exclusion witnesses;
- typed phase-owned findings and candidate correction.

### Planner and UI tests

- representative ordinary encounter customization;
- invalid selection remains reachable and editable behind an invalid prefix;
- active versus dormant phase rendering;
- entered N side-room and H cage customization ownership;
- generated-unentered N side rooms expose their offer-time reward selection while
  retaining room-local encounter state without encounter controls, findings,
  history, or effects;
- exact semantic intent dispatch;
- generic NPC index grouping and navigation;
- NPC presentation grouping changes do not alter candidates or history;
- focus/finding reconciliation after owner removal;
- materialized offer-time rewards remain editable independently of inactive
  room-local encounter controls.

### Contract and product witnesses

Keep representative cross-layer witnesses rather than copying the full policy
matrix:

- invalid I Goal default corrected explicitly;
- P terminal `GeneratedP`/`GeneratedP_Large` overlap remains explicit with no
  automatic substitution;
- Artemis F selection rejects later Artemis F/G/N candidates and retains exact
  NPC-index navigation;
- Arachne counter override and second-biome placement;
- Heracles O counter increase;
- Icarus O in Combat1 makes Icarus unavailable in active Combat2;
- Heracles O plus Icarus O in one room preserves the previous-room spacing
  boundary;
- Heracles P suffix termination with dormant Combat selection;
- Icarus O active-phase selection;
- Nemesis H cage selection with reward preservation.

Run the narrow owning lane during each implementation step. Run `npm run check`
after Gate A, after each completed NPC encounter-data gate with shared engine
changes, and before Gate E closes the program.

## Stop Conditions

Stop and amend this plan before implementation continues if:

- a source-supported combat phase cannot be bound without inferring from room
  name or rendered order;
- a room-local sequence cannot be represented by the declared envelopes without
  adding biome topology or a second lifecycle path;
- a concrete source identity requires a second persisted discriminator;
- invalid authored encounters cannot remain editable without fallback;
- P or H requires phase topology different from the audited source sequence;
- an encounter requirement cannot be expressed through exact route/biome
  occurrence history or the explicit previous-room encounter window;
- implementation must retain a pooled baseline encounter, profile-owned count,
  whole-room count authority, or second encounter ledger alongside exact
  definition resolution;
- a fixed or non-combat room requires retaining `EncounterProfile` or an
  envelope-to-profile adapter beside the normalized envelope contract;
- O progression requires an encounter-profile or envelope-key selector instead
  of the explicit `ShipCombat` room-template selector for its wheel-bearing
  source behavior;
- within-room eligibility requires a mutable/provisional counter slate or an
  encounter-depth advance before the corresponding `encounterStarted`
  checkpoint;
- previous-room spacing requires treating an encounter recorded in the room
  currently being prepared as a predecessor-room occurrence;
- O's recent-Intro rule cannot be preserved from the canonical structural-slot
  history without retaining a profile key or enumerating concrete definitions;
- Nemesis combat cannot be separated from its Gold wager without falsifying
  encounter eligibility or counters;
- implementation requires a production shadow manifest or duplicate policy
  evaluator solely to make the refactor testable.

Record new game facts in the audit first. Record changed planner interpretation
here only after the evidence is stable.
