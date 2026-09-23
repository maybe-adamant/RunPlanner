# Encounter budget slices, Fangs and Menace

## Status and objective

Implementation contract rewritten around the owner's settled decisions.
No implementation started. Commit this contract before execution.
Planner base: `f7101232`. Executor base: `6397f05`.

Keep the current optional wave-count, highlight and composition editor, but
replace relative weights with native difficulty-slice authoring and derived
counts. Add optional encounter-level Fangs elite-type/perk selection and per-wave,
per-type Menace target counts for deterministic replacements. Preserve
native generation and unit setup; this is not an exact final-live-roster editor.

The owner explicitly approved one authored schema bump with a shipped migration
that resets old weights. This supersedes the proposed legacy-weight reader.
The starting authored schema is 86 and execution protocol is 44; coordinate one
new version of each for this delivery, not one per subfeature. Confirm these
bases at implementation start if another task has advanced either authority.

## Governing evidence and authorities

- Investigation: `docs/investigations/ENEMY_BUDGET_AND_VOWS.md`.
- Game facts: enemy formation/Fear audit and combat encounter composition matrix
  under `docs/audits/rooms-and-routes/`.
- `docs/design/SIMULATION_AND_VALIDATION.md`: exact reached state, candidate
  capabilities, chronology, retained invalidity and test ownership.
- `AUTHORED_PROJECT_MODEL.md`: encounter customization and schema approval.
- `ROOM_LIFECYCLE_MODEL.md`: concrete encounter preparation contacts.
- `GAME_INTEGRATION_BOUNDARY.md`: phase-owned optional steering and diagnostics.

The existing generated-encounter plan's delivered weights model is superseded
only for this work's scope. Its pending runtime acceptance is not silently closed.

## Settled product contract

### Optional defaults and scope

Use the existing 39 generated policies in combat rooms and supported Devotion
contacts. Do not extend to scripted encounters, boss attacks or miniboss rooms.
No required editing: untouched customization, budgets, allocations, Fangs and Menace
remain native. Merely opening the dialog creates no choices.

Keep current wave-count and staged type/highlight selection. Fixed seeds remain
read-only. The engine owns count preview; neither React nor the executor becomes
a second authority for authored legality.

Random-pool Menace authoring, Return, summons, spawn positions, combat simulation
and exact final-spawn counts are excluded. Deferred Menace types retain native
behavior. Failure to realize customization stays diagnostic-only, without new
transactions, conformance checks or acquisition dependencies.

### Wave budget

Calculate native encounter difficulty from resolved base, depth axis/ramp,
modifiers, hard/Dream overrides, effective Hordes and minimum difficulty. Divide
through native WaveDifficultyPatterns, not equal shares. One/two/three/four
waves use 100%, 50/50%, 30/15/55%, and 30/10/20/40% respectively.

- Deterministic wave budget: read-only label.
- Variable wave budget: slider constrained to reachable native values, with a
  numeric value and explicit native Default/reset state.
- The census has one variable profile, GeneratedP_PreCombat: integer base
  340–500, one wave. All other supported base budgets are deterministic.
- Store the chosen native base roll at encounter scope; display its resulting
  wave budget after modifiers. Engine conversion supplies slider bounds/steps
  and handles clamped duplicate results without treating arbitrary final values
  as legal base rolls. Do not hardcode P logic into the UI.
- An omitted variable roll remains native random. Show its budget range; do not
  seed an average or claim exact counts. Explicit exact slice editing requires
  selecting that roll first. Previously retained slices remain dormant while
  this prerequisite is Default, consistent with current customization behavior.

### Slice authoring and count preview

Persist nonnegative finite requested allocation samples by enemy identity for
each authored wave. They replace weights; they are not quantities or percentages.
Zero is permitted and follows native minimum-one behavior. UI numeric stepping
may be one without restricting derived budgets to integers.

