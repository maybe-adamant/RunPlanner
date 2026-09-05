# Reward transformation execution

## Status and scope

This audit closes the planner-to-executor boundary for the two authored ways a player can
resolve one eligible reward without acquiring its ordinary result:

- Time Piece converts the source to Gold; and
- Artificer replaces the source with a separately interactable Run Progress
  reward.

These are source interactions, not alternate implementations of ordinary
pickup. The planner has already resolved eligibility, remaining uses, reward
bag state, acquisition participation, and the Artificer replacement. The
executor steers only Artificer's randomized replacement and lets native game
logic perform the mutation. Time Piece is intentionally consumed at the
planner's execution-publication boundary: it does not produce an execution
transaction or a runtime adapter. The remaining intended acquisitions and the
room-exit keepsake charge conformance fact provide aggregate proof that the
authored room outcome was realized; they do not assert exact Time Piece source
identity at the native contact.

This audit does not cover Sea Star, Echo recreation, trait-owned pickup
production, Shops, Stygian Wells, Hermes Shrine delivery, or the later
acquisition details of an Artificer replacement. Once a replacement exists,
its published disposition routes it to the applicable ordinary trait, level,
or direct-pickup adapter. A Time Piece-destroyed source has no published child.

## Source index

The game evidence was checked on 2026-09-03 against the installed Hades II
scripts:

- Artificer and Time Piece control handlers:
  `Scripts/GiftLogic.lua:1-150`;
- Artificer eligibility: `Scripts/GiftLogic.lua:295-306`;
- Time Piece eligibility: `Scripts/PowersLogic.lua:6733-6737`;
- Artificer and Time Piece presentations:
  `Scripts/EventPresentation.lua:3287-3307` and `3951-3965`;
- reward-bag selection: `Scripts/RewardLogic.lua:61-201`;
- replacement spawning and Vow of Forfeit interception:
  `Scripts/RewardLogic.lua:303-390` and `Scripts/ShrineLogic.lua:918-928`;
- planner acquisition dispositions and producer facts:
  `packages/planner-engine/src/execution-plan/model.ts`;
- execution transaction and relation assembly:
  `packages/planner-engine/src/execution-plan/assembly/timeline-transactions.ts`
  and `timeline-relations.ts`; and
- the focused runtime transformation adapters beneath
  `adamantRunPlanner-Plan_Executor/src/mods/room/timeline/transformations/`.

The complete source eligibility and reward-bag matrices remain owned by
[Fields optional rewards and Artificer](../rewards-and-acquisition/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md),
[Keepsakes](../loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md), and
[Room action order](../rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md).
This document owns only their native execution contacts and handoff boundary.

## Published semantic result

One execution acquisition role already carries:

```text
owner and role       exact planner acquisition action
gameName             expected native source identity
disposition          normal or artificer
lifecyclePoint       room-local action window
trait/level detail   ordinary acquisition result, when applicable
producer             separately produced acquisition relation, when present
replacement          Artificer source-owned native materialization proof when
                     its child was consumed by Time Piece
```

The Artificer replacement is normally a second acquisition transaction. Its
producer fact points to the source owner and role, and the room Timeline
carries the source-before-child dependency. Its reward identity, concrete
acquisition roles, and any trait or level resolution belong to that child
transaction. If the authored child is consumed by Time Piece, the planner
omits that child transaction and puts only its expected native replacement
identity and reward steering payload on the Artificer source role. This keeps
the native Artificer contact steerable without publishing a non-obligatory
child or teaching the executor what Time Piece means.

Time Piece has no published child transaction. Gold amount is
simulation-neutral.

No additional compiler inference is required. In particular, the compiler and
executor must not reconstruct conversion eligibility, charge counts,
Artificer bag policy, requiredness, or replacement contents from native names.

## One source, one disposition

Normal acquisition and Artificer are the only published dispositions for the
same concrete source interaction. Time Piece is a planner-side destruction
event and is absent from the execution union. The published `disposition` is
the runtime routing authority:

| Disposition | Accepted player action                        | Resulting owner state                                       |
| ----------- | --------------------------------------------- | ----------------------------------------------------------- |
| `normal`    | the carrier's ordinary use or pickup          | the source acquisition completes through its normal adapter |
| `artificer` | the accepted native metareward transformation | the source completes after its replacement is materialized  |

An adapter for one disposition must not claim or complete the other. This is
more than a validation convenience: without the routing check, a normal loot
or level adapter could complete a source that the planner says was destroyed
by Artificer. A Time Piece-destroyed source is absent, so the aggregate of
remaining intended acquisition obligations and the room-exit charge fact
provides the conformance boundary.

The object can already be bound to a room reward or purchase owner. A free
object generated by native behavior can instead remain unbound until its
accepted transformation contact. In that case the Timeline claims one ready
transaction whose disposition and native identity match. The native object is
evidence of the accepted action, not a reason to search planner history or
infer its producer.

If no compatible ready transaction exists, the native interaction continues
unchanged. The runtime must not block the player's control merely because the
published trace and native action differ. The unmet owner or resulting
checkpoint reports the mismatch under the normal stop-enforcement policy.

