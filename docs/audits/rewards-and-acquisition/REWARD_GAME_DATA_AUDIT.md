# Reward Game-Data Audit

## Purpose

This document records the game-data evidence behind `../design/REWARD_MODEL.md` and the
Phase 2.6 reward-kernel closure. It is an audit note, not a
second design authority. When this document and the model disagree, the model
must be reconciled before implementation proceeds.

Primary evidence comes from the current game scripts:

- `LootData.lua` for counted reward stores;
- `RewardLogic.lua` for store initialization, entry eligibility, depletion,
  refill, Boon sources, and Devotion setup;
- `RoomLogic.lua` for generated-door store resolution, O wheels, H cages, and N
  hub offers;
- `StoreData.lua` and `StoreLogic.lua` for shop groups and entry-time generation;
- `InteractLogic.lua`, `ConsumableData.lua`, `WorldUpgradeData.lua`, and loot
  creation paths for acquisition history and source-sensitive consumable
  upgrades.

## Disposition Vocabulary

Every audited behavior receives one of four dispositions:

`Exact`
: The planner represents the same support, ordering, lifecycle, and observable
state used by the game within the declared baseline.

`Simplified`
: The planner deliberately admits or merges behavior. The lost distinction and
its consequence must be stated; simplification must never be described as
exact.

`Deferred`
: The behavior is a coherent additive feature that is intentionally absent from
the first complete model. The canonical trace suppresses or fixes it so the
omission cannot silently change the supported spine.

`Excluded`
: The behavior is outside the selected planning baseline, normally because it
depends on save/profile state, equipment, a bounty, a dream run, or an
unsupported route detour. Production declarations contain no zombie predicate
for it.

`Current coverage` is separate from disposition. A game behavior may have an
exact target model while production remains pending.

## Baseline

The planner models possibility, not probability. Positive weights and chances
do not make an authored outcome more or less valid. Zero support, forced
support, finite multiplicity, requirements, physical ordering, and without-
replacement selection remain semantic.

The baseline assumes:

- a normal non-bounty, non-dream run;
- no keepsake or trait forcing a reward or Boon source;
- the declared route order;
- external save/profile progression predicates removed from production data;
- store rerolls suppressed; NPC gift internals and reward-duplication effects
  use the explicit dispositions in the trait audit. The active Story-NPC plan
  scopes implementation to source-sensitive Nectar and Narcissus.

Removing external predicates is not automatically equivalent to selecting one
concrete fully progressed save. When raw data contains mutually exclusive save
tiers, the planner must select the tier consistent with its declared baseline
rather than unioning every externally gated entry.

## Global Reward Mechanics

| Mechanic                    | Game behavior                                                                                                                                                               | Disposition                   | Phase 2.6 consequence                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counted-store lifetime      | Every store is deep-copied into one run-local mutable bag at run start                                                                                                      | Exact                         | Scratch bag state is route-scoped, not room-scoped                                                                                                                              |
| Offer-time depletion        | Every generated counted offer removes one exact bag entry, including unpicked doors, wheels, cages, and side rooms                                                          | Exact                         | Offer materialization mutates bags before entry/acquisition                                                                                                                     |
| Offer-time fact projection  | Devotion setup records `LastDevotionDepth` when the offer is materialized, including for an unpicked target                                                                 | Exact                         | Add a reward-type `devotionSpacing` offer projection; never infer it from acquisition                                                                                           |
| Same-batch duplicates       | Entry-level `AllowDuplicates`; otherwise an earlier peer with the same duplicate key blocks the later peer                                                                  | Exact                         | Normalize `allowDuplicates`, default false                                                                                                                                      |
| Entry selection             | The game randomly removes one eligible concrete entry                                                                                                                       | Exact support, not RNG replay | Retain exact states internally; diagnostics aggregate only proven-equivalent semantic states.                                                                                   |
| Refill                      | When no entry in the whole bag is eligible, append a complete base set while retaining leftovers; repeat once more; after two refills fall back to `RoomRewardHealDrop`     | Exact raw picker behavior     | Supported planner consumers require at most one refill; see the reachability proof below                                                                                        |
| Reward priority queue       | Keepsakes can prioritize an otherwise eligible reward                                                                                                                       | Excluded                      | Neutral equipment baseline contains no priority queue                                                                                                                           |
| Bounty overrides            | Active bounties can replace store declarations and forced rewards                                                                                                           | Excluded                      | No bounty predicates or alternate bags                                                                                                                                          |
| Generated base-store ratio  | Entered-room store history influences RunProgress versus MetaProgress support                                                                                               | Simplified                    | Preserve possible/forced support, not probability or RNG state                                                                                                                  |
| Generated target stores     | Physical target scan may let a later forced store become the shared store used by an earlier ordinary target                                                                | Exact                         | Preserve the verified two-pass, physical-order algorithm                                                                                                                        |
| Store history               | Entered rooms can record resolved store provenance even when their visible producer did not consume that bag                                                                | Exact                         | Keep store-history policy separate from reward producer                                                                                                                         |
| Rerolls                     | Rerolls regenerate doors or shop inventory and perturb RNG                                                                                                                  | Deferred                      | Canonical trace performs no rerolls                                                                                                                                             |
| Duplicate/bonus traits      | Traits may add extra rewards or duplicate pickups                                                                                                                           | Deferred                      | Canonical lifecycle emits only the authored producer's concrete acquisitions                                                                                                    |
| Nectar run-progress upgrade | With `WorldUpgradeGiftDropRunProgress`, a `GiftDrop` instance created with `RunProgressUpgradeEligible` keeps its Nectar pickup and also attempts one random `+1` Pom level | Exact supported source split  | Ordinary room rewards opt in; Shop inventory does not. An empty target set is a valid no-op; the effect belongs to the producer/acquisition binding, not globally to `GiftDrop` |

