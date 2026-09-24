# Encounter corrections and one-time native admission

## Status and objective

Draft for owner review, 2026-09-24. Commit the approved plan before implementation.
Three delivery gates: catalog/engine, planner application, executor/integration.
This is a bounded correction of the delivered encounter feature, not a redesign
of authoring, generation mathematics or the simulation state.

Outcome: correct native encounter budgets; consistently repairable authoring;
and one whole-encounter runtime admission decision after native budget calculation,
followed by complete installation or diagnostic/native continuation.

Starting worktree: production changes from prior encounter delivery are committed;
the component audit and trust-policy draft are untracked investigation documents.
Inspected bases: planner `e42bf61d`, executor `e256562`. Inventory both repositories
again before each gate and preserve unrelated edits; record any intervening base
changes in the gate packet rather than silently treating them as this plan's work.

## Governing authorities and evidence

- Repository AGENTS.md: ownership, semantic edits, schema approval, test and fixture
  discipline, multi-agent gate routine and documentation lifecycle.
- `docs/design/SIMULATION_AND_VALIDATION.md`: read in full before engine work.
- `docs/design/CATALOG_MODEL.md`: normalized declarations and compiler boundaries.
- `docs/design/ROOM_LIFECYCLE_MODEL.md`: encounter preparation and exact contexts.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: retained invalid state and commands.
- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`: projection, findings and edits.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md`: current wire/admission contract;
  replace the affected explanation when the new contract is delivered.
- Formation and composition audits under `docs/audits/rooms-and-routes/` own
  native generation facts. Consult the affected sections and cited game functions.
- `docs/investigations/ENCOUNTER_COMPONENT_AUDIT.md`: initial findings are qualified
  by its follow-up and final dispositions. They are not all accepted defects.
- `docs/investigations/ENCOUNTER_EXECUTOR_TRUST_POLICY.md`: agreed runtime direction.
  This plan incorporates it below; it is not permission for additional hardening.

## Locked scope and trust boundary

Planner evaluation owns complete valid composition, resolved counts, Fangs and
Menace. Structural decoding owns payload relationships once. Do not repeat
highlight cardinality, Fangs roster/elite proofs or count derivations in hooks.

Native encounter selection retains IsEncounterEligible. For customization:

1. Validate and supply an authored variable base roll against effective native
   bounds, currently GeneratedP_PreCombat. Invalid input diagnoses and leaves
   native generation uncustomized. Unrelated random draws are untouched.
2. Let native compute DifficultyRating with all its modifiers.
3. At the scoped CalculateActiveEnemyCap contact, before wave construction or
   authored roster mutation, check the whole customization once: final budget,
   native wave bounds, contextual enemy composition, Fangs perk compatibility
   and positive Menace target admissibility.
4. All pass: enable wave/highlight configuration and installation through native
   fill contacts. Any failure: diagnose and continue native without those overrides.

The cap function still runs normally. Native retains caps, pacing, groups,
retries and perk application. Rejection after a valid supplied base roll retains
that legal input; it is not a claim of untouched RNG history. No replay/rollback,
mid-wave admission, new mismatch boundary or speculative custom-pool support.

Budget discrepancy now rejects admission; the previous install-anyway budget
diagnostic proposal is superseded. Whole-composition checks preserve selection
roles and prospective blacklist effects where necessary. IsEnemyEligible alone
is not a wave validator. Do not reintroduce a Lua budget/count solver.

## Data and compatibility contract

- Authored project schema remains 87. No save migration, allocation reinterpretation
  or historical weight conversion is included.
- Add an explicit normalized budget modifier, with declaration-owned zero/default
  normalization where appropriate. Native calculation order remains base plus
  depth contribution plus modifier, then multipliers/Hordes and minimum.
- Engine resolved generated operands expose `expectedBudget`: the exact finite
  final encounter budget used to derive the published counts. Incomplete or
  ranged unresolved budgets cannot produce publishable operands.
- Budget and counts must come from the same assessment and exact captured
  generation-preparation context: same depth counters, effective overrides,
  Hordes and base roll. Copy the budget from that assessment's exact budget
  product, not a new room-entry or export-time evaluation. Reward-prepared
  Devotion retains its reward-generation checkpoint; each ship/cage phase retains
  its own preparation owner. Later Fangs/Menace context must not reprice the budget.
