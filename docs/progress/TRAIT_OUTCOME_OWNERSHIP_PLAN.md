# Trait Outcome Ownership and Settlement

## Status and objective

Status: locked; approved for implementation. Gate A is next.
Base: `7e0237f6` (clean production worktree when drafted).
Evidence: `docs/investigations/TRAIT_OUTCOME_TRANSPORT_AND_SETTLEMENT.md`.

Make trait outcomes complete owned products rather than independent fields
that every intermediary must remember to forward. Decompose settlement only
where that clarifies the same ownership boundary.

User-visible outcome: missing or invalid trait children remain discoverable,
editable, and correctly marked in an open draft and after save/reopen. Adding
an outcome family requires its engine interpretation and specialized editor,
not another checklist of fields across transport, marker, and completion code.

This is one plan delivered in successive complete slices. It does not lock a
generic framework or require reducing any coordinator to an arbitrary size.
Commit the approved plan and investigation before implementation.

## Authorities and ownership

- `docs/design/ARCHITECTURE.md`: Product Construction, Atomic Derived
  Publication, Authored-first workspace assembly, Feature Ownership.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: Commands and authored ownership.
- `docs/design/SIMULATION_AND_VALIDATION.md`: acquisition settlement and the
  Echo, All Together, Circe, and keepsake chronology contracts.
- `docs/design/CONTEXTUAL_EDITOR_UX.md`: Trait offer domains, exact local draft
  queries, lazy evaluation, invalid-value repair, and complete-offer Save.
- `docs/design/EDITOR_MODEL.md`: existing semantic finding/navigation model.

Catalog declarations remain game-fact authority. This plan changes no game
rules or declarations. Existing simulation policies, candidate domains, and
history folds remain semantic authority; decomposition must call them rather
than reproduce them. These are chosen software boundaries, not new game facts.

Engine ownership:

- Authored trait-outcome neighborhood: structural child identity, ownership,
  value access, and complete-draft replacement rules.
- Simulation trait/candidate neighborhoods: contextual applicability, support,
  branch agreement, exact repair contexts, and lazy child-domain queries.
- Reward settlement: explicit chronological composition and complete returned
  effects/findings/checkpoints.

Application ownership: adaptation to labels, interaction loading, finding
navigation, markers, and local editor-session state. React renders typed
specialized editors and invokes bound intents; it does not rediscover which
game effects need children or decide semantic completeness.

Execution assembly is a downstream consumer, not a new policy owner. Preserve
its current valid-plan wire product, including which dormant payloads it omits.

## Scope and family disposition

| Family                                  | Required treatment                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bridal Glow / Latest Model              | Common targeted-child transport, distinct existing target domains and effects.                                                                   |
| All Together                            | Owned per-set children; preserve exhausted `null`, branch agreement, outer acquisition, and subsequent grants.                                   |
| Natural Selection                       | Ordered increment payload; repeated targets and prefix-dependent candidates remain meaningful.                                                   |
| Circe                                   | Typed Arcana/Fear child outcomes; preserve valid empty results and provisional finding precedence.                                               |
| Echo Pom                                | Distinguish absent target from legal explicit no-op.                                                                                             |
| Echo Boon                               | Nested selected-row carrier uses the same ownership/transport mechanism, including targets, All Together, and Natural Selection.                 |
| Hex / Concave Stone                     | Offer-owned children, not option-owned values. Preserve Hex evidence and Stone's frozen residual acquisition.                                    |
| Echo Reward / Ransom                    | Carry existing derived feedback through the appropriate offer/outcome presentation boundary; do not invent authored values or required children. |
| Persephone / Calling Card / Rejected    | Preserve existing row/offer data and timing through the complete carrier. Do not reclassify them as post-selection target effects.               |
| Ordinary offers / Chaos / Fallback Gold | Preserve their existing discriminated forms. No invented children for ordinary traits; no flattening Chaos into ordinary options.                |

Excluded: scheduler work; later Steady Growth/Supply Chain outcomes; Embryo,
Judgment, Figurine, fountain, general Pom, and keepsake-equip redesign; broad
acquisition/topology cleanup; game-module changes; changes to incompleteness
horizons, offer legality, or Save policy.

