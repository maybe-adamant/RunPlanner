# First Assessment Issue

Status: Gate A accepted after two independent reviews. Gate B is next.
Base: planner `ae636aba`, including the separately verified P Fig Leaf interaction fix.

## Outcome

The planner explains the next repair needed for assessment to continue, rather
than displaying every known missing value as concurrent work. A blocked route
publishes one engine-owned assessment issue: one semantic repair owner with
the related reasons at that assessment stop. The compact banner consumes that
product directly. Repairing it and reevaluating reveals the next issue.

For a boon room with an unauthored trait offer and missing outgoing doors, show
the trait issue first. Only after it is repaired should the missing doors become
the active issue. Multiple invalid options or nested targets in one trait offer
belong to one offer repair, with their precise explanations retained.

Engine selection and publication come first. Do not start banner work until the
engine gate passes review. This changes diagnostic policy, not authored order,
game rules, or the freedom to repair and rearrange actions within a room.

## Authorities and evidence

Read `docs/design/SIMULATION_AND_VALIDATION.md` in full before engine work,
especially Completeness, Validity and Coverage; First blocking region;
Settlement Handoffs; and Findings and Repair. Application authorities are
`EDITOR_MODEL.md` Findings and Navigation and
`STRUCTURED_EDITOR_WORKSPACE.md` Progressive Coverage and Findings and Desktop
Sizing and Scroll Ownership. Candidate repair remains governed by
`CANDIDATE_EVALUATION_MODEL.md` Trait Offer Candidate Boundary.

This delivery is grounded in current planner behavior, not a new native-game
rule. Source-backed eligibility and lifecycle rules remain unchanged.

| Current contact                                                     | Established behavior                                                                                                   | Required disposition                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `simulation/progressive/finding-location.ts`                        | `firstUnsupportedFinding` orders errors using semantic/history locations; `findingsAtRegion` retains co-owned reasons. | Reuse this chronology and region selection, not a second priority engine.                            |
| `simulation/progressive/clamp.ts`                                   | Assessment and repair prefixes preserve blocked-owner capabilities while withholding later assessed effects.           | Preserve that distinction and the complete repair products.                                          |
| `simulation/completeness.ts`                                        | Required setup can precede the first structural frontier and the first array entry.                                    | Select the actual prerequisite, not `findings[0]`.                                                   |
| `simulation/evaluation/biome-evaluation.ts`                         | Incomplete publication can concatenate later structural findings before earlier progressive findings.                  | Publish one selected issue instead of exposing the concatenation as the repair agenda.               |
| `simulation/finding-regions.ts` and trait selected-child settlement | Atomic grouping already associates several child reasons with one trait offer; precise child origins remain distinct.  | Carry the group's semantic owner explicitly where needed; retain child evidence.                     |
| `simulation/evaluation/project.ts`                                  | Route-start validation is separate; resource errors are appended after biome evaluation.                               | Route-start and resource errors must participate in the same one-issue contract.                     |
| `isProgressiveBlockingFinding`                                      | `figLeafSkipUnavailable` is excluded from complete-plan clamping.                                                      | Resolve this retained-invalid exception before claiming every blocked route has an assessment issue. |
| `hermesShrineDeliveryPlacementForPurchaseReschedule`                | Uses detailed findings to locate the simulator-owned delivery host.                                                    | Preserve placement evidence independently of the banner's selected issue.                            |

A read-only live probe confirmed these products before the independent Fig Leaf fix:

| Authored state                                    | Existing identified blocker | Current published findings                      |
| ------------------------------------------------- | --------------------------- | ----------------------------------------------- |
| F opening boon without offer or outgoing decision | Trait offer                 | `continuationMissing`, then `traitOfferMissing` |
| The offer is repaired                             | Outgoing decision           | `continuationMissing`                           |
| An empty outgoing batch is created                | Batch reward pool           | `targetMissing`, then `batchRewardStoreMissing` |

The existing four `progressive-findings.test.ts` tests passed during assessment.
This is characterization evidence, not delivery acceptance.

## Contract

### One issue, complete evidence

Expose one data-only assessment issue, or none, through project evaluation.
Its essential content is the existing incomplete/invalid distinction, the
semantic repair owner, and a nonempty collection of related finding reasons.
Names and internal representation may follow the existing evaluation types;
do not build an issue registry or extensible diagnostic framework.

