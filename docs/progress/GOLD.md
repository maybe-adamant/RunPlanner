# Gold

Status: locked 2026-10-30. Base commit: `6e594080a`. No authored
schema change, no plan-wire or execution-plan change, no run-record change.

## Objective

Each purchase in a plan shows its price and the chance that the run has
enough gold for it. The
chance is guidance only: it never blocks an edit and is never a finding.

The model is deliberately approximate and mostly catalog data: exact prices,
exact fixed gold, and an encounter-gold estimate whose spread drives the
percentage.

## Settled decisions

1. **Guidance, not legality.** Affordability is a derived engine product, not
   a finding, and never disables a control. Legality keeps its
   sufficient-resource assumption.
2. **No authored state.** No sliders or recorded amounts: rolled prices, sale
   values and drops are random terms of the estimate. Projects keep loading
   unchanged and gain prices and percentages.
3. **Gold stays out of chronology.** It is a lazy, memoized query over a
   published `ProjectEvaluationAssembly`; it does not enter `SimulationState`,
   `resourceGains`, the branch merge key or equivalence digests.
4. **Player assumptions.** The player kills every enemy, picks up every
   authored reward, and does not open challenge switches. Arachne's costume
   gold and Selene's per-cast gold are not counted (not plannable); the
   percentage is conservative for runs that use them.
5. **Display.** One number per purchase, "N% affordable" =
   P(income so far − earlier spending ≥ price), assuming every earlier
   purchase is made. Rooms show their spending. Past an invalid or incomplete
   cut the value is unavailable, not 0.
6. **Enemy gold = cap × payout.** The cap is exact game data: the
   encounter's store (native uniform draw plus the run-depth ramp, × Σ).
   Gold paid given the cap has two forms:
   - **Known roster** (fully determined authored customization, imported
     waves, fixed-roster encounters; gate 3b): per-kill drop chance and parcel
     range from catalog drop data, summed and capped by the store plus the
     crossing overshoot, computed in closed form.
   - **Unknown roster** (gate 3a): a biome-wide payout policy, expected gold
     as a fraction of the cap with a residual spread and expected kills.
     These are tuning constants, seeded from the simulation spike and the
     observed saves, and re-tuned from recorded runs with a development tool.
     Where the simulation and observation disagree, observation wins (I and H
     use about 1.2 with a capped spread).
     Minibosses use per-encounter constants; Heracles combats pay a flat 100
     bounty (unmultiplied) plus their store drops; bosses, story encounters and
     Chaos rooms pay nothing; the Anomaly pays its store plus a constant
     overshoot.
7. **Run modifiers adjust the model.** `encounterGoldRange = p` fixes the store
   at `floor((100·min + p·(max−min) + 50)/100)` with no store variance.
   `enemyGoldDropChance = q` selects the paid fraction calibrated at q = 25,
   50, 75, 100 (interpolated); q = 0 and Pauper's pay nothing. The gold
   multiplier Σ scales the mean and Σ² the variance.
8. **Draft is revisited after this feature ships.** It keeps
   `purchasesPerBiome` until then. Its spec decodes tolerantly, so a later
   gold-driven option needs no schema bump (new share-code tag).
9. **Not in scope:** importer use of gold, Record mode gold capture, rushed
   Shrine delay inference (a buy-and-rush total is independent of the delay).

## Source facts

Everything below is from the current game scripts; the audit update in gate 1
and 2 records citations.

### Prices

- Price = `round(base × M)`, `round = floor(x + 0.5)`, rounded once.
- `M = Vow × (Voucher − TravelDeal)`:
  - Vow of Debt (`ShopPricesShrineUpgrade`) 1 / 1.4 / 1.8;
  - Ferry Voucher (`TemporaryDiscountTrait`, 6 encounters) 0.7, else 1;
  - Travel Deal (`RestockBoon`) 0.05 / 0.10 / 0.15 / 0.20, subtracted, only
    on the room's first purchase. The shop reprices after it.
- No other price modifier exists.
- Hermes Shrine:
  - order = `round(round(base × M) × D[delay])`, D = 1.3, 1.2 … 0.6 for
    delay 1–8;
  - speed-up = `round(base × M × 1.5) − order`, repriced after the first
    purchase. A buy-and-rush action pays order at `M_first` plus speed-up at
    `M_after`.
- Base costs are fixed. Some come from the shop entry's `Cost` override:
  StackUpgrade 100 / 300, Hermes 500 in I/Q.
- Four Well items price from a rolled amount (uniform): Life Essence 21–39,
  Exhumed Remains 40–80 (step 2), Dust Parcel 30–60 (step 5), Faint Flicker
  20–30.
- Champion Item and Echo items are free.

### Gold multipliers

- `Σ = 1 + Σ(MoneyMultiplier − 1)`, additive:
  - Quick Buck 1.2 / 1.3 / 1.4 / 1.5;
  - Chaos Affluence, rolled at grant: Common 1.4–1.6, Rare 1.8–2.2,
    Epic 2.2–2.8, Heroic 2.6–3.4 (authored `blessingValues`).
