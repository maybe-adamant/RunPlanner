# Run Planner

Design a Hades II run, then play it.

This mod plays plans made in the Run Planner desktop app. You plan the rooms,
boons and rewards of a run in the app; the mod makes the game follow that plan
while you do the fighting and make the choices you planned. For full
instructions, see the
[Run Planner README](https://github.com/maybe-adamant/RunPlanner#readme).

## Requirements

- The [Run Planner app](https://github.com/maybe-adamant/RunPlanner/releases/latest).
  It installs and updates this mod from its **Game** panel; plans are sent only
  to a mod that matches the app.
- `adamant-ModpackLib` in the same r2modman profile.

## How to use it

1. In the app, send a plan to one of the twelve slots under **Plans in game**.
   Sending makes that slot the one the next run plays. To play another slot,
   choose it in the app's Game panel under **Active plan**, or in the game's
   **Run Planner** window (ReturnOfModding menu bar) under **Plan for next run**.
2. Start a new run and follow its choices. The mod gives the run your planned
   loadout and puts your own back when the run ends.

## The Run Planner window

The top line shows where things stand: **No run**, **Starting** or
**Synchronized** while the mod follows your plan (with **Practice** for a
Practice run), **Desynchronized** once the run no longer matches it, **Plan
complete**, **Plan not used** with the reason, or **Not steering** for a run
continued after Save & Quit.

- **Plan** picks the slot for the next run and shows the chosen plan's name,
  when it was sent, aspect, route, keepsake, Fear and any Practice start, with
  its status.
- **Current Run** shows which room of the plan you're in and the next planned
  room.

Out of sync means you took a different door or reward, or the game did
something the plan didn't expect. The mod stops steering and normal gameplay
continues; **Current Run** says where it happened and what differed.

**Show room guide** and **Highlight planned choices** on the **Plan** tab are
off by default. The guide shows read-only instructions for the current planned
room; highlights mark the next planned exit or choice but never select it.

**Snap back to the plan**, also off by default, picks the plan up again after
the run goes out of sync: leaving the room takes you into the planned next
room and restores the planned build there. It doesn't apply in Ephyra, across
biome changes, or after a reload, and stops for the run if a snap fails to
hold in the room it restored. The window and the victory screen count the snaps.

After a victory, the victory screen shows the plan's name and `Complete`, or
the room where the run went out of sync.

**Diagnostics** shows the raw slot and run records once **Debug Mode** is on
in the **Advanced** tab.

## Feedback

Run Planner is in beta. To report a problem, use **Create bug report…** in the
app's **Game** panel and attach the zip to an
[issue](https://github.com/maybe-adamant/RunPlanner/issues). Otherwise attach
`logOutput.log` from your r2modman profile's `ReturnOfModding` folder.
