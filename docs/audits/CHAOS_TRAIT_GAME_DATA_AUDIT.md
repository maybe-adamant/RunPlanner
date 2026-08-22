# Chaos Trait Game-Data Audit

## Status and scope

This is an implementation-free source audit of `TrialUpgrade`: its paired
curse/blessing offers, the curse clocks, blessing maturation, and the effects
that intersect state already owned by the planner.

Natural-Chaos topology is already supported. This audit begins at the direct
`TrialUpgrade` pickup inside the entered Chaos room. It does not redesign gate
eligibility, room maps, or the ordinary outgoing continuation.

The evidence was checked on 2026-08-22 against the installed Hades II scripts:

- `LootData_Chaos.lua` for the complete permanent and temporary pools;
- `TraitData_Chaos.lua` and `TraitText.en.sjson` for identities, requirements,
  clocks, effects, and player-facing names;
- `TraitLogic.lua`, especially `GetEligibleTransformingTrait` and
  `SetTransformingTraitsOnLoot`;
- `UpgradeChoiceLogic.lua` for option construction, selection, and the
  curse-owned pending blessing;
- `RoomLogic.lua` and `TraitLogic.lua` for encounter, room, and trait-use
  expiration;
- `RunLogic.lua` and `PowersLogic.lua` for Expiring's real-time path and
  Chaos's keepsake-owned blessing path; and
- `RequirementsData.lua` for the progressed legacy-trait baseline.

## Eligibility baseline

The source unlocks the legacy Chaos subset after three lifetime
`TrialUpgrade` uses. That subset contains Strike, Flourish, Soul, Favor,
Affluence, Defiance, Pauper's, Atrophic, Enshrouded, Excruciating, Maimed,
Flayed, and Caustic. The planner's established fully progressed save baseline
satisfies this external gate, so all otherwise-contextual members remain in
the audited pool.

Contextual requirements still apply inside a run. Creation requires the
elemental-boon world upgrade; the progressed baseline includes it. Discovery
is excluded in Dream Runs and bounties. Chant requires at least one Aether.
Defiance and Barren each require an already-equipped mature Chaos blessing.
Atrophic is excluded with White Antler, and Maimed/Flayed are excluded with
Aspect of Supay. These are eligibility facts, not probability weights.

## The offer is three paired alternatives

`TrialUpgrade` is declared as transforming loot with two independent eligible
pools:

- 16 permanent blessings; and
- 17 temporary curses.

`SetTransformingTraitsOnLoot` constructs up to three alternatives. Each
alternative contains one blessing, one curse, and one shared rarity. Blessings
are removed from the local eligible pool, so the three blessing identities are
distinct. For curses, the source removes the selected curse 70% of the time
when more than one remains and otherwise samples without removal. Curse
identity therefore may repeat across the three visible alternatives.

The picker is not three independent choices made in sequence. The game offers
three already-paired curse/blessing alternatives and the player selects one
pair. A planner editor may present the selected outcome through three compact
fields—curse, blessing, and maturity value—but engine validation must assess
the pair against one pre-pickup context and must not imply that the game first
chooses a curse and then grants a free blessing choice.

Ordinary pairs can be Common, Rare, or Epic. `ChaosLastStandBlessing` has only
Legendary rarity. `ChaosMetaUpgradeCurse` marks its paired option as Heroic
unless the blessing's single fixed rarity takes precedence. The exact rarity
belongs to the selected pair because it controls benefit values and, for
Barren, the special pairing rule.

At selection, the game equips the curse. `UpgradeChoiceLogic` stores the
processed blessing under that curse's `OnExpire.TraitData`. The blessing is not
yet an equipped trait and must not contribute elements, satisfy trait
requirements, or qualify later Chaos legendaries during the curse interval.

## Blessing inventory and planner consequences

| Key                         | Name       | Source effect after maturation                               | Current planner consequence  |
| --------------------------- | ---------- | ------------------------------------------------------------ | ---------------------------- |
| `ChaosWeaponBlessing`       | Strike     | Attack damage                                                | combat-only                  |
| `ChaosSpecialBlessing`      | Flourish   | Special damage                                               | combat-only                  |
| `ChaosCastBlessing`         | Chasm      | Cast damage                                                  | combat-only                  |
| `ChaosHealthBlessing`       | Soul       | add Max Health                                               | health not simulated         |
| `ChaosManaBlessing`         | Mind       | add Max Magick                                               | magick not simulated         |
| `ChaosManaOverTimeBlessing` | Will       | magick regeneration                                          | combat-only                  |
| `ChaosExSpeedBlessing`      | Revelation | faster Omega charging                                        | combat-only                  |
| `ChaosRarityBlessing`       | Favor      | raises later god-boon rarity chances                         | may eliminate Common         |
| `ChaosMoneyBlessing`        | Affluence  | multiplies money gained                                      | money not simulated          |
| `ChaosElementalBlessing`    | Creation   | add every element                                            | must affect element history  |
| `ChaosManaCostBlessing`     | Talent     | reduces Omega magick costs                                   | combat-only                  |
| `ChaosSpeedBlessing`        | Celerity   | movement and Sprint speed                                    | combat-only                  |
| `ChaosDoorHealBlessing`     | Revival    | heal whenever leaving a room                                 | health not simulated         |
| `ChaosHarvestBlessing`      | Discovery  | chance to double tool resources; unavailable in Dream/bounty | resources not simulated      |
| `ChaosOmegaDamageBlessing`  | Chant      | Omega damage per Aether; requires at least one Aether        | eligibility is element-based |
| `ChaosLastStandBlessing`    | Defiance   | add one Death Defiance; requires a prior Chaos blessing      | trait history only           |

