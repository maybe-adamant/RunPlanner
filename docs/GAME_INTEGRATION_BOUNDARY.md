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
- terminal realization;
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
- runtime command handlers;
- strict versus diagnostic mismatch policy;
- automatic diagnostic import;
- catalog fingerprint algorithm;
- game module UI beyond the likely paste/status surface.
