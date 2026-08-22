# Boon Rarity Ledger Implementation

## Status

Locked delivery plan grounded on clean base
`d060fc0567bac93ee4aa9540a597c80424c2b7e5`. The plan was checked against the
source-complete boon-rarity audit, the normalized trait/room/Shop/Arcana
catalogs, chronological trait and Arcana state, exact Shop generation
witnesses, trait-offer candidate artifacts, the contextual rarity picker,
Run State, and the schema-50 checkpoint corpus. Independent adversarial review
found no remaining P1/P2 correction.

This is a temporary implementation plan. It must not be linked from the README
or stable design documents. At closure, absorb the completed model into the
smallest durable authorities and delete this file.

Owning evidence and stable authorities:

- [`BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md`](../audits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md)
- [`I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md`](../audits/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md)
- [`ARCANA_AND_FEAR_GAME_DATA_AUDIT.md`](../audits/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md)
- [`TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`](../audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md)
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md)

## Objective

Introduce one engine-owned numeric rarity ledger at each fresh Olympian or
Hermes trait-offer frontier. It answers only the deterministic authoring
question:

```text
Given this exact reached history, room, generated reward item, provider, and
trait declaration, which fresh rarities remain possible?
```

The user-visible result is:

- impossible rarities are unavailable in the existing contextual rarity
  picker;
- a retained impossible authored rarity remains visible, receives precise
  feedback, and can be repaired normally;
- Q Miniboss Common offers are rejected because the room guarantees at least
  Rare, while F/G/H/I/N/O/P Miniboss Common remains possible where the Rare
  check is below one;
- ordinary and boosted I/Q World Shop items use their exact generated-item
  rarity profile rather than the Shop or biome name;
- active Excellence, The Queen, Divinity, and Proper Upbringing compose with
  the provider and source ledger; and
- Duo and Legendary stay optional high-tier outcomes. A positive chance makes
  them possible, never mandatory in the three-option offer.

The planner continues to model possibility rather than probability. It does
not roll rarities, persist a random seed, normalize percentages, or predict
which possible rarity the game will choose.

The ledger is not chronological state. Every trait-offer frontier derives it
afresh from the immutable reached branch: provider facts, exact room/reward
source, active Arcana, and active trait effects. Chronology owns only the facts
that already matter independently. Activating, removing, suppressing, or
reactivating an effect changes the next derived ledger without a ledger update,
reset, migration, or repair transition.

## Source facts and chosen planner representation

### The source is an ordered chance ledger

The supported checks are ordered:

```text
Common -> Rare -> Epic -> Duo -> Legendary
```

Common is the initial result and has no numeric entry. The provider bases are:

| Provider | Rare | Epic |  Duo | Legendary |
| -------- | ---: | ---: | ---: | --------: |
| Olympian | 0.10 | 0.05 | 0.12 |      0.10 |
| Hermes   | 0.06 | 0.03 | 0.00 |      0.01 |

The game performs independent ordered checks. Values do not sum to one and
must not be normalized. Later successful supported checks overwrite earlier
ones.

For one trait's exact declared fresh-rarity domain:

- a non-Common rarity is possible when its assembled chance is greater than
  zero and every later supported check can fail;
- Common is possible only when every supported non-Common check can fail;
- a value at or above one is guaranteed and therefore makes Common and any
  earlier supported result impossible unless a later supported check succeeds;
- a value at or below zero is impossible; and
- an unsupported rarity never becomes possible merely because its ledger
  value is positive.

Heroic is not a fresh roll and is not a ledger check. It remains available
only through existing exact transitions such as a legal replacement,
Calling Card rarification, Bridal Glow, Gorgon, or another source-owned
override.

### Override and modifier precedence is closed

The exact assembly order is:

```text
provider base
  -> current-room sparse override, when present
     otherwise exact generated-item sparse override, when present
  -> active additive contributions
  -> active multiplicative contributions
```

Room and item overrides are alternatives. A sparse override replaces only its
declared keys; every missing key falls back to the provider base. Additive
values apply before multiplicative values. The engine does not clamp the
result.

