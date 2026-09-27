# Authored JSON checkpoints and test consumers

Status: inventory and recommendations, not an implementation plan.
Baseline: `7dea8cfe`, September 26, 2026.

## Scope and method

Inventory of all 29 checked-in authored `.runplanner.json` checkpoints, their
loaders, procedural wrappers, and representative consumer tests. File discovery,
fixture-helper call tracing, and targeted source reading were used; the consumer
column is representative, not an exhaustive runtime coverage graph. Imports alone
do not count as exercised behavior. Shared support and function-pointer consumers
were checked separately where relevant. A Terra/high read-only pass investigated
new-fixture opportunities, especially Dream and encounter setup.

No fixture or test was changed. Recommendations have not been benchmarked.

All authored JSON files below live under
`test/fixtures/authored-project/checkpoints/`. IDs omit `.runplanner.json`.
Loader definitions are in `checkpoints/underworld.ts` and `checkpoints/surface.ts`;
convenience wrappers are in `routes/underworld.ts` and `routes/surface.ts`.

Test references use these roots:

- **E:** `packages/planner-engine/test/`
- **A:** `apps/planner/test/`
- **C:** `test/fixtures/authored-project/checkpoints/`

Every checkpoint has central manifest/registry/codec integrity coverage. A row
with only an integrity consumer is not automatically dead: it may own a specific
regression or have an existing recipe that consumers should stop replaying.

## Current authored fixture matrix

