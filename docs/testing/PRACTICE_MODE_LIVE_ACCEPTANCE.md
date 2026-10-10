# Practice mode live acceptance

Use a development build of the planner with internal run modifiers and a
matching installed game-module build. In Loadout, choose a start point on a
valid plan, optionally set its gold, save and send it, and start the run; the
module installs the plan's loadout. Use the Dream door for a Dream plan.
Source probes and automated tests are not live verification; the owner
confirms or waives each remaining check.

Accepted simplification: under the Boon Mana Reserve vow, installed boons hold
no reserved Magick. This is not a failure.

## Opening starts

- [ ] **Underworld.** Start at a later biome's Opening (for example G or H).
      The run opens in the plan's Intro room with no earlier rooms played.
- [ ] **Surface.** Start at the Q Opening of a plan that crosses N, O and P.
- [ ] **Dream.** Start at a later Dream biome's Opening. The room is entered
      with the Dream biome entrance, offers no extra reward choice, and the
      next biome choice after its Postboss excludes biomes already visited.

## Preboss starts

- [ ] **Underworld I.** Start at the I Preboss. The Clockwork countdown shows
      no remaining goals, the Preboss's World Shop is stocked as planned, and
      the I Boss and Postboss follow as in a full run.
- [ ] **Surface.** Start at a Surface Preboss with a World Shop (N, O or P).
      The shop is stocked as planned and its purchases price as in a full run.
- [ ] **Tight Deadline.** With the vow active, a Preboss start shows the
      biome's full allowance and the timer does not drain immediately. With
      Circe having disabled the vow in the plan, no timer runs.
- [ ] **Dream.** Start at a later Dream biome's Preboss. The room is entered
      without the Dream biome entrance, and the next biome choice after its
      Postboss excludes biomes already visited, including its own.
- [ ] **Forfeit and Fig Leaf.** Start at a Preboss in a biome where the plan
      already used Forfeit, or where Fig Leaf already skipped an encounter.
      Forfeit is unavailable for the rest of the biome and Fig Leaf does not
      skip again in it.
- [ ] **Save & Quit.** Save & Quit in a Preboss start room and continue. The
      World Shop still holds the planned stock and the room depth display is
      unchanged.
- [ ] **Weather.** An F or N Preboss start shows no weather. This is accepted.

For each start, before taking any action in the start room:

- [ ] The trait tray shows the plan's boons, hammers, Chaos curses and
      blessings, and Well, Hermes and Path of Stars entries at their planned
      levels and rarities, with no acquisition presentation or duplicated
      keepsake effect.
- [ ] The equipped keepsake is the planned one at its planned rank; any kept
      Permanent keepsake or Echo copy is held unslotted with its charges.
- [ ] Active Arcana match the plan, including raised rarities, temporary
      cards, Barren and vows Circe disabled.
- [ ] Max health and Magick equal the planned values and current health is
      full. Death Defiance charges match the equipped sources, all unused.
- [ ] Gold equals the native starting gold plus the authored start gold.
      Under Barren, at either start point, the native starting gold omits the
      unequipped Arcana's bonus gold, since native counts it after the Arcana
      are removed.
- [ ] The Path of Stars shows the planned layout, invested nodes and unspent
      points.
- [ ] The executor log shows the session admitted and no `practice-start`
      mismatch or executor fault; the plan steers the start room and later
      rooms (doors, rewards, offers) as in an ordinary run from that point.
- [ ] Depth-dependent content (room depth display, Fear depth effects)
      behaves as at that point of a full run. Timers are not installed: Tight
      Deadline starts fresh with the biome's full allowance.
- [ ] A Centaur threshold or an Echo replay at the start Intro changes the
      maxima natively after entry, without a `practice-start` mismatch.
- [ ] Save & Quit in the start room and continue. Max health and Magick still
      equal the planned values (the start room repeats its first-room hero
      setup), and the run continues natively.

## Records

- [ ] Die or clear, return to the Crossroads and start another run. The
      practice run does not appear in the run history, and the run count is
      unchanged.
- [ ] In a practice run, Save & Quit in a later room and continue. The run
      continues unsteered, and after it ends it is still absent from the run
      history.

## Optional Silver Wheel probe

- [ ] On a plan with a Gift Gift Gift copy of Silver Wheel, start after the
      copy. Dump the hero's `RoomRewardMaxManaTrait` entries (`Source`,
      `PropertyChanges[1].ChangeValue`) and compare `CurrentRun.Hero.MaxMana`
      with `GetExpectedMaxMana()`. Expect one `Source`-tagged entry for the
      slotted Wheel at its rank and untagged entries for every other grant.
