# NPC trait and generated-pickup execution

## Status and scope

This audit closes the execution design for Arachne and Narcissus in the current
F/G route extent. It covers their bespoke trait menus, the boundary between a
selected trait and its native acquire behavior, Narcissus's optional generated
pickups, and the complete Narcissus Mystery Boon chain.

It does not extend execution support to Medea, Circe, Icarus, Echo, or later
biomes. It also does not make every trait that happens to call a pickup helper
an executor-owned producer. The durable rule is narrower:

> The executor steers the authored trait screen, then lets native trait
> acquisition run. If that native behavior creates a separately authored
> pickup, the executor binds the native object to the published child and
> hands it to the pickup's own adapter. It never recreates the drop itself.

## Source index

The game evidence was checked on 2026-09-03 against the installed Hades II
scripts:

- Arachne and Narcissus menu construction:
  `Scripts/EventLogic.lua:961-1058`;
- complete Arachne and Narcissus option declarations:
  `Scripts/NPCData.lua:3963-4068` and `4278-4394`;
- generic upgrade menu, button construction, and selection:
  `Scripts/UpgradeChoiceLogic.lua:2-376` and `940-1135`;
- trait equipment and asynchronous acquire-function dispatch:
  `Scripts/TraitLogic.lua:471-930`;
- native generated-pickup creation:
  `Scripts/RoomLogic.lua:1944-2057`;
- Narcissus trait acquire declarations:
  `Scripts/TraitData_Narcissus.lua:1-781`;
- Arachne's Onyx Dress resource drop:
  `Scripts/TraitData_Arachne.lua:267-319`;
- consumable use and Mystery Boon dispatch:
  `Scripts/InteractLogic.lua:979-1152`;
- Mystery Boon unwrap and hidden-source creation:
  `Scripts/StoreLogic.lua:1334-1368` and
  `Scripts/RoomLogic.lua:2059-2072`, `2240-2305`;
- planner pickup-producer authority:
  `packages/planner-engine/src/authored-project/pickup-producers.ts`;
- normalized Narcissus pickup lifecycle:
  `packages/hades2-catalog/src/declarations/rewards/producer-lifecycles.ts`;
- execution transaction assembly:
  `packages/planner-engine/src/execution-plan/assembly/timeline-transactions.ts`;
  and
- the current broad native adapter:
  `adamantRunPlanner-Plan_Executor/src/mods/hooks_timeline.lua`.

The exact Narcissus outputs and planner support remain owned by
[Acquisition delivery and room settlement](../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md)
and [Trait offer pools and dependencies](../traits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md).
This document owns only their native execution contacts and handoff boundary.

## Bespoke NPC menu boundary

`ArachneCostumeChoice` and `NarcissusBenefitChoice` are not ordinary loot
interactions. Each function:

1. filters the NPC's complete `UpgradeOptions` against native requirements;
2. randomly selects three eligible or priority rows;
3. stores them on the NPC source as `UpgradeOptions`; and
4. calls `OpenUpgradeChoiceMenu` directly.

The source NPC table remains `screen.Source` through button construction and
selection. That exact table is the stable carrier for the encounter-owned
Timeline transaction. Giver name, current room, the next menu, and authored
order are not sufficient correlations.

The smallest steering seam is immediately before the bespoke function opens
the generic upgrade menu. At that point the native function has evaluated its
requirements and priority pool, while the executor can replace only the three
randomized rows with the published offer. Generic button construction,
presentation, player selection, trait processing, and equipment remain native.

The published selected option is not an automatic click. The player must pick
that row. After `HandleUpgradeChoiceSelection` returns, the NPC interaction
completes only when the selected identity is the published preferred or
declared fallback result and the selected trait exists in native hero state.
A different player choice is a result mismatch, but the native callback still
runs under the global stop-enforcement policy.

Arachne and Narcissus traits use a hidden/internal native `Common` appearance
while the planner intentionally exposes no mutable rarity. The executor must
not invent a player-facing rarity or level proof for them.

## Runtime eligibility and fallback

The native NPC option row, not merely `TraitData`, owns its
`GameStateRequirements`. Narcissus Life Savings (`NarcissusH`) is the current
volatile example: the native menu row checks `MissingLastStand` before it can
enter the three-option menu.

