# Trait rarity and initial-offer composition correction

## Status and objective

Locked on 2026-09-15; amended after user review of the
[rarity-effects matrix](../investigations/TRAIT_RARITY_EFFECTS_REVIEW.md).
Performance and behavior baseline remains `238cb1a0`; the initial planning
commit is `034082eb`. The accompanying
[trait eligibility investigation](../investigations/TRAIT_ELIGIBILITY_GAME_PARITY_REVIEW.md)
owns the original composition witnesses.

The expanded Gate E source contract is recorded in
[initial-offer bucket rules](../investigations/INITIAL_OFFER_BUCKET_RULES.md).
Its native rule identifiers are review and witness references, not production
types. Read that focused contract before the Gate E packet; do not repeat a
broad catalog or application inventory.

Gate A is implemented, independently reviewed and committed (`e92454d1`). Gate B
is implemented, independently reviewed and committed (`23d7adff`). Gate C is
implemented, independently reviewed and committed (`a5333e65`). Gate D is
complete and independently reviewed, including the user-approved NPC
screen-consumption correction (`6e1702a2`). Gate E is in progress. Its expanded
source-contract and permissive-draft amendment has completed two independent
plan reviews. The user has accepted the finding dispositions, including
zero-to-three-row editing with Gold at zero and the declaration-owned Trial
exceptions. That amendment was committed as `f22c1d83` before implementation.
The source reviewer identified a witness label error, corrected against
the catalog (Glorious Disaster, not Super Nova); the product review's initial
Fallback Gold gap and the source follow-up's multi-replacement Hymn bonus
correction are also incorporated. No unresolved review finding remains.
The revised order is A replacement rarity → B forced-rarity precedence
→ C Chaos pair rarity → D Ordinary consumption/expiry → E ordinary screen composition
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
- Ordinary/Rejected screen consumption and restriction support for ranked NPC
  gods, matching their existing rarity-effect scope;
- active Proper Upbringing's native recheck when Ordinary expires;
- initial priority/replacement seeding, fresh rarity-pool filling and vacancy
  rescue, including their effects on short screens and Fallback Gold;
- individual-only picker eligibility, engine-owned valid starting drafts and
  structural append/removal operations, with their existing application
  bindings and shared trait editor;
- correction of obsolete composition evidence and explanations.

The expanded E amendment includes the accepted correction of the source-proven Trial
eligibility/rescue distinction (bucket contract S10). Most Duos retain the native
Devotion exclusion; five declaration overrides do not. Trial still zeroes the
ordinary Duo roll. With Denial off, its final rescue may select an eligible
exception. Use existing declaration-owned context requirements to express the
resolved game facts, not a new exception flag, five-name engine switch or Lua
inheritance mechanism. No other current-state predicates are being relaxed.

The same amendment includes S11: every replacement alternative receives the
active Hymn level bonus, independent of authored display order, while its
successful native seed still causes one use to be consumed per screen. Keep
the existing transition and consumption owners; do not expand level settlement.

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
its current fixed-rarity authoring simplification and participates in the shared
Athena source rules. Calling Card/god-keepsake precedence is not a defect in a
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
`PriorityChance = 0.25`. Retain this source fact in the catalog, but generation
checks possibility, not probability: these are optional seed paths, not weighted
search, a quota, or a required offer. Their narrow justification is that a
guaranteed later non-member rarity bucket can exclude the identity from ordinary
filling while priority insertion still admits it. When those later checks can
fail, ordinary filling can reproduce the same outcome; the exact 25% adds no
distinction to validity. The S4 source witness demonstrates the distinguishing
case. Keep one bounded alternative per applicable provider, not probability
simulation or trait-name policy in the engine. Profile-dependent first-seen
priorities and reroll exclusions remain outside the progressed baseline.

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

Align the existing screen-use clock with the qualifying sources already
affected by Ordinary: Olympian, Hermes, Artemis, Athena (including Gorgon) and
Dionysus. Keep Hades and non-god story screens exempt. Ordinary and Rejected
share this clock, so their source qualification, Rejected's restriction and
its authoring domain must remain consistent. Reuse existing normalized source
facts; do not add Gorgon-specific consumption or broaden NPC offer composition.

