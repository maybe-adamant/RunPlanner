# Shop purchases on the timeline

Status: locked 2026-10-05. Base: `55615abc`. Schema bump 90 → 91 approved by
the project owner on 2026-10-05.

## Objective

Shop-like features are authored in one pass: the overview holds only the
offered inventory, and everything the player does with it, including Travel
Deal, is authored on the room timeline. For the Hermes Shrine, rush moves onto
a new purchase action, so the timeline order of purchases becomes authored
data and decides which rushed purchase triggers the refill.

## Settled design

- **Overview.** Shrine slots show Item, Delay and Purchased. World Shop and
  Well inventories keep only their fixed slots. Delay stays editable on a
  rushed slot; it sets the gold price, which the game applies.
- **Shrine purchase rows.** Each purchased slot has a timeline purchase action
  with a Rush checkbox. A rushed purchase adds its own optional pickup row.
- **Shrine refill line.** The first rushed Shrine purchase in timeline order,
  when Travel Deal applies, shows a second line with the refill's Item, Delay
  and Purchased. A purchased refill gets its own purchase row with Rush. The
  line appears only when Travel Deal applies; there is no placeholder.
- **World Shop and Well Travel Deal line.** Shown under the first purchase row
  when today's rules allow a refill. Presentation only; rules and storage are
  unchanged.
- **Storage.** The refill stays stored on the feature (`travelDealRefill`), not
  on a purchase action. The line follows whichever purchase currently qualifies.
  A reorder that changes the refill's slot group keeps the authored item and
  marks it invalid, fixable on the line.
- **Travel Deal lost upstream.** The refill data goes dormant; the refill's
  purchase row and pickup become stale rows with a finding and a removal
  option, like any inactive delivery source.
- **Dependencies.** Each rushed pickup follows its purchase row. The refill
  purchase row follows the purchase that triggered it. Purchase rows use the
  window where Shrine purchases are scheduled today.
- **Deliberate simplification.** The game allows out-of-order sequences such
  as buy 3, buy 1, rush 3. The planner authors rush at purchase and orders the
  purchases (buy 3 rushed, buy 1), which reaches every equivalent outcome.

## Facts that fix the rules

- World Shop: every purchase sets the room's shared `FirstPurchase`
  (`StoreLogic.lua:356`, Shrine `SurfaceShopLogic.lua:356`), so Travel Deal
  works only when held on entry; the planner's `travelActiveAtEntry`
  (`rewards/shop/settlement.ts`) already models this.
- Wells: own first-purchase path and gate (`well-purchase.ts`); unchanged.
- Shrine refill: first rushed purchase with Travel Deal
  (`SurfaceShopLogic.lua:450-473`), refilling that purchase's own slot. The
  timing of the Travel Deal check is an open probe
  (`docs/investigations/SHRINE_TRAVEL_DEAL_GATE.md`). This plan keeps today's
  check (held on every branch at Shrine scheduling); the probe result swaps one
  predicate later and does not block any gate.

## Schema 91

- New room action reference
  `{ kind: 'purchaseHermesShrineOffer'; generationKey: HermesShrineGenerationKey; rushed: boolean }`
  in `roomActions.order`. Rush lives on the action.
- `HermesShrinePurchase` loses `rushed`; it keeps `delay`. Purchased means a
  `purchaseBySlot` entry exists (and, for the refill,
  `travelDealRefill.purchase`).
- Codec: exact decoding of the new action; closure requires exactly one
  purchase action per purchased generation and none for unpurchased ones; a
  rushed same-room pickup requires a rushed purchase action.
- Migration `apps/planner/src/persistence/project-90-to-91.{js,d.ts}`, chained
  in `projectDocumentLoader.ts` like `project-89-to-90`: for each Shrine, one
  purchase action per purchased slot in slot order (`first`, `secondLeft`,
  `secondRight`, then `travelDealRefill`), carrying the old `rushed` flag,
  inserted at the canonical purchase position before any of its pickups. This
  reproduces today's refill choice exactly.

## Ownership

Engine (`packages/planner-engine`): model, codec, defaults, commands
(`SetHermesShrinePurchase` no longer carries rush; new `SetHermesShrinePurchaseRush`
or equivalent on the action), room-action domain and state (purchase action
contribution, dependencies, stale rules), simulation (first rushed purchase in
timeline order replaces `firstRushedInitialGeneration` slot order), execution
assembly. Application (`apps/planner`): migration and loader, projection of
purchase rows and the Travel Deal line for Shrine, World Shop and Wells,
overview without rush and without the Travel Deal row, UI. Game module: only
if the purchase action reaches the wire; otherwise untouched.

## Gates

1. `feat(engine): author Shrine purchases and rush on the timeline` — schema
   91, action, codec, commands, domain, simulation ordering, migration and
   loader, execution assembly; fixtures regenerated; equivalence baseline
   rewritten only for entries whose authored shape changes, with plan digests
   unchanged unless a purchase transaction reaches the wire (stop and report).
2. `feat(planner): author Travel Deal on the first purchase row` — projection
   and UI for all three features; overview reduced to inventory.
3. `test(game-module): …` only if gate 1 put purchase transactions on the
   wire: decoder and conformance accept them; Lua witnesses.
4. Closure: AUTHORED_PROJECT_MODEL, REWARD_MODEL, ROOM_LIFECYCLE_MODEL,
   STRUCTURED_EDITOR_WORKSPACE, the acquisition audit (simplification
   recorded), live checklist entries; delete this plan.

## Tests

Engine primary owners: `test/authored-project/commands/hermes-shrine-delivery.test.ts`
(action, codec closure, commands), `test/simulation/hermes-shrine-inventory.test.ts`
(timeline-order refill source, stale on Travel Deal loss, reorder invalidating
the refill item), `test/authored-project/project-state.test.ts` (decode).
Migration: loader test with a schema 90 document carrying rushed and delayed
purchases and a refill, decoding to the same evaluation as before. App:
projection and UI witnesses for each feature's Travel Deal line, Shrine
purchase rows with Rush, overview without rush. Fixtures: the Shrine delivery
fixtures regenerate through their builders.

## Non-goals

Changing World Shop or Well refill rules, modelling gold or prices, executor
guidance of purchase order, deciding the probe.