No schema, catalog-version, or execution-protocol bump is authorized. Keep
existing authored fields; a derived carrier can eliminate transport duplication
without moving them into a persisted `payload` object. A demonstrated need to
change persistence or wire semantics requires a plan amendment first.

## Contract to implement

### Three products, one ownership vocabulary

Do not collapse authored structure, contextual evaluation, and settlement into
one ambient object.

1. **Structural discovery** receives normalized catalog facts, the exact offer
   address, known provider when the authored offer is unresolved, and the
   complete current offer/draft. It returns typed owned children, including
   structurally required children whose authored values are missing. This is
   pure authored-domain work: no simulation rerun, candidate query, or UI state.
2. **Contextual evaluation** uses the same child identity plus the complete
   local draft and exact prepared candidate capability. It returns the existing
   typed domain/support information. Private pre-offer histories remain private.
3. **Settlement** returns the resulting branch, finding entries, exact blocked
   child/candidate contact, and necessary dependency evidence. Its coordinator
   explicitly determines when each result applies.

Child identity does not replace the prepared capability's lookup owner. Retain
the existing trait-offer capability contact and pass the exact child selector
through it; do not accidentally key private artifacts by a new presentation
child or publish private histories to resolve a lookup mismatch.

Use a narrow discriminated child envelope: semantic owner/address, kind, and
typed authored outcome data with structural completion where determinable.
Separate contextual support from structural completion; do not invent a single
boolean that conflates incomplete, invalid, and unassessed.

The engine's structural read/update functions own mapping a child back into a
complete offer. Application bindings must not independently rebuild each
payload field. Functions receive explicit data; do not attach executable
capabilities to persisted or public evaluation objects.

Context-dependent children need special precision, not UI inference. Stone's
applicability/requiredness comes from its existing candidate capability, not
from catalog discovery alone. Structural discovery preserves an authored Stone
result even if the source is no longer applicable; its lazy domain resolves
support when coverage exists. Absence of coverage must not be interpreted as
absence of the child, a completed outcome, or a new mandatory Stone choice.

### Transport and editor behavior

- Both persisted workspace assembly and local draft interactions use the same
  structural discovery authority. Unsaved trait changes expose new children
  immediately. An evaluated snapshot is not the structural base of the editor.
- Intermediate application products carry a child collection, not one optional
  property per family. A typed binding endpoint adapts child kinds to their
  existing specialized domains/editors. Do not add a runtime registry.
- Marker collection and child traversal consume the collection uniformly.
  Preserve existing semantic addresses and the established finding navigation
  path; no generic JSON pointers or second finding-routing system.
- Aggregate completion consumes engine-owned child completion/support and
  existing complete-offer assessment. Do not silently strengthen or weaken Save
  behavior, treat all dormant rows as required, or mistake `null` for omission.
- Preserve local partial drafts and nested Echo editing. Do not require malformed
  partial UI data to decode as a complete persisted offer. Use the narrow typed
  partial representation needed by the current editor, with engine-owned
  completion rules, rather than an arbitrary payload bag.
- Rendering remains query-free where it is query-free today. Existing deliberate
  lazy boundaries and cache/work-count limits remain intact. Child collection
  construction does not eagerly load all domains. Cache identity includes the
  full draft, child identity, and exact evaluation assembly.
- Invalid outer values and unassessed authored suffixes retain their structural
  children. An unavailable capability reports unavailable; it never deletes the
  only repair control or substitutes downstream state.

### Settlement ordering

Keep a visible coordinator for source context, offer preparation/rarification,
evaluation, selected acquisition, child effects, and pending-effect consumption.
Extract substantive effect implementations, not every conditional.

Preserve Circe's post-outer/pre-effect repair point and provisional findings;
All Together's outer identity before direct grants; Echo's pre-choice domains;
Calling Card's valid spend before a later child failure; Yarn/Hymn retention on
incomplete screens; and Chaos screen accounting.

"Post-outer" names the reached repair boundary, not permission to equip every
parent trait before validating its child. In particular, retain Circe's existing
rule that an invalid exact outcome does not equip the effect-backed trait.
Do not impose All Together's acquire-then-grant sequence on other families.

Stone's secondary acquisition must retain the source row's frozen assessment
and levels without a fresh screen evaluation. Replace ambiguous combinations
of internal flags with a closed mode only where it makes these actual call
shapes explicit. No new acquisition-mode framework for hypothetical effects.

