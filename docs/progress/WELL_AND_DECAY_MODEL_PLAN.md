# Stygian Well and decaying effects model plan

Status: locked. Base commit: `882463032`.

## Objective

Model three families the engine treats as simulation-neutral today, so that
the simulation state and Run State describe what the player actually holds:

1. Fight Fight Fight decays per room and is removed natively; the planner keeps
   it forever, which can desync trait-inventory conformance.
2. Stygian Well purchases gain existence and native clocks instead of the
   neutral drop.
3. Discordant Bell and Lion Fang gain their per-encounter values.

Effects stay unsimulated unless they already matter; this plan models
existence, remaining uses and deterministic values.

Conformance exists to keep the state at room exit faithful enough to guarantee
downstream legality, not to enforce every planned action. Neutral Well holdings
and keepsake values do not affect legality, so conformance and the execution
protocol are unchanged except where Fight Fight Fight corrects the expected
trait inventory.

## Source facts

Native scripts: `1GameData/Scripts`.

- **Fight Fight Fight** (`DiminishingHealthAndManaBoon`): `EchoIncreaseStats`
  sets `StatMultiplier = StartFraction` and `BlockDecay = true`
  (`EventLogic.lua:1739-1765`). `LeaveRoom` clears `BlockDecay` on the first
  departure, subtracts `Decay = 0.05` on each later one and removes the trait at
  `<= 0` (`RoomLogic.lua:4245-4261`). Floating point removes it on the 13th
  later departure at 0.6 and the 16th at 0.8.
- **Diminishing Dodge** (`DiminishingDodgeBoon`) decays per dodge and is removed
  by play (`PowersLogic.lua:4793-4800`).
- **Well clocks**: encounter uses decrement at the main encounter's end unless
  the room sets `IgnoreEncounterUses` (`RoomLogic.lua:2965-2976`); boss uses at
  a non-`SkipBossTraits` Boss encounter (`RoomLogic.lua:2940-2946`); room uses
  at every `LeaveRoom` (`RoomLogic.lua:4262`). Expired traits are removed.
- **Well items** (`StoreData.lua` RoomShop, `TraitData_Store.lua`,
  `StoreLogic.lua:1167-1226`, `ConsumableData.lua:944-1529`):

  | Item              | Native                                            | Uses / clock     | Seal-eligible |
  | ----------------- | ------------------------------------------------- | ---------------- | ------------- |
  | Chimaera Jerky    | `TemporaryImprovedSecondaryTrait`                 | 5 / encounters   | yes           |
  | Braid of Atlas    | `TemporaryImprovedCastTrait`                      | 5 / encounters   | yes           |
  | Ignited Ichor     | `TemporaryMoveSpeedTrait`                         | 8 / encounters   | yes           |
  | Witch's Mark      | `TemporaryImprovedExTrait`                        | 6 / encounters   | yes           |
  | Python Scales     | `TemporaryImprovedDefenseTrait`                   | 5 / encounters   | yes           |
  | Ferry Voucher     | `TemporaryDiscountTrait`                          | 6 / encounters   | yes           |
  | Danaid Dagger     | `TemporaryEmptySlotDamageTrait`                   | 6 / encounters   | yes           |
  | Charity Bottle    | `TemporaryHealExpirationTrait`                    | 4 / encounters   | no            |
  | HydraLite         | `TemporaryDoorHealTrait`                          | 3 / rooms        | yes           |
  | Breath of Eros    | `FirstHitHealTrait`                               | used by play     | no            |
  | Mist Veil         | `ManaOverTimeRefundTrait`                         | depleted by play | no            |
  | Splintered Shield | armor                                             | depleted by play | no            |
  | Centaur Soul      | `EmptyMaxHealthShopItem`, +25 max health, no heal | permanent        | no            |

  The Archaic Seal converts the next eligible direct purchase to 2 boss uses.
  A repurchase creates a new instance; a Fateful Twist result is never extended.
  Native `CurrentRun.WellShopPurchases` counts direct purchases.

- **Discordant Bell** (`EscalatingKeepsake`): `EscalatingKeepsakeValue` grows
  by `GrowthPerRoom` (0.005 × rarity factor) at each qualifying encounter end
  (`RoomLogic.lua:2981-2996`); it stays after a mid-run swap
  (`KeepsakeLogic.lua:190`).
- **Lion Fang** (`DecayingBoostKeepsake`): starts at
  `InitialKeepsakeDamageBonus` on equip and rank-up, decays by 0.05 per
  qualifying encounter end and clamps at 1, marking the keepsake expired
  (`KeepsakeLogic.lua:133,341`; `RoomLogic.lua:2979-2987`). The rarity-to-initial
  mapping is verified in Gate 4 before implementation.

