# Cocoons, anomaly roster, and Hub fountain

Status: locked 2026-09-25; implementation not started. The owner approved
authored schema 88, execution protocol 47, the feature scope, and the legacy
fountain-first migration. No push or release until the whole plan closes.
Base: `aa5d84122691958de4b0d5f24a1b52210f6a9b54`.

## Objective

Add two bounded encounter customizations and model the mandatory Ephyra Hub
fountain with the existing map-based visit editor. Preserve native behavior
outside the explicitly owned choices. Source evidence and current contact
inventory are in `docs/investigations/COCOONS_ANOMALY_AND_HUB_FOUNTAIN.md`.

## Locked scope

### Cocoon encounters

- Default remains native. Customization is an integer count slider using the
  catalog-declared native range (currently 8–14), not UI/executor hard-coded bounds.
- Applies to Arachne combat encounters in F/G, not decorative story cocoons.
- Leave size distribution, contents, physical placement, and reward-cocoon
  assignment native. No content table or reward-after-N-breaks control.
- Export an explicit cocoon customization variant. Scope count enforcement to
  combat cocoon setup; do not route it through finite generated-wave installation.
- Supply a scoped argument copy with minimum = maximum = requested count to
  `SpawnArachneCocoons` inside combat setup. Preserve `RandomInt` and all later
  native placement/content/reward operations. This choice changes no simulated
  reward or lifecycle state; it is authored execution customization.

### Anomaly

- Default remains native. Customize one infinite-spawn enemy roster using the
  contextual composition picker pattern.
- Source-backed bounds are two to three distinct types and at most one elite.
  The completed B-pool matrix in the investigation owns the 15 identities,
  inherited elite depth gate, Sandskull exception, and directional SpreadShot
  exclusion. Preserve native-realizable roster order, not a symmetric family ban.
- No wave count, budget, allocation, finite enemy count, shared highlight, or
  Fangs/Menace authoring. Native spawning, vow behavior, pacing, caps, capture
  progress, reward outcome handling, and cleanup remain native.
- Export a distinct infinite-roster variant. The finite-wave installer's
  infinite-spawn rejection remains intact for finite variants. Reuse the existing
  generation/fill hook owner with a distinct roster admission/install strategy;
  do not register competing hooks or let finite Fangs/Menace overrides claim it.
- Customization admission failures are diagnostics and native fallback, not new
  customization mismatches. Use the audited pre-mutation generation contact;
  do not describe a failure after roster mutation as clean native fallback.

### Hub fountain semantics

- Exactly six distinct room visits plus one fountain interaction are required.
  The fountain is an action, not another room visit or encounter.
- It can occur initially, between complete room visits, or after the sixth
  visit before departure. Side-room excursions remain within their room visit.
- The action and its outcome have a stable Hub-owned semantic address. Reuse
  existing fountain/Phial target assessment, consumption, rarity mutation, and
  offer invalidation; do not create a second fountain policy.
- Settle the action in the Hub, before the next room's entry context. Final
  fountain use precedes Preboss generation. Do not regenerate the existing Hub
  board, replay Hub entry effects, or advance counters for fountain use.
- Persist one required ordered action list on `HubDecision`, replacing the old
  room-only `visitOrder`: typed room-visit entries carry slot keys and one typed
  fountain entry represents use. Maximum six distinct open room slots and one
  fountain; incomplete prefixes, including empty, remain representable.
- Persist the fountain outcome on the Hub decision, using the established
  fountain-outcome representation and a stable Hub action address. Neither
  position nor outcome belongs to the next room occurrence.
- Migration explicitly prepends fountain use to each existing Hub's room order,
  including incomplete orders. Do not invent a Phial target: normal actionable
  findings let the user repair the outcome. New Hubs and Reset Visits start
  with an empty action list. Current-version decoding never interprets absence
  as an implicit action.
- Removing a room entry leaves the relative order of all retained actions
  intact. Reordering operates on action identity, with room ordinals derived
  by counting only room entries. No separate fountain-position counter or
  second authoritative room order is stored.
- Reset clears all actions and the fountain outcome through the same semantic
  edit. Ordinary position edits preserve an authored target and reassess it in
  the new context rather than silently replacing it.
