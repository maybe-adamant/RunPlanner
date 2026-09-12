# Nested trait carrier matrix

## Question and scope

Can Echo's Boon Boon Boon and Concave Stone acquire All Together, Bridal
Glow, or Natural Selection without losing their required payload, editor,
candidate frontier, finding owner, simulation effect, or execution publication?

Inspected against HEAD `85337165` **plus the uncommitted Stone corrections**.
This is a current-product investigation, not game-source evidence or a claim
that the committed baseline already contains those corrections. No production
changes were proposed by the initial audit. The follow-up witness pass below
also records defects exposed by real workflows and their bounded corrections.

The bounded matrix is two carriers by three payload-bearing traits. Circe's
outcomes and Icarus's Latest Model are direct editor families, not reachable
children of these carriers. All Together grants declaration-selected infusion
traits; Bridal Glow modifies an equipped trait; Natural Selection increments
equipped traits. None introduces another selectable carrier in this matrix.
Scheduled/pickup-producing effects remain separate later acquisition owners.
This does not call for a general recursive trait interpreter.

Scope ends at the planner's execution-plan publication/codec boundary. Native
game hooks and live-game realization are not re-audited here.

## Ownership and chronological contract

| Carrier             | Persisted owner of the child payload                                                 | Candidate and settlement frontier                                                                                                                | What must remain unchanged                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Echo Boon Boon Boon | Selected nested `echoLastRunBoon.options[n]` on the selected outer Echo option       | Echo's pre-choice domain determines the nested identity; the selected nested acquisition applies its own effects through shared trait settlement | Outer Echo selection and other nested rows. Cached direct grants must not be reassessed as an ordinary fresh boon menu.              |
| Concave Stone       | The original residual `offer.options[n]`, selected by `concaveStoneResult.optionKey` | Source menu eligibility/rarity stays frozen; child effect candidates and settlement follow the primary acquisition and its children              | Primary selected option, original residual option key, source menu rarity/level facts. Do not simulate another ordinary boon screen. |

The same `AuthoredTraitCarrierOutcome` fields are used by both ordinary options
and Echo nested options:

| Trait                               | Payload                   | Editor                             | Effect and completion                                                                                                                           |
| ----------------------------------- | ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| All Together (`AllElementalBoon`)   | `allTogetherResult`       | Four declaration-owned set choices | Grant the chosen infusion per set. `null` is an explicit exhausted-set result, not missing input.                                               |
| Bridal Glow (`BoonDecayBoon`)       | `targetTraitKey`          | Equipped-trait target picker       | Apply the targeted promotion/level effect. A missing or stale target must remain repairable.                                                    |
| Natural Selection (`GoodStuffBoon`) | `naturalSelectionTargets` | Ordered target sequence editor     | Apply the supported increment sequence. Candidate support depends on the authored prefix; repeated targets and early exhaustion are meaningful. |

Structural discovery must expose a required child even when its payload is
missing. Candidate evaluation determines legal values; it must not hide the
only repair control. Changing selection makes unused payloads dormant rather
than deleting them. Only acquired options publish their consequences.

## Six-path audit

Each row has a real application dialog witness and a separate publication case.
The compiler cases prove transport, not native game realization.

| Path                      | Candidate and simulation evidence                                                | Real dialog witness                                                                                 | Publication     |
| ------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------- |
| Echo → All Together       | Nested domains, exact grants, missing-set checkpoint                             | Repair four sets, save, codec reload, reopen                                                        | Nested carrier  |
| Echo → Bridal Glow        | Target domain, promotion and levels                                              | Repair retained target beside incomplete sibling, save, reopen                                      | Nested carrier  |
| Echo → Natural Selection  | Prefix domain and eight increments                                               | Repair eight targets, save, codec reload, reopen                                                    | Nested carrier  |
| Stone → All Together      | Residual candidates after primary Bridal Glow settlement, exact grants           | Repair four sets, save, codec reload, reopen, clear proc retaining payload                          | Frozen residual |
| Stone → Bridal Glow       | Post-primary target and promotion                                                | Target newly acquired primary, save, reopen                                                         | Frozen residual |
| Stone → Natural Selection | Post-primary prefix, missing/stale address, exact increments and dormant effects | Repair eight targets and outer assessment, save, codec reload, reopen, clear proc retaining payload | Frozen residual |

## Exact producer/consumer contacts

Paths are relative to the repository root. Symbols identify the owning path;
the list is navigation, not a second semantic implementation.

| Boundary           | Contacts and responsibility                                                                                                                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored payload   | `packages/planner-engine/src/authored-project/traits.ts`: `AuthoredTraitCarrierOutcome`, `AuthoredTraitOption`, `AuthoredEchoLastRunBoonOption`.                                                                                                                                                                                    |
| Child ownership    | `packages/planner-engine/src/authored-project/trait-carrier-children.ts`: `discoverAuthoredTraitCarrierPayloads`, `discoverAuthoredTraitCarrierChildren`, `discoverAuthoredEchoLastRunBoonDraftChildren`, `updateAuthoredTraitCarrierChild`. Stone activates original residual children; Echo adapts the selected nested draft row. |
| Partial Echo draft | Same file: `prepareEchoLastRunBoonDraft` and `completeAuthoredEchoLastRunBoonDraft`. Partial sibling rows stay local; completing the draft preserves all three payload fields.                                                                                                                                                      |
| Candidates         | `packages/planner-engine/src/simulation/candidates/trait-offer-capability.ts` and `trait-offer-selected-effects.ts`. Echo's nested domain and Stone's post-primary child context feed the existing target/set/ordered-sequence policies.                                                                                            |
| Settlement         | `packages/planner-engine/src/simulation/rewards/trait-settlement.ts`, its `trait-settlement/selected-child-settlement.ts` and `concave-stone-secondary.ts`, plus `simulation/traits/offers.ts`. Shared effects own actual state mutation and child findings.                                                                        |
| App binding        | `apps/planner/src/projections/structured-workspace/interactions/trait-offer-interactions.ts`. Pass complete local drafts, bind original child identity, adapt engine candidates.                                                                                                                                                    |
| React              | `apps/planner/src/ui/editor/rewards/TraitOfferEchoLastRunBoon.tsx`, `TraitOfferSelectedOutcome.tsx`, `TraitOfferSelectedSpecialOutcomes.tsx`. Echo hosts nested controls; Stone exposes the same option-payload controls for its residual.                                                                                          |
| Publication        | `packages/planner-engine/src/execution-plan/assembly/timeline-transactions.ts` and `codec/rewards.ts`. Publish payloads for acquired primary/residual/nested options; retain existing closed wire shapes.                                                                                                                           |