## Native eligibility remains native

The game decides whether each control is currently usable before reaching the
transformation-specific presentation:

- `CanReceiveGift` requires effective `MetaConversionEligible`, a remaining
  Artificer use, and no positive resource cost; and
- `CanGoldifyReward` requires no positive resource cost, valid Fate,
  `GoldConversionEligible`, and a remaining Time Piece use.

The planner has already validated the intended outcome against its modeled
state. The executor does not bypass these guards and does not make an
ineligible source interactable. Reaching the accepted native contact is the
runtime proof that the game's own guard admitted the action.

This distinction also preserves player agency. The executor does not invoke
the Gift or Special Interact control automatically. It waits for the player to
choose the authored source disposition.

## Time Piece source fact and publication boundary

The native sequence remains game-owned:

```text
Special Interact control
  -> CanSpecialInteract
  -> CanGoldifyReward and IsUseable
  -> disable source and remove required-object registration
  -> GoldifyPresentation(source)
  -> emit simulation-neutral Gold and destroy source
  -> decrement BoonConversionUses
  -> UpdateTraitNumber and possibly remove the exhausted trait
  -> refresh notifications and exit readiness
```

`GoldifyPresentation` is the accepted native contact, but it is not an
execution hook. The simulation records the source's `conversionToGold` event;
the planner-owned execution-publication stage then omits that destroyed
acquisition and its Time Piece transformation action. Consequently the wire
union has no `timePiece` disposition, no Time Piece transaction, and no Lua
Time Piece adapter.

Native code still destroys the source, emits simulation-neutral Gold, consumes
the charge, and updates the keepsake. The remaining intended acquisition
transactions are each obligated at their published checkpoint, while the
existing before-room-exit keepsake conformance fact verifies the aggregate
remaining Time Piece charge. Together these facts reject a room whose intended
acquisitions or aggregate Time Piece charge outcome differs without recreating
native Goldify behavior or claiming exact destroyed-object identity in the
executor.

## Artificer contact

The bounded native sequence is:

```text
Gift control
  -> CanReceiveGift
  -> disable source and clear MetaConversionEligible
  -> ConvertMetaRewardPresentation(source)
  -> decrement MetaConversionUses and increment run spent count
  -> ChooseRoomReward(..., "RunProgress", exclusions, IgnoreForcedReward)
  -> detach required-object status from source
  -> SpawnRoomReward at the source object
  -> transfer requiredness and duplicate capability to replacement
  -> hide and destroy source
```

`ConvertMetaRewardPresentation` is the accepted-action contact. It receives
the exact source only after native Artificer eligibility has passed. The
adapter binds or claims the published `artificer` role there and resolves its
already-published replacement transaction. If that child was consumed by Time
Piece, no child transaction exists; the source role instead carries the
planner-resolved replacement game identity and reward steering payload needed
for this same native contact.

The only randomized result the executor steers is the `ChooseRoomReward`
result. Navigation owns that native reward-selection contact, but it consumes
only the transformation's scoped, already-resolved reward request. Navigation
does not learn Artificer eligibility or source semantics.

The Artificer action must remain active until native spawning returns the
expected concrete replacement and the original source is destroyed. A
presentation callback alone is insufficient because no replacement yet
exists. A failed or missing spawn cannot complete the source action.

Native code remains authoritative for:

- decrementing Artificer capacity and incrementing its spent counter;
- consuming the selected `RunProgress` bag entry;
- source removal;
- required-object and duplication-capability transfer; and
- construction of the replacement object.

The executor verifies those retained counts through existing room conformance
instead of reproducing them inside the transformation adapter.

## Artificer spawn is not the incoming room reward

The ordinary acquisition binder observes `SpawnRoomReward` to correlate a
room's declared incoming reward with its concrete native object. Artificer also
calls `SpawnRoomReward`, but its result is a new child transaction rather than
the room's original incoming reward.

Native Artificer uniquely supplies:

```text
IgnoreRoomSpawnOnLootPoint = true
SpawnRewardOnId = original source ObjectId
```

The installed game source has no other caller that sets
`IgnoreRoomSpawnOnLootPoint`. This is therefore a stable native discriminator
for excluding the call from ordinary incoming-reward binding. The Artificer
adapter observes the same call as part of its bounded transformation instead.

The exclusion prevents a replacement from inheriting the source's normal
acquisition owner. It does not turn this flag into planner semantics or expose
it on the execution wire.

## Replacement acquisition is producer-independent

The replacement object is not acquired during Artificer conversion. Once it
exists, it is an ordinary physical carrier for a separate planner acquisition:

```text
Artificer source action completes
  -> child dependency becomes ready
  -> player later interacts with any compatible replacement carrier
  -> the adapter for the child's own disposition claims the ready action
```

The executor must not permanently bind the returned physical object to the
source-derived child owner. The planner relation explains why the child exists
and prevents it from becoming ready before the source transformation. It does
not require the runtime to preserve physical source-to-child provenance after
materialization.

