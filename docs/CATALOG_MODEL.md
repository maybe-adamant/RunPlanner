# Catalog Model

## Purpose

This document defines how verified Hades II facts enter the app as explicit
declarations and become the immutable normalized catalog consumed by authored
projects and simulation.

It owns declaration families, provenance, normalization policy, requirement
scope, labels, defaults, and catalog versioning. It does not own concrete
authored choices or lifecycle simulation algorithms.

## Catalog Principle

The catalog describes possible supported game facts. The authored project
chooses concrete values from those facts. The simulator derives the support
set at each decision and determines whether the authored value is a member.
Multiplicity and ratios are retained only where they affect support, forced
outcomes, or later state; they are never converted into likelihood scores.

```text
game data and verified audits
  -> explicit raw declarations
  -> strict normalization
  -> immutable Catalog
  -> authored project + simulator
```

There is one application catalog authority. Do not maintain parallel
hand-authored TypeScript and Lua catalogs. During migration, Lua declarations
are evidence; after parity tests are accepted, TypeScript declarations in this
project become the app authority.

## Modeling Dispositions

Biome audits distinguish verified game behavior from the planner projection.
Every behavior relevant to planner outputs receives one of four dispositions:

`Exact`
: The canonical model preserves the relevant game distinction and its effects.

`Simplified`
: The distinction exists in the game, but alternatives are intentionally
collapsed because they produce the same modeled history, counters, rewards,
eligibility, and validation result.

`Deferred`
: The distinction can change modeled facts, but its required authored or
simulation feature is planned for a later slice. The active baseline must say
how the behavior is suppressed or conditioned until then.

`Excluded`
: The behavior is deliberately outside the current product input and output
surface, such as save-profile progression, dream-run variants, or room
presentation. Exclusion is documented and may be reconsidered later, but
does not create production `unsupported` state.

A simplification is valid only while all collapsed alternatives are
observationally equivalent to every current canonical consumer. Each
simplification records the feature that would force reconsideration. If two
alternatives differ on a currently modeled fact, they must be modeled exactly
or marked deferred; they cannot be called simplified.

These dispositions describe product intent, not delivery progress.
`MIGRATION_PROVENANCE.md` separately records whether a projection is only
documented or is already declared, authored, simulated, and presented.

## Evidence Sources

Declaration work uses:

- game scripts under `../../1GameData/Scripts/` as primary behavioral evidence;
- focused audits and revamp documents under the previous Run Planner module as
  interpreted evidence;
- targeted in-game probes when scripts are ambiguous or behavior depends on
  engine implementation;
- future structured conformance reports once a game-module auditor exists.

Every surprising simplification or divergence from vanilla should be recorded
near its declaration family or in a focused audit document. Straightforward
copied facts do not need verbose provenance comments on every line.

## Raw and Normalized Layers

Raw declarations favor readability and game-data auditability. Normalized
records favor complete typed consumption.

```ts
const F_Combat04 = {
  gameName: 'F_Combat04',
  label: 'Combat 04',
  biomeKey: 'F',
  kind: 'Combat',
  mode: { kind: 'authored', templateKey: 'StandardCombat' },
  structuralTags: [],
  exits: [
    { index: 1, type: 'ErebusExitDoor' },
    { index: 2, type: 'ErebusExitDoor' },
  ],
  encounterProfileKey: 'StandardCombat',
  incomingReward: {
    kind: 'countedChoice',
    stores: ['RunProgress', 'MetaProgress'],
  },
  caps: {
    maxAppearancesThisBiome: 1,
  },
} satisfies RawRoomDeclaration;
```

Normalization resolves references, inherits shared verified facts where the
raw declaration format permits it, installs explicit semantic defaults, and
produces immutable indexed records. Consumers never need to interpret raw
inheritance or optional shorthand.

Compact helpers may remove syntax repetition only when the complete room
surface remains readable at its declaration point. Avoid metaprogramming that
requires executing several layers of builders to discover a room's exits,
reward binding, or eligibility.

