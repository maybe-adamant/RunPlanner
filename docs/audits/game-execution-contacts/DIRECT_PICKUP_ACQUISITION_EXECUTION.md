# Direct-pickup acquisition execution

This audit closes the native execution boundary for planner acquisitions whose
materialized result is one directly used world pickup. These acquisitions do
not open a choice screen and do not require the executor to reproduce their
native effect. The shared contract is deliberately about consuming one bound
or compatible ready normal acquisition, not about treating every
`UseConsumableItem` carrier as the same semantic action.

Visible Poms, direct level items, trait loot, Mystery Boons, generated-child
producers, and transformations retain their specialized owners. Native payment
does not create an execution owner; a paid result enters the same outcome
consumer as its free counterpart.
Talent Drops are also excluded: although their outer interaction calls
`UseConsumableItem`, their declared function opens the interactive Path of
Stars screen.

## Source index

The game evidence was checked on 2026-09-03 against the installed Hades II
scripts:

- consumable construction and world attachment:
  `Scripts/InteractLogic.lua:819-872`;
- consumable guards, accepted-use sequence, effect dispatch, object disposal,
  reward history, and exit readiness:
  `Scripts/InteractLogic.lua:979-1152`;
- audiovisual use presentation:
  `Scripts/RoomPresentation.lua:2308-2338`;
- base consumable and resource declarations:
  `Scripts/ConsumableData.lua:5-31`;
- Max Health and Max Magick declarations:
  `Scripts/ConsumableData.lua:459-684`;
- Talent Drop, direct-level item, Last Stand, and elemental declarations:
  `Scripts/ConsumableData.lua:686-884` and `970-1063`;
- Gold, healing, Armor, and resource declarations:
  `Scripts/ConsumableData.lua:199-457`, `1639-1870`;
- Path of Stars screen entry: `Scripts/TalentScreenLogic.lua`;
- normalized acquisition declarations:
  `packages/hades2-catalog/src/declarations/rewards/acquisitions.ts`;
- execution acquisition role:
  `packages/planner-engine/src/execution-plan/model.ts`; and
- Sea Star source and planner disposition:
  [Run-impacting trait effects](../traits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md).

## Planner semantic result

The execution acquisition role already publishes the facts this boundary
needs:

```text
owner and role       exact planner acquisition
producer             source that materialized the acquisition, when explicit
gameName             expected native pickup identity
lifecyclePoint       authored acquisition phase
disposition          normal or Artificer result; Time Piece is omitted at publication
settlement           optional acquisition site and entry
specialized result   optional trait offer or level resolution, when present
```

A direct-pickup consumer uses the role only when no specialized result or
producer-owned child sequence supersedes it. It does not infer behavior from a
Lua inventory of item names and does not search authored order for the next
matching acquisition. No new execution or authored-project field is required.
The direct-pickup consumer claims only normal `acquisition` transactions;
item-effect and transformation results retain their owning adapters even when
their native object is also consumable. Time Piece removes the acquisition
before execution publication.

## Bound-or-ready correlation

`CreateConsumableItem` returns the concrete native item and
`CreateConsumableItemFromData` attaches that object to the world. A materialized
room or store object may bind its execution owner to that exact object without
making its producer or payment an execution concern.

Native-produced pickups need not receive source provenance when they are
created. After native use guards accept the interaction, an unbound object may
claim one compatible ready normal acquisition in published transaction order.
The object then carries that handle through the remainder of its bounded use
sequence. A native object with no compatible ready action runs unchanged. This
preserves unmodeled drops while allowing generated and transformed pickups to
reuse the consumer without teaching it their source semantics.

## Accepted interaction and steering completion

`UseConsumableItem` rejects an attempted interaction before native use begins
when death handling, item blocking, costs, requirements, or living enemies
prevent pickup. Only after those guards does it disable interaction and call
`ConsumableUsedPresentation`.

The presentation callback is a useful accepted-use witness, but it is not the
terminal. Native code still has to:

1. remove or pay for the pickup;
2. apply its direct fields and declared use functions;
3. duplicate, destroy, or re-enable the world object;
4. update `LastReward`; and
5. refresh exit readiness.

The useful execution boundary is therefore:

```text
bound or unbound candidate enters UseConsumableItem
  -> native guards pass
  -> ConsumableUsedPresentation confirms acceptance
  -> retain its bound owner or claim one compatible ready normal action
  -> native UseConsumableItem returns
  -> release any local dependency owned by the resolved acquisition
```

A rejected attempt never begins the transaction. An error after acceptance
does not complete its steering handle. Completion after the native call
returns records only that this synchronous contact finished and may release a
local DAG dependent. It is not proof of the item's semantic result, and the
acquisition itself is not a checkpoint obligation. Simulation-neutral
presentation or health/Gold threads require no blocking proof.

