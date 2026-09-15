# Trait rarity and initial-offer composition correction

## Status and objective

Locked on 2026-09-15; amended after user review of the
[rarity-effects matrix](../investigations/TRAIT_RARITY_EFFECTS_REVIEW.md).
Performance and behavior baseline remains `238cb1a0`; the initial planning
commit is `034082eb`. The accompanying
[trait eligibility investigation](../investigations/TRAIT_ELIGIBILITY_GAME_PARITY_REVIEW.md)
owns the original composition witnesses.

Gate A is implemented, independently reviewed and committed (`e92454d1`). Gate B
is implemented, independently reviewed and committed; Gate C is next.
The revised order is A replacement rarity → B forced-rarity precedence
→ C Chaos pair rarity → D Ordinary expiry → E ordinary screen composition
→ F closure. The amended execution contract was committed as `e023b3d9` before
Gate B implementation.

Correct ordinary initial boon screens so that complete-offer validation,
candidate support and editor draft construction agree with the supported native
generation stages. An individually eligible trait is not sufficient to prove a
valid screen; pool counts are not sufficient either. First correct the
source-rarity and expiry facts on which later offer validation depends.

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
- Ordinary's precedence over chance facts, including Gorgon and Yarn's
  application/consumption boundary;
- exact-context rarity feasibility for the existing selected Chaos pair;
- active Proper Upbringing's native recheck when Ordinary expires;
- initial priority/replacement seeding, fresh rarity-pool filling and vacancy
  rescue, including their effects on short screens and Fallback Gold;
- engine-owned starting, append and removal drafts, with their existing
  application bindings and shared trait editor;
- correction of obsolete composition evidence and explanations.

**Bridal Glow and Echo Boon Boon Boon are separate follow-up work, not closure
additions.** Bridal's acquisition fallback and later source-rarity level credit
belong together in its own correction. Preserve its existing offer prerequisite
here. BBB's current-run predicates versus linked prerequisites are original
investigation finding 4; do not change its replay eligibility, prior-run
approximation, variable-size draft rules, rarity/level behavior or selected-child
settlement. Ordinary expiry reuses existing promotion behavior without expanding
it into the deferred Bridal correction.

Also excluded: rerolls; new save-progression inputs; Death Defiance or precise
God Sent investment modeling; Chaos-pair, NPC, Hammer or Spell Drop composition
redesign; Concave Stone lifecycle; targeted-trait payload changes; executor
hooks, DAG policy or acquisition timing; general UI redesign. Gorgon retains
its current fixed-rarity authoring simplification; only its forced-rarity
precedence changes. Calling Card/god-keepsake precedence is not a defect in a
reachable slotted-keepsake state and receives no correction.

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
- `docs/audits/traits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`;
- `docs/audits/traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md`, especially numeric
  precedence, Proper Upbringing, Gorgon and Yarn;
- `docs/audits/traits/CHAOS_TRAIT_GAME_DATA_AUDIT.md`, especially paired rarity,
  curse clocks and maturation.

Their current small-pool quotas and first-offer-only account are the policies
being corrected, not acceptance requirements to preserve. The rarity audit's
obsolete descriptions of Chaos effects as future consumers are also not
authority to ignore implemented modifiers. Other modeled exclusions remain in
force. The rarity investigation's C1/C2 map to Gate B, C3 to Gate C, and C4 to
Gate D; its C5/C6 are the deferred Bridal correction.

