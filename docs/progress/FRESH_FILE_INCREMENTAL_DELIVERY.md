# Fresh File: infrastructure, visible authoring, and incremental delivery

Status: **locked 2026-09-28; executing on the `codex/fresh-file` branch in a
separate worktree**. Base: `3d61394116310e5e62a2de5a768c8063e59296f0`, schema
89, execution protocol 50. Reinventory versions, HEAD and worktree before each
gate.

This supersedes the two earlier drafts, which are retired.

## Delivery framing

Develop on a dedicated `codex/fresh-file` branch, preserving unrelated work.
Creating this document does not create/switch branches, commit, push or deploy.
Inventory and isolate the actual feature work before the first implementation.

The owner's preferred sequence is:

1. Strengthen shared infrastructure in complete, independently tested slices.
2. Expose Fresh File creation and ordinary authoring early on the feature branch.
3. Add Fresh File rules visibly, so differences from Underworld can be inspected
   after each slice rather than waiting for a finished feature.
4. Reassess the complete spine for production readiness, then close it.
5. Undertake encounter customization as a separate, later pass.

The early editor is deliberately incomplete in game-rule coverage. This is not
permission for broken codecs, throwing commands, fabricated simulation facts or
regressions to mature projects. Fresh File publication remains unavailable until
the execution contract and minimum rule set are ready; ordinary projects retain
their existing publication path. Use one application-owned development-availability
policy, not fake legality findings for unfinished development work. Remove that
temporary restriction when the feature earns publication readiness.

Gates A–F below are detailed delivery proposals. The subsequent rules roadmap
is intentionally not a frozen implementation packet. Revisit it with the owner
once Fresh File is visibly authorable, and again before production readiness.

## Scope and authorities

Fresh File is one closed initial profile, tagged `FreshFile`, fixed F → G → H → I.
It is not arbitrary save editing, a configurable history profile, or an executor
that converts a mature save. Existing routes retain mature assumptions.

Catalog owns game declarations and profile conditions. Engine owns normalized
contracts, initialization, chronology, histories, legality, commands and export.
Application owns composition, presentation and feature availability. The executor
consumes resolved plans and uses native contacts; it does not become a second
planner. No UI-owned rule filtering or separate Fresh File simulator.

Before an engine gate read `docs/design/SIMULATION_AND_VALIDATION.md` in full,
then the relevant authority sections:

- `AUTHORED_PROJECT_MODEL.md`: schema approval, route loadout, commands and history.
- `ROOM_LIFECYCLE_MODEL.md`: concrete encounter preparation, counter/cache timing,
  snapshots and multi-phase rooms.
- `REWARD_MODEL.md`: shops, generation/acquisition and initial-screen support.
- `GAME_GENERATION_RULES.md`: eligibility before forcing and generation checkpoints.
- `CATALOG_MODEL.md`: modeled inputs and declaration normalization.
- `GAME_INTEGRATION_BOUNDARY.md`: selection, binding, conformance and publication.

Evidence inputs under `docs/investigations/`: Fresh File viability, four domain
outlines, `FRESH_FILE_RULE_AUDIT.md`, and `ENCOUNTER_LIFECYCLE_EQUIVALENCE.md`.
This plan overrides earlier fixed-offer machinery, broad NPC equivalence and
late-only editor exposure proposals in those inputs. Native first-offer facts
remain distinct from our reuse of existing offer validation to express them.

## Compatibility and branch discipline

One authored schema bump is owner-approved for the whole feature, including
nullable loadout selections. No new bump is approved for each slice. Gate F is
the expected owner: ship the app migration and mature-save witnesses with the
first actual persisted change. Check current versions rather than reserving 90.
Derived histories and resource quantities are not persisted. Existing nullable
shop values are reused. If an earlier gate proves a persisted change necessary,
amend bump ownership before coding; no version-only preparation commit.

Inventory later Eris authorship before Gate F's schema change so the one-bump
strategy is deliberate. Unreleased branch-format adjustments must preserve
the owner's in-progress test plans through explicit conversion where needed;
do not silently discard them or recycle a shipped schema. One public migration
is finalized before release. Additional public bumps require approval.

Gate A needs no execution wire change. Fresh File route/loadout publication
requires bilateral TS/Lua decoder changes later. Preserve strict decoding and
truthful re-export requirements. Do not publish incomplete Fresh File execution
by treating it as Underworld.

## Phase I — shared infrastructure

Gates A–E are independent; order them by readiness in focused commits. Their
conceptual independence does not authorize simultaneous writers. A must be
accepted, including its live check, before the execution enablement slice;
nothing in B–F waits on it. Keep Fresh File creation unavailable until F;
engine tests can supply bounded closed initial facts without exposing an
arbitrary progression editor.

### A — Executor-only lifecycle compatibility

Owner: `game-module/src/mods/room/timeline/encounters/{hooks,phases}.lua` and
coordinator contacts/tests. No planner signature, name-pair matrix or new wire data.

Use one comparator at post-selection binding and room-entry/reload proof.
Same-name behavior stays unchanged. For differing names, compare inherited
native declaration lifecycle policy in the same room/phase role. Compatible
substitution binds the actual object and logs both names; a conflict keeps the
existing mismatch policy and reports the differing lifecycle fact.

The bounded dimensions are depth increment, start/end effects, boss effects,
encounter-use consumption, Fig Leaf/Gorgon and envelope termination. Traits,
NPC acquisitions, histories, eligibility requirements, enemies and presentation
are not equivalence checks. Existing conformance owns outcomes; customization
admission remains independently exact and diagnostic.

Normalize native truthiness. Resolve relevant declarative context overrides
without replaying setup. Later-phase SkipEncounterStart/CanEncounterSkipIfNotFirst
must be interpreted consistently at selection and reload. Runtime mutations such
as clearing CanEncounterSkip after a failed roll are not policy differences.

