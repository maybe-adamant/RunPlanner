# Aspect of Persephone, Premium Service, and Offered Levels Audit

## Status and scope

Implemented in the schema-64, catalog `0.47.0-persephone-effective-levels`
Planner contract.

This is the durable source audit for the reward-side level effects of Aspect of
Persephone (`LobImpulseAspect`) and Premium Service (`WeaponUpgradeBoon`), plus
the existing Jeweled Pom and Sacrificial Hymn contacts needed to state one
truthful final level for every authored trait option.

The evidence was checked on 2026-08-26 against the installed game-data
reference under `../../1GameData/Scripts/`. Primary contacts are:

- `TraitData_Aspect.lua:1920-2051` (`LobImpulseAspect`);
- `UpgradeChoiceLogic.lua:280-340` (`CreateUpgradeChoiceButton`);
- `TraitLogic.lua:1547-1559` (`IsGodTrait`);
- `TraitData_Hephaestus.lua:2059-2088` (`WeaponUpgradeBoon`);
- `TraitLogic.lua:2801-2821` (`UpgradeAspect`);
- `TraitData_Keepsake.lua:2415-2445` (Jeweled Pom); and
- the `TraitToReplace` branch in `UpgradeChoiceLogic.lua:320-333`, which also
  owns Sacrificial Hymn's replacement result.

This audit records source behavior and the settled Planner disposition. It
does not define authored commands, React components, delivery gates, or module
names.

## Source behavior

### Aspect of Persephone

`LobImpulseAspect` contributes `MaxBonusBoonRankWeighted` with base value two.
At the Planner's progressed maximum-rank baseline, the aspect is Legendary and
therefore exposes maximum rank six. Its source distribution is:

| Displayed starting level | Weight |
| -----------------------: | -----: |
|                        1 |   0.50 |
|                        2 |   0.16 |
|                        3 |   0.14 |
|                        4 |   0.12 |
|                        5 |   0.06 |
|                        6 |   0.02 |

The source stores the ordinary Level 1 result as internal stack value zero.
It deliberately has no internal value one because value one would redundantly
display Level 1. Values two through six are already displayed levels.

The roll happens separately while each offer row is constructed. The chosen
stack value remains attached to that row. Recreating or rarifying the same row
retains its value, and Concave Stone's frozen residual result uses the original
row rather than rolling another level.

### Exact eligibility

`CreateUpgradeChoiceButton` applies the row level only when all of these are
true:

1. the processed trait does not set `BlockStacking`;
2. `IsGodTrait(itemData.ItemName)` is true; and
3. the loot source does not set `IgnoreStackBoost`.

`IsGodTrait` is called without its shop-classification option. The resulting
Planner predicate is the existing stackable core-god trait family, not every
trait with `BlockStacking = false`. Hermes, Chaos, Hammers, Hades and other NPC
traits, and Story traits do not qualify. An ordinary core-god Shop purchase
still uses its normal god-loot screen and qualifies; purchase provenance does
not suppress this offer-construction effect.

Echo's loot declaration sets `IgnoreStackBoost`, so an Echo-owned recreated
screen does not receive the Aspect or Jeweled Pom stack boost even when its
nested identity is otherwise a core-god trait.

### Premium Service

Premium Service acquires `WeaponUpgradeBoon`, whose callback calls
`UpgradeAspect` with one upgrade level. `UpgradeAspect` removes and re-adds the
currently equipped aspect at the next weapon-aspect rarity. For a maximum-rank
Legendary Aspect of Persephone, this produces the Perfect multiplier and a
maximum displayed starting level of nine. The Perfect distribution supports
Level 1 and every displayed level from 2 through 9.

The aspect upgrade is an acquisition-time mutation. It affects only trait
screens constructed later; it cannot rewrite sibling options that were
already frozen on the Premium Service screen. Removing Premium Service later
does not downgrade the aspect. A selected-acquisition history fact therefore
remains sufficient for the fixed-loadout Planner even if the equipped Premium
Service trait is later removed.

The Planner does not currently author non-maximum weapon-aspect ranks. Lower
source ranks and their intermediate 2/3/4/5 maxima remain outside this slice.

### Jeweled Pom composition

Jeweled Pom contributes its retained prospective bonus only to newly acquired
eligible rows while the run is Fated. Its ordinary Epic rank contributes three
levels; Cherished Heirloom can raise the prospective contribution to four.

The literal source combines Jeweled Pom with Persephone's unusual internal
stack encoding by adding `FatedBoonLevelBonus + 1`. This creates a gapped joint
distribution. For example, Epic Jeweled Pom and Legendary Persephone yield
displayed levels `{4, 6, 7, 8, 9, 10}` rather than a continuous range.

The Planner deliberately normalizes that implementation artifact. It models
Persephone as an additive random contribution of zero through five levels, or
zero through eight after Premium Service, and then adds the active Jeweled Pom
contribution normally. The normalized final formula for a qualifying fresh
row is:

```text
effective level = 1 + Jeweled Pom contribution + Persephone contribution
```

This retains every independently meaningful authored decision while avoiding
a special joint effect table. The Planner models possible authored outcomes,
not source probability weights.

### Replacement precedence and Sacrificial Hymn

The source computes stack boosts before replacement presentation but the
`TraitToReplace` branch takes precedence when the row is finalized. A
replacement inherits the replaced trait's current level and applies its
replacement bonus. It does not use the Persephone roll or Jeweled Pom stack
boost.

Sacrificial Hymn forces one eligible replacement row and gives that row two
additional levels. Its final level is therefore:

```text
effective level = replaced trait level + 2
```

An ordinary replacement without Hymn retains the replaced trait's level.
Neither replacement path receives a fresh-offer Persephone or Jeweled Pom
addition.

## Planner disposition

The Planner has an optional Persephone random additive contribution on the
exact authored option row. The legal contribution is `0..5` before Premium
Service and `0..8` after a prior Premium Service acquisition. Only nonzero
outcomes need persistence: an omitted active value semantically resolves as
the ordinary `+0` result, so authors do not have to author zero on every
eligible row. Explicit zero remains a valid round-tripping representation.

The field is active only for a fresh, stackable core-god option on a supported
loot screen while Aspect of Persephone is equipped. It remains frozen with the
row for Calling Card and Concave Stone. Context-invalid or currently dormant
detail remains repairable rather than being destructively erased.

The final effective level is derived, never persisted. The engine combines the
pre-offer trait history, replacement transition, retained Jeweled Pom state,
route aspect, prior Premium Service acquisition, and the authored Persephone
contribution. The application may display the result only when all surviving
simulation branches agree.

No general aspect-rank ledger, random-effect registry, weighted probability
simulator, or React-owned level formula is implied.

The shipped implementation keeps the contribution optional in authored JSON:
an omitted active value is the ordinary `+0` result and does not produce a
finding. The engine emits `persephoneLevelBonusUnavailable` only for an
explicit value outside the active range, and the application presents that
finding at the exact option owner for repair. Effective levels remain derived
products; Premium Service expands only later offer screens because each screen
freezes its levels when generated.
