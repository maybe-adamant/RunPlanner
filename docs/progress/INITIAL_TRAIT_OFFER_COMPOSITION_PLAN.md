# Initial trait-offer composition correction

## Status and objective

Locked for implementation on 2026-09-15 following user approval.
Base: `238cb1a0`. The worktree at planning contained only the accompanying
[trait eligibility investigation](../investigations/TRAIT_ELIGIBILITY_GAME_PARITY_REVIEW.md).
Commit this execution contract before implementation. Begin with Gate A.

Correct ordinary initial boon screens so that complete-offer validation,
candidate support and editor draft construction agree with the supported native
generation stages. An individually eligible trait is not sufficient to prove a
valid screen; pool counts are not sufficient either.

The user-visible witness is the Apollo Trial in `G_Combat13`, occurrence
`05d7ce68-dcfd-4dcd-8750-6a4efbdd6c36`, in the supplied `underworld.json`:
Perfect Image / Exceptional Talent / Nova Strike should be authorable without
also requiring Extra Dose. Conversely, later initial screens must retain a
priority seed when native construction necessarily supplies one.

## Scope and decisions

Included:

- initial, pre-reroll Olympian and Hermes screens, regardless of whether they
  originate from a room, Shop, Trial, Mystery Boon or another ordinary source;
- explicit replacement rarity versus fresh-roll rarity;
- initial priority/replacement seeding, fresh rarity-pool filling and vacancy
  rescue, including their effects on short screens and Fallback Gold;
- engine-owned starting, append and removal drafts, with their existing
  application bindings and shared trait editor;
- correction of obsolete composition evidence and explanations.

**Echo Boon Boon Boon is excluded.** Its current-run predicates versus linked
prerequisites are investigation finding 4, not part of this plan. Do not change
its replay eligibility, prior-run approximation, variable-size draft rules,
rarity/level behavior or selected-child settlement.

Also excluded: rerolls; new save-progression inputs; Death Defiance or precise
God Sent investment modeling; Chaos-pair, NPC, Hammer or Spell Drop composition
redesign; Concave Stone lifecycle; targeted-trait payload changes; executor
hooks, DAG policy or acquisition timing; general UI redesign.

The accepted exhaustion policy is to retire the universal exhaustion
simplification and follow the source's effective-Denial-dependent final rescue.
Denial suppression uses the
existing effective Fear state; it neither removes old bans nor creates another
authored setting.

No authored schema or execution protocol bump is expected. Existing invalid or
incomplete but structurally representable offers remain loadable and repairable;
do not silently rewrite saved choices to make them legal.

## Governing authorities and source facts

Read `docs/design/SIMULATION_AND_VALIDATION.md` in full before engine work.
The specialist authorities are the trait-offer sections of
`docs/design/REWARD_MODEL.md`, the trait-offer candidate boundary in
`docs/design/CANDIDATE_EVALUATION_MODEL.md`, and these source audits:

- `docs/audits/traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`;
- `docs/audits/traits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`.

Their current small-pool quotas and first-offer-only account are the policies
being corrected, not acceptance requirements to preserve. Other modeled
exclusions remain in force.

Source references use the reviewed local snapshot at
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts`:

| Native contact                                          | Relevant fact                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UpgradeChoiceLogic.lua:GetPriorityTraits` (739–793)    | Eligibility and occupied priority slots determine whether to seed several core options or one remaining eligible core. Attack/Special is guaranteed only when an eligible such option exists in the applicable multi-core branch.         |
| `UpgradeChoiceLogic.lua:GetReplacementTraits` (795–822) | Replacement candidates retain individual eligibility and carry an explicit promoted rarity from the occupied slot.                                                                                                                        |
| `TraitLogic.lua:SetTraitsOnLoot` (1791–1830)            | Initial replacement seeding precedes core seeding; an empty replacement result falls through. Optional linked priority insertions precede ordinary filling.                                                                               |
| `TraitLogic.lua:SetTraitsOnLoot` (1864–1947)            | Priority identities receive their own rarity treatment; remaining positions draw from surviving rarity tables. Choosing an identity removes it from all tables. A later successful rarity roll can supersede the tentative Common result. |
| `TraitLogic.lua:SetTraitsOnLoot` (1949–1993)            | Replacement rescue fills vacancies after fresh rolls; a further rarity-table rescue runs when effective Denial is off. That final pass does not roll the probabilities again.                                                             |
| `UpgradeChoiceLogic.lua:CreateBoonLootButtons`          | Fallback Gold represents an empty generated list, not an extra trait beside a short list.                                                                                                                                                 |

The native optional linked priorities are declared for `BlindChanceBoon`,
`MassiveKnockupBoon` and `PoseidonStatusBoon` in `TraitData.lua`, each with
`PriorityChance = 0.25`. Account for their supported seed paths, not just the
ordinary core seed. Any needed normalized fact belongs in the catalog, not a
trait-name switch in the engine. Profile-dependent first-seen priorities and
reroll exclusion paths remain outside the progressed initial-screen baseline.

## Intended engine shape

### Individual eligibility and generation support