Bounded start contacts: ordinary StartEncounter; audited BeginArachne, Artemis,
Icarus, Heracles, Nemesis, Crawler and PerfectClear callbacks; conditional
BeginAthenaEncounter; ShipsEncounterSetup. Preserve their role conditions.
Unknown start paths or setup mutations affecting compared policy do not prove
compatibility for different-name cases. Do not compare entire event arrays.

Retain occurrence ownership, phase order/count, one phase per native object and
unmodeled-carrier separation. Never claim unrelated ambient encounters. The
rule is general, but its consumer is Fresh File: a mature save has every
introduction complete, so its only different-name case is native eligibility
fallback after a rejected force, which the same comparator covers.

Acceptance: compatible native intro; O depth conflict; P end/skip conflict;
boss/use differences; nil/false; later-phase override; consumed Fig Leaf reload;
H per-cage binding; reconstructed carrier; independent customization decline;
trait outcomes excluded. Primary tests are executor contacts plus a source-backed
inherited-declaration probe. No blanket fixture regeneration. Remove replaced
exact-name vetoes, not unrelated identity checks. Record pending live checks
honestly; no mandatory wait for user testing between infrastructure gates.

### B — Historical god-use and pickup facts

Owners: catalog requirement declarations and engine state/history, trait
settlement and reward-kernel shop/god consumers. Start from existing history
products, not a new event bus or parallel god ledger.

Return explicit immutable facts: relevant gods historically used and historically
acquired. Mature initialization satisfies historical unlocks without filling
the current-run pool. Closed initialization is empty. Actual reached use and
acquisition update their respective facts; offerings do not. Removal never
erases history. Determine exact native contacts rather than treating use and
pickup as synonyms.

Wire both consumers through existing requirement/context products: shop god
intersection with historical pickups, including native empty-intersection
fallback; qualifying Poseidon/Demeter use for Hestia/Aphrodite. Keep Fresh File
bag/profile composition for later integration. Mature candidates must stay equal.

Acceptance: empty/mature initialization; offer versus use versus pickup;
removal retention; pool independence; both consumers at their generation
checkpoint. Policy tests live with history/requirements; one shop integration
witness. Retire superseded threading only where this complete product replaces it.

### C — Resource quantities and accumulated gains

Owners: catalog quantity/source-modifier declarations; engine production and
acquisition settlement; captured Run State as the initial observable consumer.
No spendable inventory or resource ledger in React/Lua.

Resolve base amount, relevant modifiers and per-object native rounding when a
pickup is produced; retain the resolved amount until collection. Acquisition
credits accumulated gains. Double Up's second pickup reuses that amount, not a
second multiplier pass. Shop nonduplication and NPC exemptions remain source-owned.
Spending never reduces cumulative gains. Keep existing pickup-count predicates
when native actually counts pickups.

Generic resource-key arithmetic, bounded initial declarations: Ashes/Bones and
their relevant sources/modifiers, notably Buried Treasure. Other resources need
no numeric ledger until a consumer requires one. Eris's Psyche gift can remain a
normal acquisition without pretending this slice tracks all resource quantities.
Do not label missing coverage as zero resource gain. No fabricated mature balance.

Totals at outgoing generation include only prior settled acquisitions. A later
optional pickup changes future generation, never already-offered doors. Branch
identity and snapshot equality must include new facts wherever consumers need them.

Acceptance: 5 Ashes → 8 under Common Buried Treasure; duplicate adds another 8;
trait changes after production do not rewrite amount; NPC/shop differences;
before/after-generation ordering; resource identity separation; undo/rebuild.
Primary owner: production/acquisition settlement tests, with one snapshot/product
witness. Threshold declarations themselves belong to Fresh File integration.

### D — Stable shop slots with valid emptiness

Owners: engine shop kernel/candidate completion/materialization/export, catalog
shop compiler as needed, application projection and executor inventory binding.
Starting contacts include `reward-kernel/shop.ts`,
`simulation/rewards/shop/inventory.ts`, `shop-codec.ts`, and execution overview.

Keep declared slots and existing nullable option/reward authorship. Produce one
engine-owned inventory assessment distinguishing valid-empty, incomplete and
selected-invalid. A group with zero eligible options yields valid emptiness;
an eligible unset slot is incomplete; an invalid selected item is retained for
repair. Candidate existential completion must recognize empty groups too.

Materialization, findings, UI and export consume that assessment. Empty slots
produce no item, reward-offered event or purchase action. Preserve stable slot
addresses while mapping nonempty items to compact native indices. No inferred
mapping in React or recreated inventory generation in Lua.

Scope is zero eligible options, not partial underfill when some but fewer than
offerCount options survive. Do not promise all native variable inventory cases.

Acceptance: trailing empty group; middle empty group with correct later purchase;
eligible blank; invalid retained selection; mature unchanged inventory; exact
candidate support; encoded planner producer → Lua consumer witness. No authored
bump is presumed. Remove affected fixed-concrete-count assumptions only.

### E — Known encountered-enemy history

Owner: engine encounter assessment/completion, authoritative state/history and
snapshot/query products. Catalog owns enemy identity declarations; no Fresh File
introduction policy in the generic recorder.

Product: a monotonic set of known encountered enemy keys. At reached completion
of a valid, explicitly customized, non-skipped encounter, add its resolved
enemy types. No addition from invalid/unassessed/future/discarded customization,
skipped encounters or guessed uncustomized native rosters. This is planner-known
history, not observation of actual live spawns or proof every native enemy is known.
Absence means not recorded, not proven never seen. Do not seed mature history with
fictional encounters; mature introduction availability remains its initial policy.

Consume the existing assessed composition, never rerun generation from authored
pickers. Record effective positive-count identities: include resolved fixed seeds,
exclude a fully replaced source type, include positive Menace replacements.
Retain exact elite/base keys; later catalog interpretation owns shared introductions.
This identity rule must use the existing resolved output rather than duplicate
allocation/Menace math. Infinite-roster customization cannot attest actual native
spawns; leave it outside this first recorder unless it supplies an equally exact
settled product. Do not infer summons or spawned children.