Extend the existing Chaos expiration/history transition. When Ordinary expires
and Proper is active, reuse the
declaration-owned Common-to-Rare promotion pass, including its established
target exclusions and source-rarity assignment. Do not promote Common boons
after every acquisition, add a new timeline action or move the expiry to room
exit. The final affected screen's newly selected boon must participate in the
native expiry recheck. Preserve authored offer rarity as historical evidence.

### Individual eligibility and generation support

Retain existing predicate, history, replacement and rarity arithmetic owners.
Separate a trait's state/declaration eligibility from whether a particular
generation stage can supply its authored rarity.

The row picker must not ask whether its sibling rows make a supported screen.
Provider membership, modeled prerequisites, ownership/Denial exclusions,
intrinsic rarity shape and exact replacement transition remain individual
checks. Priority seeding, replacement counts, bucket depletion and stage-specific
rarity feasibility belong to complete-offer validation. Both products consume
the same captured pre-offer state, but their legality answers are deliberately
different. A selectable row does not certify a valid screen.

Prepare native generation facts before destructive filtering. In particular,
native priority seeding can inspect an eligible identity whose slot is already
occupied; the public picker's unowned/selectable list is not sufficient input.
Reuse existing predicates to derive the distinct source views. Do not add a
second eligibility engine or reconstruct them from candidate presentation.

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
Correct the current first-row-only Hymn decoration: every replacement transition
reads the active level bonus. The native seed marker governs one-use screen
consumption, not which alternative gets that bonus (S11).

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

Retain the shared editor and its engine-owned operations. Individual row repair,
structural draft editing and constructing a valid complete screen are distinct:

- **Initial authoring / Start over:** construct a supported outcome at the exact
  offer frontier, including Fallback Gold when native construction terminates
  empty. An empty result is a valid outcome, not an unavailable editor.
- **Picker:** offer individually eligible alternatives independently of sibling
  composition. Changing another row cannot remove the ability to repair this
  one. Intrinsic row/payload rules and exact source context still apply.
- **Add/Remove:** remain visible for ordinary variable-size screens. Enable
  within their structural zero-to-three-row envelope: Remove disables at zero,
  Add disables at three or when no unused individually eligible identity
  remains. This local pool-exhaustion limit is structural by explicit user
  decision, not whole-screen composition. Add appends one individually eligible
  row, including from Gold, without requiring a valid complete-screen starting
  draft. Remove deletes the last row; removing the final row produces Gold.
  Neither asks the composition checker for permission. Preserve remaining rows,
  payloads and their existing reference contracts. Reuse the shared editing
  controls without changing BBB's separate minimum or replay policy.
- **Composition findings:** assess short drafts too. A two-row screen may be
  legitimately exhausted or invalid because another row must exist. Either
  result leaves repair controls available; no auto-rewrite is allowed.
- **Fallback Gold:** display this at zero trait rows and assess it through the
  same empty-screen support check as validation. Zero rows do not make Gold
  automatically legal. Keep the existing persisted union: one-to-three rows use
  `kind: 'traits'`; zero uses `kind: 'fallbackGold'` with no selected-row or
  trait-only payloads. No empty persisted trait array or schema change. An
  unauthored offer remains distinct from deliberately deleting all rows or a
  valid empty result from initial authoring/Start over. Remove the separate
  Select Fallback Gold and Return to traits controls and their availability
  machinery; Add/Remove own manual transitions in both directions.
- **Save/settlement:** retain existing target/payload completeness and save
  behavior. Whole-offer validity still gates history settlement and publication;
  an individually available candidate is not a complete-offer success.

Do not encode bucket sizes, core requirements or Denial in React. Rename or
replace the misleading high-tier-specific capabilities with their real callers
in the same slice, without forwarding compatibility aliases. Remove recursive
completion-search gating from Add as well as visibility gating; making a visible
button unable to append because of composition does not meet this contract. Shared UI changes
must preserve BBB's separate bound operations and fixed-size provider behaviors.

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

Status: implemented, independently reviewed with no actionable findings and
committed. All 37 tests across the focused Chaos simulation, catalog
schema, declaration and editor files pass. Engine, catalog and planner
typechecks, scoped ESLint, formatting and diff checks pass. The witnesses cover
selected/candidate agreement, invalid-pair history exclusion and exact finding
ownership, retained Yarn, and a visible invalid rarity with a legal editor
repair. Full repository and performance verification remain in Gate F.

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