| Checkpoint                                | Established state                                       | Representative consumers / current path                                                                                                              | Disposition                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `underworld-fg`                           | Canonical F/G route                                     | `createCompleteFGProject()` loads JSON on its default path; E simulation and command suites, E execution compiler, A projections and UI              | Keep broad baseline; do not mistake `create` for reconstruction                                                                 |
| `underworld-ixion-chaos`                  | Settled Spark of Ixion G Chaos detour                   | C recipe attestation; E authoring-readiness, resource-cleanup, assembler, execution bytes and checkpoint export/edit witness load the saved state    | Keep as the successful Chaos traversal; retain `natural-chaos-unresolved-trial` for repair                                      |
| `underworld-g-anomaly-roster`             | Successful G Anomaly with ordered roster and return     | C recipe attestation; E infinite-roster, encounter export, execution bytes and checkpoint export/edit witness load the saved state                   | Keep as the successful Anomaly/return example; parameterized roster variants stay recipe-owned                                  |
| `underworld-arachne-cocoons`              | Selected F/G Arachne encounters with F count 11         | C recipe attestation; E cocoon command/codec, encounter export, execution bytes and checkpoint export/edit witness load the saved state              | Keep as the cocoon success example; range and invalid-context matrix remains in the command/simulation owner                    |
| `underworld-twist-scylla`                 | F Postboss Twist and rival Scylla performer             | C recipe attestation; E checkpoint export/edit witness                                                                                               | Keep bounded Well transformation and Underworld boss-choice example                                                             |
| `surface-anvil`                           | Purchased Q World Shop Anvil                            | C recipe attestation; E assembler export and checkpoint export/edit witness load the saved state                                                     | Keep as the reached Anvil transformation example                                                                                |
| `underworld-fgh`                          | Canonical F/G/H route                                   | `createGoldenFGHProject()` loads JSON; E Fields/spatial tests, A reward/run-state projections                                                        | Keep for real third-biome history                                                                                               |
| `underworld-fghi`                         | Canonical full Underworld                               | `createGoldenFGHIProject()` loads JSON; A generated-encounter editor, E Echo/Clockwork/export, product loops                                         | Keep; loading avoids construction but still simulates upstream state                                                            |
| `underworld-f-pool`                       | F Postboss sale, prior picked trait retained in history | C `check.test.ts:124`; A `OccurrenceRoomFeatures`, E assembler/compiler instead call the equivalent command recipe                                   | Reuse saved checkpoint for consumers; central recipe equality already exists                                                    |
| `underworld-f-stygian-well`               | F-only Postboss Well with Travel Deal and purchases     | Registered loader; E `stygian-well`, command `room-actions`, A `StygianWellWorkbench`, E export use `createUnderworldFWellCheckpoint` recipe instead | High-priority reuse after equality/variant verification; see below                                                              |
| `underworld-f-midshop-pom-frontier`       | Unresolved Midshop Pom                                  | A Pom product loop and `DecisionWorkbench`; E F candidates and Pom resolution                                                                        | Keep as targeted repair checkpoint                                                                                              |
| `natural-chaos-unresolved-trial`          | Small Chaos unresolved-trait frontier                   | E commands `chaos-trait-offer`; A structured-workspace interaction support use artifact `.load()` directly                                           | Keep; real consumers despite no named convenience loader                                                                        |
| `nemesis-f-trait-trade`                   | Accepted F trade with continuation                      | A `routeNpcIndex`; C Nemesis recipe/behavior witnesses                                                                                               | Keep; specialized NPC-history input                                                                                             |
| `nemesis-h-fields`                        | Nemesis placement and Fields state                      | E `fields-spatial-candidates`; A occurrence assembly/workbench/features                                                                              | Keep; already shared across lanes                                                                                               |
| `nemesis-f-pom-sea-star`                  | Nemesis Pom and duplicate outcome                       | C `nemesis-random-events.test.ts` recipe and behavior assertions                                                                                     | Keep bounded scenario; no broad consumer gap established                                                                        |
| `surface-n`                               | Canonical Hub route                                     | `loadSurfaceNProject()` direct loader; Hub command/simulation/UI and product tests                                                                   | Keep central Hub baseline                                                                                                       |
| `surface-no`                              | N/O prefix                                              | `loadSurfaceNOProject()` loads then reapplies forced Shrine offers; Ship, Shrine, Circe, export tests                                                | Resolve repeated completion wrapper, not another parallel JSON                                                                  |
| `surface-nop`                             | N/O/P prefix                                            | Same forced-Shrine completion pattern; P traits/actions/features and Pom product loop                                                                | Same disposition                                                                                                                |
| `surface-nopq`                            | Full Surface                                            | Same completion pattern; A encounter/workspace/product tests and E export/late-biome tests                                                           | Same disposition; preserve full-history witnesses                                                                               |
| `surface-n-entry-frontier`                | Entry/pre-Hub incomplete decision                       | A Hub/topology assembly, navigation, workspace contract; E readiness                                                                                 | Keep incomplete-state checkpoint                                                                                                |
| `surface-n-entry-frontier-resolved`       | Resolved entry boundary                                 | A interaction binding, biome/decision workbench, shell; E readiness                                                                                  | Keep; distinct handoff state, not just a duplicate file                                                                         |
| `surface-n-complete-hub-frontier`         | Six visits plus fountain, ready for handoff             | A Hub map/tabs/completion, interaction binding, Run State loop                                                                                       | Keep; use commands for downstream delta under test                                                                              |
| `surface-n-partial-hub`                   | Partial visit order                                     | A biome presentation and Hub timeline; shared Hub support                                                                                            | Keep append/readiness setup                                                                                                     |
| `surface-n-ten-open-invalid`              | Retained invalid board                                  | A editor-session reconciliation and Hub support/membership tests                                                                                     | Keep; tests need representable invalid authoring                                                                                |
| `surface-n-story-board`                   | Hub with story encounter                                | A Hub cards/encounter/trait shell; E encounter commands and N reward candidates                                                                      | Keep shared story baseline                                                                                                      |
| `surface-n-resources`                     | Authored resource state                                 | E resources; A inspector, shell, route workspace                                                                                                     | Keep                                                                                                                            |
| `surface-n-natural-selection-frontier`    | Unresolved target sequence                              | A Golden Surface product loop; C recipe attestation                                                                                                  | Keep exact repair frontier                                                                                                      |
| `surface-n-queens-ransom`                 | Acquisition with removed Zeus traits                    | A `TraitOfferEditor`; C recipe attestation                                                                                                           | Keep targeted outcome state                                                                                                     |
| `surface-n-quick-buck`                    | Gold pickup workflow                                    | A run-impacting-traits loop and reward assembly; E pickup producers; C recipes                                                                       | Keep                                                                                                                            |
| `surface-n-buried-treasure`               | Resource pickup workflow                                | A run-impacting-traits loop and reward assembly; C recipes                                                                                           | Keep; different reward behavior from Quick Buck                                                                                 |
| `surface-n-steady-growth-frontier`        | Unresolved clocked outcome                              | C run-impacting-trait recipe attestation; convenience loader has no additional direct consumer found                                                 | Do not add another equivalent fixture; retain pending decision on whether its integrity witness is sufficient reason to keep it |
| `surface-n-shrine-side-room-delivery`     | Side-room source, later unplaced delivery               | C equality witness; A Redux and `HermesShrineWorkbench` instead use command recipe                                                                   | Replace equivalent recipe setup with saved loader                                                                               |
| `surface-no-hermes-shrine-delivery`       | Rushed purchase plus placed delayed delivery            | C equality witness; E Shrine inventory/readiness and delivery commands use recipe                                                                    | Load saved state for default; preserve unplaced variant explicitly                                                              |
| `surface-p-steady-growth-shrine-frontier` | P delayed/clocked repair                                | E Shrine inventory and progressive-selected-products; A trait editor/project operations                                                              | Keep; specific cross-system frontier                                                                                            |