Source references use the reviewed local snapshot at
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts`:

| Native contact                                                                                         | Relevant fact                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UpgradeChoiceLogic.lua:GetPriorityTraits` (739–793)                                                   | Eligibility and occupied priority slots determine whether to seed several core options or one remaining eligible core. Attack/Special is guaranteed only when an eligible such option exists in the applicable multi-core branch.         |
| `UpgradeChoiceLogic.lua:GetReplacementTraits` (795–822)                                                | Replacement candidates retain individual eligibility and carry an explicit promoted rarity from the occupied slot.                                                                                                                        |
| `TraitLogic.lua:SetTraitsOnLoot` (1791–1830)                                                           | Initial replacement seeding precedes core seeding; an empty replacement result falls through. Optional linked priority insertions precede ordinary filling.                                                                               |
| `TraitLogic.lua:SetTraitsOnLoot` (1864–1947)                                                           | Priority identities receive their own rarity treatment; remaining positions draw from surviving rarity tables. Choosing an identity removes it from all tables. A later successful rarity roll can supersede the tentative Common result. |
| `TraitLogic.lua:SetTraitsOnLoot` (1949–1993)                                                           | Replacement rescue fills vacancies after fresh rolls; a further rarity-table rescue runs when effective Denial is off. That final pass does not roll the probabilities again.                                                             |
| `UpgradeChoiceLogic.lua:CreateBoonLootButtons`                                                         | Fallback Gold represents an empty generated list, not an extra trait beside a short list.                                                                                                                                                 |
| `RoomLogic.lua:IsRarityForcedCommon`, `GetRarityChances`; `TraitLogic.lua:SetTraitsOnLoot` (1758–1786) | Forced Common clears the chance table before normal generation. Otherwise sparse room override wins over item override, additions precede multipliers, and values are not clamped.                                                        |
| `EncounterPresentation.lua:AthenaSpawnPresentation` (1428–1433)                                        | Gorgon supplies a rank-specific chance override, not an exemption from Ordinary. Rank II–IV also suppress temporary rarity bonuses.                                                                                                       |
| `TraitLogic.lua:1778`; `UpgradeChoiceLogic.lua:1123–1128`                                              | A normally boosted screen marks `RarityBoosted`; closing it consumes the limited rarity bonus. A freshly generated Ordinary-forced screen does not receive that boost.                                                                    |
| `LootData_Chaos.lua:TrialUpgrade`; `TraitLogic.lua:SetTransformingTraitsOnLoot` (1710–1745)            | Chaos ignores temporary bonuses; ordinary pairs roll Epic then Rare from its exact chance table. Single-rarity blessings take precedence over Barren's forced Heroic.                                                                     |
| `TraitData_Chaos.lua:ChaosCommonCurse`; `TraitLogic.lua:HandleTraitExpired` (1328–1335)                | Ordinary expiry reruns `UpgradeAllCommon` when Proper is active, without requiring a new activation. The affected screen's selection precedes use consumption/expiry.                                                                     |

The native optional linked priorities are declared for `BlindChanceBoon`,
`MassiveKnockupBoon` and `PoseidonStatusBoon` in `TraitData.lua`, each with
`PriorityChance = 0.25`. Account for their supported seed paths, not just the
ordinary core seed. Any needed normalized fact belongs in the catalog, not a
trait-name switch in the engine. Profile-dependent first-seen priorities and
reroll exclusion paths remain outside the progressed initial-screen baseline.

## Intended engine shape

### Source rarity before generation support

Keep the existing numeric ledger and offer-context authority. Resolve native
forced-rarity policy before deriving or retaining chance facts; consumers must
not receive both forced Common and a stale table that forbids Common. Reuse
that result for selected assessment, candidates, Offer State, Gorgon's fixed
rarity resolution and the existing limited-bonus settlement decision.

Ordinary wins over room/item bonuses and Proper's Rare contribution. The
installed BoonData does not enable the dormant `AllowRarityOverride` exemption.
Preserve explicit replacement promotion, Hymn precedence and later vacancy
rescue. Do not disable all rarity checks or add individual Yarn/Gorgon exceptions
at downstream callers. No new persisted context, runtime coordinator or
parallel rarity resolver is needed.

### Chaos pair rarity support

Keep the authored three-curse/one-selected-blessing representation. Static pair
shape remains the codec's responsibility; chance feasibility belongs to
simulation and the existing Chaos candidate capability at the exact frontier.
Do not invent unpersisted blessing peers or use ordinary boon composition for
Chaos.

Reuse the chance arithmetic with native Chaos source scope: its sparse item
override, applicable room override and unlimited modifiers, excluding Yarn and
Proper's god-only contribution. Nonfixed pairs use Epic then Rare support;
fixed Legendary and Barren/Heroic remain explicit source branches. Embryo's
direct tier assignment is not a Chaos screen roll and remains unchanged.
Any missing source declaration belongs in the normalized catalog, not React.

### Ordinary expiry and Proper recheck

Extend the existing Chaos expiration/history transition at its current
screen-use clock. When Ordinary expires and Proper is active, reuse the
declaration-owned Common-to-Rare promotion pass, including its established
target exclusions and source-rarity assignment. Do not promote Common boons
after every acquisition, add a new timeline action or move the expiry to room
exit. The final affected screen's newly selected boon must participate in the
native expiry recheck. Preserve authored offer rarity as historical evidence.

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