Completion is the write point, not preparation. Prepared H cages remain prepared;
completing one must not re-resolve siblings. Later preparation may consume the
history. Keep branch-local facts, checkpoint coverage, undo and replay truthful.
Start at `simulation/encounters/{preparation,generation,model}.ts`, history fold,
state composition and the owning encounter-completion transition.

Initial consumer: captured history/snapshot and a narrow pure lookup available
to later requirements. This intentionally lands the owner-requested foundation
before Fresh File's introduction consumer; it must still be observable and
tested, not disconnected scaffolding. No production encounter replacement yet.

Acceptance: sequential customized encounters accumulate/deduplicate; completion
timing; invalid and skipped exclusion; uncustomized adds nothing; effective
replacement identities; phase ownership; prepared-sibling stability; upstream
edit/undo removes or restores derived facts. Primary matrix at engine completion;
one captured-state witness. No authored persistence or executor conformance field.

### Reuse disposition — conditional room forcing

Existing `RoomForce.kind: requirement` is normalized and evaluated after
eligibility; O declarations already use it. No infrastructure gate is needed.
Fresh File binds profile/depth conditions at its consumer. If a missing predicate
is proven, extend it there; do not add a generic external-history interpreter.
Forcing must never bypass room eligibility, caps or exit requirements.

### Infrastructure checkpoint

Review A–E as a coherent unit, run the complete repository gate after narrow
tests stabilize, and document pending live acceptance. Confirm no stale exact-name
path, second ledger, invented native roster, duplicate policy or broken mature
behavior. Then land the visible-authoring gate; do not require all later rule
details to be settled before the owner can inspect the editor.

### Phase I status

Gates committed on `codex/fresh-file`: A `2a52c837`, B `bda074c3`, C `1999cb0d`,
D `75a0b778`, E `47b0d1fb`.

Checkpoint gate at `47b0d1fb` (2026-09-29): `npm run check` exit 0; 375 Vitest
files / 4042 tests, 732 Lua tests, Luacheck 0 warnings / 0 errors, Rust 45,
ESLint clean. Performance compare against `fcd8d556`: PASS, all eight metrics
within threshold (largest: Surface full rebuild +5.46%, +3.99 ms).

Accepted bounded limitations:

- E: history-time encounter preparation has no Fear ranks; positive Menace
  conversions are not recorded.
- A: the executor's Athena start check is stricter than native; it can report
  false conflicts only, never false bindings.

Gate F obligations:

- The save-file god-history route-start value is constructed twice
  (`packages/planner-engine/src/simulation/evaluation/project.ts:161`,
  `packages/planner-engine/src/simulation/rewards/branch-lifecycle.ts:98`).
  Derive it once from the project profile and feed both.
- The `resourceGains` requirement record has no production declaration reading
  it yet; Fresh File consumers are its intended readers. (The
  known-encountered-enemy record was retired with Gate E in Slice K.)

### Pending live acceptance

Owner result (2026-09-29, executor build from `c49ee950`, protocol 51):
several mature-save runs completed with no observed change in behaviour; the
Phase I gates are impact-neutral on mature files. The itemised mature-save
checks below remain open only where not exercised by those runs.

- [ ] Gate A, mature save (executor build, protocol 51):
  - Republish mature F–I and N–Q plans; no new `encounter-lifecycle`
    diagnostics or mismatches.
  - Save/quit/reload inside an H cage room, a multi-encounter P room and an O
    wheel room: re-prove succeeds, reloaded carriers bind, at most one
    substitution diagnostic per phase.
  - Fig Leaf skip, then reload: the skip holds.
  - A forced encounter the game rejects on eligibility binds with
    `lifecycle-substitution` (both names logged, no customization installed)
    or yields `lifecycle-conflict` plus a mismatch naming the property.
  - F_PostBoss01 native Empty against published `Story_Chronos_01` binds as a
    substitution when it occurs.
- [ ] Gate A, fresh profile:
  - Published `RadiatorIntro`/`ScreamerIntro` (F) and `FishSwarmerIntro` (G)
    bind with their fixed first wave native and the generated suffix installed
    at its native wave index; the GuardIntro item is withdrawn (Guard has no
    active introduction).
  - A later-phase override, and a cage room with an intro.
  - Native traversal order of competing introductions is a diagnostic only.
- [ ] Gate D, now:
  - A mature shop per biome with purchases and a Travel Deal refill lands on the
    right items and compact position.
  - A protocol-50 plan is rejected cleanly.
- [ ] Gate D, Fresh File I_WorldShop:
  - A trailing empty group gives 4 items and purchases bind; no
    `shop-empty-group` diagnostic; observe the probe's random-number effect
    afterwards.
  - A Travel Deal whose exclusion empties the source group: native shifts to
    the next group while planner and executor keep the group (reward audit
    ~:790–800).
  - An OptionsData RandomLoot group with no eligible god is not natively
    empty; the probe diagnostic is the guard.
- [ ] Gates B/C/E, optional source confirmations:
  - Common Buried Treasure then a 5-Ashes drop gives 8; Double Up gives 8+8.
  - Narcissus Ashes 10 with the NPCDrop exemption.
  - A mature-save shop boon god may be any eligible god.

## Phase II — visible Fresh File authoring

### F — Create, save and edit the new profile early

Owns the expected single authored bump and app migration. Before implementation,
inventory planned Eris state and all profile-dependent nullable selections.

Catalog/engine: fixed F/G/H/I route with FreshFile identity; fixed aspectless
Staff semantics, no selectable weapon/aspect/keepsake/familiar, zero Arcana/Fear
including automatic cards, no starting reward. Resolve Staff for weapon legality
without inventing an equipped aspect. Initialize historical facts empty. Resource
totals mean gains during this project, not arbitrary save balances.

Use existing route/topology authoring. Provide a coherent empty F_Opening01 and
ordinary onward editing so the project does not stop at an unsupported initial
shape. Add only the minimal initialization declarations needed here; remaining
Fresh File rule accuracy is explicitly incomplete until the next phase.