## First opportunity: use JSON already present

### Pool and Shrine recipes

Central checks already prove encoded equality between saved input and recipe:

- C `check.test.ts:124-129`: Pool.
- C `check.test.ts:205-210`: O Shrine delivery.
- C `check.test.ts:234-239`: N side-room Shrine delivery.

Their ordinary consumers can load those checkpoints and apply only the edit under
test. Keep one central recipe/behavior witness, rather than reconstructing in
each consumer. This improves fixture use without adding any JSON.

Do not blindly substitute a placed-delivery fixture for
`createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false })`.
That variant intentionally stops before placement. Establish an equivalent
semantic unplacement delta or retain that focused recipe. Do not manipulate
persisted fields manually to simulate command cleanup.

### Well variants need an explicit comparison

`routes/underworld.ts:117-211` rebuilds the Well from the F/G checkpoint. The
existing JSON is F-only. Despite its name, `configuredTail=true` returns the
F-only slice, while `false` retains the F/G route. Consumers exercise both.

Compare the default result with the saved JSON before switching it to a loader;
then decide how to prepare the F/G variant without losing G's existing authored
tail. Simply configuring another biome on the F-only checkpoint is not guaranteed
to recreate that tail. Keep the non-default recipe if necessary; do not add a
second Well JSON until measurements and actual reuse justify it.

Likely benefiting suites: E `simulation/stygian-well.test.ts`,
`authored-project/commands/room-actions.test.ts`, `execution-plan/assembler.test.ts`,
`execution-plan/compiler.test.ts`; A `StygianWellWorkbench`, `DecisionWorkbench`,
travel-deal projections, and inspector destinations.

### Surface loaders currently edit on load

`routes/surface.ts:288-341` applies six Shrine-offer commands for NO and nine for
NOP/NOPQ on every wrapper call. The raw checkpoint loader itself is already lazy,
cached, decoded, and frozen (`checkpoints/loader.ts`).

Before changing canonical files, compare raw and completed wrapper products and
identify tests that deliberately need the raw frontier. Prefer making the intended
canonical loaded state explicit, or caching a pure derived test checkpoint, over
adding three near-duplicate `with-shrines` JSONs. Existing narrow raw consumers must
not silently acquire a new meaning. No performance claim is made until measured.

## Setup-reuse proposal

This section considers setup cost only. The major-feature coverage matrix below
adds a separate reason to author representative JSON, even when a TS builder is
cheap. Its recommendations supersede the earlier one-new-checkpoint ceiling.

### Add one default Dream mixed-handoff checkpoint — strongest new candidate

Proposed ID: `dream-mixed-handoff`.

Capture the current default output of `dreamMixedHandoffProject()` in
`routes/dream.ts:243-510`: the configured Q/F/N prefix of its locked Dream route.
Unlike most ordinary-route `create` helpers, this performs substantial command
replay and trait settlement rather than merely loading a file.

