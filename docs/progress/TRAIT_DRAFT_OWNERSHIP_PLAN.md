# Trait draft ownership cleanup

## Status and base

Status: locked for implementation; Slice A is next.
Production base: `31329058`. Commit this plan and
`docs/investigations/TRAIT_AUTHORING_AND_CANDIDATE_BOUNDARIES.md` after the
pre-plan challenge and before source edits.

Independent pre-plan challenge completed; cache isolation, pooled-rarity input
and BBB identity/payload constraints are incorporated below.

## Objective and scope

Separate draft construction from trait assessment and candidate-query packaging
without changing supported offers, draft results or editor behavior. This is
engine ownership work, not new game modeling or a semantic correction.

Two complete slices: ordinary draft ownership, then BBB draft ownership and
combined closure. Do not expand into settlement, payload schemas, rarity or
replacement rules, UI redesign, general candidate-session refactoring, or
splitting the capability factory for its size. No schema/protocol or fixture
regeneration is expected.

## Authorities and data ownership

- `docs/design/CANDIDATE_EVALUATION_MODEL.md`: Candidate Assembly; Candidate
  Session; Exact Artifact Boundaries / Trait offer candidate boundary.
- `docs/design/SIMULATION_AND_VALIDATION.md`: Ordered State-Flow Ownership.
- `docs/design/ARCHITECTURE.md`: construction/data flow and reorganization rules.

Catalog declarations and historical contexts remain inputs. Trait assessment
owns legality; drafts consume that policy. Captured candidate capabilities own
exact branch-local contexts; candidate queries package their evidence.
Application interactions consume engine products without new domain policy.
Selected settlement remains the sole real acquisition/history authority.

## Invariants

1. Preserve complete-offer versus focused-option semantics: a sibling's failure
   must not poison unrelated focused repair, and support must succeed within
   one retained branch rather than a union of different histories.
2. Preserve ordinary draft candidate/rarity iteration, seed choice, pooled-fill
   fallback, prefix completion and high-tier append/removal behavior. Keep
   declaration-specific fixed-three and exhaustion rules unchanged.
3. Keep prefix-dependent fresh variants uncached. They pass a pooled rarity
   domain to `assessTraitOptionAgainstRarityDomain`; substituting the public
   `assessTraitOption` wrapper would lose that parameter and is not equivalent.
4. Preserve composition cache key contents, catalog/history identity, returned
   domain identity and lifetime. Move the cache with its producer; do not add
   caches, change keys, or make caching a required semantic input.
5. Preserve capability branch order and current eager enumeration/work shape.
   No short-circuit optimization or context replay redesign during movement.
6. BBB helpers continue to consume the evaluated mixed-provider domain and
   sparse transient rows. Preserve distinctness, selected-target support,
   one-to-three rows and trailing removal. Shared UI does not require sharing
   the ordinary fixed-provider draft algorithm.
   Distinct rows and occupied exclusions use `traitKey`; remaining provider
   variants use `giverKey:traitKey`. Preserve blank append, selected-index
   clamping and nested row payloads when removing the tail.
7. Do not modify Concave Stone's secondary-history derivation, Calling Card,
   selected children, effective levels, or trait settlement. Their existing
   consumers are regression contacts, not new implementation owners.
8. Keep supported draft/assessment/query exports stable. The mutable cache and
   its key become private implementation details; no repository consumers use
   them except their current domain producer. Do not publish the newly shared
   internal pooled-rarity assessment helper through package barrels.

## Slice A — Ordinary drafts and their assessment dependency

Source: `simulation/traits/authoring-policies.ts`,
`simulation/traits/offer-domain.ts`, and `simulation/traits/index.ts`.
Final neighborhood: `simulation/traits/authoring/assessment.ts` and `drafts.ts`.
No new barrel is needed inside this directory.

Deliverables:

- Move starting/next/optional-high-tier draft functions and their private
  construction helpers, including `freshVariantsForPrefix`, to `drafts.ts`.
- Keep the remaining option, offer, targeted-effect, domain and replacement
  assessment together in `assessment.ts`. This slice does not further split
  that policy owner.
- Make the existing pooled-rarity assessment a narrow internal export for the
  draft consumer. Keep public `assessTraitOption` unchanged. Dependency direction
  is drafts -> assessment -> domain/history, never assessment -> drafts.