- Keep structural Preboss handoff eligibility tied to six room visits. Missing
  fountain placement blocks successful assessment/publication through the
  combined completeness finding, but removing only the fountain must not delete
  downstream authored topology. Removing room visits retains existing handoff
  cleanup semantics. Do not confuse retained topology with evaluated readiness.

### Hub presentation and map preparation

- Reuse `apps/planner/src/ui/room-maps/assets/N/N_Hub.webp`; no recap, raster
  annotation, or replacement asset is needed.
- `HubMapAnnotations.tsx` owns the current 2560 × 1440 source-image geometry and
  read-only SVG. Interactive overview/timeline markers consume that geometry;
  there is no separate SVG asset to regenerate.
- Fountain center is approximately **(1360, 800)**: the green basin between the
  two braziers, below-left of the shielded building. Visually verify alignment
  when implementing; use the existing zoom/pan coordinate system.
- Give the fountain a distinct, recognizable marker, not a room-quality
  category or fake room slot.
- **Overview:** visible and noninteractive. It cannot be opened/closed and does
  not affect board membership or the room-quality legend.
- **Timeline:** clickable to append fountain use to the ordered sequence; show
  its order badge using the same visual language as room actions. Prevent
  duplicate use. Room and fountain badges communicate the combined order,
  while underlying room visit ordinals remain 1–6.
- Display the fountain interaction/outcome controls before the next room's
  timeline, or before Preboss's timeline when used last. This is presentation
  only: do not attach persistence, candidates, or execution ownership to that
  display room. Do not fabricate a next room when the route is incomplete;
  retain an actionable Hub-owned repair destination until it exists.
- **Reset Visits resets all seven actions**, including fountain placement.
  Preserve the existing explicit reset/downstream-cleanup and undo semantics;
  it must not close board rooms or remove the Hub.
- Extend the existing choose-six-visits finding, rather than adding a separate
  fountain-placement finding: **“Plan six room visits and use the fountain.”**
  Route it to the Hub timeline map. Completeness checks six room visits plus
  one fountain, not merely a sequence length of seven.
- Missing/invalid Phial targets remain their own normal outcome findings,
  navigated to the displayed Hub-owned fountain controls.

## Ownership and authorities

- Catalog: cocoon range, anomaly roster declarations and source-backed enemy
  restrictions. It does not own authored order or UI marker coordinates.
- Engine: customization variants, codecs/defaults, semantic edits, candidates,
  findings, Hub action identity/order, lifecycle settlement, and export products.
- Application: adapt those products and bind exact controls/finding navigation.
  React renders the map and pickers; it does not derive eligibility or repair
  order/topology.
- Executor: distinct cocoon/roster adapters and Hub fountain transaction binding.
  Reuse the Phial installation scope; the next room is not active when the real
  fountain is used. Retain native fountain interaction and departure gating.

Before engine implementation read `docs/design/SIMULATION_AND_VALIDATION.md`
in full and its relevant linked authored-model, lifecycle, and execution
authorities. Hub behavior is owned by `docs/biomes/N_GAME_RULES.md`; G anomaly
behavior by `docs/biomes/G_GAME_RULES.md`. Read executor-local instructions and
its current boundary authority before editing that repository.

## Compatibility and approval boundary

**Authored schema: 87 → 88, approved by the owner.** The
current strict Hub decoder accepts only `kind`, `hubKey`, `source`, `openTargets`,
and `visitOrder`. Room-only slot keys cannot encode a fountain action, and the
occurrence-owned fountain outcome cannot encode a Hub outcome. Adding fields
under the existing shipped version is not a safe compatibility path. A missing
field meaning legacy entry-time use plus another value meaning unplaced would
also introduce ongoing legacy semantics into current decoding.

The approved behavioral default is implemented once in migration, not through
permissive parsing. Ship the conversion in the application's migration chain;
preserve existing room order, open targets, and unrelated data. Use the existing
empty-outcome encoding for the Hub outcome. No selected target is fabricated.
Earlier supported saves continue through the established migration chain.

