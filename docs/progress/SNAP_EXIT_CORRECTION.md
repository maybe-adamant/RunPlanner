# Snap Exit Correction

Status: locked 2026-10-19. Base commit: `32a351e2b`.

## Objective

With snap mode on, every room exit leaves the hero in the plan's state and sends
the player to the planned room. Ephyra's board, side-room returns and the Hub
no longer need special cases. Today:

- the hero is corrected at the next room's `StartRoom` against that room's
  `roomEntered` frame;
- targets with no frame of their own are declined, including the Hub, a side
  room's return, and a main room returning to the Hub out of sync. After the
  first decline, the rest of the run stays desynchronized.

## Model

1. **Correct at the exit.** At every `LeaveRoom` with snap on, the module
   compares the live hero with the leaving occurrence's `beforeRoomExit` frame.
   The comparison covers the full snap family set (`snap/apply.lua`), not only
   today's narrower exit conformance families. Any difference is written
   through the snap writers before native `LeaveRoom` runs. Native `LeaveRoom`
   and `StartRoom` then replay everything after the frame: room-counted Chaos
   curses, Echo decay, Silken Sash, shop completions, the Well spark, and the
   Hub board draws.
2. **Force the planned door.** At every exit, in or out of sync, a door other
   than the planned one is replaced:
   - in Ephyra's board, native gets the planned door through door
     substitution, as today;
   - elsewhere, the door's room is rewritten, as today.
3. **Hub exit frame.** For each Hub visit the plan publishes the hero state just
   before leaving the Hub. That covers fountain use, the Aromatic Phial and the
   board's reward draws. The Hub exit then corrects against it like any other
   exit. A plan without this frame falls back to the next room's exit.
4. **Hub doors are always stamped.** Slot stamps are bound on every Hub visit,
   not only while synchronized.
5. **Room starts only check.** The `roomEntered` proofs report. Nothing is
   applied at `StartRoom`.
6. **A mismatch desynchronizes as today.** The rest of that room plays
   unsteered; most hero mismatches surface at the room's close anyway. The
   next exit corrects the hero, forces the door and repositions the route, so
   the next room is entered synchronized and steered.

Snapping stops only when an exit correction fails in its own room. The
existing loop rule stays: the snap fails by itself, never by comparing
mismatch kinds.

## Source facts

- The 2026-10-19 frame measurement compared each occurrence's `beforeRoomExit`
  with the next occurrence's `roomEntered` across all execution fixtures, 1,090
  pairs.
  - Every pair matched except those crossing `N_Hub`: the Hub board's
    reward-bag draws, and the fountain with the Phial.
  - Native `StartRoom` redoes the shrine deliveries and the Well spark.
- Native `LeaveRoom` mutates counted traits, Echo and Sash. That is why the
  exit apply must run before native `LeaveRoom`.
- The 2026-10-19 live spike (exit apply before native `LeaveRoom`) verified at
  every exit. Keepsake, aspect, weapons and the Time curse with its timer all
  survived native `LeaveRoom`/`StartRoom`.

## Ownership

- **Planner engine:**
  - capture the Hub-departure frame per Hub visit in the simulation;
  - publish it in the execution plan beside the Hub layout;
  - codec, assembly and fixtures.
  - The plan wire changes, so this is a minor `schemaRevision` bump, announced
    in the commit.
- **Game module:**
  - exit correction, forced door in and out of sync, Hub stamps on revisits,
    entry checks only;
  - delete the StartRoom apply, the pending snap through the Hub, the
    Hub-departure proof skip, the in-sync-only stray, Hub-return and declines,
    and `snap/exit_spike.lua`.
- **No planner application or UI change.**

## Gates

1. **Engine:** the Hub-departure frame, published and decoded. Regenerate only
   the fixtures whose product changes. `npm run test:engine` and
   `npm run test:equivalence` (an intended baseline update for the plan digest
   only).
2. **Game module:** the model above, with Lua witnesses for:
   - exit correction then native replay;
   - a side-room return out of sync;
   - a main room → Hub return out of sync;
   - the Hub exit using its frame, including a Phial used at the wrong time;
   - a wrong door out of sync;
   - Hub revisit stamps;
   - a plan without the Hub frame;
   - a mid-room mismatch, then the exit correction, then the next room
     entered synchronized.

   Acceptance: `npm run test:game-module`. Documentation: the Snap mode section
   in `docs/design/GAME_INTEGRATION_BOUNDARY.md`, and
   `docs/testing/SNAP_MODE_LIVE_ACCEPTANCE.md`.

3. **Closure:** an independent review of both gates. Delete this plan.

## Non-goals

- biome edges, Dream transitions and reloaded runs, which stay declined;
- a planned Hub occurrence;
- changing which fields are live (health, magick, armor, Death Defiance).