### Offer-time side effects

`SetupRoomReward` performs all common offer selection before entry. Counted
entry consumption, same-batch duplicate tracking, Boon peer-source exclusion,
and canonical offer history are shared offer-point mechanics.

Devotion has one additional supported persistent effect at that boundary:
after choosing its encounter, setup writes the current `RunDepthCache` to
`LastDevotionDepth`. This happens for every materialized Devotion offer and is
not conditional on entering its target or acquiring either source. The
`RequiredMinRoomsSinceEvent` check later reads that exact marker.

The closed Phase 2.6 offer-projection vocabulary is therefore `none` and
`devotionSpacing`. No other supported reward type writes a persistent
current-run fact merely by being offered. Devotion's global encounter record is
presentation/progression evidence with no supported downstream planner
consumer and remains outside the canonical projection.

### Latent Bag State

Multiplicity entries are not interchangeable merely because they share a
reward name. Once `ordinaryLootCount` is satisfied, for example, both the base
and qualified `MaxHealthDrop` entries are eligible and the game may remove
either exact entry. The possibility simulator therefore retains distinct exact
post-consumption bag states and must not choose declaration order as a hidden
tie-breaker.

That exact internal split does **not** currently imply two behaviorally
different supported futures. A fresh audit of the normalized stores found:

- the base and `ordinaryLootCount` copies of `MaxHealthDrop`, `MaxManaDrop`, and
  `RoomMoneyDrop` become interchangeable after their requirements overlap,
  because ordinary-loot history is monotonic;
- the two `StackUpgrade` copies share `stackLegal`, and the qualified copy only
  adds the same monotonic ordinary-loot condition;
- the early and late `WeaponUpgrade` requirements cannot overlap: the first
  requires no prior Hammer, while the second requires exactly one prior Hammer
  and at least three entered biomes;
- every other same-reward multiplicity in the normalized stores has the same
  requirement as its peers.

The generic kernel deliberately keeps exact entry identity so later catalog
changes do not acquire an invented tie-breaker. A diagnostic editor surface,
however, should project the effective bag: aggregate states by reward,
eligibility, and retained requirement evidence, and expose a range only if a
future catalog makes the aggregate count genuinely differ. It must not present
today's unobservable exact-entry split as multiple run histories.

## Counted Store Inventory

| Store                   | Projected entries | Live use                                                                  | Disposition and notes                                                                                              |
| ----------------------- | ----------------: | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `RunProgress`           |                18 | Ordinary generated rewards, F/G/P free preboss rewards, O wheels, H cages | Exact target. Four Boon entries allow duplicates; all other entries do not                                         |
| `MetaProgress`          |                13 | Ordinary generated rewards and O wheels                                   | Exact fully progressed projection from the raw 19-entry store; see below                                           |
| `HubRewards`            |                10 | N initial combat-room offers                                              | Exact target. Five Boon entries allow duplicates                                                                   |
| `SubRoomRewards`        |                23 | N ordinary side-room offers                                               | Exact current-run target; external elemental unlock is excluded                                                    |
| `SubRoomRewardsHard`    |                 8 | N hard side-room offers                                                   | Exact target                                                                                                       |
| `FieldsOptionalRewards` |                19 | Automatic H optional rewards                                              | Exact persistent bag; generated optionals are independently acquired                                               |
| `TartarusRewards`       |                 9 | I non-goal combat offers                                                  | Exact target under the common external-predicate baseline                                                          |
| `TyphonBossRewards`     |                 6 | Q miniboss offers                                                         | Exact target under the common external-predicate baseline                                                          |
| `Secrets`               |                 1 | Chaos detour                                                              | Raw counted-store replay is excluded; the unified Chaos direct one-entry `TrialUpgrade` normalization is supported |
| `MinorRunProgress`      |                13 | No supported canonical producer                                           | Excluded until a live supported producer requires it                                                               |
| `PreHubRewards`         |                 0 | None                                                                      | Excluded; empty game declaration                                                                                   |
| `FieldsCombatRewards`   |                 0 | None                                                                      | Excluded; empty game declaration                                                                                   |

### RunProgress

The target declaration preserves all 18 entries in game order:

- two each of health, mana, money, Stack, and Hammer;
- one Hermes, Devotion, Spell, and Talent;
- four Boons with `allowDuplicates: true`.

Current-run requirements remain exact: acquired ordinary gods, the
equipped-trait-derived upgradeable count, Hammer history, current active shop
options at the evaluation point, entered biome count, Hermes history, Devotion
depth/spacing/exits, Spell state, and Talent state. External introduction and
unlock gates are excluded. The equipped-trait ledger and its canonical fold are
owned by the trait-offer authority; loot acquisition never increments a shadow
trait counter.

`SpellDropRequirements` also reads `PendingSpellDrop`, but the canonical route
never uses the separately deferred Surface Shop delivery system that sets it.
The value is therefore exactly false in the supported trace. `TalentLegal`
reads `AllSpellInvestedCache`; the planner derives its equivalent from the
installed finite Hex tree's latched closure state. After a writable Path screen
fills the then-current tree, future ordinary Talent generation is unsupported;
committed delivery retains its separately audited settlement path.

### MetaProgress

The raw 19-entry store combines early ordinary resources, later ordinary
resources for low lifetime-resource tiers, and later large resources for high
lifetime-resource tiers. The two later tiers are mutually exclusive for one
concrete save.