Use one small closed numeric vocabulary and one explicit fact product:

```text
checks        = Rare | Epic | Duo | Legendary
provider base = complete check -> number
override      = sparse check -> number
contribution  = additive or multiplicative sparse check -> number

BoonRarityFacts
  provider base
  contextual override = room override, otherwise boon-source override
  active Arcana contributions
  active trait contributions
```

This is not a generic trait-effect language. Catalog declarations name the
few supported sources directly, and simulation supplies their active values
at the exact offer frontier.

The pure ledger query does not switch on provider identity. The catalog-facing
adapter resolves the current provider to its numeric base before constructing
the facts. This slice normalizes only the audited Olympian and Hermes bases;
Chaos trait-roll construction remains owned by its later implementation plan.

The conceptual grouping above is not the arithmetic application order.
Assembly first resolves the base/override, then sums every additive Arcana and
trait contribution, then applies every multiplicative contribution. In
particular, Excellence's Legendary multiplier must see future additive Favor
or Yarn values rather than running before them.

### Arcana contributes its resolved active rank

Normalize all four source-declared ranks even though current authored Arcana
state reaches only permanent rank III and Circe-Lapis rank IV:

| Card       | Rank I                          | Rank II                         | Rank III                        | Rank IV                         |
| ---------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| Excellence | Rare `+0.30`; Legendary `x1.30` | Rare `+0.40`; Legendary `x1.40` | Rare `+0.50`; Legendary `x1.50` | Rare `+0.60`; Legendary `x1.60` |
| The Queen  | Duo `+0.06`                     | Duo `+0.08`                     | Duo `+0.10`                     | Duo `+0.12`                     |
| Divinity   | Epic `+0.05`                    | Epic `+0.10`                    | Epic `+0.15`                    | Epic `+0.20`                    |

Do not add rank-I/rank-II Arcana authoring. The catalog records the complete
source matrix; simulation consumes only ranks already reachable through the
existing Arcana/Circe state.

### Proper Upbringing remains a chronological trait effect

Proper Upbringing owns two related but distinct transitions:

1. on inactive-to-active transition, promote each eligible equipped Common
   god trait to Rare; and
2. while active, add `Rare +1` to eligible future Olympian and Hermes offers.

The numeric ledger replaces the old special-case fresh-offer floor check. The
ledger itself is never activated or deactivated. The existing chronological
trait fold derives whether Proper Upbringing is active; the next offer simply
includes or omits that contribution. Preserve the active-Proper fact needed by
the promotion transition and by Echo Boon Boon Boon's selection-time
Common-to-Rare correction.

Retire the generic derived name `minimumScalableGodTraitRarity` in favor of an
exact active-Proper-Upbringing fact. The future-offer ledger consumes that
fact; Echo consumes it only for its existing special selection-time rule.
Deactivation removes the future additive contribution but does not undo past
promotions. Reactivation performs another promotion pass exactly as today.

Run State must not display a global final rarity ledger because provider,
room, and item are unknown there. It may retain one engine-derived
`Proper Upbringing active` status and the existing Arcana rank/origin rows.
It must not calculate or display chance percentages.

### Miniboss rarity is a room fact

Normalize the audited sparse room overrides on the exact room declarations:

| Biome | Rooms/profile                                | Rare | Epic |  Duo | Legendary |
| ----- | -------------------------------------------- | ---: | ---: | ---: | --------: |
| F     | `F_MiniBoss01/02/03`                         | 0.90 | 0.07 | base |      0.05 |
| G     | `G_MiniBoss01/02/03`                         | 0.90 | 0.10 | base |      0.05 |
| H     | `H_MiniBoss01/02`                            | 0.90 | 0.10 | base |      0.05 |
| I     | `I_MiniBoss01/02`                            | 0.90 | 0.10 | 0.20 |      0.20 |
| N     | `N_BaseMiniBoss` and its inheriting children | 0.90 | 0.10 | base |      0.05 |
| O     | `O_MiniBoss01/02`                            | 0.90 | 0.10 | base |      0.05 |
| P     | `P_MiniBoss01/02`                            | 0.90 | 0.10 | 0.20 |      0.20 |
| Q     | `Q_BaseMiniBoss` and its inheriting children | 1.00 | 0.70 | 0.20 |      0.20 |