- Buried Treasure `MoneyRewardBonus` (MRB) 1.5 / 1.75 / 2.0 / 2.25.
  - It is additive with Σ: reward money pays `round(base × (1 + (Σ−1) + (MRB−1)))`.
  - It applies only to non-NPC money consumables (room rewards, Well and shop
    money items, its own drop).

### Fixed and bounded gold

| Source                                       | Gold                                                                                                                        | Multiplier             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Money rewards Tiny / Small / normal / Triple | 20 / 50 / 100 / 300                                                                                                         | Σ + MRB                |
| Quick Buck pickup                            | one 100 drop                                                                                                                | Σ (incl. itself) + MRB |
| Buried Treasure pickup                       | 50 + 2 × 20                                                                                                                 | Σ + MRB (incl. itself) |
| Narcissus                                    | 100 / 100 / 150 / 250 by rarity                                                                                             | Σ                      |
| Fallback Gold                                | 90                                                                                                                          | Σ                      |
| Boatman Arcana starting gold                 | 200 / 250 / 300 / 350                                                                                                       | none                   |
| Gold Purse at run start                      | 100 / 125 / 150 / 200                                                                                                       | none                   |
| Gold Purse equipped mid-run                  | same amounts, once per equip                                                                                                | Σ                      |
| Time Piece conversion                        | the reward's `GoldifyValue` (+150 boosted)                                                                                  | Σ                      |
| Personal Loan                                | takes all held gold; after the next non-final boss pays held + 300 / 400 / 500 / 600                                        | none                   |
| Nemesis bet                                  | bet = min(100, held); win +round(bet × Σ), loss −bet, tie 0                                                                 | Σ on win               |
| Pool of Purging sale                         | rarity range floored to 5 (Common 30–50 … Legendary 400–450, Duo 250–270, Elemental 100–130) + 20 per level above the first | none                   |
| Price of Midas (Well)                        | round(U(1.1, 1.8) × U(10, 30))                                                                                              | Σ + MRB                |

`GoldifyValue` by reward:

| Reward                 | GoldifyValue    |
| ---------------------- | --------------- |
| Boon                   | 400             |
| Hammer, Selene         | 500             |
| Pom                    | 300 / 400 / 500 |
| Health, magick, talent | 150–400 by size |
| Resources              | 200             |
| Consolation            | 150             |
| Default                | 100             |

The eligible set is confirmed per reward in gate 2.

### Encounter money store

- Generated encounters draw `ceil((U{min..max} + depth × ramp) × Σ)`. Every
  kill drop drains the multiplied store, so the payout is about the store (no
  double count).
- Σ and depth are those at the door into the room: all encounters of a room
  are generated when the previous room's door is taken. Challenge, Nemesis
  and spawned sub-encounters generate when they start.
- Store caps:

| Encounter group                          | Store caps                                        |
| ---------------------------------------- | ------------------------------------------------- |
| F, Chaos                                 | 10–15, depth ramp +0.5                            |
| G                                        | 15–25                                             |
| H                                        | 30–45                                             |
| H passive                                | 10–30                                             |
| I                                        | 35–45                                             |
| N                                        | 15–25                                             |
| O                                        | 20–30                                             |
| P                                        | 25–35                                             |
| Q                                        | 60–85                                             |
| Devotion                                 | 20–30                                             |
| Artemis, Athena, Icarus, Nemesis combats | 30                                                |
| Heracles P                               | 100–145                                           |
| Minibosses                               | 15 or 25 (P dragon 15–25; Q brute inherits 60–85) |
| Bosses, story and unique encounters      | no store, and their enemies drop nothing          |

- Hard-encounter overrides never touch the caps.
- Medea (`MoneyOnDeathCurse`):
  - 10% per kill × luck;
  - cap 2 per room, shared by the room's encounters;
  - 20 / 30 / 40 / 60 by rarity × Σ.
- Urns, per room, × Σ:
  - expected about 1.8 gold in F, G and Chaos; 3 in I; 6 in N; 10 in P;
    13 in Q; 0 in H and O;
  - I_MiniBoss02 about 190.

## Chosen simplifications

- **Encounter gold.** The store is a cap: payout = min(store, drops). Drops
  exhaust it in F–I (observed: drained = gained in 140/150 rooms) but not in
  Q (observed mean 42 against a store mean of 73), and only marginally in N, O
  and P. The per-biome paid fraction captures this. Its witnesses are the observed
  per-biome means (F 18, G 35, I 49, N 19, Q 42).
- **Normal approximation over the route.** Each term contributes a mean and
  variance:
  - encounter gold: store variance × fraction² plus the residual spread, all
    × Σ²;
  - rolled prices and sale values are uniform on their step;
  - Chaos Affluence's roll is taken from authored values;
  - Medea is `E[min(Binomial(kills, 0.1 × luck), 2)]` per room, with kills
    from the per-biome expected kills;
  - urns use the per-room constants above.