The planner's fully progressed baseline selects one coherent 13-entry
projection:

| Route phase          | Projected entries                                             | Retained requirement                               |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| All phases           | one `GiftDrop`                                                | none; the external Gift unlock is assumed complete |
| `EnteredBiomes <= 1` | two `MetaCurrencyDrop`, four `MetaCardPointsCommonDrop`       | early-half range only                              |
| `EnteredBiomes > 1`  | two `MetaCurrencyBigDrop`, four `MetaCardPointsCommonBigDrop` | late-half range only                               |

The two late ordinary Bones entries and four late ordinary Ash entries are
omitted because their raw `LifetimeResourcesGained` alternatives represent the
lower-progression tier. Their high-tier counterparts remain. Early ordinary
resources remain because the game continues to use them on a fully progressed
save during the first two biomes.

This is `Exact` within the declared fully progressed baseline. If save
progression later becomes a project input, it should select another coherent
store projection rather than adding external GameState predicates to the
generic current-run requirement DSL.

### Nectar run-progress upgrade

The fully progressed baseline includes
`WorldUpgradeGiftDropRunProgress`. Its effect is not an unconditional property
of the `GiftDrop` acquisition identity:

- `ConsumableData.GiftDrop.RunProgress` replaces the pickup use function with
  `UseStoreRewardRandomStack` only when the constructed item also receives
  `RunProgressUpgradeEligible = true`;
- ordinary room-reward spawning in `RewardLogic.lua` passes that flag, so a
  room-acquired Nectar records the exact `GiftDrop` resource/use acquisition
  and then raises one random Pom-eligible equipped trait by one level when at
  least one exists;
- World Shop spawning in `StoreLogic.lua` does not pass the flag, so purchased
  Nectar records `GiftDrop` but grants no trait level; and
- Echo's `EchoLastReward` recreation path explicitly passes the flag for a
  replayed consumable. `GiftDrop`'s effective `LastRewardEligible` value is
  `true` because the later of its two raw assignments wins, so replayed Nectar
  receives the random `+1` effect as well.

Unlike normal `StoreRewardRandomStack` sources, Nectar is not gated by
`StackUpgradeLegal`. `AddStackToTraits` accepts an empty eligible set and simply
performs no mutation. Source-eligible Nectar therefore needs a legal
empty-target outcome; a non-empty target domain still resolves exactly one
target.

The supported model must therefore keep `GiftDrop` as the one concrete
acquisition in reward history and attach the random level mutation at an exact
producer/lifecycle binding. It must not globally add a level effect to the
`GiftDrop` declaration, synthesize a `StoreRewardRandomStack` acquisition, or
infer the effect from whether the UI happens to call an offer a room reward.
Any later producer must declare whether its game creation path supplies the
flag.

### Later-store contents

The later-biome declarations must preserve these concrete multisets:

- `HubRewards`: large health, large mana, Hammer, Hermes, Spell, and five Boon
  entries with duplicates allowed;
- `SubRoomRewards`: one each of small mana, small health, empty small health,
  tiny money, four elemental boosts, and Gift; two each of Bones, Ashes,
  ordinary health, ordinary mana, Stack, money, and Minor Talent;
- `SubRoomRewardsHard`: two each of ordinary health, ordinary mana, Stack, and
  money;
- `FieldsOptionalRewards`: three small mana, three small health, three tiny
  money, one heal, one armor, one Gift, one Bones, four Ashes, and two Minor
  Talents;
- `TartarusRewards`: triple money, triple Stack, two Hammer entries, Devotion,
  large Talent, and three duplicate-permitted Boons;
- `TyphonBossRewards`: two duplicate-permitted Boons, large Talent, triple
  Stack, and two Hammer entries.

Stack, Talent, Hammer, Hermes, Spell, and Devotion retain their applicable
current-run requirement trees. External unlock predicates are excluded under
the common baseline rather than represented as inert requirement kinds.

## Refill Reachability Proof

### Raw rule and proof boundary

`ChooseRoomReward` evaluates one mutable bag for one resolved offer. When no
entry is eligible, it appends the complete base store while retaining every
leftover, increments a call-local refill counter, and recursively evaluates the
same offer. After two unsuccessful appends it returns
`RoomRewardHealDrop`.

Within one supported picker call, the current-run facts, room filters, and
`previouslyChosenRewards` peer list do not change during recursion. None of the
projected store-entry requirements uses a chance predicate. The second appended
base set therefore has exactly the same eligibility support as the first. It
cannot make an entry eligible when the first complete set contained no eligible
entry; in raw game code it only delays the final Heal fallback.

The planner can consequently use one refill exactly when every reachable
supported call satisfies this invariant:

```text
if the current bag has no eligible entry,
the complete projected base store has at least one eligible entry
```

This is an offer-support proof, not merely a bag-size comparison. It includes
producer filters, entry requirements, `allowDuplicates`, cross-store duplicate
keys in a shared peer list, and the widest reachable peer scope.

### Supported-store results

