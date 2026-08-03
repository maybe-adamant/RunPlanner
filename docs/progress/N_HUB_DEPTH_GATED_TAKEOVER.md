# N Hub Depth-Gated Takeover

Status: selected implementation plan; normalized decision/takeover model;
implementation pending

This plan deliberately accepts a data simplification in exchange for removing
N-only continuation machinery. `N_GAME_RULES.md` owns the literal game facts
and accepted planner normalization. This document owns delivery until the
running implementation and durable cross-cutting design authorities converge
on that contract.

## Selected Model

The planner will replace the game's literal linked entry chain:

```text
Opening.LinkedRoom -> PreHub.LinkedRoom -> Hub
```

with the following behaviorally equivalent authored model:

```text
fixed Opening
  -> ordinary width-one decision at biome depth 1
  -> PreHub occurrence
  -> terminal Hub takeover at biome depth 2
  -> persistent Hub board
```

The simplification remains justified only if game-data and product fixtures
prove that the current normal N route preserves its observable planner outcome:
Opening and PreHub lifecycle, depth, history, Hub board, visits, and completed
handoff. Natural Chaos is not data in this slice and does not widen this
contract pre-emptively.

## Source Evidence

### Cache update order

The game leaves a room by inserting `CurrentRoom` into `RoomHistory` and then
calling `UpdateRunHistoryCache`. `GetBiomeDepth` walks that updated history back
to the room carrying the biome boundary's `NextRoomSet`.

For N this produces:

| Selected path from Opening | History step after the selected room | `BiomeDepthCache` |
| -------------------------- | ------------------------------------ | ----------------- |
| normal PreHub              | Opening, PreHub                      | 2                 |
| additional Chaos exit      | Opening, Chaos                       | 2                 |

Opening itself establishes depth 1. Both `N_PreHub01` and the Chaos room add
one room-history ordinal and one biome-depth step. `BaseChaos.PauseBiomeState`
removes and restores biome-state traits; it does not suppress room-history or
depth-cache updates. `UsePreviousRoomSet` resumes N afterward.

This establishes a useful future data fact:

> After either the selected PreHub occurrence or the selected one-room Chaos
> occurrence completes, the game can resume N at depth 2.

It does not mean the game declarations or planner products are identical.
PreHub is the literal linked room, while Chaos is a separately generated
special exit with its own room, reward, encounter, history, and availability
policy. A future Chaos slice owns the decision-envelope and resume model if
and when that data enters the catalog; this plan does not add a provisional
version of either.

### Hub behavior

`N_PreHub01` literally links to `N_Hub`. After the observed Chaos route, the
game resumes N and enters a fresh `N_Hub` instance without entering PreHub.
Downstream N room requirements explicitly accept history containing either
`N_PreHub01` or `Chaos_01` through `Chaos_06`.

The static source does not express the proposed `depth == 2` Hub takeover as a
literal declaration. For this slice, it is a planner normalization of the
current Opening -> PreHub -> Hub route. Its depth boundary is consistent with
the observed Chaos route, but this plan does not contract or model that route.
The raw `LinkedRoom` facts must remain recorded in source-evidence documentation
even if they disappear from the normalized topology contract.

## Target Authored Flow

### Normal path

```text
N_Opening01 occurrence
  -> ExitDecision(source = Opening)
       normal batch: one declaration-owned normal exit
       only eligible target at depth 1: N_PreHub01
  -> selected N_PreHub01 occurrence
  -> empty ExitDecision(source = PreHub)
       forced terminal candidate at depth 2: N_Hub takeover
  -> select Hub
  -> replace the entire empty decision node with HubDecision(source = PreHub)
```

### Future data boundary

This plan intentionally has no authored Chaos path, alternate Hub source,
host-context type, or generic resume contract. If a later catalog slice adds
an N-opening Chaos gate, it defines the additional-exit selection and resumed
N decision context from the actual data then present. This plan supplies only
the ordinary N decision and terminal-Hub vocabulary that that later slice may
choose to extend.

## Modeling Contract

### PreHub is an N-scoped ordinary fixed candidate

