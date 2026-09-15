# Trait eligibility: planner/game parity review

## Question and status

Does the current planner admit exactly the supported trait screens the game
can generate, using the same pre-acquisition state and respecting the project's
explicit modeling exclusions?

Reviewed against planner commit `238cb1a0` and the local game-script snapshot at
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts`. Source references below
refer to that snapshot, not an assumed latest game release. This is a temporary
investigation, not an implementation contract. No production behavior changed.

The supported screen is the initial, pre-reroll offer. Reroll inventory and use
are not modeled, and outcomes reachable only through rerolls do not widen the
planner's initial-screen eligibility domain.

The immediate witness is the Apollo Trial offer in the user's `underworld.json`:
Perfect Image, Exceptional Talent, and Nova Strike are individually legal, but
the complete screen is rejected.

## Assessment

The existing ownership and chronological architecture are worth keeping. The
catalog owns declarations; simulation owns the exact pre-offer history and
context; candidate evaluation and validation consume the same assessments;
selected acquisition effects remain separate from the offered alternatives.

The weakness is narrower: the game constructs a screen in stages, while the
planner approximates those stages with pool partitions, cardinality rules,
and row-local rarity checks. That approximation both rejects possible screens
and accepts impossible ones. A separate replay boundary conflates native
current-state eligibility with ordinary linked-trait prerequisites.

Four discrepancies are confirmed below against the initial-screen boundary.
The source's Denial-dependent final exhaustion pass is an additional, already
documented deliberate divergence; changing it requires an explicit policy decision.

## Coverage and evidence limits

- The normalized catalog contains 419 trait declarations across 23 givers.
  This count includes effect-backed NPC choices, Chaos entries and spells;
  it is not a count of ordinary boons.
- A disposable probe compared all nine Olympian pools and Hermes against
  `LootData_<God>.lua`: all ten memberships matched.
- The probe evaluated the game's actual `LinkedTraitData` and
  `TraitRequirements` Lua declarations, including its `CombineTables` helper,
  and compared the positive requirement groups against the catalog. All 75
  non-Chaos, non-Selene-special entries matched. The additional
  `SpellMoonBeamTrait -> SuitHexAspect` entry is represented through the
  catalog's explicit aspect-starting-trait path, not the ordinary Spell Drop
  pool. The two Chaos entries were checked through their dedicated predicates.
- Targeted source reads covered generation stages, rarity, Trial restrictions,
  ownership/bans, negative requirements, infusion thresholds, NPC/direct
  acquisition boundaries, Chaos pairs, and nested trait carriers.
- Existing focused coverage passed: 149 tests across trait offers, rarity,
  Denial, Chaos, Echo, catalog offer declarations and rarity/elements.
  Additional disposable probes demonstrated the discrepancies below and were
  removed after recording their results.

This is a rule-family review, not an exhaustive enumeration of all combinations
of 419 traits. It did not replay every live game screen, reaudit every Hammer
data row, test executor hooks, or redo the complete scheduler/lifecycle audit.
The counterexamples distinguish the supplied project witness from isolated
pre-offer-state probes. Passing existing tests establishes current behavior,
not native parity where those tests encode an approximation.

## Model comparison

Engine paths in this table are relative to `packages/planner-engine/src/`.

| Boundary                                          | Game authority                                                              | Planner authority                                                                | Assessment                                                                                                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider membership                               | `LootData_<God>.lua`, NPC choice arrays                                     | Catalog `declarations/traits/`; normalized giver membership                      | Ten ordinary/Hermes pools mechanically match. NPC pools retain their separate acquisition semantics.                                                                                                                               |
| Positive linked prerequisites                     | `TraitData.lua:121`, `RunLogic.lua:57` (`HasTraitRequirements`)             | Catalog requirement groups; `simulation/traits/level-effects.ts:169`             | The 75 compared entries match. No Apollo/Exceptional Talent transcription error.                                                                                                                                                   |
| Current-run requirements                          | `RunLogic.lua:98` (`IsTraitEligible`), each trait's `GameStateRequirements` | `simulation/traits/authoring/assessment.ts:224`, `level-effects.ts:169`          | Ordinary checks cover modeled facts. Echo drops this layer; finding 4.                                                                                                                                                             |
| Already owned, prior-picked, banned               | `GetEligibleUpgrades`, `IsTraitEligible`                                    | `assessTraitOptionAgainstRarityDomain`; history fold                             | Explicitly modeled. Ownership, permanent bans and prior-picked exclusions are distinct.                                                                                                                                            |
| Weapon/aspect compatibility and mutual exclusions | Hammer declarations, `IsTraitEligible`, occupied slots                      | Catalog `hammerCompatibility`, negative requirements, exact context              | Existing typed domains and 92-by-24 Hammer coverage are appropriate. No new discrepancy identified in this bounded review.                                                                                                         |
| Initial and later core-slot priority              | `UpgradeChoiceLogic.lua:739`, `TraitLogic.lua:1791`                         | `assessTraitOfferComposition`, `traitCandidates`, draft construction             | First-offer-only approximation omits the later seed requirement; finding 2.                                                                                                                                                        |
| Replacements and final screen composition         | `GetReplacementTraits`; staged fill in `SetTraitsOnLoot`                    | `assessTraitOfferDomainComposition`, `assessTraitReplacementComposition`         | Pool-count rules lose the distinction between initial replacement seeding and vacancy rescue; finding 1.                                                                                                                           |
| Rarity arithmetic and provider overrides          | `RoomLogic.lua:2093`, `GetRarityChances`, `SetTraitsOnLoot`                 | `simulation/traits/rarity.ts`, `offers.ts`, provider declarations                | Ordered checks, non-normalized values, room/item precedence and ordinary provider distinctions are represented. Applying fresh-roll availability to an explicit replacement is wrong; finding 3.                                   |
| Trial high tiers                                  | `EncounterLogic.lua:1686/1692`, `RewardLogic.lua:396`                       | Exact `devotionNoDuo` context                                                    | Trial blocks the ordinary Duo roll, not Legendary. The later bucket investigation S10 distinguishes inherited individual bans from five declaration overrides and final rescue. This is not the original Apollo rejection's cause. |
| Denial and exhaustion                             | `HandleUpgradeChoiceSelection`, `TraitLogic.lua:1963`                       | Trait history bans; shared composition policy                                    | Ordinary bans and Chaos curse bans are represented. The final no-Denial rarity-rescue branch is deliberately not mirrored; decision below.                                                                                         |
| Rejected and Ordinary Chaos effects               | `CalcNumLootChoices`, upgrade-menu selection, `IsRarityForcedCommon`        | `simulation/traits/offers.ts` and authored rejected option                       | Rejected retains visible alternatives with one unselectable identity; Ordinary controls source rarity/replacement opportunity. Do not reinterpret Rejected as simply deleting a displayed row.                                     |
| Chaos pairing                                     | `TraitLogic.lua:1700-1744`, `TraitData_Chaos.lua`                           | Chaos catalog and `evaluateReachedTraitOfferWithAssessments`                     | Separate paired domain is appropriate: unique blessings, possibly repeated curses, selected magnitude/rarity and all displayed curse eligibility. Unselected blessing magnitudes are intentionally not authored.                   |
| Story/effect-backed choices                       | `EventLogic.lua:906-1249`, source option requirements                       | NPC declarations and trait-settlement selected dispositions                      | Must not inherit ordinary Olympian composition. Volatile predicates retain their documented boundary.                                                                                                                              |
| Echo Boon Boon Boon                               | `EventLogic.lua:1580-1625`                                                  | `simulation/traits/offer-domain.ts:96`                                           | Correctly bypasses the linked-prerequisite graph and uses an authored prior-run-cache approximation. Incorrectly also bypasses modeled native current-state predicates; finding 4.                                                 |
| Concave Stone and nested payloads                 | Frozen upgrade-button data and selection callbacks                          | `rewards/trait-settlement/concave-stone-secondary.ts`, selected-child settlement | Frozen offer rows and selected-child consequences are distinct. No basis to recheck every residual against a newly generated ordinary offer. Preserve the current carrier/payload architecture.                                    |
| Candidate context and chronology                  | Generation/interaction contact determines native state                      | Trait settlement captures `before`/context; candidate capability consumes them   | No supplied witness requires reconstructing context in React or changing lifecycle timing. Correct the shared assessments, not individual picker exceptions.                                                                       |

## Confirmed discrepancies

### 1. Exhaustion can require an ordinary boon the native screen may omit

**Impact: rejects a valid complete offer.**

The supplied project's G Trial is in `G_Combat13`, occurrence
`05d7ce68-dcfd-4dcd-8750-6a4efbdd6c36`. At its Apollo offer:

- the remaining ordinary identities are Perfect Image and Extra Dose;
- Exceptional Talent's three prerequisite groups are satisfied;
- Nova Strike can replace the existing Epic Zeus Attack at Heroic;
- the normal replacement chance is nonzero; and
- Denial is active, while Trial blocks Duo only.

Perfect Image / Exceptional Talent / Nova Strike each passes the engine's
individual assessment. The whole offer fails solely with
`missingMandatoryOrdinary: DoubleStrikeChanceBoon` (Extra Dose).

The native construction can seed Nova Strike through the successful replacement
roll, fill one remaining slot with Perfect Image, then roll Exceptional Talent
for the last slot. That final rarity selection supersedes the tentative Common
candidate; Extra Dose need not appear. This is a possible native branch, not a
claim about its probability or a recorded live-game roll.

The planner instead requires every ordinary identity whenever the ordinary
pool contains fewer than three members:

- engine: `simulation/traits/offer-domain.ts:231`, especially the
  `missingOrdinary` condition;
- native: `TraitLogic.lua:1791-1806`, `1920-1947`, and the separate
  vacancy-only replacement pass at `1949-1961`.

**Disposition:** correct shared offer composition, not Apollo or Trial data.
Simply deleting the mandatory-ordinary rule is not enough: preserve real
vacancy-filling obligations while recognizing screens filled by the earlier
replacement/high-tier stages.

### 2. Later initial offers can omit a required priority seed

**Impact: accepts an initial screen the native generation path cannot produce.**

A focused pre-offer witness owns Common Zeus Attack, with the other ordinary
slots vacant. Offer Apollo's Perfect Image / Extra Dose / Super Nova, all
Common, with no replacement.

The engine accepts all three rows and the complete composition. Its output is:
eight ordinary candidates, one replacement candidate, zero required
replacements, and no applicable first-offer priority constraint.

Native `GetPriorityTraits` still operates here. If the replacement roll succeeds,
Nova Strike occupies an offer position. If it does not, an eligible vacant
Apollo core-slot trait occupies a position. Neither fresh-generation path yields
three non-core options. Optional linked-trait priority does not remove that
initial seed.

Rerolls have a different source path: `RerollBoonLoot`
(`UpgradeChoiceLogic.lua:706-718`) supplies `ExclusionNames`, which can remove
the sole priority seed before ordinary filling (`TraitLogic.lua:1848-1857`).
That can produce three non-core boons, but reroll-only outcomes are outside
the supported initial-screen domain and do not make this witness valid.

- native: `UpgradeChoiceLogic.lua:739-793`, `TraitLogic.lua:1791-1830`;
- engine: `simulation/traits/offer-domain.ts:317` and
  `simulation/traits/authoring/assessment.ts:589` restrict priority composition
  only while all ordinary slots are empty.

**Disposition:** include later priority seeding in the shared composition
correction. Preserve the no-eligible-priority and replacement cases; do not
substitute an unconditional core requirement for source-stage support. No
reroll machinery or new authored input is needed.

The older pool audit scoped its guarantee to the first offer. That misses the
weaker priority guarantee on later initial screens.

### 3. A replacement's promoted rarity is checked as a fresh roll

**Impact: rejects an available replacement under sufficiently strong rarity
bonuses.**

Keep a Common Zeus Attack and consider Rare Nova Strike as its replacement.
Use the declared Q miniboss rarity override (`Epic = 0.7`), Rare-rank Divinity
(`+0.1 Epic`), and one Yarn (`+0.25 Epic`). These supported contributions make
the ordinary fresh Epic check `1.05`.

The isolated pre-offer assessment rejects Rare Nova Strike with both
`occupiedBoonSlot` and `rarityRollUnavailable: Rare`.

Native `GetReplacementTraits` explicitly assigns `GetUpgradedRarity` of the
old slotted trait. `SetTraitsOnLoot` preserves an already assigned rarity when
processing priority entries. The Rare replacement does not roll against the
fresh Epic table.

- native: `UpgradeChoiceLogic.lua:795-822`, `TraitLogic.lua:1898-1912`;
- engine: `simulation/traits/authoring/assessment.ts:280` checks fresh-roll
  availability before establishing the replacement, then treats that finding
  as a non-slot reason to deny the replacement transition;
- source facts: catalog `declarations/rooms/q.ts`,
  `declarations/arcana-fear.ts:152`, and the Yarn contribution in
  `simulation/traits/offers.ts`.

**Disposition:** keep explicit promoted replacement rarity separate from
fresh-roll rarity. The row assessor, composition domain and candidate picker
should agree through the same authority. Do not exempt an entire offer from
rarity checks, or change the correct rarity arithmetic.

### 4. Echo bypasses current-state predicates along with linked prerequisites

**Impact: admits replay boons the game excludes using state the planner already
models.**

With only Common Zeus Attack and no Fire, the ordinary assessment rejects
Apollo's Self Healing because it requires two Fire. Echo's
`echoLastRunBoonOutcomes` marks its Common, Rare and Epic variants legal.
The same probe exposes Whispered Prayer without any Hex and Proper Upbringing
without the required elements. It also accepts Uncommon Grace despite the
existing Common Zeus Attack; the native offer predicate requires zero Common
god boons (`TraitData_Hera.lua:1806`).

The source is unambiguous:

- `EventLogic.lua:1608-1618` calls `IsTraitEligible` for every prior-run candidate;
- `RunLogic.lua:98-134` includes each trait's `GameStateRequirements`;
- `TraitData_Elementals.lua:349-361` requires two Fire for Self Healing;
- `TraitData_Artemis.lua` requires a supported equipped Hex for Whispered Prayer;
- `TraitData_Elementals.lua:64` declares Proper Upbringing's elemental offer
  requirements.

Echo does **not** call `HasTraitRequirements`, so an ordinary positive-linked
prerequisite such as Weak Potency's prerequisite is correctly bypassed. But
`assessEchoLastRunBoonOption` currently checks only ownership, bans, prior-picked
exclusion, slot occupancy and targeted-acquisition availability. It never
checks the remaining modeled current-run predicates.

The catalog currently collects both native layers into `offerRequirements`.
Filtering by expression kind would not fully repair this: for example,
Whispered Prayer's `anyEquippedTrait` comes from native `GameStateRequirements`,
while many other `anyEquippedTrait` expressions come from `TraitRequirements`.

**Disposition:** make that distinction explicit at the owning declaration and
assessment boundary, then reuse current-run predicate evaluation for Echo.
Do not rerun all ordinary prerequisites for BBB, add per-trait Echo exceptions,
or introduce live Death Defiance/Hex-node simulation. The existing Echo audit
already requires queryable current-state predicates; this implementation does
not fulfill that part of the documented contract.

## Deliberate differences, not automatic bug fixes

| Difference                                           | Current policy and disposition                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fully progressed save                                | Lifetime unlocks, introductory narrative restrictions and first-seen presentation priorities are intentionally outside the authored run. Do not add profile-progression fields to achieve literal parity with every save.                                                                                                                                                            |
| Death Defiance and precise invested God Sent talents | The volatile-eligibility audit deliberately allows exact authored outcomes without simulating combat losses or the complete purchased Hex graph. Task Force retains the necessary settled-Spell-Drop prefix. Preserve this boundary.                                                                                                                                                 |
| Echo's unknown previous-run cache                    | The author supplies up to three source-valid prior-run results. The planner does not prove those traits appeared in an actual previous save. This does not justify ignoring current-run facts it already knows.                                                                                                                                                                      |
| High-tier exhaustion with Denial off                 | `TraitLogic.lua:1963-1993` runs an additional vacancy rescue when `BanUnpickedBoonsShrineUpgrade.ChangeValue <= 0`. The composition audit expressly chooses universal exhaustion/Fallback Gold behavior instead. That policy can disagree with native screens even after finding 1 is fixed. Decide whether to retire the simplification before claiming literal composition parity. |
| Exact random probability and seed                    | The planner authors supported outcomes, not a replica of the game's RNG stream or weighted probability distribution. Nonzero optional priority chances do not alone require a new authored field.                                                                                                                                                                                    |
| Chaos's unselected blessing detail                   | The selected pair's exact blessing/values and all displayed curse identities carry modeled consequences. There is no requirement to persist irrelevant unselected blessing rolls merely to copy the entire native object.                                                                                                                                                            |

## Boundaries not promoted to findings

- `ExchangeOnlyFromLootName` appears on the spurned Trial loot, but a search of
  this source snapshot found no generation consumer of that field. The
  existence of a suggestive flag does not establish an additional planner
  restriction.
- The composition-domain cache omits some `TraitOfferContext` fields. The
  inspected ordinary/Hermes consumer paths do not establish a user-visible
  collision for those omitted fields. Do not report a cache bug without a
  same-history, differing-result production witness.
- The optional-context comment in `checkRequirement` promises absent-as-false,
  whereas the comparison is exact `undefined === false`. Real room contexts
  explicitly supply `blockGiftBoons`; no supplied-plan failure was attributed
  to this. It is a small API/comment inconsistency, not evidence to rebuild
  context capture.
- First-offer recovery after removing every core boon, while Denial has banned
  some priority options, needs coverage when correcting priority seeding.
  It is a consequence of finding 2's stage model, not a separately reproduced
  project failure here.

## Recommended next scope

Keep the existing catalog/engine/application direction and exact candidate
artifacts. The proposed
[initial offer plan](../progress/INITIAL_TRAIT_OFFER_COMPOSITION_PLAN.md) covers
findings 1–3 and the exhaustion policy. Finding 4, Echo Boon Boon Boon's
current-state predicates versus linked prerequisites, is explicitly deferred
at the user's request and must not be folded into that implementation.

The intended correctness test is: **can this complete authored initial screen
result from the source stages at this exact pre-offer state?** It is not “is every
trait individually eligible?” or “did we include every member of a small
ordinary pool?”

Use a bounded staged support check over a maximum of three positions, with
explicit initial priority/replacement, ordinary/high-tier fill, and vacancy
rescue semantics. Establish the concrete algorithm before committing to any
abstraction; this does not call for a generic rules engine, an RNG emulator,
a second simulation pass, or semantic checks in React/the executor.

Retain source-derived witnesses for both acceptance directions:

- the supplied Apollo screen must be accepted;
- a later initial three-non-core screen with an unavoidable priority seed must
  fail; reroll-only support must not widen this domain;
- explicit replacement rarity must survive guaranteed fresh higher rarity;
- exhaustion/rescue behavior must match the explicitly chosen Denial policy.

The separate deferred Echo correction must bypass linked prerequisites while
respecting modeled current-run exclusions.

The accepted authoring boundary separates individual picker eligibility from
complete-offer generation support. Both use exact pre-offer facts, but a row
must not become unselectable because its siblings make the current composition
invalid. The focused
[bucket-rule investigation](INITIAL_OFFER_BUCKET_RULES.md) records the detailed
native stage inputs and remaining source questions.

The shared editor already delegates draft operations to engine capabilities.
Retire its high-tier-only append/remove helpers and complete-path prediction.
Add/Remove are structural edits within the ordinary zero-to-three-row envelope;
zero uses the existing Fallback Gold variant. Removing the last row enters Gold,
and adding one individually eligible row leaves it without a separate fallback
button or completion search. Add disables at three or when no unused eligible
identity remains; Remove disables at zero. An intermediate short, Gold or
incompatible draft gets findings without losing its repair controls. Start over
remains an assisted valid-outcome constructor. Generation buckets and
composition policy remain in the engine, not React.

## Documentation disposition

No new permanent audit is needed just to accumulate these findings. On eventual
implementation, revise the existing owners:

- `TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`: replace its unconditional
  small-pool membership rule with source-stage evidence; resolve the documented
  Denial divergence rather than silently retaining an incompatible claim.
- `TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`: distinguish current-state predicates
  from linked prerequisites and replace historical first-slice/deferred wording
  where it misdescribes implemented replacements. Keep its matching declaration
  inventory.
- The owning reward/candidate design sections: update only the changed shared
  contract, not a narrative for each counterexample.

At initial-offer delivery closure, remove the completed material and retain
only the deferred Echo question and necessary evidence. Retire that remainder
when the separate question is resolved. No protocol, persisted-schema or
executor changes are implied by the review; the plan includes narrow editor
capability changes, not a new trait editor.
