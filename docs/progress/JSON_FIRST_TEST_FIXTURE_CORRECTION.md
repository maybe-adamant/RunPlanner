# JSON-First Test Fixture Correction

Status: draft for adversarial review  
Base: `140b035`  
Scope: test support, test consumers, test configuration, and durable documentation only

## Objective

Make strict saved `ProjectDocument` JSON the sole reusable full-state fixture
language. A normal behavior test starts from one named saved checkpoint and
applies only the small mutation that it owns. Permanent code must not replay a
complete F-I or N-Q route merely to reconstruct a checkpoint that is already
checked in.

This correction optimizes schema and command-refactor maintenance as well as
runtime. A schema bump updates the bounded JSON corpus once; it must not require
repairing full-route command recipes and every late-route test separately.

## Locked Boundaries

1. Checked-in JSON contains authored `ProjectDocument` state only. Simulation,
   validation, candidates, findings, workspace, Redux, and rendered products
   are always recomputed by production code.
2. The production strict decoder and canonical encoder remain the only format
   authorities. There is no production compatibility decoder or committed
   migration framework.
3. JSON is authoritative for reusable full states. Route support may expose
   semantic IDs and focused one-to-few-command mutations from a checkpoint; it
   may not contain another complete-route reconstruction path.
4. Command, codec, history, progressive-authoring, repair, and undo/redo tests
   remain command-driven when the construction is the behavior they own. Their
   setup must be local to that authority rather than a shared shadow fixture.
5. Structurally representable incomplete or context-invalid projects may be
   typed JSON fixtures. Codec-invalid raw documents remain a separate raw
   contract corpus and never pass through typed checkpoint loaders.
6. Static JSON import edges remain explicit so `vitest --changed` can select
   affected consumers. Normal imports remain route-scoped; no executable root
   fixture barrel returns.
7. One typed registry pairs every manifest entry with exactly one static JSON
   import and lazy frozen loader. Integrity compares registry IDs, manifest IDs,
   and discovered typed JSON files as sets; positional parallel arrays and
   independently maintained loader lists are forbidden.

## Current Duplication to Retire

The permanent shadow graph is:

- `test/fixtures/authored-project/underworld.ts` — 937-line complete F-I command
  reconstruction;
- `test/fixtures/authored-project/surface.ts` — 637-line complete N-Q command
  reconstruction;
- `generation/canonical.ts`, builder equivalence, writer, and writer tests;
- writer-only and dead integrity Vitest configurations;
- the unused `combat08-artificer.ts` fixture; and
- the opaque whole-document fixture digest suite, whose canonical rows duplicate
  manifest hashes.

`routes/surface.ts::appendNEntry`, `appendCompleteN`, and the rebuilding branch of
`createRepresentativeNProject(options)` are also reusable full-state builders.
Consumers must move to a saved N checkpoint plus focused deltas or to a named
JSON scenario. A narrowly local command sequence may remain only in tests whose
subject is Hub construction/progressive repair itself.

The Underworld alternate miniboss and Preboss helpers are acceptable only while
they remain small checkpoint-derived semantic deltas. Conversion, Pom, Shop,
trait-offer, room-action, and similar helpers require an exact construction-size
and consumer audit. In particular, `createFMidshopPomFrontierProject` is a
reusable full F reconstruction and must become a named JSON checkpoint;
its unresolved Blind Box case may remain only as a focused delta from that
checkpoint. A helper remains permanent only when it starts from a checkpoint and
applies one-to-few commands, or when a named command-authority test directly
asserts the construction/progressive-repair commands themselves.

### Full-builder caller disposition ledger

No current direct caller owns the long shared setup replay. The approved
replacement groups below are exhaustive; there is no shared-builder exception.