**Execution protocol: 46 → 47, approved by the owner.** Cocoon and infinite-roster variants
and a Hub-bound fountain transaction are new strict wire shapes. Coordinate
producer and consumer changes under one revision; old execution artifacts need
re-export, not inferred runtime migration. Keep version rejection explicit.
Verify these baseline versions before execution; do not recycle a shipped one.

Obtain schema approval before Gate A adds persisted customization variants.
Use the single approved revision across the delivery, without shipping partial
gates as releases. Each landed gate must remain internally testable; no approval
for broken intermediate commits is assumed. Gate A owns schema 88 and the
application's `migrate-project-87-to-88` migration-chain entry, initially a
version-only conversion because cocoon customization adds no required legacy
values. Gate C extends that same unreleased migration with the explicit Hub
conversion, landing persistence, settlement, export, and fixtures together.
Gate A also owns protocol 47 and the executor's `execution-compatibility.json`;
B and C extend the unreleased wire contract, and E completes Hub execution.
Do not release or distribute these intermediate versions as complete products.
If either version ships before completion, stop and revise the version/migration
boundary rather than changing shipped semantics. Refresh only
semantically changed fixtures, apart from bounded version-scalar changes, and
mirror through the existing producer-owned generators.

## Delivery gates

Commit this plan before implementation. Each gate is a complete vertical slice
with narrow tests, independent review, and one bounded remediation pass. The
main session owns Git, cross-gate decisions, and closure. Do not run parallel
write-capable executors in the shared worktree.

### A — Cocoon count

After schema approval, introduce schema 88, the version-only 87 → 88 migration
and its application registration/coverage, protocol 47, and matching executor
compatibility metadata. Update existing version assertions and fixture scalars
without unrelated regeneration. These changes belong to this working feature
slice, not a preceding version-only commit.

Use the source-traced scoped setup contact, then deliver catalog declaration, authored
and exported variant, slider, and executor count adapter. Primary catalog/engine
tests own range and default policy; UI tests own slider dispatch/reset. Executor
tests witness combat-only scope, untouched default, and native content/reward
setup. Include a real producer-to-consumer fixture, not only handwritten wire.
Retain native shortfall behavior with diagnostics; never compensate by stacking
extra obstacles or changing spawn geometry. Commit independently.

Tests witness that the native count draw is still called with equal bounds.
They must not claim whether the native RNG advances internally: that is not
established by a mocked function and is not a seed-reproduction acceptance goal.
Do not add RNG compensation. Zero-placement failure remains a native risk, not
permission to synthesize a reward or invent a cocoon location.

### B — Anomaly roster

Use the completed B-pool audit and existing pre-wave admission/fill contacts.
Deliver the distinct catalog/engine variant, composition editor, export, and
executor adapter. Test roster bounds, eligibility and elite restrictions at
their primary owner; consumers retain representative witnesses. Verify native
infinite flags, cap/pacing/completion preservation and uncustomized/failure
fallback. Include the asymmetric SpreadShot ordering and inherited elite-depth
exception as primary catalog/engine witnesses. Preserve native active-cap
weights (five is not an entity-count promise), cap bonuses, and infinite flags.
Do not reuse finite allocation/count machinery or emit `expectedBudget` for
the roster variant. Commit independently.

### C — Hub model, migration, settlement, and planner export

Start at `HubDecision`, Hub materialization, `appendHubDecision`, existing
`fountain-used.ts`, and fountain target commands/addresses. Establish a complete
Hub-owned ordering/outcome product and explicit 87 → 88 conversion.
Retained reorder/remove commands must preserve that identity and cannot leave
an orphaned fountain position. Reset clears placement, and a second placement
must be structurally prevented.

Primary engine witnesses: initial/intermediate/final use; no Phial; eligible and
invalid Phial targets; later entry observes rarity changes; side-room returns;
no duplicate counters/board generation; migration versus explicit reset state;
reset/undo, save/reload, and route edits. Specifically witness that missing
fountain placement leaves a six-visit handoff and its authored downstream rooms
intact while assessment stops. Empty/new/reset Hubs must not gain implicit use.

Migrate all existing consumers of room-only order onto the complete engine
product in this slice. Existing UI consumers may use a derived room-only view,
but must not persist or reconstruct a competing order. Expose supported action
edits and finding addresses with a real engine test consumer.