`N_PreHub01` becomes an authored room occurrence selected through the normal
decision envelope. Like `O_Devotion01`, it is a room declaration selectable
only while authoring its own biome. Its normalized room eligibility is exact:

```ts
eligibility: {
  kind: 'counterRange',
  axis: 'biomeDepthCache',
  range: { min: 1, max: 1 },
}
```

The Opening decision is declaration-fixed to one physical normal exit and one
normal target. Its N entry candidate pool is a one-stage declared set, for
example:

```ts
{
  kind: 'staged',
  stages: [{ key: 'entry', roomGameNames: ['N_PreHub01'] }],
}
```

The stage is current data containment, not a generic source-policy layer: it
prevents Hub slots, side rooms, and other N declarations from leaking into the
normal entry picker. PreHub's forced `RunProgress` incoming reward remains
declaration-owned and editable at the room target. No generic batch
reward-store choice may override it.

The bounded N entry descriptor owns the stable physical exit key `prehub`.
Normalization changes that exit from linked to normal without renaming its
semantic target identity to the generated default `exit1`. This preserves
persisted target addresses, findings, focus destinations, and migration
identity while allowing the shared normal-decision machinery to consume it.

The ordinary-target command contract must intentionally admit `PreHub` only
through this declared N entry stage. It must not remove the existing
special-room exclusion globally or make every `PreHub` declaration an ordinary
candidate.

### Hub is an N-scoped terminal takeover candidate

`N_Hub` is likewise an N room declaration selectable at its exact depth-2
frontier. It may appear in the same projected room-selection surface as an
ordinary candidate, but its declared mode resolves selection differently: it
is not persisted as a normal `RoomOccurrence` and never becomes a normal batch
target. Candidate evaluation returns a distinct terminal resolution:

```ts
type DecisionCandidate =
  OrdinaryRoomCandidate | TakeoverPrebossBatchCandidate | HubTakeoverCandidate;

interface HubTakeoverCandidate {
  readonly kind: 'hubTakeover';
  readonly hubKey: string;
  readonly roomGameName: string;
  readonly source: ExitDecisionAddress;
  readonly force: 'required' | 'possible' | 'impossible';
}
```

The exact public type names may differ. The invariant is that the engine, not
React, distinguishes a room target from a terminal Hub transition. Biome scope
and the depth-2 declaration are the current eligibility authority; there is no
additional allowed-source or host/resume policy in this slice.

The decision after PreHub is a declaration-backed **terminal takeover
envelope**, not a second ordinary batch. The entry stage has already consumed
N's one ordinary progression unit. The terminal declaration therefore admits
one zero-target envelope at that exact selected-spine ordinal without raising
the ordinary batch bound. That envelope:

- does not count as another ordinary batch;
- exposes only the Hub takeover candidate;
- never exposes `N_PreBoss01` or another takeover-Preboss candidate;
- cannot accept an ordinary `CreateTarget`; and
- disappears atomically when Hub selection replaces it.

The engine may generalize the existing terminal-envelope query that admits a
takeover Preboss, but the declaration must identify one closed terminal
resolution for the source. It must not scan all takeover Preboss declarations
in N after admitting Hub progression to shared normal-decision machinery. The
zero-target persisted shape alone is never authority for Hub availability.

At the supported depth-2 frontier, Hub is required. Selecting it atomically:

1. removes the empty or replaceable normal decision at that source;
2. removes any downstream state owned by targets being replaced;
3. creates one source-bearing `HubDecision`;
4. initializes the existing Hub board model under its stable Hub key without a
   transient normal-room occurrence; and
5. publishes the Hub workbench at the same rail position.

Undo restores the exact prior decision envelope and its authored state. Redo
reapplies the Hub takeover atomically.

### Hub takeover and Preboss takeover are siblings

The two operations share source ownership, force presentation, atomic
replacement, removal impact, and undo semantics. They do not share one domain
result:

- Preboss takeover resolves an `ExitDecision` to an atomic normal-door batch of
  authored room occurrences.
- Hub takeover replaces an `ExitDecision` with a `HubDecision` and derives the
  persistent Hub room and board.