Creation is directly material to the current simulator. Its rarity levels add
one, two, three, or four of **each** element at Common, Rare, Epic, or Heroic.
Those elements can unlock Infusions and make Chant eligible at a later Chaos
offer. They enter history only when Creation matures.

Every matured blessing also matters as Chaos history: Defiance and Barren test
for any already-equipped Chaos blessing. A pending blessing inside an active
curse does not pass that test. Repeated natural-Chaos visits must therefore
evaluate against exact matured history, not merely prior `TrialUpgrade` use.

Favor usually changes probability without changing the supported possibility
set, but its exact Heroic roll has one planner-visible edge. The base Rare
chance is 10%. Heroic Favor contributes 80–100 percentage points to Rare, so
an exact bonus of at least 90 percentage points makes the Rare roll guaranteed
and Common impossible. Common, Rare, and Epic Favor cannot reach that
threshold. The planner does not need a general probability engine, but it must
retain whether the Heroic Favor outcome makes Rare guaranteed and suppress
Common when the combined Rare chance reaches 100% or more. Favor rarity alone
is insufficient because the Heroic value range straddles the threshold; the
raw percentage does not otherwise need to enter planner state.

Heroic eligibility remains acquisition-contextual rather than a universal
authoring option. In an ordinary `TrialUpgrade`, Common/Rare/Epic are the normal
rarities, but Barren's `UpgradePairedRarity` forces its paired blessing to
Heroic; a Barren/Favor alternative can therefore reach this edge directly.
The independently audited Cherished Heirloom plus Transcendent Embryo path can
also produce a Heroic Favor later. Both paths must consume the same Favor
effect semantics, while their offer/equip authorities remain responsible for
whether Heroic is actually obtainable.

The contextual authoring shape therefore extends by one outcome only when the
selected or granted trait is Heroic Favor: **Rare guaranteed** or **Common
still possible**. Barren/Favor exposes that child after the paired Chaos
selection. A future rank-IV Transcendent Embryo Favor result exposes the same
child after the keepsake roll. Non-Heroic Favor never exposes it and always
leaves Common feasible.

Defiance remains a real Death Defiance source in the game, but this Chaos slice
does not add a partial Death Defiance ledger. It records Defiance as matured
trait history, like the other effect-neutral-for-planning benefits. A future
complete Death Defiance model can consume that identity.

The remaining blessing effects have no current semantic consumer beyond their
identity, rarity, and later-Chaos prerequisite role. They should not invent
health, magick, money, tool-resource, or combat state merely to avoid being
called effect-neutral.

## Curse inventory and clocks

Most curses inherit a random three-to-five-encounter duration, but the pool is
not governed by one universal encounter clock.

| Key                          | Name         | Expiration clock                  | Source effect and relevant eligibility                   |
| ---------------------------- | ------------ | --------------------------------- | -------------------------------------------------------- |
| `ChaosNoMoneyCurse`          | Pauper's     | 3–5 encounters                    | blocks money gain                                        |
| `ChaosHealthCurse`           | Atrophic     | 3–5 encounters                    | lowers Max Health; excluded with White Antler            |
| `ChaosDamageCurse`           | Excruciating | 3–5 encounters                    | increases damage taken                                   |
| `ChaosPrimaryAttackCurse`    | Maimed       | 3–5 encounters                    | Attack damages player; excluded with Aspect of Supay     |
| `ChaosSecondaryAttackCurse`  | Flayed       | 3–5 encounters                    | Special damages player; excluded with Aspect of Supay    |
| `ChaosDeathWeaponCurse`      | Caustic      | 3–5 encounters                    | slain foes throw death projectiles                       |
| `ChaosSpeedCurse`            | Slothful     | 3–5 encounters                    | movement and Sprint penalty                              |
| `ChaosExAttackCurse`         | Gagged       | 3–5 encounters                    | Omega use damages player                                 |
| `ChaosCastCurse`             | Addled       | 3–5 encounters                    | Cast damages player                                      |
| `ChaosDashCurse`             | Neurotic     | 3–5 encounters                    | Dash drains magick                                       |
| `ChaosManaFocusCurse`        | Fixated      | 3–5 encounters                    | magick use reserves magick until next room               |
| `ChaosStunCurse`             | Paralyzing   | 3–5 encounters                    | taking damage stuns player                               |
| `ChaosTimeCurse`             | Expiring     | 2–3 encounters **or** 120 seconds | timeout deals 500 damage and removes the curse           |
| `ChaosMetaUpgradeCurse`      | Barren       | 3–6 encounters                    | disables Arcana; requires a prior matured Chaos blessing |
| `ChaosHiddenRoomRewardCurse` | Enshrouded   | 4–6 locations                     | hides door reward previews; Underworld-only source gate  |
| `ChaosCommonCurse`           | Ordinary     | 2–3 god-boon pickups              | forces those god offers to Common                        |
| `ChaosRestrictBoonCurse`     | Rejected     | 2–4 god-boon pickups              | removes one choice from those god offers                 |