## Declaration Families

The catalog contains at least:

- route declarations and ordered biomes;
- biome layout declarations;
- physical exit-type declarations;
- room declarations;
- room-template descriptors;
- encounter profiles and phase descriptors;
- reusable room lifecycle profiles, closed operations, and declaration-owned
  effect references;
- local child-slot descriptors;
- reward types, payload domains, and offer projections;
- reward source-support policies and semantic resolution points;
- concrete acquisition declarations and history projections;
- reward stores and counted bags;
- reward producer bindings and filters;
- shop profiles;
- requirement expressions;
- batch and terminal policy descriptors;
- player-facing labels beside stable game identifiers.

Implementations for materializers, evaluators, and projectors live in code
registries outside declaration records. A declaration selects a known semantic
kind; it does not contain callbacks.

## Route and Layout Declarations

Global Biome Declarations own stable game-domain identity and player-facing
labels. Route declarations own only ordered references to those biomes:

```text
Underworld: F -> G -> H -> I
Surface:    N -> O -> P -> Q
```

A biome key is never route-qualified: rooms and layouts for Erebus reference
`F`, not `Underworld_F`. The same Biome Declaration may appear in more than one
route. The current route model rejects the same biome twice within one route;
if that product case becomes real, a separate route-placement identity will be
added without changing global biome identity.

Biome layout declarations own immutable structure:

- layout kind: initially `LinearBiome` or `HubBiome`;
- start alternatives and ordered fixed entry slots, including whether each
  fixed slot is stateless-derived or owns authored room state;
- default continuation policy and structural overrides;
- continuation progression policy: eligibility-driven, fixed-count, or an
  ordered staged candidate-pool sequence;
- generated-batch policy: standard, Fields cage, or Clockwork, with any
  policy-owned authored fields declared beside that policy;
- terminal room and terminal exit policy, including whether the terminal is an
  independent transition or a declaration role admitted by a generated batch;
- ordered fixed-completion rooms with stable semantic roles;
- persistent hub structure where applicable: fixed physical slot identities,
  availability bounds, visit-count rules, restore behavior, and terminal
  trigger;
- declaration-proven topology bounds;
- biome-global authored field descriptors;
- reward-store selection policy: an authored generated-store policy with the
  normalized game-language `targetMetaRewardsRatio` and
  `targetMetaRewardsAdjustSpeed`, possible base stores, and one authoring
  default; a source-offer-point policy selecting an already-authored semantic
  store through a closed selector such as `lastActiveWheel`; or an explicit
  no-base-store policy when no generated base outcome is observable, including
  reward-free Q and declaration-overridden I batches.
- optional source-encounter-profile overrides for the generated-store policy;
  O uses this structural mapping so ShipCombat sources resolve their final
  active wheel while non-ShipCombat sources retain the authored default;

They do not copy room-local facts such as intrinsic exits, eligibility, caps,
or incoming reward bindings.

They also do not own the transition after completion. The containing route's
ordered biome references determine whether history advances to another biome
or completes the route.

Concrete structural extensions for F through Q should be added with their
implementation slice and covered by focused fixtures. A biome is not declared
supported merely because its letter appears in the route order.

For `HubBiome`, layout declarations own the fixed mapping from semantic hub
slot to concrete Room Declaration. Authored state selects a supported open set
and visit order; it does not replace the room assigned to a physical slot.
Room-local side-slot descriptors remain facts of the concrete parent Room
Declaration. N side slots own an availability rank because generation pressure
forces a prefix of physical setup order. Their rewards resolve as one jointly
validated unordered batch before player entry; observed engine reward order is
execution evidence, not catalog authority. Authored player entry order remains
a separate trace axis.

## Room Declarations

Every supported concrete room declaration owns:

- stable game room name;
- explicit player-facing label;
- kind and explicit authoring mode;
- a room-template key when the room has authored leaf state, or a derived
  classification when the layout materializes it without editor state;
