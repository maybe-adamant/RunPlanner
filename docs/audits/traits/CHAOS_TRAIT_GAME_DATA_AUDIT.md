# Chaos Trait Game-Data Audit

## Status and scope

This is an implementation-free source audit of `TrialUpgrade`: its paired
curse/blessing offers, the curse clocks, blessing maturation, and the effects
that intersect state already owned by the planner.

Natural-Chaos topology is already supported. This audit begins at the direct
`TrialUpgrade` pickup inside the entered Chaos room. It does not redesign gate
eligibility, room maps, or the ordinary outgoing continuation.

The evidence was checked on 2026-08-22 and the Denial contact was rechecked on
2026-08-27 against the installed Hades II scripts:

- `LootData_Chaos.lua` for the complete permanent and temporary pools;
- `TraitData_Chaos.lua` and `TraitText.en.sjson` for identities, requirements,
  clocks, effects, and player-facing names;
- `TraitLogic.lua`, especially `GetEligibleTransformingTrait`,
  `SetTransformingTraitsOnLoot`, `GetProcessedTraitData`, and
  `GetProcessedValue`;
- `UpgradeChoiceLogic.lua` for option construction, selection, and the
  curse-owned pending blessing;
- `RoomLogic.lua` and `TraitLogic.lua` for encounter, room, and trait-use
  expiration;
- `RunLogic.lua` and `PowersLogic.lua` for Expiring's real-time path and
  Chaos's keepsake-owned blessing path;
- `RoomLogic.lua`, `HeroData.lua`, `MetaUpgradeData.lua`, and
  `TraitData_MetaUpgrade.lua` for the ordered rarity-chance ledger; and
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
pair. All three curses are processed button identities, while each blessing is
stored below its paired curse. Engine validation must assess all three curse
identities against one pre-pickup context and must not imply that the game first
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

### Denial bans unselected curses, not blessings

`TrialUpgrade` inherits `BaseLoot.BanUnpickedBoonsEligible = true` and does not
override it when setting `GodLoot = false`. Data inheritance therefore leaves
the Denial hook active on the Chaos screen. For a transforming option,
`CreateUpgradeChoiceButton` deep-copies the processed curse into
`button.Data`; the paired blessing remains nested at
`button.Data.OnExpire.TraitData`.

When Vow of Denial is active, `HandleUpgradeChoiceSelection` iterates the other
upgrade buttons and writes `otherUpgradeButton.Data.Name` to
`CurrentRun.BannedTraits`. The two unselected **curse** identities are therefore
banned from later Chaos generation. Their paired blessing identities are never
written to the ban table. If an unselected option repeats the selected curse,
the name-equality check skips it; two unselected options may also collapse to
one distinct banned curse when their curse identities repeat.

Every displayed curse is also written to the lifetime `GameState.TraitsSeen`
table when its button is built. That presentation/progression fact is outside
the run planner's modeled inputs. It does not make an unselected blessing seen,
picked, equipped, or eligible as Chaos history. Apart from the exact Denial
bans, the two unselected options create no run-state consequence owned by the
planner.

## Numeric outcomes are processed when the screen constructs each option

The shared rarity applies to the blessing, not the curse. Chaos curses declare
no `RarityLevels`, so their duration and effect rolls use their source ranges
unchanged even though `GetProcessedTraitData` receives the option rarity. A
blessing's rarity multiplier scales its declared values before the processed
blessing is stored under the curse.

For every `BaseMin`/`BaseMax` field, the source draws a separate random float.
It then applies the rarity multiplier and normalizes the result as follows:

- `SourceIsMultiplier` scales the delta from `1`, rather than the multiplier
  itself;
- `AsInt` rounds to an integer;
- `ToNearest` floors to the declared step;
- all other processed values round to two decimal places unless they declare a
  different precision; and
- `MaximumValue` clamps after rounding.

Nested values are processed in stable key order for deterministic RNG use, but
two declarations with the same range are still two independent rolls unless
one explicitly uses `DeriveSource`/`DeriveValueFrom`. The processed curse and
pending blessing therefore already contain the exact gameplay operands before
the player makes a selection.

This produces a closed payload shape rather than a universal pair of numeric
sliders:

- all 17 curses have exactly one rolled duration;
- 9 curses also have exactly one independently rolled effect value;
- all 16 blessings have a concrete processed numeric result or fixed effect;
- 12 blessings make at least one independent magnitude roll;
- 11 of those blessings make exactly one independent magnitude roll;
- Revelation has two independently rolled values from the same source range;
  and
- Creation, Celerity, Chant, and Defiance derive their numeric result from
  rarity or context without a second within-rarity magnitude roll.