The override applies to any eligible loot materialized in that room, not only
the room's declared incoming reward. A current Hermes reward in a Miniboss
therefore consumes the Hermes base plus the room override. The future delayed
Shrine delivery will obtain the same behavior by supplying its actual reached
room to this authority; this slice does not add Shrine state or delivery.

### World Shop rarity is an exact generated-item fact

`I_WorldShop` and `Q_WorldShop` have no room override. Their ordinary
`RandomLoot` items use the Olympian base. Each exact `BoostedRandomLoot` item
has the sparse override:

| Check     | Value |
| --------- | ----: |
| Rare      |  0.90 |
| Epic      |  0.25 |
| Duo       |  base |
| Legendary |  0.10 |

The second-half I/Q `ShopHermesUpgrade` item uses that same sparse override
over the Hermes base. An ordinary `WorldShop` Hermes item remains unboosted.

The preceding Shop-phase slice already owns entry eligibility and preserves
the exact generated option key on `ShopGenerationWitness`. This slice consumes
that witness at the purchase/action frontier. It must not infer boost from the
biome, Shop profile, slot, resolved `RandomLoot` reward type, or entered-biome
count, and it must not persist the option key.

Paid settlement, Travel Deal refill, and Echo Gold duplication must preserve
the same exact-item distinction:

- a paid offer derives its item override from its exact generation witness
  before either ordinary settlement or Gold duplication;
- Gold duplicates the source item's rarity context rather than reconstructing
  it from the resolved reward type; and
- a Travel refill supported by more than one exact option witness retains the
  branch-local rarity contexts. It must not choose an arbitrary first witness
  when ordinary and boosted options resolve to the same authored reward.

The authored Shop offer and supplemental refill remain resolved rewards only.
No source-intent field or second persisted Shop identity is introduced.

### High-tier offers stay optional

Duo and Legendary traits remain in the existing optional high-tier `H`
composition partition beside ordinary `O` and replacement `R`. For each
retained history branch, `H` contains only otherwise-legal Duo/Legendary
variants whose exact ledger check is possible at that offer frontier. A zero
or otherwise impossible check excludes that variant from `H`; support from a
different branch cannot be unioned into it. A positive or even guaranteed
numeric check only admits the variant to optional `H` and never requires it to
occupy an offer position.

Fallback Gold, Vow of Denial, replacement composition, and first-offer
composition continue to consume the existing offer-domain authority after
rarity-impossible variants have been removed. Denial records no bans for an
offer blocked before acquisition.

## Locked ownership and implementation

### 1. Catalog owns numeric game facts

Add a closed boon-rarity schema beside the trait catalog:

- ordered checks and the Olympian/Hermes provider bases;
- a sparse override type shared by rooms and exact Shop option entries;
- rank-indexed additive/multiplicative Arcana contributions; and
- a Proper-Upbringing effect containing activation element thresholds,
  Common-to-Rare promotion, `GodLootOnly` applicability, and `Rare +1`.

Extend only the owning declarations and compilers:

- trait catalog/provider bases and Proper effect;
- `RoomDeclaration` for optional sparse room override;
- `ShopOptionEntry` for optional sparse generated-item override; and
- `ArcanaCardDeclaration` for the three exact rank tables.

The compiler validates closed keys, finite numbers, exact rank tables, and
that unsupported providers/effects cannot carry boon-rarity data. Do not copy
base values onto every giver or add a generic modifier DSL.

### 2. Simulation owns one pure fact-to-ledger query

Add one pure engine module in the existing trait/simulation neighborhood. It
receives explicit `BoonRarityFacts` assembled from the exact offer-local
branch and returns:

- the assembled numeric values for Rare, Epic, Duo, and Legendary;
- the exact possible fresh rarities after intersecting a trait declaration;
  and
- a precise exclusion reason for each impossible declared fresh rarity.

