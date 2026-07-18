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
chooses concrete values from those facts. The simulator determines their
history and legality.

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
- start alternatives or fixed entry sequence;
- default continuation policy and structural overrides;
- terminal room and terminal exit policy;
- persistent hub structure where applicable;
- declaration-proven topology bounds;
- biome-global authored field descriptors.

They do not copy room-local facts such as intrinsic exits, eligibility, caps,
or incoming reward bindings.

Concrete structural extensions for F through Q should be added with their
implementation slice and covered by focused fixtures. A biome is not declared
supported merely because its letter appears in the route order.

## Room Declarations

Every supported concrete room declaration owns:

- stable game room name;
- explicit player-facing label;
- kind and room-template key;
- intrinsic physical exits and exit constraints;
- eligibility requirements;
- force behavior;
- creation and appearance caps;
- encounter-profile key;
- incoming reward binding;
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

`gameName` and `label` are separate required values. The game name persists in
semantic choices or translation data; the label is presentation. UI must not
derive labels from internal identifiers.

## Encounter Profiles

Encounter profiles own the baseline ordered room sequence:

- stable phase keys;
- phase kind and optional presence;
- concrete baseline encounter identity;
- `biomeEncounterDepth` effect;
- lifecycle timing;
- phase-owned reward offer points;
- the named point at which optional presence is decided.

Rooms reference profiles instead of copying phase sequences. This is required
for O multi-encounter rooms and future persistent NPC replacement. A future NPC
assignment may replace an addressed phase before simulation; history consumes
the resolved phase sequence rather than baseline plus a side channel.

## Reward Declarations

Reward declarations compose bottom-up:

```text
payload domain
  -> primitive
  -> store / counted bag / fixed source
  -> producer binding and filters
  -> offer point or room template
```

A primitive owns its game identity, label, normalized acquisition identity,
payload domain, and complete payload default. A store owns its option domain
and default primitive. Counted bags preserve declaration order and entry-level
requirements. Shops use shop profiles rather than counted bags.

Producer bindings select stores, fixed sources, shop profiles, and positive or
negative filters. A filtered variant does not automatically become a new named
reward surface. Filters must reference concrete types exposed by their source,
and positive/negative sets cannot overlap.

Defaults follow semantic ownership. Option ordering is not a default.

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
- every active leaf has a complete deterministic default;
- encounter phases and local slots have unique stable keys;
- requirement trees are typed and supported at their contacts;
- reward sources, filters, payloads, and defaults agree;
- declaration order is explicit wherever simulation consumes order;
- layout bounds can contain every supported authored structure;
- labels and game identifiers are both present;
- every game room name uniquely identifies one Room Declaration.

Normalized maps and arrays are immutable. Stable declaration order must not
depend on JavaScript object iteration when order changes game behavior.

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

## Initial F/G Scope

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

`F_G_GAME_RULES.md` is the concrete cross-room authority for this slice, and
`F_G_ROOM_TEMPLATES.md` defines the template contracts those declarations must
satisfy. `MIGRATION_PROVENANCE.md` records which exact facts still require
direct game-data verification while being ported.

## Audit Workflow

For each declaration family:

1. inventory the old app/module facts;
2. identify the relevant game-data source;
3. resolve inconsistencies before authoring;
4. write explicit TypeScript declarations;
5. normalize and validate them;
6. add readable focused fixtures;
7. record deliberate divergence or simplification;
8. review the complete declaration at its source location.

Game-data audits answer behavior questions. They do not become production
branches or permanent `unknown` fields.
