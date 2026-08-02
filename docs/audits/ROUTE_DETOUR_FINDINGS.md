# Route Detour Findings

## Status

This is a forward-looking game-data audit and extension-readiness document. It
does not add detours to the production catalog, authored schema, simulator, or
editor, and it does not authorize runtime integration work.

The current product remains conditioned on natural Chaos and Anomaly
replacement being suppressed. Zagreus contract rooms are likewise outside the
authored route.

## Question

Chaos, Oceanus Anomaly rooms, and the Zagreus contract fight all leave the
current biome route and later resume it. Can they use one extension boundary
without erasing the differences in how the game offers them?

Yes, at the level of route ownership and resume behavior. No, at the level of
entry generation.

The useful common concept is:

> A detour is a real room occurrence reached through an explicitly modeled
> departure from a host biome and followed by an explicitly modeled return to
> that host biome's progression.

The entry mechanism must remain a closed declaration-owned variant. A generic
graph edge, callback, or `special` escape hatch would hide game facts the
planner needs to validate.

## Current Planner Boundary

The current authored topology has:

- one start occurrence;
- `ExitDecision` for linked exits and a normal lane, including a zero-target
  generated envelope before its first ordinary target or takeover resolves it;
- `HubDecision` for Ephyra;
- one selection among the normal targets of a realized `ExitDecision`;
- derived biome completion after a selected Preboss.

`ExitDecision.normal` deliberately owns only normal exits. There is no Chaos
gate, replacement target, detached room-set node, or generic route edge.
Natural Chaos and Anomaly are suppressed by the current game-integration
contract.

This is the correct baseline. Detours should extend the decision envelope; they
should not become room-local checkboxes or a second biome-plan family.

A zero-target generated envelope is current normal-lane authoring state, not a
missing edge, special-exit placeholder, or detour. Its eventual ordinary target
and any atomic normal-door takeover remain in that normal lane.

## Game Findings

### Natural Chaos: an additional exit

Relevant source:

- `RunLogic.lua::CreateRoom`
- `RoomLogic.lua::HandleSecretSpawns`
- `RoomLogic.lua::IsSecretDoorEligible`
- `RoomDataChaos.lua::BaseChaos`

`CreateRoom` records a `SecretChanceSuccess` roll. During room setup,
`HandleSecretSpawns` checks for a physical `SecretPoint` and evaluates the
room's Chaos requirements. When eligible, it:

1. chooses a target from the `Chaos` room set;
2. creates a separate `SecretDoor`;
3. creates the Chaos room;
4. assigns that room to the special door.

The normal doors are not replaced. The Chaos door is an additional offered
continuation beside them.

`BaseChaos` has `UsePreviousRoomSet = true`, so its outgoing generation resumes
the prior room set. It also has `PauseBiomeState = true`, a forced `Secrets`
reward store, and the `Empty_Chaos` encounter.

The focused Preboss probe establishes three boundary facts for future work:

- Chaos is a separately offered special exit beside the source's normal exits;
  an atomic Preboss takeover controls the normal exits only.
- Taking Chaos can leave an offered normal-door Preboss batch unentered. A
  later normal generation creates a fresh Preboss batch and fresh reward draws;
  the earlier unentered batch is not resumed or reused.
- Natural Chaos is suppressed by a Chaos occurrence among the prior ten rooms,
  not merely by the immediately preceding room.

`PauseBiomeState` must not be translated as "pause all counters." Its observed
game implementation removes and later restores biome-state traits. The exact
room-history, depth, reward, and trait effects of a Chaos visit need a focused
lifecycle fixture before implementation.

### Oceanus Anomaly: replacement during normal-target generation

Relevant source:

- `RunLogic.lua::CreateRoom`
- `RoomLogic.lua::HandleSecretSpawns`
- `RunLogic.lua::ChooseNextRoomData`
- `RoomDataG.lua` ordinary combat declarations
- `RoomDataAnomaly.lua::BaseAnomaly`

