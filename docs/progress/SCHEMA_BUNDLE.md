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
  room). A no-draw placeholder (`N_Shop01`, `N_Story01`, `N_PreBoss01`) draws
  nothing and has no reward choice; bosses and `N_PostBoss01` are never
  placeholders (`RequiresLinked`). An unpinned exit settles to `N_PreBoss01`
  in main rooms (no draw, no profile predicate) and the native set order in
  side rooms; its reward is the type every branch can draw with the most
  entries left on the scarcest branch. Creation caps count only rooms the
  plan creates (board doors left unopened are not modelled).
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
  rerollable (givers, the `StackUpgrade*` reward types for Pom of Power, shop
  profiles, the Pool of Purging feature); rooms declare
  `ForceDoorAllowReroll` and `NoReroll`, exits `AllowReroll`, and the `Shop`
  and `ClockworkGoal` reward types block door rerolls. The engine owns one
  query over these per-screen flags; a flag means the button exists, not that
  it is always usable (a screen with no options left blocks natively).
- **Pool:** the simulation derives the run's reroll pool from those sources
  and every spend. Adding a reroll beyond the remaining pool is blocked (fixed
  budget rule); a preserved over-spend is a finding.
- **Door, wheel and cage rerolls are a timeline action.** Rerolls of
  different doors interleave freely, and each reroll's candidates depend on
  every door's current reward at that moment, so per-door lists cannot
  represent them. A repeatable **reroll** room action, ordered in the room's
  action order after doors unlock (`outgoingGeneration`), names its target (an
  exit door, a ship-wheel offer, or a Fields cage door with its cage slot,
  which the game picks at random) and the new reward. Each instance has its
  own persisted identity, so findings stay attached when another reroll is
  removed. The authored door reward stays the first native draw with its
  existing picker and meaning; the simulation applies rerolls in action order,
  each a real draw (store removal, refill, priorities, side effects), and the
  target's current reward after the last reroll is what it offers onward: the
  next room's incoming reward, the entered reward, the wheel offers, the cage
  rewards.
- **Hub board rerolls** are reroll actions in the Hub's ordered actions, legal
  in any Hub stay for a board door not yet entered (an entered door is closed
  for the run). `RestoreUnlockRoomExits` re-assigns every unentered door its
  persisted offer (no store draw) and flags it again under the usual gate, so
  the card is checked at each stay's assignment; a press is a real draw that
  overwrites the persisted offer for later stays. On a restored board the
  press excludes the door's offer as that stay assigned it and the current
  rewards of the doors still open. Hub visits do not become occurrences.
- **Legality:** candidates use the normal door legality, excluding the
  target's original reward and every door's (wheel's, cage's) current reward;
  each costs 1 from the pool and needs `AllowDoorReroll`. A door is
  rerollable when (its `AllowReroll` or the destination's
  `ForceDoorAllowReroll`) and not the destination's `NoReroll` and not a Shop
  reward: N side and return doors, Story, Shop and Boss destinations never
  reroll; O and Q exits into `O_MiniBoss01`, `O_MiniBoss02`, `O_Reprieve01` and
  `Q_BaseMiniBoss` do. First visit only, except Hub board doors (above).
- **Editor (later):** this bundle lands the model and keeps today's editor
  working; a later projection and UI plan, with no schema change, adds one
  style for every reward-offering surface: a door-like section with the first
  draws followed by an ordered **Rerolls** list (row = target + new reward;
  append and remove at the end only; door lines read first draw → final).
  Normal rooms keep Room Doors and gain the list below the doors. O rooms move
  each wheel encounter into its own tab (e.g. Overview · Intro Timeline ·
  Intro Wheels · Combat 1 Timeline · Room Doors) holding offers, rerolls and
  the pick, keeping a read-only marker in the timeline if anything authored
  can follow the wheel in its phase. The Hub becomes one timeline with the
  required visits and fountain pinned, a board recap after each visit, and a
  Rerolls list in each gap. Screen-reroll counts get their controls there too.
- **Screen rerolls:** authored as a count only, on the supported screens: the nine core
  Olympians, Hermes, Athena, Dionysus, Artemis, Hades, Chaos, Pom of Power, the Wells and the Pool
  of Purging. Not NPC screens, Hammers, Hermes Shrines, Selene or the World
  Shop. Legal only when screen rerolls are enabled; k rerolls of one screen
  cost k(k+1)/2. The final rows stay authored as today; screen
  rerolls touch no store.
- Migration: no rerolls anywhere.

## Ownership

- **Hades II catalog:** reroll sources, amounts and gates; rerollable
  screens and doors; the hidden door's unlock position; the pedestal
  destination per Preboss (existing data moved where needed).
- **Planner engine:** authored shapes, codecs, defaults and commands for the
  pedestal feature, the phantom exit, the reroll room and Hub action and
  screen reroll counts; the pool; settlement of the pedestal, the phantom
  draw and rerolls in action order; candidates and findings; execution-plan
  wire revision; Record mode import of all three (phantom exits from
  `ExitDoorRooms`/`OfferedRewards`; rerolls in a canonical order from the
  count and store diffs, reported when orders are not outcome-equivalent).
  Migration transitions stay app-side (`apps/planner/src/persistence/`).
- **Planner application:** Preboss pedestal UI and the Doors-tab phantom
  exit; the 99 → 100 transition; keeping current projections working over
  the new action kind (no reroll editor yet).
- **Game module:** decode the new wire; pedestal from the Preboss room (World
  Shop code); phantom exit steering; reroll steering: wrap
  `AttemptRerollDoor`, `AttemptRerollFieldsDoor` (set `RerollIndex`) and
  `AttemptRerollShipWheel` to force the next authored reroll for that target,
  and keep screen steering through native screen rerolls so the final screen
  shows the authored rows. Conformance checks outcome state, not press order.

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
4. **Rerolls** (engine, game module, app kept working): pool, reroll room and
   Hub actions, screen counts.
5. **Import** (engine): Record mode maps all three; fixtures re-pinned.
6. **Closure:** fresh independent review (schema and protocol change), full
   `npm run check`, design and audit updates, candidates investigation
   deleted, live checklist in `docs/testing/` (door reroll, wheel reroll, Hub reroll
   on a later Hub visit,
   screen reroll, phantom exit, pedestal in a boon-form Preboss), plan
   deleted. Nothing is pushed before closure.

## Tests

- Catalog: declaration and normalization for reroll sources, gates and flags.
- Engine: codec and migration (99 fixtures → 100), commands, settlement of the
  phantom draw and reroll actions (store state, refill, priorities, Devotion depth),
  pool accounting and the budget block, candidates for placeholders and reroll
  steps; execution-plan fixtures regenerated under their discipline. Existing
  tests are corrected rather than duplicated.
- App: the pedestal and phantom-exit controls at the UI adapter boundary;
  existing projections over the new action kind.
- Game module: Lua suite for decoding and steering.
- Lanes per slice from the diff: `test:catalog`, `test:engine`,
  `test:planner`, `test:game-module`, `test:run-import`; equivalence and draft
  corpus for every slice (catalog and simulation change); performance compare
  once after gate 4.

## Non-goals

- Modelling RNG, intermediate screen-reroll rows, or reroll order across
  different screens.
- Rerolls on NPC screens, Hammers, Hermes Shrines, Selene or the World Shop.
- The reroll timeline editor, doors in the timeline and screen-reroll
  controls (a later projection and UI plan, no schema change).
- The O-room wheel solver and the special-trait import pass (next plans).
