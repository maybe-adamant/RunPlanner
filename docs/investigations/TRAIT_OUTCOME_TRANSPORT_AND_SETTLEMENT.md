# Trait Outcome Transport and Settlement

## Question and disposition

Investigation of `7e0237f6`: can trait outcome authoring, candidate context,
findings, and settlement be carried through one complete ownership boundary,
instead of wiring each outcome family independently through intermediate layers?

This is a current-code inventory, not a locked implementation contract or a
new game-rules audit. No production changes, save migrations, or new defect
reproductions were performed for this inventory.

The evidence supports one coordinated change with sequential implementation:
establish the complete engine outcome product while decomposing settlement,
then replace the application transport. A settlement-only file split would
leave the repeated cross-layer lists intact. An application-only payload wrapper
would leave the producer/checkpoint contract fragmented.

The problem is broader than transporting authored values. It includes discovery
of required children, semantic addresses, candidate requests, repair contexts,
completeness, finding-marker traversal, and draft edits. Most intermediate
layers should transport those products without enumerating every family.

## Governing existing boundaries

- `docs/design/ARCHITECTURE.md`, Product Construction, Atomic Derived
  Publication, Authored-first workspace assembly, and Feature Ownership:
  explicit complete products; exact evaluation identity; authored structure
  survives incomplete/invalid evaluation; engine products remain data-only.
- `docs/design/CONTEXTUAL_EDITOR_UX.md`, Trait offer domains: complete local
  drafts, lazy exact candidate queries, retained-invalid repair, and one
  complete semantic replacement on Save.
- `docs/design/SIMULATION_AND_VALIDATION.md`, Echo, All Together, and Circe
  settlement: preserve outer acquisition versus child-effect chronology.
- `docs/design/AUTHORED_PROJECT_MODEL.md`, Commands: structural command
  validation is distinct from contextual impossibility.

Do not reinterpret this investigation as permission to move picker models,
React controls, navigation destinations, or callbacks into engine evaluation.

## Inventory: authored outcome owners

Primary source: `packages/planner-engine/src/authored-project/traits.ts`.
Declaration authority: `packages/planner-engine/src/catalog-schema/traits.ts`
and `packages/hades2-catalog/src/declarations/traits/`.

| Family            | Current authored carrier / owner                               | Existing meaning to preserve                                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary trait    | `AuthoredTraitOption`, no extra child payload                  | Identity/rarity alone does not require a child editor.                                                                                                                                                                 |
| Bridal Glow       | Option `targetTraitKey`; declaration `promoteGodTraitToHeroic` | Exact eligible god-trait target, not an application-selected target.                                                                                                                                                   |
| Latest Model      | Option `targetTraitKey`; declaration `upgradeHammerToRank2`    | Shares targeted-acquisition transport with Bridal Glow, but has a distinct domain and effect. These are the two current `targetedAcquisition` declarations.                                                            |
| All Together      | Option `allTogetherResult`                                     | One child per declaration set; `null` is a meaningful exhausted-set result. Outer acquisition precedes child grants; branch agreement matters.                                                                         |
| Natural Selection | Option `naturalSelectionTargets`                               | Ordered successful increments, not an unordered set of unique traits. Candidate support depends on the accumulated choices.                                                                                            |
| Circe             | Option `circeResolution`                                       | Closed activate-Arcana / promote-Arcana / disable-Fear union. Different cardinality and target rules; child repair context follows the outer acquisition.                                                              |
| Echo Pom          | Option `echoPomTarget`                                         | Missing and explicit `null` differ. Null is a legal no-target outcome only when the engine allows it.                                                                                                                  |
| Echo Boon         | Option `echoLastRunBoon`                                       | Nested offer with giver/trait/rarity and selected row. Its rows reuse `AuthoredTraitCarrierOutcome`: target, All Together, or Natural Selection. Nested outcomes must survive the same transport as ordinary outcomes. |
| Persephone        | Option `persephoneLevelBonus`                                  | Frozen generated-row contribution, not a post-selection child mutation. Include in transport inventory, not automatically in the same settlement stage as target children.                                             |
| Hex               | Offer `hexTree`                                                | Offer-owned layout and rare/epic identities; God Sent is derived. Do not relocate persistence onto an option just because the editor is near the selected trait.                                                       |
| Concave Stone     | Offer `concaveStoneResult`                                     | `noProc` or a frozen residual row selection after the primary. Not another freshly generated screen.                                                                                                                   |
| Calling Card      | Offer `rarificationActions`                                    | Ordered row actions at the offer frontier; valid spending can survive a later selected-child failure.                                                                                                                  |
| Rejected          | Offer `rejectedOptionKey`                                      | Generated row remains visible but unavailable. This is offer composition, not a target payload.                                                                                                                        |
| Chaos             | Separate `AuthoredChaosTraitOffer` union member                | Curse alternatives, selected option, curse values, blessing key/rarity/values. Keep the distinct paired offer model; do not force it into an ordinary-option payload.                                                  |
| Fallback Gold     | Separate `AuthoredTraitOfferFallbackGold` union member         | No ordinary trait-option children. This is exhaustion authoring, not runtime fallback policy.                                                                                                                          |

