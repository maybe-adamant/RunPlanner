# Game execution contacts

This directory maps the planner's closed semantic vocabulary to the native
Hades II contacts through which those semantics are realized or observed. It
exists because the same planner result may travel through several native
carriers: a level can come from a Pom screen, Nectar, a Pom Slice, an NPC, or a
purchased item.

These inventories preserve contact evidence, not delivery history. The
planner/game ownership contract, transaction policy, checkpoints, and mismatch
classification belong to
[Game Integration Boundary](../../design/GAME_INTEGRATION_BOUNDARY.md). Source
facts remain in the focused game-data audits linked by each inventory.

## Coverage vocabulary

| Status              | Meaning                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Covered             | The execution product carries the fact and the executor has a bounded native realization or observation contact.        |
| Native pass-through | Native code owns the deterministic or simulation-neutral effect; the executor must not recreate it.                     |
| Adapter gap         | The semantic fact exists, but no complete native adapter currently realizes or observes it.                             |
| Protocol gap        | The planner models the result, but the execution product does not carry enough information for a semantic-agnostic use. |
| Deferred route      | The declaration is modeled but cannot occur in the supported fixed-route execution boundary.                            |
| Probe required      | Source or live-game evidence is still insufficient to claim the native contact.                                         |

Coverage always requires both a planner semantic result and a disposition for
every native carrier that can produce it. Working through one carrier does not
prove the family—for example, an ordinary Pom screen does not prove Nectar or a
Pom Slice.

## Durable inventories

- [Rewards and items](REWARDS_AND_ITEMS.md) owns reward identities,
  acquisition carriers, generated pickups, Shops, Shrines, and Wells.
- [Traits and offers](TRAITS_AND_OFFERS.md) owns provider families, ordinary
  equipment, exceptional trait dispositions, Chaos, replacement, and level
  outcomes.
- [Keepsakes, loadout, and abilities](KEEPSAKES_LOADOUT_AND_ABILITIES.md) owns
  the execution disposition of weapons, aspects, Arcana, Vows, Hexes, tools,
  and every supported keepsake family.
- [NPCs, encounters, and automatic outcomes](NPCS_ENCOUNTERS_AND_AUTOMATICS.md)
  owns bespoke NPC menus, encounter/phase identity, Nemesis, and fixed
  automatic outcomes.
- [Room features and actions](ROOM_FEATURES_AND_ACTIONS.md) owns the native
  contacts carrying Overview, Timeline, and Doors facts.
- [Native conformance contacts](NATIVE_CONFORMANCE_CONTACTS.md) owns every
  blocking structural and room-exit comparison and the native reader used for
  it.

The normalized catalog is the exhaustive identity authority. The execution
union in `packages/planner-engine/src/execution-plan/model.ts` is the exhaustive
wire authority. Compile-time execution censuses own closed-union coverage;
these documents explain native meaning and must not duplicate those tests as a
manually maintained manifest.

## Cross-family invariants

1. Exact native source identity selects a transaction. Provider similarity,
   equal payloads, and authored order never substitute for owner binding.
2. Acquisition transactions are steering capabilities, not durable-result
   proof. Their completion can release a same-room dependency; named room-exit
   conformance proves modeled state.
3. Ordinary payment, affordability, and purchase counters remain native.
   Purchased outcomes enter the same acquisition, transformation, or item
   consumer as their free counterparts.
4. Simulation-neutral native drops remain visible to the game without becoming
   obligations or mismatches.
5. Native clocks and deterministic trait effects remain native unless the
   planner publishes a bounded randomized target that requires steering.
6. The active room-exit conformance set is `traitInventory`, `elementCounts`,
   `steadyGrowth`, `chaos`, `keepsakeEffects`, `rewardPriorities`,
   `pathOfStars`, `forfeit`, and `stygianWell`. Complete Run State is diagnostic
   only.
7. Biome-specific navigation remains limited to the structure that ordinary
   navigation cannot express: Fields cages, Ephyra Hub and side rooms, Thessaly
   wheels, and native Anomaly entry.

## Maintenance rule

Add durable contact evidence to the narrowest inventory above. A focused
pre-plan lifecycle analysis belongs in `docs/investigations/` and is deleted at
delivery closure after any lasting source facts or policy are promoted. Do not
add another execution-slice audit merely to record how one implementation gate
was completed.
