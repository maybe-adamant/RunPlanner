# I/Q World Shop Phase Implementation

## Status

Locked delivery plan grounded on clean base
`e1800bf6d962d046b0bfddf5e015fa265b774d08`. The plan was checked against the
live I/Q Shop declarations, normalized Shop contract, requirement evaluator,
Shop generation and candidate paths, strict authored codec, checkpoint corpus,
and application projection. That review narrowed the production change to
catalog declarations: the engine already owns every chronological fact and
evaluation behavior this correction needs.

This is a temporary implementation plan. It must not be linked from the README
or stable design documents. At closure, absorb the completed rule into the
smallest durable authorities and delete this file.

Owning evidence and stable authorities:

- [`I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md`](../audits/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md)
- [`SHOP_AND_WELL_INTERACTION_LIFECYCLE.md`](../audits/SHOP_AND_WELL_INTERACTION_LIFECYCLE.md)
- [`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md)
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`I_GAME_RULES.md`](../biomes/I_GAME_RULES.md)
- [`Q_GAME_RULES.md`](../biomes/Q_GAME_RULES.md)

## Objective

Make `I_WorldShop` and `Q_WorldShop` consume the existing chronological
`enteredBiomes` fact instead of always exposing their ordinary-route
second-half inventory.

The user-visible result is:

- an I/Q World Shop entered at count one or two offers only its first-half and
  phase-independent possibilities;
- the same profile entered at count three or later offers only its second-half
  and phase-independent possibilities;
- the existing standard routes remain unchanged because I and Q are entered
  fourth;
- Q's first group still authors two distinct offers without replacement after
  phase filtering; and
- a retained phase-ineligible offer remains editable and receives the existing
  contextual unavailable evidence rather than being deleted or rewritten.

This slice prepares the exact input for the later boon-rarity ledger. It does
not calculate rarity. The later slice consumes the concrete Shop option key on
each supported generation witness and must not reevaluate Shop phase.

## Source facts and chosen planner representation

### The phase is reached entered-biome history

The exact requirements are:

```text
first half  = enteredBiomes <= 2
second half = enteredBiomes >= 3
```

The current biome has already contributed to this count when its World Shop
inventory is generated. The Shop/reward boundary already receives the count
through `RewardKernelFacts.requirements.counters.enteredBiomes`.

The live project evaluator currently supplies `biomeIndex + 1` as
`enteredBiomeCount`. That equals reached entered-biome count for the supported
fixed-order routes, but it is not yet a dynamic Dream Dive history fold. This
slice makes Shop declarations consume the existing fact and must not replace
its producer with literal I/Q logic. A future Dream Dive implementation owns
supplying the actual reordered reached count through the same engine input.
No phase enum, Shop-local counter, or persisted field is needed here.

### Phase belongs to each option entry

Group count, slot count, and offer count never change. Add phase requirements
to exact Shop option declarations and conjoin them with every existing
option-specific requirement.

`I_WorldShop` keeps five one-offer groups:

| Group | First-half-only                                   | Second-half-only                                                                                     | Both halves                                                                                             |
| ----- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1     | `RandomLoot`                                      | `BoostedRandomLoot`, `StackUpgradeBig`                                                               | none                                                                                                    |
| 2     | none                                              | none                                                                                                 | `RandomLoot`, `BlindBoxLoot`, `MaxHealthDrop`, `MaxManaDrop`, `StackUpgrade`, `TalentDrop`, `SpellDrop` |
| 3     | `RoomRewardHealDrop`, `ArmorBoost`                | `HealBigDrop`, `ArmorBigBoost`                                                                       | `LastStandDrop`                                                                                         |
| 4     | `WeaponUpgradeDrop`, `RandomLoot`, `BlindBoxLoot` | `ShopHermesUpgrade`, `ChaosWeaponUpgrade`, `BoostedRandomLoot`, `MaxHealthDropBig`, `MaxManaDropBig` | none                                                                                                    |
| 5     | none                                              | none                                                                                                 | `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, `CharonPointsDrop`                                     |

`Q_WorldShop` keeps a two-offer first group and four one-offer groups:

| Group | First-half-only                    | Second-half-only                                                                                     | Both halves                                                                             |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1     | `StackUpgrade`                     | `BoostedRandomLoot`, `StackUpgradeBig`                                                               | `RandomLoot`, `BlindBoxLoot`, `MaxHealthDrop`, `MaxManaDrop`, `TalentDrop`, `SpellDrop` |
| 2     | `RandomLoot`                       | `HealBigDrop`, `ArmorBigBoost`                                                                       | none                                                                                    |
| 3     | `RoomRewardHealDrop`, `ArmorBoost` | `HealBigDrop`, `ArmorBigBoost`                                                                       | `LastStandDrop`                                                                         |
| 4     | `WeaponUpgradeDrop`, `RandomLoot`  | `ShopHermesUpgrade`, `ChaosWeaponUpgrade`, `BoostedRandomLoot`, `MaxHealthDropBig`, `MaxManaDropBig` | none                                                                                    |
| 5     | none                               | none                                                                                                 | `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, `CharonPointsDrop`                     |

The source has phase-specific duplicate rows for Q group-one `RandomLoot` and
`BlindBoxLoot` because their weights change. The planner models possibility,
not probability, so each remains one phase-independent semantic option. Do not
add duplicate option keys or a weight field.

### Existing requirements remain conjunctive

Phase never overrides another guard. In particular:

- `StackUpgrade` and `StackUpgradeBig` still require an upgradable trait;
- the first-half Hammer still requires the existing early-Hammer state;
- `ChaosWeaponUpgrade` still requires prior Hammer history;
- `ShopHermesUpgrade` still consumes its exact Hermes-history guard;
- Spell and Talent Drops retain their current slot/history guards; and
- `LastStandDrop` retains its authored Death Defiance condition at generation
  and purchase.

Use one declaration-local composition helper, or explicit `all` requirements,
to combine phase with an existing requirement. Do not add a new requirement
kind or duplicate requirement evaluation in the catalog compiler.

### Shop option identity remains the rarity handoff

`BoostedRandomLoot` is an option key whose resolved reward type remains
`RandomLoot`; that exact derived option identity is the future rarity-override
contact. An ordinary `RandomLoot` in the same Shop stays ordinary. The option
key is not authored: where one resolved offer admits more than one assignment,
the existing Shop simulation retains multiple generation witnesses and the
rarity slice evaluates each corresponding branch.

The second-half I/Q `ShopHermesUpgrade` remains its exact fixed Hermes option
and is the other future boosted contact. This slice does not add rarity values,
candidate rarity filtering, or trait-offer changes.

## Locked ownership and implementation

### 1. Catalog declarations own both phase requirements

Add two explicit source-named `RequirementExpression` declarations for first
and second half. They use the existing `counterRange` kind over
`enteredBiomes`, with `max: 2` and `min: 3` respectively.

Do not reuse the existing `smallEnteredBiomes`/`largeEnteredBiomes` declarations:
those model different store tiers at `max: 1` and `min: 2`.

Update only the affected option entries in
`packages/hades2-catalog/src/declarations/rewards/shops.ts`. Add the audited
first-half entries that are currently absent and phase-gate the existing
second-half entries. Copy each reused option's existing purchase interaction,
acquisition lifecycle, and semantic requirement exactly.

Do not create early/late Shop profiles, alter group or slot keys, persist option
keys, or add a Shop phase field.

### 2. Existing compiler and reward kernel remain authoritative

The catalog compiler already normalizes closed `counterRange` and `all`
requirements and validates referenced reward types. The reward kernel already:

- evaluates an option's normalized requirement against generation-time facts;
- finds complete group assignments;
- prevents reuse of one option key inside Q's two-offer group;
- distinguishes an unsupported indexed offer from a jointly unavailable set;
- revalidates the selected generation witness before purchases; and
- retains exact witness option keys for later Shop and rarity consumers.

No engine production change is planned. If an owning test proves one of these
existing contracts false, stop the gate and report the concrete engine defect
instead of adding an I/Q-specific workaround.

### 3. Authored state and repair behavior do not change

An authored Shop stores its fixed slot keys and resolved reward leaves, not the
derived option key or phase. Strict decode remains structural and does not
delete an offer merely because its current chronological requirements fail.

At evaluation, a phase-ineligible leaf uses the existing
`shopOfferUnavailable` finding and exact Shop-offer candidate support. The
normal reward editor remains its repair path. Do not add a migration,
normalization pass, destructive command, or React-side phase filter.

### 4. Schema remains 50; catalog version advances

This changes normalized game facts but not persisted project shape. Keep
`PROJECT_DOCUMENT_SCHEMA_VERSION` at 50 and advance the catalog version from
`0.28.0-selene-spells` to `0.29.0-world-shop-phase`.

Refresh all 14 checkpoint documents and manifest entries to the new catalog
version and canonical hashes. The JSON tree must otherwise remain byte-for-byte
semantically identical. In particular, do not rewrite Shop offers, Room Action
orders, spell intent, or route topology.

The two checkpoints containing concrete I/Q World Shops are
`underworld-fghi` and `surface-nopq`. Their standard-route histories must retain
complete second-half generation witnesses after the version refresh. Record
that semantic attestation in fixture or owning simulation tests.

Do not add a schema migration step for this catalog-only change. Do not broaden
the permanent schema migration runner into an unchecked catalog-version
rewriter: strict compatibility remains a deliberate review boundary.

### 5. Application behavior is consumption-only

The application already renders engine-owned reward candidates, unavailable
findings, and exact Shop offer repair controls. It does not receive or display
a first-half/second-half mode.

No application or React production edit is planned. Retain at most one
representative projection or product witness if changed declarations expose a
real downstream integration contact; do not duplicate the phase matrix in UI
tests.

## Delivery gates

### Gate A — Catalog correction and engine witnesses

Deliver one complete behavior slice:

- exact first-/second-half requirement declarations;
- the complete audited I and Q option matrices;
- preservation of all existing option requirements and acquisition behavior;
- Q group-one filtering followed by two distinct without-replacement choices;
- catalog version `0.29.0-world-shop-phase`;
- mechanical checkpoint/manifest catalog refresh with no authored-tree change;
- current standard-route I/Q behavior preserved; and
- no engine/application production changes unless a concrete existing-contract
  defect blocks the declared behavior.

Primary test owners:

- `packages/hades2-catalog/test/catalog/rewards.test.ts` owns exact normalized
  group/option/requirement parity;
- `packages/planner-engine/test/reward-kernel/behavior.test.ts` owns phase
  filtering, conjunctive requirements, Q assignment, and ordinary World Shop
  non-regression;
- the existing I/Q simulation and Shop-trait/Travel/Gold tests retain
  representative standard-route and downstream chronology contacts; and
- `test/fixtures/authored-project/checkpoints/check.test.ts` owns strict
  checkpoint decode, canonical encoding, hashes, and frozen-loader integrity.

Required direct witnesses:

1. I and Q at `enteredBiomes` 1 and 2 expose only first-half plus common
   entries.
2. I and Q at counts 3 and 4 expose only second-half plus common entries.
3. Boundary counts 2 and 3 select opposite phase sets with no gap or overlap.
4. Every phase-specific entry retains its non-phase requirement.
5. Q group one produces two distinct option keys after filtering and does not
   reuse `RandomLoot` merely because two authored slots resolve to the same
   reward type.
6. A phase-ineligible fixed offer is unsupported at its exact indexed slot and
   remains structurally representable.
7. A phase-ineligible joint Q pair remains the existing joint-unavailability
   case rather than being misreported as two invented slot failures.
8. `WorldShop` produces the same possibility domain at early and late entered
   counts.
9. Standard-route `I_WorldShop` and `Q_WorldShop` checkpoints remain
   complete-valid with second-half witnesses.
10. Shop purchase chronology, Travel Deal refill, Gold duplication, Infernal
    Contract, Echo duplication, Spell Drop, and Death Defiance behavior are
    unchanged after generation.

Gate-A validation:

```text
npm run test:catalog
focused reward-kernel Shop tests
npm run test:fixtures:check
npm run typecheck
npm run lint
npm run format:check
git diff --check
```

Run proportional existing I/Q and supplemental Shop tests after focused owners
are green. Do not repeatedly run complete planner/UI lanes: no application
production contract changes in this gate.

Gate-A commit:

```text
fix(shop): honor entered-biome world shop phases
```

### Gate B — Durable absorption and phase closure

After independent review of Gate A:

- update the I/Q audit's planner disposition without erasing source evidence;
- update I and Q biome authorities with entered-history-owned World Shop
  phase behavior;
- update the smallest reward/generation authority if it currently describes
  I/Q inventory as unconditionally second-half;
- append the exact delivery and validation record to
  `IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan; and
- run one complete `npm run check` as the phase-closing gate.

Gate-B commit:

```text
docs(shop): close world shop phase correction
```

## Deletion and no-growth audit

Gate A must end with:

- no second Shop profile, phase enum, persisted mode, route-index branch, or
  literal-biome evaluator;
- no new requirement evaluator or entered-biome counter;
- no React phase eligibility or option matrix;
- no schema bump or runtime compatibility path;
- no authored option-key field or destructive normalization;
- no duplicate Q `RandomLoot`/`BlindBoxLoot` possibility rows for source-only
  weight differences; and
- no rarity ledger, rarity override arithmetic, or trait rarity filtering.

Expected production growth is limited to explicit catalog option rows and two
small phase requirement declarations. Test growth may be larger because it
owns the complete matrix. Any engine or app production growth requires a
separately stated, evidence-backed defect and main-session disposition.

## Explicit non-goals

This phase does not implement:

- Dream Dive route construction, biome reordering, or an authored run mode;
- `IsDreamRun`, `ElementalBoost`, or the group-five Dream Run switch;
- probability weights, prices, affordability, discounts, rerolls, or Shop RNG;
- boon rarity ledgers, rarity rolls, rarity UI, or rarity candidate filtering;
- Miniboss, Yarn of Ariadne, Proper Upbringing, Arcana, Chaos Favor, or Chaos
  Ordinary rarity effects;
- Shrine of Hermes delivery or Stygian Well interactions;
- changes to Shop purchase participation, Room Timeline, Travel Deal, Gold Gold
  Gold, Infernal Contract, Echo duplication, or Artificer; or
- a claim that early I/Q is currently reachable through the product UI.

The later rarity implementation starts only after this gate is closed and
consumes the exact option identity already chosen by the Shop authority.