Each extracted effect returns every product its caller needs. Local mutable
builders are acceptable, but shared caller-owned finding-map mutation must not
remain the sole carrier of extracted settlement findings.

## Delivery gates and commit boundaries

### A — Complete settlement products and bounded effect ownership

Starting contacts:

- `packages/planner-engine/src/simulation/rewards/trait-settlement.ts`
- `simulation/rewards/acquisition-settlement.ts`
- `simulation/rewards/biome/encounter-acquisition/encounter-settlement.ts`
- `simulation/rewards/biome/selected-trait-products.ts`
- `simulation/traits/` and existing `level-resolution-settlement.ts`

Extract cohesive selected-child, encounter-child, Hex, and frozen-secondary
implementation where justified. Keep the atomic coordinator explicit. Return
complete findings/checkpoints and adapt the current production consumers in
the same slice. Establish shared child identities only where consumed now;
do not land unused editor APIs in anticipation of later gates.

Delete displaced inline implementations and the production-only convenience
wrapper `processEncounterTraitOffer`; tests consume the real complete result.
Do not move general eligibility or history policies into the new neighborhood.

Primary verification: existing All Together, Circe, Echo, Stone, Calling Card,
Jeweled Pom, Chaos, and shop trait settlement tests. Strengthen exact branch,
finding-owner, and checkpoint assertions only where the extraction exposes a
coverage gap. Check representative execution assembly output remains equal.

Review and commit this behavior-preserving engine slice before transport work.

### B — End-to-end core carrier transport

Implement structural discovery/update and lazy child query contact in the
authored and simulation ownership neighborhoods. Reuse existing candidate
evaluators behind the narrow typed contact; do not redesign the whole candidate
session. Complete the transport for targeted acquisition, All Together, and
Natural Selection through actual React editors.

Starting application contacts:

- `projections/candidateTraitAdapters.ts`, `candidateProjection.ts`
- `projections/structured-workspace/contract.ts`
- `assembly/occurrence-reward-assembly.ts`
- `interactions/trait-offer-interactions.ts`
- `navigation/marker-ownership.ts`, `finding-routing.ts`, `marker-builder.ts`
- `assembly/occurrence-action-markers.ts`
- `ui/editor/rewards/TraitOfferSelectedOutcome.tsx`,
  `TraitOfferSelectedSpecialOutcomes.tsx`, `traitOfferOptions.ts`

Paths above are under `apps/planner/src/`. Both reward-owned and
encounter-owned offers must use the new route, including shops and pickups.
Do not migrate only the easy reward launcher.

Delete migrated families' parallel workspace fields, candidate forwarding
methods, marker enumeration, and completion clauses where superseded. Remaining
families may keep their old path until C; no migrated family may be represented
by both mechanisms or require a compatibility forwarding layer.

Primary verification: engine structural/query tests own the family matrix;
interaction/finding tests own application binding. A real editor workflow must
select a targeted trait, encounter missing/invalid child state, repair it, save,
and reopen. Include All Together invalid-outer repair and a Natural Selection
ordered-prefix witness. Retain existing focused-query work-count tests.

Review and commit only when these families are complete vertical slices.

### C — Nested and offer-owned outcomes; remove remaining parallel transport

Migrate Circe, Echo Pom/Boon, Hex, Stone, and existing derived outcome feedback.
Reuse B's carrier mechanism for nested Echo outcomes rather than reproducing
its field list. Keep specialized React renderers and domain-specific endpoint
dispatch. Preserve Persephone, Calling Card, Rejected, Chaos, and exhaustion
authoring without forcing them into a new target-child model.

Additional starting contacts:

- `simulation/candidates/trait-offer-selected-effects.ts` and
  `trait-offer-capability.ts`
- `WorkspaceEchoLastRunBoonDraftRow` and carrier/domain types in the workspace
  contract
- `TraitOfferEchoLastRunBoon.tsx`, `TraitOfferCirceResolution.tsx`,
  `HexTreeEditor.tsx`
- `execution-plan/assembly/timeline-transactions.ts` for downstream preservation

