# Declared Exit Continuation Normalization

Status: implementation alternative A; source-shaped continuation model

Related but deliberately separate work:

- [N Hub workspace polish](N_HUB_WORKSPACE_POLISH.md) is a completed React/CSS
  presentation slice. It does not authorize topology changes.
- [Route detour findings](../audits/ROUTE_DETOUR_FINDINGS.md) is source
  evidence and extension research. It does not authorize production Chaos.

This proposal competes with `N_HUB_DEPTH_GATED_TAKEOVER.md`. The two documents
must remain separate until one model is selected.

## Purpose

Make Ephyra's source-to-Hub relationship explicit without changing the
source-shaped Opening -> PreHub -> Hub entry model.

The user-visible consequence is modest: each authored predecessor owns its own
continuation action. N should not need a detached `Add fixed next room` or
`Add Hub` inspector panel merely because its continuation is fixed. The engine
consequence is more important: a Hub decision records the exact occurrence
from which it is reached rather than relying on its room name, the biome start,
or decision-array position.

This is a delivery proposal, not durable design authority. If selected and
implemented, its accepted contracts move into the catalog, authored-project,
simulation, editor, workspace, and N game-rule documents.

## Current Problem

The current N path is:

```text
N Opening
  -> start-owned linked PreHub exit
  -> PreHub
  -> source-less Hub decision
  -> completed-Hub Preboss handoff
```

`HubDecision` currently persists `hubKey`, `openTargets`, and `visitOrder`, but
no entry source. `CreateHubDecision` proves reachability indirectly by finding
the sole start-owned linked exit. Codec validation repeats that inference, and
completeness discovers the Hub by comparing the current occurrence's game name
with `layout.progression.linkedExit.roomGameName`.

By contrast, ordinary F-style decisions are source-addressed. Their command,
codec, traversal, removal, candidate, and workspace products all agree on the
exact occurrence that owns the decision. N loses that property precisely at
its most structurally significant boundary.

The current shape has three costs:

1. Hub reachability is implicit even though its downstream board is large.
2. Catalog, codec, traversal, removal, and workspace code reconstruct the same
   N-only relationship using different surrounding facts.
3. A future alternate entry into the same Hub cannot be represented without
   either more inference or a second special path.

## Evidence and Scope

The game scripts establish the current source-shaped facts:

- `N_Opening01.LinkedRoom = "N_PreHub01"`;
- `N_PreHub01.LinkedRoom = "N_Hub"`;
- N's natural Chaos gate is an additional exit available from Opening rather
  than a replacement for its normal linked exit; and
- `BaseChaos.UsePreviousRoomSet = true` resumes N after the detour.

Player observation says taking that Chaos gate reaches the Hub without entering
PreHub. Static source review confirms the resumed N context and the downstream
N room-history predicates that accept either PreHub or Chaos, but it does not
expose a literal `ForceNextRoom = N_Hub` assignment. That runtime observation
therefore remains extension evidence, not a production Chaos contract.

Nothing in this alternative adds Chaos declarations, authored state, commands,
reward support, lifecycle behavior, candidates, or UI. It only proves that a
second declared occurrence source could enter the same unique Hub.

## Required Target Contract

The source-shaped path remains:

```text
Opening -- fixed linked continuation --> PreHub
PreHub  -- source-bearing Hub entry  --> Hub
Hub     -- completed handoff          --> Preboss
```

The central invariant is:

> Every reachable Hub decision records one exact, selected, declaration-backed
> occurrence source. Commands, decoding, traversal, removal, projection, focus,
> and closure resolve that relation directly from persisted topology.

The fixed Opening -> PreHub link remains a distinct declared continuation. The
completed-Hub handoff also remains distinct because it is enabled by the Hub's
board and six-visit predicate. Neither becomes an ordinary generated batch.

### Persisted Representation

This alternative selects a source-bearing Hub decision rather than introducing
a second Hub-entry edge product:

```ts
interface HubDecision {
  readonly kind: 'hub';
  readonly hubKey: string;
  readonly source: {
    readonly kind: 'occurrence';
    readonly occurrenceId: OccurrenceId;
  };
  readonly openTargets: readonly HubTargetReference[];
  readonly visitOrder: readonly string[];
}
```

The Hub remains the semantic owner of its room, board, slots, and visits.
`source` establishes reachability and placement; it does not replace `hubKey`
as Hub identity and does not turn the Hub into an ordinary exit target.

A separate persisted Hub-entry edge would add another semantic owner between
the predecessor and the already-specialized Hub product. It would complicate
removal, focus, and closure while recreating the detached intermediate shape
this work is intended to remove. The source-bearing decision expresses the
same relation without another topology node.

`CreateHubDecision` must receive the exact source in its semantic command. The
engine validates that:

- the source occurrence exists and lies on the selected authored spine;
- the catalog permits that source to enter the addressed Hub;
- the source owns no competing selected continuation;
- no other Hub decision with the same key exists; and
- adding the relation cannot create a selected topology cycle.

This is a schema-10 change. A schema-9 migration may add the source only when
it recognizes the valid N shape accepted by the schema-9 codec: one start-owned
linked exit whose target is `N_PreHub01`, plus at most one `hub` decision. If a
Hub exists, its source becomes that exact linked target occurrence. Malformed,
detached, duplicate, or ambiguous legacy topology is rejected rather than
repaired by room name.

## Catalog Contract

The Hub descriptor must declare its allowed entry relation instead of asking
engine consumers to infer it from `linkedExit.roomGameName`. The normalized
shape may retain the current linked PreHub descriptor while adding a narrow Hub
entry descriptor, for example:

```ts
interface HubEntryDescriptor {
  readonly hubKey: string;
  readonly allowedSourceRoomGameNames: readonly string[];
}
```

The exact field spelling is an implementation choice. Its constraints are not:

- it is finite and declaration-owned;
- every room name resolves to an authored room in the same biome;
- the production N declaration initially admits only `N_PreHub01`;
- it does not contain callbacks, rendered addresses, or candidate logic; and
- a test catalog can admit a second authored source without naming Chaos.

The current fixed Opening, PreHub, derived Hub, Hub slots, and completed-Hub
Preboss declarations remain unchanged.

## Engine Change Inventory

### Authored commands and codec

- Add the occurrence source to `HubDecision` and `CreateHubDecision`.
- Decode the exact source and validate declaration permission, selected-spine
  reachability, uniqueness, and source conflict.
- Include Hub entry relations in selected-cycle and closure validation.
- Encode and compare the complete source-bearing decision.
- Implement the exact schema-9 to schema-10 migration described above.

### Topology queries and removal

- Resolve a Hub decision by source as well as by stable Hub key.
- Replace start/room-name inference with the persisted relation.
- Make removal of the selected source continuation remove exactly the Hub,
  every Hub-owned slot occurrence and visit, and the completed-Hub handoff.
- Preserve unrelated dead offers and sibling topology.
- Make undo/redo restore the complete relation atomically.

### Materialization, history, and evaluation

- Enter the Hub when traversal reaches the persisted Hub source.
- Preserve the existing one derived `N_Hub`, atomic board generation, visit
  order, parent-local side rooms, restores, reward lookup, and handoff.
- Materialize no duplicate Hub room or board for an alternate test source.
- Address incomplete or invalid entry state to the exact Hub/source owner.

The existing linked PreHub materialization and history product remain in this
alternative. This is the principal code-debt difference from the competing
depth-gated takeover model.

## Application and UI Contract

Structured-workspace assembly projects one typed continuation interaction for
the real predecessor:

```text
Opening:       Continue to PreHub
PreHub:        Enter Hub
Normal batch:  Add next decision
Completed Hub: Continue to Preboss
```