### Related products that must not be swept into an option payload

- Echo Reward has a derived replay assessment/control, not a separately authored
  target on its outer option. `echoLastReward` is nevertheless enumerated in
  workspace child plumbing and must have an explicit disposition there.
- Ransom has assessment/display information but no user-authored random target.
  Deterministic removals remain engine behavior, not empty payload editors.
- Ingenious Strike/Flourish use declaration-owned occupied-slot effects; they
  are not Latest Model-style random target authoring.
- Steady Growth, Supply Chain, and other pickup producers can establish future
  outcomes. Those later outcomes belong to their reached lifecycle/acquisition
  owners, not to a recursively growing payload on the originating trait.
- Embryo, Judgment, Figurine, Pom resolutions, fountain outcomes, and keepsake
  equip results are adjacent authoring families, not automatically part of this
  trait-offer refactor.
- Sea Star, Proper Upbringing, Gift, Gold, and other deterministic/pending
  effects do not justify new child authoring solely because settlement touches
  them. Keep existing clocks, history folds, and producer ownership.

## Current producer-to-consumer paths

Paths below are relative to the repository root. Symbols, rather than volatile
line numbers, identify the relevant contacts.

| Stage                        | Current contacts                                                                                                                                             | Observation                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored structure           | Engine `authored-project/traits.ts`: `AuthoredTraitCarrierOutcome`, `AuthoredTraitOption`, `AuthoredTraitOfferTraits`, `AuthoredEchoLastRunBoonOption`       | An initial carrier interface exists, but covers only three option payloads. Complete option transport is already possible in some paths.                                                              |
| Codec / command validation   | `authored-project/room-state/encounter-trait-offers.ts`; `authored-project/commands/trait-offer.ts`; trait normalizers                                       | Explicit family handling is legitimate here: these boundaries interpret authored meaning. They also reconstruct objects field by field, so preservation must be covered when any carrier changes.     |
| Evaluation / history         | `simulation/traits/offers.ts`, `offer-domain.ts`, `history.ts`, `authoring-policies.ts`, `offer-levels.ts`                                                   | Own eligibility, targeting assessments, generated levels, selected events, and history. Do not duplicate their policies in a new transport layer.                                                     |
| Settlement                   | `simulation/rewards/trait-settlement.ts`: `applyTraitOfferForAcquisition`, `settleEncounterTraitOffer`                                                       | Returns branch, blocked child, invalid candidate contact, and prior mutations; findings are also written to a supplied map. Specific child implementations coexist with orchestration.                |
| Reached product assembly     | `simulation/rewards/biome/selected-trait-products.ts`: `selectedTraitOfferProducts`                                                                          | Groups evaluated offers and preserves exact candidate contexts. Contains special Echo nested-result projection. It is not a uniform outcome-child publication boundary today.                         |
| Candidate queries            | `simulation/candidates/trait-offer.ts`, `trait-offer-selected-effects.ts`, `trait-offer-capability.ts`, `session.ts`                                         | Separate query/result families for targets, Circe, Echo Pom/Boon, All Together, Natural Selection, Ransom, and Stone. These contain real semantic differences; generic transport must not erase them. |
| Application candidate bridge | `apps/planner/src/projections/candidateProjection.ts`, `candidateTraitAdapters.ts`                                                                           | Repeats family-specific methods, requests, cache keys, and result adaptation. Some methods already pass the complete offer.                                                                           |
| Workspace controls           | `projections/structured-workspace/contract.ts`: `WorkspaceTraitOfferControl`, `WorkspaceTraitOptionDomainInteraction`                                        | Repeats each family as a separate optional control/interaction field.                                                                                                                                 |
| Workspace construction       | `projections/structured-workspace/assembly/occurrence-reward-assembly.ts`                                                                                    | Reward and encounter offer paths separately construct child controls and markers. This is a concrete duplication boundary, not just a large file.                                                     |
| Interaction binding          | `projections/structured-workspace/interactions/trait-offer-interactions.ts`                                                                                  | Reconstructs draft-dependent children from declarations and values, binds individual loaders, and manually writes family fields back into drafts.                                                     |
| Finding navigation           | `projections/structured-workspace/navigation/finding-routing.ts`, `marker-ownership.ts`, `marker-builder.ts`; `assembly/occurrence-action-markers.ts`        | Semantic child address kinds and marker collection require explicit coverage. Marker collection enumerates children for both encounter and reward offers.                                             |
| React                        | `ui/editor/rewards/TraitOfferSelectedOutcome.tsx`, `TraitOfferSelectedSpecialOutcomes.tsx`, `TraitOfferCirceResolution.tsx`, `TraitOfferEchoLastRunBoon.tsx` | Specialized renderers are appropriate, but the outer component also separately discovers, loads, activates, and tests presence of each family.                                                        |
| Draft completion             | `ui/editor/rewards/traitOfferOptions.ts`: `selectedTraitOutcomeDraftComplete`                                                                                | Separate conjunction of family-specific fields and controls. Losing a control can also weaken completeness detection; authored value presence alone does not prove contextual validity.               |

