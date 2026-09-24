# Native or fully authored encounter composition

## Status, baseline and objective

Rewritten after the owner replaced partial overrides with one choice: leave
generation native, or own the complete generated composition. The product
direction below is agreed. C0 source investigation now establishes the bounded
installation path and compatibility disposition. Delivery proceeds as a complete
pre-Menace conversion across planner/executor, then Menace authoring layered on
that contract. This revision does not itself implement production changes.

Delivered checkpoints retained as the starting implementation:

- A: budget/slice replacement and migration, planner `d880956f`, executor
  `4044ec5`; editor/migration follow-ups through planner `5c8f5282`.
- B: Fangs declarations, assessment, split Target/Perks UI and steering,
  planner `fce3d23a`, executor `008f2af`. Independent remediation review passed.
- A validation included engine/catalog/migration and application checks. B
  targeted validation: 57 TypeScript tests, typechecks, lint/format checks and
  632 Lua tests; final split-picker UI rerun: 21 passed. These checkpoint results
  do not constitute full-phase or live-game acceptance.

Current delivery uses authored schema 87 and execution protocol 45. GitHub's
published planner v0.10.0 and executor 0.9.2 still use 86/44 (checked 2026-09-23).
Keep the previously approved 87/45 transition; do not add another bump. The owner
explicitly chose to preserve partial choices and repair missing fields, not reset
customization. Intermediate local publications require republishing.

The outcome is optional customization with a complete engine-resolved answer
that the game module installs, rather than a collection of RNG instructions.
Full ownership means generated composition, not combat execution.

## Authorities and evidence