| Consumer                                                 | What loading would replace                  | What must remain exercised                                  |
| -------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| E `execution-plan/dream.test.ts:21`                      | Default route construction                  | Dream export and navigation contract                        |
| E execution fixture registry and compiler fixture matrix | Same default construction on multiple paths | Producer/decoder/byte checks; consolidate builds separately |
| E `execution-plan/npc-shopping.test.ts:62`               | Unrelated Dream setup                       | NPC protection edit and export                              |
| E `simulation/state-baseline.test.ts:64`                 | Default Dream build                         | State baseline assertions                                   |
| E `simulation/hermes-shrine-inventory.test.ts:995`       | Default multi-biome setup                   | Final-preboss maturity                                      |
| E `simulation/encounters/tartarus-entry.test.ts:199`     | Existing Dream base before itinerary edits  | First/later I distinction                                   |
| E `simulation/reward-store-support.test.ts:221`          | Default comparison side                     | Keep the reordered `fBatchOrder` variant's command recipe   |

Keep an explicit recipe as the creation/provenance witness. Do not have every test
replay it, and do not make the recipe load its own output checkpoint; that would
make attestation circular. Preserve the parameterized reorder recipe where the
construction itself establishes the scenario under test.

This is test infrastructure only: extend the checkpoint manifest route union and
registry to accept Dream; no authored schema or execution protocol change is
needed. Generate through `encodeProjectDocument`. Authored checkpoints currently
require exact encoder bytes in C `check.test.ts`; do not apply the separate
pretty-printed execution-fixture convention to them.

### No additional JSON justified by setup cost alone

- No evidence yet for generic Dream H/I/O/P-start snapshots. First/later/final
  ordinal, itinerary and history are causal inputs in several existing tests;
  replacing ordinary histories with Dream-first would change the tested rule.
- Current generated-composition, P precombat, and Typhon export builders apply a
  handful of focused edits to existing checkpoints. Keep those deltas rather than
  introducing one fixture per customization.
- No new generic Hub JSON: existing entry/partial/complete/invalid/story states
  already cover the useful boundaries. A Phial first/last variant is a small
  command delta unless repeated setup measurements establish otherwise.
- Do not snapshot all parameterized inputs. JSON is useful for stable history,
  not as a replacement for readable rule matrices.

## Test ownership for a checkpoint-based suite

1. Central integrity checks own strict decode, frozen load identity, canonical
   bytes, metadata, and registered file coverage. These already exist.
2. Each scenario owns a small meaningful state assertion or expected repair
   frontier. Not all valid project documents represent complete-valid routes.
   Do not require unresolved/invalid fixtures to export successfully.
3. A bounded recipe witness establishes that the checkpoint can be produced
   through supported authoring. Retain a few UI creation journeys separately;
   command recipes do not prove click/keyboard wiring.
4. Consumer tests load, issue the semantic command under test, and assert the
   distinct outcome. They need not restate fixture integrity or every prior step.
5. Execution JSON remains a downstream protocol product. It cannot replace an
   authored input when testing commands, Undo, candidate context, or findings.

Loading saves setup replay, not simulation. Tests that inspect derived state
still need the evaluator; central fixture validity does not license mocking away
that test's semantic transition. Assess setup and evaluation cost separately.

## Major-feature coverage of the actual authored JSON

Coverage here means a concrete saved authoring example, not merely a field in
the codec or a scenario produced at test runtime. The baseline pass parsed 29
JSONs and inspected nonempty values, selected options, and action references.
It did not re-simulate every saved plan to certify each owner's reachability.
The C2 addenda update the promoted rows below; other rows retain their original
inventory status.

Statuses:

- **Present:** concrete authored values/actions exist; existing owner tests may
  establish execution, but presence alone does not certify that here.
- **Partial:** only defaults, an unresolved outcome, or a repair checkpoint shows
  the feature; not a complete success example.
- **Absent:** no concrete authored example found in these 29 files. This does
  not mean the feature lacks TS tests or exported execution fixtures.