- structural game tags used by topology and target compatibility;
- intrinsic physical exits and exit constraints;
- eligibility requirements;
- force behavior;
- creation and appearance caps;
- encounter-profile key;
- modeled incoming reward binding;
- any declaration-selected derived realization policy and its complete dormant
  leaf default;
- any intrinsic forced or individual reward-store override used during
  generated-batch resolution;
- its entered-room reward-store history policy: use the resolved offer store,
  record one fixed store, or record no store contribution;
- explicit room-local child descriptors where applicable;
- complete semantic leaf defaults required by its template.

Room declarations do not own:

- topology links;
- picked state;
- generated peers;
- current authored rewards;
- UI grouping or component layout;
- copied encounter phases;
- runtime instructions.

A bounded reward-slot descriptor owns stable physical slot keys, the raw map
capacity, the effective maximum clamped to the modeled slot surface, and one
normalized counted-reward binding. The occurrence persists a complete value
for every stable slot. Batch context may activate only a prefix; it never
deletes or relocates the dormant values.

Completion rooms such as bosses and postboss rooms are concrete derived Room
Declarations rather than simulator constants. They retain their real game
names, encounters, modeled reward surface, counters, exits, and store-history
policy, but have no authored leaf template or editor control. A biome layout
references the rooms it actually uses through an ordered completion sequence
after its editable terminal. The sequence need not contain a postboss room;
Q's canonical repeat-run projection ends after its boss. The route declaration,
not a completion room, remains the authority for biome order or route
completion.

The completion descriptor also owns an ordered closed transition-effect list.
Every current biome explicitly resets `biomeDepthCache` followed by
`biomeEncounterDepth` after its completion rooms. Route encounter depth and
room-history ordinal are deliberately absent from that list and survive the
transition. The simulator walks these declarations; it does not hide a generic
reset inside room exit or route composition.

Declarations include only game facts consumed by a canonical product surface.
Automatic boss-specific and weapon-dependent drops are documented evidence but
do not require reward types, concrete acquisition declarations, or history
projections while no current validator, simulator rule, editor, or execution
instruction consumes them.

Reward-store history policy is explicit because visible reward kind is not
enough to infer it. A generated fixed Story or Shop can record the store
resolved for its offer, a G or P boss can record the store resolved for its
linked outgoing-door offer, an F boss can ignore its forced reward for
store-ratio history, and a postboss contributes no store. These distinctions
must not become simulator room-name conditions.

`gameName` and `label` are separate required values. The game name persists in
semantic choices or translation data; the label is presentation. UI must not
derive labels from internal identifiers.

## Physical Exit Types

Physical exit declarations retain the game exit type and reference a normalized
exit-type policy. The policy may constrain candidate targets from both source
and target facts. For example, P requires both of these declarative rules:

- an Olympus Outdoor exit always requires an `Outdoor` target;
- an Olympus Indoor exit requires an `Indoor` target only when its source room
  is `Outdoor`.

Candidate construction resolves that policy from the source Room Declaration
and candidate Room Declaration. It must not duplicate the result as a fake
room eligibility range or dispatch on door-name strings in the simulator.
Unconstrained F/G exit types still receive explicit normalized policies rather
than relying on a missing-policy fallback.

## Encounter Profiles

Encounter profiles own the baseline ordered room sequence:

- stable phase keys;
- phase kind and optional presence;
- canonical modeled encounter identity when exact identity is relevant;
- `biomeEncounterDepth` effect;
- lifecycle timing;
- phase-owned reward offer points;
- the named point at which optional presence is decided.

Rooms reference profiles instead of copying phase sequences. This is required
for O multi-encounter rooms and future persistent NPC replacement. A future NPC
assignment may replace an addressed phase before simulation; history consumes
the resolved phase sequence rather than baseline plus a side channel.

An encounter profile is a canonical planner projection, not necessarily a
transcription of every internal game encounter. Internal phases may collapse
when they are intentionally simplified under the disposition contract. O and
future NPC composition may require real ordered phases because their phases
change modeled rewards or counters; P's baseline does not require them merely
because the game internally uses them.

