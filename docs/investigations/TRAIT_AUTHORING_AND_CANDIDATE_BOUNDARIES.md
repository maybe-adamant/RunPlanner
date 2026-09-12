# Trait authoring and candidate boundaries

## Question and disposition

At `31329058`, where should trait legality, draft construction and contextual
candidate evaluation live so that routine authoring changes touch fewer owners?

The three responsibilities already exist and should remain distinct. The best
next cleanup is extracting ordinary draft construction and BBB draft operations
from their mixed assessment files. Capability construction merits a narrower
follow-up inspection, not an automatic rewrite or generic candidate service.
Trait settlement remains out of scope.

This is a static investigation. No new correctness defect was reproduced, no
production edits were made and no tests were rerun. The base passed full
repository closure immediately before this investigation.

## Authorities

- `docs/design/CANDIDATE_EVALUATION_MODEL.md`: Candidate Assembly; Candidate
  Session; Exact Artifact Boundaries / Trait offer candidate boundary.
- `docs/design/SIMULATION_AND_VALIDATION.md`: Ordered State-Flow Ownership.
- `docs/design/ARCHITECTURE.md`: ownership, construction/data-flow and
  reorganization rules.

Complete-offer support and focused-option repair are intentionally different
questions. Both use the same captured pre-offer history and engine assessment
authority. Support must be established within one retained branch; findings or
eligible targets from different branches cannot be combined to invent support.

## Existing data flow

```text
reward evaluation captures exact pre-offer histories and contexts
  -> createTraitOfferCandidateArtifacts
     -> address-bound opaque capability
        -> trait assessment / domain / draft functions
  -> candidate query evaluation packages branch evidence
  -> candidate session and application interaction binding
  -> editor renders or adopts the engine-produced draft
```

Selected simulation remains the acquisition/history authority. Alternative
queries do not mutate the authored project or acquire a sibling in the real
simulation. Some child queries evaluate a proposed primary selection in a
private history to obtain its exact secondary context; that is necessary
candidate work, not an alternative production settlement authority.

## Current owners and change neighborhoods

Paths are relative to `packages/planner-engine/src/simulation/` unless qualified.

| Owner                                        | Current responsibility                                                                                                                                | Assessment                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `traits/authoring-policies.ts`               | Option/offer/target assessment, candidate enumeration, composition domains, replacement composition, starting/append/trailing draft operations        | Main mixed owner; draft construction is a concrete separable responsibility           |
| `traits/offer-domain.ts`                     | Context/assessment contracts, composition checks, outcome enumeration, composition cache and key                                                      | Keep existing domain semantics; cache ownership should be inspected with its producer |
| `traits/offers.ts`                           | Reached offer evaluation and recording composed from lower policies                                                                                   | Consumer, not a rewrite target                                                        |
| `candidates/trait-offer-capability.ts`       | Captured context construction, branch-local assessment, Calling Card/Stone and child contexts, target and draft capabilities; also level capabilities | Large but materially contextual; preserve one exact artifact authority                |
| `candidates/trait-offer.ts`                  | Public query products, complete/focused evidence packaging, target/child queries, BBB draft helpers                                                   | BBB draft operations are separable from candidate-query dispatch/aggregation          |
| `candidates/trait-offer-selected-effects.ts` | Specialized selected-effect query handling                                                                                                            | Existing owner to reuse rather than duplicate                                         |
| `traits/index.ts`, `candidates/index.ts`     | Deliberate published vocabulary                                                                                                                       | Preserve supported exports; internal moves need not change application API            |
| Application `trait-offer-interactions.ts`    | Calls bound ordinary drafts and BBB engine helpers, adapts results to UI interactions                                                                 | Consumer witness; no trait legality belongs here                                      |

## Ordinary draft path

`traitOfferStartingDraft` obtains composition domains or available fixed-provider
candidates, selects a deterministic self-contained seed and assesses the complete
offer. If that seed fails pooled-fill rarity, it tries the existing prefix-aware
append path. `nextTraitOfferDraft` checks the authored prefix, searches for a
completion over its derived domain, and returns one appended draft. Optional
high-tier expansion/contraction wraps those same rules.

These functions belong together: starting, append, optional-high-tier changes,
selection/variant helpers, and the prefix-completion search. Keep assessment and
enumeration below them. Do not turn draft construction into another legality
engine or an application-side generator.

The extraction is not a simple contiguous cut: `freshVariantsForPrefix` calls
the private `assessTraitOptionAgainstRarityDomain`, also used by complete-offer
assessment. Before moving it, inspect whether the existing public option
assessment expresses the exact same call or whether a narrow shared internal
assessment owner is needed. Avoid a reciprocal import between draft and
assessment modules; do not expose a large internals bundle to bypass that issue.

