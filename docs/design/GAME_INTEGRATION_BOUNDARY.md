# Future Game Integration Boundary

## Status

Game integration is deliberately deferred. This document records only the
boundary constraints that the app must preserve while its simulator and editor
stabilize.

It is not an execution-plan schema and does not authorize game-module work.

## Why Integration Is Deferred

The app already has enough verified game rules to build and test the majority
of meaningful route simulation. Designing the runtime payload first would
prematurely constrain the app around assumptions about hooks and transport.

The correct order is:

```text
stable authored model
  -> stable simulation and validation
  -> representative canonical histories
  -> targeted game probes
  -> smallest justified execution-plan document
```

## Eventual Boundary

The app will export a declarative JSON execution plan. It will never export
Lua, callbacks, expressions, or executable code.

The plan is expected to describe semantic desired and predicted facts such as:

- starting room and its configured reward;
- generated exit rooms and their rewards;
- picked exit;
- room-local encounter/reward choices;
- selected Preboss and derived completion realization;
- stable authored occurrence identity beside concrete game names for audit
  reports.

The precise record shape remains deferred until app simulation fixtures show
which facts are actually necessary.

## Future Responsibilities

### App

- author and persist projects;
- simulate routes to the best supported fidelity;
- validate all modeled game rules;
- compile a complete valid simulation into JSON;
- include schema and catalog compatibility information;
- later import structured runtime mismatch reports.

### Game Module

- accept a pasted JSON string;
- decode and validate its transport/schema boundary;
- reject unknown versions, operations, identifiers, and unsafe bounds;
- translate semantic facts through fixed runtime adapters;
- realize the plan's selected concrete encounter definition, including supported
  field-NPC combat, through fixed runtime adapters;
- suppress natural Chaos and unmodeled NPC random, Shop, Bridge, interaction,
  and wager systems while those systems are absent from the execution plan;
- suppress Anomaly replacement while route-structural detours are absent from
  the execution plan;
- compare expected and observed game state at known checkpoints;
- report mismatches without inventing new planning logic.

The game module may verify that referenced identifiers exist in live game data
and that a runtime checkpoint matches the plan. That is contact/conformance
validation, not route simulation.

## Conformance Loop

```text
app hypothesis
  -> simulated and validated plan
  -> JSON execution plan
  -> game execution and observation
  -> structured mismatch report
  -> correct app simulator or document a narrow known divergence
  -> repeat
```

Mismatch records should eventually identify:

- plan and catalog fingerprint;
- stable occurrence, step, or semantic owner;
- game version;
- runtime checkpoint;
- expected value;
- observed value;
- whether the mismatch occurred before or after applying a requested fact;
- relevant bounded event context.

This makes the game an experimental oracle for the app's model rather than a
second source of hidden correction logic.

## App Constraints Preserved Now

Although the payload is deferred, current app design must preserve:

- concrete game room and reward identifiers beside player-facing labels;
- stable occurrence IDs distinct from repeatable game room names;
- physical exit identity and generation order;
- picked and unpicked offers;
- lifecycle ordering;
- semantic owner addresses;
- selected acquisitions versus mere offers;
- deterministic canonical snapshots;
- explicit catalog versioning.

These facts are useful for simulation independently of the future transport
and prevent the editor from becoming the only interpretation of a project.

### Shared v1 suppression and no-action contract

The app's v1 canonical history excludes spontaneous systems whose presence
would otherwise change modeled history:

- natural Chaos generation;
- Anomaly replacement;
- NPC random events, Shop/Bridge appearances, interactions, and wager outcomes.

The future game module must disable these systems unless a later schema
explicitly represents them. It must still realize the exact supported
field-NPC combat definition selected by the plan. Observing an excluded system
during a v1 trace is a conformance mismatch, not permission for the runtime to
reinterpret the plan.

Challenges, wells, gathering points, and rerolls use a no-action contract
instead. They may exist in the world, but the traced player never activates a
challenge, purchases from a well, gathers a resource, or rerolls an offer. If
one of those actions later becomes authored, it must first acquire app-side
simulation and validation semantics.

### Oceanus v1 traversal contract

The v1 G simulator conditions its canonical trace on the authored picked exit
being open and taken immediately. It does not author or simulate optional
locked-exit encounters. Physical target order remains semantic and must not be
silently permuted merely to place the picked target on the first door.

Future protocol work must preserve this trace and audit that the picked exit is
traversable without an unlock encounter. Whether the game adapter realizes
that condition through generation control, a narrower door adapter, or another
verified mechanism remains deliberately undecided until runtime probes justify
the execution schema. A mismatch must be reported rather than repaired by
inventing an extra encounter that the app did not simulate.

## Readiness Gate for Protocol Work

Do not design the concrete execution schema until:

- F and G authored projects round-trip through project persistence;
- representative F/G plans produce stable canonical snapshots and histories;
- their selected facts and rewards validate correctly;
- the app can explain findings through semantic addresses;
- at least one complete F plan is suitable for a manual game trace;
- known simulation gaps affecting that trace are enumerated.

At that point, probe the game module's actual minimum input needs and derive
the protocol from evidence.

## Security and Transport Constraints

The future transport remains data only:

- plain canonical JSON first;
- strict decoder and bounded collections;
- no dynamic evaluation;
- no class/type reconstruction from untrusted names;
- no arbitrary filesystem paths or commands;
- no silent schema coercion;
- optional prefix, compression, or checksum only when clipboard evidence
  justifies them.

The app's editable project document and the exported execution plan remain
different schemas. Incomplete projects can be saved; they cannot be exported
for execution.

## Explicitly Deferred

- exact JSON execution-plan schema;
- clipboard wrapper or compression;
- game hook selection;
- exact runtime mechanism that realizes G's open-picked-exit baseline;
- exact runtime adapters that realize selected combat definitions and suppress
  natural Chaos, Anomaly replacement, and unmodeled NPC event systems;
- runtime command handlers;
- strict versus diagnostic mismatch policy;
- automatic diagnostic import;
- catalog fingerprint algorithm;
- game module UI beyond the likely paste/status surface.