Both input and output are derived immutable values. Neither is accumulated or
updated across events. They are not written into authored JSON, reward history,
candidate sidecars, Redux, or React state. Tests may inspect the pure product;
application consumers receive only the existing candidate assessment and
finding surfaces.

### 3. Existing trait-offer context carries the exact source snapshot

Extend the existing explicit `TraitOfferContext`/candidate capability rather
than creating a second query or replay service. Room materialization supplies
the exact room override. Shop settlement supplies the exact option-witness
override. Chronological settlement supplies active Arcana ranks and the
active-Proper fact from the same branch used for all other trait legality.

At each offer frontier, one small adapter reads those existing facts and
constructs `BoonRarityFacts`; the pure ledger query consumes it immediately.
Do not place a ledger field on `TraitHistoryState`, `ArcanaFearState`, pending
Shop state, canonical rooms, or candidate artifacts. Those products retain
only their existing semantic facts and exact source context.

The complete offer-local rarity context must participate in the existing
composition-domain cache key. The cache remains an identity optimization and
must never reuse a domain across different room, item, Arcana, or Proper
contexts.

Encounter, incoming reward, local reward, wheel, Shop, Travel, and Gold paths
must all reach the same ledger authority. Do not duplicate arithmetic in
producer-specific settlement code.

### 4. Fresh-roll assessment consumes the ledger once

Replace `rarityBelowActiveFloor` fresh-offer policy with one general
`rarityRollUnavailable` finding emitted when an authored declared rarity is
impossible at the exact frontier. Keep `freshRarityUnavailable` for the
different structural case where the trait declaration never supports that
fresh rarity.

The ledger applies only to fresh Olympian/Hermes rolls. Preserve these bypasses:

- legal replacement uses its exact promoted rarity;
- Calling Card evaluates the original fresh rarity first, then applies its
  existing post-offer rarification;
- Gorgon uses its exact source-resolved rarity override;
- Echo prior-run/direct acquisitions use their authored historical rarity and
  retain the Proper selection-time correction;
- fixed/selectable NPC providers, Hammers, and Selene remain under their
  existing declaration-owned rarity policies; and
- Heroic is never introduced as an ordinary fresh candidate.

Delete the old fresh-offer minimum-floor branch after every consumer uses the
numeric authority. Preserve no parallel floor validator.

### 5. Candidate and application behavior stay on existing paths

The existing trait-offer candidate artifact remains the sole contextual
authority. Its concrete `(traitKey, rarity)` variants become supported or
impossible through the new engine finding. The existing focused-option query,
retained-invalid selection, preferred repair, Save behavior, finding routing,
and one-command Undo remain unchanged.

Application production work is limited to:

- generic player-facing copy for `rarityRollUnavailable`;
- replacing the old Proper-specific finding/copy;
- projecting the renamed engine-owned active-Proper Run State fact; and
- deleting superseded minimum-floor fields and mappings.

Do not add a picker, percentage display, rarity calculator, room-specific UI,
or React-side chance arithmetic.

### 6. Authored schema remains 50; catalog version advances

No persisted shape changes. Keep `PROJECT_DOCUMENT_SCHEMA_VERSION` at 50 and
advance catalog version `0.29.0-world-shop-phase` to
`0.30.0-boon-rarity-ledger`.

Refresh all 14 checkpoint documents and manifest entries. Thirteen checkpoints
should change only catalog version and canonical hash. The existing
`surface-nopq` checkpoint requires one deliberate semantic correction:

```text
Q_MiniBoss02 / surface-q-first-miniboss-1
  option1 Common -> Rare
  option2 Common -> Rare
  option3 Common -> Rare
```

Q's room override guarantees the Rare check, so those three Common choices are
no longer valid. Re-evaluate the complete checkpoint after the edit. Do not
add a new checkpoint or reconstruct the route with command-heavy setup.

Do not modify `schema/migrate-project.js`: this is a catalog compatibility
bump, not a schema migration. External old-catalog files continue to require
deliberate load/migration review rather than an unchecked version rewrite.

### 7. Deferred source facts stay deferred