The execution offer already carries one planner-selected `traitEligibility`
fallback. At the NPC contact, that availability question means evaluating the
matching native NPC option row and its requirements. If the preferred selected
row is unavailable, its declared fallback replaces that row and completes the
same encounter owner if chosen. The executor does not search the Narcissus
pool or interpret Death Defiance.

Other modeled current-run requirements, such as Verdure Sampler needing a
Pom-eligible trait, do not acquire an implicit fallback. If a required
published row cannot be represented at the native menu contact, execution
reports the mismatch and leaves the game to continue with its native menu.

## Trait acquisition does not imply effect realization

`HandleUpgradeChoiceSelection` calls `AddTraitToHero`, and `AddTraitData`
inserts the selected trait before launching its `AcquireFunctionName` on a
thread. The selection call can therefore prove that the outer NPC trait was
acquired, but it cannot prove that a trait-owned drop or later mutation has
finished.

This yields two distinct semantic owners when a selected trait creates a
freely interactable pickup:

```text
encounter interaction: select and equip the NPC trait
  -> native AcquireFunctionName runs
       -> native object is created
            -> optional pickup acquisition, if authored
```

The executor never calls `GiveRandomConsumables`, copies its `LootOptions`, or
spawns a substitute object. Native creation is not required to prove which
trait produced an object, and creation does not assign that object a planner
owner. When the player later accepts an interaction, the room Timeline claims
a compatible ready acquisition action. Other native outputs continue
unmodified and unclaimed.

This rule also covers traits whose drops are wholly simulation-neutral.
Arachne's Onyx Dress still drops its native Fabric, and Narcissus's Fates'
Trimmings still produces its native resources and rerolls. Their drops do not
become execution transactions merely because the executor forced the parent
trait screen.

## Narcissus handoff matrix

Every selected Narcissus descriptor is equipped first. Native
`GiveRandomConsumables` then creates its declared outputs. The executor's work
ends at correlation and handoff:

| Choice       | Native outputs relevant to the current planner          | Execution disposition                                                                                                                                      |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NarcissusA` | Pom Slice plus simulation-neutral plants                | Native production; a published Pom Slice is handed to the direct-level adapter.                                                                            |
| `NarcissusB` | Ashes plus simulation-neutral healing                   | Native production; a published Ashes pickup is handed to the direct-pickup adapter.                                                                        |
| `NarcissusC` | Gold plus simulation-neutral Silver                     | Native production; a published Gold pickup is handed to the direct-pickup adapter.                                                                         |
| `NarcissusD` | Psyche and Max Magick                                   | Native production; each authored pickup is independently handed to the direct-pickup adapter.                                                              |
| `NarcissusE` | Bones and Max Health                                    | Native production; each authored pickup is independently handed to the direct-pickup adapter.                                                              |
| `NarcissusF` | Fabric and rerolls                                      | Native pass-through; no current planner-visible child result.                                                                                              |
| `NarcissusG` | two Elemental Essences plus simulation-neutral Stardust | Native production; each accepted essence interaction claims one ready direct-pickup action. Neither native object has a planner-owned identity before use. |
| `NarcissusH` | Last Stand plus simulation-neutral Lotus                | Resolve the NPC trait fallback first. If Life Savings is selected, native production hands the published Last Stand to the direct-pickup adapter.          |
| `NarcissusI` | Mystery Boon plus simulation-neutral seed               | Native production; an authored Mystery Boon enters the specialized unwrap chain below.                                                                     |

Narcissus sets `NotRequiredPickup = true`. A generated pickup transaction is
therefore optional unless another modeled rule says otherwise. If the planner
does not include that pickup interaction, the game still creates the object;
the executor neither suppresses it nor claims it as a completed acquisition.

## Action-time claiming, not object provenance

The execution product already publishes every participating acquisition as a
room-local transaction head with its native role identity, lifecycle window,
dependencies, and authored continuation. That is sufficient for execution.
The executor does not need the planner's source-trait-to-generated-pickup
provenance and must not extend the wire with a `traitGenerated` producer
relation merely to restate how native code made an object.

At an accepted native interaction, the room Timeline claims one compatible
unfinished action whose lifecycle window is open and whose prerequisites are
satisfied. A physical object is only evidence of the interaction kind and
native game identity; it has no preassigned planner owner. If several
independent compatible actions are ready, any is semantically legal. The
Timeline chooses deterministically from its published transaction order and
the claimed handle owns that action from then onward. It never reports that
the player used the "wrong" interchangeable object.

This shared claim is a small correction to the direct-level and direct-pickup
entry seams established in C2 and C2.5. Already-bound room rewards and store
objects keep their existing handles; an unbound Pom Slice, Nectar, or direct
pickup claims its action only after native acceptance. C1's ordinary loot and
the visible-Pom path remain unchanged.

The encounter interaction independently proves that the authored NPC trait was
equipped. Physical availability already prevents a pickup from being used
before native creation, so C3 adds no synthetic source-to-child DAG edge. A
single-contact action completes from that accepted use. A multi-contact action
such as Mystery Boon retains its claimed handle through the generated provider
and final trait screen.

## Mystery Boon chain

Narcissus Mixed Blessings creates an ordinary `BlindBoxLoot` consumable. Its
later acquisition is one multi-contact owner with two materialized roles:

```text
any BlindBoxLoot enters UseConsumableItem
  -> native guards pass
  -> ConsumableUsedPresentation confirms accepted use
  -> claim one compatible ready Mystery Boon action
  -> native code starts UnwrapRandomLoot on a thread
       -> GiveLoot receives the published hidden provider
       -> CreateLoot returns the exact provider loot object
       -> the hidden-source role binds to that object
  -> player interacts with the provider loot
       -> ordinary C1 trait-offer steering and terminal proof
