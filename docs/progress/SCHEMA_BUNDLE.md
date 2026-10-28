# Schema Bundle

Status: locked 2026-10-28. Base commit: `9e602a501`. One major bump,
`schemaVersion` 99 → 100, with a migration; owner-approved 2026-10-28.

## Objective

Correct three places where the authored model cannot represent what the game
does, so plans stay faithful and Record mode can import a run without
guessing around them. All three ship under one major bump and one migration.
The Record mode work that depends on them (O-room ship wheels, then the
special-trait pass) follows this plan.

Evidence: [schema bundle candidates](../investigations/SCHEMA_BUNDLE_CANDIDATES.md)
and the [save-file run record audit](../audits/rooms-and-routes/SAVE_FILE_RUN_RECORD_GAME_DATA_AUDIT.md).
The candidates investigation is deleted at closure once its facts are
promoted.

## Settled decisions

### 1. Preboss Contract pedestal

- The Zagreus Contract pedestal is a Preboss room feature, not a Shop offer.
  It spawns in every Preboss that declares a pedestal destination while the
  hero holds `InfernalContractBoon`, whatever the room's reward: the F, G, H
  and P boon forms and the N, O and Q Shop forms alike.
- Authored state, simulation, the execution plan and the game module move the
  pedestal off the Shop inventory onto the Preboss room. The Shop keeps its
  other offers unchanged.
- Migration: a pedestal authored on a Preboss Shop moves to that room's
  pedestal feature with the same choice; a boon-form Preboss gets the default.

### 2. N phantom exit

- Every visit to an `N_Combat*` or `N_MiniBoss*` main room or an `N_Sub*`
  side room authors its hidden return door: the **placeholder room** and the
  **reward type**. Rooms whose exit is linked (`N_Opening01`, `N_PreHub01`,
  `N_Story01`, `N_PreBoss01`, the bosses, `N_PostBoss01`, `N_Hub`) have none.
  Main-room placeholders come from the `N` room set, side-room placeholders
  from `N_SubRooms`. The draw is
  invisible in its own room (main-room side doors draw from the side-room
  stores in the same unlock; a side room's draw follows its parent's side
  doors), so it lives in the visit's Doors tab and has no timeline row. The
  main-room tab text "Continuation is owned by this room's local visits" is
  replaced by this control; side visits gain the same control.
- The simulation settles the draw at that visit's doors-unlock point (first
  visit only; revisits never draw), before the next main room's side doors,
  with the native side effects: store removal and refill, `RewardPriorities`,
  Devotion depth.
- The placeholder room's candidates come from the engine at that point:
  `ChooseNextRoomData` eligibility, forced rooms, and the creation caps
  (`N_MiniBoss01`, `N_MiniBoss02`, `N_Story01` count at creation). The
  planner's per-biome appearance cap does not apply: a visited combat room is
  a legal placeholder.
- The reward's store is the placeholder's (HubRewards for a combat room,
  RunProgress `Boon` for a Mini-Boss, its own side-room store for a side
  room). A forced placeholder (`N_Shop01`, `N_Story01`, `N_PreBoss01`, the
  bosses) draws nothing and has no reward choice.
- A Boon reward takes the first eligible god; the god is not authored (an
  offered, unentered boon leaves no state beyond its store entry).
- The game module steers it through its existing N door path, identifying the
  return door at runtime by name or `ReturnToPreviousRoomName`.
- The catalog declares the hidden door's first position in the unlock's door
  order (it sorts before the side doors natively), with a test.
- Migration: each existing N visit gets the default (first eligible room and
  reward).

### 3. Rerolls

- **Catalog:** every reroll source with its amount by rank and what it
  enables: `DoorRerollMetaUpgrade` (door and ship-wheel rerolls),
  `PanelRerollMetaUpgrade` (screen rerolls), `RerollTradeOffMetaUpgrade`
  (pool only), Narcissus F's reroll pickup when collected (2, 2, 3, 5 by
  rarity; Common outside Dream). Card amounts by rank: Door and Screen 1, 2,
  3, 4; TradeOff 2, 3, 4, 5. Card upgrades stop at Epic; Heroic comes only
  from a Circe rarity upgrade or grant. Mid-run grants (Judgment, Figurine,
  Circe) add the card's value; a Circe rarity upgrade adds the difference.
  While the Barren curse removes the arcana, no reroll kind is enabled; the
  pool is unchanged. Each offer screen declares whether it is natively
  rerollable; each destination room declares `ForceDoorAllowReroll` and
  `NoReroll` (`ClockworkGoal` rooms count as `NoReroll`).
- **Pool:** the simulation derives the run's reroll pool from those sources
  and every spend. Adding a reroll beyond the remaining pool is blocked (fixed
  budget rule); a preserved over-spend is a finding.