For encounter-counted curses, `EndEncounterEffects` decrements the curse only
for a real primary encounter or active encounter override, unless the room
suppresses encounter uses. This naturally counts individual active Fields cage
encounters and does not count the presentation-only/fake encounters that the
planner has removed from noncombat rooms. Optional challenge encounters are
not silently equivalent to the room's primary encounter.

Enshrouded decrements on room transition through `UsesAsRooms`. Ordinary and
Rejected decrement only when a qualifying god-loot screen is resolved; Chaos
itself is not god loot. Their maturity points therefore depend on authored
room and reward chronology, not on a room-depth subtraction.

Expiring carries both an encounter count and a live 120-second timer. Clearing
the required encounters matures it normally. If the timer reaches zero first,
the game deals 500 damage and removes the curse; if the player survives, that
same removal matures the pending blessing immediately. The planner deliberately
models Expiring through its rolled two-or-three-encounter clock and assumes the
player completes that requirement. It does not model the real-time branch or
500-damage penalty because it owns neither gameplay time nor health damage.
This is a chosen planner simplification, not a claim that the source has only
an encounter clock.

## Maturation is derived history

When a curse reaches zero, `RemoveTraitData` removes its effects and adds its
stored `OnExpire.TraitData` with the same trait identity used by the selected
pair. The transition is atomic:

```text
TrialUpgrade selected
  -> curse equipped; blessing pending
  -> exact curse-specific counter advances
  -> curse removed and blessing equipped at expiration
```

The authored state must preserve the selected curse, selected blessing,
rarity, and exact rolled duration. The maturity **position** is derived by
folding subsequent encounter completions, room transitions, or god-boon
pickups. It is not a draggable Room Timeline action and should not be stored as
an independently chosen room coordinate.

For encounter clocks, the exact transition belongs to encounter-end history.
This makes later same-room actions observe the mature blessing when the source
does. An implementation plan must lock its ordering against other
encounter-end effects and deliveries rather than assigning maturation to room
entry or generic Cleanup.

## Effects that cannot remain cosmetic

Five source effects intersect current planner authority:

1. **Creation** changes the equipped element ledger and therefore Infusion and
   Chant eligibility after maturation.
2. **Ordinary** forces the next counted Olympian offers to Common. It affects
   option rarity, not merely tooltip text.
3. **Rejected** makes one fewer choice selectable in each counted Olympian
   offer, normally reducing a three-choice offer to two. The authored
   trait-offer contract must allow the engine-owned reduced shape while it is
   active.
4. **Barren** removes active Arcana until maturity and restores them on
   expiration. The required supported consequences are that Artificer uses are
   unavailable and Judgment does not trigger while Barren is active; this does
   not authorize a new matrix of unrelated Arcana effects.
5. **Favor** suppresses Common only for an exact roll whose resulting Rare
   chance is guaranteed. Other Favor rolls remain probability-only.

All other curse and benefit effects remain selected/matured trait history. The
planner does not add damage, health, magick, money, resources, combat effects,
door-preview state, or a partial Death Defiance ledger for them.

## Planner disposition

Chaos requires a separate implementation gate after Selene. A faithful gate
must own one selected paired outcome, a pending curse-to-blessing state, exact
curse-specific counters, and maturation in the history fold. It must not reuse
the ordinary one-trait offer shape as though the curse and blessing were both
immediately equipped.

The first complete Chaos pool models exactly the five consequences named
above. Claiming all 17 curses while treating Ordinary, Rejected, and Barren as
cosmetic would be incorrect. Claiming all 16 blessings while omitting
Creation's elements or Favor's guaranteed-Rare edge would likewise be
incorrect.

All selected traits and matured benefits still remain available to later Chaos
eligibility, trait history, and Run State even when their gameplay effect is
outside the simulator. Maturity is derived through encounter counting,
location counting, or qualifying god-boon-pickup counting according to the
source curse. Expiring deliberately uses the encounter-count path and assumes
success; no authored timer outcome is added.