| Replacement state                       | Direct callers / owned behavior after load                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `surface-n-entry-frontier`          | `DecisionWorkbench.test.tsx` N provisional helper; both N closure cases in `structuredWorkspace.contract.test.ts`; `BiomeWorkspace.test.tsx` unavailable Run State, PreHub-to-Hub undo/redo, and invalid-reward terminal control; `HubDecisionWorkbench.test.tsx` post-authoring keyboard membership; `inspector-defaults.test.ts`, `inspector-destinations.test.ts`, `interaction-binding.test.ts`, `topology-interaction-assembly.test.ts`, and `hub-assembly.test.ts` terminal/first-visit projection contacts; `entry-takeover-baseline.test.ts` and both `materialization.test.ts` predecessor/takeover cases. Each test retains only the subsequent Hub command or projection assertion. |
| Existing `surface-n`                    | `entry-takeover-baseline.test.ts` Opening/PreHub lifecycle; `GoldenSurfaceProductLoop.interaction.test.tsx` Hub reorder and ninth-slot close workflows; `biome-semantic-assembly.test.ts` authored N order; `hub-assembly.test.ts` both board/overlay cases; `biome-presentation.test.ts` Run State/handoff and complete-side comparison; `HubDecisionWorkbench.test.tsx` provisional open, maximum keyboard open, compact open/edit/close, closed-slot focus, and reward focus                                                                                                                                                                                                                |
| New `surface-n-complete-hub-frontier`   | `entry-takeover-baseline.test.ts` terminal matrix and undersized-retained case; `RunStateProductLoop.interaction.test.tsx` Preboss handoff; `BiomeWorkspace.test.tsx` handoff focus; `topology-interaction-assembly.test.ts`, `candidateInteractions.test.ts`, `inspector-defaults.test.ts`, `inspector-destinations.test.ts`, and `interaction-binding.test.ts` Hub handoff contacts; `HubDecisionWorkbench.test.tsx` two-visit, tail/rank/drop/drag, completed-handoff, and related board interactions; `run-state.test.ts` reached Preboss frontier                                                                                                                                         |
| New `surface-n-partial-hub`             | `biome-presentation.test.ts` replacement/truncation projection; other two/three-visit Hub workbench cases use this checkpoint plus at most one `ReplaceHubVisitOrder`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| New `surface-n-story-board`             | `HubDecisionWorkbench.test.tsx` Medea card; `OccurrenceWorkbench.test.tsx` fixed Hub heading; `TraitOfferEditor.test.tsx` Medea reevaluation; `occurrence-encounter.test.ts` Story repick; `field-npc-encounters.test.ts` Medea chronology; `rewards-validation-candidates.test.ts` fixed Story target. One-off alternate room sets apply only close/open/order deltas after loading.                                                                                                                                                                                                                                                                                                          |
| New `surface-n-ten-open-invalid`        | `createApplication.editorSessionReconciliation.test.ts` finding-owner removal and `HubDecisionWorkbench.test.tsx` ten-door invalid picker; each retains only its reward edit after load                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| New `underworld-f-midshop-pom-frontier` | `DecisionWorkbench.test.tsx` Midshop link; `PomResolutionProductLoop.interaction.test.tsx` unresolved outgoing frontier; `pom-level-resolution.test.ts` unresolved frontier, continuation equality, and downstream assessment; `f/candidates.test.ts` Blind Box case retains only offer/order deltas                                                                                                                                                                                                                                                                                                                                                                                           |

Additional one-off cases use the nearest named checkpoint plus the ledgered
one-to-few commands: close three Hub slots for the undersized board; close/open
one alternate Hub room and replace order; or replace one visit order for the
six-god-source case. The opaque `authored-project-fixtures.test.ts` partial/Story
rows are deleted rather than migrated because the named JSON and integrity
owner supersede them.

The exact commands performed after loading remain owned by their existing
tests: Hub open/close/reorder/handoff/undo, Story selection/visit order,
Midshop continuation, and Blind Box offer/order edits. None authorizes retaining
`appendNEntry`, `appendCompleteN`, option-driven full-Hub reconstruction, or full Midshop
reconstruction as shared support.

## JSON Corpus and Manifest

The existing seven canonical prefixes remain. Add a JSON checkpoint only when a
state is reused, expensive to reach, obtained from an editor save or generated
reproduction, or materially clearer than a setup recipe. Recurrent N partial,
alternate-open-set, completed-handoff, and F Midshop Pom frontier states become
named JSON fixtures when migrating the current full builders; do not create a
snapshot for every one-command variation.

Every typed fixture has manifest metadata for:

- stable ID and file;
- route and exact configured biome prefix;
- schema and catalog version;
- concise scenario intent;
- artifact provenance such as editor save, generated state, or minimized bug
  reproduction;
- intended validity/incompleteness notes when relevant; and
- SHA-256 of its exact canonical encoded bytes.

