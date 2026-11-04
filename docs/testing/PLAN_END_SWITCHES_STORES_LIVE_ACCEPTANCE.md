# Plan end, challenge switches and reward stores live acceptance

Requires a current planner and an installed game module of the same schema
pair. Each section names the plan to send and set to play next. Automated hook
coverage is not live verification; the owner confirms or waives each check.

## Plan end

- [ ] Send a plan ending mid-biome (End plan here on an ordinary combat room).
      Play to the end room and clear it: the doors are native, leaving the room
      shows **Plan complete**, and the next room and the rest of the run stay
      native with no mismatch.
- [ ] Send a plan ending inside Ephyra's Hub stay, after a visit's main room
      or side room. Leaving that room shows **Plan complete**; no Hub departure
      mismatch appears when later leaving the Hub.
- [ ] With **Snap back to the plan** on, diverge in the end room (take an
      unplanned boon). Leaving it corrects the hero to the end room's frame and
      declines to force a door; the run continues natively.

## Challenge switches

Use a plan with a pressed switch of each kind where possible: Time (finished,
and one left mid-fight), Perfect Clear (hitless with the bonus Nectar, and one
taken with a hit), and Elite with a pinned elite and attributes.

- [ ] Each planned host room spawns its switch as the planned variant; rooms
      without a planned switch spawn none, and no `feature` mismatch appears.
- [ ] The room guide shows the switch row with its outcome (for example
      `Switch: clear unhit`).
- [ ] A composed Time or Perfect Clear encounter spawns its planned roster
      when pressed; an Elite switch fields the pinned elite with its planned
      attributes.
- [ ] Each planned outcome, played as planned, stays synchronized at the
      room's exit, and the claim's pickups (Pom, Max Health, Max Magick, Path of
      Stars, Onion, Nectar, gold) complete as ordinary acquisitions.
- [ ] Playing a different ending (leave a planned finished fight, take a hit on
      a planned hitless clear, or skip a planned press) stops the plan at that
      room's exit with a `challengeSwitchOutcome` mismatch naming both endings.
- [ ] With snap mode on, the next exit after such a mismatch corrects the hero,
      the reward stores and the encounter depth, and the run resumes in sync.

## Reward stores

- [ ] Play a plan through two biomes: no `room-exit-conformance:rewardStores`
      mismatch appears on any room whose doors draw planned rewards.
- [ ] Reroll an unplanned door: the run stops at the reroll as before; with
      snap mode on, the next exit rewrites the stores and the following rooms'
      store checks pass.

## Fields cage-count outcome

- [ ] In a Fields batch whose plan chose `max` while a two-cage door clamps it,
      `CurrentRun.FieldsMaxDoorsRolled` grows by one; with `min` it stays.
