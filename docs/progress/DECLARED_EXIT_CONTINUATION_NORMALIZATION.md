# Declared Exit Continuation Normalization

Status: proposed future engine and application slice

Related but deliberately separate work:

- [N Hub workspace polish](N_HUB_WORKSPACE_POLISH.md) is a React/CSS
  presentation slice. It does not change catalog, authored topology,
  simulation, persistence, or commands.
- [Route detour findings](../audits/ROUTE_DETOUR_FINDINGS.md) is source
  evidence and extension research. It does not authorize Chaos work.

## Purpose

Normalize declared room continuations so that Ephyra's Hub is a special
destination with special board semantics, rather than the endpoint of a
hard-coded N-only entry chain.

The user-visible consequence is intentionally modest: an authored predecessor
owns its own continuation action. N should not need a detached `Add fixed next
room` or `Add Hub` inspector panel merely because its next step is fixed. The
engine and application consequence is larger: the source-to-Hub relationship
must be declaration-backed, structurally explicit, and reusable by a future
detour return without adding another N-specific traversal path.

This document is a delivery proposal, not a replacement for the current design
authorities. Once accepted and implemented, the durable decisions move into the
catalog, authored-project, simulation, editor, workspace, and N game-rule
documents listed below.

## Current Problem

The present N path is represented and consumed as a special chain:

```text
N Opening
  -> linked PreHub exit
  -> PreHub
  -> separately created Hub decision
  -> completed-Hub Preboss handoff
```

The catalog's Hub descriptor currently owns one `linkedExit`; topology commands
and codec checks treat it as the fixed opening-to-PreHub transition, and
`CreateHubDecision` requires that linked PreHub state. Several engine paths
therefore infer Hub reachability from N's layout, its start, or the linked
PreHub room. The application mirrors that split: it can place a generated
`CreateBatch` continuation on its predecessor workbench, while linked and Hub
creation reach a standalone authoring frontier.

That is truthful for the current data, but it has three costs:

1. N's normal path receives a visibly different editor shape from ordinary
   biome progression.
2. Structural continuation ownership is spread across catalog, commands,
   codec, traversal, and UI-specific frontier cases.
3. A future alternate path into the Hub would require another special-case
   chain instead of naming the same Hub-entry boundary.

## Evidence and Scope

The current game evidence establishes that N Opening is linked to PreHub and
PreHub is linked to the Hub. Natural Chaos is not a production feature. Game
scripts establish that an N Opening secret door is additional to its normal
exit and that Chaos resumes the previous room set. Player-observed runtime
behavior says taking Chaos from N Opening returns directly to the Hub, skipping
PreHub. The current static source review did not independently expose the
named direct `N_Hub` force; this remains a focused future runtime-evidence item.

Nothing in this slice adds Chaos declarations, authored state, commands,
reward support, lifecycle behavior, candidates, or UI. It merely makes the
ordinary source-to-Hub boundary capable of being named when that future work is
ready.

## Required Target Contract

The target model is a finite, declaration-owned continuation vocabulary, not a
generic graph API or a callback-shaped escape hatch:

```text
ordinary source
  -> generated normal-decision continuation
  -> fixed-room continuation
  -> Hub-entry continuation

completed Hub
  -> existing completed-Hub handoff
```

The completed-Hub handoff remains semantically distinct: it depends on the
Hub's board and six-visit predicate. It may share an application action-row
presentation with other continuations, but it must not become an ordinary
generated decision.

N's declaration-backed path then reads:

```text
Opening -- fixed-room continuation --> PreHub
PreHub  -- Hub-entry continuation  --> Hub
Hub     -- completed handoff        --> Preboss
```

The central invariant is:

> Every reachable Hub has an exact declaration-backed source-to-Hub relation
> that topology commands, decoding, traversal, removal, focus, and closure
> can resolve. No generic path may infer that relation from a start occurrence,
> a room game name, or a UI position.

The resulting model must also support the later shape without adding any
production Chaos behavior now:

```text
future detour room -- declared resume / Hub entry --> the same Hub
```

Only one selected route reaches the unique Hub decision at a time. Alternative
future entry sources do not create duplicate boards, Hub rooms, or completion
handoffs.