- Move composition cache storage and key unchanged from `offer-domain.ts` into
  assessment beside `traitOfferCompositionDomains`; make both private. Domain
  types and unrelated composition functions stay in `offer-domain.ts`.
- Update direct consumers (`traits/offers.ts`, `keepsakes/trait-effects.ts`,
  `rewards/anvil-settlement.ts`) and the deliberate trait entry. Use explicit
  assessment exports there so the internal helper does not escape. Existing
  capability/session consumers retain their APIs; no forwarding old file.
- Remove displaced `authoring-policies.ts` and its superseded cache exports.
  Preserve each original function body where possible; any non-movement change
  must be individually explained before review.

Primary existing acceptance under engine `test/simulation/`:
`trait-authoring-policies.test.ts`, `trait-offers.test.ts`,
`trait-replacement.test.ts`, `trait-offer-focused-candidates.test.ts`,
`trait-offer-levels.test.ts`, `concave-stone.test.ts`.
The offers/replacement suites already exercise mixed-rarity pooled fill,
starting drafts, incremental completion and high-tier changes. Reuse them.
Retain the branch-context isolation witness in `trait-offers.test.ts`.
If no direct memo identity witness exists, add one small test of repeated
explicit domain calls returning the same frozen product; no production probes
or broad new synthetic fixtures. Do not duplicate the legality matrix.

Review against exact deterministic drafts, pooled-rarity input, unchanged cache
key, no cycles/duplicate policy and unchanged published vocabulary. Commit the
complete slice after fresh independent review and bounded remediation.

## Slice B — BBB drafts and closure

Source: `simulation/candidates/trait-offer.ts` functions
`evaluateEchoLastRunBoonDraftSupport`, `nextEchoLastRunBoonDraft`,
`previousEchoLastRunBoonDraft`, `echoLastRunBoonTraitCandidatesForRow`, and
`echoLastRunBoonRarityCandidates`, plus their directly owned draft contracts.

Final neighborhood: `simulation/candidates/trait-offer/echo-draft.ts`.
Keep query/evidence ownership in existing `trait-offer.ts`. A minimal shared
contract module in that neighborhood is permitted only if both have a concrete
type dependency; do not introduce a generic draft context. No reciprocal
runtime import between query and draft owners.

Deliverables:

- Move the complete BBB transient draft operations and their owned types.
- Update `candidates/index.ts` to export the same supported names directly
  from the proper owners. Preserve application imports via the package surface.
  Remove the old helper implementations; no forwarding exports from the old
  mixed file just to hide stale direct consumers.
- Leave capability construction, query assessment and branch aggregation
  behavior intact. Assess their resulting dependency shape; further extraction
  is not an acceptance requirement and requires separate justification.

Primary acceptance: existing `echo-traits.test.ts`,
`run-impacting-trait-candidates.test.ts`, `concave-stone.test.ts`,
`trait-offer-focused-candidates.test.ts`, and the application
`projections/structured-workspace/interactions/trait-offer-interactions.test.ts`
and `ui/editor/rewards/TraitOfferSelectedSpecialOutcomes.test.tsx`.
Inspect existing BBB draft tests before adding any: retain incomplete-row,
tail removal, selected-target and mixed-giver domain witnesses at their owning
boundary rather than duplicating the matrix in UI tests.
The existing BBB draft witness is in `echo-traits.test.ts`; preserve its public
contact through both `candidates/index.ts` and `simulation/index.ts`.

Review against input/output equality, complete/focused support separation,
carrier repair, stable exports, and absence of new cross-family policy.
Run combined closure before committing Slice B.

## Delivery and verification

Main owns documentation, Git, scope and broad closure. One Terra-high executor
owns source changes; reuse for adjacent Slice B/remediation. Fresh independent
reviewer per stable slice, bounded remediation, no repeated review loops.
Packets identify precise files, authority sections and tests; no broad rereads.

Run explicit engine TypeScript, narrow owning suites through the shared
correctness lane, touched-file ESLint/Prettier, and diff checks during work.
No test timeout overrides, fixture reformatting, or historical absence tests.
Use one-off function-body/consumer comparisons for movement verification.

At final closure run one `npm run check` and explicit performance comparison
against `31329058`, not merely Slice A. Review both slices together for
ownership, APIs, cache semantics, unexplained growth and eliminated paths.
Promote minimal durable ownership notes into existing design documents; delete
this plan and its investigation. Record truthful validation in the closure
commit, not a new implementation diary. Leave unrelated progress docs alone.
