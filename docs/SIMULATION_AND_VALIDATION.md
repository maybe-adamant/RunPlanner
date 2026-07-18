# Simulation and Validation

## Purpose

This document defines the pure derived pipeline from a normalized catalog and
authored project to canonical simulated facts, lifecycle history, validation,
candidate results, and semantic findings.

The simulator is the app's theory of how supported Hades II route generation
behaves. The later game module will test that theory through runtime auditing;
it will not duplicate it.

## Core Contract

```ts
simulateProject(catalog, authoredProject): ProjectEvaluation
```

The operation is:

- pure with respect to authored state;
- deterministic for the same normalized inputs;
- independent of React, Redux, Tauri, filesystem, and game runtime APIs;
- complete enough to return useful incomplete and invalid results;
- strict about malformed catalogs and violated construction invariants.

The initial implementation performs a full synchronous rebuild after every
semantic edit. Optimization follows profiling rather than speculation.

## Derived Pipeline

```text
normalized catalog + authored project
  -> normalize every configured topology
  -> walk routes and configured biomes in order
      -> completeness gate
      -> canonical biome snapshot
      -> lifecycle event stream
      -> history and counter ledgers
      -> selected-plan validation
      -> candidate evaluation
      -> semantic findings
  -> route and project summaries
```

The established short form remains:

```text
declaration -> catalog -> history -> validator -> feedback
```

Canonical materialization is the bridge between catalog/authored state and
history. Declarations alone cannot produce history because concrete topology,
rewards, purchases, encounters, and selected exits are authored choices.

## Catalog Boundary

The normalized catalog contains immutable possible facts:

- route and biome-step declarations;
- layout variants and structural policies;
- room identity, label, kind, template, exits, eligibility, force, and caps;
- encounter profiles and phase timing;
- local child slots;
- reward primitives, payload domains, stores, bags, bindings, and shops;
- normalized current-run requirements whose kinds have registered evaluators;
- batch and terminal policies.

Catalog construction fails for:

- unknown dispatch keys;
- malformed declarations;
- missing current-run requirement evaluators;
- incompatible defaults;
- reward filters outside their store domains;
- ambiguous declaration ordering where order changes simulation.

Save-file progression, unlocks, world upgrades, active bounty overrides,
traits supplied outside the configured run, and prior-run state remain absent
unless the app later introduces explicit project inputs for them. Missing
research is tracked in audits and fixtures, not generic production
`unsupported` records.

## Topology Normalization

Every configured biome topology crosses a structural contact boundary before
semantic processing. Normalization checks bounded representation and produces
a trusted layout-specific topology.

Malformed topology is a contract error, not an incomplete plan. Examples:

- duplicate occurrence IDs;
- unknown game room names;
- dangling topology references to missing occurrences;
- unreferenced persisted occurrences;
- impossible structural indexes;
- contradictory continuation forms;
- downstream continuation owned by an unpicked target;
- unknown layout or policy dispatch keys.

Structurally representable but context-invalid choices remain normalized and
continue to semantic validation.

Repeated `gameName` values are not malformed topology. Each occurrence is
processed independently while creation, appearance, eligibility, and force
ledgers aggregate by the referenced game declaration where the game rule
requires it.

## Biome Processing Horizon

Configured biomes process in route order.

For each biome:

1. Check structural and referenced-leaf completeness.
2. If incomplete, produce completeness findings and stop semantic processing
   for that route.
3. Materialize one canonical biome snapshot.
4. Append ordered lifecycle events to accumulated route history.
5. Validate selected facts and evaluate candidates.
6. If invalid, retain its snapshot and findings but stop before the next
   biome.
7. If valid, admit it to the validated prefix and continue.

Later authored biomes remain visible to the editor but are marked as blocked
by the earlier biome. They do not receive invented local validity against
history that was never produced.

Biome completion is the materialization gate. An incomplete biome produces no
canonical snapshot and is not sent through contextual validation.

## Completeness

Completeness asks whether authored state can produce concrete facts. It does
not ask whether those facts are legal.

A complete biome requires:

- structurally closed topology from declared entry to terminal transition;
- all required target links and picked or visit-order choices;
- all active terminal target links and their picked choice;
- complete terminal companion links required by policy;
- one complete occurrence record for every referenced top-level room;
- complete active room-local leaf state;
- complete active local child and encounter offer-point state;
- concrete rewards, payloads, shop offers, purchases, and modes;
- complete biome-global and batch-global authored values.

Only referenced occurrences participate. Removed occurrences do not remain as
dormant project state; undo may restore their prior authored snapshot.

Generated unpicked targets participate because their rooms and rewards were
offered by the game. A concrete negative such as `purchased: false` is complete
state.

## Canonical Snapshots

Canonical snapshots contain concrete simulated game facts and semantic return
addresses. They are independent of persisted JSON layout and UI presentation.

