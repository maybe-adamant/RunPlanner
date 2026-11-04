# Engine Slice: Plan End and Challenge Switches

Status: P1–P6 delivered on branch `engine-slice-plan-end-switches` (from main
`606f8e588`, started 2026-11-03); P7 open. Temporary plan; delete at delivery
after promoting P7's durable result. The durable contracts of P1–P6 live in
the design documents (Route Scope and the switch leaf in
`AUTHORED_PROJECT_MODEL.md`, Plan end in `SIMULATION_AND_VALIDATION.md`,
`ROOM_LIFECYCLE_MODEL.md`, `EXECUTION_PROTOCOL.md`, `ENCOUNTER_PREPARATION.md`,
`REWARD_MODEL.md`, `CATALOG_MODEL.md`, `RUN_START_INSTALLATION.md`,
`STRUCTURED_EDITOR_WORKSPACE.md`, `EDITOR_MODEL.md`,
`GOLD_ESTIMATE_ASSUMPTIONS.md`), the room features audit's Challenge Switches
section and the run import's settled decisions in `RECORD_MODE.md`.

## Release rule (owner, 2026-11-04)

P6 and P7 ship in the same release. Until P7 lands, two kinds of valid plan
are not publishable; the route summary carries `executionPlanBlock`,
`eligibleForExecutionPlan` is false, the publication entry
`assembleExecutionProduct` refuses with that compiler code, and the send
button names it:

- `planEndAwaitsGameModule`: valid through a cut plan end (mid-biome, or
  inside a Hub stay). Copy: "Sending a plan that ends early needs the next
  game module update." An end at a biome's terminal room is the ordinary
  prefix end and publishes.
- `challengeSwitchAwaitsGameModule`: a published biome enters a room with an
  observed challenge switch (its `rewards.challengeSwitchEncounters`). Copy:
  "Sending a plan with a challenge switch needs the next game module update."

The route assembly below the entry (`assembleRouteExecutionProduct`) still
builds both wires, witnessed in
`packages/planner-engine/test/execution-plan/plan-end.test.ts` and
`packages/planner-engine/test/simulation/challenge-switch.test.ts`.