- **Door and wheel rerolls:** each door offer, Hub board door and ship-wheel
  offer holds an ordered **reroll chain**: the first draw, then each reroll's
  result; the last element is the offer. Every element is a real draw: it
  leaves its store, and its side effects apply. Each reroll's candidates use
  the normal door legality, excluding the reward being replaced and the other
  doors' current rewards, and cost 1. Only with `AllowDoorReroll`, and only
  where the native rule allows it: (the door's `AllowReroll` or the
  destination's `ForceDoorAllowReroll`) and not the destination's `NoReroll`
  and not a Shop reward. So N side and return doors, Story, Shop and Boss
  destinations never reroll, while O and Q exits into `O_MiniBoss01`,
  `O_MiniBoss02`, `O_Reprieve01` and `Q_BaseMiniBoss` do. First visit only:
  a restored door is never rerollable.
- **Fields cage doors:** one reroll replaces one cage's reward, the cage chosen
  natively at random (`RerollIndex`). Each step of a cage door's chain authors
  the cage slot and its new reward; candidates exclude every cage's current
  reward. The game module sets the slot before the native reroll runs. The
  dialog adds a cage-slot picker per row.
  The editor isolates rerolls so the door layouts, the Hub board above all,
  stay as they are. The Reward line of a Hub board door, ship-wheel offer or
  normal door gains a small reroll button (shown only when door rerolls are
  enabled and the door is rerollable, with the reroll count once there is
  one); the line itself keeps showing and editing the final reward. The button
  opens a dialog listing the chain, one picker per element over that step's
  candidates, with the remaining pool. Only the last element has **Reroll**
  (appends the next draw; disabled when the pool is spent) and **Remove**
  (drops it), so deletion is always explicit; editing an earlier element that
  invalidates a later one leaves the later one preserved with a finding.
- **Screen rerolls:** a count only, on the supported screens: the nine core
  Olympians, Hermes, Athena, Dionysus, Artemis, Chaos, Pom of Power, the Wells and the Pool
  of Purging. Not NPC screens, Hammers, Hermes Shrines, Selene or the World
  Shop. The button appears only when screen rerolls are enabled; k rerolls of
  one screen cost k(k+1)/2. The final rows stay authored as today; screen
  rerolls touch no store.
- Migration: no rerolls anywhere.

## Ownership

- **Hades II catalog:** reroll sources, amounts and gates; rerollable
  screens and doors; the hidden door's unlock position; the pedestal
  destination per Preboss (existing data moved where needed).
- **Planner engine:** authored shapes, codecs, defaults and commands for the
  pedestal feature, phantom exit and reroll chains and counts; the 99 → 100
  migration; simulation settlement of the pedestal, the phantom draw, the
  reroll pool and chain draws; candidates and findings; execution-plan wire
  revision; Record mode import of all three (phantom exits from
  `ExitDoorRooms`/`OfferedRewards`, the reroll count, chain contents solved
  from store diffs as for wheels).
- **Planner application:** Preboss pedestal UI, the Doors-tab phantom exit,
  reroll buttons and counts, projections; migration surfaced through the
  existing project-open path.
- **Game module:** decode the new wire; pedestal from the Preboss room (World
  Shop code); phantom exit steering; reroll steering: force the next chain
  element on a door or wheel reroll, and keep screen steering through native
  screen rerolls so the final screen shows the authored rows.

## Gates

0. **Research** (done; folded into the decisions above). A rerolled Hub
   board door draws from its room's own store with the generic door
   exclusions. Game module entry points: `AttemptRerollDoor`,
   `AttemptRerollShipWheel` and `RerollBoonLoot`, wrapped like the existing
   ship-wheel hook; the door-id map must outlive `DoUnlockRoomExits`;
   conformance checks the final reward, store state and `NumRerolls`, not
   press order. Screens install authored rows at the k-th native reroll and
   keep the Chaos scope alive across rerolls.
1. **Reroll catalog** (catalog only, no authored change): sources, amounts,
   gates, rerollable flags, hidden-door position. Equivalence and draft corpus
   run (catalog change).
2. **Pedestal** (engine, app, game module): the schema bump to 100 and its
   migration land here; later slices extend the same version and migration
   while unpushed.
3. **Phantom exit** (engine, app, game module).
4. **Rerolls** (engine, app, game module): pool, chains, screen counts.
5. **Import** (engine): Record mode maps all three; fixtures re-pinned.
6. **Closure:** fresh independent review (schema and protocol change), full
   `npm run check`, design and audit updates, candidates investigation
   deleted, live checklist in `docs/testing/` (door reroll, wheel reroll,
   screen reroll, phantom exit, pedestal in a boon-form Preboss), plan
   deleted. Nothing is pushed before closure.

## Tests

- Catalog: declaration and normalization for reroll sources, gates and flags.
- Engine: codec and migration (99 fixtures → 100), commands, settlement of the
  phantom draw and chains (store state, refill, priorities, Devotion depth),
  pool accounting and the budget block, candidates for placeholders and chain
  steps; execution-plan fixtures regenerated under their discipline. Existing
  tests are corrected rather than duplicated.
- App: the three controls at the UI adapter boundary.
- Game module: Lua suite for decoding and steering.
- Lanes per slice from the diff: `test:catalog`, `test:engine`,
  `test:planner`, `test:game-module`, `test:run-import`; equivalence and draft
  corpus for every slice (catalog and simulation change); performance compare
  once after gate 4.

## Non-goals

- Modelling RNG, intermediate screen-reroll rows, or reroll order across
  different screens.
- Rerolls on NPC screens, Hammers, Hermes Shrines, Selene or the World Shop.
- The O-room wheel solver and the special-trait import pass (next plans).