`CreateRoom` records an `AnomalyDoorChanceSuccess` roll.
`HandleSecretSpawns` turns an eligible success into `currentRoom.DoAnomalies`.

`ChooseNextRoomData` first chooses an otherwise-valid normal target. If the
source is anomaly-enabled and that target has `AllowAnomalyReplacement`, it
replaces the returned target with a room from the `Anomaly` room set.

This is not an additional door and it is not an encounter variant inside the
chosen G room. The discarded normal candidate is never created as a room
occurrence. The Anomaly room owns its own identity, encounter, reward, and
history contribution. `BaseAnomaly.UsePreviousRoomSet` resumes Oceanus after
the Anomaly room.

The planner may need the replaced target's eligibility class to prove that
replacement was possible. It should not persist a ghost normal occurrence
unless a later probe identifies an observable consumer for that exact room
identity.

### Zagreus contract: an additional exit from supported rooms

Relevant source:

- `RunLogic.lua::CreateRoom`
- `EventLogic.lua::SpawnZagContract`
- `EventLogic.lua::SpawnZagContractRewards`
- `StoreData.lua::ZagreusContractRequirement`
- `RoomDataC.lua::C_Boss01`

The supported entry rooms currently include the four midshops
`F_Shop01`, `G_Shop01`, `O_Shop01`, and `P_Shop01`, each with a
`ZagContractDestinationId`.

When the profile requirements and chance pass, `CreateRoom` marks the room.
`SpawnZagContract` then creates an additional contract exit whose fixed target
is `C_Boss01`. The ordinary exit flow remains present.

`C_Boss01` has `PauseBiomeState = true` and `UsePreviousRoomSet = true`, so it
returns to the host biome after the fight.

`ZagContractRewardDestinationId` is a separate later-room placement contract
for a free contract benefit after the fight. It is not another entry edge and
must not be folded into detour availability.

## Classification

| Feature          | Entry form                               | Normal target remains offered? | Detour target         | Return            |
| ---------------- | ---------------------------------------- | ------------------------------ | --------------------- | ----------------- |
| Chaos            | additional special exit                  | yes                            | selected Chaos room   | previous room set |
| G Anomaly        | replacement of an eligible normal target | no                             | selected Anomaly room | previous room set |
| Zagreus contract | additional supported-room exit           | yes                            | fixed `C_Boss01`      | previous room set |

The first and third features can share an additional-exit form. Anomaly needs a
target-replacement form. Both forms can share occurrence, lifecycle, history,
resume, validation, and selection infrastructure.

## Recommended Extension Contract

### Catalog

Introduce a finite detour declaration vocabulary only when implementation
starts. Each declaration must identify:

- stable detour key and player-facing label;
- concrete target room source;
- entry form: additional exit or normal-target replacement;
- supported source rooms, placement capability, or target eligibility class;
- requirement expression over modeled inputs;
- return policy;
- room lifecycle, reward, and encounter declarations;
- maximum appearance and other creation constraints.

Chance weights are game evidence, not authored state. The planner models
possible authored outcomes, not probability replay.

Detour rooms need concrete Room Declarations, but they are not new route
biomes. The catalog must separate a room's game room-set identity from the host
route-biome plan that owns its occurrence. Do not add fake `C`, `Chaos`, or
`Anomaly` route tabs merely to satisfy the current `biomeKey` field.

### Authored topology

Extend the existing outgoing decision boundary. Do not add a parallel detour
list detached from reachability.

For an additional exit:

- the source decision retains its normal lane, whether it is an empty envelope,
  a realized ordinary batch, or a complete takeover batch;
- the detour target is a real offered occurrence;
- the enclosing selection chooses one normal or detour continuation;
- an unpicked detour remains a real dead leaf, like an unpicked normal target.

For replacement:

- the physical normal exit remains the host exit;
- the created target is the detour occurrence, not a hidden normal occurrence;
- replacement provenance identifies the declaration and host exit;
- selection and reachability continue through the detour occurrence.

Every selected detour occurrence owns an outgoing resume decision. Resume
identity must point to the semantic host context, not an array index or a raw
`UsePreviousRoomSet` string.

### Simulation and history

Canonical materialization must emit observable facts in game order:

1. detour availability and target creation;
2. selection of normal or detour continuation;
3. detour-room entry and preparation;
4. its reward and encounter lifecycle;
5. its room-history and counter effects;
6. outgoing generation resumed under the host biome context.

The detour is not transparent history. Any room, encounter, reward, run-depth,
biome-state, or acquisition effect must be declared and emitted.

Normal-door takeover remains normal-door takeover. A generated Preboss can
take over normal doors without consuming or rewriting a separately declared
special exit. The Chaos probe confirms that the two can coexist and that an
unentered Preboss batch is not a reusable continuation. Exact source-map and
runtime configuration remain declaration-owned; the topology engine must not
infer them from rendered door order.

A `takeOverNormalDoors` Preboss is atomic across its complete declared
normal-exit set, even though the current editor enters the choice at the first
normal target. Engine evaluation validates every normal exit and the aggregate
creation cap before takeover is possible or required. A future special exit is
neither replaced, counted, nor selected by that policy.

### Validation and editing

Candidate evaluation must distinguish:

- source cannot physically host the special exit;
- source or target requirements fail;
- replacement target class is ineligible;
- detour appearance cap is exhausted;
- authored detour is possible but the selected continuation is unresolved;
- return context is structurally missing or contextually unavailable.

Commands should add/remove a declared detour and select its continuation as
semantic undoable edits. The UI can present “Add Chaos gate” or a
feature-specific equivalent, but UI terminology does not define the domain
shape.

## Implementation-Probe Order

### Probe 1: lifecycle and counter trace

Record one vanilla trace for each feature from source-room creation through the
first resumed host-biome target. Capture:

- room and encounter creation records;
- run, biome-depth, and biome-encounter-depth values;
- reward-store selection and acquisition;
- biome-state trait removal/restoration;
- physical exit identity;
- return-room-set selection.

This closes the meaning of “resume” before schema work.

### Probe 2: additional-exit control

Prove that a runtime adapter can deterministically:

- suppress natural appearance;
- create one requested Chaos or Zagreus exit only on a supported source;
- preserve normal-door generation;
- observe which continuation was taken;
- resume the correct room set.

### Probe 3: replacement control

Prove that Anomaly replacement can be forced or suppressed after normal-target
eligibility is known without creating or recording a phantom normal room.

### First implementation slice

Use one additional-exit feature as the vertical proof. Chaos is the richer
modeling proof; Zagreus is the narrower fixed-target proof. The slice must
include declaration normalization, authored topology, commands and codec,
simulation/history, candidates/findings, UI projection, and focused runtime
probe evidence before the feature is called supported.

Add Anomaly only after the common resume contract is stable. Its replacement
entry form should be an additive extension, not a rewrite of the additional
exit implementation.

## Open Questions

- Which current room declarations contain a usable `SecretPoint`, and is that
  map capability stable enough to normalize in the catalog?
- What exact counters and caches change in Chaos, Anomaly, and `C_Boss01`?
- Which source-map and runtime configurations can host each additional special
  exit beside a particular normal-door shape, beyond the confirmed
  Chaos/Preboss behavior?
- Which external save/profile predicates require explicit modeled inputs
  before natural eligibility can be validated?
- Is a detour's resumed outgoing reward store based on the host source, the
  detour reward, or another game-owned checkpoint?
- What is the smallest safe game adapter for forcing Anomaly replacement?

Unknown answers remain audit work. They must not become generic
`unsupported`, guessed defaults, or runtime-only repair.