## Decisions

- Centaur Soul is acquired under its own name `EmptyMaxHealthShopItem` with the
  empty max-health effect. Kiss of Styx is corrected to `LastStandShopItem` in
  the same gate.
- Well conformance keeps today's legality subset: Ferry Voucher and Danaid
  Dagger offer gates, Spark, Yarn, Hymn and the Archaic Seal. New timed
  holdings, the ledger and Centaur Soul are not checked or published.
- The purchase ledger counts every direct Well purchase, mirroring
  `WellShopPurchases`.
- Charity Bottle's expiry heal stays unsimulated.
- Bell and Fang values appear in Run State only.

## Ownership

- **Catalog** (`declarations/rewards/shops.ts`, `types.ts`): each RoomShop
  option declares a grant instead of the closed `effect` union:
  `timedTrait` (trait key, initial uses, clock, stacking), `charge`,
  `consumable` (acquisition name), `ledger`, `immediate`, `twist`. The Seal
  declares its eligible keys and boss extension.
- **Engine, Well** (`simulation/commerce/stygian-well.ts`): owns the substate.
  `discountUses`/`emptySlotUses` become one timed-instance list; Spark, Yarn,
  Hymn and Seal charges stay; a purchase ledger is added. Clocks advance only
  at `encounterEndEffectsApplied`, `bossDefeated` and `roomExited`. The
  Well conformance fact and execution diagnostics are projected from the
  legality subset only, so ticking neutral buffs neither selects the fact nor
  changes the wire.
- **Engine, traits** (`simulation/traits`): Fight Fight Fight decay progress
  and removal at `roomExited`.
- **Engine, keepsakes** (`simulation/keepsakes/state.ts`): Bell and Fang values
  at `encounterEndEffectsApplied` with the existing `skipRoomsPerUpgrade` gate.
- **Planner**: Run State presentation sections for Well holdings and keepsake
  values.
- **Game module**: Diminishing Dodge joins the disposable trait list; no other
  module change.

## Gates

1. **Fight Fight Fight.** Decay and removal in trait history; Diminishing Dodge
   disposable in the module. Done: `45c84c91e`, `bef3a0576`; equivalence
   unchanged because no corpus route selects the trait.
2. **Native departures.** Ephyra restored-room departures (a parent room after
   a side room, every Hub departure after the first, and the Hub handoff) run
   native `LeaveRoom` but have no `roomExited`. Add one departure contact for
   every native `LeaveRoom`, separate from `roomExited` so room closure does
   not repeat, and advance every room-departure clock there: the Chaos
   `locations` clock and Fight Fight Fight decay, then the Well rooms clock.
   Capture each Hub departure's inventory before its departure. Tests: a
   departure-count matrix across Hub visits, side rooms and the handoff;
   Fight Fight Fight decay through Ephyra. `test:equivalence` changes only if
   a corpus route carries a room-clocked effect through Ephyra.
3. **Well model.** Catalog grants, engine substate with the rooms clock,
   Centaur Soul and Kiss of Styx identities, legality-subset conformance
   projection, Run State section, Well docs. Tests: catalog grant
   normalization; engine clock matrix (encounter, rooms, boss, Seal pairing and
   HydraLite rooms→boss on the gate 2 departure contact, repeat instances,
   Twist not extended,
   `ignoreEncounterUses`, room clock on revisits); a witness that a ticking
   neutral buff selects no Well conformance fact. `test:equivalence`: the
   simulation digest changes; the encoded plan digests must not.
4. **Bell and Fang.** Keepsake values, Run State display, keepsake audit.

Each gate is one commit with its primary tests and closes with
`npm run check`; the plan closes with deleting this document.

## Docs

- `ROOM_FEATURES_GAME_DATA_AUDIT.md`: Well disposition, HydraLite revisits,
  Charity Bottle not Seal-eligible, Twist results never extended or stacked.
- `REWARDS_AND_ITEMS.md`: move items out of the simulation-neutral row.
- `N_GAME_RULES.md:319`: remove the stale suppressor discrepancy.
- `KEEPSAKE_GAME_DATA_AUDIT.md`: Bell and Fang dispositions.
- Trait audit owning Echo traits: Fight Fight Fight disposition.

## Non-goals

- Simulating buff effects, heals, damage or armor.
- Play-dependent state: Breath of Eros use, Mist Veil pool, armor left,
  Diminishing Dodge value.
- Other over-time effects (White Antler, Knuckle Bones, Medea, Centaur Arcana,
  Hades boss boon, Eris).
- Any start-from-room feature.