Replace the current `carrierForDraft` path that casts partial Echo rows into a
complete nested offer for candidate evaluation. Establish a narrow engine-owned
Echo draft preparation/read/update boundary taking the exact outer offer and
option, typed partial nested rows, and selected row index. Structural results
describe the selected child's identity and completion even while rows are
incomplete. A query through the existing prepared candidate session evaluates
that draft lazily when its required identity/context is available; otherwise it
reports incomplete/unassessed explicitly without hiding retained children.
No public data result carries a callback or private history. The engine-owned
completed update maps the draft back into the outer offer, preserving all
nested carrier fields. Keep React's local draft/session ownership; do not
introduce a generic draft engine or relax the persisted codec to admit partial
rows. Update or retire `WorkspaceEchoLastRunBoonDraftRow` accordingly.

Remove remaining superseded optional family fields, generic-layer discovery
switches, completion field lists, and duplicate reward/encounter child assembly.
Explicit codec/semantic validation and specialized presentation dispatch remain
legitimate endpoints; do not remove them merely to achieve a switch-free diff.

Primary verification: existing Circe/Echo/Stone/Hex policy tests, plus nested
Echo carrier repair through an actual editor path and representative offer-owned
child preservation. Include source-removal repair for authored Stone,
Circe's legal empty draw, and dormant unselected payload retention.
Exercise an Echo draft with incomplete rows and a retained-invalid nested
carrier, then complete and save it through the actual editor interaction.

Review and commit the remaining complete transport slices. Do not leave a
temporary old/new carrier bridge for closure to finish.

### D — Holistic closure

Review producer-to-consumer paths as one product. Confirm no family-specific
transport lists remain in generic marker/completion/traversal layers, no
semantic policy moved to React, and no new ambient state or private-history
exposure. Inspect module placement and eliminate forwarding/scaffolding scars.

Verify source-time versus application-time behavior and exact invalid/incomplete
repair contacts using existing product builders; avoid synthetic fixtures that
prepopulate all the child controls and bypass the boundary under test.

Run one complete `npm run check` after review remediation, including the existing
performance comparisons. Do not regenerate JSON execution fixtures unless their
semantics changed; an unexpected change is a discrepancy to investigate, not
routine churn to accept. No executor repository changes are expected.

Promote durable ownership rules into the smallest relevant design sections.
Delete this plan and its investigation at closure, recording the truthful gate
result in the closure commit. Leave unrelated progress documents untouched.

## Acceptance and audit-againsts

Primary matrices stay with engine authority. Application and product-loop tests
retain representative actual workflows, not a duplicate suite for every trait.
Use the existing `RunImpactingTraitsProductLoop.interaction.test.tsx`,
`TraitOfferResolution.test.tsx`, specialized outcome tests, interaction tests,
and finding-routing tests where they already own the contact.

Required outcomes across the completed plan:

- Missing children appear on draft selection without save/reopen; invalid
  retained children remain repairable and correctly marked.
- Finding click and visible marker resolve the same semantic child across
  reward, encounter, and nested offer presentation.
- Explicit no-op/exhaustion, invalid target, and unavailable evaluation remain
  distinct. A child list does not turn absence of a domain into success.
- Upstream changes cannot hide a child just because its outer offer is invalid.
- Save/reopen and local draft replacement preserve complete payloads, ordinary
  fields, dormant rows, and undo/redo semantics.
- Candidate laziness and cache invalidation remain correct after sibling and
  nested draft edits; work does not scale with the number of rendered controls.
- Settled histories, finding regions, dependency evidence, and valid execution
  output retain their current meaning.

Reject: a generic form schema; arbitrary path/value payload writes; plugin or
effect registries; a global child metadata map; a catch-all settlement context;
unnecessary schema changes; blanket eager evaluation; parallel child and legacy
field authority; per-trait one-line files; synthetic acceptance requiring
impossible game states; permanent tests that only assert old machinery is gone.

## Execution routine

For each substantial gate, the main session supplies a focused packet with
starting symbols, exact ownership, exclusions, deletions, and acceptance. Use
one write-capable executor and an independent reviewer after stabilization;
reuse the executor for bounded remediation. Subagents do not reread unrelated
plans or inherit the orchestration role. The main session owns final scope,
cross-lane review, commits, and the single broad closure gate.

If a gate
requires persistence changes, new game semantics, or broader candidate redesign,
stop and amend the contract rather than hiding the expansion in cleanup.