Each sampled branch can be native Default or explicit. Preview exact derived
counts only where preceding allocation is known; a default random sample must
not produce fabricated exact downstream counts. A wave may therefore contain
native and explicit requests without an artificial all-or-nothing finding.

The engine follows FillEnemyCounts in order:

1. Charge fixed template entries using native TotalCount/CountMax semantics.
2. Resolve each generated branch as sampled or native remainder.
3. Clamp a sample to remaining budget, then apply the base-cost floor.
4. Ceil quantity, apply MaxCount and native redistribution to the earlier
   uncapped type, and account for consumed difficulty.
5. Expose requested/effective allocation and the resulting generated counts.

There is no sum-to-budget constraint, strict capacity, or minimal-overflow rule.
Requests above a changed budget follow native clamps; they are not automatically
invalid or silently rewritten. Native rounding can overshoot and caps can
underfill. A later capped type can change an earlier count through redistribution;
render the completed allocation result, not stale sequential row totals.

Preserve actual native spawn-array order. Ordinary arrays put highlight first,
then selected types, with the final type receiving the remainder. A one-type
ordinary wave has no sampled slice to edit. In H Treant/Screamer templates the
fixed type occupies index 1 and the generated companion index 2, while generated
count is 1: the companion is sampled, not a remainder. Expose its editable slice
and the fixed seed read-only. Do not replace this with an intuitive last-row rule.

Count previews describe generated allocation, not later Menace/group/spawn
transformations. Ordinary Fangs perks do not change this calculation: native
selection happens later and uses encounter.EliteAttributes, whereas the cost
helper's optional modifier reads room.EliteAttributes.

### Fangs

Add one optional encounter-level selector: choose a native eligible elite type
present in the authored composition, then one/two distinct compatible perks
according to effective Fangs rank. Include fixed elite seeds. Same type across
waves shares one selection; separate encounters/cages remain independent.

Native IsElite, attribute options, bans, mutual exclusions and encounter blocking
govern candidates. H passive/passive-small block attributes. No supported profile
has a nondefault elite-type count or forced perk count; do not build arbitrary
multi-type customization in anticipation of another scope.

Use native option exhaustion semantics if fewer compatible attributes remain;
do not create an impossible requirement to select unavailable perks. Preserve
known choices invalidated by composition/rank changes for explicit repair.
With Fangs inactive or encounter blocking, retain values dormant and publish no
override. Selecting a type requires known composition, not speculative native
random membership. Native Default remains available throughout.

### Menace target counts

When effective Menace is enabled, expose a `Menace targets` cell beneath the
derived count of a type with a deterministic native replacement. Its domain is
Default or an integer from zero through that type's known effective spawn-request
count in that wave. There is no probability-derived quota: both enabled ranks
permit zero through all eligible requests. Default leaves native rolls; explicit
zero suppresses substitution. Show the mapped replacement as supporting context.

Use catalog-owned mapping and enemy/encounter blocking facts. The inventory has
68 mapped identities, 15 enemy-blocked identities and 22 without destinations.
Do not expose authoring for the latter two groups, or for encounter-wide blocks.
Native progression guards remain native; do not manufacture eligibility.

The nine random-pool Fields identities remain native and unauthorable in this
slice: DespairElemental_Elite; normal/elite CorruptedShadeSmall,
CorruptedShadeMedium and CorruptedShadeLarge; Lycanthrope; and Treant2.
Their exact inventory and replacement pool stay documented in the investigation.
They must be revisited explicitly after Menace delivery and before closure;
deferral is not authorization to add a replacement picker automatically.

Target counts require a known effective count. If allocation is unresolved,
do not invent a maximum; retain dependent settings dormant until their prerequisite
is restored. If an assessed count falls below a retained target count, produce
a repairable finding rather than clamp or erase authorship. Inactive Menace
retains dormant settings and publishes no override.

The count refers to eligible native spawn requests, not necessarily final entities:
a deterministic replacement can be a unit group. Account for any native
post-allocation count transformation at the owning engine contact before calling
a displayed count effective; do not equate a budget estimate with spawn capacity.
Menace does not change the generated difficulty budget or Fangs selection.
The resulting replacement unit receives native setup; do not transfer original
type perks onto a differently named replacement.

