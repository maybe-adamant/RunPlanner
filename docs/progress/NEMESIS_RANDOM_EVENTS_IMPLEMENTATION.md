# Nemesis Random Events Implementation

## Status

Locked delivery plan created from clean base `01de668` after the source-complete
Nemesis audit and a fresh read of the live encounter, Fields, Room Action,
generated-pickup, trait-history, candidate, and editor paths. Independent
adversarial review found no remaining P1/P2 correction.

This is a temporary implementation plan. It must not be linked from the README
or stable design documents. At closure, absorb the completed model into the
smallest durable authorities, update the durable implementation record, and
delete this file.

Owning evidence and stable authorities:

- [`ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md`](../audits/ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md)
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md)
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md)
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md)
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)
- [`F_GAME_RULES.md`](../biomes/F_GAME_RULES.md)
- [`G_GAME_RULES.md`](../biomes/G_GAME_RULES.md)
- [`H_GAME_RULES.md`](../biomes/H_GAME_RULES.md)
- [`I_GAME_RULES.md`](../biomes/I_GAME_RULES.md)

## Objective

Model the five ordinary Nemesis random-event families in F, G, and H without
creating a Nemesis-only encounter engine, pickup path, or room chronology.

The completed user-visible behavior is:

- F and G's ordinary encounter control can select clean Nemesis combat or the
  one real Nemesis random-event encounter;
- selecting the random event exposes one contextual event editor for the
  realized family, request or result, and response;
- the F/G random event preserves the already-authored door reward and its bag
  consumption but suppresses that reward's acquisition;
- H exposes the same random event as an add/remove room feature, not as a
  replacement for the separate Fields optional-reward generator;
- enabling H Nemesis reserves one physical optional-reward position, adds one
  required freely orderable Nemesis interaction, and leaves cage rewards
  untouched;
- accepted trades, free gifts, and contest results create ordinary generated
  acquisition rows with their declaration-owned Time Piece, Sea Star, Echo,
  trait/Pom child, and required/optional behavior;
- an accepted trait trade removes the exact eligible current trait and creates
  required Triple Gold; and
- one route-wide Nemesis rule and the existing six-room field-NPC spacing cover
  clean combat and random events together, while I remains combat-only.

Bridge progression, Shop theft, combat-wager Gold, health/death simulation,
and persisted exit theft remain outside the slice.

## Source Facts and Chosen Planner Representation

### One encounter identity, five realized outcomes

The game chooses `NemesisRandomEvent` as one encounter, then dialogue chooses
one eligible mechanical family. The five families are not five encounter
identities and must not be added to the F/G encounter picker as five fake
encounters.

Add one normalized `NemesisRandomEvent` Encounter Definition to:

- `FEncountersDefault`;
- `GEncountersDefault`;
- `HEncountersPassive`; and
- `HEncountersPassiveSmall`.

Keep every current default unchanged and keep I's encounter sets unchanged.
The definition is noncombat, does not advance encounter depth or end effects,
has `npcPresentationKey: 'Nemesis'`, owns one required encounter interaction,
and declares that its F/G incoming reward is suppressed. The normalized
catalog, not the application, owns those facts.

`NemesisRandomEvent` owns the one audited ordinary F/G/H requirement:

- `BiomeDepthCache >= 4`;
- the same seven incoming-reward exclusions as clean Nemesis combat;
- no prior route Nemesis combat or random-event occurrence; and
- no supported field NPC in the preceding six committed rooms.

Because H persists the same identity in its existing Passive slot, ordinary
encounter history continues to own both rules; do not add a second Nemesis
appearance ledger, an H-only route flag, encounter-set member overrides, or
per-biome event variants.

The F/G `RequireNotRoomReward` contact evaluates their one incoming door
reward. H has no corresponding single incoming reward: its cage and optional
rewards are separate generators and remain intact. Do not feed H cage or
optional identities into the F/G exclusion merely because the current generic
encounter requirement context exposes only `incomingReward`.

### H is a projected room feature over the existing Passive selection

H already persists and prepares the Passive encounter slot. Enabling the room
feature selects `NemesisRandomEvent` in that exact slot; removing it resets the
slot to its declaration-owned generated Passive default. No second H feature
boolean, synthetic occurrence, virtual room, or extra lifecycle phase is
persisted.

The application suppresses the generic Passive encounter picker for this
binary presentation and projects it under Room Features as **Add Nemesis
event** / **Remove Nemesis event**. The bound interaction dispatches the
existing exact `SelectEncounter` or `ResetEncounter` command. React does not
derive event eligibility or mutate the optional count.