The focused starting points for the added rarity work are:

- Gate B: engine `simulation/traits/offers.ts`,
  `rewards/trait-settlement/coordinator.ts`,
  `rewards/biome/encounter-acquisition/gorgon-started.ts` and the existing
  `candidates/trait-offer/capability.ts` source-context consumers.
- Gate C: the same rarity arithmetic/offer assessment owners, engine
  `authored-project/traits/state.ts` for the preserved static pair boundary,
  `candidates/trait-offer/capability.ts` for Chaos domains, and catalog
  `declarations/traits/chaos.ts` plus its owning normalization if a source fact
  is missing. Application changes are limited to adapting existing repair
  capabilities/findings if necessary.
- Gate D: engine `simulation/traits/history/fold.ts`, its existing Chaos-clock
  transition callers and declaration-owned Proper promotion. No application
  chronology or executor policy belongs in this gate.

| Owner                    | Starting files or symbols                                                                                                                                                                                                                                             | Responsibility                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog                  | `packages/hades2-catalog/src/declarations/traits/`, `compiler/traits/`; engine `catalog-schema/traits.ts`                                                                                                                                                             | Only source-backed generation facts missing from the normalized contract. No authored or editor policy.                                               |
| Engine assessments       | `packages/planner-engine/src/simulation/traits/offer-domain.ts`, `authoring/assessment.ts`, `rarity.ts`, `offers.ts`                                                                                                                                                  | Replace quota/first-offer shortcuts; distinguish explicit replacement rarity and stage-aware fresh support; resolve effective source/Fear facts once. |
| Engine drafts/candidates | `simulation/traits/authoring/drafts.ts`, `simulation/candidates/trait-offer/capability.ts`, `simulation/candidates/session.ts`                                                                                                                                        | Consume the same composition authority at captured branch contexts; expose supported draft operations and truthful evidence.                          |
| Application              | `apps/planner/src/projections/candidates/candidateTraitAdapters.ts`, `candidateProjectionSession.ts`, `candidateProjection.ts`; `projections/structured-workspace/contracts/traits.ts`, `interactions/trait-offers/bind.ts`; `projections/rewards/traitProjection.ts` | Adapt capabilities and evidence, without deriving eligibility.                                                                                        |
| React                    | `apps/planner/src/ui/editor/rewards/TraitOfferEditorShell.tsx`, `TraitOfferStateInspector.tsx`                                                                                                                                                                        | Invoke engine-produced operations and render accurate feedback; retain the existing editor layout.                                                    |

## Delivery gates and commit boundaries

### A — Correct explicit replacement rarity

Status: implemented and independently reviewed with no findings. The new
regression failed before the fix; all 98 tests in the four owning/contact files
below pass after it. Workspace/fixture typechecking and focused ESLint pass.
Full closure verification remains in Gate F. Implementation is committed.

Deliver the focused individual-assessment fix, its candidate contact, and
source/authority corrections specific to replacement rarity. No new composition
framework or changes to BBB. Commit only when the replacement transition and
its picker agree and existing fresh-rarity checks remain effective.

Primary regression owner: engine `test/simulation/trait-replacement.test.ts`.
Existing `boon-rarity.test.ts`, `trait-offers.test.ts` and
`trait-offer-focused-candidates.test.ts` cover arithmetic and consumer contacts.

### B — Correct forced-rarity precedence

Status: implemented, independently reviewed and committed. The review's
Yarn witness gap was corrected and verified. All 117 tests across the five
focused Chaos, Gorgon, rarity, candidate and replacement files pass, along with
engine typechecking, scoped ESLint, formatting and diff checks. Full repository
and performance verification remain in Gate F.

Deliver C1/C2 from the rarity investigation: establish Ordinary before numeric
facts are built or consumed, align Gorgon's resolver, and preserve Yarn until
a screen actually receives its temporary bonus. Carry the result through
candidate/Offer State consumers in the same slice; do not commit a
selected-validation fix with contradictory picker support.

Primary tests: `test/simulation/chaos-traits.test.ts` owns Ordinary interactions
and Yarn consumption; `gorgon-amulet.test.ts` owns the Gorgon contact. Reuse
`boon-rarity.test.ts` for arithmetic and retain a representative exact-candidate
witness rather than duplicating the full matrix. Reproduce the confirmed
Common Zeus/Yarn and rank-III Gorgon failures before correction. Delete the
superseded conflicting context path, not the shared ledger.