Application: fourth creation choice, Fresh File loadout heading and fixed-state
presentation, normal room/reward editing, save/load and undo. Clearly identify
the branch's experimental rule coverage. Ordinary generated customization is
unavailable for this profile until the later encounter pass; do not silently
strip retained invalid values in a resolver. Preserve editable repair semantics.

Publication: fail availability explicitly for Fresh File while execution support
is pending; save project files normally. Do not emit an Underworld execution plan
as a substitute. Existing project publication remains unaffected.

Acceptance: creation → loadout → opening → onward editing; save/load/undo;
mature migration semantics preserved; no automatic Arcana; nullable selection
validation; Staff legality; no starting-reward finding; Fresh File publication
unavailable without crashing; mature publication unchanged. One representative
browser/product witness plus owning codec/default/history tests.

Handoff: owner inspects the visible difference from Underworld. Update the rules
backlog against the live code and lock the next small slices, not all remaining
implementation details at once.

### Phase II status

Gate F committed on `codex/fresh-file`: `c49ee950` (schema 90, FreshFile
route, fixed loadout, publication unavailable). Full `npm run check` at
`c49ee950` (2026-09-29): exit 0; 379 Vitest files / 4071 tests, 732 Lua tests,
Luacheck 0 warnings / 0 errors, Rust 45, ESLint clean. Awaiting owner
inspection of the visible Fresh File project before Phase III slices lock.

Slice G committed on `codex/fresh-file`: `cf20d7af` (blanket disabling pass,
MetaProgress native-complete, counted-store Heal fallback). Full
`npm run check` at `cf20d7af` (2026-09-29): exit 0; 381 Vitest files / 4095
tests, 732 Lua tests, Luacheck 0 warnings / 0 errors, Rust 45, ESLint clean.
No execution fixture or mature golden project moved.

Slice H committed on `codex/fresh-file`: `dce79ddc` (FIntroFight entry rule and
force, forced Apollo reward, first-run Apollo allow-list, retained
customization on replaced bindings). Full `npm run check` at `dce79ddc`
(2026-09-29): exit 0; 387 Vitest files / 4117 tests, 732 Lua tests, Luacheck 0
warnings / 0 errors, Rust 45, ESLint clean. No
execution fixture or mature golden project moved.

Slice I committed on `codex/fresh-file`: `42fe5ecf` (forced biome intros,
H_Bridge01 Shop overlay, Fresh Nectar without level, `ClearShopOffer`, Fresh
F–I route witnesses). Full `npm run check` at `42fe5ecf` (2026-09-29): exit 0;
391 Vitest files / 4140 tests, 732 Lua tests, Luacheck 0 warnings / 0 errors,
Rust 45, ESLint clean. Performance compare against `27b28768`: PASS, all
metrics within threshold. No execution fixture or mature golden project moved.

Slice J committed on `codex/fresh-file`: `939ac7e1` (Eris observation, talk
and gift on the Fresh intros; Psyche untracked). Full `npm run check` at
`939ac7e1` (2026-09-29): exit 0; 395 Vitest files / 4161 tests, 732 Lua tests,
Luacheck 0 warnings / 0 errors, Rust 45, ESLint clean. Performance compare
against `42fe5ecf`: PASS. No execution fixture or mature golden project moved.

Gate K committed on `codex/fresh-file`: `936e02bc` (Gate E retired) and
`56ff620c` (enemy introductions settled in the encounter selector; required
customization; native admission; Turtle, WaterUnit and SiegeVine gates). Full
`npm run check` at `56ff620c` (2026-09-29): exit 0; 395 Vitest files / 4171
tests, 732 Lua tests, Luacheck 0 warnings / 0 errors, Rust 45, ESLint clean.
Performance compare against `3f8015db`: PASS (largest Underworld
representative edit +10.06%, +5.17 ms; Underworld full rebuild +8.62%,
+9.05 ms; both within threshold and reflect admission evaluation on mature
generated preparation). No execution fixture or mature golden project moved.

## Phase III — visible rule integration roadmap

### K — Enemy introductions and Gate E retirement (locked 2026-09-29)

Owner-locked fifth slice. Evidence: `docs/investigations/FRESH_FILE_ENEMY_INTRODUCTION_MATRIX.md`
(native pipeline, scoped F/G/H/I matrix, history sufficiency, local ordering
probe). Native selection asks whether an introduction encounter completed
(`HasEncounterBeenCompleted`, run and lifetime caches) and, for H, whether it
occurred (`EncountersOccurredCache`); it never asks whether an enemy was seen.

Locked decisions:

- Gate E is retired. The known-encountered-enemy ledger, snapshot field,
  `knownEncounteredEnemies` requirement record and `'encounter'` scope, evidence
  arm, picker message case, tests and design paragraphs are removed. The
  existing `encounterCompletions` and `encounterRecords` ledgers are the
  introduction authorities; narrow completion and occurrence queries are added
  there. No new ledger.
