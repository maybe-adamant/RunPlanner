# Topology command and decoding ownership

## Status and base

Status: locked for implementation; Slice A is next.
Production base: `f50d0cf3`.
User approved implementation. Commit this contract and investigation first.

Independent pre-plan challenge completed: retain one exhaustive command router,
context-bound decision validation, and one shared lazy attachment memo. These
constraints are incorporated below; no implementation is authorized by this
document alone.

Evidence: `docs/investigations/TOPOLOGY_COMMAND_AND_DECODING_BOUNDARIES.md`.
This is code-ownership work, not new game modeling. No game-rule changes or new
planner simplifications are proposed.

## Objective and scope

Make topology edits and document decoding maintainable as distinct authorities
with clear internal neighborhoods. User-visible behavior, persisted documents,
error contacts, authored identity, and repair semantics remain unchanged.

Included: topology command families; structural decision decoding; their exact
composition boundaries, consumers and primary tests. Existing atomic capacity,
selection-state and removal owners remain authoritative.

Excluded: generic graph services, new validation rules, simulation/candidate
refactors, new topology models, schema/protocol changes, UI changes, broad
query reorganization, leaf payload redesign, and algorithmic optimization.
Room replacement and detour handlers are neighboring consumers and regression
contacts, not additional rewrite targets. A discovered defect is characterized
and proposed separately rather than silently folded into movement.

## Governing authority

- `docs/design/AUTHORED_PROJECT_MODEL.md`: Common Decision Model; Starts,
  Batches, Preboss, and Completion; N Hub Progression; Occurrence State and
  Replacement; Commands; Persistence and Validation.
- `docs/design/GAME_GENERATION_RULES.md`: Ordinary batches; Preboss batches;
  Shared source support.
- `docs/design/ARCHITECTURE.md`: dependency rules and refactoring discipline.

Everything implemented here belongs to the planner engine's authored-project
lane. Catalog declarations remain inputs. Simulation consumes decoded topology
unchanged. Application/React and execution-plan consumers receive no new API.

## Locked implementation constraints

1. Commands construct or explicitly repair immutable proposals. Decoders
   validate external structure and derive ownership; they never repair it.
2. `commands/dispatch.ts:applyProjectCommand` retains its existing ordered
   command-wide closure and final decode. Extracted handlers neither invoke
   that pipeline again nor publish intermediate edits. Preserve no-op identity.
3. Rebase, capacity reconciliation, removal closure, selection and entry-state
   changes remain one atomic transition. Preserve occurrence IDs, retained
   exit-key subtrees, old source-owned additional exits and compatible leaves.
4. Preserve incomplete/context-invalid representability. In particular, normal
   narrower replacement may retain recognized overflow keys until explicit
   repair; Anomaly keeps its existing atomic capacity behavior. Arbitrary exit
   keys remain corrupt input.
5. Preserve takeover whole-batch semantics, selected fixed completion chains,
   Hub envelope/handoff rules and local-visit ownership. Do not flatten them
   into a generic detour or graph mutation model.
6. Preserve decoder validation order and diagnostic paths. The additional-exit
   memo remains invocation-local and lazy, decodes each requested attachment
   once, and returns the resulting arrays in the complete structural product.
7. Preserve the structure-to-occurrence handoff: resolved role and entry-active
   facts belong to structural decoding; leaf decoding consumes them. No
   recomputation from a result-keyed sidecar or new ambient registry.
8. Keep current traversal/work shape. Do not introduce eager passes, replay
   decoding, or new indexes merely to facilitate extraction.
9. Retain existing `query`, `impact`, capacity reconciliation and selection-state
   authorities. Similar command and codec guards are not automatically duplicate
   policy: one guards construction, the other untrusted input.

## Intended organization

Paths are relative to `packages/planner-engine/src/authored-project/`.

- `commands/topology/`: an explicit dispatcher and cohesive command families
  for ordinary authoring, takeover/completion, and Hub/local visits. Retain
  larger ordered functions when they own one atomic edit. Shared occurrence
  construction may have one concrete home here if required by multiple families.
- `topology/decoding/`: structural coordinator and decision-form decoding, with
  supporting raw types/decoding functions only where required. Whole-topology
  relational checks and ownership assembly remain together initially.
- `topology/codec.ts`: retains the existing small structure/leaf composition.
  Existing occurrence and leaf codec files need not move into the new directory
  merely for symmetry.

Use these final neighborhoods during the first move. Do not add forwarding
facades, one-file-per-command/check fragmentation, or barrels solely for import
convenience. A dispatcher is a real supported internal entry, not a forwarding
layer. Existing shared reconciliation modules may remain where they are;
moving them is justified only by their actual consumer boundary.

Extracted functions receive their concrete inputs and return a complete
decision, topology, or decoding product. Do not pass mutable coordinator state
through a wrapper or introduce a callback table of command operations. The
existing narrow lazy attachment reader may cross decision-decoder calls; it is
not permission to add a general decoding service context.

## Slice A — Command-family ownership

Starting points: `commands/topology.ts:applyTopologyCommand`, `createTarget`,
`replaceTakeoverBatch`, `reconcileCompletionChain`, `setExitSelection`,
`updateHub`, `updateLocalVisit`, and `defaultOccurrence`.

