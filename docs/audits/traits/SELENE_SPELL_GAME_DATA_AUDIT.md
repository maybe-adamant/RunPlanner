# Selene Spell Game-Data Audit

## Status and scope

This is an implementation-free source audit of Selene's Spell Drop, the nine
Hex identities, and Aspect of Selene's starting Sky Fall. It settles the
choice domain and the run-state consequences needed before the planner turns
`SpellDrop` from an effect-neutral consumable into a concrete trait-bearing
reward.

Path of Stars talent-tree authoring is outside this audit. Generated layout
capacity, Rare/Epic composition, and Olympian extensions are owned by the
[Hex Talent Layout audit](../loadout-and-progression/HEX_TALENT_LAYOUT_GAME_DATA_AUDIT.md).
The point bank, one/three/five reward values, ordered initial-offer bonuses, and
Aspect routing are owned by the focused
[Path of Stars and Spell Drop audit](../loadout-and-progression/PATH_OF_STARS_AND_SPELL_DROP_GAME_DATA_AUDIT.md).
The source contacts between a chosen Hex and later trait eligibility are
included here because concrete spell identity is already observable by the
planner's trait-offer model.

The evidence was checked on 2026-08-22 against the installed Hades II scripts:

- `SpellData.lua`, especially the nine `SpellData` entries;
- `SpellScreenLogic.lua`, especially `OpenSpellScreen`, `GetEligibleSpells`,
  `CreateSpellButtons`, and `ChooseSpell`;
- `SpellLogic.lua`, especially `PregenerateSpells`;
- `TraitData_Spell.lua` and `TraitText.en.sjson` for the concrete spell traits
  and player-facing names;
- `TraitData_Aspect.lua` and `WeaponUpgradeLogic.lua` for `SuitHexAspect` and
  its linked spell;
- `RequirementsData.lua` for `SpellDropRequirements` and `TalentLegal`;
- `StoreData.lua`, `StoreLogic.lua`, and `SurfaceShopLogic.lua` for store,
  duplicate-purchase, offered-reward, and pending-delivery guards;
- `RunData.lua` for the spell-to-trait initialization links;
- `TraitData.lua`, `TraitData_Artemis.lua`, and `TraitData_Circe.lua` for
  downstream trait requirements; and
- `LootData_Selene.lua` for the Aspect-specific Selene interaction; and
- `EventLogic.lua`, `InteractLogic.lua`, and `ConsumableData.lua` for Echo's
  `LastReward` boundary.

## Nine identities, two acquisition paths

The source declares exactly nine Hexes:

| Spell key   | Trait key             | Player-facing name | Normal Spell Drop pool | Acquisition path |
| ----------- | --------------------- | ------------------ | ---------------------- | ---------------- |
| `Polymorph` | `SpellPolymorphTrait` | Twilight Curse     | yes                    | Spell selection  |
| `Meteor`    | `SpellMeteorTrait`    | Total Eclipse      | yes                    | Spell selection  |
| `Transform` | `SpellTransformTrait` | Dark Side          | yes                    | Spell selection  |
| `Leap`      | `SpellLeapTrait`      | Wolf Howl          | yes                    | Spell selection  |
| `Laser`     | `SpellLaserTrait`     | Lunar Ray          | yes                    | Spell selection  |
| `Summon`    | `SpellSummonTrait`    | Night Bloom        | yes                    | Spell selection  |
| `TimeSlow`  | `SpellTimeSlowTrait`  | Phase Shift        | yes                    | Spell selection  |
| `Potion`    | `SpellPotionTrait`    | Moon Water         | yes                    | Spell selection  |
| `MoonBeam`  | `SpellMoonBeamTrait`  | Sky Fall           | no                     | Aspect of Selene |

`MoonBeam` has `GameStateRequirements = { Skip = true }`. It is not a ninth
random alternative. `SuitHexAspect` instead declares `LinkedSpell =
"MoonBeam"`; equipping that aspect adds `SpellMoonBeamTrait`, constructs its
talent tree, and makes it the slotted spell before the route begins.

The other eight are the complete normal Spell Drop domain under the planner's
fully progressed baseline. Five of them (`Meteor`, `Transform`, `Leap`,
`Summon`, and `Potion`) require a prior-run `SeleneFirstPickUp` record and no
same-run first-pickup record. Twilight Curse, Lunar Ray, and Phase Shift have
no corresponding progression gate. Those gates explain the first-ever Selene
screen; they do not narrow the planner's established progressed-save pool.

## Normal Spell Drop choice

`GetEligibleSpells` filters the eight normal spell entries against their
current requirements. `PregenerateSpells` then removes three random values
from that eligible set, and `CreateSpellButtons` renders at most three. The
three choices are therefore distinct alternatives against one pre-selection
state.

Selecting one choice equips exactly its `Spell*Trait` in the single `Spell`
slot. The spell traits do not use ordinary boon rarity. The named
`SpellDropRequirements` also require the current run not to have used a Spell
Drop already, so the ordinary supported run chooses at most one Hex. This is
not an ordinary Olympian giver and should not acquire a fabricated god-pool,
rarity, Pom, or three-boon contract merely because both screens show three
cards.

The authored result needs enough information to preserve the real hidden
choice surface: three distinct eligible spell identities and one selected
identity. A shortcut that stores only the winner would lose the same
offer-authorship and candidate-feedback contract already retained for other
three-choice rewards.

## Second-Spell-Drop guards

The ordinary named requirement rejects Spell Drop when the current store
already contains one, the room's chosen reward is Spell Drop, the run has used
one, or a Hermes delivery has one pending. Store-specific tables repeat the
relevant guards and additionally consult the Hub reward lookup or the room's
already-offered rewards. These checks prevent simultaneous doors, Hub rooms,
Shop offers, and Travel Deal refills from manufacturing a second normal Spell
Drop before the first is used.