| Store                   | Fresh-set eligibility witness                                                                                                                                                                                                                                                       | Consumer pressure                                                                                                                                                                                                                                                                | Result                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `RunProgress`           | Four unconditional `Boon` entries set `AllowDuplicates = true`. Every supported RunProgress producer admits Boon; Boon-only miniboss filters strengthen rather than weaken this witness. Boon source setup separately retries with weaker exclusions and finally no peer exclusion. | H can generate six RunProgress cages in one two-target batch; width is irrelevant because the witness permits duplicate reward types.                                                                                                                                            | First refill always succeeds. |
| `MetaProgress`          | The fully progressed projection has exactly three eligible identities in either phase: Gift/Bones/Ashes early or Gift/Big Bones/Big Ashes late.                                                                                                                                     | G is the maximum with three Meta offers in one peer list. Before the third offer at most two of those identities are blocked. F and P have at most two; an O wheel has at most two and owns a fresh peer list. Supported mixed-store peers do not use a colliding duplicate key. | First refill always succeeds. |
| `HubRewards`            | Five unconditional `Boon` entries set `AllowDuplicates = true`. The easy-room exclusions for Hammer, Hermes, and the concrete Hephaestus source do not exclude the generic Boon reward entries.                                                                                     | N materializes nine or ten persistent hub offers in one peer list. Width is irrelevant because the witness permits duplicate reward types.                                                                                                                                       | First refill always succeeds. |
| `SubRoomRewards`        | Even without conditional Stack/Talent entries, ten distinct identities are unconditional: small mana, small health, empty small health, tiny money, Gift, Bones, Ashes, ordinary health, ordinary mana, and ordinary money.                                                         | At most three generated side-room siblings share a peer list, possibly mixing ordinary and hard stores. At most two earlier peers can block two of these identities.                                                                                                             | First refill always succeeds. |
| `SubRoomRewardsHard`    | Ordinary health, ordinary mana, and ordinary money are three distinct unconditional identities; Stack is additional conditional support.                                                                                                                                            | At most three generated siblings share the mixed side-room peer list. Before the third hard-store offer, at most two earlier peers can block two of the three unconditional identities.                                                                                          | First refill always succeeds. |
| `FieldsOptionalRewards` | Small mana, small health, tiny money, Heal, Armor, Gift, Bones, and Ashes all have unconditional entries; only Minor Talent is conditional.                                                                                                                                         | Each optional pickup calls the picker without `previouslyChosenRewards`, so optional peers do not duplicate-block one another. The bag persists across calls and the implemented H producer consumes it sequentially at room entry.                                              | First refill always succeeds. |
| `TartarusRewards`       | Ordinary I combat excludes Boon but retains unconditional triple money. Reprieve also retains triple money. I minibosses admit only the three unconditional duplicate-capable Boon entries.                                                                                         | A two-exit I batch produces at most one Tartarus non-goal peer after its Goal or generated Preboss offer. The witness is valid independently of that bound.                                                                                                                      | First refill always succeeds. |
| `TyphonBossRewards`     | Two unconditional `Boon` entries set `AllowDuplicates = true`.                                                                                                                                                                                                                      | Q resolves two independently generated miniboss peers in one batch.                                                                                                                                                                                                              | First refill always succeeds. |

The MetaProgress count refers only to calls that consume the `MetaProgress`
bag. H optional pickups use `FieldsOptionalRewards`, and N side rooms use
`SubRoomRewards` or `SubRoomRewardsHard`; containing meta-resource reward types
does not make either producer a MetaProgress consumer.

### Stores outside the supported proof