Do not extend `takeOverNormalDoors` with Hub-specific optional fields. Extract
only genuinely common replacement helpers or interaction presentation.

### N Preboss remains a completed-Hub handoff

The new PreHub terminal envelope does not absorb N's existing Preboss path.
`N_PreBoss01` remains enabled only after the Hub satisfies its declared open-set
and six-visit predicate:

```text
complete HubDecision(source = PreHub)
  -> completed-Hub frontier(source = hubDecision:hub)
  -> fixed width-one N_PreBoss01 takeover batch
  -> selected Preboss starts biome completion
```

The completed-Hub exit owns the stable `preboss` physical exit and concrete
`N_PreBoss01` target. `CreateTakeoverBatch` or its retained semantic equivalent
creates the one selected Preboss occurrence directly; it does not require the
post-PreHub terminal envelope and does not replace the Hub node. The Hub board
remains authored and the Hub workbench continues to present this handoff.

Candidate and command domains must preserve the source distinction:

- an occurrence-sourced N terminal envelope admits only `hubTakeover`;
- a `hubDecision`-sourced completed frontier admits only
  `completedHubHandoff`; and
- incomplete Hub state admits neither the Preboss handoff nor an
  occurrence-sourced Preboss candidate.

`N_PreBoss01.prebossBatchPolicy` remains useful for its atomic width-one batch,
role, and room-lifecycle semantics. It must not make that declaration globally
discoverable from every N occurrence frontier.

## Persisted Representation

This alternative also requires a source-bearing Hub decision:

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

The semantic address of the board remains `HubDecisionAddress(hubKey)`. The
source records the selected predecessor for rail placement, replacement,
removal, traversal, and undo; it does not add another eligibility policy or
destabilize slot or visit identities.

Only one selected continuation product may be owned by a source. An
`ExitDecision` and `HubDecision` cannot coexist at the same selected source.

## Catalog Shape and Simplification Cost

The current catalog makes `ProgressionDescriptor` an exclusive union of
`generated` and `hub`. That prevents N from consuming the normal decision
machinery while retaining its Hub board descriptor. Implementing this plan
requires a catalog-schema change, but it must model the data now present rather
than create a global capability framework for hypothetical consumers.

The default target is therefore a bounded Hub progression descriptor with two
declaration-owned current-N facts:

```text
N Hub progression
  normal entry: one staged, width-one PreHub decision
  terminal room: N_Hub, required at biome depth 2
  Hub board and completed-handoff descriptors: unchanged
```

The concrete TypeScript spelling is an implementation choice. It may retain
`progression.kind === 'hub'` and replace its `linkedExit` with those two facts,
or use a narrowly named combined variant if that removes more real branches.
Do not split every `BiomeLayout` into `normalProgression + hub?` unless B1's
switch inventory demonstrates a present maintenance payoff.

Whichever spelling B1 selects must resolve one narrow normal-decision policy
product for shared command, codec, candidate, and simulation consumers. It is
not acceptable to preserve the apparent type boundary by spreading repeated
`progression.kind === 'generated' || progression.kind === 'hub'` branches
through those consumers. A nested Hub-entry descriptor may satisfy this
contract without introducing a repository-wide optional capability. B1 chooses
the smallest coherent ownership surface after deletion, not the smallest type
diff.

For N, the declarations must establish:

- fixed authored Opening;
- a width-one first normal decision with only `N_PreHub01` eligible at depth 1;
- `N_Hub` as the only terminal takeover at depth 2;
- no normal-entry eligibility for Hub board slot rooms;
- the existing Hub board, visit, side-room, reward, restore, and completed-exit
  descriptors unchanged.

This is a normalization cost. The catalog no longer represents the literal
Opening/PreHub `LinkedRoom` mechanism as a distinct topology product. Source
audits continue to record it, while the production catalog represents its
planner-observable result.