- An incomplete or invalid configured route has exactly one selected issue.
  A valid route or the existing unconfigured empty state has none.
- The selected issue is the earliest unsatisfied assessment region. It is not
  the earliest rendered control, earliest array entry, or most severe-looking
  message. Warnings do not establish a blocking issue.
- Structural incompleteness, reached invalidity, route-start failures and
  resource/encounter errors use this same selection policy. Earlier invalidity
  must not be displaced by later incompleteness.
- One repair can have several reasons. Exact duplicates collapse using the
  existing semantic identity, while distinct option, child and branch evidence
  remains available. Do not turn each reason into another route-level issue.
- Preserve the exact child origins. The issue's containing owner may be the
  trait offer while a reason identifies All Together, Natural Selection or a
  targeted acquisition within it. Do not assign all failures to the room or
  to a generic acquisition parent.
- The containing repair owner does not replace the exact blocked leaf used by
  clamping and candidate retention. Both come from the same selected region;
  grouping the explanation must not move the assessment stop.
- Reuse existing atomic groups for jointly assessed choices. Where independent
  repairs share a checkpoint, use the engine's declared semantic ordering for
  a deterministic first repair; do not invent chronology from UI order or
  introduce a global finding-code priority list.
- If a region currently has only an opaque string key, carry its semantic
  owner from its producer when needed. Do not parse keys to recover addresses
  or let the application reconstruct group membership.

Detailed evidence is not a second user-facing backlog. Preserve evidence and
capabilities required by validation, candidates, local editors and delivery
placement at their owning products. Project and route `findings` retain their
detailed evidence for workspace markers and session reconciliation; the selected
`issue` alone supplies the aggregate repair agenda in Gate B. Delivery rescheduling
reads the owning reward evidence. Do not introduce another independently selected
issue list. The primary issue must be derived from the same selection that governs
assessment publication.

### Assessment is not edit locking

Keep the existing separation between exact assessment stop and authoring
readiness. Incompleteness still locks after the repairable loadout, occurrence
interior or outgoing-decision region. Invalidity alone adds no authoring lock.
Do not derive readiness from the banner owner or require users to repair each
inner-room field in a prescribed click order.

An issue must retain the pre-effect candidate context and the visible authored
repair surface. Later authored data stays retained, even when its assessment
and diagnostics are deferred. Publishing, selecting or replacing an issue never
changes authorship or creates an Undo entry. The user's repair remains an
ordinary undoable semantic edit, with existing command-owned reconciliation;
advancing to the next issue does not itself navigate or delete downstream data.

### Existing exceptions

Resource-placement errors must enter first-region selection at their exact
room-feature owner instead of being appended after an unrelated earlier stop.
That repair owner does not establish their assessment timing. For a reached
placement, use the existing `roomExited` effect boundary: an earlier same-room
trait or encounter failure must win over a resource effect failure. Do not let
the generic `roomFeature` location sort it ahead of the entire timeline. When
the host is missing or not yet reachable, retain the truthful structural
prerequisite/owner stop instead of fabricating an exit event. An already generated
but unpicked host has a structural repair at its actual `roomCreated` boundary;
its resource feature remains removable without entering that room. Use existing
resource assessment and effective-placement policy; do not invent an element
grant for an invalid placement or rewrite resource timing.

An invalid Fig Leaf skip remains authored and repairable but must acquire a
truthful first assessment stop. Do not silently simulate the normal encounter
as an authoritative continuation of that invalid choice, downgrade the error
to a warning, or remove the authored skip. Valid skipped/normal encounters and
their clocks remain unchanged. Retaining products solely to support repair is
distinct from publishing later assessed state.

If either correction cannot preserve the owning repair capability with the
existing clamp, report the concrete conflict and amend this bounded gate before
adding a second evaluator or broad lifecycle changes.

## Ownership and exclusions

- **Engine:** error production, semantic grouping, chronology, first issue,
  assessment coverage, detailed evidence and exact candidate capabilities.
- **Application projections:** translate the selected issue and its reasons
  into copy and one existing workspace repair destination. No priority policy.