Retain existing predicate, history, replacement and rarity arithmetic owners.
Separate a trait's state/declaration eligibility from whether a particular
generation stage can supply its authored rarity.

A valid promoted replacement must not fail a fresh-roll check before its
replacement transition can be established. It still requires the correct
provider, slot, distinct identity, promoted rarity and all other applicable
predicates. A full offer does not receive a blanket rarity exemption.

The composition authority asks:

> Can the native initial construction stages produce these exact identities
> and rarities at this pre-offer state?

Use one bounded support calculation for the fixed three-position envelope:

1. Establish the supported initial priority/replacement seed paths.
2. Include applicable optional linked-priority seeds.
3. Fill remaining positions using the surviving rarity tables and ordered
   chance support, allowing rolls to fail where the source allows that.
4. Fill remaining vacancies with supported replacements.
5. Apply the effective-Denial-dependent final rarity rescue.
6. Accept a shorter screen or Fallback Gold only if construction can end there.

All options read one immutable pre-offer state. Removing an identity from the
local generation pools does not equip it, satisfy another option's prerequisite
or change player elements. Preserve exact captured branch context; never union
independent branch facts into a fabricated screen.

Authored display order is not a new generation-order constraint. Establish
support for the proposed screen without persisting a generation path or
reordering its option keys, selection, Rarification actions or nested payloads.
Existing selected-acquisition and Hymn effect ownership remains separate.

The staged result must replace conflicting whole-screen and row-local
shortcuts, not merely be added after them. Keep explanatory candidate counts
only where truthful. Remove formula-derived required/allowed replacement
statistics if they no longer have the advertised meaning; do not retain the
old validator merely to populate Offer State.

Use the nearest existing `simulation/traits/authoring/` neighborhood for any
extracted composition module. Explicit inputs are the eligible declarations,
exact pre-offer facts and proposed offer; outputs are support and semantic
findings. Consumers are selected assessment and existing draft/candidate
capabilities. No generic search framework, RNG replay, extra project simulation,
mutable registration, persisted stage state or parallel eligibility engine.

### Editor operations

The shared editor already asks engine capabilities for drafts. Replace the
high-tier-only append/remove restriction with operations backed by the same
composition authority:

- **Start over:** construct a supported screen at the exact offer frontier.
- **Add:** retain authored rows and append an option with a valid completion
  path; an intermediate editing draft need not already be a finished screen.
- **Remove:** remove the trailing option only when the remaining rows can form
  a finished native screen. Repair selection through the existing draft logic.
- **Fallback Gold:** use the same empty-screen support check as validation.
- **Save/candidates:** retain existing target/payload completeness and repair
  behavior, while using the corrected composition result.

Do not encode bucket sizes, core requirements or Denial in React. Rename or
replace the misleading high-tier-specific capabilities with their real callers
in the same slice, without forwarding compatibility aliases. Shared UI changes
must preserve BBB's separate bound operations and other provider behaviors.

## Ownership and starting packet

Paths below are relative to the repository root.

| Owner                    | Starting files or symbols                                                                                                                                                                                                                                             | Responsibility                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog                  | `packages/hades2-catalog/src/declarations/traits/`, `compiler/traits/`; engine `catalog-schema/traits.ts`                                                                                                                                                             | Only source-backed generation facts missing from the normalized contract. No authored or editor policy.                                               |
| Engine assessments       | `packages/planner-engine/src/simulation/traits/offer-domain.ts`, `authoring/assessment.ts`, `rarity.ts`, `offers.ts`                                                                                                                                                  | Replace quota/first-offer shortcuts; distinguish explicit replacement rarity and stage-aware fresh support; resolve effective source/Fear facts once. |
| Engine drafts/candidates | `simulation/traits/authoring/drafts.ts`, `simulation/candidates/trait-offer/capability.ts`, `simulation/candidates/session.ts`                                                                                                                                        | Consume the same composition authority at captured branch contexts; expose supported draft operations and truthful evidence.                          |
| Application              | `apps/planner/src/projections/candidates/candidateTraitAdapters.ts`, `candidateProjectionSession.ts`, `candidateProjection.ts`; `projections/structured-workspace/contracts/traits.ts`, `interactions/trait-offers/bind.ts`; `projections/rewards/traitProjection.ts` | Adapt capabilities and evidence, without deriving eligibility.                                                                                        |
| React                    | `apps/planner/src/ui/editor/rewards/TraitOfferEditorShell.tsx`, `TraitOfferStateInspector.tsx`                                                                                                                                                                        | Invoke engine-produced operations and render accurate feedback; retain the existing editor layout.                                                    |

## Delivery gates and commit boundaries

### A — Correct explicit replacement rarity

Deliver the focused individual-assessment fix, its candidate contact, and
source/authority corrections specific to replacement rarity. No new composition
framework or changes to BBB. Commit only when the replacement transition and
its picker agree and existing fresh-rarity checks remain effective.

Primary tests: engine `test/simulation/boon-rarity.test.ts` and the relevant
replacement cases in `test/simulation/trait-offers.test.ts`.

### B — Replace ordinary composition and its editor consumers