## Reward Declarations

Reward declarations compose bottom-up:

```text
payload domain
  -> reward type
  -> resolved reward offer
  -> store entry / fixed source / shop option
  -> counted bag / shop group
  -> producer binding and filters
  -> offer point or room template

resolved reward offer + offer point
  -> generic offer event + optional reward-type offer projection

resolved reward offer + reward-type acquisition roles + producer lifecycle
  -> concrete acquisition event
  -> history projection

biome store policy + room store override
  -> generated-batch and target store resolution
```

A reward type owns its picker/offer identity, label, payload domain, complete
offer default, optional offer projection, optional source-support policy and
resolution point, and named acquisition roles. Each role uses the closed self,
fixed, or typed-payload-source resolver vocabulary. A store entry separately
owns multiplicity position, requirements, duplicate policy, and the reward type
it can resolve. A resolved offer retains that reward type and its complete
payload.

Source support uses a closed registry rather than reward-name switches. The
initial policies are `ordinaryBoonPeer`, `ordinaryNoPeer`, and
`devotionAcquiredPair`. Their declared resolution point determines whether
support is checked while materializing the offer or at one addressed
acquisition role. Catalog normalization rejects a source-bearing payload with
no policy or a policy paired with an incompatible resolution point.

An offer projection owns reward-type-specific current-run writes caused by
materializing an offer. The initial vocabulary contains only
`devotionSpacing`; common offer history, counted-entry consumption, and peer
constraints remain offer-point behavior rather than repeated declaration data.

A concrete acquisition declaration owns one most-concrete game identity and
its typed game-history projection. Producer and encounter declarations bind
reward-type acquisition roles to explicit lifecycle points. Blind Box retains
its authored source while validating and emitting it only after purchase.
Acquisition history changes only when the corresponding concrete acquisition
event occurs. No declaration uses a generic `acquiredAs` alias.

Counted bags preserve declaration order, multiplicity, entry-level
requirements, and entry-level duplicate policy. The shared picker owns any
refill behavior. Shops use ordered shop groups with offer counts and per-option
requirements rather than counted bags. Each shop profile also declares its
ordered emitted slots with stable keys, labels, owning groups, and explicit
default option entries; slots are not inferred from option order.

Producer-lifecycle profiles remain separate from reward types. Each profile
enumerates its supported reward types, supplies complete default role timing,
and declares exact per-type overrides where timing differs. Normalization
rejects unknown or duplicate supported types, overrides outside the profile,
and any lifecycle that fails to bind every acquisition role exactly once.

Producer bindings select stores, fixed sources, shop profiles, and positive or
negative filters. A filtered variant does not automatically become a new named
reward surface. Filters must reference concrete types exposed by their source,
and positive/negative sets cannot overlap. If filtering removes a referenced
store's ordinary default, the raw binding must explicitly select an allowed
default reward type from that same store; normalization never guesses the
first remaining option.

Defaults follow semantic ownership. Option ordering is not a default. A
producer binding describes the reward domain that a room can accept; it does
not make the room leaf the authority for the generated batch's active store.

The exact producer vocabulary, F/G bindings, shop distinction, and
offer/acquisition contract are defined in `REWARD_MODEL.md`. This document owns
their declaration and normalization boundary rather than repeating those
behavioral meanings.

## Requirement Scope

Production declarations include current-run facts that the authored project
and simulator can evaluate:

- room creation and appearance history;
- biome and route depth counters;
- room-history spacing;
- encounter history;
- generated peer and exit context;
- reward offers and acquisitions;
- loot, use, and biome-use ledgers;
- force pressure;
- shop intervals;
- creation and appearance caps.

Production declarations omit facts that depend only on external profile or
save state unless the app later introduces an explicit modeled input:

- story progression and prior-run completion;
- unlocks and world upgrades;
- active bounty overrides;
- current traits, aspect, or familiar chosen outside the project;
- unrelated save-file inventory.