Two trait effects close other duplication paths. `RemoveStoreItem` skips Spell
Drop when Gold Gold Gold would duplicate the first World Shop purchase, and
Reward Reward Reward cannot recreate Spell Drop because it never becomes
`CurrentRun.LastReward`. Artificer likewise excludes Spell Drop from its
replacement domain. Aspect of Selene is the separate non-duplication case: a
later Spell Drop opens Path of Stars instead of offering another base Hex.

The planner should retain these source-owned guards at their actual reward and
settlement checkpoints. A single equipped Spell slot is still the correct
derived trait state, but it is not a substitute for modeling why a second
normal Spell Drop is unavailable.

## Aspect of Selene

The global `SpellDropRequirements` do not exclude `SuitHexAspect`. On using a
Spell Drop, `OpenSpellScreen` checks that aspect first and routes directly to
`OpenTalentScreen`; it does not open the spell-choice screen and does not
replace Sky Fall. Selene's Aspect-specific dialogue describes the same rule:
the aspect bearer already knows Sky Fall and reshapes it through Path of Stars.

Some individual Shop replacement tables independently exclude
`SuitHexAspect`; that is a store-local option rule, not evidence that the
aspect can never receive a Spell Drop. The normal `RunProgress` Spell entry
uses the named requirements and remains available to the aspect. Thus the
planner rule is:

- every other aspect starts with no spell and its first acquired Spell Drop
  owns the eight-spell, three-choice selection; and
- Aspect of Selene starts with Sky Fall, and a later Spell Drop is still
  acquired but owns Path of Stars progression rather than trait selection.

The current planner does not yet author Path of Stars. Until that separate
slice exists, an Aspect-of-Selene Spell Drop may remain a concrete consumable
and use record with an explicitly deferred talent outcome; it must not offer a
second Hex or erase Sky Fall.

## Existing downstream contacts

Concrete spell identity is not merely descriptive. Seven spell traits—every
normal spell except Phase Shift and Moon Water, plus aspect-owned Sky Fall—are
positive prerequisites for:

- Artemis's `SorceryCritBoon` (Whispered Prayer); and
- Circe's `CirceSorceryDamageBoon` (Hymn to the Eye of Night).

Those providers must read the equipped spell at their exact offer checkpoint.
Aspect-owned Sky Fall is present from the run's initial loadout state; a normal
Hex becomes present only after its Spell Drop is picked up and its selection
is resolved. Merely generating or seeing the Spell Drop cannot satisfy either
dependency.

Moon Water separately carries three uses that refresh on fountain use. That is
a real combat-resource effect, but current reward, candidate, and lifecycle
state does not consume spell-use counts. Concrete Moon Water identity is in
scope; its remaining-use simulation is not required to make spell-dependent
trait eligibility exact.

Path of Stars talents remain distinct equipped traits. In particular,
`OlympianSpellCountBoon` depends on one of nine Olympian talent identities, not
on a base Hex. Base-spell implementation must not synthesize those talents.
Their generation and finite-capacity closure are now source-audited
separately. Exact Olympian-node acquisition remains graph-local and is not
simulated. Task Force requires one currently equipped base Hex, including
Aspect of Selene's Sky Fall, then trusts the authored result and uses the
durable runtime fallback contract for the deeper node condition. The current
explicit `allSpellInvested = false` support baseline remains until the
aggregate layout model is delivered.

## Echo replay boundary

Reward Reward Reward cannot recreate a Spell Drop. Echo recreates only
`CurrentRun.LastReward`; a consumable becomes that value only when its
declaration has `LastRewardEligible`. `SpellDrop` does not have that flag, and
`OpenSpellScreen` records its consumable/use history without assigning it to
`LastReward`. The normal one-Spell-Drop rule therefore has no Echo exception.

`TalentDrop` is deliberately different: its consumable declaration does have
`LastRewardEligible = true`, so Path of Stars currency may be Echo's recreated
last reward. The planner must preserve Talent Drop replay while removing its
current incorrect claim that Spell Drop is replayable.

## Planner disposition

Completed in schema 50 by `5261efd` (engine/catalog) and `2b86e31`
(application/editor):

1. all nine base Hexes are real, rarityless `Spell`-slot traits, and the
   ordered normal `SpellDrop` pool contains exactly the other eight;
2. `SuitHexAspect` alone links Sky Fall as a route-start direct trait grant;
3. a normal Spell Drop owns the existing `self` trait-offer child with three
   distinct normal spells and one selected outcome, which equips only at its
   reached acquisition settlement;
4. the shared six-slot equipped-trait ledger preserves the original five-slot
   ordinary-boon subset, so Artemis and Circe consume the exact chronological
   spell history without making Hexes ordinary boons;
5. an Aspect-of-Selene Spell Drop preserves its acquired consumable history
   while its child is dormant for deferred Path of Stars authoring; it emits no
   selector, finding, or second equipped spell and reactivates if the aspect
   changes; and
6. Spell Drop is absent from Echo's last-reward recreation domain while Talent
   Drop remains present.

The editor presents the engine-owned active child as `Edit spell` through the
existing trait-offer capability, semantic command, finding navigation, and
Undo path. It does not own the pool or aspect rule, and opening the dialog does
not query candidate evaluation.

This delivery intentionally excludes a second spell slot, spell-use simulation,
Path of Stars talents, spell damage, Dream-run rotation, and special React
eligibility. Shrine delayed delivery is also unmodeled: `pendingSpellDrop`
remains an explicit false supported-baseline fact and must not be inferred from
Shop state. These exclusions do not alter the source facts above.