This matters when several Artificer transformations happen before any
replacement is collected. Native source A and source B may both produce the
same carrier family. When the player later interacts with either object, the
applicable adapter claims one compatible ready child in published transaction
order and steers that child's authored outcome. The runtime does not report
that the player selected the "wrong" physically identical child.

The Run Progress store contains no Artificer-eligible metaprogression source,
so an Artificer child cannot recursively use Artificer. A resulting ordinary
loot or pickup may still be consumed by Time Piece in the planner simulation;
when that happens its child transaction is omitted and only the source-owned
replacement proof remains. Forfeit makes this visible explicitly: Time Piece
sees the realized Onion, not the underlying Boon selected by Artificer.

Already-bound ordinary room rewards retain exact-object correlation. This
action-time claim is for unbound native-produced carriers whose existence and
readiness are already represented by the Timeline. It is not a global
same-name fallback and cannot claim an owner whose dependency or lifecycle
window is closed.

## Vow of Forfeit

Artificer asks the ordinary reward chooser for a Run Progress result and then
passes that result through `SpawnRoomReward`. For a qualifying Boon,
`CheckBoonSkipShrineUpgrade` may replace the spawned object with
`RoomRewardConsolationPrize` and consume the biome's Vow of Forfeit use.

The execution product consequently has two compatible facts:

- the Artificer replacement reward is the underlying Boon selected from the
  Run Progress bag; and
- the child's concrete acquisition role is the resulting Red Onion.

The executor forces the underlying reward choice, lets the native spawn path
apply Forfeit, and verifies the returned concrete object against the child
role. It must not spawn an Onion directly or consume Forfeit itself. Existing
room conformance owns the resulting Forfeit latch.

## Failure and pass-through disposition

| Runtime path                                         | Disposition                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Native eligibility rejects before presentation       | No transformation begins. Native behavior continues.                                                 |
| Accepted action matches the published disposition    | Bind or claim the source and follow the bounded native sequence.                                     |
| Accepted action matches another disposition          | Do not claim that owner; allow native behavior and report through ordinary mismatch/obligation flow. |
| Artificer reward selection cannot be represented     | Stop further enforcement, call the native path, and do not fabricate a replacement.                  |
| Artificer spawn returns the wrong or no object       | Do not complete the source; native behavior remains in control.                                      |
| Time Piece destroys a source                         | No acquisition transaction is published; room-exit charge conformance remains the proof boundary.    |
| Native companion or simulation-neutral effect occurs | Pass through; it is not a separate execution owner.                                                  |

## Planner and executor disposition

| Concern                                         | Authority and disposition                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source eligibility and remaining modeled uses   | Planner engine; native guards must still admit the live action.                                                                                                                |
| Normal versus Artificer                         | Published acquisition-role disposition; Time Piece is omitted at publication.                                                                                                  |
| Player choosing the transformation              | Native player control; observed, never automatically invoked.                                                                                                                  |
| Artificer replacement reward and source         | Planner child transaction for an ordinary child, or source-owned replacement payload when that child is omitted; native reward selection is steered from the published reward. |
| Reward-bag mutation and use consumption         | Native-authoritative, with existing room conformance proving the modeled retained state.                                                                                       |
| Replacement construction and source destruction | Native-authoritative bounded transformation sequence.                                                                                                                          |
| Later replacement acquisition                   | Existing producer-independent trait, level, or direct-pickup adapter after the published dependency is ready.                                                                  |
| Gold amount and presentation                    | Native pass-through and simulation-neutral.                                                                                                                                    |

The planner-owned publication product adds only a source-owned Artificer
replacement payload for the edge case where its child was consumed by Time
Piece. A product-loop witness proves that Time Piece sources are absent,
ordinary Artificer children remain separate transactions, and a consumed
Artificer child still leaves enough native replacement steering data on its
source. This is a publication boundary, not a second runtime policy.

## Representative witnesses

The execution boundary needs representative contact tests rather than another
copy of the catalog's eligibility and reward matrices:

- a bound and an unbound eligible source can enter Artificer only through its
  matching published disposition;
- ordinary acquisition adapters do not claim `artificer` sources;
- a Time Piece-destroyed source is absent from the execution transactions,
  while the room's aggregate intended acquisitions and room-exit charge fact
  remain present;
- Artificer forces the published underlying reward, observes the expected
  replacement spawn, destroys the source, and completes only the source;
- the Artificer child remains incomplete until a later compatible adapter for
  its own published disposition claims it, unless the planner consumed it by
  Time Piece and published only the source-owned replacement proof;
- visible trait/Hammer, visible Pom, direct-level, and direct-pickup children
  reuse their existing terminal proofs without exact producer-object binding;
- an Artificer Boon intercepted by Forfeit produces the published Onion role
  without executor-side Vow mutation;
- two replacements created before either pickup may be consumed in either
  physical-object order while following the published ready-action order; and
- a rejected, mismatched, or interrupted native path never blocks player input
  or fabricates completion.

Planner tests remain the primary owners of eligibility, source participation,
bag evolution, requiredness, producer relations, and charge counts. The
executor tests own only native contact admission, bounded callback closure,
disposition isolation, and handoff to the already-supported acquisition
families.