### C — Validate Chaos screen rarity at its exact source

Deliver C3: source-backed chance support for the selected pair, aligned across
validation and existing Chaos rarity candidates. Keep static decoding,
independent magnitude authoring and the current editor structure. Impossible
but structurally representable saved rarities produce repairable findings,
not load exceptions or automatic rewrites.

Primary tests: `test/simulation/chaos-traits.test.ts`; normalized catalog tests
own any new source facts. A candidate/repair contact verifies that the same
rarity domain reaches authoring. Reproduce Common Chaos with rank-IV Excellence
being accepted before correction. Replace unconditional dynamic C/R/E support
where used; retain C/R/E as a structural domain, not a probability assertion.

### D — Apply Proper's recheck at Ordinary expiry

Deliver C4 through existing history settlement. Establish a failing lifecycle
witness first: acquire and activate Proper, acquire Ordinary, settle affected
Common offers, expire the curse, and observe the promoted inventory before
the next action. This is currently source-traced, not an already-passing
product witness. Do not seed a hand-invented active-Proper flag to prove the
entire lifecycle.

Primary tests: `test/simulation/chaos-traits.test.ts`, reusing existing trait
history/acquisition support. Check pre-expiry retention, the last selected
boon's promotion, inactive/no Proper, and declaration-excluded targets with a
small shared setup. Remove the expiry omission by reusing the promotion owner;
do not introduce a second promotion loop or take on Bridal's deferred mutation
credit correction.

### E — Replace ordinary composition and its editor consumers

Begin only after B–D are implemented and reviewed. This is the original
composition/editor slice, now consuming the corrected rarity foundation.

Deliver the complete vertical slice: native stage support, exact Fear/source
context, any necessary normalized declarations, selected validation, candidate
support, draft operations, application bindings and affected Offer State fields.
Delete the superseded quotas, first-offer-only restrictions and high-tier-only
draft policy in this slice. Do not commit a new engine contract with old draft
or UI semantics still attached.

Primary composition tests stay in engine `test/simulation/trait-replacement.test.ts`,
`trait-offers.test.ts` and `denial-traits.test.ts`; candidate contacts in
`trait-offer-focused-candidates.test.ts`. Catalog normalization owns any new
declaration matrix. Existing application binding and `TraitOfferShell.test.tsx`
tests own representative draft controls, not another copy of the rule matrix.

### F — Closure

After gate reviews and their bounded remediation passes, perform the main-session
whole-product review, then complete repository verification and the performance
comparison against the recorded pre-change base. Update only affected stale
test expectations and generated products; valid cases must not be weakened
merely to make the suite pass.

Integrate corrected source precedence, Chaos rarity support, Ordinary expiry
and composition into their owning reward/candidate sections and source audits,
replacing obsolete explanations rather than appending fix narratives. Delete
this plan. Retire the delivered parts of both investigations; retain only the
concrete deferred Bridal/BBB questions and necessary source evidence, or move
them into their focused follow-up investigation. Do not keep completed matrices
as delivery history or make Bridal/BBB implementation a closure prerequisite.

Each implementation gate receives a focused executor packet and a fresh
independent review under the repository routine. The main session owns scope,
Git, finding dispositions and broad closure checks. Each gate is a coherent
implementation/commit boundary, with its own narrow tests and independent
review; reuse the executor for bounded remediation or adjacent ownership.
No concurrent write agents. Do not rerun the full repository suite per gate.

## Acceptance and audit-againsts