An unknown current-run predicate or missing evaluator is a catalog contract
failure. External-state omission is not a fallback for unfinished current-run
support.

The current-run evaluator registry is total over the normalized requirement
expression union. Catalog normalization rejects a kind absent from that
registry, and extending the union without extending the registry is a compile
failure. Evaluation context keeps counters, acquired-history records, current
shop options, the current room reward, offered exits, current-batch room order,
Clockwork progress, event spacing, and flags as distinct semantic inputs;
evaluators do not reconstruct one axis from another. I uses generic current-
batch count/room-count predicates for peer order and exclusion, plus typed
Clockwork goal and non-goal-capacity predicates. Room-specific validation codes
or instance-shaped predicate names are not part of the declaration language.
Evaluating a Clockwork predicate without Clockwork facts is a contract failure,
not an ordinary ineligible result.

## Declaration and Occurrence Identity

The catalog contains exactly one Room Declaration for each unique `gameName`.
That uniqueness does not constrain authored room occurrences.

The authored project may create several occurrences that reference the same
Room Declaration. This models repeated generated offers directly, including
an unpicked `F_Combat04` followed by a later picked `F_Combat04`. Each
occurrence owns separate authored leaf state and receives a distinct semantic
address.

The catalog therefore does not provide spare compatible room allocation or a
pool-capacity proof for canonical substitution. It provides the actual game
facts needed for simulation:

- creation and appearance caps;
- eligibility and force;
- physical exits;
- reward binding;
- template and room-internal behavior.

The simulator applies those facts to occurrence history. Structural singleton
roles remain layout rules rather than a global prohibition on repeated game
names.

## Normalization Obligations

Catalog construction must verify:

- every referenced key exists;
- every semantic kind has a registered implementation;
- every lifecycle profile uses registered operation kinds and every declared
  lifecycle effect has a registered pure implementation;
- every room template receives the fields it requires;
- every room declares exactly one authored or derived mode, and derived rooms
  are referenced only from compatible layout roles;
- every active leaf has a complete deterministic default;
- encounter phases and local slots have unique stable keys;
- requirement trees are typed and supported at their contacts;
- reward sources, filters, payloads, and defaults agree;
- every source-bearing payload selects a registered source-support policy and
  compatible offer- or acquisition-role resolution point;
- counted entries declare duplicate behavior and shops declare valid
  without-replacement group cardinality;
- shop slots exactly realize group offer counts, own unique stable keys and
  labels, and select distinct valid defaults within a multi-offer group;
- every offer projection selects a registered closed semantic kind;
- concrete acquisition history projections reference valid ledgers;
- every producer lifecycle binding references a role declared by the reward
  type, and every role resolves a valid fixed, self, or typed payload-derived
  concrete acquisition;
- every producer-lifecycle profile enumerates its supported reward types and
  expands to one complete lifecycle for every supported role;
- every supported concrete acquisition selects exactly one audited
  `lootAndUse` or `consumableAndUse` projection profile independently of its
  acquisition kind;
- declaration order is explicit wherever simulation consumes order;
- layout bounds can contain every supported authored structure;
- every fixed-completion reference resolves to a derived room in the same
  biome and completion roles are ordered and unique;
- labels and game identifiers are both present;
- every game room name uniquely identifies one Room Declaration.

Normalized maps and arrays are immutable. Stable declaration order must not
depend on JavaScript object iteration when order changes game behavior.

Leaf activation follows lifecycle rather than declaration presence. Incoming
and free-reward leaves are active when their door offer exists; a shop leaf is
active only when its occurrence is picked for entry. Catalog defaults must be
complete for either activation point without forcing entry-only state onto an
unpicked occurrence.

## Catalog Versioning

The normalized catalog exposes a version or fingerprint suitable for project
compatibility checks. The initial implementation may use an explicit catalog
version updated with semantic declaration changes. A content fingerprint can
replace or supplement it later.