| Store                 | Reason it does not weaken the planner invariant                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Secrets`             | Raw counted-store replay remains excluded. The supported unified Chaos projection normalizes its direct one-entry `TrialUpgrade` outcome without replaying the raw store.                                            |
| `MinorRunProgress`    | No supported canonical producer consumes it. A future producer must establish its filters and maximum peer scope before activation.                                                                                  |
| `PreHubRewards`       | The game declaration is empty and has no live supported consumer. N PreHub explicitly uses `RunProgress`. Calling this empty bag would reach the raw fallback and is treated as an invalid producer/store contract.  |
| `FieldsCombatRewards` | The game declaration is empty. H combat rooms are `NoReward`, their old store override is commented out, and cages explicitly use `RunProgress`. Calling this empty bag would be an invalid producer/store contract. |

Shops are ordered entry-generated groups rather than counted bags and never use
the counted-store refill path.

### Planner consequence

Every reachable counted-store call in the selected planner baseline is proven
to resolve after zero or one refill. The simulator therefore preserves the
exact first-refill behavior—append one complete base set without discarding
leftovers—but does not model a second identical append or synthesize the raw
Heal fallback. If a supported call remains empty after the first refill, that
is a declaration, consumer, or baseline drift invariant failure.

This does not remove `RoomRewardHealDrop` as a normal reward identity.
`FieldsOptionalRewards` contains an explicit Heal entry. It is ordinary
counted-store content rather than the picker fallback.

## Boon and Devotion Payloads

The progressed baseline ordinary source domain contains Aphrodite, Apollo,
Ares, Demeter, Hephaestus, Hera, Hestia, Poseidon, and Zeus. Hermes is a
separate reward and does not count toward the ordinary four-source cap.

### Source-support policies

Source support is not payload validation. The `BoonSource` domain only proves
that a value is an ordinary god source; game history and lifecycle determine
whether that source can be resolved at one concrete point. Phase 2.6 therefore
normalizes a closed source-policy registry rather than dispatching on reward
names.

#### Ordinary generated Boon

- The cap check counts the union of sources already acquired in loot history
  and earlier same-batch Boon sources, including unpicked offers.
- Before that union reaches four sources, all eligible ordinary sources are the
  primary pool. At the cap, the primary pool narrows to acquired sources.
- Earlier same-batch Boon sources are then excluded from the primary pool.
- If those exclusions exhaust support, game setup retries with weaker
  exclusions and finally no exclusions. The unrestricted retry recomputes the
  cap without peer sources, so it may restore the full ordinary domain when
  fewer than four sources have actually been acquired. Same-batch source
  uniqueness is therefore strict only while the primary pool remains nonempty.
- Keepsake-forced sources are excluded from the neutral baseline.

This behavior is `Exact` support logic. The planner does not reproduce source
probabilities. The normalized policy is `ordinaryBoonPeer`, resolved at offer
generation.

Ephyra makes the fallback observable in an ordinary door batch. `HubRewards`
contains five duplicate-capable Boon entries, and the miniboss door can add a
sixth Boon from `RunProgress`; all participate in the same peer list while the
board is materialized. With two sources acquired before the Hub, the board can
first represent those sources and two new sources, then use the unrestricted
retry for two further globally eligible sources. Visiting all six Boon rooms
can therefore leave Ephyra with six distinct acquired ordinary sources even
though the ordinary source cap is four.

#### Shop RandomLoot and Blind Box

`RandomLoot` and `BoostedRandomLoot` call `GetEligibleInteractedGod` while shop
inventory is generated. Under the fully progressed baseline, every ordinary
god satisfies the persistent interaction side of that function. Current-run
support therefore follows ordinary source eligibility and the four-source cap
without generated-peer exclusion. Both shop entries normalize to
`ordinaryNoPeer` at offer generation; their option-entry identities remain
distinct for without-replacement selection.

`BlindBoxLoot` does not resolve its source during shop generation. Purchasing
the box records the box use and then calls ordinary `ChooseLoot` with no peer
exclusion. It uses the same `ordinaryNoPeer` support rule at its authored-source
acquisition role. The different resolution point, not a second source-policy
implementation, expresses the distinction.

### Devotion role and timing

A Devotion offer selects two distinct sources from ordinary god loot already
present in `CurrentRun.LootTypeHistory`. Supported Devotion producers require at
least two acquired ordinary sources, so the raw fallback to a new eligible god
is unreachable under the selected baseline. The selection does not apply
ordinary same-batch peer exclusion or re-run the four-source cap over that
already-acquired set. The normalized policy is `devotionAcquiredPair`, resolved
at offer generation.

On entry the player chooses one member before combat and receives the other,
spurned source after combat. The game-generated pair is unordered for planner
support, while the authored payload uses `chosenSource` and `spurnedSource` to
record the player's ordered execution intent. Both orderings of every supported
pair are valid.

Both acquisitions occur before the next room is generated. The ordered roles
remain authored because the game observes them during the room and execution
must reproduce the choice: the selected chosen-source trait folds before
combat, and the spurned-source trait folds after combat. Their exact loot/use
records and equipped-trait state therefore remain distinct even when both
sources are acquired in one room.

## Offer Resolution and Concrete Acquisition

One string alias cannot connect a store entry directly to history. Store-entry
identity, resolved-offer identity, concrete acquisition identity, acquisition
timing, and history projection are separately observable. The game writes
distinct loot, run-use, and biome-use ledgers, and one offer can produce zero,
one, or multiple concrete acquisitions.

The write boundary confirms the distinction. `RecordUse` indexes global,
current-run, biome, and current-room use records by the concrete used object's
name. `HandleLootPickup` separately indexes `LootTypeHistory` and
`LootBiomeRecord` by the concrete loot object's name. A `Boon` store entry is
therefore not written to loot history as `Boon`; after offer resolution, the
picked-up source such as `ApolloUpgrade` is the observed loot identity.

Phase 2.6 must normalize the following distinct declarations or derived
records:

- counted store entries with reward type, requirements, multiplicity, and
  duplicate policy;
- resolved reward offers retaining both reward type and complete payload;
- reward-type acquisition roles with typed identity resolution from the
  complete offer;
- producer and encounter lifecycle bindings for those roles at explicit
  points;
- concrete acquisition declarations with zero or more typed history writes.

The complete role-resolution families are:

| Producer                       | Store/option identity | Resolved offer                                  | Concrete acquisition timing and identity                                                                                                            | Disposition                                                                 |
| ------------------------------ | --------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Ordinary `Boon`                | `Boon`                | `Boon` plus visible source                      | acquire the concrete source, such as `ApolloUpgrade`, on room-reward pickup                                                                         | Exact                                                                       |
| `Devotion`                     | `Devotion`            | chosen and spurned source roles                 | acquire chosen source before combat, then spurned source after combat                                                                               | Exact roles and concrete trait lifecycle                                    |
| `Story`                        | fixed `Story`         | structural Story offer                          | no concrete acquisition                                                                                                                             | Exact                                                                       |
| Structural `Shop`              | fixed `Shop`          | structural Shop offer                           | no incoming acquisition; entered shop creates option offers                                                                                         | Exact                                                                       |
| `ClockworkGoal`                | fixed goal marker     | structural Clockwork Goal                       | decrement goal counter on entered spawn; no ordinary concrete acquisition                                                                           | Exact                                                                       |
| `WeaponUpgradeDrop` shop offer | wrapper option        | `WeaponUpgradeDrop`                             | acquire concrete `WeaponUpgrade` on purchase                                                                                                        | Exact                                                                       |
| `ShopHermesUpgrade`            | wrapper option        | `ShopHermesUpgrade`                             | acquire concrete `HermesUpgrade` on purchase                                                                                                        | Exact; wrapper identity remains relevant to active shop-option requirements |
| `RandomLoot` / boosted variant | distinct option entry | `RandomLoot` plus source resolved at generation | acquire that concrete source on purchase                                                                                                            | Exact support; rarity detail deferred                                       |
| `BlindBoxLoot`                 | `BlindBoxLoot`        | `BlindBoxLoot` plus authored hidden source      | record the box, then validate/acquire that source after purchase                                                                                    | Exact target; source support is acquisition-time                            |
| Big/Triple/resource variants   | concrete variant      | same exact visible variant                      | acquire and preserve that variant's exact game-history identity                                                                                     | Exact                                                                       |
| `StoreRewardRandomStack`       | wrapper option        | visible random-Stack wrapper                    | preserve concrete wrapper acquisition/history and apply one random `+1` Pom mutation                                                                | Exact                                                                       |
| source-eligible `GiftDrop`     | exact Nectar identity | same `GiftDrop`; no wrapper alias               | preserve `GiftDrop` acquisition/history and attempt one random `+1` Pom mutation only at opted-in producer bindings; empty support is a valid no-op | Exact within the progressed baseline                                        |

An optional semantic-effect alias may later help trait/resource simulation, but
it must not replace the concrete acquisition identity used by requirements.

### Exhaustive concrete acquisition registry

The supported reward surface uses two history projection profiles, independent
of acquisition kind. Every identity in this table is exact and exhaustive for
the Phase 2.6 store/shop inventory.

| Acquisition kind | History projection | Concrete acquisition identities                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loot`           | `lootAndUse`       | `AphroditeUpgrade`, `ApolloUpgrade`, `AresUpgrade`, `DemeterUpgrade`, `HephaestusUpgrade`, `HeraUpgrade`, `HestiaUpgrade`, `PoseidonUpgrade`, `ZeusUpgrade`, `HermesUpgrade`, `StackUpgrade`, `StackUpgradeBig`, `StackUpgradeTriple`, `WeaponUpgrade`                                                                                                                                                                                                                                           |
| `loot`           | `consumableAndUse` | `SpellDrop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `consumable`     | `consumableAndUse` | `MaxHealthDrop`, `MaxHealthDropBig`, `MaxHealthDropSmall`, `EmptyMaxHealthSmallDrop`, `MaxManaDrop`, `MaxManaDropBig`, `MaxManaDropSmall`, `Currency`, `RoomMoneyDrop`, `RoomMoneyTripleDrop`, `RoomMoneyTinyDrop`, `TalentDrop`, `TalentBigDrop`, `MinorTalentDrop`, `RoomRewardHealDrop`, `HealBigDrop`, `ArmorBoost`, `ArmorBigBoost`, `AirBoost`, `EarthBoost`, `FireBoost`, `WaterBoost`, `ElementalBoost`, `StoreRewardRandomStack`, `LastStandDrop`, `ChaosWeaponUpgrade`, `BlindBoxLoot` |
| `resource`       | `consumableAndUse` | `GiftDrop`, `MetaCurrencyDrop`, `MetaCurrencyBigDrop`, `MetaCardPointsCommonDrop`, `MetaCardPointsCommonBigDrop`, `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, `CharonPointsDrop`                                                                                                                                                                                                                                                                                                            |