The declaration must therefore identify zero, one, or more named numeric
results and whether each result is independently variable or derived from
rarity/context. A consumer may present the common one-variable case compactly,
but it must not imply within-rarity variation where the source has none or
collapse Revelation's two runtime rolls into one value.

## Blessing inventory and planner consequences

Processed ranges below are the final gameplay values after rarity scaling and
normalization. `C/R/E/H` means Common, Rare, Epic, and Heroic.

| Key                         | Name       | Numeric result and source of variation                                                                      | Processed range or deterministic result by rarity                                                                                                                 | Current planner consequence  |
| --------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `ChaosWeaponBlessing`       | Strike     | Attack multiplier                                                                                           | damage bonus C `20–50%`; R `30–75%`; E `40–100%`; H `50–125%`                                                                                                     | combat-only                  |
| `ChaosSpecialBlessing`      | Flourish   | Special multiplier                                                                                          | damage bonus C `30–60%`; R `45–90%`; E `60–120%`; H `75–150%`                                                                                                     | combat-only                  |
| `ChaosCastBlessing`         | Chasm      | Cast multiplier                                                                                             | damage bonus C `20–50%`; R `30–75%`; E `40–100%`; H `50–125%`                                                                                                     | combat-only                  |
| `ChaosHealthBlessing`       | Soul       | Max Health added                                                                                            | integer C `26–35`; R `52–70`; E `78–105`; H `104–140`                                                                                                             | health not simulated         |
| `ChaosManaBlessing`         | Mind       | Max Magick added                                                                                            | integer C `30–40`; R `45–60`; E `60–80`; H `75–100`                                                                                                               | magick not simulated         |
| `ChaosManaOverTimeBlessing` | Will       | Magick restored per second                                                                                  | integer C `4–6`; R `8–12`; E `12–18`; H `16–24`                                                                                                                   | combat-only                  |
| `ChaosExSpeedBlessing`      | Revelation | **Two independent rolls:** the reported all-weapon/Omega multiplier and a second weapon-property multiplier | both processed multiplier ranges are C `0.85–0.90`; R `0.78–0.85`; E `0.70–0.80`; H `0.63–0.75`, equivalent to `10–15%`, `15–22%`, `20–30%`, and `25–37%` faster  | combat-only                  |
| `ChaosRarityBlessing`       | Favor      | Rare-chance bonus                                                                                           | C `40–50%`; R `54–67%`; E `67–84%`; H `80–100%`; fixed `+10%` Epic, Duo, and Legendary chances are not additional rolls                                           | may eliminate Common         |
| `ChaosMoneyBlessing`        | Affluence  | Money multiplier                                                                                            | value increase C `40–60%`; R `80–120%`; E `120–180%`; H `160–240%`, floored to `5%` steps                                                                         | money not simulated          |
| `ChaosElementalBlessing`    | Creation   | element count; selected by shared rarity, with no within-rarity roll                                        | deterministic `+1/+2/+3/+4` of every element at C/R/E/H                                                                                                           | must affect element history  |
| `ChaosManaCostBlessing`     | Talent     | Magick-cost multiplier                                                                                      | cost reduction C `20–30%`; R `30–45%`; E `40–60%`; H `50–75%`, floored to `5%` steps                                                                              | combat-only                  |
| `ChaosSpeedBlessing`        | Celerity   | move/Sprint values; selected by shared rarity, with no within-rarity roll                                   | deterministic move-speed bonus `15/20/25/30%`, Sprint velocity `297/396/495/594`, and Sprint cap `133.5/178/222.5/267` at C/R/E/H                                 | combat-only                  |
| `ChaosDoorHealBlessing`     | Revival    | Health restored per room exit                                                                               | integer C `3–4`; R `9–12`; E `15–20`; H `21–28`                                                                                                                   | health not simulated         |
| `ChaosHarvestBlessing`      | Discovery  | Double-resource chance                                                                                      | C `56–70%`; R `64–80%`; E `72–90%`; H `80–100%`, rounded to `1%` and capped at `100%`; doubled amount is fixed at `+100%`                                         | resources not simulated      |
| `ChaosOmegaDamageBlessing`  | Chant      | per-Aether damage value; selected by shared rarity and Aether context, with no within-rarity roll           | deterministic per-Aether damage bonus `30/36/42/48%` at C/R/E/H; total is `1 + per-Aether delta × current Aether count` and is re-derived when that count changes | eligibility is element-based |
| `ChaosLastStandBlessing`    | Defiance   | fixed effect                                                                                                | fixed Legendary; adds one Death Defiance with fixed `40%` Health and Magick restoration                                                                           | trait history only           |