The executor does not call the item's use functions itself. In particular, it
does not reproduce health, Magick, Gold, Armor, element, Forfeit, resource,
reward-history, or exit-readiness mutation.

## Included direct-pickup families

The following families satisfy the direct-pickup contract when published
without a specialized acquisition result:

| Family                            | Execution disposition                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Max Health and Max Magick pickups | Consume the resolved item; native stat mutation is simulation-neutral.                                                                               |
| Gold, healing, and Armor pickups  | Consume the resolved item; native effect remains authoritative.                                                                                      |
| Ordinary Nectar                   | Consume as a resource pickup only when the published role has no `levelResolution`. Source-eligible level Nectar remains owned by the level adapter. |
| Elemental essences                | Consume the resolved item and let native `AddTraitToHero` apply the fixed element trait before completion.                                           |
| Red Onion                         | Consume the resolved item. Vow of Forfeit replacement and retained-state policy remain navigation and conformance facts.                             |
| Meta-progression resources        | Consume as native pass-through; their amounts do not enter simulation.                                                                               |
| Last Stand pickup                 | May reuse this consumer after its producer exposes the exact authored object and native availability has accepted it.                                |

This is a carrier classification rather than a second catalog inventory. A
later producer may expose any result with this same published shape; the
consumer uses an existing binding or claims its ready normal action at accepted
use.

## Specialized exclusions

Sharing `UseConsumableItem` is not sufficient to join this family:

| Acquisition                                          | Owning boundary                                                                                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StoreRewardRandomStack` and source-eligible Nectar  | Direct level acquisition; native target/count steering at the bounded `AddStackToTraits` contact is required.                                                                 |
| `TalentDrop`, `TalentBigDrop`, and `MinorTalentDrop` | Spell/Path/Hex execution. Their `OpenTalentScreen` use function starts an interactive talent-tree action.                                                                     |
| Trait, Pom, Chaos, and Spell loot                    | Their native choice-screen adapters.                                                                                                                                          |
| `BlindBoxLoot` and other wrapped rewards             | The producer and generated-child chain, followed by the child's applicable consumer.                                                                                          |
| `ChaosWeaponUpgrade`                                 | Randomized Hammer transformation.                                                                                                                                             |
| NPC choices and Shrine delivery                      | Their creation remains native; the resulting normal pickup may reuse this consumer. Store payment likewise has no execution owner.                                            |
| Artificer and Time Piece                             | Artificer's source disposition belongs to the transformation boundary and its child may later reuse this consumer. Time Piece is omitted at publication and creates no child. |

The direct-pickup consumer must not absorb these lifecycles merely because one
callback happens to pass through the same native function.

At the native boundary, the included direct carriers have neither a singular
`UseFunctionName` nor `ReplaceWithRandomLoot`. Deterministic plural
`UseFunctionNames`, such as the elemental and Last Stand mutations, remain
inside the direct native sequence. This behavior-shaped contact distinguishes
the supported carrier without duplicating the catalog's item inventory in the
executor.

## Exact native contact boundary

The direct-pickup consumer does not decide whether an intended item is
available. Shop inventory, NPC rewards, or another producer evaluates the
carrier-specific availability question for the exact authored object. If the
native contact rejects that object, the owning adapter reports a mismatch and
keeps the native base path operational; no substitute is exposed to the
consumer.

This keeps Death Defiance eligibility and other volatile offer policy with the
native contact that can answer it. The pickup consumer only claims a compatible
published role for the accepted native identity it was given; it does not
compare a later semantic result.

## Sea Star boundary

On a successful Sea Star duplication, `UseConsumableItem` re-enables the same
concrete world object and clears its ability to duplicate again. The original
pickup owner still completes once. The duplicate is a new planner acquisition
even though native code reuses the object's identity.

The Sea Star adapter consumes the published `proc` or `noProc` chance result
while the source interaction is active. After a proc, the completed source
binding yields to the ordinary compatible-ready claim for the newly ready
duplicate action on its next accepted use; no separate object-correlation
mechanism exists. The direct-pickup adapter remains responsible only for that
accepted-use claim and bounded dependency release.

## Planner and executor disposition

The planner remains the sole authority for which acquisition exists and which
specialized result, producer relation, and lifecycle apply. The executor
contributes only native correlation and the accepted-use/dependency-release
boundary described above.

Representative execution witnesses are sufficient:

- an accepted ordinary Max Health pickup releases its handle only after the
  native use call returns;
- a rejected interaction does not begin;
- a fixed element pickup has applied its native element trait before
  completion;
- an unbound native consumable with no compatible ready action passes through
  unchanged; and
- a Talent Drop is not claimed by this consumer.

These witnesses own the carrier boundary. Catalog tests remain the exhaustive
identity authority, and producer gates own generated, store-materialized,
duplicated, or transformed object correlation.
