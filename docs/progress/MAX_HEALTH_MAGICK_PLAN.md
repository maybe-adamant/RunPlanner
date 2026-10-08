# Max health and magick plan

Status: locked. Base commit: `c9e19eaa1`. Schema bump 92 → 93 approved by the
owner.

## Objective

Compute the player's max health and max magick deterministically at every
timeline point and show them in Run State. Effects of health and magick stay
unsimulated; this plan computes the two maxima only. Conformance and the
execution protocol are unchanged.

## Source facts

Native scripts: `1GameData/Scripts`.

- **Formula** (`RoomLogic.lua:601-668`, `TraitLogic.lua:372-395`), recomputed
  from the current trait list after every relevant change, so pickup order
  does not matter:

  ```
  M = round((50 + flat magick) × (1 + Σ(magick multiplier − 1)))
  H = round((30 + flat health + Σ conversion × ceil(M)) × (1 + Σ(health multiplier − 1)))
  H = max(1, H); White Antler active → H = 30
  ```

  Multipliers sum; they apply to base plus every flat source. `round` is
  `floor(x + 0.5)` once at the end; flat values keep fractions. Base values
  `HeroData.lua:6-8`.

- **Flat sources:**

  | Source                                                     | Amount                                            |
  | ---------------------------------------------------------- | ------------------------------------------------- |
  | Centaur Heart small / normal / large                       | +5 / +25 / +50 health                             |
  | Centaur Soul small / normal; Well `EmptyMaxHealthShopItem` | +10 / +25; +25 health                             |
  | Soul Tonic small / normal / large                          | +10 / +30 / +60 magick                            |
  | Ashes / Bones run-progress spawns                          | +5 health / +5 magick                             |
  | Silver Wheel, per loot equip                               | 50 / 75 / 100 / 150 magick by rank                |
  | Persistence                                                | 20 × {1, 1.5, 2, 2.5} health and magick           |
  | The Centaur grants                                         | recorded totals                                   |
  | Staff aspect                                               | 40 at V, 50 at VI magick                          |
  | Axe aspect                                                 | 50.1 at V, 60 at VI health                        |
  | Water Fitness                                              | 15 × current Water count health                   |
  | Chaos Soul / Mind blessing                                 | authored operands                                 |
  | Chaos Atrophic curse, while active                         | authored negative operand                         |
  | Traces of Spirit                                           | recorded totals                                   |
  | Worry Free                                                 | authored roll (50–80 / 70–100 / 90–120 / 110–140) |
  | Frinos / Hecuba familiar                                   | +10 health / +15 magick per stack                 |
  | Fight Fight Fight                                          | snapshot × current fraction                       |

- **Multipliers:** Spiritual Affirmation (×1.15/1.20/1.25/1.30, both stats);
  Word of Greater Girth (×1.15 health).
- **Conversion:** Uncanny Fortitude adds ceil(M) × 20/25/30/35% health.
- **Fight Fight Fight:** at acquisition adds StartFraction × the final maxima
  just before acquisition as a flat value; it then decays with the trait.
- **White Antler:** sets health to 30 while active (expires at the first boss
  cleared while active, or when unequipped).
- **Familiar:** equipped from the profile at run start; stacks = 1 + owned stat
  upgrades (0–3); Primal Psychic Connection doubles stacks.
- **Ashes/Bones +5** applies only to run-progress spawns: room rewards, the
  replayed last reward, Nemesis trades, Narcissus and Buried Treasure; never
  shop purchases (`InteractLogic.lua:869`).

## Planner assumptions

- Aspects are rank V; rank VI comes from the existing Premium Service fact.
- Keepsakes start at rank III; Gift Gift Gift's copy is rank I; Cherished
  Heirloom raises to IV (existing model).
- Ashes/Bones +5 reuses the Nectar route gate (`giftDropRunProgressLevel`,
  excluded on Fresh File).
- Empty max-health pickups count as ordinary max health.
- Current health is not computed.

## Authored additions (schema 93)

- Loadout familiar identity, required on mature routes and `null` on Fresh
  File. Familiars are assumed at the mature rank (3 upgrades, 4 stacks), like
  keepsake rank III; the rank is not authored. The catalog declares Frinos as
  the default.
- Worry Free option roll (`maxHealthRoll`), including Echo Boon Boon Boon
  rows, as an offset 0–30 above the acquired rarity's minimum; omitted means
  offset 0.

A v92 document migrates to v93 with Frinos on mature routes, `null` on Fresh
File, and Worry Free at its minimum.

## Ownership

- **Catalog:** every amount and rank table above; familiar declarations;
  run-progress Ashes/Bones bonus; Worry Free roll ranges.
- **Engine, authored model:** required familiar loadout field and Worry Free
  roll with codec, migration, defaults and commands.
- **Engine, simulation:** a max-stats authority that folds flat sources,
  multipliers, conversion, Fight Fight Fight snapshots and the Antler window
  from existing state, published in Run State. Silver Wheel grants counted per
  loot-equip event in keepsake state.
- **Planner:** Loadout familiar controls, Worry Free roll control, Run State
  maxima display.

## Gates

1. **Schema 93.** Familiar loadout field and Worry Free roll, codec,
   migration, commands, catalog declarations, Loadout and offer UI. Tests:
   codec round-trip and v92 migration, command witnesses, UI witnesses.
2. **Max-stats authority.** Formula, every source, Fight Fight Fight snapshot,
   Antler window, Ashes/Bones gate; Run State display. Tests: a formula matrix
   (each source, multiplier summing, conversion, rounding, Antler, minimum 1),
   Fight Fight Fight snapshot and decay, Silver Wheel per-equip grants, Ashes
   shop vs room reward; planner Run State witness. `test:equivalence`: the
   simulation digest changes; plan digests must not.

Each gate is one commit and closes with `npm run check`; the plan closes by
deleting this document.

## Docs

- A max-stats audit section owning the formula and source table.
- `AUTHORED_PROJECT_MODEL.md`: familiar and Worry Free fields; schema history.
- Keepsake, Arcana, Chaos and Dionysus audits: link their stat facts to the
  max-stats owner rather than repeating them.

## Non-goals

- Current health, healing, damage or Death Defiance.
- Conformance or execution protocol changes.
- The start-from-room feature.