- Gate C copies this fact into required `expectedBudget` on each generated
  execution customization. It is not authored state, a base roll, summed rounded
  enemy cost or a calculation performed by the compiler.
- Approved execution protocol transition: 45 to 46, with both strict codecs and
  packaged compatibility metadata updated together in Gate C. This is an
  execution-artifact change, not an authored-save bump; existing projects can
  be republished. Both sides strictly reject incompatible execution artifacts;
  old published plans require re-export from their unchanged schema-87 projects.
- Compare expected/native budgets using the existing float-tolerant numeric
  policy; do not introduce decimal rounding as a second semantic calculation.

## Gate A — Catalog and engine correctness

### Deliverables

- Correct the nine NPC budget modifier omissions identified by source evidence.
- Correct GeneratedH_Passive/GeneratedH_PassiveSmall budget depth to biome room
  depth; do not change their independently correct type-count depth policy.
- Validate supported budget axes and at-most-four-wave policies at catalog
  construction. Reject unsupported declarations rather than silently using zero
  depth or implementing hypothetical future generation features.
- Expose the exact resolved expected budget described above.
- Delete the unused evaluateEncounterCandidates wrapper/export that omits required
  preparation evidence; retain the actual evidence-complete call paths.
- Add a complete supported-profile budget evidence table and primary tests,
  including inherited modifiers, hard/Dream variants and distinct depth axes.

### Starting neighborhoods and ownership

Catalog encounter-generation policy declarations and compiler normalization;
engine `catalog-schema/encounter-generation.ts`, `simulation/encounters/generation.ts`
and `candidates.ts`. Engine owns the formula/product; catalog owns source values.
Do not place game calculations in application projections or execution assembly.

### Acceptance

Catalog tests own the source-backed declaration matrix and invalid-contract
cases. Engine tests own modifier order, H room-versus-encounter-depth divergence,
exact operand budget and representative downstream count changes. Preserve
native rounding/remainder/Fangs/Menace behavior already established by audits.
Add at most a focused catalog witness for the already-documented exclusion of
GeneratedIChronosIntro from ordinary authored encounter candidates. Do not census
all progression flags or implement AlwaysForce/ForceIfEncounterNotCompleted/
ForceIfRoomReward machinery. Run affected catalog/engine tests and typechecks.

Checkpoint witnesses must demonstrate that expectedBudget and counts are emitted
together from a reward-prepared Devotion contact and a phase-specific multi-
encounter contact, including a distinguishable later context. Test that later
context does not overwrite their preparation evidence; do not rebuild eligibility
or budget formulas in test helpers.

Regenerate only existing execution fixtures whose semantic counts changed;
mirror affected fixtures byte-for-byte to the executor. Do not change protocol
version yet. The owner accepts two fixture passes: corrected counts at protocol45
in Gate A, then protocol46 and expectedBudget in Gate C. Do not couple correct
budgets to unfinished wire work to avoid that bounded churn. No otherwise-unused
production facade merely to bridge gates.

Commit boundary: budget/contract corrections, their tests and source evidence.

## Gate B — Planner authoring and repair

### Deliverables

- Shared Enemy absence stays undefined, not a fabricated empty stale choice.
  No blank highlight command can be emitted from the picker.
- Preserve valid numeric budget over-requests without silent UI clamping. They
  are legal inputs with engine-derived effective results, not automatic findings.
- Preserve structurally valid nonnegative integer Menace counts above the current
  effective maximum so the engine can report a repairable finding. Malformed
  intermediate text is still a local draft, not a command.
- Bind Fields Passive encounter findings to the actual repair control.
- Keep Menace source identity in finding copy; remove obsolete Default guidance.
- Derive the once-per-run enemy warning from engine-assessed active membership,
  not a second authored-wave/catalog-flag derivation in the projection. When
  assessment is unavailable, do not guess active membership. Reuse the existing
  warning presentation; no new warning framework.
- Remove proven dead properties/branches, not hypothetical future plumbing.
- Preserve positional enemy-budget carryover, dormant waves/outcomes and Fangs
  perks on target replacement. Menace settings stay keyed to source identity.
- Transfer shared-enemy allocations only from an explicit previous highlight.
  Do not infer its identity from orphan allocation keys or invent a zero when
  none exists. Retain ambiguous values for normal assessment and repair.