The audit records Yarn of Ariadne so the future Well slice can reuse this
ledger, but this implementation adds no Yarn declaration, authored state,
remaining-use counter, consumption event, Well interaction, or Shrine
delivery. Likewise it adds no Chaos Favor/Ordinary, forced-Common input,
Transcendent Embryo, Dream Dive, or generic temporary modifier system.

Future sources may contribute at the same explicit offer frontier after their
own authored and chronological contracts exist. No unused scaffolding is
needed now.

Chaos Ordinary is also future-owned, but its source behavior is not an
additive contribution. Its eventual active fact must short-circuit fresh-roll
assembly to forced Common before Arcana or trait additions are applied. Do not
encode forced Common as a synthetic numeric bonus, and do not add the unused
fact to production in this slice.

## Delivery gates

### Gate A — Complete catalog-to-editor rarity slice

Deliver one coherent vertical implementation commit:

- normalized provider bases, room/item overrides, Arcana rank tables, and
  Proper effect;
- one pure ordered numeric ledger and feasibility product;
- exact room, Shop witness, active Arcana, and active-Proper context threading;
- fresh Olympian/Hermes candidate filtering with one generic finding;
- preservation of replacement, Calling Card, Gorgon, Echo, NPC, Hammer, and
  Selene rarity ownership;
- exact paid/Travel/Gold item-context behavior;
- active-Proper Run State cleanup without a global ledger display;
- catalog `0.30.0-boon-rarity-ledger` and the bounded checkpoint refresh; and
- deletion of the old fresh-offer floor validator and its app copy.

Primary test owners:

- catalog trait tests own provider bases and Proper's exact effect;
- catalog Arcana tests own the complete four-rank contribution matrix;
- catalog room/regression tests own every F-Q Miniboss override and absence on
  non-Miniboss rooms;
- catalog reward tests own exact ordinary/boosted I/Q and Hermes item facts;
- one engine `boon-rarity-ledger` suite owns arithmetic, sparse fallback,
  override precedence, additive-before-multiplicative order, guarantees,
  supported-rarity intersection, and no fresh Heroic;
- engine trait tests own Proper activation/promotion/deactivation/reactivation
  and Echo's selection-time correction;
- focused simulation Shop and biome tests own exact witness/room context;
- trait-offer focused candidate tests own one retained-invalid repair contact;
- Denial tests own no-ban behavior for a rarity-invalid offer; and
- app trait-domain/copy tests plus one fixture-backed product loop own the
  existing picker and navigation contact.

Required direct witnesses:

1. Olympian and Hermes base ledgers match the audited values.
2. Sparse room/item overrides fall back to the correct provider base.
3. A room override wins over an item override.
4. Additive contributions apply before Excellence's multiplier and values are
   not clamped.
5. Every Arcana rank-I through rank-IV table normalizes exactly; simulation
   consumes current rank III and Lapis rank IV without new rank authorship.
6. Proper adds `Rare +1` to eligible Olympian and Hermes offers, making Common
   impossible while later supported rarities remain possible.
7. Proper deactivation removes the future contribution without downgrading
   past promotions; reactivation promotes newly eligible Common traits.
8. Echo Boon Boon Boon retains its selection-time Common-to-Rare correction.
9. F-style Miniboss Rare below one retains Common possibility.
10. Q Miniboss Rare equal to one rejects Common and offers Rare repair.
11. A Hermes reward materialized in a Miniboss uses the room override rather
    than only the room's declared reward profile.
12. Non-Miniboss rooms have no room override.
13. An ordinary World Shop `RandomLoot` and Hermes item use provider bases.
14. Exact I/Q `BoostedRandomLoot` and second-half `ShopHermesUpgrade` witnesses
    use the boosted item override without literal biome/profile inference.
15. Where ordinary and boosted options resolve to the same `RandomLoot`
    payload, candidate support remains branch-local to the witness option key.
16. Travel refill retains all exact source-item witnesses relevant to rarity;
    it does not silently select the first matching reward type.