Revelation is the only blessing that defeats a literal one-slider payload.
`WeaponSpeedMultiplier.Value` supplies the reported value, while a separate
`PropertyChanges` entry rolls the same `0.85–0.90` range again for a narrower
weapon set. Both tables are independently traversed by `GetProcessedTraitData`;
there is no `DeriveValueFrom` link between them. A faithful game export must
retain both processed multipliers even if the editor keeps the unreported one
in an advanced or compact secondary control.

Celerity and Chant do have concrete numeric outcomes. Celerity's selected
rarity fixes its move/Sprint values; Chant's selected rarity fixes its
per-Aether value and current Aether fixes its total. Their declarations use
`BaseValue` plus fixed rarity `Multiplier` entries, so neither performs a
second `RandomFloat` magnitude draw within one rarity. The editor should show
their exact numeric result, but there is no source range for a variable slider
after rarity and context are fixed.

Creation is directly material to the current simulator. Its rarity levels add
one, two, three, or four of **each** element at Common, Rare, Epic, or Heroic.
Those elements can unlock Infusions and make Chant eligible at a later Chaos
offer. They enter history only when Creation matures.

Every matured blessing also matters as Chaos history: Defiance and Barren test
for any already-equipped Chaos blessing. A pending blessing inside an active
curse does not pass that test. Repeated natural-Chaos visits must therefore
evaluate against exact matured history, not merely prior `TrialUpgrade` use.

Favor's exact Rare-chance roll belongs in the same ordered rarity-chance ledger
as every other source. The ordinary god-boon baseline is Rare `10%`, Epic `5%`,
Duo `12%`, and Legendary `10%`. Additive `RarityBonus` effects are applied to
that baseline before `MultiplicativeRarityBonus` effects. Favor adds its rolled
Rare value plus fixed `10%` Epic, Duo, and Legendary values. Excellence adds
Rare chance and multiplies Legendary chance; Divinity adds Epic chance. The
ledger must consume the active Arcana rank and exact processed Favor roll,
rather than a Chaos-specific `Rare guaranteed` boolean.

Heroic Favor contributes `80–100%` Rare chance. With the ordinary `10%` Rare
baseline, an exact Favor bonus of at least `90%` makes the Rare check guaranteed
and Common impossible even without Excellence. Lower Heroic rolls can still
become guaranteed after other additive rarity sources are folded. Common, Rare,
and Epic Favor do not reach that threshold by themselves, but the ledger—not
the Favor declaration in isolation—owns the final feasibility result.

Proper Upbringing contributes its active `GodLootOnly` Rare `+1` to this same
chance ledger. It also performs a separate chronological transition that
promotes eligible already-equipped Common traits to Rare when its elemental
requirement becomes active. The ledger contribution and already-owned promotion
must share exact element/trait history without being collapsed into one
`minimum rarity` shortcut. The complete source facts remain owned by the
[boon rarity ledger audit](BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md).

Heroic eligibility remains acquisition-contextual rather than a universal
authoring option. In an ordinary `TrialUpgrade`, Common/Rare/Epic are the normal
rarities, but Barren's `UpgradePairedRarity` forces its paired blessing to
Heroic; a Barren/Favor alternative can therefore contribute the Heroic range
directly. The independently audited Cherished Heirloom plus Transcendent Embryo
path can also produce a Heroic Favor later. Both paths feed the same exact
Favor effect into the rarity ledger while retaining their separate authority
over how Heroic became obtainable.

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