- If the new highlight is already a listed enemy with its own allocation, skip
  the transfer even when the prior highlight is explicit. Preserve both authored
  allocation values; enemyUnavailable/allocation findings drive repair instead
  of silently overwriting the destination allocation.

### Starting neighborhoods and ownership

`GeneratedEncounterCustomizationControl.tsx`, generated-encounter projections,
workspace interaction/finding bindings and evaluation copy. Complete-edit
construction remains application/UI-owned; sampled keys, applicability and
legality remain engine products. No new carryover command framework or picker
redesign is included.

### Acceptance

Primary projection tests cover absent/retained selection and exact finding
identity. UI witnesses cover successful selection without fault, keyboard/file
retention consistency, excessive Menace count repair, ambiguous highlight edits,
highlight/allocation collision preservation, positional allocation transfer,
engine-assessed once-per-run warning membership (including unavailable assessment),
exact control highlight and Undo. Reuse existing
fixtures and narrow tests; do not repeat the engine's complete legality matrix.
Run affected planner/UI/contract lanes and typechecks/lint as appropriate.

Commit boundary: coherent authoring/repair corrections and tests.

## Gate C — Executor admission and integration closure

### Deliverables

- Export required expectedBudget from the Gate A engine product, update both
  codecs and protocol/compatibility metadata together as agreed above.
- Establish exact variable-base-roll scoping and the post-budget admission seam.
  Honor native hard overrides without recreating effective declarations when
  the live prepared encounter already supplies them.
- Perform one whole-encounter check before enabling wave count/highlight/roster
  and outcome installation. Verify the final budget and native wave bounds;
  retain necessary whole-composition preselection context and live blacklist
  checks, native perk-pool/exclusion checks, and native Menace target mapping/pool
  checks for positive conversions.
- Positive Menace availability checks cover native source/encounter blocks,
  effective vow and external next-biome visit gates where relevant. Do not roll
  probability or rederive counts. Per-room Fangs application caps remain native.
- Handle native introduction substitution at admission with its actual skip,
  completion and introduction-requirement conditions—not a blanket unfinished-
  introduction ban. This prevents accepted preparation being replaced afterward.
- On rejection, leave native wave/highlight/roster/Fangs/Menace generation active;
  record exact reason and expected/observed evidence. No customization mismatch.
- Installation hooks consume the single accepted decision. Retire the superseded
  pre-generation admission path and redundant invariant checks in the same slice.
- Keep native error propagation. Missing fill contacts after acceptance are
  accurately diagnosed as realization failure, not clean native fallback.

### Starting neighborhoods and ownership

Planner execution model, generated codec and engine-to-execution translation;
executor encounter `hooks.lua`, `generated.lua`, `fangs.lua`, decoder and native
probe neighborhoods. Preserve the destination-owned Devotion single-phase contact
and existing ordinary/cage/ship identity scopes. No generic phase resolver.

### Admission inventory and retirement requirements

This table bounds the runtime work. The gate packet must map each row to the
current symbols and resulting tests; additional checks require explicit scope
disposition, not an assumption that more preflight is always safer.

| Existing responsibility                                                                                                            | Disposition                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ChooseEncounter native IsEncounterEligible check                                                                                   | Keep at selection; preserve exact phase binding and neutral scopes for rejection.                                                                                                          |
| GenerateEncounter pre-generation whole-composition gate                                                                            | Move to the post-budget seam; delete the superseded call path. Do not run both gates.                                                                                                      |
| Reconstructing hard overrides and room enemy sets for admission                                                                    | Consume the effective encounter already prepared by native at the new seam. Remove superseded overlay reconstruction; retain detached prospective selection state only where needed below. |
| Definition existence, effective templates, fixed/template seed compatibility, preexisting/infinite-wave installation prerequisites | Keep once at admission as safe-installation checks against effective native data, not a second catalog.                                                                                    |
| Pool membership and native IsEnemyEligible calls                                                                                   | Keep role-correct checks for initial highlight and sampled template/addition entries. Fixed seeds and replicated highlights are not new ordinary draws.                                    |
| Prospective run/encounter blacklist effects, directed exclusions, elite/group pool pruning                                         | Retain only the ordered context needed to validate all published waves before mutation. Reuse the current source-backed behavior; no new generic eligibility engine or type/count formula. |
| Published-count arithmetic or repeated decoded highlight/Fangs membership checks                                                   | Do not add; remove any redundant installer checks found. Codec validation remains.                                                                                                         |
| Variable base-roll steering                                                                                                        | Validate effective range and scope precisely before supplying the roll; do not suppress native wave/highlight generation before final admission.                                           |
| Final-budget and wave-bound checks                                                                                                 | Add once at admission, before changing native wave bounds. Read native DifficultyRating rather than recomputing it.                                                                        |
| Fangs install                                                                                                                      | Add the bounded native ordered-perk compatibility admission check; keep direct assignment after acceptance and native application caps. No repeated elite/roster proof.                    |
| Menace install                                                                                                                     | Add positive-conversion native availability and mapping/pool checks at admission; retain source-accounting installation and decoder count bounds. No probability roll or count solver.     |
| Introduction substitution                                                                                                          | Check native skip/completion/introduction requirements before accepting; retain unexpected substitution diagnostics without replay.                                                        |
| Fill-contact completeness and generated scope cleanup                                                                              | Keep realization/error observations, separate from admission. Never label partial realization clean native fallback.                                                                       |