## Compatibility and migration

One explicit migration advances the current authored schema. Walk every authored
generated customization, including dormant/unpicked retained occurrences, and
remove only its old wave weights. Preserve project/occurrence identity, topology,
wave count, highlight, type order and unrelated customization. Missing slices
mean native allocation; migration creates no new blocker or required edit.

Ship the standalone migration script and register the same implementation in
the app's automatic migration chain. Inform users that custom encounter weights
were reset, without displaying raw internals. Do not duplicate migration logic
in React or silently convert weights into guessed slices. Test migration purity,
unrelated-field preservation, weight-free inputs, dormant owners and normal
app-load/Save workflows. The migration must not touch unrelated numeric fields.

Remove production weights/shares encoding, normalization, validation, controls
and executor interpretation. Legacy knowledge belongs only in migration inputs
and their tests. Coordinate protocol version, decoder and release compatibility
for explicit budget/slice/Fangs/Menace operands; old publications require republishing.
Do not silently accept old share operands as new slices.

## Ownership and starting code

Catalog owns source coefficients, costs/caps, fixed templates, wave patterns and
perk declarations and Menace mapping/blocking facts in
`packages/hades2-catalog/src/declarations/encounters/`.
Extend the engine-defined normalized contract rather than importing catalog into
engine. Perks belong beside their enemy/encounter declarations, not an app map.

Engine owns persisted choices/codecs/commands, exact effective Fear and generation
context, ordered pure assessment, findings/candidates and publication. Start at
`authored-project/model.ts`, `room-state/decoding/generated-encounter-codec.ts`,
`simulation/encounters/generation.ts` and `generation-preparation.ts`. Extend the
existing assessment capability; no separate simulation state or query replay.

App owns projection, semantic binding and existing encounter popup presentation:
`generated-encounter-projection.ts` and `GeneratedEncounterCustomizationControl.tsx`.
Keep wave panels/picker badges; replace adjacent weights with slice controls and
derived counts. Fangs is encounter-level, not copied into each wave. Findings
keep exact encounter/decision repair ownership and do not auto-open the popup.
Slider interaction must not lose dragging during simulation refresh.

Executor owns scoped native realization in encounter `generated.lua` and a
focused Fangs module beside it. Allocation continues to intercept the existing
RandomNormal contact, returning the explicit sample. Budget selection intercepts
only the bound generation's base RandomInt call. Do not replace FillEnemyCounts,
inject TotalCount, override global budget declarations or intercept unrelated RNG.
Fangs steers native encounter-type and attribute selection, preserving its
application in unit setup; no manual per-unit perk installation. Use bound native
encounter identity, never a same-name scan across cages.

Menace uses a focused adapter at the native HandleNextSpawn substitution contact.
Bind counters to exact encounter, wave and source spawn entry, not enemy name
alone across the room. Steer only the existing Menace roll; leave SwapMap and
unit creation native. Select the first requested number of eligible successful
spawn requests deterministically, then suppress remaining rolls for that authored
entry. Do not count failed spawn attempts, nested group-member calls with
IgnoreShrineOverrides, summons, unrelated calls or deferred random-pool types.
Restore scope on return/error and avoid double counting retries or restored rooms.
Use the narrowest native identity/state needed, not a general spawn ledger.
Missing realization produces diagnostics only, never a mismatch.

## Delivery gates

### A — Budget/slice vertical replacement and migration

Deliver declaration facts, normalized contracts, pure allocation/context,
authored migration, editor, publication and executor sample/base-roll steering
as one coherent slice. Include the coordinated wire/schema contract needed by
this plan; do not land a wrapper/interface-only gate. Remove the old weights path.