17. Echo Gold duplication preserves its paid source item's rarity context.
18. The branch-local `H` set excludes Duo/Legendary variants with an impossible
    exact check, includes possible variants, never unions support across
    histories, and never forces an offer position.
19. A rarity-invalid offer does not emit Denial bans or acquisition history.
20. Replacement, Calling Card, Gorgon, fixed/selectable NPC, Hammer, and Selene
    representative witnesses remain unchanged.
21. The retained invalid Common option is shown with generic feedback, the
    supported Rare repair saves in one semantic history step, and Undo restores
    the authored Common value.
22. `surface-nopq` is complete-valid with its three Q Miniboss options at Rare;
    every other checkpoint retains its authored tree apart from catalog
    metadata.

Test consolidation:

- replace or rewrite the command-heavy
  `ProperUpbringingProductLoop.interaction.test.tsx` with the manifest-backed
  `surface-nopq` Q Miniboss repair workflow rather than adding a second product
  loop;
- keep the full Proper lifecycle matrix in engine tests; and
- do not duplicate numeric or biome matrices in React tests.

Gate-A development validation uses focused owning tests first. Before the Gate-A
commit, run:

```text
npm run test:catalog
npm run test:engine
npm run test:fixtures:check
npm run test:planner
npm run test:product
npm run typecheck
npm run lint
npm run format:check
git diff --check
npm run build
```

Do not repeatedly run full lanes after minor adjustments. Full owning lanes
are precommit evidence only.

Gate-A commit:

```text
feat(rarity): model boon rarity feasibility
```

### Gate B — Durable absorption and phase closure

After independent review of Gate A:

- update the boon-rarity audit's planner disposition, including the completed
  I/Q phase prerequisite and explicitly deferred Yarn lifecycle;
- update the smallest reward, simulation, candidate, editor, Arcana, and biome
  authorities that currently describe the Proper-only floor or rarity-deferred
  Miniboss/Shop behavior;
- append exact delivery, review, fixture, and validation evidence to
  `IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan; and
- run one complete `npm run check` exactly once after the documentation is
  stable.

Gate-B commit:

```text
docs(rarity): close boon rarity ledger
```

## Deletion and no-growth audit

Gate A must end with:

- one numeric ledger authority and no parallel Proper-only fresh-offer floor;
- no stored, incrementally updated, or resettable rarity-ledger state;
- no `minimumScalableGodTraitRarity` or `rarityBelowActiveFloor` production
  policy names;
- no persisted ledger, random result, Shop option key, source intent, or
  candidate cache sidecar;
- no second trait-offer candidate API or producer-specific chance arithmetic;
- no literal Miniboss, I/Q, Shop-profile, or entered-biome switch in the
  evaluator;
- no global Run State ledger or React percentage calculation;
- no schema bump, migration step, compatibility decoder, or new checkpoint;
- no Arcana rank-I/rank-II authoring controls;
- no Yarn, Well, Shrine delivery, Chaos, Dream Dive, or keepsake production
  path; and
- no duplicated product loop for the same rarity-repair workflow.

Expected production growth is one small closed catalog vocabulary, explicit
source declarations, one pure simulation evaluator, and narrow context
threading through existing products. Any generic modifier interpreter,
persisted state, new UI surface, or broad service boundary is overengineering
and must be removed before review.

## Explicit non-goals

This phase does not implement:

- probability distributions, RNG rolls, seeds, weights, or reroll simulation;
- percentages, chance bars, or numeric rarity controls in React;
- fresh Heroic rolls;
- forced-Common behavior or Chaos Ordinary;
- Chaos Favor, curse/blessing authoring, maturation, or numeric sliders;
- Yarn of Ariadne, Stygian Well purchases, limited-use consumption, or
  temporary-bonus exclusion;
- Shrine of Hermes purchase/delivery authoring;
- Dream Dive routes or dynamic biome reordering;
- Transcendent Embryo, Heroic Chaos traits, or Cherished Heirloom integration;
- provider-unrelated NPC rarity rules;
- changes to offer count, Duo/Legendary optional composition, Vow of Denial
  count, or Fallback Gold policy; or
- a generic interpreter for arbitrary game trait effects.