`lootAndUse` increments exact-name current-run use, biome-use, current-room use,
loot-type, and loot-biome records. `consumableAndUse` increments exact-name
current-run use, biome-use, current-room use, and consumable records. The
generic interaction path and `ManualRecordUse` split decide who calls
`RecordUse`, but supported acquisitions still write it exactly once.

`SpellDrop` is the intentional cross-kind exception. Although it is declared in
LootData and remains a `loot` acquisition, its custom spell-screen flow calls
`RecordConsumableItem` and does not pass through `HandleLootPickup`; therefore
it does not write loot histories. Resource pickups use the consumable history
path while retaining `resource` kind. Exact resource quantities and
affordability remain deferred. Persistent `GameState.UseRecord` is deliberately
outside the project boundary; the table is exact for current-run history.

The role registry composes those concrete identities as follows:

- direct loot, consumable, and resource reward types use one `self` role;
- `Boon` uses one `payloadSource` role targeting its authored `BoonSource`;
- Devotion uses ordered `payloadSource` roles targeting `chosenSource` before
  combat and `spurnedSource` after combat;
- `RandomLoot` and the distinct `BoostedRandomLoot` shop entry both resolve one
  `RandomLoot` offer with an authored source at shop generation and acquire that
  source on purchase; the supporting entry remains derived witness provenance;
- `WeaponUpgradeDrop` uses a fixed `WeaponUpgrade` loot role;
- `ShopHermesUpgrade` uses a fixed `HermesUpgrade` loot role;
- `BlindBoxLoot` uses a self `BlindBoxLoot` consumable role on purchase followed
  by an authored-source loot role validated after unwrap;
- `Story` and structural `Shop` have no acquisition roles;
- `ClockworkGoal` has no concrete acquisition role and decrements the goal
  counter through its entered-spawn structural lifecycle;
- `StoreRewardRandomStack`, Big/Triple drops, and every resource variant remain
  exact self identities. They never project a related base name. A
  source-eligible `GiftDrop` still writes only `GiftDrop`; its separate level
  mutation does not alias that acquisition to `StoreRewardRandomStack`.

Ordinary god-source loot updates the acquired-source set and reaches its
authored concrete trait offer at the declared acquisition role. Hermes remains
outside the ordinary-god source set. Other resource, health, mana, armor, Last
Stand, and weapon mutation effects retain their documented simplified or
deferred dispositions rather than entering an untyped semantic-effect bag.