The exhaustive live-code inventory on 2026-08-02 found linked model, command,
canonical, workspace, interaction, or presentation symbols in 35 production
files and 27 test/test-support files, 62 files total. It found direct
`generated`/`hub` progression-kind branching in 20 production files. Those
sets overlap and are not commit-size estimates; B1 must classify each hit as a
true owner, a consumer the bounded descriptor changes, or a branch deleted
with linked entry. The counts make clear that B is a broader core rewrite than
A even if its final vocabulary is smaller.

## Deletion and Replacement Ledger

The value of this alternative depends on deleting the superseded N-only path,
not layering takeover behavior beside it.

The declaration inventory contains two uses of the current linked descriptor,
both in N:

1. Opening -> PreHub is the only real persisted and canonical linked exit.
2. Completed Hub -> Preboss reuses the catalog descriptor shape, but its
   authored and canonical product is already a Hub-sourced takeover batch.

No other biome owns a linked declaration or linked topology product. Once the
completed-Hub metadata has its own descriptor, linked entry is removable as a
complete domain family rather than merely an N branch left in shared unions.

Expected deletions include:

- persisted `LinkedNormalExit` and `normal.kind === 'linked'` for N entry;
- `CreateLinkedExit` and its application interaction;
- `LinkedNormalExitDescriptor` after completed-Hub metadata is extracted;
- canonical `linkedExit` decision products used only by that path;
- linked-exit codec, selected-source, topology-impact, removal, materialization,
  history, reward, completeness, workspace, and UI branches;
- the `CreateHubDecision` requirement that searches for the start-owned linked
  PreHub decision; and
- rail/frontier logic that treats fixed entry as a separate node family.

`CompletedHubExitDescriptor` currently extends `LinkedNormalExitDescriptor`.
Before deleting the linked-entry family, give the completed-Hub exit its own
narrow fixed physical-exit descriptor and compiler normalization. The
completed handoff retains its `preboss` exit key, physical exit metadata,
concrete target, Hub-completion prerequisite, and takeover-batch product; it is
not a reason to preserve the entry type, `kind: 'linked'`, or canonical
`linkedExit` union member.

Expected additions include:

- source-bearing `HubDecision` persistence and the selected schema-10 handling;
- one Hub takeover candidate/evaluator;
- one atomic replace-with-Hub command path;
- the bounded N Hub-entry/terminal descriptor selected by B1;
- exact PreHub and Hub frontier declarations; and
- focused equivalence, command, candidate, workspace, and product-loop tests.

Acceptance is based on a smaller change neighborhood and removal of parallel
paths, not raw line-count reduction. Nevertheless, unexplained net production
growth after the linked path is removed is a stop-and-review signal.

## Schema Migration

This is a schema-10 change. The current codec has no legacy-schema migration
dispatcher, so B1 must explicitly choose one of two policies: add one narrow,
pure schema-9-to-10 migration before normal decoding, or deliberately reject
schema-9 profiles under the repository's release policy. The implementation
cannot imply a migration without that dispatcher.

If migration is selected, transformation from a valid schema-9 N topology is
deterministic:

1. Locate the sole start-owned linked PreHub decision.
2. Replace it with a width-one normal batch using the same source, exit key,
   target occurrence, and selected outcome.
3. Use a declaration-owned no-choice batch-store state; retain the PreHub
   occurrence's existing forced RunProgress offer unchanged.
4. If a Hub decision exists, add the linked PreHub target occurrence as its
   source.
5. Retain Hub open targets, visits, side state, completed handoff, and all
   occurrence IDs unchanged.

A schema-9 document with a detached, duplicate, mis-targeted, or ambiguous N
chain is rejected. Migration must not locate PreHub by label, rendered order,
or an arbitrary occurrence search.

## Engine Implementation Inventory

### Catalog and normalization

- introduce the bounded N Hub-entry/terminal descriptor selected by B1;
- give PreHub exact depth-1 eligibility and a bounded first-stage pool;
- admit PreHub structurally only through that declared N entry stage;
- declare Hub terminal takeover eligibility/force at exact depth 2;
- prevent derived Hub and fixed Hub-slot rooms from ordinary candidate leakage;
- retire the N linked-entry descriptor after all consumers migrate.

### Authored topology and commands

