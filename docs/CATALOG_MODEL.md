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
  kind: 'Combat',
  template: 'StandardCombat',
  exits: [{}, {}],
  encounterProfile: 'StandardCombat',
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

- route declarations and ordered biome steps;
- biome layout declarations;
- physical exit-type declarations;
- room declarations;
- room-template descriptors;
- encounter profiles and phase descriptors;
- local child-slot descriptors;
- reward primitives and payload domains;
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

Route declarations own biome order:

```text
Underworld: F -> G -> H -> I
Surface:    N -> O -> P -> Q
```

Each route occurrence has a distinct biome-step key such as `Underworld_F`.

Biome layout declarations own immutable structure:

- layout kind: initially `LinearBiome` or `HubBiome`;
- start alternatives and ordered fixed entry slots, including whether each
  fixed slot is stateless-derived or owns authored room state;
- default continuation policy and structural overrides;
- terminal room and terminal exit policy, including whether the terminal is an
  independent transition or a declaration role admitted by a generated batch;
- ordered fixed-completion rooms with stable semantic roles;
- persistent hub structure where applicable: fixed physical slot identities,
  availability bounds, visit-count rules, restore behavior, and terminal
  trigger;
- declaration-proven topology bounds;
- biome-global authored field descriptors;
- reward-store selection policy: an authored generated-store policy with
  target ratio, adjustment rules, possible base stores, and one authoring
  default; a source-offer-point policy selecting an already-authored semantic
  store; or an explicit no-base-store policy when no generated base outcome is
  observable, including reward-free Q and declaration-overridden I batches.

They do not copy room-local facts such as intrinsic exits, eligibility, caps,
or incoming reward bindings.

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

Completion rooms such as bosses and postboss rooms are concrete derived Room
Declarations rather than simulator constants. They retain their real game
names, encounters, modeled reward surface, counters, exits, and store-history
policy, but have no authored leaf template or editor control. A biome layout
references the rooms it actually uses through an ordered completion sequence
after its editable terminal. The sequence need not contain a postboss room;
Q's canonical repeat-run projection ends after its boss. The route declaration,
not a completion room, remains the authority for biome order or route
completion.

Declarations include only game facts consumed by a canonical product surface.
Automatic boss-specific and weapon-dependent drops are documented evidence but
do not require reward primitives or acquisition projection while no current
validator, simulator rule, editor, or execution instruction consumes them.

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
  -> primitive
  -> store / counted bag / fixed source
  -> producer binding and filters
  -> offer point or room template

biome store policy + room store override
  -> generated-batch and target store resolution
```

A primitive owns its game identity, label, acquisition projection, payload
domain, and complete payload default. The acquisition projection explicitly
states whether history receives the primitive identity, one payload source, or
several payload sources. A store owns its option domain and default primitive.
Counted bags preserve declaration order, multiplicity, entry-level
requirements, and entry-level duplicate policy. Shops use shop profiles rather
than counted bags.

Producer bindings select stores, fixed sources, shop profiles, and positive or
negative filters. A filtered variant does not automatically become a new named
reward surface. Filters must reference concrete types exposed by their source,
and positive/negative sets cannot overlap.

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
shop options, the current room reward, offered exits, event spacing, and flags
as distinct semantic inputs; evaluators do not reconstruct one axis from
another.

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
- every room template receives the fields it requires;
- every room declares exactly one authored or derived mode, and derived rooms
  are referenced only from compatible layout roles;
- every active leaf has a complete deterministic default;
- encounter phases and local slots have unique stable keys;
- requirement trees are typed and supported at their contacts;
- reward sources, filters, payloads, and defaults agree;
- declaration order is explicit wherever simulation consumes order;
- layout bounds can contain every supported authored structure;
- every fixed-completion reference resolves to a derived room in the same
  biome step and completion roles are ordered and unique;
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

## Initial F/G Scope and Declaration Freeze

The first catalog slice should include only the shared foundations and concrete
declarations needed to build meaningful F fixtures, followed by G as the reuse
proof:

- Underworld route and F/G biome-step declarations;
- `LinearBiome` layout metadata;
- opening, standard combat, miniboss, story, fountain, midshop, and terminal
  templates used by F/G;
- required reward primitives, payloads, stores, bags, bindings, and shops;
- required encounter profiles;
- eligibility, force, and cap evaluators exercised by F/G;
- explicit labels and recursive defaults.

Do not declare later biomes fully supported through placeholders. Their route
identity may exist while their catalog capability remains inactive.

The verified H/I/N/O/P/Q game-rule audits and cross-biome reconciliation are
complete. Phase 2.75 imports their declaration-only catalog slices in the
documented pressure-test order. Those slices may extend normalized catalog
vocabulary when concrete game facts require it, but they remain inactive until
their authored topology, simulator, validation, and editor loop is complete.
`biomes/P_GAME_RULES.md`, `biomes/Q_GAME_RULES.md`, `biomes/H_GAME_RULES.md`,
`biomes/O_GAME_RULES.md`, `biomes/I_GAME_RULES.md`, and `biomes/N_GAME_RULES.md` are completed audit
authorities. Their shared vocabulary is reconciled by this design set, so
dormant declaration import may resume without activating later biome loops.

`GAME_GENERATION_RULES.md` owns shared generation behavior.
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
