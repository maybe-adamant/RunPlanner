# Game execution contact audit

This directory maps the planner's closed semantic vocabulary to the native
Hades II contacts through which those semantics can be realized or observed.
It exists to prevent a semantic family from appearing covered merely because
one of its native carriers works. A Pom of Power choice, Nectar, a Pom Slice,
an NPC gift, and a purchased item can all produce a level change while reaching
that change through different game functions.

The owning game facts remain in the focused audits linked below. These files
record the additional execution question: **where does the game expose the
fact, and does the current execution boundary carry enough information to use
that contact without reimplementing planner policy?**

## Reading the status

| Status              | Meaning                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Covered             | The execution product carries the fact and the executor has a native contact for realizing or observing it.                             |
| Native pass-through | The planner deliberately treats the result as simulation-neutral; the executor must not mistake the native side effect for a mismatch.  |
| Adapter gap         | The execution product carries the fact, but the current native adapter does not yet realize or settle it completely.                    |
| Protocol gap        | The planner models the result, but the execution semantic product does not publish enough information for a semantic-agnostic executor. |
| Deferred route      | The declaration is modeled, but it cannot occur in the current F/G execution extent.                                                    |
| Probe required      | The exact native contact or outcome still needs source or live-game confirmation.                                                       |

"Covered" is deliberately two-dimensional:

1. The planner semantic result must be present: trait offer, level resolution,
   generated pickup, retained effect, room object, door, or automatic outcome.
2. Every native carrier capable of producing that result must have a
   disposition: loot screen, direct consumable, World Shop, Stygian Well,
   bespoke NPC menu, keepsake equip, automatic callback, or room lifecycle.

A family is not covered when only its ordinary loot-screen carrier works.

## Audit library

- [Rewards and items](REWARDS_AND_ITEMS.md) — all reward identities,
  acquisition carriers, generated pickups, shops, Shrines, and Wells.
- [Traits and offers](TRAITS_AND_OFFERS.md) — provider families, ordinary
  equipment, exceptional trait dispositions, Chaos, replacement, and level
  outcomes.
- [Ordinary trait-offer execution](ORDINARY_TRAIT_OFFER_EXECUTION.md) — exact
  Olympian, Hermes, and Hammer loot, screen, row-action, selection, and terminal
  contacts.
- [Chaos trait-offer execution](CHAOS_TRAIT_OFFER_EXECUTION.md) — exact
  Trial Upgrade admission, post-sort paired-row steering, native Denial and
  reroll boundaries, processed values, and selected-pair proof.
- [Level-acquisition execution](LEVEL_ACQUISITION_EXECUTION.md) — visible Pom
  menus and direct Pom Slice/Nectar target steering, accepted entry contacts,
  threaded completion, and shared acquisition ownership.
- [Direct-pickup acquisition execution](DIRECT_PICKUP_ACQUISITION_EXECUTION.md)
  — bound-or-ready action correlation, accepted consumable use, native
  terminal settlement, specialized exclusions, focused handoff, and the Sea
  Star reuse boundary.
- [Reward transformation execution](REWARD_TRANSFORMATION_EXECUTION.md) —
  Time Piece publication omission and Artificer source disposition, bounded
  native contacts, Artificer reward steering, Forfeit handoff, and
  producer-independent replacement acquisition.
- [NPC trait and generated-pickup execution](NPC_TRAIT_AND_GENERATED_PICKUP_EXECUTION.md)
  — bespoke Arachne/Narcissus menus, native trait-owned drop production,
  generated-child handoff, and Narcissus Mystery Boon resolution.
- [Keepsakes, loadout, and abilities](KEEPSAKES_LOADOUT_AND_ABILITIES.md) — all
  keepsakes, weapons, aspects, Arcana, Vows, Hexes, and tools.
- [NPCs, encounters, and automatic outcomes](NPCS_ENCOUNTERS_AND_AUTOMATICS.md)
  — generic and bespoke trait menus, Nemesis, encounter selection, and forced
  automatic results.
- [Room features and actions](ROOM_FEATURES_AND_ACTIONS.md) — the Overview,
  Timeline, and Doors contacts that carry those rewards and abilities.

## Authorities and current boundary

The normalized catalog is the exhaustive identity authority. The execution
union in `packages/planner-engine/src/execution-plan/model.ts` is the exhaustive
wire authority. The current consumer is protocol v17 in
`adamantRunPlanner-Plan_Executor`; its supported route extent is Underworld F
or F/G, not the full planner catalog.

Relevant durable authorities:

- [Game integration boundary](../../design/GAME_INTEGRATION_BOUNDARY.md)
- [Timeline reconciliation](../rooms-and-routes/GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md)
- [Reward game data](../rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md)
- [Acquisition, delivery, and settlement](../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md)
- [Run-impacting trait effects](../traits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md)
- [Keepsakes](../loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md)
- [Room features](../room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md)

## Current cross-family findings

1. Nectar/Pom Slice was the representative carrier lesson: `levelResolution`
   was carried correctly, but direct items use `UseStoreRewardRandomStack` and
   `AddStackToTraits`, not the ordinary Pom choice screen. The focused
   direct-level adapter now owns that contact.
2. The v17 wire carries the bounded F/G structure, acquisition, selected-trait,
   nested-consequence, loadout, Hex/Path, and Sea Star results named by the
   focused audits. Commerce and later-route contacts retain their own gates.
3. Starting weapon, aspect, Arcana, Fear, and keepsake are an explicit
   checked loadout contract; the executor observes rather than repairs them.
4. Selecting a trait lets the game run that trait's ordinary acquire behavior.
   That is sufficient only when the planner does not author a random or
   multi-target result. Exceptional dispositions must be checked individually
   rather than inheriting generic trait-offer coverage.
5. Simulation-neutral native drops, including meta-progression rewards, must
   remain visible to the game without becoming execution obligations or
   mismatch candidates.
6. Sea Star demonstrates why a positive producer relation is not complete
   random-effect coverage. The execution product and native adapter must also
   represent the authored negative result wherever vanilla could otherwise
   proc, and must cover both loot and direct-consumable carriers.