Builder function names are not fixture provenance.

The integrity gate must prove:

1. registry IDs, manifest IDs, and files are unique and exactly cover all typed
   `*.runplanner.json` checkpoint files;
2. each raw file strictly decodes with the current catalog;
3. exact raw bytes equal canonical production encoding, so whitespace or key
   drift fails rather than being normalized away;
4. exact SHA, schema, catalog, route, and configured biome prefix match the
   manifest;
5. route-scoped loaders return stable frozen identities;
6. applying a focused mutation never mutates the cached base; and
7. representative incomplete/context-invalid fixtures retain their authored
   state and repair addressability.

Adding a fixture is one closed operation: add the canonical JSON, one manifest
entry, and one registry entry with a static import. The fixture-addition witness
must prove its metadata, strict canonical decode, frozen cached identity, and a
normal static consumer edge selected by `test:changed`.

Do not retain whole-document hashes for checkpoint-derived variants as a second
semantic authority. Test their intended changed facts directly.

## Schema and Catalog Change Workflow

For a shape-only schema bump, create a bounded one-time raw JSON transformer in
the schema commit:

```text
parse old JSON as unknown
-> explicitly transform old shape to new shape
-> strict-decode with the new production codec/catalog
-> canonical-encode and replace the fixture
-> update manifest metadata/hash
-> run fixture integrity and the full gate
-> delete the transformer in the same commit
```

A semantic schema or catalog change requires an explicit decision for each
affected fixture intent. Updating only version strings is forbidden. This is a
bounded corpus review, not reconstruction of every route command by command.

## Delivery Gates

### Gate A — JSON authority cut

- Freeze a pre-implementation disposition ledger for every direct
  `appendNEntry`, `appendCompleteN`, and option-driven
  `createRepresentativeNProject` caller.
  Each row names the caller/test, required starting state, its replacement
  checkpoint plus one-to-few-command delta, or the exact named command-authority
  test allowed to retain local construction. Category-wide exceptions are not
  accepted.
- Capture the recurrent N and F Midshop states needed to replace reusable full
  builders.
- Strengthen the checkpoint manifest and integrity owner.
- Migrate normal consumers to saved states plus focused deltas.
- Delete both legacy full-route builders, permanent generation/equivalence/
  writer machinery, unused fixture support, obsolete scripts/configs, and the
  duplicate digest suite.
- Retain root `npm run check -> test:fixtures:check` as an independent gate.

Acceptance:

- no permanent complete F-I or N-Q reconstruction path remains;
- no normal import or call to shared `appendNEntry`, `appendCompleteN`,
  option-driven `createRepresentativeNProject`, or
  `createFMidshopPomFrontierProject` remains;
  any retained construction is local to the named command-authority tests in
  the disposition ledger;
- no normal consumer imports generation support or an executable root barrel;
- each former full-builder consumer is either checkpoint-based or explicitly a
  command-authority test;
- the seven canonical scenarios, fixed-N alias, three Underworld alternate
  miniboss/Preboss combinations, Surface partial Hub, and Surface alternate
  open-set facts remain covered through artifact integrity or explicit semantic
  assertions;
- registry, manifest, and discovered fixture-file closure is exact and a new
  named fixture has the required strict loader/integrity/changed-graph witness;
- a whitespace mutation fails integrity and reaches a normal consumer through
  `test:changed`, after which the file is restored;
- fixture check, typecheck, affected engine/planner/UI/product lanes, lint,
  formatting, diff check, and build pass; and
- the exact deleted and replacement LOC are reported.

Commit: `refactor(test): make saved projects the fixture authority`.

### Gate B — Durable closure

After independent review, absorb the JSON-first fixture and one-time schema
migration rules into the smallest durable architecture/testing authority and
implementation progress, delete this temporary plan, and run one final
`npm run check`.

Commit: `docs(test): close json-first fixture correction` unless the closure is
small enough to remain in the reviewed Gate A commit without obscuring its
implementation boundary.

## Explicit Non-Goals

- production behavior or authored-schema changes;
- serializing derived engine/application/UI output;
- a permanent migration framework or compatibility decoder;
- deleting command-owned tests or replacing their subject with snapshots;
- snapshotting every small variation;
- changing lane membership, workers, timeouts, retries, or isolation; and
- editing fixture JSON manually without strict canonical and semantic checks.