- Identity is settled in the encounter selector; Customize edits only a
  settled identity, as on mature. Each reachable introduction is a member of
  its biome set with its native gate as a requirement: route `FreshFile`;
  not completed on the route; H: not occurred this run; Lycanthrope: Mourner,
  Lovesick and Lamia introductions recorded on the route. Members:
  `RadiatorIntro`, `ScreamerIntro` (F; fixed first wave, generated second),
  `FishSwarmerIntro` (G; same shape), `TurtleIntro` (G; fixed first wave, two
  generated, triggered only by `Turtle_Elite` at depth ≥3, since the ordinary
  Turtle's two-visit gate is unreachable on one G entry), `MournerIntro`,
  `LamiaIntro`, `LovesickIntro`, `LycanthropeIntro` (H; three fixed waves).
  Guard has no introduction; Vampire and LycanSwarmer are outside scope.
  Introduction choices are offered only on `FreshFile`, so mature pickers keep
  their rows. Enemy profile gates are admission: WaterUnit (completed
  `MiniBossWaterUnit`) and SiegeVine (earlier `MiniBossFogEmitter`) read live
  save caches that an earlier encounter on the route satisfies; the ordinary
  Turtle is route-excluded. (Amended 2026-09-29.) `GeneratedH_Screamer2` gains its native
  ScreamerIntro-completed predicate. On mature saves every introduction member
  is ineligible, so mature pickers and customization are unchanged.
- Customization on the ordinary identity excludes an enemy type only where its
  linked introduction would trigger at this room: the introduction's gate
  passes here (unfinished on the route; H not occurred this run; Lycanthrope's
  prerequisites recorded). The reason names the introduction to select. A type
  whose introduction is unfinished but whose gate fails here (Lycanthrope
  before its prerequisites; Mourner in cage 2 after cage 1 recorded
  `MournerIntro`) stays admissible, as natively. Native enemy admission
  (`MinDepthBeforeIntros`, `RequireCompletedIntro`) applies independently, with
  native depth kept separate from biome encounter depth. An introduction's
  suffix follows the same rules; its own seed is exempt. Two competing
  introductions therefore never exist in an authored composition, and native
  traversal order is not a planner contract. (Refined 2026-09-29; supersedes
  the unconditional unfinished-introduction exclusion.)
- An introduction member is eligible only where its gate passes and a trigger
  enemy is admissible to an eligible ordinary identity in the same slot at that
  room, computed without the trigger exclusion; no source composition is
  generated. The picker names the failing condition: gate evidence, or the
  unreachable trigger enemies. This is a resolved-identity authoring model: it
  preserves the set of native-legal outcomes, not native selection order or
  probabilities. (Refined 2026-09-29.)
- Retained states are reported, never stripped: an unintroduced type retained
  under an ordinary identity, or an introduction identity whose gate no longer
  holds after an upstream edit, each report a finding with the repair named.
- On `FreshFile`, every generated combat phase and every mixed introduction's
  suffix must be customized; an uncustomized phase reports
  `encounterCustomizationRequired` and blocks execution eligibility. Fixed
  identities need no customization. Generated customization is enabled for the
  route (Gate F disabled it); Fear controls stay hidden at zero Fear. Native
  (uncustomized) mode is not publishable on `FreshFile`; the executor's
  lifecycle substitution becomes a diagnostic case there.
- H cage members are evaluated in cage-preparation order against recorded
  identities, not completions; a prepared cage never changes when another
  cage completes.
- Pending live acceptance corrections: F triggers are `RadiatorIntro` and
  `ScreamerIntro`, G is `FishSwarmerIntro`; the GuardIntro item is withdrawn.
  Embedded-game confirmation of native traversal order is a Gate L diagnostic,
  not a contract.
- Excluded: draft or banner UX, a third customization surface, Menace-based
  introduction paths, execution enablement.
- Follow-up outside this slice: the encounter customization command does not
  freeze the inner `customizationByPhase[phase]` records (pre-existing).

Delivery order: Gate E retirement as the first commit, then introductions.

Acceptance: Gate E symbols absent from production and tests; introduction
members with gates and evidence in the picker on Fresh, ineligible on mature;
type-domain exclusion and reasons; retained-state findings; customization
required finding and execution eligibility; H cage sequence witness
(Mourner recorded in cage 1 suppresses cage 2; Lycanthrope eligible only after
the three prerequisites); `GeneratedH_Screamer2` predicate; the Fresh F–I
fixture fully customized with one F introduction, `FishSwarmerIntro` and an H
cage sequence, valid with zero findings; mature byte-identical. Refinement
witnesses: Lycanthrope admissible before its prerequisites; Mourner admissible
in cage 2 after cage 1 recorded its introduction; an introduction whose trigger
enemy is inadmissible at the room (depth) is ineligible with the reachability
reason.

### J — Eris (locked 2026-09-29)

Owner-locked fourth slice. Native: Eris spawns at the start of `G_Intro`,
`H_Intro` and `I_Intro` while completed runs are at most 1/4/7, the hero lacks
`ErisCurseTrait`, and `ErisCurseHealthThreshold` (no Death Defiance and health
at most half) is false; she is a required object, exits wait for her, talking
applies the curse and drops a required gift (20 Ashes / 50 Psyche / 300 Bones,
NPC override: bonus-exempt, no duplication, not Meta-conversion eligible); door
rewards roll after the gift (`RoomDataG.lua:1350-1394`, `RoomDataH.lua:557-601`,
`RoomDataI.lua:511-555`, `RequirementsData.lua:151-163`, `NPCData_Eris.lua:5948`,
`ShrineLogic.lua:755-765`, `RoomLogic.lua:3080-3106`, `ConsumableData.lua:1546`).

Locked decisions:

- Eris is an authored observation, never an enforced condition, on the Gorgon
  Amulet precedent (`athenaTriggerConditionMet`): an optional occurrence-level
  field on the three intro occurrences, absent meaning no, worded neutrally
  ("Eris has spawned"), presented as a timeline row like the keepsake-rack
  interaction rather than a room feature. Additive within unreleased schema 90;
  no bump. The codec admits it only on rooms the catalog declares as Eris hosts
  on `FreshFile`.
- Catalog declares the host rooms with their gift, a new `ErisCursePickup`
  producer profile carrying the NPC override, and a `resourceGrant` for
  `MemPointsCommonDrop` so Psyche credits through accumulated gains.
- When spawned, the engine derives a required interaction and a required gift
  pickup on the intro; the gift settles as a resource acquisition before the
  room's outgoing generation. Once cursed on the route, a later intro's
  observation is retained and reported as a finding; no second gift. The curse
  effect is not modeled. An unspawned Fresh intro derives nothing and reports
  nothing.
- Execution does not enforce the spawn: publication carries the observation and
  conformance proves the outcome (curse trait, gift acquired), diagnostic-only
  when marked but absent. Executor decoding of the entry belongs to execution
  enablement; publication stays unavailable in this slice.
- Excluded: health simulation, curse effects, executor decoding.

Acceptance: codec admits the field on Fresh intros and rejects it elsewhere;
command with undo; chronology witness that `G_Intro` orders talk → gift
acquisition → outgoing checkpoint with 20 more Ashes before exit, plus a unit
witness that the gift alone crosses the 5-Ashes Bones threshold (the flip is
unreachable on a valid route: F's forced second MetaProgress batch yields 5
Ashes first); repeat-prevention finding; the Fresh F–I fixture gains
G Eris and stays clean; product loop step; catalog producer and grant
witnesses; mature byte-identical.

### I — Remaining Fresh File rules (locked 2026-09-29)

Owner-locked third slice; no new authored state, no schema change. Evidence:
the remaining-rules inventory of 2026-09-29 (a Fresh F→I route validates
clean today, so every gap below is silent).

Locked decisions:

- Forced biome intros use the existing first-biome mechanism. `FishmanIntro`
  (G; no encounter-depth count, no skip) and `ClockworkIntro` (I; counts
  depth, no skip) are fixed definitions. Set resolution gains a route-keyed
  first-biome key beside the existing default, and the first-biome key applies
  only while it has not resolved earlier on the route (native
  `AlwaysForce` until completed). Mature I keeps `GeneratedIChronosIntro`;
  Fresh I resolves `ClockworkIntro`, so the Chronos intro never occurs there.
  Publication carries the keys because the executor bypasses native forcing.
- `H_Bridge01` is a Shop on `FreshFile` (native Story/Echo needs lifetime
  `H_Boss01` entered): `resolveEntryDeclaration` widens from an encounter-only
  rule to a route overlay {Shop kind and template, WorldShop binding, no Story
  lifecycle, `BridgeShop`}. Force window and cap unchanged. Direct room
  declaration reads that bypass the resolver are routed through it.
- Fresh Nectar grants no level (native `WorldUpgradeGiftDropRunProgress`):
  a route condition on the GiftDrop level-resolution effect where acquisition
  role state is created; export follows. Fields optional Nectar stays reachable.
- `ClearShopOffer` command clears a slot's item and dependents; the picker
  exposes it in the `selectedInvalid` section. The test-only clear helper is
  retired where the command replaces it.
- Already-closed rules gain Fresh project witnesses: Hestia/Aphrodite lifetime
  use gating, shop-god intersection with fallback, elements unreachable on
  F–I, exchange off, no Death Defiance source.
- No decode conversion: no Fresh File saves exist beyond development fixtures,
  so a Fresh bridge Story state or Nectar level resolution rejects at decode.
- Excluded: Eris (Slice J), enemy-triggered introductions, execution
  enablement.

Acceptance: mature byte-identical (no fixture or golden movement, mature I
first-biome resolution unchanged); a Fresh F→I fixture builder validates with
zero findings and is execution-eligible; Fresh G and I first combats resolve
the intros and the second G combat does not re-force; Fresh `H_Bridge01` is a
Shop with WorldShop inventory and no Echo action; Fresh Nectar acquisition has
no level resolution; `ClearShopOffer` clears I_WorldShop slot 5 through the
picker; Hestia and shop-god witnesses pass.

### H — First sequence and Apollo offer (locked 2026-09-29)

Owner-locked second slice. Native facts: `F_Combat01` has
`ForceIfEncounterNotCompleted = "FIntroFight"` with legal
`{FIntroFight, GeneratedF}`; `FIntroFight` is `AlwaysForce` gated on
`TextLinesRecord HasNone ApolloFirstPickUp` with fixed waves
(`EncounterData.lua`); `ForcedRewards` is an Apollo Boon while
`UseRecord.ApolloUpgrade` is false; `ForceLootTableFirstRun` is
`{ApolloWeaponBoon, ApolloSprintBoon, ApolloManaBoon}` and
`ForceCommonLootFirstRun` applies with zero completed runs
(`RoomDataF.lua` F_Combat01, `TraitLogic.lua:1794`, `RoomLogic.lua:2093`).
Owner-confirmed: `F_Combat01` is natively the forced second room on a fresh
profile, and the Apollo contact is only the boon offer at room clear; the
executor verifies both against source before coding.

Locked decisions:

- `FIntroFight` is a fixed Encounter Definition; `F_Combat01` gains the
  `FreshFile`/first entry rule for it, the same mechanism as `OpeningEmpty`.
- `F_Combat01` is forced on `FreshFile` through the existing
  `RoomForce.kind: 'requirement'`; forcing never bypasses eligibility.
  The native force axis is encounter-completion history, which reduces to
  route identity on our two profiles.
- `FIntroFight` does not count encounter depth (`RoomLogic.lua:1900`), so
  later Fresh encounter depths are one lower than after `GeneratedF`.
- Native `ForcedRewards` is a declared forced incoming reward whose
  requirement is `lifetimeGodUseRecord` Apollo at zero. No route predicate;
  mature evaluates false and is unchanged. It settles as an Apollo boon offer
  without drawing the counted bag when native does not draw.
- The first-run Apollo offer is a declaration-owned rule on `F_Combat01` for
  `FreshFile`: the native fixed allow-list (`ForceLootTableFirstRun`: Weapon,
  Sprint, Mana) at Common through the existing forced-rarity frontier. Owner
  intent: a no-core screen natively offers only the five core boons, so
  excluding Special and Cast on top of that rule reaches the same trio; the
  allow-list is the equivalent declared form. It is not generalized to mature
  projects.
- A GeneratedF customization retained on Fresh `F_Combat01` decodes, reports
  `encounterCustomizationUnavailable` and is removable, as Slice G retains
  Wells and racks.
- No execution or UI work: publication stays unavailable; existing projections
  present the fixed encounter and the Common trio. Publication must carry
  `FIntroFight` when execution lands, because the executor's forcing bypasses
  native `AlwaysForce`.
- Excluded: Eris, Hestia/Aphrodite ordering, enemy-intro substitutions,
  second visits to `F_Combat01`, execution support.

Acceptance: catalog definition and rule witnesses; a Fresh opening →
`F_Combat01` simulation with no findings whose Apollo offer is the Common
trio; a Special or Cast authored on that screen and a non-`FIntroFight`
encounter or non-Apollo reward on that room each report the existing
unavailable finding with the value retained; mature `F_Combat01` unchanged
(`GeneratedF`, bag draw, no forced Apollo); product loop extended through
`F_Combat01` and an Apollo pick with undo.

### G — Blanket disabling pass (locked 2026-09-29)

Owner-locked first slice. Evidence: `docs/investigations/FRESH_FILE_DISABLING_PASS.md`.
Scope is run-invariant exclusions only; in-run conditionals (Hestia/Aphrodite
order, Apollo first offer, intro forcing, thresholds other than the
MetaProgress tiers, shop-god conditions) stay in their own rows.

Locked decisions:

- One declaration per store and shop profile. Blanket exclusions are route
  availability on the existing entry (`excludedRouteKeys`, `routeKeyEquals`
  negation, or the existing optional `requirement`), the same mechanism that
  excludes Dream today. No separate Fresh stores or profiles.
- MetaProgress becomes native-complete in this slice: the six low-tier late
  Bones/Ash entries are declared with `FreshFile` availability and
  `resourceGains` thresholds (Bones need Ashes ≥ 5; small late entries while
  Bones < 500 or Ashes < 100; Big once both are reached). Mature bags keep
  their thirteen entries: the engine drops route-unavailable entries at bag
  fill and refill, so mature fixtures do not move.
- Features the game leaves present but locked on a fresh profile (H post-boss
  Pool) are absent to the planner; the game owns them.
- Mechanism additions, each the smallest form: `excludedRouteKeys` on room
  features (`roomShop`, `purgingPool`, `hasKeepsakeRack`); optional
  `requirement` on the Zagreus contract door mirroring the Chaos exit;
  `excludedRouteKeys` per boss customization choice;
  `boonReplacement.excludedRouteKeys` on the random boon exchange, the route
  form of native `BoonData.GameStateRequirements`.
- The forced post-boss Wells in F, G and H are removed on `FreshFile`, not
  made optional.
- I_WorldShop slot 5 empties through the delivered valid-empty assessment
  (engine witness on `FreshFile`). The test-only empty-group catalog variant
  behind `underworld-fghi-empty-shop-group` stays: execution assembly rejects
  `FreshFile` with `unsupportedRoute`, so the fixture's production replacement
  waits for the execution enablement slice.
- Counted stores reproduce the native `ChooseRoomReward` fallback (owner
  decision during the slice): two appended route-filtered copies, then
  `RoomRewardHealDrop`. A fresh MetaProgress bag can exhaust; mature bags never
  do.
- Excluded and unchanged: everything in the investigation's conditional list.

Acceptance: each matrix row has one witness at its owning contact (room
eligibility, detour placement, feature availability, encounter requirement,
store/shop entry, god `lootRequirement`, trait `routeKeyNot`, exchange
`boonReplacement.excludedRouteKeys`); mature golden projects and execution fixtures unchanged; Fresh File project simulation shows
no excluded room, feature, encounter, reward, god or trait reachable; the
MetaProgress tier witnesses cross a threshold mid-run through `resourceGains`.

This checklist is detailed scope guidance, not authorization to implement every
row as one change. For each slice name its catalog fact, engine consumer, UI
projection, export impact and narrow tests before starting. Preserve incomplete
authorship rather than masking defects with editor filters.

| Area                     | Required result / important witness                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First sequence           | Only F_Opening01, OpeningEmpty, then forced F_Combat01/FIntroFight and Apollo after combat. No reward moved into loadout. The executor's `ForceNextEncounterData` bypasses native `AlwaysForce`, `ForceIfEncounterNotCompleted`, `ForceIfRoomReward` and the EnemySet `ForceIntroduction` swap (`RunLogic.lua:1027-1091`); forced-candidate priority is planner policy, so the catalog must resolve `FIntroFight` and any other native forced identity in this profile before publication, never relying on the executor to yield. |
| Apollo offer             | The first Apollo offer under `FreshFile` with no core boon held: the native fixed allow-list (Weapon/Sprint/Mana) at Common through ordinary rarity machinery, reproducing `ForceLootTableFirstRun`. It is the only no-core screen reachable in this profile; do not generalize the condition to mature projects. Normal editor, other core-offer rules and later acquisition unchanged.                                                                                                                                           |
| Room exclusions          | Reprieves, unavailable stories/minibosses and Chaos/Anomaly/Zagreus unavailable through engine eligibility. Vanilla biome state.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Features                 | No Wells, usable Pools, postboss racks or resource points. Postboss fountains remain. H's locked Pool object is not an unexpected usable inventory.                                                                                                                                                                                                                                                                                                                                                                                |
| Bridge                   | Delivered (Slice I): `H_Bridge01` declares a `FreshFile` route overlay {Shop kind and template, WorldShop, `BridgeShop`, no Story lifecycle}; force window and creation cap unchanged; no Echo action; a Fresh Story state rejects at decode.                                                                                                                                                                                                                                                                                      |
| God/reward profiles      | Shared stores and shop profiles: route availability on entries a fresh profile can never reach, `resourceGains` thresholds on the tiered MetaProgress entries; Apollo/Poseidon/Demeter plus Hestia/Aphrodite unlocked by qualifying use. Shop pickup-history intersection and fallback remain shared.                                                                                                                                                                                                                              |
| Numeric unlocks          | Bones threshold 5 Ashes; later small/large switch requires both 100 Ashes and 500 Bones plus ordinal rules. Read generation-time totals; preserve ineligible bag copies and offered history.                                                                                                                                                                                                                                                                                                                                       |
| Shop slots               | Correct ordinary and Tartarus inventories, no shop Armor; five stable I slots with empty fifth. Fields optional Armor/Nectar/Bones stay reachable. Delivered (Slice I): `ClearShopOffer` clears a slot, its purchase and entry; the picker offers it beside a `selectedInvalid` item.                                                                                                                                                                                                                                              |
| Trait/reward exclusions  | Hammers, Hermes, Mystery, Devotion, Hex/Path, infusions and unavailable gods; Plant Health's missing shovel unlock. Apply source-specific exclusions, not global reward-name bans.                                                                                                                                                                                                                                                                                                                                                 |
| Other progression        | Delivered (Slice I): Nectar gives no level on `FreshFile` (route-excluded GiftDrop level effect). Elements: no F–I store or reachable shop option offers one, so no placement rule is needed. Exchange chance 0 with the too-few-options fallback retained; no DD source reachable.                                                                                                                                                                                                                                                |
| Deterministic encounters | Delivered: `FIntroFight` (Slice H); `FishmanIntro`/`ClockworkIntro` as route-keyed first-biome identities guarded by prior route resolution (Slice I), so Chronos intros never resolve on Fresh. Delivered (Slice K): enemy-triggered introductions are authored set members with gates, reachability and type-domain exclusion; every generated composition is authored on Fresh File.                                                                                                                                            |
| Boss choices             | Profile restrictions for Hecate/Scylla; retain ordinary Cerberus/Chronos behavior under zero Fear. Pin native choice keys rather than relying on prose move names.                                                                                                                                                                                                                                                                                                                                                                 |
| Eris                     | Delivered (Slice J): `eris: { spawned: true }` observation on Fresh G/H/I intros → required `interactEris` (grants `ErisCurseTrait`) → required `ErisCursePickup` gift before the doors (20 Ashes/300 Bones credited; H's 50 Psyche untracked; bonus-exempt, no Sea Star, no Artificer). A later observation once cursed reports `erisSpawnUnavailable`, no second gift. No health or curse-effect simulation.                                                                                                                     |
| Bounded additional audit | Disposition (Slice I): `RandomStatusBoon` stays a declared Aphrodite trait; its historically unlocked status pool is a combat effect with no modeled consumer, so no dialogue or status history is added.                                                                                                                                                                                                                                                                                                                          |

Route-identity note: Chaos Enshrouded's `routeKey: 'Underworld'` offer
requirement is false on the `FreshFile` route; Chaos is unreachable on a fresh
profile, so this stays bounded until the Chaos exclusion lands.

Hammer note: Hammer compatibility is an aspect list, so an aspectless Staff
fails it though natively legal (`StaffDoubleAttackTrait` only requires
`IsNone { StaffRaiseDeadAspect }`). `WeaponUpgrade` is not route-gated, so a
Hammer can be authored on Fresh File today and reports `wrongHammerLoadout`;
bounded until the Hammer exclusion lands.

### Execution enablement slice

Plan the bilateral protocol update after the real authored/model shape exists.
Add FreshFile route/loadout decoding and null-aspect/keepsake proof while retaining
actual Staff identity. Account for `StartNewGame → StartNewRun(RoomName)` bypassing
ChooseStartingRoom; ensure opening realization and binding occur through a coherent
contact without synchronizing an unproven loadout. No save conversion/reset.

Verify bridge Shop, empty inventory positions, Eris interaction, native intros,
inert H Pool, absent racks/resources and room conformance. Generate a real Fresh
File execution fixture through planner builders; format it normally. No manually
fabricated protocol witness. Only remove the publication restriction after the
required rule coverage and executor contacts are ready for controlled live testing.

Eris publication: the gift already reaches the timeline as an ordinary
`interactAcquisitionEntry` acquisition, but the talk has no transaction kind,
so assembly reports `executionCoverageMissing` for it. Publish the observation
flag, the talk as an interaction and the gift as a required pickup on the
intro occurrence; conformance proves `ErisCurseTrait` present and the gift
acquired, diagnostic-only when marked but Eris is absent.

Unentered Fresh G door targets resolve no structural encounter identity in
materialization (no reached facts there), matching mature I; this slice must
decide how the overview publishes those phases.

## Phase IV — production readiness and spine closure

Revisit this plan when authoring and execution are complete. Reconcile the rule
inventory against implementation and observed gameplay, then lock a bounded
closure packet. No claim of complete legality from merely being able to create
or publish the project.

Review mature compatibility, app migration, all exclusions and dynamic thresholds,
first Apollo, Eris chronology, bridge, shop emptiness, start path and lifecycle
substitution. Run one final complete gate after remediation, plus module checks
where not included. Live-test a real fresh profile through the supported route;
record failures and pending coverage honestly. Merge/release/push only when asked.

Promote durable facts to existing audits/design/biome authorities; retire this
plan and completed investigation material. Keep only narrowly identified deferred
encounter questions. Remove temporary development availability and copy when ready.

## Phase V — introduction acceptance and residual encounter questions

Slice K delivered enemy introductions on the existing completion and occurrence
ledgers (`encounterCompletionCount` beside `encounterKeyCount`). What remains is
live acceptance (embedded-game traversal order as a diagnostic, mixed-suffix
installation) and any residual question the live run surfaces. No second
history store; extend narrow queries only.

## Orchestration, tests and expected retirement

Main session owns scope, base/worktree inventory, locked packets, Git and closure.
For substantial gates use one write-capable executor and a fresh independent
reviewer after stabilization, with one bounded remediation pass. Reuse executors
for coherent adjacent work; no simultaneous shared-worktree writers. Packets name
exact authority sections, starting symbols, consumers, tests and displaced paths.

Each gate has one primary policy-test owner; product tests prove representative
contacts instead of copying matrices. Use narrow catalog/engine/application/module
lanes during work. Full `npm run check` at infrastructure closure and final spine
closure, not for every interim review. Use generated fixture tools, inspect churn,
and keep shared-workspace executor fixture handling local to this repo.

Expected deletions: replaced exact-name vetoes; replaced history argument paths;
shop concrete-count assumptions at affected contacts; temporary publication guard
at readiness. No speculative services, generic
Lua interpreter, persistent derived history, UI legality, or hidden registration.