| Key                          | Name         | Rolled duration        | Independently rolled curse effect  | Fixed/derived source effect and eligibility                     |
| ---------------------------- | ------------ | ---------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `ChaosNoMoneyCurse`          | Pauper's     | `3–5` encounters       | none                               | blocks money gain                                               |
| `ChaosHealthCurse`           | Atrophic     | `3–5` encounters       | Max Health `-29` to `-20`, integer | excluded with White Antler                                      |
| `ChaosDamageCurse`           | Excruciating | `3–5` encounters       | damage taken `+20–50%`             | --                                                              |
| `ChaosPrimaryAttackCurse`    | Maimed       | `3–5` encounters       | self-damage `3–6`, integer         | excluded with Aspect of Supay                                   |
| `ChaosSecondaryAttackCurse`  | Flayed       | `3–5` encounters       | self-damage `3–6`, integer         | excluded with Aspect of Supay                                   |
| `ChaosDeathWeaponCurse`      | Caustic      | `3–5` encounters       | none                               | slain foes throw death projectiles                              |
| `ChaosSpeedCurse`            | Slothful     | `3–5` encounters       | movement multiplier `0.40–0.60`    | Sprint effects derive from that one roll; Apollo cap is fixed   |
| `ChaosExAttackCurse`         | Gagged       | `3–5` encounters       | self-damage `5–8`, integer         | --                                                              |
| `ChaosCastCurse`             | Addled       | `3–5` encounters       | self-damage `3–6`, integer         | --                                                              |
| `ChaosDashCurse`             | Neurotic     | `3–5` encounters       | Magick loss `10–20`, integer       | --                                                              |
| `ChaosManaFocusCurse`        | Fixated      | `3–5` encounters       | none                               | Magick use reserves Magick until the next room                  |
| `ChaosStunCurse`             | Paralyzing   | `3–5` encounters       | stun duration `0.50–1.40` sec      | actual value is rounded to `0.01`; tooltip displays one decimal |
| `ChaosTimeCurse`             | Expiring     | `2–3` encounters       | none                               | fixed `120` sec timer and `500` timeout damage                  |
| `ChaosMetaUpgradeCurse`      | Barren       | `3–6` encounters       | none                               | disables Arcana; requires a prior matured Chaos blessing        |
| `ChaosHiddenRoomRewardCurse` | Enshrouded   | `4–6` locations        | none                               | hides door reward previews; Underworld-only source gate         |
| `ChaosCommonCurse`           | Ordinary     | `2–3` god-boon pickups | none                               | forces those god offers to Common                               |
| `ChaosRestrictBoonCurse`     | Rejected     | `2–4` god-boon pickups | none                               | blocks one of three generated choices from selection            |

Every curse therefore needs its exact duration value. Only Atrophic,
Excruciating, Maimed, Flayed, Slothful, Gagged, Addled, Neurotic, and
Paralyzing need a second authored numeric operand. Slothful is still a
one-operand case because its Sprint-property values explicitly derive from its
single movement-speed roll.

For encounter-counted curses, `EndEncounterEffects` decrements the curse only
for a real primary encounter or active encounter override, unless the room
suppresses encounter uses. This naturally counts individual active Fields cage
encounters and does not count the presentation-only/fake encounters that the
planner has removed from noncombat rooms. Optional challenge encounters are
not silently equivalent to the room's primary encounter. This is a count of
qualifying encounter-end-effect checkpoints after the earlier
completion fact, not subtraction from `CurrentRun.BiomeEncounterDepth`: that
cache advances at encounter start only for encounters declaring
`CountsForRoomEncounterDepth` and resets between biomes, while a Chaos curse
can remain active across that boundary.

Enshrouded decrements once in `LeaveRoom` when the player takes the door to the
next room, including the departure from the Chaos room in which it was
acquired. It does not read `CurrentRun.BiomeDepthCache`. That cache is rebuilt
from biome-local room history and resets between biomes; it merely correlates
with successive room departures on a simple linear path. Ordinary and Rejected
decrement only when a qualifying god-loot screen is resolved; Chaos itself is
not god loot. Their maturity points therefore depend on authored lifecycle and
reward events, not on subtraction from either depth cache.

Rejected does not reduce generation to two identities. `SetTraitsOnLoot` still
fills the ordinary god offer to `GetTotalLootChoices()`—three options. The
screen then creates one index for every generated option, removes only
`CalcNumLootChoices()` indices from that blocked set, and leaves one randomly
chosen index blocked while Rejected is active. The third option is visible and
processed, enters `GameState.TraitsSeen`, and receives the `TraitLocked`
interaction block; the player may select either of the other two. Its lock
overlay supports only the locked hover presentation. It does not run the normal
`MouseOverBoonButton` path, does not become `screen.MouseOverButton`, and
therefore cannot expose or receive the Rarify action. The option is visible but
neither selectable nor Rarifiable.

This distinction is material with Vow of Denial. After selection, Denial
iterates every other button in the three-option `screen.UpgradeButtons` array
without excluding `screen.BlockedIndexes`. At its current two-ban rank, it bans
both unpicked identities for the rest of the night, including the option that
Rejected made unselectable. A faithful authored offer therefore retains all
three concrete identities plus the exact blocked identity; it must not collapse
the offer to a two-option array.

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

The authored state must preserve all three displayed curse identities and their
rolled requirements so Denial and the visible option envelope remain exact. It
must additionally preserve which option was selected, that selected curse's
independent rolled operands, the selected blessing and shared rarity, and the
selected blessing's declaration-owned rolled operands. The maturity
**position** is derived by folding subsequent qualifying encounter-end-effect
checkpoints, room transitions, or god-boon pickups. The preceding encounter
completion remains a distinct fact. Maturity is not a draggable Room Timeline
action and should not be stored as an independently chosen room coordinate.