| Major feature / authoring family                                        | Saved authored evidence                                                                                                                                               | Status and missing witness                                                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Ordinary Underworld / Surface routes and configured prefixes            | `underworld-fg/fgh/fghi`, `surface-n/no/nop/nopq`                                                                                                                     | Present; retain as uncluttered baselines                                                                 |
| Dream locked route and ordinal-dependent handoffs                       | `dream-mixed-handoff` stores the configured Q/F/N locked itinerary and reached handoffs                                                                               | Present; retain its narrow mixed-route consumer                                                          |
| Starting weapon/aspect and loadout                                      | All 29 use `WeaponStaffSwing` / `BaseStaffAspect`; 28 have empty manual Arcana and zero Fear                                                                          | Partial; no non-base weapon/aspect example                                                               |
| Nontrivial Arcana/Fear and Arcana-changing outcomes                     | `surface-p-steady-growth-shrine-frontier` has 11 manual cards, four nonzero vows, selected Circe `activateArcana`, Judgment selections                                | Present in a repair checkpoint; lacks a representative complete advanced-loadout plan                    |
| Generated encounters: waves, highlight, budgets                         | `underworld-generated-composition` stores selected generated waves, highlights and allocations                                                                        | Present; retain exhaustive candidate matrices in TS tests                                                |
| Fangs and Menace customization                                          | `underworld-generated-composition` stores positive Fangs perks and Menace conversions                                                                                 | Present; retain exhaustive conversion/perk matrices in TS tests                                          |
| Boss customization, including ordered choices                           | `underworld-twist-scylla` stores its selected G Boss performer                                                                                                        | Present; distinct boss-control matrices remain in TS tests                                               |
| Cocoon count and Anomaly roster                                         | `underworld-arachne-cocoons` selects F/G Arachne with F `cocoonCount: 11`; `underworld-g-anomaly-roster` selects the reached ordered roster                           | Present; command/simulation tests retain range and roster-order matrices                                 |
| Chaos detour and its selected blessing                                  | `underworld-ixion-chaos` reaches selected G Chaos with a settled TrialUpgrade blessing                                                                                | Present; retain `natural-chaos-unresolved-trial` as the focused repair input                             |
| Zagreus Contract detour and supplemental shop item                      | `underworld-zagreus-contract` selects G Midshop Zagreus, reaches its G Miniboss return, and acquires the later G Preboss Contract `StackUpgrade` item                 | Present; retain the partial availability helper as its distinct frontier input                           |
| G Anomaly replacement/success/return                                    | `underworld-g-anomaly-roster` reaches successful `B_Combat01` replacement, ordered roster and fixed return                                                            | Present; TS command tests still own exhaustive reanchoring                                               |
| Hub open set, ordered visits, side rooms                                | 17 JSONs with Hub/local-visit topology                                                                                                                                | Present; no need for another generic Hub baseline                                                        |
| Hub fountain position and Phial                                         | `surface-n-phial-intermediate-fountain` has an interleaved N fountain and settled Phial target                                                                        | Present; retain its action-order repair witness                                                          |
| Fields cages, optional rewards, spatial placement                       | FGH/FGHI and Nemesis Fields plans contain `fieldsCombat`, spatial state and cage/pickup actions                                                                       | Present; preserve these examples independently of new customization                                      |
| O multi-encounter wheels / P entrance-combat / I Clockwork / Q topology | Ordinary extended route checkpoints contain the biome-specific state                                                                                                  | Present as topology examples; don't infer active customization from encounter selections                 |
| Boon/Hammer offers, Pom targets, trial pairs, NPC offers                | Concrete trait menus, level choices, `DevotionPair`, Narcissus and Circe choices                                                                                      | Present; exhaustive composition/eligibility stays in TS tests                                            |
| Nested/targeted trait outcomes                                          | Natural Selection checkpoint selects the trait without `naturalSelectionTargets`; no `allTogetherResult`, `concaveStoneResult`, or targeted trait-option result found | Partial/absent success outcomes; Pom target fields elsewhere are not evidence for these carrier children |
| Echo replay and duplicate families                                      | No selected Echo effect or `echoLastRunBoon` / `echoPomTarget`                                                                                                        | Absent; TS Echo fixtures/tests are not saved-plan examples                                               |
| Nemesis interaction and generated pickups                               | Three Nemesis JSONs store free item, gold trade, or boon trade, with generated pickups / Sea Star case                                                                | Present; all five event variants need not become five JSONs                                              |
| World Shop purchases / Mystery acquisition                              | `underworld-world-shop-travel-deal` acquires the F World Shop Armor replacement; P repair plan includes BlindBoxLoot                                                  | Present; retain the smaller P repair frontier for its targeted semantics                                 |
| Travel Deal across inventory families                                   | Well, `underworld-world-shop-travel-deal`, and `surface-shrine-travel-deal` each acquire their carrier's refill; the Shrine delivery is placed at O Combat1           | Present; distinct World Shop and Shrine chronology is now reached rather than retained inventory         |
| Wells, Fateful Twist, Anvil                                             | `underworld-twist-scylla` records a reached Twist result and `surface-anvil` records its acquired transformation result                                               | Present; ordinary Well inventory remains separately covered                                              |
| Purging Pool and sale                                                   | `underworld-f-pool` includes inventory and sale action                                                                                                                | Present; Phial-before-Pool chronology still needs a rich success witness if chosen                       |
| Hermes deliveries: rushed, delayed, placed                              | `surface-no-hermes-shrine-delivery` has both delivery acquisition actions; N side-room file retains an unplaced delivery                                              | Present success and repair inputs; reuse rather than duplicate                                           |
| Steady Growth, Embryo, Supply Chain clocks                              | `surface-scheduled-lifecycle` records settled Growth, Embryo and Supply Chain outcomes                                                                                | Present; retain smaller repair frontiers                                                                 |
| Keepsake changes, Artificer and Time Piece                              | P repair plan has Jeweled Pom result, Goldify rack selection, and conversion dispositions/actions                                                                     | Present in repair state; no complete cross-feature success claim                                         |
| Fig Leaf, Gorgon, Figurine and rarification                             | `underworld-automatic-boss` records reached Crystal Figurine outcomes                                                                                                 | Partial; active Fig Leaf, Gorgon and rarification still need separate success plans                      |
| Hex installation / Path of Stars / aspect Hex                           | 24 files include selected Hex trees; no TalentDrop/TalentBigDrop reward, no aspectHexTree                                                                             | Installation present; Path acquisition and aspect-specific Hex absent                                    |
| Persephone offer-level bonus                                            | No Persephone aspect or `persephoneLevelBonus`                                                                                                                        | Absent                                                                                                   |
| Resources                                                               | `surface-n-resources` assigns three families; P repair file assigns all four                                                                                          | Present; no new JSON for each tool                                                                       |
| Incomplete and context-invalid repair                                   | Entry, ten-open Hub, Natural Selection, Pom, Growth, Shrine frontiers                                                                                                 | Present and valuable; do not turn them all into successful showcase plans                                |