- **Redux/session:** explicit issue navigation and stale-selection cleanup.
- **React/CSS:** compact presentation and accessible interaction only.
- **Catalog/authored model/game module:** no expected changes.

No schema or execution-protocol bump, file migration, fixture regeneration,
new scheduler, eligibility rewrite, readiness redesign, automatic repair,
all-findings browser, filtering UI, or unrelated directory reorganization.
Candidate-local explanations and trait-draft validation are not replaced by
the route's selected issue.

## Delivery gates

### A — Engine issue selection and publication

Own the engine correction end to end, including the two exceptions. Start in
`simulation/{completeness.ts,finding-regions.ts,progressive/,evaluation/}`;
touch resource, Fig Leaf and trait-child producers only at their exact handoffs.

1. Characterize the three probe states with real command-built projects. Map
   consumers of public findings, stop fields and required-input fields before
   changing their contracts.
2. Publish the selected semantic issue from the existing assessment selection,
   including route-start and pre-materialization failures. Preserve related
   reasons and explicit group ownership through clamping and route assembly.
3. Correct completeness/progressive selection and integrate resource/Fig Leaf
   errors. Remove superseded post-hoc error appending and clamp exclusions.
4. Preserve detailed consumer contracts, especially nested target candidates
   and Hermes delivery placement. Make existing coverage/status publication
   agree with the selected stop; no unused interface-only scaffold.

Primary tests: existing `test/simulation/progressive-findings.test.ts`,
`progressive-clamp.test.ts`, `progressive-selected-products.test.ts`,
`authoring-readiness.test.ts`, and the owning resource/Fig Leaf tests. Add a
focused issue-publication test only if it gives the new public product one
clear primary owner. Existing work-count witnesses protect against extra full
replays; do not add another simulation solely to choose the message.

Acceptance: all matrix rows below have the correct engine disposition and
repair capability; valid baseline evaluation and execution products remain
unchanged. Run affected engine tests and types, then independent review.
Commit this coherent engine correction before presentation work. Adapt compile
contacts if needed, but do not redesign the UI during this gate.

### B — Application consumption and compact repair banner

Only start after A is accepted. Start in `projections/evaluationProjection.ts`,
`projections/structured-workspace/navigation/`, `workspace/editorSessionReconciliation.ts`,
`ui/feedback/EvaluationFeedback.tsx`, `ui/shell/RouteWorkspace.tsx`, and their
owning styles/tests.

Replace the route-wide card grid with one compact issue: clear repair title,
specific destination and concise explanation. Reuse the existing semantic
navigation/highlight path. For a trait issue, navigate to its Timeline editor
launcher; do not automatically open a dialog or introduce a second routing path.
Detailed option/target explanations remain inside the owning editor.

Use the same grouped issue for route/biome/rail summaries; a single offer with
three reasons is not three pending tasks. Precise local reason highlights may
remain within its editor. Later structural diagnostics must not independently
reappear as route counts, banners or highlighted tasks.

The banner must not contain a scrollable wall of reasons, require dismissal,
or reserve an empty findings panel when there is no issue. Allow sensible text
wrapping rather than a rigid height that clips explanations. Keep the existing
editor scroll ownership and avoid an unbounded mobile list. No new dropdown,
drawer, or findings-management subsystem is required.

Preserve explicit-click navigation, keyboard access, rail selection, red repair
feedback, Undo/Redo and stale-selection cleanup. New blockers update the banner
without stealing focus. Issue identity follows the semantic repair region, not
the first reason's message or array position. Existing blocked-biome context may
remain where it explains the viewed page, but must not become a competing
actionable issue.

Primary tests: projection/contract tests for issue adaptation; focused UI tests
for the banner and navigation; representative product-loop witnesses for
ordinary-room repair and a nested trait repair. Reuse existing real fixtures;
do not duplicate the engine policy matrix in React tests. Review independently
and commit application consumption with the replaced presentation removed.

### C — Closure

Run one complete `npm run check` after focused checks and review remediation
stabilize. Inspect compact desktop/16:9 and narrow layouts with zero, one and
multi-reason issues; user acceptance covers visual feel. Do not claim automated
DOM tests prove native browser layout.

