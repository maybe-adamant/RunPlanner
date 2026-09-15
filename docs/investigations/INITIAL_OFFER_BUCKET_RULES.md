# Initial boon screens: native bucket contract

## Question and boundary

Which exact construction paths can produce an authored initial Olympian or
Hermes screen, after resolving its source-rarity inputs? Which facts belong to
individual eligibility, and which belong to complete-screen support?

This is a temporary source investigation against planner `6e1702a2` and
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts`. It consolidates independent
reads of native seeding, bucket filling and current planner consumers. It is
not an implementation checklist or a claim about a later game release.

The supported baseline is the progressed initial screen with three generation
positions. Rerolls, first-run overrides, profile-first-seen priorities and
requirement-stripping debug paths are excluded. Rejected restricts selection;
it does not reduce the native generation envelope. BBB, NPC, Chaos-pair, Hammer
and Spell composition are separate. Existing source-rarity arithmetic,
replacement transitions and acquisition effects remain their own authorities.

The planner tests possibility, not exact probability or RNG seed equivalence.
Its existing probability-support convention treats values at or below zero as
unable to succeed and values at or above one as guaranteed. Native
`RandomChance` uses `rng:Random() <= chance` (`RandomLogic.lua:120–125`); the Lua
snapshot alone does not establish endpoint behavior of that native RNG.

## Eligibility views must not be conflated

`IsTraitEligible` (`RunLogic.lua:99–130`) checks declaration existence,
`MaxAmount`, shared/elemental requirements, prior-picked exclusions, current-run
bans and `GameStateRequirements`. It does not generally reject ownership,
occupied slots or missing positive `TraitRequirements`. Callers add those
checks where required.

`HasTraitRequirements` (`RunLogic.lua:57–96`) accepts a successful declared
requirement family: `OneOf`, at least two members of `TwoOf`, or one member of
each `OneFromEachSet` group. Do not implicitly AND the alternative families.

Therefore neither the public picker's selectable rows nor a global occupied-core
flag is sufficient input to native priority generation. Both generation views
and picker views must use the same existing predicate facts without discarding
facts an earlier stage still needs. All views read the unchanged pre-offer hero
state; proposing an option never equips it.

## Ordered source rules

These rule identifiers connect source evidence and distinguishing witnesses;
they are not proposed production enums or a runtime rules registry.

### S1 — Source and seed precedence

`TraitLogic.lua:1765–1806` resolves forced Common or the normal chance table,
then writes blocked rarity values, before choosing initial seeds:

1. The excluded first-run override, if applicable.
2. Active Hymn (`ForceSwaps` with a use): attempt one replacement.
3. Otherwise, the normal replacement progression predicate, chance and
   `not ForceCommon` guard: attempt one replacement when all permit it.
4. An empty result falls through to the core helper.

Hymn bypasses the normal chance, progression and ForceCommon guards. It marks
`UseSwapTrait` only if it actually seeds a replacement; no candidate means core
fallback without that use. `HeroData.lua:170–188` declares the progressed
normal replacement chance as 0.1. Zero, optional and guaranteed probabilities
are useful arithmetic boundaries; Hymn is the native guaranteed-attempt witness.
No new authored replacement probability is implied.

### S2 — Exact replacement candidates

`UpgradeChoiceLogic.lua:795–821` examines the provider priority list. A candidate
must pass declaration eligibility, be unowned, target an occupied slot and have
a next rarity for its current occupant. The helper returns one candidate, not
the entire set. It supplies the occupant identity and explicit next rarity.
Common advances to Rare, Rare to Epic and Epic to Heroic; Heroic has no successor.
Initial generation passes no `onlyFromLootName` filter.

Supported planner state has one occupant per slot. Native handling of multiple
occupants does not justify inventing malformed planner states. Zero initial
replacement support does not prohibit the later replacement-rescue stage.

### S3 — Core-seed branch selection

`GetPriorityTraits` (`UpgradeChoiceLogic.lua:739–792`) first examines provider
priority identities passing declaration eligibility. Let `U` be their unowned,
vacant-slot identities, `H` mean at least one eligible priority identity is owned
or has an occupied slot, and `A` be Attack/Special members of `U`.

| Condition                                      | Native seeds                                           |
| ---------------------------------------------- | ------------------------------------------------------ |
| `H`, nonempty `U`                              | Exactly one member of `U`; no Attack/Special guarantee |
| `H`, empty `U`                                 | None                                                   |
| Not `H`, at most three members of `U`          | All members of `U`                                     |
| Not `H`, more than three members, nonempty `A` | Three distinct members including at least one of `A`   |
| Not `H`, more than three members, empty `A`    | Any three distinct members                             |

The marker `H` is provider-eligibility-sensitive, not simply any occupied core
slot. An owned core without `MaxAmount` can still pass declaration eligibility
and set it. An ineligible provider identity cannot set it merely because its
slot is occupied. All nine Olympians declare five priority cores; Hermes has
empty priority and weapon lists (`LootData_Hermes.lua:57–58`).

### S4 — Optional linked-priority insertion

`GetPriorityDependentTraits` (`UpgradeChoiceLogic.lua:855–875`) requires an
unowned provider identity, declaration eligibility, satisfied positive linked
requirements and a declared priority chance. `TraitLogic.lua:1816–1825` appends
successful rolls while capacity remains. Failure leaves the identity available
to ordinary filling; success removes it from all later buckets along with the
other seeds.

The complete in-scope matrix is `BlindChanceBoon` after Apollo Attack,
`MassiveKnockupBoon` after Hephaestus Attack/Special/Sprint, and
`PoseidonStatusBoon` after Poseidon Attack/Special, each at 0.25
(`TraitData.lua:143,178,223`). There is one per affected provider. A merely
offered prerequisite cannot unlock it. These probabilities are absent from the
current normalized trait declarations; priority identities and prerequisites
already exist there.

### S5 — Pool and rarity-table construction

Only a screen with fewer than three seeds needs the ordinary eligible pool
(`TraitLogic.lua:1858–1862`). Rarity buckets then include seeds plus eligible
ordinary entries, keyed by identity for every declared rarity-table member
(`1864–1888`). Missing rarity declarations default to Common-only. Do not
substitute the old ordinary/high-tier/replacement cardinality partitions.

Membership is `RarityLevels[key] ~= nil`, not positive numeric support or Lua
truthiness. An empty rarity table has no members. The ten current Infusions
do not have false/zero scalar rarity entries: six inherit Common/Rare/Epic
tables, while `ElementalDamageBoon`, `ElementalBaseDamageBoon`,
`ElementalDodgeBoon` and `ElementalHealthBoon` replace them with Common-only
tables (`TraitData_Elementals.lua:167–173,297–303,464–470,579–585`). Their
Rare/Epic keys are absent. Existing catalog membership for these ten agrees;
this does not call for another Infusion correction or rarity presentation work.

Bucket membership and roll chance are different facts. Keep an identity's
declared membership even when that rarity cannot win the ordinary random pass;
later rescue has different conditions. Selecting an identity removes it from
every rarity bucket, not just the winning one.

### S6 — Seed rarity

`TraitLogic.lua:1898–1918` preserves explicit replacement rarity. Other seeds
start at Common; supported checks run in native order and every successful
later check supersedes the earlier rarity. The ordinary order is Common, Rare,
Epic, Duo, Legendary (`TraitData.lua:713`), not numeric rarity rank. Heroic does
not become a fresh ordinary roll merely because it exists in a declaration.
After processing each seed, remove its identity from every bucket.

### S7 — Ordinary filling

`TraitLogic.lua:1920–1947` performs exactly the remaining number of draw attempts,
not an unbounded loop until three successes. Each attempt tentatively picks
from the remaining Common bucket. Nonempty rarity buckets are then tested in
roll order; a later success replaces the tentative identity and rarity.

Only the final successful identity is removed from all buckets. An overwritten
tentative Common choice is not consumed. An attempt may produce nothing if
Common is empty and all applicable checks fail. Guaranteed checks cannot be
treated as optional, and a missing bucket cannot win even with a guaranteed
chance. Bucket depletion can change the supported rarity of later positions.

### S8 — Replacement vacancy rescue

`TraitLogic.lua:1949–1961` fills actual remaining vacancies by calling the
replacement helper against the remaining priority identities. It does not roll
the normal replacement probability or check ForceCommon. Each successful
replacement removes its identity from the rescue priority list. No candidate
ends this stage. Preserve explicit promoted rarity from S2.

### S9 — Final rarity rescue and terminal screens

`TraitLogic.lua:1963–1993` performs final rarity rescue only when effective Denial
is off. This pass does not call `RandomChance`. It starts from Common, then
the last nonempty bucket in native roll order with a present truthy chance
entry wins. Lua numeric zero is truthy. The selected identity is removed from
all rarity buckets. Remaining vacancies or an empty list are legitimate only
after the applicable stages can terminate there.

Normal `GetRarityChances` constructs zero-valued entries for all rarity keys
(`RoomLogic.lua:2140–2143`). Forced Common instead clears the table, after which
`BlockRarities` can reinsert a zero-valued key (`TraitLogic.lua:1766,1781–1784`).
Do not collapse present-zero into absent, or use positive-chance support as a
substitute for rescue support. Existing permanent bans remain when Denial is
suppressed; suppressing it changes this generation branch, not past history.

Fallback Gold is inserted only for an empty generated list
(`UpgradeChoiceLogic.lua:149–150`), not as a fourth option or a reward appended
to a short nonempty list. Complete-offer support must account for all applicable
rescue stages before accepting it.

### S10 — Trial eligibility and zero-chance rescue are separate

`SynergyTrait.GameStateRequirements` excludes Devotion
(`TraitData.lua:869–875`). Most Duos inherit this requirement and never enter
Trial buckets, regardless of final-rescue chance handling. Five declarations
instead supply their own requirement table:

| Duo identity                | Own requirement table    |
| --------------------------- | ------------------------ |
| `ApolloSecondStageCastBoon` | `TraitData_Duo.lua:527`  |
| `GoodStuffBoon`             | `TraitData_Duo.lua:757`  |
| `SuperSacrificeBoonHera`    | `TraitData_Duo.lua:965`  |
| `SuperSacrificeBoonZeus`    | `TraitData_Duo.lua:1004` |
| `SelfCastBoon`              | `TraitData_Duo.lua:1297` |

`DeepInheritData` (`RunData.lua:1390–1417`) does not merge existing child tables
unless the parent declares deep inheritance or the child requests append/prepend.
These tables do neither. Consequently these five do not retain the inherited
Devotion predicate. Their own current-state and positive linked requirements
still apply. `IsTraitEligible` evaluates the resulting inherited declaration
(`RunLogic.lua:126–127`). No other Duo declaration in this file overrides the
base table this way.

For those five only, Trial's `BlockRarities` suppresses the ordinary Duo roll,
but its present-zero entry can still participate in S9 with Denial off. This
is not permission to admit every Duo in a Trial or to bypass any prerequisite.
The existing engine's blanket `devotionNoDuo && rarity === 'Duo'` check does
not express the full native distinction.

An ephemeral Lua probe executed the actual inherited declarations, requirement
and eligibility helpers, priority/replacement helpers, `GetRarityChances` and
`SetTraitsOnLoot`. It used a progressed Apollo Trial, no active Denial, bans,
Hymn, Ordinary or rarity bonuses, and deterministic failing chance draws
(`0.99`). The hero owned:

- `ZeusSpecialBoon` at Epic;
- Apollo Weapon, Cast, Sprint and Mana;
- `ApolloRetaliateBoon`, `BlindChanceBoon`, `ApolloBlindBoon`,
  `ApolloExCastBoon`, `ApolloCastAreaBoon`, `DoubleStrikeChanceBoon`;
- `ElementalRallyBoon` at Common and `DoubleExManaBoon` at Legendary.

Other listed owned traits used Common. Their inherited element declarations
gave Fire 7 / Air 5. Perfect Image, Apollo Special and Glorious Disaster were
unowned; Super Nova (`ApolloCastAreaBoon`) was owned. Apollo Ex Cast and Zeus
Special satisfy Glorious Disaster's linked prerequisites.
The actual native eligible pool and output were:

```text
eligible: ApolloSecondStageCastBoon, PerfectDamageBonusBoon
output:   PerfectDamageBonusBoon Common
          ApolloSpecialBoon Heroic, replacing ZeusSpecialBoon
          ApolloSecondStageCastBoon Duo