- **Collection rate.** Medea drops and urns are counted at 70% collection;
  everything else at 100%.
- **Personal Loan and Nemesis** use the estimated balance at that point.
  - The Loan moves the whole balance distribution to the payout.
  - The Nemesis bet uses min(100, mean balance).
- **Branch agreement.** Rarities, outcomes and purchases are authored, so the
  gold inputs agree across reached branches (source possibility branches
  differ in identity, not in gold). A divergence is an engine contract
  failure: the query throws so it is investigated, never averaged.
- **Quick Buck's re-multiplying of already-spawned money** is ignored. It is a
  same-room edge case.
- **Engine estimate policy.** The constants (paid fractions, residual spread,
  expected kills, miniboss and Heracles constants, 70%, urn table, Medea) live in the
  engine, not the catalog, and the design doc names them as bounded
  approximations.

## Ownership

- **Catalog** (`packages/hades2-catalog`, schema in
  `planner-engine/src/catalog-schema` and `reward-kernel/model.ts`):
  - per-option `cost` on shop entries, fixed or `{min, max, step}`;
  - Shrine delay factors and rush multiplier on the SurfaceShop profile;
  - a `shopPriceMultiplier` effect on the Vow;
  - `priceMultiplier` on the Voucher grant;
  - `goldGrant` on money acquisitions, with producer overrides;
  - Arcana `startingGoldByRarity`, a Gold Purse keepsake effect and Time Piece
    gold values;
  - Quick Buck multiplier and Buried Treasure MRB by rarity;
  - Personal Loan payback by rarity;
  - Pool of Purging sale ranges;
  - encounter `moneyStore` beside the generation budget;
  - Medea curse gold.
- **Engine:**
  - Settlements publish a per-purchase and per-sale price context on
    `BiomeRewardSimulation`: owner action, item, first paid purchase, active
    discounts, Vow rank, Travel Deal rarity, sold rarity. It is facts only,
    outside the merge key.
  - A new `simulation/commerce/gold/` neighborhood computes prices, the
    ledger and the estimate.
  - `goldLedgerForProjectEvaluationAssembly(assembly)` is exported from
    `./simulation` (the read-only query tier) and memoized per biome rewards
    like `run-state-query.ts`.
  - The query reads run modifiers through `routeRunModifiers`.
- **Application:** the structured-workspace projection adapts the ledger. A
  purchase row gets price and affordability; the room gets its spending. Labels
  and percent formatting belong to the app.

## Gates

Each gate is one vertical slice that lands its engine export with its editor
consumer.

1. **Prices.**
   - Scope: catalog costs and price modifiers; engine price context and price
     computation; editor price on purchase rows and room spending.
   - Audit: record the price facts in the reward and room-feature audits.
   - Lanes: `test:catalog`, `test:engine`, `test:planner`, `test:ui`.
   - `test:equivalence` before and after, because settlement publication is
     touched.
2. **Fixed gold ledger.**
   - Scope: catalog gold grants and gain multipliers; engine ledger and
     balance; editor room balance.
   - Lanes: `test:catalog`, `test:engine`, `test:planner`.
3. **Estimate and affordability (3a).**
   - Scope: catalog money stores and Medea; engine cap, biome payout policy
     and constants, run-modifier knobs, Medea and urns, normal approximation
     and `affordableProbability`; editor "N% affordable", with placement
     iterated by screenshots (price beside the item name, percentage in the
     right column; picker prices only if they reuse candidate context
     cheaply); the development tool that derives policy constants from
     recorded runs.
   - Lanes: `test:catalog`, `test:engine`, `test:planner`, `test:ui`.
   - Performance snapshot before and after if rebuild or edit latency moves.
4. **Known-roster payout (3b).**
   - Scope: catalog per-enemy drop data (with resolved inheritance and native
     draw weights); engine closed-form payout for fully determined rosters,
     replacing the biome policy there. No display change.
   - Lanes: `test:catalog`, `test:engine`.

Docs:

- `REWARD_MODEL.md` §deferred prices becomes the price model.
- `SIMULATION_AND_VALIDATION.md` names the query as non-finding guidance.
- `ENGINE_CONSUMERS.md` lists the query.
- `CATALOG_MODEL.md` describes the new fields.
- `EDITOR_MODEL.md` describes the presentation.
- Each doc changes in the gate that changes its model.

## Tests

- Catalog: field normalization and spot values against the audit tables.
- Engine:
  - price matrix: Vow × Voucher × Travel Deal first or later purchase; Shrine
    order, rush and Travel Deal; rolled items;
  - ledger sources;
  - estimate moments against hand-computed rooms;
  - run modifiers;
  - unavailable past coverage.
- App: projection witness for a purchase row and a room.

## Non-goals

- Runtime drop simulation or a generated encounter table.
- Hard-encounter status (the engine prepares encounters as non-hard; caps do
  not differ).
- Challenge switches, Arachne costume gold, Selene per-cast gold.
- Importer or Record mode gold.
- Any authored field.
- Draft steering changes.