`WorkspaceEchoLastRunBoonDraftRow` independently repeats the three carrier
fields. `EvaluatedEchoLastRunBoonDomain.selectedCarrier` and
`WorkspaceEchoLastRunBoonCarrierDomain` already use discriminated unions for
All Together/Natural Selection. These are useful existing pieces, not evidence
that all outcome families already have one consistent transport.

In particular, `carrierForDraft` in `trait-offer-interactions.ts` manually maps
partial Echo draft rows into `AuthoredEchoLastRunBoonOffer.options` using an
`as unknown` cast before asking for candidates. The current capability takes
complete authored offers. Replacing this path needs an explicit typed engine
partial-draft preparation/query/update seam, not just passing a larger complete
option object. Keep partial editor state separate from persisted codec validity.

### Finding identity is not the whole issue

Findings already have semantic addresses. Replacing them with a generic string
path is not necessary. The failure surface is discovering and carrying the
corresponding child control/marker/context at every stage. Address transport,
child traversal, and exact repair context must agree.

Read-only finding labels may still dispatch by finding code. A renderer may
still dispatch by child kind. Those are interpretation endpoints, unlike
repeating every child kind just to collect its marker or determine whether it
exists.

This inventory demonstrates omission risk; it does not establish that every
listed branch currently loses data, nor reproduce a new All Together defect.

### Downstream and private-context contacts

`execution-plan/assembly/timeline-transactions.ts` also explicitly translates
settled trait children: agreed targeted transitions, Circe resolution, effective
nested Echo results, and selected/Stone-residual carrier payloads. This is a real
downstream consumer to inspect during implementation. It deliberately does not
publish every dormant option payload. Preserve that distinction rather than
blindly serializing the proposed authoring child collection onto the wire.

`TraitOfferCandidateCapability` in `trait-offer-capability.ts` intentionally
keeps pre-offer histories and resolved contexts behind the prepared capability.
For example, Circe exposes its domain rather than Arcana/Fear state. Complete
outcome transport must not publish those private histories or capabilities as
public evaluation data. Structural child metadata and lazy candidate results
can be complete without flattening this privacy boundary.

## Settlement responsibility inventory

`trait-settlement.ts` is 1,622 lines at the inspected commit. Its main internal
acquisition function spans offer preparation through post-selection effects.
`trait-offer-interactions.ts` is 1,048 lines, and
`TraitOfferSelectedOutcome.tsx` is 268. Counts are navigation/work baselines,
not acceptance limits.

Keep centrally visible:

- Pre-offer history and source context, rarity facts, Calling Card, evaluation,
  and recording the selected acquisition.
- Exact ordering of selected children, Hex/keepsake effects, Chaos screen
  consumption, and frozen secondary acquisition.
- Yarn/Hymn context and consumption; absent/incomplete authored screens retain
  the effects under the existing contract.
- Publication of the branch, candidate contact, blocked child, and dependency
  evidence. Chronology owns when a returned result enters the wider branch.

Bounded extraction candidates:

- Natural Selection / targeted child checks and All Together grant settlement.
- Circe child validation and Arcana/Fear settlement, including provisional
  findings and the exact post-outer/pre-effect checkpoint.
- Echo nested Boon and Pom outcomes, preserving pre-choice target domains and
  nested carrier handling.
- Hex installation and complete settled evidence.
- Concave Stone secondary settlement, preserving frozen row/level results,
  single screen accounting, and original evaluation provenance.

The existing `ApplyTraitOfferOptions` has direct, skip-Calling-Card, and frozen
flags plus a frozen level result. A named typed acquisition mode may make legal
combinations explicit, but this is not permission to regenerate Stone's row
against post-primary history or add a generic callback/effect framework.

`processEncounterTraitOffer` only returns `.branch` from
`settleEncounterTraitOffer`; current callers are tests. Retire that production
convenience path when updating the tests to consume the complete product.