### D — Align Ordinary screen consumption and expiry

Status: implemented and independently reviewed as one combined slice with no
actionable findings. All 102 focused Chaos, trait-history, Gorgon and trait-offer
candidate tests pass, plus the 18 existing Concave Stone tests. Engine
typechecking, scoped ESLint, formatting and diff checks pass. The independent
reviewer reran all 29 Chaos tests. Red witnesses reproduced both the missing
final-boon promotion and the NPC consumption/Rejected gaps before correction.
Full verification remains in Gate F.

Native Artemis, Athena and Dionysus screens qualify through
`TreatAsGodLootByShops` (`NPCData_Artemis.lua:1850`, `NPCData_Athena.lua:26`,
`NPCData_Dionysus.lua:28`; `UpgradeChoiceLogic.lua:1124–1133`). Align consumption
with the existing rarity-effect scope. Preserve Hades's explicit ForceCommon
and restricted-choice exemptions. Because Ordinary and Rejected share the
screen clock, use the same qualifying-source rule for Rejected validation and
candidate/editor support; never start consuming an unapplied restriction.
Prove these NPC screens consume one use after a valid settlement, can trigger
Proper's expiry recheck, and do not consume on an invalid offer or an additional
Concave Stone acquisition. Retain a Gorgon source contact and Hades/non-god
exemption witnesses. No new clock, persisted field or generic effect framework.

Deliver C4 through existing history settlement. Establish a failing lifecycle
witness first: acquire and activate Proper, acquire Ordinary, settle affected
Common offers, expire the curse, and observe the promoted inventory before
the next action. Do not seed a hand-invented active-Proper flag to prove the
entire lifecycle.

Primary tests: `test/simulation/chaos-traits.test.ts`, reusing existing trait
history/acquisition support. Check pre-expiry retention, the last selected
boon's promotion, inactive/no Proper, and declaration-excluded targets with a
small shared setup. Remove the expiry omission by reusing the promotion owner;
do not introduce a second promotion loop or take on Bridal's deferred mutation
credit correction.

### E — Replace ordinary composition and its editor consumers

#### Entry and review contract

B–D are complete. E is a high-risk replacement of the generation model, not a
small relaxation of its quotas. The latest user-approved boundary also removes
composition filtering from individual pickers and makes Add/Remove structural.
Amend and review these requirements before writing production code.

Use three bounded read-only investigations before locking E: native seeds and
their eligibility inputs; rarity buckets/filling/rescue; and the existing
engine-to-editor consumer/deletion map. The main session integrates their
evidence and resolves disagreements, rather than treating any agent's report
as authority. Source-specific findings require exact native contacts and a
distinguishing supported-state witness. A speculative synthetic state cannot
expand eligibility.

Two fresh independent reviewers review the amended contract, then two fresh
independent reviewers review the stable implementation:

- **Source parity:** independently trace the native functions and declarations;
  challenge both falsely accepted and falsely rejected screens, especially core
  markers, guaranteed/failed rolls, missing/zero entries and rescue. Check the
  expected witnesses without relying only on production assertions.
- **Product boundary:** challenge ownership, preparation inputs, individual
  versus whole support, candidate branches, draft repair, selected children,
  deletions and work growth. Verify the representative user workflow, not a
  second copy of the complete source matrix in UI tests.

Both review the complete change and can report outside their primary lens.
Neither is the implementation executor or source report's sole author. Main
dispositions every finding; one pass is not a substitute for the other. Use one
write-capable executor with a self-contained packet and reuse it for bounded
remediation. No parallel writes, fresh executor per subpass, or broad test run
per review. Escalate a source-contract conflict instead of silently adapting it.

#### E.1 — Prepared facts and native stage support

Internal delivery pass, not a separately shippable API-only commit:

1. Establish red witnesses for the original Apollo rejection and the incorrectly
   admitted later all-non-core screen. Retain the exact real pre-offer history.
2. Separate source declaration predicates, selectable row predicates and
   complete generation support. S3 must inspect still-eligible occupied/owned
   priorities before public row filters discard them. Do not use only the
   existing `traitCandidates().available` list to construct native seeds.