The acceptance target is one preparation/admission/install path, not old preflight
plus new wrappers layered over it. Review production growth by explaining the new
budget/roll/perk/target responsibilities and identifying the old paths displaced.
Do not add assertions merely proving particular helper names were deleted.

### Acceptance

- Publish real generated-composition fixtures through the production builder and
  encodeExecutionPlan, including expectedBudget, highlight, counts and positive
  Fangs/Menace cases. Lua must decode the exact mirrored artifacts. Keep focused
  handwritten malformed decoder tests.
- Native-source probes witness variable-roll range acceptance/rejection and RNG
  isolation, native calculation preceding admission, all-wave rejection before
  installation, retained valid base roll on fallback, successful full mounting,
  and no per-wave eligibility reevaluation.
- Witness Fangs incompatibility, Menace invalid target/gate, live blacklist and
  introduction substitution rejection without publishing a second generator.
- Retain representative fixed/template/highlight, repeated cages/ships and
  reward-destination Devotion contacts. Verify native caps/application remain
  untouched and unexpected missing contacts/errors are reported truthfully.
- Source probes are an explicit lane requiring game scripts when requested;
  absent-script CI skips are not claimed native coverage.

Fixtures use repository Prettier formatting and trailing newline; inspect numstat
and representative diffs, mirror with cmp. For a protocol-only scalar update,
use bounded mechanical changes rather than regenerating unrelated fixture content.

### Closure within Gate C

After focused tests and independent review remediation stabilize, run one full
planner `npm run check`, executor `lua tests/all.lua`, source luacheck and the
affected source-backed probe suites. Record actual results. Main owns broad
verification and final contract/deletion review; no fourth gate is needed.

Live acceptance: an ordinary customized encounter, variable P precombat budget,
representative NPC/H budget correction, Fangs/Menace installation and unchanged
native control. Exercise a safe admission-rejection diagnostic where feasible;
do not fabricate an in-game pass from a source probe. Owner confirmation is
required before claiming live acceptance. Preserve any remaining concrete live
obligations if automated closure precedes it.

Promote corrected budget evidence to the owning audit and update the integration
contract to the delivered admission flow. Fix cited census/citation errors in
place. Retire this plan and completed investigations at closure; preserve only
genuine unresolved evidence in its owning audit. No bug-changelog paragraphs.

Commit boundary: coordinated executor/protocol implementation, then closure
documentation/test follow-up if needed. No push without an explicit request.

## Delivery discipline and exclusions

For each gate, main inventories both worktrees, locks a focused ownership packet,
uses one write-capable executor and an independent reviewer after stabilization,
then performs bounded remediation. Reuse the executor for coherent follow-up;
change it when ownership materially changes. Main owns Git and overall review.

Excluded: authored schema changes, reworking weight migration, Fangs selection
quotas, rejecting dormant unknown Fangs solely for structural symmetry, generic
reward-phase resolution, broad UI redesign, cosmetic wire renaming, safe aliasing
cleanup without a witness, future multipliers/extra targets/custom enemy builders,
rollback machinery, a second native-generation implementation and new conformance
requirements. Each added check must protect a named contact or accepted admission
fact rather than duplicate a payload guarantee.