Deliver the planner half of the Hub execution contract in this same gate:
Hub export assembly, protocol-47 wire shape and planner codec, ordered fountain
transaction, and target payload. Regenerate affected Surface/Dream execution
fixtures through their real project builders and update Hub checkpoint tests.
Include migrated-project → simulation → encoded/decoded execution witnesses for
initial, intermediate, and final placement. No export may omit the interaction,
and no expected planner fixture failures are deferred to Gate E.

Regenerate only the authoritative planner copies in this gate. Do not mirror
Hub-bearing fixtures into the executor before its strict decoder consumes them;
Gate E's executor commit mirrors them byte-for-byte and verifies each pair with
`cmp` together with that consumer. Do not hide the gap with permissive decoding
or claim executor readiness. Planner export remains testable in C/D; the
unreleased executor is not approved for using the new Hub artifacts until E.
Commit independently.

### D — Hub map and outcome editor

Update workspace binding, shared marker geometry, `HubMapOverview`, and
`HubMapTimeline` against Gate C's products. Deliver the complete map behavior
and next-room prefix specified above, including an actionable Hub repair
destination when the display room is not yet present. No simulation policy
belongs in React.

UI witnesses: inert overview marker, timeline append once, combined order badges,
six-room capacity independent of fountain placement, pan does not click, reset
all actions and undo, shared completeness finding, and exact outcome navigation.
Visually verify marker alignment and zoom/pan behavior. Retire the old six-action
capacity assumption while retaining the six-room invariant. Commit independently.

### E — Hub executor decoding and binding

Consume Gate C's wire product and mirrored fixtures: implement strict executor
decoding and navigation/session integration so actual
`UseHealthFountain` (`InteractLogic.lua:741`) claims the Hub-owned transaction
on initial entry or the appropriate return. Do not activate the next occurrence
early to borrow its timeline. Provide a real migrated project → exported plan
→ consumer witness, including a Phial target and an intermediate placement.

The existing `room/timeline/interactions/fountain.lua` owns the hook and
`keepsakes/aromatic_phial.lua` owns target forcing. Reuse both; extend their
owner-validity binding to recognize a Hub action instead of requiring only
`room.current(state)` identity. Do not add a second fountain or rarity hook.

Scope lifecycle: no target completes through normal fountain interaction;
with a target, retain scope across native `UseHealthFountain` return until the
matching threaded Phial `AddRarityToTraits` contact. Consume that scope once,
then complete the transaction after the native mutation returns. Cancel on
native failure, session replacement/resync/desync, or loss of the owning Hub
contact. A missing callback must not leak into a later fountain; retain an
unfulfilled transaction for the existing obligation/conformance machinery,
not a fabricated success or new per-room charge check. Failure cleanup must
also cover exceptions from the threaded rarity operation.

Executor witnesses: initial/return/final Hub binding, delayed callback, exactly
one claim, scope cancellation, unrelated fountains and rarity effects untouched,
and next-room conformance sees the completed change. Guidance must represent
the Hub action rather than tell the user to use a fountain in the next room.
Complete producer-to-consumer acceptance using Gate C's fixtures; do not move
planner export or regeneration into this gate. Both sides must agree before
release or in-game deployment of Hub fountain support. Commit independently.

### F — Closure

Review the complete diff for parallel policies, fake room identities, stale
six-action assumptions, generic adapter growth, and accidental finite/infinite
contract mixing. Remove superseded paths in their owning slice, not via deferred
compatibility wrappers. No general encounter framework or new health model.

Run narrow owning lanes during implementation and one complete `npm run test`
and `npm run check` after review remediation. Check formatting and byte-identical
executor fixture mirrors; inspect churn before handoff. Record actual results,
not intended checks.

In-game acceptance: F/G cocoon minimum/maximum and native reward; anomaly roster
replenishment through success/failure; Hub fountain first/middle/last with Phial,
returns, and departure gating; map readability and correct interaction targets.
Do not claim these checks passed without user testing. If deferred, record the
remaining checklist in the existing live acceptance tracker.

Promote settled source facts to the owning audits and Hub semantics to its biome
and necessary design authorities. Delete this plan and its investigation at
closure unless a concrete unresolved probe remains; no durable changelog prose.