Evidence owners: persisted fields in engine `authored-project/model.ts` and
`traits/state.ts`; existing test recipes in `test/fixtures/authored-project/routes/`
and `packages/planner-engine/test/execution-plan/support/`. The feature families
were cross-checked against `docs/audits/game-execution-contacts/FEATURE_HOOK_MAP.md`.
This matrix is bounded to major user-authorable domains, not every trait or
combinatorial game rule. Desktop discovery, release updating, and game overlay
preferences do not belong in authored run JSON.

## Representative plan portfolio

The objective is a small set of independently useful, loadable and publishable
plans, not a fixture for every row. Preserve the meanings of widely consumed
baseline and deliberately invalid checkpoints. Create named rich variants when
adding a feature would change their existing assumptions.

The following are proposed scenario families, not a promise that every listed
combination is legal in one run. Use existing supported builders where possible;
validate combined state before deciding the exact fixture count.

| Proposed plan family               | Positive features to demonstrate                                                                                                                                             | Existing starting recipe / intended tests                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Underworld encounter showcase      | Multi-wave/highlight/allocation, Fangs, positive Menace; ordinary and cage customization; add a coherent boss choice and cocoon count if compatible                          | `execution-plan/support/generated-composition-fixture.ts`; cocoon/automatic/boss fixtures as source recipes. Consumers: generated customization UI/projection and execution tests                         |
| Surface encounter showcase         | P variable-budget precombat and Q boss choices; retain native encounters elsewhere                                                                                           | P builder in the same support file plus `typhon-customization-fixture.ts`; test load/edit/reset/reload/export of both generated and boss controls                                                         |
| Underworld detours and commerce    | Settled Chaos, selected Contract and return, G Anomaly with roster; acquired Contract item and a World Shop refill; Well Twist/Anvil where a coherent eligible state permits | Existing route-detour and anomaly-roster recipes, inventory/transformation tests. Keep a smaller split if combining destroys clarity or legality                                                          |
| Dream mixed-handoff                | Locked mixed route, ordinal NPC/postboss/terminal behavior                                                                                                                   | Existing `dreamMixedHandoffProject()`; reuse consumers identified above                                                                                                                                   |
| Surface scheduled effects          | Embryo acquisition/maturation, settled Growth, Supply Chain pickup placement, rushed and delayed Hermes deliveries                                                           | Promote `surfaceScheduledLifecycleProject()` from `scheduled-lifecycle-fixture.ts`; already asserts execution eligibility. Preserve Q-Slice variant as a command-derived case unless separately justified |
| Hub Phial success                  | Interleaved fountain with selected target, room-local control host, reordered-action repair                                                                                  | `surfaceNPhialIntermediateFountainProject()`; already has execution JSON. Add first/last position through commands rather than three new plans                                                            |
| Advanced trait / keepsake outcomes | Non-base aspect/loadout, positive rarification or secondary acquisition, targeted trait result, Echo nested/replayed outcome, positive automatic-keepsake use                | Source from existing `concave-stone`, `boon-rarity`, `echo-traits`, `echo-gift-keepsake`, `judgment-arcana` tests; not yet a validated combined recipe                                                    |
| Hex progression / alternate aspect | Installed tree followed by a real Path acquisition; aspect-specific behavior or Persephone bonus in a compatible alternative                                                 | `hex-progress` and trait-level tests. Selene and Persephone are mutually exclusive aspects: use separate variants if both are required; never claim one saved loadout covers both                         |