Primary tests: catalog fact/normalization matrices; engine ordered allocation and
retained-state matrices; migration tests. Representative app tests cover native
Default, fixed label, variable slider, editing/types/reset/Undo and finding repair.
Executor tests cover exact contact, native remainder, fixed seed, error restoration,
nested/unrelated generation and diagnostics. Verify counts against native
FillEnemyCounts in an isolated source probe, not a duplicate test algorithm.

### B — Fangs vertical delivery

Deliver perk declarations, exact active context, authored choices/candidates,
encounter-level UI, publication and native adapter. Complete schema/protocol
fields within the single version established for this delivery, without a
second migration step. Do not ship intermediate mixed-version releases.

Primary tests cover ranks 0/1/2, effective suppression, native IsElite versus
armor appearance, blocked encounters, eligible fixed seeds, mutually exclusive
perks, exhausted options, changed composition and repeated type across waves.
Executor witnesses prove separate same-name cage encounters remain isolated,
Default remains native and assigned perks do not alter generated count budgets.

### C — Deterministic Menace vertical delivery

Deliver mapping/block declarations, optional target counts and exact count
readiness/validation, UI cell, publication, and scoped native substitution
steering. Use the same coordinated schema/protocol version as A/B; no additional
migration. Preserve native behavior for absent settings and all deferred types.

Primary tests cover Default versus zero, one/all targets at either enabled rank,
blocked enemies/encounters, no-destination types, the nine deferred types,
count reductions and inactive suppression. Executor witnesses cover wave/type
isolation, same-name cages, failed/retried spawns, nested groups, native replacement
setup and counters across supported room restoration. Test generation and
substitution diagnostics separately; no broad live-enemy accounting.

### D — Mandatory pre-closure disposition of random Menace types

After C is implemented, revisit the nine documented random-pool Fields types
with the owner using the delivered model and available runtime evidence.
Explicitly choose continued native-only deferral or a bounded follow-up scope.
Record that disposition before proceeding to closure. Do not mark these types
supported because the deterministic adapter works, and do not silently expand
C into replacement identity authoring. Continued deferral is an acceptable
closure result; retain the source inventory and clear supported boundary.

### E — Closure and runtime acceptance

Use repository multi-agent delivery routine: one write-capable executor with a
focused gate packet; independent review after each stable vertical slice and
bounded remediation. Main session owns cross-repository review and broad closure.

Run full planner `npm run check` and executor `lua tests/all.lua` / `luacheck src/`
after narrow tests stabilize. Regenerate only affected execution fixtures through
the planner builder, format with Prettier, mirror byte-for-byte and inspect churn.
Migration/version-only fixture updates do not warrant unrelated regeneration.

In-game acceptance: ordinary multiple waves; Hordes ranks; P budget slider;
capped redistribution; fixed H template; reward-owned O Devotion; Fangs ranks;
same type across waves and distinct cages; Menace zero/partial/all targets,
mapped group replacement, deferred random-pool behavior; native defaults.
Compare generation diagnostics with allocation previews and scoped substitution
diagnostics with Menace targets, not the complete final-live roster. Do not call runtime
acceptance complete before actual testing. Keep a bounded pending checklist if
the owner tests after code delivery.

At actual closure, update current owning model/audit sections, removing obsolete
weight descriptions rather than appending bug history. Retire this plan and its
investigation; reconcile earlier encounter runtime checklists without claiming
untested obligations passed. The broader encounter audit stays in investigations
until the user finalizes that work.

## Review checklist

- No equal-wave-budget assumption or UI calculation of native domain policy.
- No fake exact preview with default/random prerequisites.
- No last-row shortcut for fixed templates; no minimum-overflow validation.
- No Fangs feedback into budget or per-wave/per-unit perk authoring.
- Menace steers only authored deterministic substitutions; no final roster
  promise or additional mismatch boundary.
- Explicit pre-closure owner disposition for all nine deferred random-pool types.
- No legacy weights implementation outside migration; reset scope is exact.
- No extra schema bump, duplicate migration, unrelated fixture churn or silent
  destructive cleanup after upstream changes.