## Fragile boundaries to preserve

1. **Frozen source is not a frozen effect.** Stone must preserve the source
   offer's eligibility and rarity while applying Bridal Glow/All Together/
   Natural Selection at the post-primary frontier. The dirty correction removes
   the prior bypass of targeted acquisition for frozen Stone results.
2. **Advance the primary exactly once.** A blocked residual retains the outer
   offer's pre-primary candidate context. The capability advances it through
   primary settlement; passing a post-primary context into that same operation
   would make repair candidates incorrect.
3. **Keep original identity.** Stone's internal one-row secondary evaluation
   must not leak its synthetic role/option into repair addresses. Echo keeps
   its existing nested owner. The public finding repair destination may be the
   owning timeline action; that is distinct from the internal payload address.
4. **Carrier visibility is structural; completion is contextual.** Missing
   payloads need controls. Unsupported retained values must be repairable, and
   an incomplete sibling must not erase the selected nested child's editor.
5. **Selection is not payload ownership transfer.** Editing Stone's residual
   must not replace the primary selection. Editing one Echo row must not write
   its payload into another. Dormant data may remain in the save but must not
   execute or publish as an acquired effect.
6. **A field reaching the wire is not proof of its effect.** Compiler tests
   demonstrate transport; simulation tests demonstrate resulting state. Real
   UI tests demonstrate that the user can construct and repair that state.

## Test evidence and bounded gaps

Primary evidence files:

- `packages/planner-engine/test/simulation/echo-traits.test.ts`: nested target
  domain, selected carrier domain, Bridal Glow effect, All Together grants and
  blocked checkpoint, Natural Selection order, dormant unselected target.
- `packages/planner-engine/test/simulation/concave-stone.test.ts`: residual
  domain freezing, All Together grants/repair address, Bridal Glow post-primary
  effect/repair address, optional/forced proc and upstream no-proc behavior.
- `packages/planner-engine/test/authored-project/trait-carrier-children.test.ts`:
  all three Stone residual descriptors and dormancy; residual target update;
  shared direct children and partial Echo payload retention.
- `apps/planner/src/ui/editor/rewards/TraitOfferEditor.test.tsx`: real Echo and
  Stone repair/save/reopen paths for all six chains; the four compound loops
  also serialize and reload through the production project codec.
- `apps/planner/src/ui/editor/rewards/TraitOfferSelectedSpecialOutcomes.test.tsx`
  and `TraitOfferResolution.test.tsx`: compound editor mechanics, including
  supplied candidate domains. These are not six real-app lifecycle fixtures.
- `apps/planner/src/projections/structured-workspace/interactions/trait-offer-interactions.test.ts`:
  ordinary set/sequence and Echo binding contacts.
- `packages/planner-engine/test/execution-plan/compiler.test.ts`: all six
  acquired-carrier payload publication cases. Some construct projection inputs;
  they do not replace a full authored-project simulation or persistence loop.

## Follow-up witness pass

Implemented as a bounded witness pass, **not another carrier redesign**:

- Added the four missing real-app compound editor loops (Echo/Stone × All
  Together/Natural Selection), reusing prepared project support. Each
  opens from missing detail, populates through real candidates, saves the complete
  outer offer, serializes/reloads, reopens, and verifies the resulting state.
- Added Stone → Natural Selection's owning engine witness for post-primary
  prefix candidates, the resulting level increments, and missing/stale repair
  ownership. Do not duplicate the whole Natural Selection policy matrix.
- Both Stone compound dialog loops clear the proc and verify retained payload.
  The engine Natural Selection witness verifies no dormant increments; existing
  publication cases own exclusion from execution. The Stone All Together engine
  witness uses Bridal Glow as its primary and requires that target to settle
  before residual candidates become available.
- Do not create six giant fixture files, a production manifest, recursive
  traversal framework, or parallel payload models. Keep the matrix as review
  evidence; retire it at closure after promoting any durable conclusion.

The new real-app loops exposed two defects beyond transport: Echo nested set
findings leaked an internal one-row offer as their repair owner, and a blocked
Stone Natural Selection child retained its prefix capability but hid that same
pre-offer capability from the outer draft assessment. Corrections keep Echo
findings on the authored Echo choice and expose the existing blocked capability
to both the Natural Selection child and its owning offer. Neither adds a new
payload model or changes game eligibility.

## Verification on the inspected worktree

Seven focused suites passed: **201 tests** (`echo-traits`, `concave-stone`,
`trait-carrier-children`, execution `compiler`, real `TraitOfferEditor`,
`TraitOfferSelectedSpecialOutcomes`, and `trait-offer-interactions`). This run
did not execute the full repository gate or native game tests. The broader
trait plan's final closure remains separate.

The focused progressive selected-product and clamp suites also passed (22 tests),
along with workspace/fixture typechecking and lint on changed TypeScript files.
