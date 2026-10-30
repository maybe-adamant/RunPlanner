# Engine Consumers

The planner engine is a platform with declared entries. This document owns who
consumes it, which entry answers which question, how a consumer builds a plan,
and how a new export is added and enforced. What the engine's products mean
belongs to the [engine guide](SIMULATION_AND_VALIDATION.md) and the
specialist authorities it routes.

## Consumers

The package graph is one direction:

```text
hades2-catalog → engine ← draft ← run-import ← apps/planner
```

| Consumer                             | Uses the engine to                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `hades2-catalog`                     | Compile game declarations into the engine's catalog contract; it reads the contract entries only |
| `@run-planner/draft`                 | Draft a random valid route ([Draft Mode](DRAFT_MODE.md)) and repair one issue for the run import |
| `@run-planner/run-import`            | Turn a recorded run into an authored project; it publishes the run record as its own entry       |
| Planner application (`apps/planner`) | Compose, edit, display, save and publish projects ([Editor Model](EDITOR_MODEL.md))              |

The engine imports none of them. A consumer owns its own policy (Draft's
steering, the import's reading of the record, the editor's presentation) and
no game legality.

## Entry Tiers

Each engine entry answers one kind of question. A consumer imports only these
entries, never a deep path.

| Tier                   | Entry                               | Answers                                                                                                                                           |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog contract       | `./catalog-schema`                  | What the normalized catalog declares, and static facts read from it                                                                               |
| Kernel contracts       | `./requirements`, `./reward-kernel` | The requirement and reward vocabulary declarations use, and declaration-level offer facts that need no reached state                              |
| Authored model         | `./authored-project`                | What a project persists: model, addresses, codecs, defaults, semantic commands, the Draft settings, and read-only queries over authored structure |
| Read-only queries      | `./simulation`                      | What an authored snapshot means: evaluation, assemblies, findings and readiness, the candidate session, run-state snapshots and named queries     |
| Programmatic authoring | `./authoring`                       | How a consumer builds a plan command by command: the authoring session and carrier-child completion                                               |
| Publication            | `./execution-plan`                  | The execution document published to the game module and its codec                                                                                 |

Only the application publishes; Draft and the run import stop at an authored
project. The catalog never reaches past the contract tiers.

## Building Plans

Two paths settle a command, and both go through edit settlement, so a
consumer never applies a structural command without its delivery, pickup and
required-action reconciliation.

- **Interactive history.** The application settles each user edit with
  `settleProjectEdit` against the published assembly and publishes the result
  to history; a settlement fault is published beside the assembly
  ([edit settlement](SIMULATION_AND_VALIDATION.md#the-evaluation-pipeline)).
- **Programmatic building.** Draft and the run import hold one authoring
  session from `createAuthoringSession`: a cursor over the current settled
  assembly, its candidate session (prepared once per assembly), one command
  applied at a time, a restore to a saved or outside assembly, and a probe
  that runs speculative work and restores the session afterwards.

Applying a command either keeps the settled assembly or refuses it with one of
four kinds:

| Refusal      | Meaning                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------- |
| `command`    | The command authority refused the command before anything was evaluated                     |
| `rerollPool` | A new reroll spend the fixed pool cannot pay, judged once the edit is evaluated             |
| `unchanged`  | Settlement left the authored project as it was                                              |
| `newFinding` | Under the stricter admission, the edit would add a finding the assembly did not have before |

A new finding is one whose code and semantic origin the earlier assembly
lacked; an owner whose evidence changed is not new. A refusal leaves the
session where it was.

Faults are engine defects, never authoring outcomes. A settlement fault rides
beside the applied assembly and is kept as settlement returned it; Draft and
the import keep the command and report the fault: the import as a report entry
at the fault's owner, Draft in its drafted result beside the commands the plan
kept. Any other contract error
raised after evaluation is thrown, not converted into a refusal.

## Alternatives and Hypotheticals

A consumer asks the engine what is possible; it never decides it.

- Alternatives come from the candidate session and the named queries over an
  exact assembly. A consumer never builds simulation state, calls a
  requirement check directly, or re-derives chronology, keepsake, level,
  inventory or reward-store facts from its own reading of the project.
- Run-state facts a consumer needs come from engine queries: the snapshot an
  assembly published at a checkpoint (undefined where coverage did not reach
  it), the held keepsake ranks, the trait inventory at a snapshot, the
  keepsakes after the current keepsake advances, and a level-resolution
  screen's guess at the screens a reroll replaced.
- Hypothetical questions are engine-owned queries; the consumer supplies only
  its choice policy or its observation:
  - **Carrier-child completion** authors every selected-outcome child an offer
    raises from that child's engine domain, taking the first value that
    settles. The consumer's choice orders each domain, says which traits a
    child may add to the run, and which it prefers; preference reorders a copy
    of the ordered values. The import takes engine order; Draft its seeded
    order and steering.
  - **Route-start trait requirements** judge a trait's loadout-decidable
    requirements against the traits held at the reached route start plus a
    consumer-assumed set, and name the requirement kinds the route start cannot
    decide. They also publish the held traits with their counts and the cores a
    god's fresh first offer holds. Draft's static basket refusals read them.
  - **Observed encounters** invert a phase as a played run saw it into the
    customization that replays it, or the reason none does
    ([Encounter Preparation](ENCOUNTER_PREPARATION.md#generated-composition)).

## Adding an Export

An export exists for a consumer that needs it now.

- Name its owner (the engine authority whose policy it answers), its tier
  (which entry), and its primary test beside that owner.
- Prefer a named query that answers the consumer's question over exposing the
  internal state or helper the engine uses to answer it. Wrap a capability
  rather than exporting a free function that needs engine context the
  consumer would have to assemble.
- Land the export in the same commit as the consumer that first imports it; an
  export-only commit is not a slice.
- A consumer's own reusable product (the run record, Draft's issue repairer)
  is published by that consumer's package, not by the engine.

## Enforcement

- **ESLint** bans, by import specifier, for each consumer package's source
  and tests, planner application, platform and deep engine imports and the
  catalog implementation in source (tests may construct a catalog). Draft
  additionally may not import the run import, and the engine may import none
  of its consumers.
- **The planner's package boundary architecture test**
  (`apps/planner/test/architecture/packageBoundaries.test.ts`) owns relative
  escapes and dependency direction: every engine specifier is a declared
  entry, the relative imports of every package and the application stay inside
  their own root, the package graph follows the direction above, and every
  import is a declared dependency. The pure package import graph test keeps
  each consumer package's source free of runtime import cycles.