**Remove in P7**, once the module runs those wires: `ExecutionPlanBlock` and
the summary's `executionPlanBlock`, the block branch in `summarizeRoute` and
its `publishesChallengeSwitch` argument (eligibility becomes "valid through its
end" again), the entry's refusal and both compiler codes, the app's copy and
`GameSendProject.executionPlanBlock`, the gate witnesses (plan-end and switch
tests, `gamePanel.test.ts`), and the sentences in `EXECUTION_PROTOCOL.md` and
`SIMULATION_AND_VALIDATION.md` that name the blocks. Fold
`assembleRouteExecutionProduct` back into `assembleExecutionProduct`.

## Owner-settled decisions still governing P7

1. The game module steers the switch's existence, its encounter and its reward
   (Perfect Clear and Elite variants) and nothing else; room-exit conformance
   catches the rest. The press and its outcome are never steered.
2. Switch placement findings stay blocking at the room Overview, like the Well
   and Shrine placement findings (owner, 2026-11-04; recorded in the room
   features audit).
3. A plan ending inside a Hub stay publishes no departure after its last visit;
   the module treats the stay's end as the plan's end.
4. The end room's own door draws are not simulated, so its `beforeRoomExit`
   Run State lacks them: the module's end-room conformance must not compare
   reward stores.
5. The bonus Nectar claim stays, with no level-up, as the game source spawns
   it (owner, 2026-11-04).

## P6 — merge preparation (delivered 2026-11-04)

- Publication gates (above), with engine and app witnesses.
- D: the Fields/Hub god fallback past exhaustion is witnessed at the batch's
  offer resolution point (`test/reward-kernel/behavior.test.ts`): at the
  four-god cap a repeat is refused while an acquired god is unshown and
  accepted (any acquired god, never a fifth) once all four are shown. The
  offer cohort passes every earlier offer of the batch to that same check. No
  real five-Boon batch is authored: it needs a refilled or prioritized bag.
- `schemaRevision` 101.0 → 101.1: the engine constant, the game module's
  admitted pair (`decoder.lua`, `execution-compatibility.json`) and the
  `schema/README.md` history; no transition. The legacy schema-100 test body
  drops the current revision.
- Execution fixtures regenerated: only the schema stamp and fingerprint
  changed (no fixture plans an end or a switch).
- Equivalence and Draft corpus: see the characterization below. Draft
  corpus (432 runs, pass): the only metric deltas against its baseline are in
  the Fresh File (`F*`) specs, and the same subset measured on the slice base
  `606f8e588` gives identical values, so they predate the slice (the Fresh
  File run-start roll landed after the baseline was recorded). The baseline
  was not re-recorded in this slice; the owner decides whether to re-record
  that drift.
- Durable contracts promoted into the documents listed in the status line.

## P7 — game module (open; after `game-module-cage-draw` merges)

- Decoder and graph validation accept a terminal room that is not a biome
  completion room and a partial Hub block (no `finalHandoff`, departures
  through the last visit only), then lift the plan-end publication gate.
- `overview.challengeSwitch`: realize the switch's existence, variant,
  encounter composition and Elite pin; the `interactChallengeSwitch` guide row
  with its outcome; claim pickups from `ChallengeSwitchLoot`; then lift the
  switch publication gate.
- Add execution fixtures that carry a cut end, a partial Hub and an observed
  switch once the module decodes them (none exist yet, so the module's
  fixture tests stay green under 101.1).

## Remaining items (not delivered in P1–P6)

- **C (both items) waits on a ruling.** Either wire key makes almost every
  plan unreadable by this branch's module, whose decoder is strict: a store
  fact sits on nearly every room's conformance and a cage outcome on every door
  into a Fields room. Gating them would hold back almost every plan, and the
  checked-in fixtures would carry them, failing `test:game-module`. Since the
  101.1 bump is unreleased and P7 ships in the same release, both can land in
  P7 beside the module's decoding with no second bump.
- **C. Store fact**: a planner-published room-exit `rewardStores` conformance
  fact per comparable store (entries declared for another route and Secrets
  excluded, as the import's `storeCounts` does), selecting the
  `beforeRoomExit` frame's `rewardStores`, omitted on a cut end room. Not
  implemented.
- **C. Cage outcome**: each Fields cage roll's published Min/Max outcome beside
  the count, so the module's steering is exact when `MaxCageRewards` clamps Max
  to Min. Not implemented.
- **Recorder capture** the switch import would use (none recorded today): the
  entry save's `CurrentRoom.ChallengeSwitch`, the first post-room save's
  `CurrentRoom.ChallengeEncounter` (started, completed, ended early, damage,
  Time gold, roster, Elite name and attributes), or the hero's gold before and
  after the room.

## Equivalence and Draft corpus characterization

| Phase         | Entries changed | Why                                                                                                                                                      |
| ------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1            | none (157/157)  | A project without `planEnd` evaluates identically; `processing.afterPlanEnd` is present only when an end applies.                                        |
| P3            | none (157/157)  | The end room's exit work, the partial Hub block and the ended extent apply only with `planEnd`; no corpus project has one.                               |
| P2 follow-ups | none (157/157)  | Readiness and candidates change only under an ended horizon; no corpus project has one.                                                                  |
| P4            | none (157/157)  | Catalog additions (switches, `Money`, `ChallengeSwitchLoot`) and switch handling apply only to rooms with an observed switch; no corpus project has one. |
| P4 encounter  | none (157/157)  | The 24 encounter definitions sit outside every set; the press's encounter, its gold and `challengeSwitchEncounters` exist only with an observed switch.  |
| P5            | none (157/157)  | The per-RoomSet depth floor changes only switch placement findings; no corpus project has a switch.                                                      |
| P6            | none (157/157)  | The publication block applies only to a cut end; the digests leave out the schema pair and fingerprint. Baseline not re-recorded (nothing to record).    |