Update the owning explanation in `SIMULATION_AND_VALIDATION.md` and
`EDITOR_MODEL.md`; adjust only affected finding/scroll wording in
`STRUCTURED_EDITOR_WORKSPACE.md`. Replace obsolete all-findings language instead
of appending bug history. Remove this temporary plan at closure and record
verification in the closure commit. Do not close unrelated pending plans.

## Engine acceptance matrix and audit-againsts

| Case                                                          | Required result                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Missing route-start keepsake result and missing opening setup | Loadout issue first; first occurrence remains locked under existing policy.                                                  |
| Missing room trait and missing outgoing decision              | Trait issue first; repairing it reveals the outgoing issue.                                                                  |
| Missing batch pool and missing target rooms                   | Pool prerequisite first, regardless of structural findings array order.                                                      |
| Earlier invalid choice and later missing value                | Earlier invalid issue; no new invalidity-based edit lock.                                                                    |
| Several invalid Hammer options                                | One offer issue retaining distinct per-option reasons.                                                                       |
| Missing nested All Together/Natural Selection/targeted result | One containing-offer issue; exact child context remains repairable and no unresolved effect is applied.                      |
| Hub board, visit and side-room chronology                     | Respect actual board/visit/restore ownership, not rail indexes or parent-room approximations.                                |
| Ship phases and fixed Preboss/Boss/Postboss links             | Preserve exact phase/occurrence order and independently repairable rooms.                                                    |
| Invalid resource before or after another error                | Actual assessment chronology wins; include a same-room pre-exit trait/encounter failure before the resource exit effect.     |
| Resource host missing or not yet reached                      | Truthful structural repair remains available; no fabricated exit event or resource error overriding an earlier prerequisite. |
| Invalid Fig Leaf skip                                         | Authored choice retained; exact encounter repair preserved; no authoritative assessed suffix past its stop.                  |
| Hermes delivery rescheduling/placement                        | Still resolves the exact host from owning evidence/capability, not a UI-selected reason.                                     |
| Repair, Undo and repeated evaluation                          | Deterministic issue progression, stable semantic identity, no navigation or authored-state side effects.                     |
| Empty/valid route and warnings                                | No fabricated blocking issue; warnings do not become errors to populate the banner.                                          |

Engine tests own the complete policy matrix. Existing nonlinear and lifecycle
fixtures provide representative contact; do not build a new full-route fixture
for every row. Test the first issue, retained detailed evidence, repair capability
and truthful coverage together, not just finding-array length.

## Deletions and review guardrails

- Remove competing first-issue inference and the two exception paths when their
  replacements land. Retain detailed finding aggregation for local repair consumers;
  it must not select the aggregate issue or become the route's repair agenda.
- Retire the multi-card banner, empty findings panel and obsolete list-only CSS
  in B. Keep reusable local-editor feedback and semantic destination contracts.
- Do not sort error codes, parse region strings, reuse normalized edit-lock
  boundaries as assessment chronology, or rebuild history in projections.
- Do not drop distinct child/branch evidence to achieve a length-one array.
- Do not add a general diagnostic registry, second chronology graph, runtime
  audit manifest, or engine concept named after a React control.
- Use focused gate packets and one write-capable executor at a time. Reuse an
  executor for coherent remediation and obtain a fresh independent review of
  each implementation gate; the main session owns commits and closure checks.

Before locking, challenge the plan against false single-issue grouping, repair
deadlocks, findings-dependent semantic consumers, valid-output changes and
unnecessary abstraction. User approval and a committed plan precede execution.

## Delivery verification

- Gate A's first review identified detailed-evidence truncation, dormant resource
  repair, and missing resource findings in hub candidate replay. All three were
  corrected and verified by that reviewer.
- A second independent review of the whole Gate A diff found no actionable
  findings. It traced chronology, exact repair products, Fig Leaf clamping,
  resource hosts, and findings-dependent consumers.
- Before review remediation, the full engine lane passed 1,955 tests. After
  remediation, 121 targeted engine/application tests passed, including the new
  dormant-resource repair witness, readiness, hub chronology, trait repair,
  Hermes rescheduling, and work-count coverage. Whole-workspace typecheck,
  lint, and diff whitespace checks passed.
- The full repository closure gate and visual acceptance remain Gate C work.