The separate Fields optional-reward generator remains active. The physical
capacity in the room declaration remains unchanged. The engine derives:

```text
effective optional maximum = physical capacity - 1
```

only while `NemesisRandomEvent` is selected in the Passive slot. A retained
count above that effective maximum is context-invalid and repairable; selecting
Nemesis never truncates the count or discards authored optional rewards. The
count command and strict codec continue to admit the declaration's physical
range, while the evaluated count domain and finding own the dynamic limit.

### One closed phase-local outcome

Extend `RoomEncounterState` with sparse, phase-local Nemesis outcome storage.
The field is already specific to the one event identity, so it maps each phase
directly to its outcome:

```text
nemesisRandomEventByPhase
  phase key
    outcome or null
```

`null` means the selected event has reached an unresolved result. Switching a
phase to another encounter leaves its prior Nemesis detail dormant so switching
back restores it. Dormant detail emits no finding, action, pickup, or history
effect. Do not add a redundant fixed `NemesisRandomEvent` wrapper beneath each
phase.

The exact persisted outcome is one closed union:

```text
free item

Gold trade
  accept | decline

damage trade
  accept | decline

trait trade
  exact trait key
  accept | decline

damage contest
  success | failure
```

Do not duplicate the selected or offered result identity in this union. The
one event-generated acquisition entry owns its normal `AuthoredRewardState`.
That state is where concrete reward identity, Pom/trait child detail,
disposition, Time Piece, Sea Star, and last-reward semantics already belong.

The codec owns closed tags, exact keys, known trait identity, exact event-owned
generated site/entry ownership, and canonical encoding. Contextual legality
remains evaluation-owned so retained invalid item variants, trait targets, and
responses remain repairable.

The source's exact Gold prices, damage amounts, and contest threshold remain
durable audit facts, but they are simulation-neutral in the Planner's current
model. Accepting a Gold or damage trade means that the source cost was paid and
the player survived. Do not persist a scalar price or damage amount, add a
second paid checkbox, or expose those numeric domains through the catalog.

### One atomic outcome command, ordinary child commands

Add one semantic replacement command for the complete Nemesis outcome and its
result identity. The command writes the phase child and reconciles the exact
generated acquisition site atomically. The application may use a transient
multi-step draft for family, request/result, and response, but only the complete
semantic value enters authored history.

After the result entry exists, all edits beneath that result use the existing
acquisition-entry, reward-child, Pom/trait, Time Piece, and Sea Star commands.
Do not add Nemesis variants of those commands.

The H add/remove affordance remains the ordinary encounter-selection command,
not part of the outcome command. Enabling H produces an unresolved child and a
finding at the exact event owner; removing H makes retained event detail
dormant.

### Generated results use the shared acquisition-site authority

Introduce one collision-safe event-generated acquisition site beneath the
source occurrence and one stable result entry. Its source is the exact
Nemesis phase interaction.

Generalize the current trait-oriented generated-pickup projection and
reconciliation into a source-neutral authority with two adapters:

- selected trait producers; and
- selected Nemesis event producers.

The returned producer product continues to carry exact source owner/action,
site, lifecycle, placement, entry identity, requiredness, and active/dormant
status. `RoomOccurrence.acquisitionSites`, `interactAcquisitionEntry`, the
shared Room Action domain, `settlePickupAcquisitionSite`, candidates, findings,
and workspace acquisition rows remain the only persisted and simulated pickup
path.

Requiredness is declaration-derived from the family and response:

- free item: optional;
- damage-contest result: optional;
- accepted Gold trade: required;
- accepted damage trade: required;
- accepted trait trade Triple Gold: required; and
- declined trade: result detail remains dormant and no pickup action is
  active.

Every active result action depends on the required Nemesis interaction. There
is no result settlement before the event. Exact concrete reward declarations
continue to determine Time Piece, Sea Star, Artificer, and Echo behavior.

Add exact normalized acquisition identities for `EmptyMaxHealthDrop`,
`HealDrop`, and `RoomRewardConsolationPrize`. Do not alias
`RoomRewardHealDrop`, `HealDropMinor`, or another similar object. Add one
`NemesisEventPickup` producer lifecycle that supports the complete audited
result matrix and explicitly preserves the fact that none is Artificer
eligible.

### The event reuses the required encounter Room Action