Project loading distinguishes:

- exact compatible catalog;
- supported project migration;
- incompatible catalog requiring explicit user action.

Do not silently reinterpret an existing project after a declaration change
that alters its semantic meaning.

The future game execution artifact will carry catalog compatibility data, but
its exact algorithm remains deferred.

## Product Capability Boundary

Catalog presence and product activation are separate facts. Application
composition derives the declared biome set from route-placed normalized layouts and
owns explicit authorable, simulatable, and editable sets. Room, layout, and
route declarations do not carry those product flags.

The closed Phase 2.8 capability matrix is:

- F and G are authorable;
- F is editable;
- no biome is simulatable.

Phase 3 promotes F alone to simulatable after its public project simulator and
golden closure pass. The Phase 2.8 authorable/editable sets and every dormant
later-biome capability remain unchanged.

P, Q, H, O, I, and N are also declaration-complete in the normalized catalog,
but they are not authorable, simulatable, or editable. Their presence proves
that declaration coverage and product activation remain independent.

Every active capability must reference a declared biome, and every
editable biome must also be authorable. Project creation and loading, semantic
command dispatch, simulator dispatch, and editor navigation are
application contact points that consume this matrix. Pure catalog construction,
project codecs, and structural declarations remain capability-agnostic.

Adding a dormant declaration therefore expands the catalog without making that
biome selectable, persistable in an application project, simulatable, or
visible as an editor entry. Activation is a deliberate composition change made
only when that product loop is complete.

## Initial F/G Scope and Declaration Freeze

The first catalog slice should include only the shared foundations and concrete
declarations needed to build meaningful F fixtures, followed by G as the reuse
proof:

- global F/G Biome Declarations and their Underworld route references;
- `LinearBiome` layout metadata;
- opening, standard combat, miniboss, story, fountain, midshop, and terminal
  templates used by F/G;
- required reward types, payloads, concrete acquisitions, stores, bags,
  bindings, and shops;
- required encounter profiles;
- eligibility, force, and cap evaluators exercised by F/G;
- explicit labels and recursive defaults.

Do not declare later biomes fully supported through placeholders. Their route
identity may exist while their application capabilities remain inactive.

The verified H/I/N/O/P/Q game-rule audits, dormant imports, and cross-biome
closure are complete. Those slices extend normalized catalog vocabulary only
where concrete game facts require it, and remain inactive until their authored
topology, simulator, validation, and editor loop is complete.
`biomes/P_GAME_RULES.md`, `biomes/Q_GAME_RULES.md`, `biomes/H_GAME_RULES.md`,
`biomes/O_GAME_RULES.md`, `biomes/I_GAME_RULES.md`, and `biomes/N_GAME_RULES.md` are completed audit
authorities. Their shared vocabulary is reconciled by this design set; future
activation must complete one biome product loop without reopening declaration
ownership.

`GAME_GENERATION_RULES.md` owns shared generation behavior.
`ROOM_LIFECYCLE_MODEL.md` owns the ordered operations that turn an entered
occurrence into one composable history fragment.
`biomes/F_GAME_RULES.md` and `biomes/G_GAME_RULES.md` own their concrete biome facts, while
`biomes/F_G_ROOM_TEMPLATES.md` defines the template contracts their declarations must
satisfy. `MIGRATION_PROVENANCE.md` records which exact facts still require
direct game-data verification while being ported.

## Audit Workflow

For each declaration family:

1. inventory the old app/module facts;
2. identify the relevant game-data source;
3. resolve inconsistencies before authoring;
4. record each relevant fact's Exact, Simplified, Deferred, or Excluded
   disposition and reconsideration trigger;
5. write explicit TypeScript declarations for the chosen projection;
6. normalize and validate them;
7. add readable focused fixtures;
8. update implementation coverage separately from modeling disposition;
9. review the complete declaration at its source location.

Game-data audits answer behavior questions. They do not become production
branches or permanent `unknown` fields.