Captured capabilities currently select the first successful branch-local draft
from retained context order. Preserve that ordering, candidate iteration order,
prefix behavior and the distinction between branch existence and merged support.
Do not opportunistically change the current eager `map(...).find(...)` work
shape during ownership movement.

## BBB draft path is distinct, despite shared UI

`evaluateEchoLastRunBoonDraftSupport`, `nextEchoLastRunBoonDraft`,
`previousEchoLastRunBoonDraft`, `echoLastRunBoonTraitCandidatesForRow`, and
`echoLastRunBoonRarityCandidates` live in `candidates/trait-offer.ts`.

They consume an already-evaluated mixed-provider domain and transient rows;
they do not independently receive or replay trait history. They manage
distinct identities, selected-target support, row candidates and trailing
append/removal. These are engine authoring operations, not React state policy.

A focused BBB draft owner near candidate products can retain this contract.
Do not force it into the ordinary fixed-provider draft algorithm solely because
both editors reuse presentation. Preserve sparse/incomplete rows, one-to-three
length, target requirements and tail-only removal without redesigning payloads.

## Contextual capabilities: preserve, then selectively narrow

`createTraitOfferCandidateArtifacts` captures a private copy of the address-to-
contexts map and returns address-bound functions. That explicit returned
capability owns the inputs; it is not a result-keyed semantic sidecar to remove.

The factory composes real policy rather than just wiring methods: base rarity,
effective levels, Calling Card, generation diagnostics and selected targets.
Concave Stone derives secondary context by assessing and recording the proposed
primary and settling its selected children before enumerating residual targets.
Its target, All Together and Natural Selection methods reuse that context helper.

Do not replace this with a generic method registry or pass mutable factory state
through helpers. A future extraction must return an exact branch-local assessment
or secondary context, retain the existing chronology, and keep private histories
inside the capability boundary. The current investigation does not establish
that splitting every capability method would improve this contract.

Likewise, `assessTraitOfferCandidate` aggregates branch evidence while focused
evaluation selectively attributes findings to the edited option. Consolidating
these into one generic validity check would risk restoring the repair locks
that the focused query exists to avoid.

## Cache and work ownership

`offer-domain.ts:compositionDomainCache` is an exported WeakMap keyed by catalog
and trait-history identity; `traitOfferCompositionDomains` in authoring-policies
owns the lookup, mutation and returned frozen domain. Its key is built by
`compositionDomainCacheKey`. This split is a concrete ownership smell, not a
confirmed cache correctness bug.

Keep cache storage/key/product computation in one domain-producing neighborhood
if that area is moved. Preserve the current key and identity semantics and do
not move caching into drafts or add per-capability duplicate caches.
`freshVariantsForPrefix` is deliberately prefix-dependent and uncached; cached
ordinary domains are not a substitute for that enumeration.

Diagnostic size baseline: authoring-policies 1,234 lines; candidate trait-offer
1,026; capability 1,004. Counts are not acceptance targets. Work witnesses should
protect candidate enumeration/completion and existing caching, not enforce a
new smaller-line-count architecture.

## Verification ownership and recommended disposition

Existing primary tests under `packages/planner-engine/test/simulation/` include
`trait-authoring-policies.test.ts`, `trait-offers.test.ts`,
`trait-replacement.test.ts`, `trait-offer-focused-candidates.test.ts`,
`run-impacting-trait-candidates.test.ts`, `trait-offer-levels.test.ts`,
`concave-stone.test.ts`, `echo-traits.test.ts`, and `candidate-session.test.ts`.
Application interaction and trait editor tests supply representative consumer
witnesses; do not replicate engine policy matrices in React tests.

Recommended plan scope:

1. Separate ordinary draft construction from assessment/domain production,
   resolving only the concrete helper/cache boundary needed for an acyclic move.
2. Separate BBB transient draft operations from query/evidence packaging without
   changing the published engine vocabulary or application behavior.
3. Review the resulting capability consumer. Extract further branch-context
   logic only if a specific complete-product boundary reduces coupling; do not
   make reducing the factory's line count a delivery requirement.

Before locking a plan, name exact direct consumers and existing draft work-count
witnesses, and decide final directories to avoid a second import-only move.
Keep settlement, payload schema, rarity rules, replacement policy, UI behavior
and broad candidate-session redesign excluded. No new fixtures or schema bump
are justified by the evidence here.

At delivery closure, delete this investigation and its temporary plan; promote
only the durable ownership result into the existing design authorities.