| Witness                                                                              | Required outcome                                                                                                                                                                                                      | Primary owner                                                                          |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Supplied Apollo Trial: Perfect Image / Exceptional Talent / Nova Strike              | Accepted without Extra Dose; all options use the real pre-offer state.                                                                                                                                                | One representative authored-plan/candidate witness, backed by engine composition tests |
| Later initial Apollo offer after Zeus Attack: three non-core boons                   | Rejected when every supported seed path requires core or replacement participation.                                                                                                                                   | Engine composition                                                                     |
| Few/no eligible priority options, including banned Attack/Special                    | No unconditional three-core or Attack/Special demand when native seeding cannot supply it; later fill still runs.                                                                                                     | Engine composition                                                                     |
| Common Zeus Attack replaced by Rare Nova under guaranteed fresh Epic                 | Exact Rare replacement accepted; wrong promotion and unrelated fresh Rare remain rejected where appropriate.                                                                                                          | Engine rarity/replacement                                                              |
| Ordinary + Yarn, followed by a later eligible screen                                 | The affected Common screen is legal and retains Yarn; a later normally boosted screen applies and consumes it once. Selected assessment and candidates agree.                                                         | Engine Chaos/trait settlement                                                          |
| Ordinary + guaranteed room/item/Proper rarity inputs                                 | Forced Common is not rejected by stale numeric facts; unaffected source override precedence and explicit replacements remain intact.                                                                                  | Engine Chaos with existing arithmetic contacts                                         |
| Ordinary + rank-III Gorgon                                                           | Fixed Athena authoring resolves Common consistently through settlement and candidates; II–IV temporary-bonus suppression remains intact.                                                                              | Engine Gorgon                                                                          |
| Common Chaos pair + rank-IV Excellence                                               | Common becomes a repairable invalid choice because Rare is guaranteed; valid remaining rarity candidates can repair it.                                                                                               | Engine Chaos and one candidate/repair contact                                          |
| Chaos modifier/source boundaries                                                     | Applicable unlimited bonuses and room precedence affect ordinary pair support; god-only/temporary bonuses do not. Fixed Legendary and Barren/Heroic bypass ordinary pair rolls; Embryo direct grants remain separate. | Engine Chaos; catalog owns any added facts                                             |
| Proper active through Ordinary's final affected screen                               | Before expiry, acquired Common boons remain Common; expiry promotes eligible owned Common boons, including that screen's selected boon, before later actions. Authored offered rarities remain unchanged.             | Engine lifecycle/trait history                                                         |
| Ordinary expires without active Proper or with excluded targets                      | No invented promotion; existing target exclusions and non-Common rarities remain respected.                                                                                                                           | Same engine lifecycle owner                                                            |
| Replacement roll zero, optional and forced; forced roll with no eligible replacement | Correct initial seed alternatives and vacancy rescue; no invented obligatory replacement.                                                                                                                             | Engine composition                                                                     |
| Ordinary, high-tier and replacement pools near exhaustion                            | Earlier stages may fill a screen without every ordinary trait; actual vacancies cannot be ignored. Optional versus guaranteed rolls remain distinct.                                                                  | Engine composition                                                                     |
| Effective Denial active, inactive and suppressed                                     | Final rescue follows the chosen source policy; prior bans remain in every case. Fallback is allowed only after a genuinely empty terminal construction.                                                               | Engine Denial/composition                                                              |
| Optional linked priority seed and rarity-table depletion                             | Supported seed/fill paths remain available; removed identities do not reappear through another rarity table.                                                                                                          | Catalog fact contact and engine composition                                            |
| Short exhausted screen with add/remove; short incomplete draft with add              | Controls follow engine completion/terminal support. A mandatory third position cannot be removed just because its current trait is Legendary.                                                                         | Representative application binding/UI witnesses                                        |
| Invalid selected targeted trait or upstream edit                                     | Exact repair context and Start over remain available; no sibling option enters history and no automatic rewrite of authored state.                                                                                    | Existing candidate/repair tests plus one affected contact if needed                    |

Capture the Apollo witness through the repository's existing test builders or
a bounded checked-in authored fixture; tests must not depend on a Windows path.
Do not clone the whole user plan into many fixtures or recreate the native
algorithm in test helpers. Retain existing provider-boundary tests for BBB,
Chaos, NPC, Hammer and Spell Drop without adding a duplicate exclusion matrix.

Review specifically for:

- forced Common coexisting with cached numeric facts or consuming unused Yarn;
- Gorgon/candidate/selected paths resolving different source-rarity precedence;
- Chaos's authored static domain being mistaken for contextual probability
  support, or its direct grants being treated as fresh screens;
- an expiry correction that promotes too early, runs a new clock, changes
  authored rarity, or expands into Bridal/BBB settlement;
- a new staged validator still defeated by old pre-filtering or quota checks;
- fresh-roll rarity tests incorrectly reused for seeded or rescue outcomes;
- treating a zero-valued native rarity-table entry as absent, or treating a
  guaranteed roll as optional;
- cross-branch support mixing, display-order-dependent legality, or target
  context lost during draft reconstruction;
- full-pool Cartesian enumeration on every picker query instead of a bounded
  three-position support check using existing prepared facts;
- inaccurate replacement statistics retained solely for presentation;
- source assumptions widened beyond the agreed source-rarity, expiry and
  ordinary initial-screen scope.

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