- `docs/design/SIMULATION_AND_VALIDATION.md`: exact state, explicit products,
  incomplete/invalid retention, findings and candidate capabilities.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: commands, encounter ownership and
  schema-change approval.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md`: prefer inserting the published
  answer, then narrow steering; do not recreate native effects.
- `docs/design/ROOM_LIFECYCLE_MODEL.md`: exact preparation contacts.
- `docs/investigations/ENEMY_BUDGET_AND_VOWS.md`: native budgets/allocation,
  Menace inventory and full-ownership installation questions.
- `docs/investigations/FANGS_PERK_ELIGIBILITY.md`: native elite eligibility,
  ordered perk pools/exclusions, caps and squad caveats.
- Source matrices under `docs/audits/rooms-and-routes/`: supported profiles.

Stable documents still describe the earlier delivered surface in places.
Replace those owning sections at closure, not prospectively as if this work
already exists. Keep implementation status in this plan.

## Scope and ownership contract

Use the existing 39 supported generated policies in combat rooms and supported
Devotion contacts, including fixed template seeds. Do not extend to scripted
boss decisions, miniboss-room customization or other encounter families.

| Mode       | Authored meaning                                          | Execution meaning                       |
| ---------- | --------------------------------------------------------- | --------------------------------------- |
| Native     | No generated customization payload                        | No generation intervention              |
| Customized | Concrete choices for every applicable generation decision | Install a complete resolved composition |

There is no third mode for partial native ownership. Incomplete or invalid
customization remains editable but cannot publish a partial answer. Missing
active values produce findings, not permission to roll them in game.
Inapplicable choices are not missing: one wave needs no shared highlight,
inactive/blocked Fangs needs no assignment, and blocked Menace has no conversion.
Retained inactive values remain dormant rather than being silently deleted.

Native still owns wave timing/events, positioning/pacing, active caps, failed
spawn retries, unit groups, AI/combat, perk application, summons and later
scripted replacements. No exact final-live-roster promise, new transactions,
conformance obligations or customization mismatch.

The pre-Menace slice owns the generated wave and Fangs completely and suppresses
all Menace conversions for customized encounters, including when the vow is active.
The owner explicitly selected this legal all-failed-roll outcome. Native encounters
remain untouched. The later Menace slice replaces zero conversion with authored
conversion outcomes; it does not introduce a partial/native ownership mode.

## Authoring and initialization

Opening the popup remains read-only. An explicit Customize action requests a
complete legal starting configuration from the engine's exact reached capability.
The app commits it as one semantic edit. Unavailable context disables creation
with its coverage reason; do not fabricate predecessor state.

Initialize deterministically through existing generation rules, not React policy
or a second random simulator. Prefer the smallest supported wave count, a concrete
supported base roll, legal types in catalog order, and the existing equal-budget
initialization where applicable. Select a legal ordered Fangs combination when
required; eligible Menace counts start at zero. These are explicit planner defaults,
not claims about the most likely native result. Composition construction must
avoid greedy dead ends and validate the complete result through the same evaluator.

Reset Customization removes the whole generated value and returns to Native.
It is the only reset/default control. Remove per-wave resets, Reset/Adjust Budgets,
variable-budget Default, shared-enemy/wave picker Default and Fangs target Default.
Customized values are directly editable; there is no inner reset to either native
behavior or a fresh concrete default. Initial construction still supplies complete
engine-owned starting values, but does not expose a second reset/repair preset.

Retain staged enemy pickers, local input/slider drafts, wave tabs and adjacent
Fangs Target/Perks controls before the tabs. Target selection persists immediately;
perk prefixes stay transient until Finish. Incomplete required choices stay
repairable through their ordinary controls, not a native fallback.

Changing composition, wave count or upstream Fear/depth may require new choices.
Preserve meaningful authorship and report missing/incompatible children. Do not
silently regenerate the encounter. Customize initializes the whole composition;
Reset Customization removes it. Both remain atomic Undo entries. Findings keep the exact
encounter customization launcher as repair destination; never auto-open the popup.

## Concrete generation model

### Budget, waves and counts

Retain A's source-validated allocation rules:

- Difficulty consumes exact depth, hard/Dream profile, modifiers, Hordes and
  minimums. Wave shares are 100%; 50/50%; 30/15/55%; 30/10/20/40%.
- Fixed budgets are labels. Variable budgets require a concrete supported base
  roll, selected with the engine-mapped slider. Current variable profile:
  GeneratedP_PreCombat, integer base 340–500.
- Every wave has a complete legal composition, with shared highlight when
  applicable and declaration-owned fixed seeds.
- Every sampled allocation branch has a finite nonnegative authored request.
  Remainder branches are derived, not extra required fields.
- Counts preserve native order, fixed-cost charging, clamping, minimum-one,
  ceilings, MaxCount and redistribution. No sum-to-budget or minimal-overflow
  validity rule; fractional budgets are legitimate.
- H Treant/Screamer templates retain actual array-index semantics: fixed seed
  first, generated companion second; the companion samples rather than becoming
  an invented remainder.

Preview and publication consume the same resolved product. Account for the
transformation from generated TotalCount to effective spawn requests before
using a count as the Menace maximum. Any remaining random count input in a
supported profile needs a concrete source-backed resolution before full ownership
can be claimed. No estimate may masquerade as an exact answer.

### Fangs

Preserve B's catalog/engine rules: one native IsElite type from the complete
encounter, deduplicated across waves, including fixed seeds; exactly the effective
rank's ordered distinct perks unless the remaining legal pool is exhausted.
Respect encounter/enemy blocking, room-set restrictions and directed exclusions.
Armor appearance is not IsElite.

When active, unblocked and a selectable type exists, an assignment is required.
No eligible type, rank zero or blocked encounter resolves to no assignment.
A selected type with an empty perk pool follows native exhaustion. Distinguish
these legitimate empty results from incomplete authorship.

Publish source-type perk assignments. Preserve native application caps and
actual-unit-name lookup, including room-level fallback where it exists. Do not
transfer source perks to differently named Menace replacements or squad members.
Do not introduce a planner application-cap ledger. Preserve B's exact reached
state/same-biome suppression handoff.

### Menace

With effective Menace enabled, add two aligned rows beneath Count:

1. **Replacement**: fixed label for deterministic mappings; an equally sized
   contextual picker for random-pool sources.
2. **Converted**: integer zero through the source's effective request count.

No per-cell native Default or probability-derived quota. Both enabled vow ranks
allow zero through all eligible requests. Blocked/no-destination columns show
noneditable NA. Hide the rows while the vow is inactive, retaining dormant data.

Include all nine random-pool H identities now: DespairElemental_Elite; normal/elite
CorruptedShadeSmall, CorruptedShadeMedium and CorruptedShadeLarge; Lycanthrope;
Treant2. Each picks one replacement per source per wave, shared by all authored
conversions in that cell. This intentionally selects a subset of possible native
outcomes, not arbitrary mixtures. Native pool: the 12 BiomeI identities, including
normal/elite changes. Do not filter it through ordinary composition eligibility.
It follows the game's biome declarations, not the next Dream-route biome.

Preserve the inventory partition: 68 mapped, 9 random, 15 enemy-blocked and 22
without destinations; encounter blocking wins. Positive random-source conversion
counts require a selected replacement. Zero needs no replacement but may retain
one dormant. A later count reduction below Converted creates a finding, not clamping.

Count source spawn requests, not necessarily final entities: replacements may be
groups. Resolved products retain source identity/order, generated and effective
counts, conversion count and target identity. Do not merge different source
entries merely because they convert into the same enemy.

Absent Menace settings on an owned encounter resolve deterministically to zero,
including encounters authored during the pre-Menace slice. Omission never restores
native rolls. This preserves the earlier complete result when Menace authoring
is added and does not require users to reauthor an already-owned encounter.

## Execution contract and settled contact strategy

Prefer installing the complete answer at native preparation contacts. Do not
replace GenerateEncounter, HandleNextSpawn, ApplyEliteAttribute or combat loops
wholesale. Do not keep sparse steering as a permanent parallel path.

C0 source traces and raw-function probes support this contact matrix. Integration
tests must retain these witnesses when implementing the adapter:

| Contact           | Required proof                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Binding           | Exact occurrence/phase/native object; separate same-name cages; reward-owned O Devotion                                 |
| Preparation       | Preserve hard overrides, money store, passive/ambient setup, custom sets, difficulty/caps and setup events              |
| Wave assembly     | Preserve templates, delays/events, fixed seeds, preexisting waves and intro-encounter substitution                      |
| Type installation | Apply only selected-source blacklist/cap side effects, once; no leakage from discarded native draws                     |
| Counts            | Define pre/post CalcTotalSpawns ownership; no double multiplier or fixed-count resampling                               |
| Fangs             | Install before native application, prevent random overwrite at normal/forced selection contacts, preserve room fallback |
| Menace            | Preserve provenance and spawn overrides; suppress only the owned entry's second conversion                              |
| Spawn execution   | Preserve native cap selection, retries, group expansion and source accounting                                           |
| Restore           | Do not reinstall completed waves or duplicate native bookkeeping                                                        |

Keep native GenerateEncounter. On the owned encounter copy, pin wave bounds and
the concrete base budget (including copied hard overrides), temporarily disable
native highlight generation, and let native code construct its wave templates.
Intercept FillEnemyTypes to install the published complete roster and
FillEnemyCounts to preserve published counts instead of sampling. This preserves
native manual templates, first-wave timing, final-wave templates and setup events;
it is preferred over copying template construction into the adapter.

Apply only the bounded native selected-type side effects: encounter highlight
blacklist; appended-type first-appearance run blacklist; blocked-type encounter
blacklist when declared; appended-type ActiveEnemyCapBonus. Preserve provenance:
native does not apply the appended-type effects to highlights or fixed seeds.
Export/source this distinction explicitly rather than guessing from final names.
Do not run random composition and then overwrite its effects, or replay side
effects on restored/already-prepared encounters.

The fresh inherited census of all 39 profiles proves CalcTotalSpawns is identity
for the supported domain: no effective count ramps or declared hero SpawnMultiplier;
both fixed H seeds have count 1. Keep native AddEncounterLayer/count initialization.
Assert this source-backed domain in coverage rather than adding a speculative
multiplier subsystem or overriding CalcTotalSpawns.

Install Fangs at PickEncounterEliteAttributes for the exactly bound owned object,
covering ordinary and forced selection contacts without random draws. Preserve
native SetupUnit/ApplyEliteAttribute and room fallback for absent type keys.
Recover phase ownership through existing room-entry rebinding on reload, not a
generation-only weak map. Do not regenerate saved waves.

For the pre-Menace slice, pass a copied args table with IgnoreShrineOverrides=true
to native HandleNextSpawn only for bound owned encounters. Raw-source probes
confirm this suppresses Menace RNG and preserves native spawning/decrement;
unowned encounters and unrelated calls remain native. No fabricated zero-roll
counter or authored Menace UI is needed in this slice.

The planner owns complete composition legality. Runtime preflight checks payload
coverage, supported declaration/contact shape, identities and finite counts before
mutation. Preserve existing native encounter-eligibility diagnostics; do not add
a second exhaustive Lua validator. Any enemy-eligibility diagnostics use detached
preselection views, never populated waves or mutated blacklists, and must not
become a new semantic enforcement system. Ordinary type eligibility is not Menace
replacement eligibility.

Preserve native intro substitution after generation/setup. If SetupEncounter
returns a different encounter, diagnose the changed identity and do not attach
the requested customization to the substitute. Do not override external save
progression. Unsupported contacts, such as newly introduced preexisting waves,
fall back before installation rather than guessing their preparation behavior.

Menace changes IsFromNextBiomeEnemyShrineUpgrade, RequiredSpawnPoint (including
the native string sentinel) and mapped ActiveCapWeight. The provenance flag also
affects Dream scaling. Renaming entries alone is insufficient. Changing a field
on an encounter copy may not suppress a branch that consults EncounterData.
Use a narrowly bound native contact, never global declaration mutation.

Full ownership can span necessary lifecycle contacts; it is not a requirement
for one giant hook or a transactional rollback of native gameplay. Preflight the
whole answer before installing its waves. Failure there leaves generation native
with diagnostics; never deliberately fill missing fields with random choices.
Later native substitution/errors remain diagnostic realization failures, not
proof of success or an invitation to undo completed native side effects. Keep
scope restoration/error handling and accurate installation diagnostics. This
best-effort runtime behavior is distinct from the complete authored contract.

## Compatibility and publication

Authored state stores choices; derived counts/native structures belong to the
resolved execution product. Structural decoding still accepts representable
incomplete edits; evaluation owns completeness and context legality.

Keep 87/45: the published release baseline remains 86/44. Preserve the existing
86-to-87 removal of weights and all retained wave/type choices. Existing partial
87 documents remain structurally loadable; the evaluator reports missing active
choices under the new complete-ownership contract. No automatic filling on load,
no generated-customization reset and no reinterpretation of allocations as counts.
Missing choices are repaired through the ordinary controls while retaining
compatible authored values. Do not add a fill-missing/reset-to-default action.
Never reset boss choices, encounter identities, topology or unrelated state.
Update migration/load copy to explain repair, and retain one shared app/offline
migration implementation. If release status advances before implementation,
recheck compatibility rather than changing an already-shipped version in place.

Publication requires a complete resolved product for each active customized
encounter. Missing coverage is an internal publication failure, not a sparse
fallback. Coordinate strict protocol decoding and republish requirements; old
allocation samples must never be reinterpreted as direct counts.

## Ownership and retirement

- Catalog owns declarations, costs/caps/templates, Fangs facts, Menace mappings,
  random pools and blocking. Extend generated `enemies.ts`/`policies.ts`.
- Engine owns the authored contract, codecs/commands, exact-state initialization,
  completeness/legality, resolved counts/Fangs/Menace, candidates/findings and
  execution assembly. Extend the existing generation capability and resolved
  post-reward product, not another state carrier or candidate replay.
- App owns Native/Customize/Reset, the existing workbench and two Menace rows,
  local drafts, findings navigation and Undo. No domain math/defaults in React.
- Executor owns focused installation using exact native bindings and scaffolding.
  No general spawn framework or acquisition dependency.

Retain source-backed declarations, evaluators and exact-state matrices from A/B.
Replace partial-default assessment/controls and sparse publication with their
consumers. Delete superseded base/count/type/perk RNG hooks in the adapter delivery.
Replace steering-specific tests with installation-contact witnesses; keep native
isolation and lifecycle coverage. No legacy parallel path, unrelated fixture
reserialization or directory reorganization.

## Remaining delivery gates

### C0 — Blocker investigation (completed for the bounded scope)

Fresh source/inheritance census and raw-source probes establish the direct-fill
strategy, count identity, zero-Menace contact and native binding/application
boundaries. Public release inspection confirms 86/44. Owner chose preservation
and repair of partial choices and explicit Menace suppression before its authoring
slice. Details and probe limitations live in the investigation; these results
are not production integration or live-game acceptance.

### C — Pre-Menace full-ownership conversion

Deliver current functionality as one vertical planner/executor gate: exact-state
complete initialization and repair, authored completeness/findings, UI controls,
resolved wave/count/Fangs product, strict wire decoder and direct native
installation. Owned encounters have zero Menace conversions; native remains native.
No Menace rows or conversion counters yet. Preserve split Fangs before tabs.
Remove all partial Default/reset controls and superseded RNG hooks in this gate, not
in a later cleanup. Do not ship an intermediate planner-only protocol change.

Primary tests: supported-profile initialization/completeness and bounded
backtracking; exact count/source equivalence; missing versus inapplicable Fangs;
same-biome suppression; partial-save repair without lost choices; Reset Customization/Undo;
absence of inner Default/reset/Adjust Budgets controls;
real ordinary/fixed-H execution products. Runtime tests cover same-name cages,
O Devotion, hard/manual/fixed waves, selected-type side effects once, native
templates, Fangs maps/caps, Menace suppression versus untouched native encounters,
intro substitution, restoration and error scope cleanup.

### D — Menace layered onto the owned product

Add deterministic mappings and all nine random-source pickers, the Replacement /
Converted rows, legality and complete resolved conversion facts. Omitted settings
retain the earlier deterministic zero result. Both enabled ranks allow zero/all;
blocked/no-destination columns remain NA. Preserve native conversion metadata,
Dream provenance and actual-unit Fangs lookup.

Do not flatten converted entries into a name-keyed wave table: native
AddEncounterLayer overwrites duplicate names. Keep the original source entries
and apply the resolved conversion at the bound spawn contact, without steering
RNG. Derive successful-source progress from native RemainingSpawns where possible;
failed attempts do not consume conversions. Native source-based cap selection,
groups and retries remain intact. No general spawn ledger or alias enemy types.

Before implementation, retain a focused contact witness for conversion accounting,
copied spawn metadata and restoration, building on C's zero-conversion hook. This
is localized implementation verification, not another open domain-model audit.
Primary tests: zero/partial/all, every mapping/pool/block class, positive count
requiring a random replacement, reduced count findings, same target from multiple
sources, original target already present, source/group replacement, retry/reload,
normal/elite changes and native Dream metadata. No generated-count recomputation.

### E — Coherent review, closure and runtime acceptance

Use the repository gated routine: one write-capable executor per coherent gate,
independent review after stable work and bounded remediation. Main owns Git,
cross-repository review and broad closure. Carry forward A/B runtime obligations.

After narrow checks stabilize run planner `npm run check`, executor
`lua tests/all.lua` and `luacheck src/`. Regenerate only affected execution fixtures
with the owning builder, Prettier-format, mirror byte-for-byte and inspect churn.

Live acceptance: native control; owned ordinary multi-wave; Hordes; P budget;
capped redistribution; fixed H; O Devotion; Fangs ranks/exhaustion/caps/squads;
separate cages; Menace zero/partial/all, mapped groups and random replacements;
reload/restoration. Inspect generated requests/native setup, not unrelated summons
or final live-entity counts. Keep runtime acceptance pending until actual testing.

At actual closure rewrite obsolete generated-composition sections in the owning
authored/integration docs, promote source facts to audits, and retire this plan
and investigations once unresolved questions have dispositions. Do not append
historical steering explanations to durable current-model documentation.