### Persisted Representation Decision

The required invariant does not prematurely dictate one TypeScript
discriminator. Before implementation, inventory every core consumer and choose
one explicit representation:

1. a new source-owned Hub-entry exit variant that references the Hub key; or
2. a source-bearing Hub decision whose source is validated as its exact entry.

Either choice is acceptable only if it provides a first-class, removable,
serializable source-to-Hub relationship with stable semantic ownership. It must
not leave the relationship implicit in a decoder, evaluator, or projection.
The chosen representation must preserve the existing single-Hub cardinality
and cleanly model future alternate entries.

If the selected representation changes persisted topology, make the schema
decision explicitly. A migration may normalize only a uniquely recognized,
valid schema-9 N chain; malformed or ambiguous legacy topology must be
rejected, not guessed at. If the accepted representation needs no persistence
change, the implementation must document why its explicit semantic relation is
still complete at the decoder boundary.

## Authority and Change Inventory

| Owner                          | Required work                                                                                                                                                                               | Must not own                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Hades II catalog               | Replace N's singular start-only linked-exit assumption with source-resolved declared continuation facts; retain the fixed Opening, PreHub, Hub, and Preboss game declarations.              | Authored selection, UI labels, candidate policy, or runtime Chaos data.                   |
| Planner engine                 | Resolve the continuation allowed for a structural source; create, remove, decode, materialize, evaluate, and traverse the explicit Hub entry; preserve one atomic undoable authored change. | React presentation, focus labels, Redux, or UI-session state.                             |
| Planner application projection | Adapt resolved continuation facts to markers, exact destinations, complete command intents, and focus timing.                                                                               | Re-deriving topology eligibility from room candidates or findings.                        |
| React UI                       | Render a projection-supplied continuation action in its predecessor workbench and use common action-row styling.                                                                            | Deciding whether a source reaches a Hub, allocating identities, or constructing commands. |

### Catalog and Engine Work

The catalog needs a narrow continuation-resolution declaration that can answer
the following for an authored source:

- is the regular continuation a generated normal decision, a fixed room, or a
  Hub entry;
- which stable semantic key and concrete room declaration it targets when
  applicable; and
- which source is allowed to establish a specific Hub entry.

The engine then migrates all current special-path consumers to that resolution:

- topology command validation and identity allocation;
- topology codec ownership, cycle, reachability, and source validation;
- physical-exit and downstream-selection queries;
- removal and selected-subtree reconciliation;
- semantic addresses and exact command/focus owners where the chosen persisted
  shape requires them;
- materialization, history composition, progressive evaluation, completeness,
  and validation traversal; and
- deterministic undo/redo of the one semantic edit.

An invalid or incomplete evaluation may annotate a declared continuation, but
must never erase its structurally representable authored control or downstream
topology. Structural construction invariants may still reject malformed command
proposals; evaluation status is not structural continuation authority.

### Application and UI Work

The structured-workspace semantic assembly should expose one typed continuation
product for a real predecessor. It contains its semantic owner, continuation
kind, target summary, complete bound intent, and declared focus result. The
application, not the engine, supplies concise presentation copy from this typed
product.

React should use one small continuation-action surface in the relevant existing
workbenches:

```text
Opening:       Continue to PreHub
PreHub:        Enter Hub
Normal batch:  Add next decision
Completed Hub: Continue to Preboss
```

Exact final wording is an application vocabulary decision; the important rule
is that it comes from the projected continuation kind, never `if biome ===
'N'` in React.

An authoring frontier with a rendered predecessor belongs inside that
predecessor's workbench. A standalone frontier remains legitimate only where
there is no authored/rendered predecessor, such as a completely unstarted
biome. The fixed PreHub occurrence remains a normal player-facing occurrence
workbench; a linked-exit wrapper may remain an internal topology product if it
is useful, but it must not force a second inspector panel.

The rail follows the explicit selected topology relationship: Opening,
authored PreHub, then Hub. It does not introduce N-specific traversal code.
The completed-Hub handoff still belongs to the Hub workbench, but can use the
same continuation-action presentation shape.

