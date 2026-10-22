# Run Planner

Design a Hades II run, then play it.

Have a build you want to try? Want to recreate the build and route from the
world-record run? Plan the rooms you'll visit, the boons you'll be offered, and
the rewards you'll pick up along the way. Choose an Underworld or Surface run,
or put together your own biome order in a Dream Dive. You can even choose enemy
lineups and certain boss attacks.

The plan has to work within the game's rules. Run Planner checks your choices
as you build, and every completed plan is checked against the game's rules.
Once it's ready, the Run Planner mod makes the game follow your plan. You still
do the fighting and make the choices you planned.

You'll use two pieces: the Run Planner app to create your plan, and the Run
Planner mod to play it in Hades II. The app carries the mod and installs it for
you.

## Download and install

Each [release](https://github.com/maybe-adamant/RunPlanner/releases/latest)
carries a Windows installer and a Linux x64 AppImage.

### Windows

1. Download `RunPlanner-<version>-windows-x64-setup.exe`. It needs 64-bit
   Windows 10 or 11; the installer fetches the Microsoft Edge WebView2 Runtime
   if it is missing.
2. Run the installer. It installs for your Windows account only and needs no
   administrator rights.
3. The installer is not code signed, so Windows SmartScreen may warn about an
   unrecognized app. Choose **More info**, then **Run anyway**.
4. Start **Run Planner** from the Start menu.

### Linux and Steam Deck

1. Download `RunPlanner-<version>-linux-x64.AppImage`, mark it executable
   (`chmod +x RunPlanner-<version>-linux-x64.AppImage`) and run it. On a Steam
   Deck, run it in desktop mode.
2. AppImages mount through FUSE 2. If it does not start, install it, for
   example `sudo apt install libfuse2` (`libfuse2t64` on Ubuntu 24.04 and
   later), or run it without FUSE as
   `APPIMAGE_EXTRACT_AND_RUN=1 ./RunPlanner-<version>-linux-x64.AppImage`.
3. Keep the AppImage where you run it from; in-app updates replace that file.

Hades II runs on Linux through Steam's Proton. Hell2Modding loads as a
`d3d12.dll` proxy, so the game's Steam launch options need
`WINEDLLOVERRIDES="d3d12=n,b" %command%` for mods to load. This setting is
community-documented, not verified by this project.

Your plans live in `Documents/RunPlanner/Projects/` as `.runplanner.json`
files and save as you edit; settings live in your user profile, not the install
folder.

## Getting started

1. Install **adamant-ModpackLib** in your Hades II r2modman profile. r2modman
   also installs its dependencies. The app checks ModpackLib but never
   installs it.
2. In the app, open Home's **Game** tab. Under Game location, choose **Find
   r2modman profiles** and pick your profile, or **Choose folder…** for the
   folder that contains `ReturnOfModding` in a manual Hell2Modding install. On
   Linux, discovery reads a native r2modman install's profiles, or the
   Flatpak's when only that one exists.
3. Choose **Install** under Game module. The Game tab lists anything else to
   fix first, such as an older ModpackLib.
4. In the **Library**, choose **New plan** or **Import…**, configure your
   loadout and route, and fix any issues the planner points out. Plans save as
   you edit, in `Documents/RunPlanner/Projects`.
5. In the plan's header, choose **Send to slot N**, or open ▾ to pick another
   of the twelve slots. Sending also makes that slot the one used for the next
   run; the Game tab shows every slot and lets you choose which plays next.
6. Launch the game with that profile and open the **Run Planner** window from
   the ReturnOfModding menu bar. **Plan for next run** shows the slot the next
   run will use; pick another slot there or in the app.
7. Start a new run and follow its choices. The mod gives the run your planned
   weapon, Aspect, Arcana, Fear, keepsake and familiar, and puts your own
   loadout back when the run ends.

The in-game picker and the app share one active slot: picking a slot in either
place changes it for both. Changing it during a run only changes which plan the
next run uses; it never replaces the plan already in progress.

## Planning

Create an **Underworld**, **Surface**, **Dream Dive** or **Fresh File**
project, or open an existing plan file. A Dream Dive sets your own biome order; a
Fresh File plans the very first run of a brand-new save, with its fixed
starting weapon.

Choose your starting weapon, Arcana, Fear, keepsake and reward in **Loadout**.
Select a room and open its **Room Timeline** to plan its interactions, such as
which boons are offered and which one you take. You can leave choices
unfinished or conflicting while editing; a plan can be sent once it passes the
game-rule checks.

Run modifiers live with the route:

- **Practice mode** starts the run later: at a later biome's Opening, or at a
  biome's Preboss or Boss, with an amount of gold added to what the game
  starts you with. The mod sets up the run as if the earlier rooms had been
  played.
- **Enemy gold drop chance** sets the chance that eligible enemies drop gold,
  and **Encounter gold range** fixes each encounter's gold budget at one point
  of its usual range.

## Playing

The **Run Planner** window's top line always shows where things stand:

- **No run**: no plan is running yet.
- **Starting** and then **Synchronized**, with the plan's name and slot, while
  the mod follows your plan; a Practice run adds **Practice**.
- **Desynchronized**: the run no longer matches the plan, and the window names
  the room where it stopped matching.
- **Plan complete**: every planned room is done.
- **Plan not used**: the selected plan couldn't start, with the reason, for
  example a plan sent for another Run Planner version.
- **Not steering**: a run continued after Save & Quit keeps its planned
  loadout but is no longer steered.
- **Stopped (planner error)**: the mod hit an internal problem.

The **Plan** tab picks the slot for the next run. Each slot is labelled with
the plan sent to it, or marked empty. The chosen slot shows its plan name, when
it was sent, its aspect, route, keepsake, Fear and any Practice start, with a
status: **Ready**, or a note when it was sent for another Run Planner version
or can't be read. The details follow a resend on their own; **Reload** reads
the slot again if needed.

The **Current Run** tab shows the running plan, which room of the plan you're
in and the next planned room. A Practice run counts from its starting room.

Out of sync means the run no longer matches the plan: you took a different
door or reward, or the game did something the plan didn't expect. The mod
stops steering and normal gameplay continues—you can keep playing or start a
fresh planned run. **Current Run** says where it happened and what differed,
with **More details** below.

The **Plan** tab also has two optional settings, both off by default:

- **Show room guide** shows read-only guidance for the current planned room;
  it doesn't make choices or change steering.
- **Highlight planned choices** marks an available planned exit, Ship wheel
  offer, or trait-screen row; it never selects it for you.

After a victory, the victory screen shows `Planned run - <plan name>` and
`Complete`, or the room where the run went out of sync, beneath the `Modded`
label.

With **Debug Mode** on, a **Diagnostics** tab shows the raw slot and run
records to include in a bug report.

### Community events

From time to time a community event offers everyone the same planned run. The
app shows it above your project, `Event: <title> · ends <date>`, with
**Details**, **Open project** (adds a copy of the event's plan to your library
to study or change), **Copy link** and **Dismiss**. You don't need to send
anything: once the mod is set up, the app puts the event in the game's read-only
**Event** slot, listed first in the **Plan** tab's picker. Pick it to play the
event; the victory screen then reads `Planned event - <title>`. When the event
ends, the Event slot is cleared, and if it was selected the next run uses Slot
1; the notice tells you so. Events come from the
[RunPlanner-Events](https://github.com/maybe-adamant/RunPlanner-Events)
repository.

## Updating

Official releases check for updates when the app starts, and About offers a
manual check. When an update is found, choose **Update**, then **Install and
restart**.

After updating the app, open the **Game** panel and choose **Update** to update
the mod. Sending waits until the installed mod matches the app, and a slot sent
for another version is marked in the game until you send it again.

## Feedback

Run Planner is in beta. You may encounter bugs or differences between your plan
and the game.

If something goes wrong,
[report an issue](https://github.com/maybe-adamant/RunPlanner/issues) with your
plan, the room where it happened, what you expected, and what you actually saw.
In the app, **Create bug report…** under About saves a zip with your
plan, plans in game and game logs to attach.

Otherwise include `logOutput.log` from your profile's `ReturnOfModding` folder.
With r2modman, profiles are in:

- Windows: `%APPDATA%\r2modmanPlus-local\HadesII\profiles\`
- Linux: `~/.config/r2modmanPlus-local/HadesII/profiles/`, or
  `~/.var/app/com.github.ebkr.r2modman/config/r2modmanPlus-local/HadesII/profiles/`
  for the Flatpak

Open the profile you play with, then its `ReturnOfModding` folder.

## For developers

See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture, documentation map,
development setup and release process.
