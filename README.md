# Run Planner

Design a Hades II run, then play it.

Have a build you want to try? Want to recreate the build and route from the
world-record run? Plan the rooms you'll visit, the boons you'll be offered, and
the rewards you'll pick up along the way. Choose an Underworld or Surface run,
put together your own biome order in a Dream Dive, or plan the very first run
of a fresh save. You can even choose enemy lineups and certain boss attacks.

The plan has to work within the game's rules, and Run Planner checks your
choices as you build. Once it's ready, the Run Planner mod makes the game
follow your plan. You still do the fighting and make the choices you planned.

You'll use two pieces: the Run Planner app to create your plan, and the Run
Planner mod to play it in Hades II. The app carries the mod and installs it for
you.

## Download and install

Each [release](https://github.com/maybe-adamant/RunPlanner/releases/latest)
carries a Windows installer and a Linux x64 AppImage.

### Windows

1. Download `RunPlanner-<version>-windows-x64-setup.exe` (64-bit Windows 10 or
   11).
2. Run the installer. It installs for your Windows account only and needs no
   administrator rights.
3. The installer is not code signed, so Windows SmartScreen may warn about an
   unrecognized app. Choose **More info**, then **Run anyway**.

### Linux and Steam Deck

1. Download `RunPlanner-<version>-linux-x64.AppImage`, mark it executable
   (`chmod +x RunPlanner-<version>-linux-x64.AppImage`) and run it. On a Steam
   Deck, run it in desktop mode.
2. If it does not start, install FUSE 2 (for example
   `sudo apt install libfuse2`, or `libfuse2t64` on Ubuntu 24.04 and later), or
   run it with `APPIMAGE_EXTRACT_AND_RUN=1`.
3. Keep the AppImage where you run it from; in-app updates replace that file.

Hades II runs on Linux through Steam's Proton. For mods to load, the game's
Steam launch options need `WINEDLLOVERRIDES="d3d12=n,b" %command%`. This
setting is community-documented, not verified by this project.

## Getting started

1. Install **adamant-ModpackLib** in your Hades II r2modman profile. The app
   checks for ModpackLib but never installs it.
2. In the app, open the **Game** tab, pick your r2modman profile (or the folder
   of a manual Hell2Modding install) and choose **Install**. The Game tab lists
   anything else to fix first.
3. In the **Library**, choose **New plan**, **Import…** or **Browse catalog**
   for a ready-made plan. Plans save as you edit, in
   `Documents/RunPlanner/Projects/`.
4. Plan your route and loadout, and fix any issues the planner points out.
5. Choose **Send to slot N** in the plan's header. Sending also makes that slot
   the one the next run uses.
6. Launch the game with that profile, open the **Run Planner** window from the
   ReturnOfModding menu bar, and start a new run.

## Planning

Pick a route, then plan each room: which doors you take, which boons are
offered and which one you take, what you buy, and more. You can leave choices
unfinished or conflicting while you work; a plan can be sent once it passes the
game-rule checks.

The route's panels hold the rest:

- **Route** sets how far the plan goes, run modifiers such as enemy gold, and
  **Practice mode**, which starts the run later (at a biome's Opening, Preboss
  or Boss) as if the earlier rooms had been played.
- **Draft** fills the route with a random valid plan from the gods, NPCs and
  boons you ask for. Share its code to let others draft the same plan.
- **Loadout** sets your weapon, Aspect, Arcana, Fear, keepsake and familiar.
  The mod gives the run this loadout and puts your own back when it ends.

## Playing

The in-game **Run Planner** window shows whether the run is following your
plan, the current and next planned room, and which slot the next run uses. The
app and the game share that choice, and changing it mid-run only affects the
next run.

If you take a different door or reward, or the game does something the plan
didn't expect, the run goes out of sync: the mod stops steering, says where it
happened, and normal play continues. Optional settings show a room guide and
highlight your planned choices without making them for you.

From time to time a community event offers everyone the same planned run. The
app shows a notice and puts the event in the game's **Event** slot; pick it in
the game to play it.

## Updating

The app checks for updates when it starts, and About offers a manual check.
After updating the app, choose **Update** in the **Game** tab to update the
mod. A slot sent from an older version needs to be sent or rebuilt again.

## Feedback

Run Planner is in beta. You may encounter bugs or differences between your plan
and the game.

If something goes wrong,
[report an issue](https://github.com/maybe-adamant/RunPlanner/issues) with
what you expected and what you actually saw. **Create bug report…** under
About saves a zip with your plan, the plans in the game and the game logs to
attach.

## For developers

See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture, documentation map,
development setup and release process.