Deliver the complete vertical slice: native stage support, exact Fear/source
context, any necessary normalized declarations, selected validation, candidate
support, draft operations, application bindings and affected Offer State fields.
Delete the superseded quotas, first-offer-only restrictions and high-tier-only
draft policy in this slice. Do not commit a new engine contract with old draft
or UI semantics still attached.

Primary composition tests stay in engine `test/simulation/trait-offers.test.ts`
and `denial-traits.test.ts`; candidate contacts in
`trait-offer-focused-candidates.test.ts`. Catalog normalization owns any new
declaration matrix. Existing application binding and `TraitOfferShell.test.tsx`
tests own representative draft controls, not another copy of the rule matrix.

### C — Closure

After gate reviews and their bounded remediation passes, perform the main-session
whole-product review, then complete repository verification and the performance
comparison against the recorded pre-change base. Update only affected stale
test expectations and generated products; valid cases must not be weakened
merely to make the suite pass.

Integrate the corrected composition contract into the existing reward/candidate
sections and source audits, replacing obsolete explanations. Delete this plan.
Trim the investigation to the unresolved Echo finding and its necessary source
evidence; it remains a concrete deferred question, not a history of this work.

Each implementation gate receives a focused executor packet and a fresh
independent review under the repository routine. The main session owns scope,
Git, finding dispositions and broad closure checks. Reuse the executor for
bounded remediation; no concurrent write agents.

## Acceptance and audit-againsts

| Witness                                                                              | Required outcome                                                                                                                                        | Primary owner                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Supplied Apollo Trial: Perfect Image / Exceptional Talent / Nova Strike              | Accepted without Extra Dose; all options use the real pre-offer state.                                                                                  | One representative authored-plan/candidate witness, backed by engine composition tests |
| Later initial Apollo offer after Zeus Attack: three non-core boons                   | Rejected when every supported seed path requires core or replacement participation.                                                                     | Engine composition                                                                     |
| Few/no eligible priority options, including banned Attack/Special                    | No unconditional three-core or Attack/Special demand when native seeding cannot supply it; later fill still runs.                                       | Engine composition                                                                     |
| Common Zeus Attack replaced by Rare Nova under guaranteed fresh Epic                 | Exact Rare replacement accepted; wrong promotion and unrelated fresh Rare remain rejected where appropriate.                                            | Engine rarity/replacement                                                              |
| Replacement roll zero, optional and forced; forced roll with no eligible replacement | Correct initial seed alternatives and vacancy rescue; no invented obligatory replacement.                                                               | Engine composition                                                                     |
| Ordinary, high-tier and replacement pools near exhaustion                            | Earlier stages may fill a screen without every ordinary trait; actual vacancies cannot be ignored. Optional versus guaranteed rolls remain distinct.    | Engine composition                                                                     |
| Effective Denial active, inactive and suppressed                                     | Final rescue follows the chosen source policy; prior bans remain in every case. Fallback is allowed only after a genuinely empty terminal construction. | Engine Denial/composition                                                              |
| Optional linked priority seed and rarity-table depletion                             | Supported seed/fill paths remain available; removed identities do not reappear through another rarity table.                                            | Catalog fact contact and engine composition                                            |
| Short exhausted screen with add/remove; short incomplete draft with add              | Controls follow engine completion/terminal support. A mandatory third position cannot be removed just because its current trait is Legendary.           | Representative application binding/UI witnesses                                        |
| Invalid selected targeted trait or upstream edit                                     | Exact repair context and Start over remain available; no sibling option enters history and no automatic rewrite of authored state.                      | Existing candidate/repair tests plus one affected contact if needed                    |

Capture the Apollo witness through the repository's existing test builders or
a bounded checked-in authored fixture; tests must not depend on a Windows path.
Do not clone the whole user plan into many fixtures or recreate the native
algorithm in test helpers. Retain existing provider-boundary tests for BBB,
Chaos, NPC, Hammer and Spell Drop without adding a duplicate exclusion matrix.

Review specifically for:

- a new staged validator still defeated by old pre-filtering or quota checks;
- fresh-roll rarity tests incorrectly reused for seeded or rescue outcomes;
- treating a zero-valued native rarity-table entry as absent, or treating a
  guaranteed roll as optional;
- cross-branch support mixing, display-order-dependent legality, or target
  context lost during draft reconstruction;
- full-pool Cartesian enumeration on every picker query instead of a bounded
  three-position support check using existing prepared facts;
- inaccurate replacement statistics retained solely for presentation;
- source assumptions widened beyond the agreed ordinary initial-screen scope.

If the detailed stage translation exposes an additional source/model conflict
(particularly `BlockRarities` values during final rescue), record the concrete
witness and settle its disposition before extending scope. Do not silently
change a separate eligibility contract or claim parity through a fabricated
test. Catalog identity may change if normalized declarations change; that alone
does not warrant an authored schema or execution protocol change.

Use narrow truthful test lanes during implementation. At closure run one full
`npm run check` after review stabilizes, with performance base `238cb1a0`
explicitly selected so intermediate commits do not hide cumulative regressions.
Follow generated-fixture formatting and selective-refresh policy. Record actual
verification results in the closure commit, not durable design prose.