`level-resolution-settlement.ts` is already a bounded settlement returning its
branch and finding entries. Reuse that construction discipline; do not fold
Pom semantics back into trait settlement.

## Recommended boundary, not a locked API

The engine should expose typed owned outcome children, including required
children whose values are absent. Each needs enough explicit information to
identify its semantic owner and distinguish missing, incomplete, invalid,
unassessed, and supported states. An invalid outer offer must not erase its
repairable children. A complete outcome may legally contain `null`, zero
choices, or an exhausted result depending on its owning policy.

Keep three concepts distinct:

1. Authored value, retained even when invalid or beyond evaluated coverage.
2. Structural child discovery for the exact current local draft.
3. Lazy contextual evaluation against the matching reached engine capability.

A static settlement snapshot alone cannot describe a changed unsaved draft.
Conversely, rendering a child list must not eagerly evaluate every target
domain. The future plan must name both the structural producer and lazy query
boundary, including unassessed authored suffixes, before defining a result type.

The application may adapt these data-only children into typed interactions and
presentation. It should not reconstruct the family inventory independently.
Generic transport/traversal can collect children, markers, and structural
completeness; endpoint handlers still interpret domain-specific values and
candidate products. Contextual validity remains the engine's decision.

Nested Echo requires the same carrier path below its selected inner row.
Offer-owned Hex and Stone remain offer-owned. Do not invent an arbitrary-depth
form/tree framework to cover nesting beyond the concrete model.

Prefer retaining current authored persistence. Moving fields into a new
persisted `payload` object is not required to stop intermediary reconstruction.
If persistence changes prove necessary, that needs separate evidence and an
explicit migration scope. Execution-plan wire changes are not implied: preserve
the complete valid-plan output, and treat its assembly as a downstream contact
check rather than another semantic authority.

## Existing tests and discriminating workflow coverage

Primary engine policy owners include:

- `packages/planner-engine/test/simulation/all-together.test.ts`
- `packages/planner-engine/test/simulation/echo-traits.test.ts`
- `packages/planner-engine/test/simulation/circe-traits.test.ts`
- `packages/planner-engine/test/simulation/concave-stone.test.ts`
- Calling Card, Jeweled Pom, Chaos, and shop trait settlement simulation suites.
- Authored encounter-trait codec and trait command tests.

Application contacts already include
`trait-offer-interactions.test.ts`, `finding-routing.test.ts`,
`TraitOfferResolution.test.tsx`, `TraitOfferSelectedSpecialOutcomes.test.tsx`,
`traitOfferOptions.test.ts`, and `App.interaction.test.tsx`.

Before choosing additions, inspect their assertions for these workflows:

- Ordinary offer has no invented child; selecting a targeted trait in an open
  draft exposes its missing child immediately without save/reopen.
- Bridal Glow and Latest Model share transport but retain different domains.
- All Together incomplete/invalid child remains visible, receives its marker,
  and is repairable when the outer offer is invalid; explicit exhausted sets
  remain distinguishable from omissions.
- Natural Selection preserves ordered repeated increments through edits.
- Echo inner carrier receives the same complete transport, repair behavior,
  and selected-only completion treatment as a top-level carrier.
- Circe child repair uses the proper pre-effect checkpoint; valid empty draws
  do not become missing input.
- Stone remains frozen and offer-owned; Hex and Calling Card retain their
  distinct offer-level timing and ownership.
- Persisted invalid values and unassessed suffix controls survive; candidate
  requests remain lazy and cache identity includes the complete local draft.
- Save/reopen, upstream invalidation, and finding navigation use the actual
  product path, not only synthetic objects with all child fields supplied.

Do not duplicate every domain matrix in UI tests. Use owning engine policy
tests plus representative full product workflows. No permanent manifest of
every trait or tests asserting that obsolete fields no longer exist.

## Decisions still needed before a plan is locked

- Name the structural child discovery owner and its exact input: persisted
  offers alone are insufficient for local drafts and unassessed suffixes.
- Decide the narrow common envelope and typed per-family products without
  forcing heterogeneous domains into a generic picker schema.
- Decide how finding/checkpoint emissions become complete returned products
  without losing Circe's provisional ordering or branch-specific repair data.
- Map each existing control/query/marker path to its replacement and deletion;
  avoid retaining both the child collection and parallel optional fields.
- Check execution assembly and current product tests before claiming wire
  neutrality or complete workflow coverage. This inventory did not regenerate
  execution fixtures or run the suite.

Recommended non-goals: game-rule changes, broad candidate-engine redesign,
generic form rendering, a new effect registry, global state/sidecar metadata,
unrelated scheduler or acquisition-site changes, and executor implementation.

At delivery closure, promote accepted ownership rules into the smallest stable
design authorities and remove this investigation with its eventual plan.