```

The box use begins the acquisition but does not complete it. Completion belongs
to the resulting selected trait after the hidden provider has been created and
the ordinary trait screen has closed successfully. `UnwrapRandomLoot` is a
bounded native scope, not a callback cursor or a second Timeline owner.

The executor changes only `GiveLoot`'s native `ForceLootName` input. It must
preserve the native ordering in which `GiveLoot` runs before the created loot
is marked `BoughtFromShop`; the Olympian keepsake-pressure audit owns the
resulting native behavior. The created provider loot is then handed to the
already-closed ordinary trait adapter. The executor does not reproduce source
eligibility, trait offer generation, loot creation, screen behavior, or trait
equipment.

`NarcissusPickup` currently supplies its default `roomExit` lifecycle to both
Mystery Boon roles. That is insufficiently precise. Like Shrine and Contract
Mystery Boons, it must declare the box at its pickup point and the provider at
`afterUnwrap`. This is a catalog normalization correction, not an executor
special case.

## Planner and executor disposition

| Concern                                             | Authority and disposition                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Which three NPC traits appear and which is selected | Planner offer; native-steered at the bespoke menu-open seam.                        |
| Native row requirements and one declared fallback   | Native availability question at the published contact; no executor pool search.     |
| Equipping the selected NPC trait                    | Native-authoritative; verified after selection.                                     |
| Trait-owned drop production                         | Native-authoritative; never recreated by the executor.                              |
| Which generated pickups are planner-visible         | Planner selected-pickup producer and authored participation.                        |
| Choosing a generated pickup action                  | Claim a compatible ready transaction only when native use is accepted.              |
| Direct pickup effect                                | Existing direct-pickup or direct-level adapter.                                     |
| Mystery Boon provider and final trait               | Force the published provider, bind its loot, then reuse the ordinary trait adapter. |
| Simulation-neutral companion drops                  | Native pass-through and never a mismatch merely for existing.                       |

## Representative witnesses

C3 needs bounded carrier witnesses, not a duplicate of the catalog's complete
Narcissus matrix:

- an Arachne menu installs the published three rows and completes only after
  the authored selected costume is natively equipped;
- a Narcissus menu does the same and a failed native requirement uses the
  one declared fallback without changing the owner;
- selecting a drop-producing trait completes the encounter owner while the
  native drop is still independently pending;
- one unbound native Narcissus Pom Slice claims a compatible ready action at
  accepted use and is handed to the existing direct-level adapter;
- one unbound native direct pickup claims the same way and is handed to the
  existing direct-pickup adapter;
- an unmodeled companion drop and an unselected optional pickup remain native
  pass-through;
- Mystery Boon begins only after accepted box use, forces the published hidden
  provider, binds the created provider loot, and completes through C1's final
  trait proof; and
- two independent Mystery Boon actions may be claimed by either physical box
  without a wrong-object mismatch; and
- native error or absence of a compatible ready action never fabricates an
  object or prematurely completes either owner.

These execution witnesses are representative. Catalog and planner tests remain
the primary owners of the complete option, pickup, fallback, history, and
eligibility matrices.