Reuse the existing `interactEncounter` Room Action reference, owned by the
exact encounter phase. Broaden its declaration-driven activation from
encounter trait offers to either a trait offer or Nemesis event interaction;
do not add `interactNemesis` as a parallel chronology vocabulary. It is
required in F, G, and H.

- In F/G it occupies the standard noncombat action window and replaces the
  suppressed incoming-reward acquisition as the required room interaction.
- In H it occupies the Fields window with no cage dependency. The existing one
  room action order therefore permits it before, between, or after cage and
  optional-pickup actions, but the room cannot exit until it resolves.
- Generated result actions follow it through the existing action dependency.

Do not create a Nemesis timeline, event scheduler, or H-only lifecycle. The
existing Room Action roster, order validation, lifecycle executor, and
exit-usable calculation remain authoritative.

### Result assessment uses the exact interaction frontier

The game selects a realized eligible family/result at interaction time. The
Planner authors that outcome, but validates it against the exact pre-Nemesis
history branch at the ranked event action.

The engine publishes one candidate capability for the event owner containing:

- the five family choices supported by the modeled baseline;
- exact result identities legal for the selected family and entered-biome
  split;
- accept/decline support;
- the current eligible trait-trade domain with Common priority; and
- contest success/failure result domains.

This must be evaluated at the event action, not at room entry. In H, earlier
cage and optional acquisitions may change Pom, Hammer, Path of Stars, Death
Defiance, or current trait support. Candidate artifacts remain branch-local;
the application does not union divergent result or trait domains.

The Planner does not add a Gold balance, current health, death branch,
No-Hit-Shield ledger, or external dialogue/profile state. It therefore:

- authors accept or decline without validating affordability;
- treats accepted damage trade as paid and survived without recording its
  amount or simulating survival;
- permits the audited realized Last Stand and damage-trade family baseline
  without inventing global health/shield state; and
- treats the 2,000-damage presentation tier as absent.

These are explicit bounded simplifications, not generic unsupported states.

### Trait trade reuses removal history, not Ransom policy

At the exact event interaction, assess the selected trait against the current
rarity-bearing `IsGodTrait(..., ForShop = true)` approximation and the audited
Common-priority rule. On accepted response:

1. append the existing `TraitRemovalEvent` for the exact current trait key;
2. fold it through the existing trait-history authority; and
3. activate the required `RoomMoneyTripleDrop` result pickup.

Decline changes neither trait history nor pickup participation. Reuse the
generic removal event/fold mechanics only; do not invoke Ransom's provider
removal, level multiplier, preview, or candidate policy.

The existing previously-picked ledger remains intact, so a removed
`BlockOfferIfPreviouslyPicked` trait stays unavailable exactly as it does after
Ransom.

### F/G incoming reward suppression preserves source history

The F/G door reward is authored and drawn before encounter selection. Selecting
the random event must therefore:

- retain the exact authored reward, source/store identity, and bag draw;
- mark its canonical acquisition disabled;
- omit its Room Action and all acquisition/trait/level settlement; and
- restore the same authored reward if another encounter is selected later.

Generalize the existing canonical incoming-acquisition-enabled seam already
used by Anomaly rather than adding a Nemesis-only reward branch. Suppression is
an evaluated disposition, not destructive authored mutation or a refund.

H cage and optional rewards remain enabled because the H event is a Passive
feature, not an incoming or cage reward replacement.

### Exit theft remains simulation-neutral

Do not persist a stolen-exit key, mutate authored topology, remove an
additional exit, or add a finding.

The selected continuation is protected. With one eligible exit source theft
does not occur; with two or more, one nonselected eligible exit absorbs it.
Every authored natural Chaos gate counts as affordable because health is
unmodeled. Zagreus Contract is excluded because its Shop contact uses the
separate item-theft event and never calls ordinary door theft.

The later game-component consumer must implement `NemesisTakeRoomExit` with
that invariant: respect the plan's selected exit and choose only among eligible
nonselected exits. The standalone Planner needs only regression witnesses that
selecting a normal or Chaos continuation remains unchanged after a random
event.

## Catalog and Authored Protocol

### Catalog ownership

The Hades II catalog owns:

- the one event encounter identity and its F/G/H set placement;
- route-once, spacing, reward-exclusion, interaction, and F/G suppression
  facts;
- H feature capacity reservation;
- the five closed families;
- exact result pools and entered-biome splits;
- response and requiredness facts;
- the trait-trade selection policy;
- the contest result pools;
- the exact missing reward identities and capability flags; and
- the `NemesisEventPickup` lifecycle.

