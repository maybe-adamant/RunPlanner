# Linux desktop live acceptance

Use the AppImage from a release produced by the **Release** workflow, on an
x64 Linux desktop (and Steam Deck desktop mode where noted) with Steam, Hades II
under Proton, and r2modman. CI keeps the AppImage running for a few seconds
under Xvfb; that is not live verification. The owner confirms or waives each
remaining check.

Setup: give Hades II the Steam launch option
`WINEDLLOVERRIDES="d3d12=n,b" %command%` (community-documented for
Hell2Modding under Proton) and install `adamant-ModpackLib` in an r2modman
Hades II profile.

## Install and launch

- [ ] After `chmod +x`, the AppImage starts on a desktop with FUSE 2
      (`libfuse2` / `libfuse2t64`) installed.
- [ ] Without FUSE 2, `APPIMAGE_EXTRACT_AND_RUN=1` starts it.
- [ ] It starts in Steam Deck desktop mode.
- [ ] About shows the release version and source commit.
- [ ] Open, Save and Save As use the native file dialogs, and the remembered
      project reopens after restarting.

## Game setup

- [ ] With a native r2modman install, **Find r2modman profiles** lists the
      Hades II profiles under `~/.config/r2modmanPlus-local/HadesII/profiles`
      (or `$XDG_CONFIG_HOME` when it is set).
- [ ] With only the Flatpak r2modman, it lists the profiles under
      `~/.var/app/com.github.ebkr.r2modman/config/r2modmanPlus-local/HadesII/profiles`.
- [ ] With both installed, it lists the native install's profiles, and a
      Flatpak profile can still be chosen through **Choose folder…**.
- [ ] **Install** places the module in the chosen profile, and r2modman shows
      it next to ModpackLib.
- [ ] **Send here** writes a plan slot; started from r2modman under Proton, the
      game loads the module and follows the sent plan.

## Links and updates

- [ ] The ModpackLib store link and the bug-report issue link open in the
      default browser.
- [ ] Revealing a saved bug report opens its folder in the file manager.
- [ ] With a newer release published, the AppImage announces it, installs it
      in place after **Install and restart**, and reopens as the new version.
