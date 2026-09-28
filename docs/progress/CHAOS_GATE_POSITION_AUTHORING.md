# Chaos Gate Position Authoring

Status: approved execution contract; Gate A complete, Gates B/C pending.
Base: `dd1cf56b`.
Plan commit: `eaeb3035`.

## Objective

Let the user select the physical Chaos gate point in its host room using the
numbers already printed on the planner maps. Preserve native random placement
as Default. This applies equally to manually added and Ixion-forced gates.

The catalog, engine, application, and Lua executor are all owned by this
repository. Executor changes belong in `game-module/`; no sister-repository
implementation, fixture mirror, or Room Capture change is needed.

## Governing authorities and established facts

- `docs/design/AUTHORED_PROJECT_MODEL.md`: schema approval, semantic commands,
  representable invalid state, and atomic topology reconciliation.
- `docs/design/SIMULATION_AND_VALIDATION.md`: exact ownership, findings and repair.
- `docs/design/CANDIDATE_EVALUATION_MODEL.md` and
  `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`: engine capability versus presentation.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md`: strict publication, downstream
  execution, bundled module, and shared execution-fixture corpus.
- `docs/audits/rooms-and-routes/ROUTE_DETOURS_GAME_DATA_AUDIT.md`, physical anchor
  multiplicity and Ixion sections: legal hosts and point counts.

Native `RoomLogic.lua:HandleSecretSpawns` obtains `SecretPoint` IDs, checks
Chaos eligibility, consumes applicable Ixion uses, chooses the Chaos room,
and randomly selects one point before spawning `SecretDoor`. Manual and
Ixion gates share this placement path; Ixion changes eligibility and cost,
not the point pool.

The audit records 125 supported hosts: 62 single-point and 63 multi-point,
with one to four points. Physical anchors alone do not establish legal Chaos
presence. Keep the existing natural/forced eligibility distinction.

Capture numbers are assigned by sorting `GetIdsByType({ Name = "SecretPoint" })`
numerically and using one-based indices. Annotation arrays preserve those
indices; they are not spatial left-to-right order. Representative installed
maps inspected: `G_Combat02` (four), `H_Combat04` (four), and `N_Opening01`
(two). Runtime alignment with an explicit authored choice remains an in-game
acceptance item, not something screenshots alone prove.

F/G/H/I already declare `secretPointAnchorCount`. N/P counts are present in
the audit and annotated maps but absent from their room declarations.

## Contract

### Authored state and catalog

- Add optional `spawnPointIndex` to `ChaosAdditionalExit`. Omission is Default;
  explicit values are positive integers. Do not persist selector labels,
  coordinates, native object IDs, or a second gate record.
- Keep the current authored schema and catalog compatibility version. Existing
  documents decode unchanged and do not gain serialized default fields.
  This is forward reading of existing saves, not a promise that older app
  builds can read newly authored fields.
- Complete N/P `secretPointAnchorCount` declarations from the audited matrix.
  Confirm all supported host counts against annotation metadata. Tests must
  not depend on the user's external Screenshots directory.
- The engine owns a semantic command to set/clear the selection at the existing
  additional-exit owner. It does not recreate the gate, change its destination,
  select the exit, consume Ixion, or alter route topology.
- Static malformed values are rejected by the codec. A structurally retained
  positive index outside the current host's domain remains finding-backed;
  never silently clamp or switch it to Default. The command's offered choices
  come from the host's declared domain.
- Preserve selection when the same gate survives reconciliation, including
  manual-gate satisfaction of Ixion pressure. A newly generated gate at another
  host starts at Default; do not transfer a physical index between maps.
  Explicit gate removal removes its position with it. Undo restores both.
- Position concerns spawning, not taking the gate: it remains active even when
  the selected outgoing door is a normal door.

### Editor

Render `Chaos Gate` checkbox followed by `Position [Default]` on the same row,
wrapping naturally at narrow widths. The dropdown offers Default and the
declared numbered points, matching purple map markers.

- Gate absent: no position control.
- Gate present, multiple points: show the control.
- Gate present, one point: no routine position control; native placement is
  unambiguous.
- Ixion forces presence: checkbox retains its current disabled behavior, while
  position remains editable subject to ordinary authoring readiness.
- A retained invalid index must remain visible and repairable, including if a
  host now has only one point. In that exceptional state show the position
  control and finding, with Default as a repair. Hidden controls must not strand
  an authored finding.

This is separate from the existing Chaos destination-map picker. Findings use
the existing additional-exit semantic owner and navigate to the source room's
feature control, not the destination Chaos room. React must not derive host
legality or point counts from images.

### Execution and compatibility

Publish optional `spawnPointIndex` on the Chaos entry in `overview.additional`.
It is invalid on Zagreus Contract entries. Carry it through materialization
and execution assembly explicitly, including unpicked Chaos gates.

Approved execution-only compatibility change: protocol 49 to 50, performed
atomically on both TypeScript and Lua sides in Gate C, including
`game-module/src/execution-compatibility.json` and packaging/contact tests.
Old execution artifacts require re-publication; authored saves do not migrate.
No permissive old-protocol decoder or schema/catalog bump is included.

Extend the existing synchronized `HandleSecretSpawns` scope in
`game-module/src/mods/room/features/hooks.lua`. Resolve the explicit index against
numerically sorted native SecretPoint IDs and substitute only the Chaos spawn
destination at its native spawn contact. Prefer a narrowly scoped SecretDoor
`SpawnObstacle` argument override to intercepting generic random selection.
Verify the available hook supports this contact before implementation; a
materially broader interception requires amending this plan.

Default leaves native point selection untouched. Explicit selection must leave
native room choice, gate setup, health cost, Ixion consumption, and door binding
intact. Do not replace `HandleSecretSpawns`, spawn a second gate, or affect Wells,
Shrines, other obstacles, or unrelated random calls. Scope cleanup is required
on success and error; unsynchronized execution passes through.

If an explicit point is unavailable at runtime, emit a bounded diagnostic and
leave the native destination unchanged. Do not introduce a placement-only
conformance mismatch or invent a replacement index. Live testing verifies
physical enforcement; ordinary room/trait conformance remains unchanged.

## Delivery gates

Each gate has one coherent commit boundary. No release/push until Gate C and
closure pass; intermediate commits are testable but do not claim end-to-end
position enforcement. Main session owns Git and closure. Use the repository's
gate executor/reviewer routine with bounded packets and one writer at a time.

### A — Catalog and engine authority

Starting neighborhoods:

- `packages/hades2-catalog/src/declarations/rooms/{n,p}` and existing count compiler.
- `packages/planner-engine/src/authored-project/model.ts`, strict topology codecs,
  `commands/route-detours.ts`, and `chaos-gate-reconciliation.ts`.
- Existing detour materialization, selected validation, and candidate authority.

Deliver the authored leaf, command, retained materialization, exact host domain,
findings, and Ixion preservation. Do not add a new topology branch or lifecycle.

Primary tests: catalog count coverage; strict optional-field round trip;
malformed versus retained-invalid index; set/reset/Undo; manual and generated
gates; reconciliation without loss or cross-host transfer. Existing no-selection
fixtures must retain their authored encoding. Run catalog and affected engine lanes.

### B — Bound editor and repair

Starting neighborhoods:

- Application structured-workspace room-feature projections and interaction bindings.
- `apps/planner/src/ui/editor/biome/room-features/AdditionalExitControls.tsx`.

Expose the engine product and bind the semantic command. Add the conditional
dropdown with ordinary control styling and precise finding focus. Do not nest
the select inside the checkbox's label.

Primary tests: absent/single/multiple-point presentation; Ixion checkbox locked
but position editable; Default clearing; Undo; invalid retained value repair;
source feature focus. One representative application workflow is sufficient;
do not repeat the engine's full host matrix in UI tests.

### C — Publication, native enforcement, and closure

Starting neighborhoods:

- `packages/planner-engine/src/execution-plan/{model.ts,assembler.ts,codec/overview.ts}`
  and the owning overview assembler.
- `game-module/src/mods/protocol/overview.lua`, protocol constants/compatibility,
  `game-module/src/mods/room/features/hooks.lua`, and their Lua test owners.

Deliver the protocol change and narrow native adapter together. Add a real
planner-produced explicit-position execution witness consumed by Lua; extend an
existing detour fixture rather than creating another full authored run solely
for this field. Update the protocol scalar mechanically for otherwise unchanged
execution fixtures. Format changed generated semantic products using the owning
generator and Prettier. Lua reads the same corpus in place; no mirroring.

Primary tests: Default omission; Chaos-only strict field decoding; exported
unpicked gate position; unsorted native IDs mapping to the annotated index;
manual/Ixion identical placement; single spawn; native cost/consumption path;
Default and unsynchronized pass-through; missing-point diagnostic/fallback;
scope restoration on failure; unrelated spawns unaffected. Use behavioral
witnesses, not tests asserting old implementation functions are absent.

Run focused engine/export, application, game-host compatibility where affected,
and `npm run test:game-module` checks. After independent review and bounded
remediation, run one complete `npm run check` at closure.

Live acceptance: select two different numbered points on a multi-point map and
compare to its purple markers; exercise an Ixion-forced host; check Default
still produces one native gate. Record actual results, leaving live acceptance
pending if no game test has occurred.

Promote the position contract and sorted-ID evidence into the smallest owning
authored/integration documents and route-detour audit. Remove this temporary
plan at completed closure. No new permanent investigation is required.

## Exclusions and retirement expectations

No Chaos eligibility changes, destination-map changes, clickable-map editor,
entry/normal-door placement authoring, map regeneration, resource placement,
capture-module edits, save migration, or new runtime position-conformance system.
Extend the existing Chaos path in place; no parallel spawn adapter or duplicate
catalog/map manifest. Keep existing presence and destination controls.

## Gate A verification

- Catalog: 34 files / 296 tests passed.
- Engine: 185 files / 2,374 tests passed, including Default encoding, position
  command/Undo, forced and unpicked validation, and Ixion retention/new-host defaults.
- Workspace and fixture typechecking passed; focused ESLint and diff checks passed.
- Independent review: no actionable findings.
- One-off comparison with the capture annotation metadata: all 125 supported
  host counts matched. No external screenshot path is required by repository tests.
- Existing Ixion reconciliation preserves the surviving gate record, so no
  production reconciliation rewrite was necessary. No authored schema, catalog
  compatibility, or execution protocol version changed in this gate.
- Full repository closure and live placement verification remain Gate C work.