```

All core slots are occupied; the optional linked-priority trait is already
owned. Normal replacement seeding fails, ordinary filling picks Perfect Image
and then misses the zero-Duo attempts, replacement rescue supplies Apollo
Special, and final rescue supplies Glorious Disaster. There are no incompatible
slots or fabricated prerequisites. This is native-source execution, not an
in-game capture or proof of a complete authored acquisition history. A real
authored-history witness remains useful to verify the planner handoff.

Accepted disposition: represent the resolved eligibility distinction with the
existing catalog-owned context requirements and Trial's roll restriction in
the generation context. The five names are a declaration audit matrix, not an
engine exception switch. No new exception flag or Lua inheritance machinery
is needed; ordinary Duos declare the non-Trial requirement and these five do
not. Implementation remains pending.

### S11 — Hymn decorates every replacement alternative

`UpgradeChoiceLogic.lua:320–331` calculates every displayed replacement's level
from its old trait count plus `GetTotalHeroTraitValue("ExchangeLevelBonus")`.
The bonus is not reserved for the first displayed row or the initial replacement
seed. Separately, `UpgradeChoiceLogic.lua:1134–1142` consumes one Hymn use when
the screen's `UseSwapTrait` marker is set. S1 sets that marker after a successful
Hymn seed; it does not gate the per-row level calculation.

Multiple replacement alternatives are reachable with active Hymn: all five core
slots are occupied, the provider's ordinary pool is exhausted, and at least two
unowned provider cores remain eligible to replace their occupants. S1 seeds
one replacement, occupied cores are excluded from ordinary filling, and S8
rescues the remaining vacancies with further replacements. No proposed row
equips its trait while the other rows are constructed.

The current engine's `authoring/assessment.ts:451–464` applies `levelBonus: 2`
only to the first authored replacement through `hymnApplied`. The history fold
(`history/fold.ts:532–538`) has no later correction. This makes a non-first
selection lose the native bonus and makes row order semantically significant.

Recommended disposition: keep replacement transition decoration and one-use
screen consumption with their existing owners. Apply the active bonus to every
replacement alternative, with one exhausted active-Hymn witness that inspects
all alternatives, selects a non-first replacement and verifies its +2 level
credit and exactly one use consumed. This is a bounded E handoff correction,
not a new level system or acquisition lifecycle.

## Distinguishing source witnesses

| Witness                                                                  | Required distinction                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| All five eligible core slots empty                                       | Three cores, at least one Attack/Special                                                                   |
| Zeus Attack owned, Apollo Attack eligible                                | A replacement seed or one vacant Apollo core; no three-non-core initial screen                             |
| Same state but Apollo Attack banned                                      | Occupied Attack cannot set `H`; multi-core branch over other eligible cores                                |
| Apollo Attack itself owned and otherwise eligible                        | Ownership sets `H`; do not discard it before choosing the branch                                           |
| No eligible vacant cores or replacements                                 | No unconditional core obligation; later stages still run                                                   |
| Ordinary plus Hymn, with/without an eligible replacement                 | Exact promoted replacement or core fallback; no invented spend on failure                                  |
| Active Hymn with an exhausted pool and multiple replacement alternatives | Every replacement includes the level bonus; selecting a non-first row still consumes one use               |
| Optional linked-priority identity fails its priority roll                | It can still appear through ordinary filling                                                               |
| Rare/Epic copies of one identity                                         | A final selection removes both; a superseded tentative selection removes neither                           |
| Empty Common, optional specialty roll fails                              | A failed draw consumes an attempt but not a trait; rescue decides final width                              |
| Present-zero versus absent rarity entry                                  | Same failure to roll, different final-rescue participation                                                 |
| Supplied Apollo Trial, Denial active                                     | Nova replacement + Perfect Image + Exceptional Talent can omit Extra Dose                                  |
| Executed exhausted Apollo Trial, Denial off                              | Perfect Image + Apollo Special replacement + Glorious Disaster Duo; an ordinary inherited Duo stays absent |

## Authoring boundary and evidence limits

The accepted ordinary editor envelope is zero to three trait rows. Zero means
the existing `fallbackGold` variant, not an empty persisted `traits` array or
an unauthored offer. Removing the last row enters Gold; Add leaves it by appending
one individually eligible row. No separate fallback controls or valid-screen
completion requirement are needed for these structural edits. Composition still
decides whether Gold is legal, while initial authoring/Start over constructs a
supported traits-or-Gold outcome.

Add stays visible but disables at three rows or when no unused individually
eligible identity remains. Remove disables at zero. No invalid placeholder,
blank transient row or persisted-schema change is needed. Invalid composition
alone must not disable Add. Full-screen Save behavior and selected-child
completeness remain separate from row picker availability. BBB and fixed-size
providers retain their own structural contracts.

S10 closes the earlier source question about a possible zero-valued Trial
rescue; its planner correction is accepted but not yet implemented. No live-game
reproduction was performed. The investigation does not
claim exhaustive whole-run or profile-state coverage; the declared exclusions
above remain in force.

## Disposition

Replace the quota approximation with a bounded source-stage support calculation.
Keep individual picker eligibility separate from composition, and let structural
draft editing produce repairable findings. Preserve semantic owner addresses,
captured branch contexts, target repair and selected-acquisition handoffs.

Native uncertainty must be resolved or explicitly scoped before execution; it
must not become guessed production policy. At delivery closure, promote only
new source facts into the existing trait audits and delete this investigation.