Exact wording remains application-owned. React receives the semantic owner,
presentation kind, complete bound intent, and focus destination. It must not
decide that PreHub reaches the Hub by checking `biomeKey`, `gameName`, or rail
position.

The fixed PreHub remains a normal occurrence workbench. Its linked-exit wrapper
may remain an engine/canonical product, but it does not receive a detached
inspector. The Hub rail card follows the exact persisted source and appears
after whichever selected occurrence owns it.

## Future Chaos Seam

The only future-facing deliverable is a test-only alternate Hub-entry fixture.
It declares a second structurally legal occurrence source and proves:

- the same Hub key is entered from that source;
- no PreHub-name or start-occurrence lookup remains;
- only one Hub board and completed handoff exist; and
- removal and undo follow the selected alternate source.

It must not add production Chaos data, a Chaos occurrence kind, a reward bag,
lifecycle behavior, candidate controls, or route integration. Future Chaos
would first extend the outgoing decision envelope as an additional special
exit, then use this established Hub-entry relation after its selected detour
occurrence.

## Delivery Slices

Each slice is a complete vertical change with its primary tests and removes the
superseded inference in the same commit.

### Slice A1: catalog, persistence, and topology

- add the declared Hub-entry source contract;
- add the persisted Hub source and schema migration;
- update commands, codec, topology queries, cycles, removal, and impact;
- add production N and test-only alternate-source coverage.

### Slice A2: simulation and candidates

- migrate materialization, history, progressive evaluation, completeness,
  validation, and Hub candidate preparation to the exact source;
- remove every start/PreHub-name inference;
- retain Hub board, visit, side-room, reward, and handoff behavior unchanged.

### Slice A3: workspace and UI

- project predecessor-owned fixed and Hub-entry continuation interactions;
- move linked and Hub creation controls into their predecessor workbenches;
- order the rail from explicit topology;
- add projection closure, focus, UI, and product-loop witnesses.

## Test and Closure Matrix

The implementation must prove:

1. N authors Opening -> PreHub -> Hub -> Preboss through declaration-backed
   continuations.
2. The persisted Hub source is the exact selected PreHub occurrence.
3. Opening cannot establish the Hub and an undeclared room cannot establish it.
4. A test-only alternate allowed source reaches the same unique Hub without
   PreHub-name or start-occurrence inference.
5. Removing an entry removes exactly its selected Hub subtree; undo and redo
   restore it atomically.
6. Codec and topology validation reject missing, duplicate, detached, cyclic,
   mis-sourced, or mis-targeted Hub entries.
7. Materialization, history, progressive evaluation, completeness, and findings
   follow the persisted relation.
8. Existing Hub board membership, board rewards, six visits, side rooms,
   restores, pylons, lookup, and completed handoff remain equivalent.
9. Workspace markers, inspector destinations, interactions, and focus resolve
   the exact Hub/source owners independently.
10. Findings never hide a structurally valid continuation action.
11. Opening and PreHub render continuation actions in their own workbenches;
    no detached creation panel remains.
12. Ordinary generated decisions and completed-Hub handoff behavior do not
    change.

The phase closes with:

```text
npm run check
```

## Non-Goals

- Implementing natural Chaos, Anomaly, or another detour.
- Replacing the fixed Opening -> PreHub link with ordinary eligibility.
- Treating Hub entry as a room candidate or takeover.
- Removing linked-exit domain and canonical products.
- Changing Hub board membership, visits, side rooms, rewards, pylons, or the
  completed-Hub predicate.
- Adding a generic graph edge, callback, service registry, or `special` escape
  hatch.
- Letting React, findings, or candidate presentation determine reachability.

## Documentation Reconciliation

If this alternative is selected and implemented, reconcile its durable
contract in the catalog, authored-project, simulation, editor, workspace, and
N game-rule authorities. Retain route-detour evidence as extension research.
Retire this proposal only after those authorities describe the implemented
source-bearing Hub entry.