The registry intentionally omits raw `Secrets` counted-store replay while
supporting the unified Chaos direct one-entry `TrialUpgrade` normalization. It
also omits `ElementalBoost`, whose I/Q shop entry is Dream-only. The four
individual elemental boosts remain supported through N side-room rewards even
though their ordinary World Shop entries are also Dream-only. The commented
Devotion block inside `HubRewards` is not a live store entry.

## Shops

Shops are entry-generated option groups, not counted bags. Every group filters
its options by requirements and chooses its declared number of offers without
replacement. Positive weights affect probability only and may be omitted from
the possibility model; group membership, offer count, requirements, and
without-replacement support are semantic.

| Profile       | Game groups | Offers | Route use                                                   | Target disposition        |
| ------------- | ----------: | -----: | ----------------------------------------------------------- | ------------------------- |
| `WorldShop`   |           3 |      3 | F/G/P/N midshops and preboss shops                          | Exact structural support  |
| `I_WorldShop` |           5 |      5 | Entered I preboss                                           | Exact second-half support |
| `Q_WorldShop` |           5 |      6 | Entered Q preboss; first group produces two distinct offers | Exact second-half support |

The current three-union `WorldShop` representation is only a Phase 1
prototype. The final catalog needs ordered groups, `offerCount`, per-option
requirements, per-option payload rules, and a complete authored slot for every
offer emitted by the group. Two offers from one group are distinct authored
slots and cannot select the same option entry.

### Ordinary WorldShop groups

| Group | Offers | Supported options under the baseline                                              | Modeled current-run conditions                                                               |
| ----- | -----: | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1     |      1 | `RandomLoot`, `BlindBoxLoot`, `ShopHermesUpgrade`                                 | Hermes biome-use and route loot history; Blind Box's external unlock is excluded             |
| 2     |      1 | two distinct `WeaponUpgradeDrop` entries, heal, health, armor, Ashes, Bones, Gift | Hammer early/late history and current shop exclusion; external armor/Gift gates are excluded |
| 3     |      1 | mana, Stack, random Stack, Spell, Talent                                          | upgradeable trait count, Spell/Talent run state, and current shop exclusion                  |

The two Hammer entries keep distinct keys and requirements even though both
author the same resolved-offer identity.

### I and Q second-half groups

Normal route order guarantees that I and Q preboss shops use their second-half
branches. First-half options remain game evidence but are declaration-time
impossible for these route positions. The complete phase-sensitive matrices
and their future reordered-biome disposition are owned by the focused
[`../rooms-and-routes/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md`](../rooms-and-routes/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md).

`I_WorldShop` emits one offer from each group:

1. boosted random Boon or large Stack;
2. random Boon, Blind Box, health, mana, Stack, Talent, or Spell;
3. large heal, large armor, or Last Stand;
4. shop Hermes, Chaos weapon upgrade, boosted random Boon, large health, or
   large mana;
5. `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, or `CharonPointsDrop` under
   the fully progressed baseline.

`Q_WorldShop` emits two distinct offers from group 1 and one from every later
group:

1. boosted random Boon, large Stack, random Boon, Blind Box, health, mana,
   Talent, or Spell;
2. large heal or large armor;
3. large heal, large armor, or Last Stand;
4. shop Hermes, Chaos weapon upgrade, boosted random Boon, large health, or
   large mana;
5. `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, or `CharonPointsDrop` under
   the fully progressed baseline.

Spell, Talent, Stack, Hermes, and Chaos weapon upgrade keep their current-run
requirements. The Chaos option requires an acquired Hammer. Last Stand requires
a missing use at both generation and purchase. Because exact Last Stand combat
loss and inventory are deferred, v1 treats an authored Last Stand offer or
purchase as a possible valid-use outcome rather than deriving that inventory.
This is a named `Simplified` support expansion, not an unconditional option in
the exact game model.

Shop inventory generation occurs during transition into the room, before its
outgoing doors are generated. The Shop noncombat encounter then initiates exit
generation before ordinary player purchases. Consequently Hammer, Hermes,
Spell, and Talent `RequiredNotInStore` checks used by that outgoing generation
observe the complete generated inventory, not a post-purchase remainder. The
requirement kind should be `notInCurrentRoomShopOptions` rather than implying a
counted bag.

Purchases later remove items and update acquisition history, but the outgoing
rooms and rewards are already materialized and are not revalidated. A shop
Boon can therefore introduce a fourth ordinary source after the same shop's
outgoing batch already offered a fifth source. The purchase first affects room
generation at the selected next room's outgoing-generation checkpoint. The
canonical profile and source-backed fixture are specified in
`../design/ROOM_LIFECYCLE_MODEL.md`.

Exact money, health, last-stand inventory, prices, discounts, and affordability
are `Deferred`. V1 authors one exact order of offered options purchased under a
sufficient-resource and valid-use assumption. This preserves acquisition and
outgoing-door consequences but may admit a purchase that one concrete resource
state could not afford. The Last Stand support expansion above is separately
`Simplified` because its missing-inventory condition controls generation as
well as purchase.

The exact occurrence-owned `roomActions.order` is the authored chronology.
Initial Shop purchase participation is the presence of its exact
`interactShopOffer` reference; sparse acquisition sites retain payloads only.
A Blind Box persists its intended eventual source in authored payload while
keeping that source game-hidden and semantically dormant until purchase. An
earlier purchased Boon can change whether the authored source is then possible.
Possibility simulation validates the authored order and hidden source only in
that order; it retains reward-source branches but never retries another
permutation. Store rerolls remain deferred.

## Biome Reward Producer Map

