# Keepsake Execution Closure Plan

## Status

Locked on 2026-09-05 for implementation. This focused plan runs after the NPC
vertical closure and before Gate E commerce work in
[Layered Game Execution Coverage Plan](GAME_EXECUTION_LAYERED_COVERAGE_PLAN.md).

Starting commits:

- Run Planner: `1d7e61ab7ff9a708f60f06ee254cf1fc736a174c`
- Plan Executor: `ae74f02a3f631df80f924216457b178d58c5d93f`
- Modpack shell: `cd236a392ea429d61cbbcead8431775fbe808960`

The Run Planner worktree already contains the uncommitted durable keepsake
execution-audit consolidation in
`docs/audits/game-execution-contacts/KEEPSAKES_LOADOUT_AND_ABILITIES.md` and its
audit-index update. The executor and shell start clean. No implementation gate
may discard or silently reinterpret those audit edits.

## Objective

Close the complete 33-keepsake planner-to-game boundary without creating a
second keepsake simulator in Lua.

The completed product must make this distinction explicit and executable:

```text
planner models a keepsake consequence
  -> deterministic native behavior: let the game run
  -> later ordinary object/result: its normal owner realizes it
  -> authored volatile identity: steer only that native selector
  -> retained state changed: compare one complete native keepsake value
```

After closure, commerce work must not need to rediscover or add keepsake
semantics merely because a Shop, Well, Pool, or Shrine action changes a trait,
charge, or later reward.

## Owning authorities

- [Keepsakes, loadout, and abilities](../audits/game-execution-contacts/KEEPSAKES_LOADOUT_AND_ABILITIES.md)
  owns the exhaustive planner/native/executor disposition.
- [Keepsake game-data audit](../audits/loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md)
  owns ordinary equip, rank, swap, effect, and retained-state source facts.
- [Cherished Heirloom](../audits/loadout-and-progression/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md)
  owns rank-IV reconstruction and later-equip behavior.
- [Echo Gift Gift Gift](../audits/loadout-and-progression/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md)
  owns captured identity, replay schedule, source exclusions, and Common-rank
  replay behavior.
- [Olympian keepsakes and Moon Beam](../audits/loadout-and-progression/OLYMPIAN_KEEPSAKE_AND_MOON_BEAM_REWARD_PRESSURE_AUDIT.md)
  owns reward-pressure and Path-point rules.
- [Game execution Timeline reconciliation](../audits/rooms-and-routes/GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md)
  owns transaction binding, prerequisites, obligations, and room-exit
  conformance.
- [Game integration boundary](../design/GAME_INTEGRATION_BOUNDARY.md) owns the
  planner/compiler/executor dependency direction and mismatch policy.

Native contacts remain `EquipKeepsake`, `AddRandomHammer`,
`GiveRandomHadesBoonAndBoostBoons`, `AddRandomChaosBlessing`,
`AddRandomMetaUpgrades`, `UseHealthFountain`, `AddRarityToTraits`, the Fig Leaf
spawn handlers, and `AthenaUse` as recorded by the owning audit.

## Locked disposition of all 33 keepsakes

The catalog partitions exactly as follows:

| Group                              | Count | Execution disposition                                                                                                                                                                                                                   |
| ---------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation-neutral identities      |    13 | Common starting/rack identity only. Native health, Magick, Death Defiance, Gold, armor, damage, speed, and real-time behavior passes through and is not conformance state.                                                              |
| Olympian reward-pressure keepsakes |     9 | Native equip owns pressure and charge use. Navigation and the ordinary trait-offer adapter consume the planner-resolved door/provider/rarity; no keepsake actuator exists.                                                              |
| Moon Beam                          |     1 | Native pressure and point grant. Generic navigation and Path acquisition own later results; no Moon Beam actuator exists.                                                                                                               |
| Calling Card and Time Piece        |     2 | Native player interaction plus the existing room-exit charge ledger. Calling Card reuses final authored offer rows; Time Piece's destroyed acquisition is omitted at publication.                                                       |
| Effect-specific keepsakes          |     8 | Jeweled Pom, Experimental Hammer, Crystal Figurine, Concave Stone, Aromatic Phial, Gorgon Amulet, Transcendent Embryo, and Fig Leaf retain bounded adapters because the planner authors an exact volatile result or encounter decision. |

Cherished Heirloom is not a ninth effect-specific adapter. The ordinary trait
carrier realizes its selection, native `AttemptAdvanceKeepsake` /
`AdvanceKeepsake` performs the deterministic reconstruction, and the planner
already models the resulting charge, rank, or future-outcome change. Complete
keepsake conformance observes that state; Lua does not reconstruct it again.

## Target executor ownership

Introduce `src/mods/keepsakes/` as the one home for keepsake-specific effect
adaptation. This is not a new coordinator or generic effect registry.

The directory owns these bounded responsibilities:

- immediate equip-result steering shared by route start, a rack change, and an
  Echo replay;
- Concave Stone's scoped proc/residual state;
- Aromatic Phial's scoped fountain target;
- Fig Leaf and Gorgon encounter adapters;
- Crystal Figurine and Embryo automatic-result helpers; and
- complete native reading of `PendingKeepsakeEffects`.

Existing lifecycle owners remain authoritative:

- `loadout/hooks.lua` owns `StartNewRun`, `CreateNewHero`, and the common
  `EquipKeepsake` contact;
- the acquisition trait adapter owns the ordinary trait screen and terminal;
- encounter modules own encounter phases, boss defeat, and the shared Judgment
  / Figurine `AddRandomMetaUpgrades` contact;
- room feature interaction owns `UseHealthFountain`; and
- room conformance owns when a `keepsakeEffects` comparison is requested.

Those owners may invoke a narrow keepsake capability or install an effect
adapter, but they may not retain a second copy of the effect implementation.
No root `index.lua` barrel, mutable registry, keepsake-key switch, or manifest
is added merely to prove coverage.

## Gate A — Behavior-preserving keepsake ownership consolidation

### Outcome

All existing effect-specific Lua implementation becomes discoverable under
`src/mods/keepsakes/` while protocol, transaction, native behavior, and
coverage remain equivalent.

### Deliverables

- extract the Experimental Hammer, Jeweled Pom, and Embryo immediate-result
  scopes from `loadout/hooks.lua` into one equip-result adapter;
- move the complete Fig Leaf and Gorgon adapters out of
  `room/timeline/encounters/`;
- extract Concave Stone's state machine from the ordinary trait hook while
  leaving ordinary offer/menu ownership in the acquisition layer;
- isolate Figurine and Embryo automatic-result steering without duplicating
  the boss-owned Judgment hook or the encounter-phase resolver;
- extract the current keepsake-specific portion of the conformance reader;
- update composition imports and move only genuinely effect-primary tests into
  a focused `tests/keepsakes/` neighborhood; carrier integration tests remain
  with loadout, traits, encounters, and room interactions; and
- delete every superseded implementation block and obsolete file in the same
  commit.

Phial targeting, missing native retained-state fields, and Gift replay
publication are deliberately unchanged in Gate A. Movement must not smuggle a
behavior fix into the structural commit.

### Acceptance

- existing loadout, encounter, trait, automatic, conformance, protocol, and
  hook-composition tests pass unchanged in meaning;
- one composition witness proves every extracted adapter is installed once;
- no hook ID references a protocol version or temporary gate; and
- production growth is explained by moved boundaries and offset by deletion of
  the displaced code.

Commit boundary:

- Plan Executor: `refactor(executor): consolidate keepsake adapters`
- Modpack shell: pin the executor revision

No planner commit is expected for Gate A.

## Gate B — Current keepsake result and conformance closure

### Outcome

Every already-published effect-specific result is either steered at its exact
native selector or deliberately left native, and every named
`keepsakeEffects` conformance fact expands to a complete comparable native
value.

### Aromatic Phial

The existing `fountainUse.aromaticPhialTarget` is sufficient. No planner or
protocol addition is allowed.

When the exact fountain transaction begins, the adapter scopes the Phial-owned
`AddRarityToTraits` call launched by `UseHealthFountain` and supplies the
published hero trait through native `ForceUpgrade`. Native code still consumes
the keepsake use, applies the rarity, and presents the result. A missing target
or missing Phial-owned rarity contact records a mismatch without blocking
native input or substituting another trait.

The implementation must account for the native threaded call. It may retain a
bounded fountain scope until the exact Phial rarity terminal; it must not use a
global next-`AddRarityToTraits` guess or interfere with Steady Growth, Bridal
Glow, or another rarity carrier.

### Complete retained-state reader

The `keepsakeEffects` reader returns the full `PendingKeepsakeEffects` shape
whenever that sparse fact is named. It must retain the already-correct
Olympian, Calling Card, Time Piece, Fig Leaf, Gorgon, and Figurine readings and
add truthful native readings for:

- Jeweled Pom's active state and future level contribution;
- every active/expired Experimental Hammer instance and remaining uses;
- Aromatic Phial's pending/consumed use;
- Concave Stone's origin-independent pending/consumed use; and
- Transcendent Embryo's current marked blessing, rarity, magnitude, and clock
  progress.

Static planner provenance such as origin, acquisition identity, and authored
ordering may be copied from the expected conformance value only when native
state has no corresponding identity. Mutable status, uses, rarity, trait
presence, marked blessing, values, and progress must be read from the game.
The adapter may correlate expected rows to native traits; it must not infer a
new planner state or declare an authored outcome eligible.

### Acceptance

Primary executor witnesses cover:

- Phial upgrades the exact published target and leaves other rarity contacts
  untouched;