- add the Hub source and selected schema migration-or-rejection handling;
- create/replace a width-one ordinary PreHub batch;
- add `ReplaceWithHubDecision` or an equivalently explicit semantic command;
- make replacement and removal impact atomic and source-addressed;
- update selected-spine reachability and cycle validation;
- delete linked-entry commands and topology branches.

### Simulation and candidates

- evaluate PreHub through the ordinary source-history candidate path;
- evaluate the Hub terminal candidate at the exact post-room lifecycle frontier;
- exclude every takeover Preboss, including `N_PreBoss01`, from that
  occurrence-sourced terminal domain;
- enter the Hub from the selected PreHub occurrence at the declared depth-2
  frontier;
- retain the completed-Hub `N_PreBoss01` handoff exclusively at the complete
  `hubDecision` source;
- preserve current Hub generation, history, rewards, visits, restores, and
  completion products;
- remove linked canonical/history/reward special cases.

### Application and React

- present PreHub through the ordinary room/reward picker;
- present Hub in that picker using its projected terminal-takeover intent;
- replace the decision card with the existing Hub workbench after selection;
- retain thin React dispatch with no depth, room-name, or takeover policy;
- keep rail identity and focus stable across replacement and undo.

## Delivery Slices

No slice may leave both linked and normalized production paths active.

### Slice B1: proof fixtures and schema decision

- add executable engine fixtures for the current Opening -> PreHub -> Hub path;
- prove the exact depth-2 terminal candidate point after PreHub lifecycle;
- classify the complete linked-symbol inventory and confirm that only N entry
  owns persisted/canonical linked behavior;
- freeze the closed terminal-resolution matrix: PreHub occurrence -> Hub
  takeover, complete Hub decision -> Preboss handoff;
- inventory all `ProgressionDescriptor` switches and select the smallest
  coherent bounded ownership surface with recorded rationale;
- freeze the schema-10 migration-or-rejection policy and exact shape.

This slice may be test/document-only. It must not add a fake Chaos model,
production shadow model, or generic resume vocabulary.

### Slice B2: entry normalization and Hub takeover

- move N Opening -> PreHub onto the ordinary width-one decision path;
- migrate persistence, commands, codec, candidates, materialization, history,
  rewards, completeness, and validation;
- add the terminal Hub candidate and atomic replacement command;
- add source-bearing Hub traversal and removal;
- preserve the complete existing Hub product;
- remove source-less Hub creation and inference; and
- delete the linked-entry production path in the same commit or inseparable
  buildable vertical series.

Entry normalization and Hub takeover are one core slice. Deleting linked entry
while retaining the current `CreateHubDecision` contract would leave Hub
creation dependent on topology that no longer exists. Do not bridge the two
with a temporary continuation command, source-less Hub fallback, or dual
production model.

### Slice B3: workspace and UI

- render PreHub as a normal room/reward choice;
- render Hub as a takeover option and replace the whole decision card with the
  existing Hub workbench;
- verify rail placement, focus reconciliation, undo/redo, and findings;
- remove linked/standalone creation presentation.

## Equivalence Gates

The implementation is acceptable only if all gates pass.

### Entry and counters

1. Opening evaluation establishes the same counter and lifecycle state as the
   current model.
2. Selecting and entering PreHub produces the same incoming reward, encounter,
   acquisition, commit, history ordinal, and depth-2 frontier.
3. The N entry candidate stage exposes only PreHub; no Hub slot, side room, or
   other N declaration leaks into it.
4. Exact depth gating is evaluated after PreHub's declared lifecycle counters,
   matching ordinary candidate semantics.
5. The post-PreHub terminal envelope is admitted after the one ordinary stage,
   does not increase the ordinary batch bound, exposes no ordinary target, and
   resolves only through the required Hub takeover. It never exposes
   `N_PreBoss01` or another takeover Preboss.

### Hub product

6. The selected PreHub source creates exactly one derived `N_Hub` and one board.
7. The same nine-or-ten open-slot constraints, rewards, six visits, side-room
   pressure, pylons, parent restores, Hub restores, and shop lookup apply.