Compiler validation owns closed structural shapes, referenced identities,
response and requiredness invariants, encounter placement, and sole policy
ownership. Catalog tests own exhaustive comparison and mutation coverage for
the audited family/result matrix. Do not duplicate the complete declaration as
a second production policy table, or encode event policy in labels, UI arrays,
room-name switches, or a generic effect language.

### Authored schema 53

Bump the strict project schema from 52 to 53 and the catalog from
`0.34.0-sea-star` to `0.35.0-nemesis-random-events`.

The `52 -> 53` migration is metadata-only. Existing schema-52 files contain no
Nemesis outcome and sparse event state needs no fabricated default. Migrate all
21 named checkpoint files, refresh exact manifest hashes and metadata, and add
strict migration-to-decode-to-canonical-encode coverage. The reusable migration
script remains the public path for user files.

Schema 53 must reject malformed union shapes, duplicate result ownership,
unowned event-generated sites/actions, wrong fixed Triple Gold, incorrect
requiredness, unknown site encodings, and inconsistent active/dormant event
state. It must continue accepting context-invalid but structurally owned
outcomes for repair.

## Simulation, Candidates, Findings, and Workspace

### Simulation chronology

At preparation, record `NemesisRandomEvent` through the same encounter-history
path as its selected phase. At the ranked `interactEncounter` action:

1. capture the exact pre-action history/candidate frontier;
2. assess the authored family, result, response, and trait target;
3. on accepted trait trade, apply the exact removal;
4. resolve the required Nemesis contact; and
5. activate any result pickup action after that source action.

The result itself settles only through its later acquisition action. Optional
results may be omitted. Required accepted-trade results block exit until
settled or validly converted. Free/contest normal pickup uses the same Echo and
Sea Star history semantics as the concrete declaration. No family emits an
encounter-end-effect checkpoint.

### Candidate and finding owners

Add one `NemesisRandomEventAddress` (or equivalently narrow exact phase-child
address) as the stable semantic owner for:

- missing event outcome;
- context-unavailable family/result;
- unavailable trait target;
- invalid response/result combination; and
- H optional count above the effective maximum.

The generated reward remains owned by its ordinary `AcquisitionEntryAddress`
and keeps existing reward/Pom/trait/Time Piece/Sea Star findings. Do not route
those findings back to the event editor.

The event candidate product must survive the existing progressive retained
boundary at the exact blocked source. A later room must not receive event
choices before its own action frontier is reachable.

### Application and React

The application adapts the engine event capability into one contextual editor:

```text
Family
Request or result
Response, when present
Outcome summary
```

The result picker uses engine-published values. One Save dispatches the complete
replacement command; Cancel writes nothing. Retained invalid values remain
visible and selectable for repair.

F/G render this editor beneath the selected encounter phase. H renders Add or
Remove Nemesis under Room Features and places the same editor at the exact
Nemesis Room Timeline row. The generated result is configured in the existing
Acquisitions row, not duplicated inside the event editor.

The workspace projection owns provisional labels and layout. React does not
recognize F, G, H, `Passive`, reward pools, entered-biome thresholds, Common
priority, requiredness, or event site encodings.

The NPC route index remains metadata-driven and gains one representative
random-event entry without duplicating the policy matrix.

## Delivery Gates and Commit Boundaries

### Gate A — catalog and authored protocol

Deliver one coherent catalog/protocol commit containing:

- one event identity and F/G/H placement;
- closed normalized family/result/response/capacity declarations;
- exact missing acquisition identities and producer lifecycle;
- schema 53, strict event codec, exact semantic address, default/reconciliation
  behavior, and atomic outcome command;
- source-neutral generated-pickup projection/reconciliation replacing the
  trait-only assumption; and
- metadata-only migration of all named checkpoints.

Primary tests:

- catalog encounter/reward declaration closure and mutation matrices;
- encounter codec and command tests for every union branch;
- generated-site/action ownership and dormant restoration;
- schema migration, fixture integrity, and canonical round trip; and
- explicit proof that I remains combat-only.

Gate A does not implement settlement UI or broad product fixtures.

### Gate B — simulation and lifecycle integration

Deliver one coherent engine commit containing:

- route-once and six-room spacing across combat/random event;
- F/G incoming-reward suppression with retained bag/source facts;
- H effective capacity, retained over-cap finding, required freely ordered
  interaction, and untouched cage/optional generation;