| Biome | Modeled producers                                                                                       | Disposition notes                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F     | Run/Meta generated rewards, forced Run rewards, Story, takeover Preboss Shop/free roles                 | Exact support; base-store probability simplified                                         |
| G     | Same core producers as F plus linked boss store provenance                                              | Exact support; locked-door interaction deferred; base-store probability simplified       |
| P     | Run/Meta rewards, takeover Preboss Shop/free roles, linked boss provenance                              | Exact NPC-free reward support; NPC gift internals deferred                               |
| Q     | Reward-free spine, `TyphonBossRewards` minibosses, declaration-fixed width-one Preboss Shop             | Exact supported reward topology; no invented Run/Meta base store                         |
| H     | Declaration-owned RunProgress offers, ordered cages, optional pickups, takeover Preboss Shop/free roles | No generated base-store value; exact cage and persistent `FieldsOptionalRewards` support |
| O     | Ordered Run/Meta reward wheels, fixed Devotion, declaration-fixed width-one Preboss Shop                | Exact wheel support and source-derived outgoing store; probability simplified            |
| I     | Derived Goal/NonGoal, `TartarusRewards`, generated Preboss Shop                                         | Exact structural support; Goal emits no ordinary concrete acquisition                    |
| N     | Persistent `HubRewards` board, RunProgress minibosses, side bags, completed-Hub Preboss Shop            | Exact persistent offer support; NPC internals deferred                                   |

Boss-specific and weapon-dependent automatic drops are not projected as
RunProgress or MetaProgress acquisitions. Boss/postboss Room Declarations still
carry their exact layout position and entered-store history policy.

## Phase 2.6 Gate

The reward catalog is not ready for canonical Phase 3 history until all of the
following are true:

1. store entries own `allowDuplicates` and exact current-run requirements;
   the shared picker appends at most one complete base set while retaining
   leftovers, and a still-empty supported call fails its refill invariant;
2. counted simulation preserves distinct exact post-consumption bag states
   without requiring diagnostic consumers to expose behaviorally equivalent
   internal splits;
3. reward types, resolved offers, concrete acquisitions, and history
   projections are distinct; reward types own closed self/fixed/payload-source
   roles and producer lifecycle supports zero/multiple acquisition points;
4. Devotion payload roles are explicit;
5. every source-bearing reward type selects an audited source-support policy
   and semantic resolution point;
6. shops use ordered group declarations with offer counts, per-option
   requirements, and without-replacement support;
7. Blind Box persists its intended hidden source, and purchased-shop simulation
   validates it in the one persisted authored order without trying another
   permutation;
8. `WorldShop`, `I_WorldShop`, and `Q_WorldShop` are distinct complete profiles;
9. MetaProgress normalizes the exact 13-entry fully progressed projection and
   rejects the mutually exclusive 19-entry union;
10. excluded and deferred mechanics remain out of production requirement data;
11. offer projections include exact Devotion offer-time spacing and no
    acquisition-time substitute;
12. every supported concrete acquisition selects the audited `lootAndUse` or
    `consumableAndUse` history-projection profile independently of acquisition
    kind;

Phase 2.7 must then switch F/G persistence and consumers to this reward
authority. Phase 2.8 requires every dormant later-biome declaration to use the
same normalized vocabulary before Phase 3 begins.

## Current Planner Disposition

Schema 41 retains exact concrete acquisition identity through Echo's two
reward-facing effects. Reward Reward Reward folds the latest successfully
settled effective `LastRewardEligible` recreation descriptor and settles the
mandatory recreated entry through the ordinary acquisition roles. This keeps
replayed Nectar on its opted-in run-progress path and keeps Blind Box identity
separate from its resolved source.

World Shop profiles retain only their declaration-owned initial slots.
Infernal Contract, Travel Deal, and Gold use fixed supplemental entry keys in
the existing room-exit settlement site: Contract is a free pedestal, Travel is
a paid refill, and Gold is a free later pickup. Payload/participation and the
single authored chronology are separate products; Contract never enters paid
purchase policy, and Travel/Gold keep distinct source-time frontiers.

Gold Gold Gold's first purchased non-`SpellDrop` World Shop entry consumes the
exact one-use trait and materializes one separate free object. The source does
not automatically acquire that object: its later interaction may be interwoven
with other purchases and pickups in the room. Loot creation fixes its generated
offer at materialization, while consumable behavior occurs at interaction.
`RemoveStoreItem` runs before the purchased loot choice or consumable effect is
settled, so the duplicate's generation frontier is the pre-source-acquisition
history rather than the branch after applying that paid reward. Pom loot alone
has a later conditional regeneration contact: `CreateBoonLootButtons` reruns
`SetTraitsOnLoot` when any stored `StackOnly` target disappeared before
interaction.
Blind Box resolves its hidden loot on interaction in the game. The planner may
instead fully author that result on the derived Gold row, provided the later
site order stores only chronology. The stable `echoDoubleShopReward` payload
may therefore be edited before pickup and remains separate from its order
membership. The Shop kernel's accepted paid removal consumes Gold and freezes
the pre-source-acquisition materialization even when later nested source detail
is invalid; rejection before that checkpoint leaves the trait armed. Ordinary
payloads remain frozen, while Pom regenerates only under the audited
existential missing-`StackOnly` condition.

Fields optional offers now consume the persistent
`FieldsOptionalRewards` bag sequentially on room entry, independently of cage
`RunProgress` preparation. Artificer conversion reuses the same counted-bag
transition against the current `RunProgress` bag with Devotion and Spell
excluded. It consumes the exact reachable entry at source interaction and
defers the generated replacement's concrete acquisition to its later
checkpoint; no second reward bag or acquisition fold is introduced.