8. Hub entry adds the same N_Hub history/counter effects as today.
9. An incomplete Hub exposes no Preboss handoff or occurrence-sourced Preboss
   candidate.
10. A complete Hub exposes exactly the existing `hubDecision`-sourced,
    width-one `N_PreBoss01` handoff.
11. Completed-Hub Preboss, Boss, Postboss, and transition reset are unchanged.

### Authorship and topology

12. The normal path persists Opening -> width-one PreHub batch -> source-bearing
    Hub without linked topology.
13. The normalized PreHub target retains the declaration-owned `prehub` exit
    key and its existing semantic addresses.
14. Removing or replacing the Hub restores exactly its source decision; undo
    and redo are atomic.
15. Codec, cycle, reachability, closure, and topology impact reject competing or
    detached source products.

### Application behavior

16. PreHub room and reward use the ordinary picker controls.
17. Hub appears as a projected forced N candidate and selecting it replaces the
    entire decision node with the existing Hub workbench.
18. React contains no N depth, eligibility, room-name, or command-construction
    policy.
19. Findings cannot hide either the PreHub or Hub control.
20. Rail selection, semantic focus, native keyboard continuity, and undo/redo
    remain stable.

### Deletion and health

21. No production linked-entry path, canonical linked product, or forwarding
    compatibility wrapper remains.
22. Completed-Hub metadata no longer depends on `LinkedNormalExitDescriptor`,
    while its Hub-sourced Preboss behavior remains unchanged.
23. Shared normal-decision consumers resolve one bounded policy product rather
    than accumulating `generated || hub` branches.
24. Each new policy has one primary test owner; integration suites retain only
    representative witnesses.
25. Production growth is explained by a retained authority, and the final
    change neighborhood is smaller than the current linked-plus-Hub path.

The phase closes with:

```text
npm run check
```

## Decision Record

The selected model replaces the source-shaped alternative that would have
retained Opening -> PreHub as a linked topology family and added only an exact
source to `HubDecision`. That alternative preserved the literal game mechanism
with lower implementation risk, but it also preserved the N-only persisted,
canonical, workspace, and UI vocabulary responsible for much of the current
change neighborhood.

The depth-gated takeover model was selected because it:

- presents PreHub through the established room/reward decision interaction;
- makes Hub selection an explicit terminal resolution of the same decision
  surface;
- retains a source-bearing Hub and the existing persistent board semantics;
- removes the linked-entry domain family after completed-Hub metadata is
  separated; and
- leaves future Chaos data to its own evidence-backed slice rather than adding
  a speculative resume abstraction now.

The accepted cost is reduced fidelity to the game's literal `LinkedRoom`
implementation and a broader initial core rewrite. Failure of the lifecycle,
Hub-product, source-domain, or deletion gates stops implementation and requires
revisiting the normalization rather than preserving both models.

## Non-Goals

- Implementing production Chaos or its reward/lifecycle/editor support.
- Treating Chaos as transparent history.
- Adding an allowed-source list, host-context type, or generic resume model in
  advance of actual detour data.
- Making all derived or fixed Hub-slot rooms ordinary candidates.
- Reusing Preboss batch types for Hub state.
- Auto-selecting Hub without an authored semantic command.
- Changing the Hub board, visits, side rooms, rewards, pylons, restores, shop
  lookup, or completed-Hub predicate.
- Reproducing literal `LinkedRoom` mechanics elsewhere after deleting them.
- Justifying the selected model solely because it deletes more lines.

## Implementation Start Gate

Complete B1 before changing production topology. It must establish:

- the current-N lifecycle and depth equivalence fixtures;
- the complete linked-family and progression-switch inventories;
- the closed PreHub-to-Hub and completed-Hub-to-Preboss terminal matrix;
- the schema-10 migration-or-rejection decision;
- which branches the implementation deletes rather than forwards;
- whether the normalized current N path preserves every observable pre-Hub and
  Hub product; and
- whether the bounded descriptor reduces rather than relocates coupling.

Do not begin B2 if any equivalence proof fails, if another live owner for linked
topology is found, or if the proposed bounded policy requires a parallel
production path.