- exact interaction-frontier candidates and progressive findings;
- all five outcome settlements, trait removal, response-dependent pickup
  activation, and declaration-owned acquisition capabilities; and
- selected-exit preservation with no theft state.

Primary tests:

- one focused engine-owned five-family policy matrix;
- existing field-NPC encounter tests for route/spacing cross-contacts;
- F/G reward bag versus acquisition history;
- H capacity/order/exit blocking and cage preservation;
- trait-trade Common priority/removal/previously-picked retention;
- optional versus required pickup actions;
- Pom/Hammer/Path legality at the ranked interaction frontier; and
- Time Piece, Sea Star, Echo last reward, and no-Artificer representative
  contacts through the generic acquisition path.

Gate B must delete any temporary parallel event settlement or trait-only
generated-pickup consumer left by Gate A.

### Gate C — application, editor, and manifest-backed workflows

Deliver one coherent application/product commit containing:

- F/G event editor projection, binding, focus, and repair;
- H Room Feature projection over Passive encounter selection;
- H effective optional-count control and retained-invalid repair;
- one required freely movable encounter row and ordinary generated acquisition
  rows in Room Timeline; and
- metadata-driven NPC route-index contact.

Create three compact named manifest-backed checkpoints rather than a large
opaque route:

1. F or G trait trade, accepted removal, required Triple Gold, suppressed door
   reward, and unchanged selected normal or Chaos continuation;
2. H four-position Fields room with Nemesis, three optional rewards, the event
   interleaved among cages, and one optional free/contest pickup; and
3. accepted Pom or Hammer trade with a fully authored generated acquisition
   child and representative Time Piece/Sea Star behavior.

Representative product tests cover family editing, Save/Cancel/Undo, exact
finding navigation, H add/remove and over-cap repair, room-action movement,
required/optional result participation, and continuation. They must not copy
the engine's five-family matrix.

### Gate D — durable closure

After independent Gate-C review and the main session's bird's-eye diff review:

- absorb current behavior into the encounter audit and the smallest owning
  catalog/authored/reward/lifecycle/simulation/workspace/biome authorities;
- update `IMPLEMENTATION_PROGRESS.md` with exact gate commits and truthful
  validation evidence;
- update README/schema statements only where the durable current boundary
  requires it;
- remove stale claims that Nemesis random events or their reward suppression
  remain deferred;
- delete this temporary plan; and
- run one complete `npm run check`, recording its exact result before the
  closure commit.

## Review and Validation Routine

Each implementation gate starts from its recorded clean base and uses a fresh
executor. A fresh sibling reviewer then checks the frozen diff against this
plan, the source audit, and the owning authorities. Accepted findings return to
the executor or one narrowly owned remediation worker. The main session keeps
final ownership of scope, finding disposition, holistic diff review, and Git.

Development uses the narrowest owning lanes. Expected closure evidence is:

- `npm run test:catalog` for declaration/compiler work;
- focused authored codec/command/migration/fixture tests;
- focused Nemesis simulation, field-NPC, reward, trait, action, and candidate
  tests;
- `npm run test:planner`, `npm run test:contract`, `npm run test:ui`, and
  `npm run test:product` only for the application contacts changed;
- typecheck, lint, formatting, build, and `git diff --check` in proportion to
  each gate; and
- one complete `npm run check` only at Gate-D phase closure.

Do not repeatedly run the full repository gate during implementation.

## Required Retirement and Explicit Non-Goals

Retire in the completed implementation:

- the comment and tests claiming Nemesis route exclusion is permanently four
  combat variants;
- any F/G/H authority statement that ordinary random events are unmodeled;
- trait-only generated-pickup enumeration, reconciliation, and cleanup
  assumptions superseded by the shared producer authority;
- any duplicate H Passive encounter picker exposed beside the feature control;
  and
- temporary gate terminology in production comments.

Do not add:

- five fake event encounter identities;
- an H-only persisted feature boolean or second room lifecycle;
- a Nemesis-specific pickup state, timeline, settlement kernel, or child
  editor;
- a current-health, Gold, damage, death, or No-Hit-Shield simulator;
- profile/dialogue/RNG state;
- Bridge progression, Shop theft, combat-wager Gold, or 2,000-damage tier;
- persisted door theft or topology mutation;
- Dream Dive support;
- generic interaction/effect DSLs; or
- a broad encounter refactor unrelated to the exact Nemesis contact.