Representative linear shape:

```ts
interface CanonicalLinearBiome {
  kind: 'LinearBiome';
  biomeStepKey: BiomeStepKey;
  startRoom: CanonicalRoom;
  batches: CanonicalBatch[];
  terminalEntry: CanonicalTerminalEntry;
  biomeState: CanonicalBiomeState;
}
```

A canonical batch records:

- selected parent occurrence ID and concrete game room name;
- physical generation order;
- every target occurrence, including unpicked dead leaves and repeated game
  room names;
- exit index and picked state;
- resolved concrete incoming offer;
- concrete room-local fragment;
- declaration-derived physical offer facts associated with the materialized
  occurrences;
- semantic addresses for each fact.

A canonical room records authored occurrence ID, concrete game room identity,
resolved encounter phases, room-local state, local children, offers,
acquisitions, and return addresses. It does not copy labels, candidate arrays,
eligibility predicates, or other declaration facts.

The canonical snapshot is not the eventual execution-plan JSON. It is a rich
internal simulation product from which the app can later compile the smallest
runtime document justified by game probing.

## Lifecycle Event Stream

History preserves game timing rather than reconstructing it from final room
aggregates:

```text
room.enter
room.prepare_encounters
room.sequence
room.generate_next
room.commit
biome.complete
```

Encounter profiles emit ordered phase events. A counting combat phase may
produce:

```text
encounter.start
biomeEncounterDepth increment
reward.offer
combat.complete
reward.acquire
encounter.complete
```

Offer and acquisition timing belongs to the encounter or room declaration.
The simulator must not infer it later from a generic reward list.

## Counter and Ledger Axes

These histories remain distinct:

- generated-room creation history includes every picked and unpicked target;
- room appearance history includes entered rooms only;
- `biomeDepthCache` advances from declared committed room-history behavior;
- `biomeEncounterDepth` advances from resolved counting encounter phases;
- route encounter depth counts route-wide counting encounters;
- room-history ordinal supports route-wide spacing rules;
- reward-offer history includes every displayed offer;
- loot/use histories include acquired rewards only;
- pending shop offers represent their bounded active interval;
- unresolved force pressure tracks eligible forced declarations not yet
  generated.

Every rule declares which pre-event or post-event view it reads. A generic row
or room index cannot substitute for these axes.

Important consequences:

- every generated occurrence emits its own creation event even when another
  occurrence references the same game name;
- only picked and entered occurrences contribute appearances;
- `MaxCreationsThisRun` sees generated peers in order;
- `MaxAppearancesThisBiome` sees entered room history, not offers;
- counted reward bags deplete on offer, including unpicked doors;
- loot and use requirements update on acquisition;
- one physical room commit advances `biomeDepthCache` once even when it has
  multiple encounters;
- Clockwork Goal progress changes on acquisition.

## Requirements

Requirements are normalized typed expressions with registered evaluators.
Contacts supply their evaluation phase:

- room eligibility and force at room generation;
- reward bag-entry requirements at reward offer;
- optional encounter presence at its declared decision phase;
- acquisition-gated rules at the acquisition history view.

Boolean composition uses explicit `all`, `any`, and `not` nodes. Evaluators
receive only the typed history view and semantic context they require. They do
not read UI state, project storage, or global runtime objects.

The focused registry evaluates inclusive counter ranges, summed record counts,
active current-room shop option names, the current room's chosen reward,
offered-exit count, current-run flags, and room-history event spacing. Event
spacing preserves the game's peer-generation behavior: no prior event passes,
and an event stamped at the current room-history ordinal does not block another
offer generated from that same room.

Selected facts and candidate projections use the same evaluator functions.
There is no permissive candidate rule beside a stricter selected rule.

## Structural and Eligibility Validation

Validation checks complete canonical facts in lifecycle order:

- start, fixed-entry, terminal, and layout roles;
- physical exits and target compatibility;
- room eligibility at the correct generation point;
- creation and appearance caps on separate ledgers;
- force pressure over complete peer batches;
- encounter profile presence and counter effects;
- selected traversal and visit order;
- specialized biome structures;
- reward domains, payloads, bags, shops, and acquisitions;
- semantic-address uniqueness.

Targets in one generated batch process in physical generation order. Each
creation and offer updates scratch history before the next peer is validated.

Validation never rewrites authored topology, chooses a replacement, or repairs
an invalid selection.

For F/G, repeated ordinary combat game names remain valid construction and are
judged only by their declared current-history rules. For I, repeated preboss
offers will likewise use distinct occurrence identities. The I slice must
define which declined-offer facts materialize without entered-room shop state;
the simulator must not restore the old singleton-control workaround.

## Reward Simulation

`REWARD_MODEL.md` defines reward vocabulary and producer composition. This
section owns the history-dependent simulation of those normalized facts.

The simulator keeps these distinct:

`Reward primitive`
: Concrete reward identity and normalized acquisition metadata.

`Reward store`
: Authoring and domain option set.

`Reward bag`
: Ordered counted multiset copied from a game store.

`Offer point`
: Lifecycle moment producing one or more concrete offers.

`Reward offer`
: Concrete store, reward type, payload, and semantic source.

`Reward acquisition`
: Picked, entered, or purchased reward folded into loot/use history.

`Shop profile`
: Shop option domain; it is not a counted reward bag.

For each counted offer:

1. evaluate remaining bag entries against current history and source filters;
2. identify eligible entries capable of producing the authored offer;
3. refill once only when no entry in the whole bag is eligible;
4. reject unavailable stores or invalid authored rewards explicitly;
5. deterministically consume one compatible counted entry;
6. preserve ineligible and unmatched entries;
7. update acquisition ledgers only if an acquisition event occurs.

Duplicate compatible entries with different downstream behavior require a
declaration-owned deterministic match order.

For F/G forked preboss transitions, each physical terminal target is a
distinct occurrence referencing the same preboss declaration. Every target
emits creation and door-offer facts in physical order. Only the picked target
emits appearance and acquisition; room-internal shop offers and purchases are
active only when the picked realization is the shop target.

## Candidate Evaluation

Candidate domains are declaration-derived and stable. Declaration-impossible
values may be absent. Context-invalid values remain present and receive
semantic invalid results.

For one candidate, simulation:

1. applies an unpublished semantic replacement;
2. rematerializes the smallest affected semantic owner;
3. replays shared validators through the required local horizon;
4. returns findings and evidence;
5. discards scratch state.

Candidate evaluation is added after selected-plan F simulation is correct. It
must reuse materializers and validators rather than creating a parallel rules
engine for UI coloring.

## Findings

A finding contains a generic code, severity, lifecycle phase, semantic origin,
and typed evidence:

```ts
interface Finding {
  code: string;
  severity: 'incomplete' | 'invalid';
  phase?: LifecyclePhase;
  origin: SemanticAddress;
  providerKey?: string;
  candidateKey?: string;
  evidence: Readonly<Record<string, unknown>>;
}
```

Instance identity belongs in `origin`, never in the code:

```text
good: target_room_ineligible + origin Underworld_F/room-01J.../exit2
bad:  f_combat04_other_miniboss_entered
```

Human messages are presentation derived from code and evidence. The simulator
does not embed English UI strings into findings.

Completeness and legality findings use the same address domain. Contract
errors remain a separate result class because they indicate malformed data or
implementation failure rather than correctable user intent.

## Simulation Result

Representative result shape:

```ts
interface SimulationResult {
  routes: ReadonlyMap<RouteKey, RouteSimulation>;
  findings: readonly Finding[];
  candidateResults: CandidateResultIndex;
  summary: ProjectSimulationSummary;
}
```

Each route simulation records:

- normalized authored topology for every configured biome;
- canonical snapshots through the semantic processing horizon;
- accumulated lifecycle events and ledgers;
- biome processing states: validated, invalid, incomplete, or blocked;
- semantic findings indexed by owner;
- whether the route is eligible for future execution-plan compilation.

The complete result is replaced atomically after an authored edit.

## Research Gaps and Conformance

The simulator aims to model supported major game rules faithfully. A missing
one to five percent is handled through disciplined evidence, not permissive
runtime fallbacks.

Use:

- focused game-data audit notes;
- executable fixtures describing the current hypothesis;
- captured future runtime mismatch reports;
- explicit bounded uncertainty only where the game itself permits several
  outcomes relevant to validation.

Do not expose `unsupported` as a generic user-facing production state merely
to remember research work. When an unmodeled rule materially affects a
supported surface, either implement it, remove that surface from the catalog,
or document a narrow known approximation with tests.

## Test Strategy

The simulator is fixture-driven.

Required categories include:

- catalog construction success and contract failure;
- authored command and normalization invariants;
- repeated game names across distinct occurrence IDs;
- one golden project, canonical snapshot, history, and finding set per focused
  biome scenario;
- picked and unpicked peer creation and reward depletion;
- counter timing and pre/post-event views;
- creation versus appearance caps;
- force pressure;
- terminal policies;
- optional encounter phases;
- reward payload and bag-entry provenance;
- downstream retention and explicit destructive commands;
- blocked downstream biome processing;
- determinism: equal normalized inputs produce deeply equal outputs.

Fixtures should be small enough that a reviewer can understand the expected
game story without reverse-engineering generated data.

## Explicit Non-Goals

The initial simulator does not provide:

- vanilla probability distributions;
- Monte Carlo search;
- automatic route optimization;
- runtime game mutation;
- silent approximation of missing current-run rules;
- save-file progression simulation;
- UI layout or component information;
- execution-plan serialization before the app model stabilizes.