## Future Chaos Seam

The only future-facing deliverable in this slice is a **test-only alternate
Hub-entry fixture**. It declares a second structurally legal source for the
same Hub and proves that the engine and projection do not depend on PreHub's
room name or N's start occurrence.

It is not production Chaos data. It must not add a Chaos room declaration,
reward bag, lifecycle profile, candidate, editor control, or route behavior.
When natural Chaos is later implemented, its additional-door and resume policy
will extend the detour decision envelope described in
[Route detour findings](../audits/ROUTE_DETOUR_FINDINGS.md), then target this
already-proven Hub-entry boundary.

## Delivery Slices

Each slice must be a complete vertical change with its primary tests and no
compatibility/shadow path retained for a later commit.

### Slice 1: declared continuation and Hub-entry core

- establish the chosen persisted representation and schema treatment;
- update N's normalized declaration and source-resolution query;
- migrate commands, codec, topology queries, removal, history/materialization,
  progressive evaluation, completeness, and validation;
- add focused catalog and engine tests, including the alternate-entry fixture;
- update durable core design documents affected by the accepted model.

This slice may update compilation consumers required by the new core surface,
but must not leave a temporary dual model or an application-owned topology
fallback.

### Slice 2: workspace and editor consumption

- project the shared predecessor-owned continuation product and its complete
  interactions;
- remove the linked/Hub standalone-frontier presentation for any source with a
  rendered predecessor;
- embed the fixed-room and Hub-entry actions in the relevant workbenches;
- make the N rail consume the generic selected topology relationship; and
- add focused projection, closure, interaction, UI, and product-loop
  witnesses.

## Test and Closure Matrix

The completed implementation must demonstrate all of the following:

1. N can author Opening -> PreHub -> Hub -> Preboss through only
   declaration-backed continuations.
2. Opening cannot skip directly to Hub, and an undeclared room cannot establish
   a Hub entry.
3. A test-only alternate declared source can reach the same Hub without
   PreHub-name or start-occurrence logic.
4. Removing an entry removes exactly its selected downstream Hub structure and
   handoff; undo and redo restore it atomically.
5. Codec and topology validation reject duplicate, detached, cyclic,
   mis-sourced, or mis-targeted Hub entries.
6. Materialization, progressive evaluation, completeness, and findings follow
   the explicit relation rather than special N chain inference.
7. Continuation markers, inspector destinations, bound interactions, and focus
   destinations are independently closed in workspace tests, including the new
   Hub-entry owner.
8. An evaluation finding never hides a structurally representable continuation
   action.
9. N's Opening and PreHub show their continuation actions in their own
   workbenches, with no detached `Add fixed next room` or `Add Hub` panel.
10. Ordinary generated `Add next decision` behavior and the completed-Hub
    Preboss handoff retain their existing semantic distinctions.

The phase closes with the complete repository gate:

```text
npm run check
```

## Non-Goals

- Implementing natural Chaos, Anomaly, or any other detour.
- Adding an open-ended graph, generic edge type, callbacks in declarations, or
  a `special` escape hatch.
- Treating fixed PreHub as a generated normal-door batch.
- Changing Hub board membership, visits, side rooms, rewards, pylons, or the
  completed-Hub predicate.
- Letting candidate eligibility, findings, or evaluated entry hide authored
  continuation controls.
- Moving continuation policy into React or making the engine return UI copy.
- Folding this work into the current N Hub workspace-polish slice.

## Documentation Reconciliation

After implementation, reconcile the accepted durable contract in:

- [Catalog model](../design/CATALOG_MODEL.md);
- [Authored project model](../design/AUTHORED_PROJECT_MODEL.md);
- [Simulation and validation](../design/SIMULATION_AND_VALIDATION.md);
- [Editor model](../design/EDITOR_MODEL.md);
- [Structured editor workspace](../design/STRUCTURED_EDITOR_WORKSPACE.md); and
- [N game rules](../biomes/N_GAME_RULES.md).

Keep the route-detour document as evidence and extension research rather than
making it the authority for normal N continuation semantics. Retire or update
this progress proposal only after those authorities describe the implemented
model.