3. Preserve the corrected rarity facts from A–D. Prepare exact chance values,
   native roll order, chance-entry presence, declared rarity membership,
   effective source restrictions/Fear and seed/replacement facts. Reuse existing
   normalized data; add only the proven missing linked-priority probabilities
   and any other independently established declaration fact. Never infer source
   flags from the current proposal's row order or rarity presentation.
4. Implement S1–S9 from the source contract: seed alternatives, linked priority,
   seed rarity, bounded ordinary draws, vacancy replacement rescue and final
   effective-Denial-dependent rescue. Forced Common, a present zero and a missing
   entry are distinct. Actual failed draw attempts advance the native loop.
   Implement S10 at its owning boundaries: catalog predicates distinguish the
   inherited Trial exclusion from the five overriding declarations; generation
   context still zeroes the Duo roll. Use the existing declaration requirement
   vocabulary, not a new exception flag or inheritance mechanism. No blanket
   Duo eligibility ban or engine switch on those five names. Preserve their
   individual prerequisites and all other Duos' inherited exclusion.
   Apply S11 through existing replacement transitions: all alternatives receive
   the active Hymn level bonus, not only the first authored row. Preserve native
   one-use consumption after a successful Hymn seed; no parallel effect owner.
5. Complete-offer support asks whether at least one construction yields the
   proposed unordered identity/rarity set, or terminates with its short/empty
   shape. Each success uses one captured pre-offer branch. Do not union seed
   eligibility from one branch with rarity/targets from another.

Keep the algorithm bounded to the three-position envelope. For validation,
constrain successful selections to the proposed identities, while retaining the
full remaining pools for emptiness, mandatory seed and superseding-roll checks.
At most six display permutations need consideration; this is not permission
to enumerate every three-trait product of the provider catalog. Failed rolls
and unsuccessful attempts must still be representable. Do not persist search
paths, introduce a generic solver, replay RNG streams, or simulate the project
again for a picker query.

Use one explicit prepared product and existing trait authoring neighborhood.
The implementation may use small private stage helpers where they have clear
inputs/results; no interface-only wrappers or new service layer. A valid
Start-over constructor and support checking share stage policy, not independent
quota approximations. Inventory any existing composition cache before retaining
it: its key must include every fact consumed by this prepared product.

#### E.2 — Individual queries, drafts and editor consumers

Complete this pass before the one coherent E commit:

| Contact                                                                   | Required change or preservation                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authoring/assessment.ts:traitCandidates`, `traitOfferCompositionDomains` | Remove first-Olympian priority gating and invented Common representatives as authorable candidates; build generation views from their actual source facts.                                                                                                                                                                               |
| `authoring/assessment.ts:assessTraitOffer`                                | Remove authored-prefix pooled-rarity filtering from individual row results. Complete generation owns depletion/stage rarity; exact replacement identity and intrinsic rarity restrictions stay local.                                                                                                                                    |
| `candidates/trait-offer/query.ts:focusedEvidenceForBranch`                | Remove core/replacement composition as row blockers and obsolete evidence plumbing. Preserve exact coverage, individual predicates and existing duplicate-row policy.                                                                                                                                                                    |
| `candidates/trait-offer/capability.ts:targetedAcquisitionTargets`         | Use the same individual source assessment for ordinary-primary target repair, never positional or sibling composition. Preserve exact branch target domains and stale-target repair.                                                                                                                                                     |
| Frozen Concave secondary/selected children                                | Preserve successful-primary settlement gates. Individual repair does not authorize inventing a post-primary state from an invalid screen.                                                                                                                                                                                                |
| `authoring/drafts.ts` and session/capability surfaces                     | Delete high-tier-only append/remove APIs and completion-search gates for Add. Retain a shared native-stage valid Start-over constructor; structural edits do not require its success.                                                                                                                                                    |
| Initial editor entry and Start over                                       | Carry an engine-produced traits or Fallback Gold starting outcome through the session, adapters and `TraitOfferEditor.tsx`; do not discard empty-terminal support by narrowing every start to `kind === 'traits'`. Keep valid initial/Start-over construction separate from structural Add out of Gold.                                  |
| App candidate adapters, workspace contracts and bound interactions        | Propagate the replacement supported operations; no quota arithmetic or a parallel app eligibility interpretation. Preserve exact-address batching and retained authored values.                                                                                                                                                          |
| `TraitOfferEditorShell.tsx`, `TraitOfferForm.tsx`                         | Remove composition-gated Remove and the separate Select Fallback Gold/Return to traits controls and availability queries. Keep Add/Remove visible for both traits and Gold; disable Remove at zero and Add at three or when no unused individually eligible identity remains. No composition-driven disappearance or silent Add failure. |
| Offer State producers and inspector                                       | Remove quota-derived required/maximum/shortage fields and labels whose meaning no longer holds. Retain accurate descriptive facts only; no second validator to keep old UI statistics alive.                                                                                                                                             |

Keep ordinary sparse structure restricted to Olympian/Hermes. Do not turn
fixed-three Hammer, NPC, Gorgon or Spell screens into variable-size offers.
Borrow BBB's structural editing/presentation pattern only, not its replay domain.

Append chooses one unused individually eligible identity without requiring a
valid whole-screen completion, whether the current outcome has traits or is
Gold. Removing the last trait returns the existing Gold variant; adding from
Gold returns a one-row traits variant. These are engine-owned draft operations,
not React-owned composition or fallback policy. When no unused eligible identity
exists, Add remains visible but greyed out. No invalid placeholder, blank
transient row, empty persisted traits array or schema change is needed.
For remaining trait rows, Remove preserves unaffected payloads and follows each
existing reference contract:
selected-row clamping, dangling/newly-selected Stone residual invalidation and
retained-invalid Rejected/Rarification references are not one generic cleanup.

Save behavior is unchanged: current full-offer/payload checks still apply. This
amendment permits invalid intermediate drafts and row/target repair; it does not
authorize saving impossible screens or incomplete selected children. Findings
are evaluated on short drafts too. Neither invalid sibling composition nor
failure to construct a valid Start-over may hide an already-authored editor.

#### E.3 — Evidence, review and acceptance

Establish expected results independently of the new implementation. Use source
traces and bounded native helper probes where needed, then retain declarative
test inputs and expected outcomes. Tests must not copy the new stage algorithm
as their oracle or require the developer's local game-script path. Keep native
game code out of production and fixture generators. A full live-game replay is
not required to prove source branch reachability, but do not describe a static
or helper probe as in-game confirmation.

| Rule family               | Minimum distinguishing evidence                                                                                                                                                                                                                                                          | Primary owner                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| S1–S3 seeds               | Original Apollo witness; five vacant cores; later one-seed screen; occupied slot with eligible versus banned provider identity; no eligible cores; unavailable Attack/Special; Hymn with and without a replacement                                                                       | Engine trait-offers/replacement                                            |
| S4 linked priority        | Guaranteed-Duo Apollo witness: priority insertion permits Dazzling Display where ordinary filling must take both Duos; with non-guaranteed checks ordinary filling can reproduce that offer. Merely offered prerequisite grants no eligibility; catalog owns all three declared chances. | Engine witness; catalog owns declarations                                  |
| S5–S7 rarity buckets      | Seed-specific versus pooled rarity; later success supersedes tentative Common without consuming it; identity removed across every bucket; depletion alters next draw; guaranteed roll cannot fail; failed empty-Common attempt                                                           | Engine composition                                                         |
| S8–S9 rescue              | Zero initial replacement roll still permits vacancy rescue; effective Denial on/off/suppressed with bans retained; present-zero versus absent entry; short nonempty and empty terminal screens                                                                                           | Engine composition/Denial                                                  |
| S10 Trial                 | Source-executed Apollo Trial rescue witness reproduced through real authored acquisitions; with Denial on no Duo rescue; a normal inherited Duo stays individually ineligible; catalog matrix covers the five requirement overrides                                                      | Catalog predicates; engine composition and one acquisition-history contact |
| S11 replacement effects   | Exhausted active-Hymn screen with three replacement alternatives: each receives +2; select a non-first row and verify its level credit and exactly one use consumed; row permutation does not change these facts                                                                         | Engine replacement assessment and existing acquisition-history contact     |
| Exact unordered offer     | Permuting all three authored rows preserves generation support; no sibling equips; branch-correlated support cannot be manufactured by merging histories                                                                                                                                 | Engine composition/candidate contact                                       |
| Picker separation         | Individually legal non-core and replacement rows stay selectable despite incompatible siblings; locally illegal traits stay unavailable; missing target retains an exact repair domain under invalid composition                                                                         | Engine focused candidates                                                  |
| Structural editing        | Remove a required third row and see a finding while Add remains usable; add during invalid composition; Add at three/Remove at zero disabled but visible; all unused identities banned/acquired/ineligible disables Add without invoking composition                                     | Engine drafts + one representative UI workflow                             |
| Zero-row editing          | Remove the final row to Gold, receive an invalidity finding when native generation cannot end empty, then Add one eligible row to repair; neither transition needs a valid complete-screen constructor; use existing persisted variants and discard trait-only references at zero        | Engine drafts; fold into the representative UI repair workflow             |
| Empty-terminal authoring  | An unresolved exhausted offer opens directly as valid Fallback Gold; Start over can replace an invalid traits draft with Gold; Add is disabled when no unused eligible identity exists; unauthored state is not implicitly Gold                                                          | Engine starting-outcome contract and one UI contact                        |
| References and boundaries | Remove trailing selected/Stone-referenced row without corrupting retained children; preserve Rejected/Rarification contract; fixed-size providers and BBB unchanged                                                                                                                      | Existing owner tests and representative binding contact                    |

Strengthen existing primary tests in `trait-offers.test.ts`,
`trait-replacement.test.ts`, `denial-traits.test.ts` and
`trait-offer-focused-candidates.test.ts`. The catalog owns the declaration
matrix. Application binding/`TraitOfferShell.test.tsx` witnesses prove one
repair sequence and control behavior; they do not duplicate all source cases.
Use a small bounded authored-plan witness for Apollo, not a copy of the user's
entire route per case. Preserve target, Rarification, Stone and BBB regression
contacts; update stale expected quotas only after establishing the new result.

After E.2 stabilizes, both independent reviewers inspect the entire slice.
Their handoff names actual tests run and remaining uncertainties. Main checks
all displaced paths are gone, test ownership, cache validity and algorithmic
work before accepting the combined commit. No new engine contract ships with
old picker/draft/UI semantics attached. Full verification and cumulative
performance comparison remain F, not a repeated per-subpass gate.

### F — Closure

After gate reviews and their bounded remediation passes, perform the main-session
whole-product review, then complete repository verification and the performance
comparison against the recorded pre-change base. Update only affected stale
test expectations and generated products; valid cases must not be weakened
merely to make the suite pass.

Integrate corrected source precedence, Chaos rarity support, Ordinary expiry
and composition into their owning reward/candidate sections and source audits,
replacing obsolete explanations rather than appending fix narratives. Delete
this plan and the bucket-rule investigation. Retire the delivered parts of the
original eligibility and rarity investigations; retain only the
concrete deferred Bridal/BBB questions and necessary source evidence, or move
them into their focused follow-up investigation. Do not keep completed matrices
as delivery history or make Bridal/BBB implementation a closure prerequisite.

Each implementation gate receives a focused executor packet and a fresh
independent review under the repository routine; E requires both independent
reviews specified above. The main session owns scope,
Git, finding dispositions and broad closure checks. Each gate is a coherent
implementation/commit boundary, with its own narrow tests and independent
review; reuse the executor for bounded remediation or adjacent ownership.
No concurrent write agents. Do not rerun the full repository suite per gate.

## Acceptance and audit-againsts

| Witness                                                                              | Required outcome                                                                                                                                                                                                                 | Primary owner                                                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Supplied Apollo Trial: Perfect Image / Exceptional Talent / Nova Strike              | Accepted without Extra Dose; all options use the real pre-offer state.                                                                                                                                                           | One representative authored-plan/candidate witness, backed by engine composition tests |
| Later initial Apollo offer after Zeus Attack: three non-core boons                   | Rejected when every supported seed path requires core or replacement participation.                                                                                                                                              | Engine composition                                                                     |
| Few/no eligible priority options, including banned Attack/Special                    | No unconditional three-core or Attack/Special demand when native seeding cannot supply it; later fill still runs.                                                                                                                | Engine composition                                                                     |
| Common Zeus Attack replaced by Rare Nova under guaranteed fresh Epic                 | Exact Rare replacement accepted; wrong promotion and unrelated fresh Rare remain rejected where appropriate.                                                                                                                     | Engine rarity/replacement                                                              |
| Ordinary + Yarn, followed by a later eligible screen                                 | The affected Common screen is legal and retains Yarn; a later normally boosted screen applies and consumes it once. Selected assessment and candidates agree.                                                                    | Engine Chaos/trait settlement                                                          |
| Ordinary + guaranteed room/item/Proper rarity inputs                                 | Forced Common is not rejected by stale numeric facts; unaffected source override precedence and explicit replacements remain intact.                                                                                             | Engine Chaos with existing arithmetic contacts                                         |
| Ordinary + rank-III Gorgon                                                           | Fixed Athena authoring resolves Common consistently through settlement and candidates; II–IV temporary-bonus suppression remains intact.                                                                                         | Engine Gorgon                                                                          |
| Common Chaos pair + rank-IV Excellence                                               | Common becomes a repairable invalid choice because Rare is guaranteed; valid remaining rarity candidates can repair it.                                                                                                          | Engine Chaos and one candidate/repair contact                                          |
| Chaos modifier/source boundaries                                                     | Applicable unlimited bonuses and room precedence affect ordinary pair support; god-only/temporary bonuses do not. Fixed Legendary and Barren/Heroic bypass ordinary pair rolls; Embryo direct grants remain separate.            | Engine Chaos; catalog owns any added facts                                             |
| Proper active through Ordinary's final affected screen                               | Before expiry, acquired Common boons remain Common; expiry promotes eligible owned Common boons, including that screen's selected boon, before later actions. Authored offered rarities remain unchanged.                        | Engine lifecycle/trait history                                                         |
| Ordinary expires without active Proper or with excluded targets                      | No invented promotion; existing target exclusions and non-Common rarities remain respected.                                                                                                                                      | Same engine lifecycle owner                                                            |
| Replacement roll zero, optional and forced; forced roll with no eligible replacement | Correct initial seed alternatives and vacancy rescue; no invented obligatory replacement.                                                                                                                                        | Engine composition                                                                     |
| Ordinary, high-tier and replacement pools near exhaustion                            | Earlier stages may fill a screen without every ordinary trait; actual vacancies cannot be ignored. Optional versus guaranteed rolls remain distinct.                                                                             | Engine composition                                                                     |
| Effective Denial active, inactive and suppressed                                     | Final rescue follows the chosen source policy; prior bans remain in every case. Fallback is allowed only after a genuinely empty terminal construction.                                                                          | Engine Denial/composition                                                              |
| Optional linked priority seed and rarity-table depletion                             | Supported seed/fill paths remain available; removed identities do not reappear through another rarity table.                                                                                                                     | Catalog fact contact and engine composition                                            |
| Short exhausted screen with add/remove; short incomplete draft with add              | Controls follow row bounds and unused individually eligible identities, not generation validity. Removing a required third row yields a repairable composition finding; Add remains available when its local domain is nonempty. | Representative application binding/UI witnesses                                        |
| Invalid selected targeted trait or upstream edit                                     | Exact repair context and Start over remain available; no sibling option enters history and no automatic rewrite of authored state.                                                                                               | Existing candidate/repair tests plus one affected contact if needed                    |

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
- picker/primary-target repair or Add/Remove still blocked by sibling composition,
  or a new blank persisted state introduced merely for draft controls;
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

The source-level Trial `BlockRarities` question is resolved by S10 and its native
probe; the declaration-sensitive correction is accepted scope, using existing
requirements rather than a special exception mechanism. If detailed stage translation exposes another
source/model conflict, record a concrete witness and settle its disposition
before extending scope. Do not silently
change a separate eligibility contract or claim parity through a fabricated
test. Catalog identity may change if normalized declarations change; that alone
does not warrant an authored schema or execution protocol change.

Use narrow truthful test lanes during implementation. At closure run one full
`npm run check` after review stabilizes, with performance base `238cb1a0`
explicitly selected so intermediate commits do not hide cumulative regressions.
Follow generated-fixture formatting and selective-refresh policy. Record actual
verification results in the closure commit, not durable design prose.