These families fill different gaps. The first six have concrete existing recipes
or close combinations; the last two need bounded authoring design. Do not create
an overloaded all-features route just to reduce file count. Additional active
Fig Leaf/Gorgon/Figurine, All Together, Echo-family and Shrine-refill examples
should be assigned to compatible portfolio variants during that design, not
silently dropped or declared covered by dormant data. A single example per major
editor/effect mechanism is the initial target; every trait/perk/rarity permutation
remains the focused TS suite's responsibility.

### What proves that a saved plan exercises a feature?

For each new success plan, one central scenario witness should establish:

1. The checked-in authored JSON is loaded, not reconstructed before the test.
2. Its key feature owner lies on the reached selected route; a retained unvisited
   branch or unselected trait option does not satisfy the claim.
3. Evaluation reaches and settles the intended effect without blocking findings.
4. Export carries the relevant nonempty outcome/choice, or the appropriate state
   result for a simulation-only feature. Do not demand nonexistent wire fields.
5. A representative command edit survives save/reload and can be reset/undone
   where that is the workflow under test. Keep one UI binding witness per distinct
   control family, rather than reproducing all these assertions in every lane.

Examples: positive Menace conversions and Fangs perks must reach exported waves;
a Hub Phial example must change the selected target's evaluated rarity; a Hex
example must actually acquire Path points. Merely searching JSON for `menace`,
`fountainRarityResult`, or `hexTree` is inventory evidence, not acceptance.

This adds integration confidence without taking over rule matrices. Keep central
fixture checks semantic and small; do not add a generic feature manifest with a
second implementation of the simulator. Initially, ordinary scenario-specific
tests plus this human-reviewed matrix are sufficient.

## Recommended order and open decisions

- Reuse existing Pool and Shrine checkpoints where equality is already proved.
- Verify Well variants and Surface completion wrappers before changing them.
- Author one Dream mixed-handoff JSON with central attestation and named consumers.
- Measure the result alongside the execution-fixture build consolidation from
  `TEST_SUITE_REDUNDANCY_INVENTORY.md`.
- Add encounter and scheduled-effect success checkpoints for major-feature
  coverage even when they do not reduce setup cost. Refine the portfolio above
  before authoring advanced combined scenarios.
- Judge further fixtures by either real setup reuse or a distinct major-feature
  success witness. No target fixture count is proposed.

The expanded objective supports more than the single Dream checkpoint: meaningful
major features are absent from the saved plans today. Reuse existing JSON first,
promote coherent success recipes, and preserve simple baselines and repair inputs.
This is a proposed portfolio, not yet an authorization to generate or rewrite it.