For encounter clocks, the exact transition consumes
`encounterEndEffectsApplied`, the explicit checkpoint after encounter
completion. This makes later same-room actions observe the mature blessing
when the source does without treating every completion or encounter-depth
advance as equivalent. Noncombat and declaration-owned
`SkipEndEncounterEffects` phases do not advance the clock. Fig Leaf-skipped
execution still advances it when the resolved phase permits end effects; in P,
only the terminal phase does so.

## Effects that cannot remain cosmetic

Five source effects intersect current planner authority:

1. **Creation** changes the equipped element ledger and therefore Infusion and
   Chant eligibility after maturation.
2. **Ordinary** forces the next counted Olympian offers to Common. It affects
   option rarity, not merely tooltip text.
3. **Rejected** keeps three generated Olympian identities but makes one exact
   option unselectable. The authored trait-offer contract must retain that
   blocked option because it is still seen and can be consumed by Vow of
   Denial's unpicked-trait ban.
4. **Barren** removes active Arcana until maturity and restores them on
   expiration. The required supported consequences are that Artificer uses are
   unavailable and Judgment does not trigger while Barren is active; this does
   not authorize a new matrix of unrelated Arcana effects.
5. **Favor** contributes its exact processed rarity bonuses to the ordered
   rarity-chance ledger. Common is suppressed only when the folded Rare chance
   is guaranteed.

Ordinary and Rejected apply to eligible Olympian and Hermes source screens:
the source checks `GodLoot or TreatAsGodLootByShops` and consumes the curse use
when that screen closes. A structurally valid fallback-Gold result therefore
still consumes one use of the active curse even though it equips no god trait.
This is screen-resolution chronology, not a narrower count of successfully
equipped Olympian boons.

All other curse and benefit effects remain selected/matured trait history. The
traits themselves remain fully modeled catalog/authored identities with exact
payload, eligibility, chronology, Run State visibility, and export identity;
only their unsupported gameplay effects are simulation-neutral. The planner
does not add damage, health, magick, money, resources, combat effects,
door-preview state, or a partial Death Defiance ledger for them.

Vow of Denial adds one cross-offer consequence: after a selected Chaos option,
the exact unselected curse identities enter the same run-local banned-trait
authority used by later eligibility. Unselected blessings, rarities, and
numeric values remain irrelevant to that transition and need not become
authored planner state.

## Planner disposition

The schema-51 selected-pair model is no longer sufficient because it cannot
derive Denial's exact run-local bans. The durable planner shape is three ordered
curse options, each with its curse identity and rolled requirement, plus one
selected-option identity. Only the selected option additionally owns the
curse's zero-or-one independent intensity value, its paired blessing, shared
rarity, and the blessing's declaration-owned zero, one, or two independent
intensity values.

The two unselected blessings and their numeric values remain source-generated.
They are not Denial bans, do not enter picked/equipped Chaos history, and have
no other planner-owned run consequence. A later game-module consumer may let
the game generate those peers while reserving the authored selected blessing;
the planner does not fabricate identities for state it does not consume.

The source evidence does not support a universal fixed `{ curseMagnitude,
benefitMagnitude }` schema. Requirement units depend on the curse: qualifying
encounters, room departures/locations, or resolved god offers. Independent
intensity fields remain declaration-closed. Rarity- and history-derived
deterministic values are recomputed from their authorities rather than
redundantly authored. A legal catalog-owned starting value may reduce editor
labor, but it is an authoring convenience rather than a claimed source-game
default.

Any of the 17 curses and 16 blessings may become real selected/matured trait
history. The five consequences named above are active in their owning existing authorities:
Creation adds elements on maturation; Ordinary constrains fresh god-offer
rarity; Rejected retains the blocked third option and Vow of Denial contact;
Barren temporarily suppresses Arcana consequences including Artificer and
Judgment; and Favor contributes to the offer-local rarity ledger. Separately,
Denial folds the two exact unselected Chaos curse identities into later curse
eligibility without treating their blessings as offered or banned traits.

All selected traits and matured benefits still remain available to later Chaos
eligibility, trait history, and Run State even when their gameplay effect is
outside the simulator. Maturity is derived through encounter counting,
location counting, or qualifying god-boon-pickup counting according to the
source curse. Expiring deliberately uses the encounter-count path and assumes
success; no authored timer outcome is added. Trial Upgrade is a direct
acquisition and is not an Echo Reward Reward Reward replay source.