- no-target/no-active-Phial fountain use remains native and completes normally;
- a named conformance fact containing more than one simultaneous keepsake
  source is fully reconstructed rather than defaulting unrelated fields;
- two independently active Experimental Hammer instances remain distinct;
- pending and consumed Stone/Phial/Figurine states read exactly;
- Embryo transformation updates blessing identity, values, rarity, and
  progress.

Commit boundary:

- Plan Executor: `feat(executor): close keepsake effect conformance`
- Modpack shell: pin the executor revision

No authored schema, catalog, planner simulation, or UI change is expected.

## Gate C — Gift Gift Gift volatile replay publication

### Outcome

The planner's existing captured-identity and biome-start replay chronology
publishes only the exact volatile replay result that the executor must steer.
The executor reuses the ordinary equip-result adapter when native
`RoomLogic.lua` calls `EquipKeepsake` for that replay.

### Planner product

Add one closed biome-start keepsake-replay transaction only when the authored
replay has an immediate volatile result:

- Experimental Hammer: selected compatible Hammer or explicit exhausted
  result; and
- Transcendent Embryo: exact Common blessing plus magnitude values.

The transaction carries the captured keepsake key, the existing
`ExecutionKeepsakeEquipResults` value, the existing standard-before-combat
window that maps to the room-entered capability, one stable owner, and no
player-action semantics. It introduces no new lifecycle kind. The result is derived directly from the
planner's reached Echo replay event and authored result; the compiler does not
recompute schedule, eligibility, rank, or candidate domains.

Do not publish replay transactions for:

- the 13 simulation-neutral effects;
- Olympian reward pressure or Moon Beam;
- Calling Card or Time Piece refills;
- Fig Leaf, Stone, or Figurine, whose later volatile decision already appears
  at its ordinary downstream transaction; or
- Gorgon, Jeweled Pom, Discordant Bell, and Aromatic Phial, which native source
  rules exclude from Gift Gift Gift.

Those effects remain native and become visible through later ordinary products
or complete keepsake conformance.

### Executor reuse

- strict TypeScript and Lua codecs admit the one closed replay shape;
- the room session indexes the replay by semantic owner and captured keepsake
  identity rather than authored order;
- native biome-start `EquipKeepsake(..., { FromLoot = true, OverwriteSlot =
true })` binds that result;
- the same Hammer/Embryo selector used by route-start and rack equip realizes
  the exact result; and
- the replay transaction completes at the native equip terminal without
  changing the player's actual slotted keepsake.

The executor does not inspect Echo history, decide whether a replay is due,
recompute Common-rank values, or create the replay itself. A missing native
contact is a mismatch; native room initialization continues.

### Acceptance

Primary planner and executor witnesses cover:

- selected and exhausted Experimental Hammer replay publication;
- Transcendent Embryo replay publication with exact blessing values;
- strict codec rejection of misplaced or partial replay payloads;
- the native biome-start replay reusing the ordinary equip-result selector;
- one representative passive replay producing no executor transaction; and
- existing downstream Fig Leaf, Stone, Figurine, Olympian pressure, Calling
  Card, and Time Piece witnesses remaining unchanged rather than being copied
  into a Gift-specific suite.

Commit boundary:

- Run Planner: `feat(execution): publish volatile keepsake replays`
- Plan Executor: `feat(executor): realize volatile keepsake replays`
- Modpack shell: pin the executor revision

## Gate D — Durable closure

- update the keepsake execution audit from gaps to exact final dispositions;
- update the layered coverage plan so commerce begins from the closed keepsake
  boundary;
- absorb any stable implementation-independent rule not already present in
  the owning audit;
- delete this temporary plan once its useful knowledge is absorbed; and
- run one bounded full closure gate after narrow tests and review findings are
  stable.

Closure validation:

- Run Planner: focused execution/compiler tests during Gate C, then
  `npm run check` once at final closure;
- Plan Executor: full Lua tests, `luacheck`, smoke, and diff checks after each
  behavioral gate, with no planner suite rerun for executor-only remediation;
- Modpack shell: smoke/deployment preflight sufficient to prove the pinned
  executor revision; and
- one final bird's-eye diff review against the complete 33-keepsake audit,
  dependency direction, deletion expectations, and the no-second-simulator
  rule.

## Explicit non-goals

- simulating health, Magick, Gold, armor, damage, speed, Death Defiance, or
  real-time keepsake effects;
- manually applying deterministic native keepsake behavior;
- tracking Calling Card button presses or publishing Time Piece actions;
- recomputing god/Moon Beam reward pressure in Lua;
- changing keepsake selection, rack, rank-III baseline, Cherished Heirloom, or
  Gift Gift Gift planner semantics;
- enabling H/I/N/O/P/Q route structure as part of universal keepsake closure;
- introducing a generic effect language, registry, service locator, or
  keepsake-key dispatcher; or
- adding exhaustive tests whose only assertion is that removed/neutral code
  does not exist.