Deliverables:

- Move the distinct command families into the final command neighborhood with
  one exhaustive dispatcher. Ordinary envelope/target setup remains coordinated;
  takeover/completion and Hub/local operations get cohesive homes.
- Assign every `TopologyCommand` member exactly one owner. Keep selection,
  ordinary capacity/reward/cage edits and general removal/clear with the ordinary
  topology command owner; they may compose completion/removal transitions but
  must not become duplicate entry points in multiple families.
- Keep the complete rebase operation and its call to capacity/entry-state repair
  together. Reuse removal closure and shared query functions without copying them.
- Keep default occurrence creation as composition of existing declaration-owned
  defaults; do not create a new defaults policy or service container.
- Update dispatch and affected direct consumers; remove the old implementation
  file, with no compatibility export or second path.
- Inspect the repeated Preboss role classifiers. This slice preserves their
  existing admission/error behavior; consolidation is not required. Do not force
  them into one function merely to remove short boundary-specific guards.

Primary acceptance: existing topology command tests, route-detour tests, room
replacement tests, completion-boss tests, and impact/query tests. Specifically
retain the existing normal-to-normal, normal-to-Chaos, normal-to-Contract and
normal-to-Anomaly continuation witnesses; takeover physical-key retention;
N terminal-envelope replacement/restoration and completed-handoff removal.

Review against: complete atomic edits, no-op returns, unchanged command error
ownership, no policy moved into composition, no new decoder calls, no circular
family dependencies. Commit this complete slice after independent review.

## Slice B — Structural decoding ownership and closure

Starting points: `topology/structure-codec.ts:decodeTopologyStructure`,
`decodeExitDecision`, `decodeHubDecision`, `decodeLocalVisitDecision`,
`DecodedTopologyStructure`, and the invocation-local `additionalExitsFor` memo.

Deliverables:

- Separate decision-form decoding from the structural coordinator in the final
  decoding neighborhood. Keep raw-input checks and boundary diagnostics at
  their existing logical points; do not eagerly predecode all attachments.
- Decision decoding remains context-bound: it receives catalog, layout,
  occurrence/path lookup, the relevant start identity and the same lazy
  attachment reader. Preserve its local declaration/source/target, batch,
  takeover, slot and visit checks and its frozen decision products. It is not
  a syntax-only parser. Global duplicate-source, reachability and ownership
  checks stay with the coordinator.
- Keep exactly one attachment memo per structural decode. Neither per-family
  caches nor an eagerly predecoded map replace the existing first-demand
  callback behavior.
- Keep the selected-spine/fixed-link/ownership checks as one coordinated stage,
  preserving their current execution order. This slice does not require further
  decomposition of the remaining coordinator.
- Preserve the complete structural result and update `topology/codec.ts` and
  occurrence-codec type consumers. Remove the displaced structural file rather
  than leave a forwarding shim.
- Keep duplicate-source, cycle, orphan, detached-source and completion errors
  in decoding even where commands already prevent their construction.

Primary acceptance: existing structural, relational and leaf codec suites.
Named contacts include invalid-start precedence over malformed attachments,
first-demand additional-exit diagnostic paths, Q selected-spine validation
independent of decision storage order, strict N local ownership, and exact
fixed completion. Existing command tests provide positive command-to-decoder
workflows; do not replicate their full matrix as new codec tests.

If attachment decode-once work is not directly covered, add one narrow witness
using a test-owned observer at the actual decode contact, not a production
counter/registry or a test that duplicates decoding policy. Preserve existing
first-error witnesses instead of adding a broad malformed-input cross product.

Review against: unchanged error order, complete products, no mutation of the
coordinator's owner/reachability builders by delegates, no repeated attachment
decode, unchanged encoded documents. Perform independent review, then the
combined closure below before committing this slice.

## Verification, orchestration and retirement

The main session owns the live diff, scope, focused packets, Git and closure.
Use one write-capable executor, reuse it for the adjacent slice/remediation,
and use a fresh independent reviewer for each stabilized slice. Packets name
only the relevant source symbols, authorities, exclusions and acceptance tests.

Use narrow engine tests, TypeScript, touched-file lint/format and diff checks
during implementation. Keep each policy matrix with its existing primary test
owner. Test movement is optional when current suites already own the boundary;
new fixture families, broad test rewrites and negative historical tests are not
deliverables. No execution fixture regeneration is expected.

After Slice B review remediation is stable:

- Review A and B together for preserved ownership, atomicity, imports, public
  exports, diagnostics, deleted paths and unexplained production growth.
- Run one complete `npm run check` and an explicit performance comparison
  against production base `f50d0cf3` (not merely the Slice A commit). Do not set
  a global comparison-base environment variable around repository tests.
- Promote the minimal lasting ownership guidance into existing architecture and
  authored-project design docs. Delete this plan and its investigation in the
  closure change; leave unrelated progress documents alone.
- Record truthful verification results in the closure commit. Do not create a
  separate implementation diary.

Success means narrower change neighborhoods with the same accepted documents,
commands, diagnostics and work shape—not a prescribed line or file count.
