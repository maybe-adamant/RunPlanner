# Game Module Distribution

The game module ships inside the desktop planner. This document owns how the
planner installs, checks and removes it in a game target, which plan headers
the module admits, and the bug report. Plan slots and their publication belong
to [Plan Slots and Publication](PLAN_SLOTS_AND_PUBLICATION.md); what a plan
means at run time belongs to the [Execution Protocol](EXECUTION_PROTOCOL.md).

## Bundled module

The desktop build assembles `game-module/` into the plugin folder that r2modman
would produce for a Thunderstore package: the `src/` payload and the package
files (`manifest.json`, `icon.png`, `LICENSE`, `README.md`) flattened into
`ReturnOfModding/plugins/adamantRunPlanner-Run_Planner/`. The manifest comes
from `manifest.template.json` stamped with the planner version; the module has
no version of its own. A Tauri-free game-host crate owns this lane over
explicit paths and embeds that folder, with per-file SHA-256 hashes, into the
binary at compile time, so every build carries exactly one module and never
downloads game packages.

## Plan admission

A plan is admitted by its header, independent of the release number. The
header carries `format`, `catalogVersion` and the planner's authored schema
pair, `schemaVersion` and `schemaRevision`, all inside `planFingerprint`. The
module admits a plan only when all four equal its checked-in
`execution-compatibility.json`, `{format, catalogVersion, schemaVersion,
schemaRevision}`, which assembly ships unchanged. One planner-engine test keeps
that file aligned with the decoder and the planner's
[schema pair](AUTHORED_PROJECT_MODEL.md#schema-change-approval), so the three
change together. Execution fixtures and checkpoints keep the pair they were
generated under; tests read them under the current pair.

A module-only change keeps the pair, so plans already sent stay admitted. A
change to the plan wire or to plan validity bumps the pair, and every plan sent
under the previous pair is outdated; execution-only wire changes need no
authored-project migration, since outdated slots are
[rebuilt](PLAN_SLOTS_AND_PUBLICATION.md#slot-sources-and-rebuild) or sent again
from their projects.

Before decoding, the module's inbox requires a plan whose `catalogVersion` and
schema pair equal its own; another catalog or pair is `stale-slot` (send the
plan again or update the module), as is a slot holding the `run-planner-slot`
envelope. The decoder then verifies the whole header,
`format` included, before a session opens.

The module's manifest version, the planner version stamped at assembly, decides
whether an update is offered; whether an install is current is decided by its
files (see [Install, update and remove](#install-update-and-remove)).

## Game target

The game target is an application setting in the desktop configuration
directory, never authored state or history. The planner never chooses a target
on the user's behalf. It can list r2modman profiles or accept a chosen folder
that is, or directly contains, a real `ReturnOfModding` folder: an r2modman
profile or a manual Hell2Modding install. Discovery marks each profile's
existing copy from cheap folder checks: the same ownership rule as removal (a
planner install record that r2modman does not manage), a planner record whose
`mods.yml` cannot be read, another copy (Thunderstore or r2modman-managed), or
none. The record keeps whether the target was discovered or chosen. Links,
files and paths resolving outside the chosen folder are rejected; every write
stays inside its `ReturnOfModding` folder.

The r2modman data root is `r2modmanPlus-local/HadesII/profiles` under:

| Platform | Data root parent                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Windows  | `%APPDATA%`                                                                                                                    |
| Linux    | `$XDG_CONFIG_HOME` (absolute) or `~/.config` for a native install, then `~/.var/app/com.github.ebkr.r2modman/config` (Flatpak) |
| macOS    | none; only the folder picker is offered                                                                                        |

On Linux discovery uses the first of the two roots that exists, else the
native one, and lists and accepts only that root's profiles; a profile of the
other install is still reachable by choosing its folder.

The planner tracks one target. Changing it only changes the saved setting: it
never installs into the new target or removes from the old one. The candidate
is validated by the same rules, without saving, before anything else; an
invalid one reports its reason and changes nothing, and reselecting the current
target is no change. Switching away from a target holding a planner install
first asks whether to keep that copy, which is then untracked and receives no
planner updates, or to remove it through the ordinary remove path; removal is
offered only when the host reports the module removable. A refused removal, or
a failure to set the new target after removal, leaves the target unchanged and
is reported. Forgetting the target clears the saved setting without touching
files, and publishing is blocked until a target is set again. Plan slots under
the old target's `config/` are never touched.

## Status

Status is reported by the host and presented by the application:

- the installed module against this planner's module, by manifest version and
  file hashes, and whether it admits this planner's plan header;
- whether r2modman manages the module, read from `mods.yml` (not applicable
  when the target has no `mods.yml`);
- ModpackLib, compatible when its version is at or above the module manifest's
  `adamant-ModpackLib` requirement with the same major version;
- dependencies named by the module and ModpackLib manifests that have no
  plugin folder with a manifest; Hell2Modding is present when its `d3d12.dll`
  sits beside `ReturnOfModding`;
- a leftover `RunPlanner_Modpack` coordinator, as a non-blocking notice;
- the bundled and installed compatibility files, for bug reports.

The planner reports ModpackLib and dependencies but never installs, updates or
removes them, and never edits `mods.yml`. Users install ModpackLib through
r2modman, which brings its dependency chain. The host owns the allowlist of
pages it opens in the browser: ModpackLib's Thunderstore page and the
repository's new-issue page. The planner does not check whether the game is
running.

## Install, update and remove

Install or update operates only on the established target and does nothing
when the installed files already match this build. A folder the planner did not
install, or one r2modman manages, is replaced only after explicit consent,
since disabling or uninstalling the package in r2modman renames or deletes the
planner's files. The new module is staged beside `plugins/`, verified against
its hashes and swapped in by rename; a failure keeps the prior install. The
replaced copy is first copied to the planner's application data
(`game-module-backup/`, latest only), never under `plugins/`, which
Hell2Modding would load; a failed backup aborts the install. If a swap and its
restore both fail, status reports the previous install left beside `plugins/`;
the next successful install backs it up before removing it. Stale staging and
removal folders are cleared when an install starts. The planner-owned install
record, `run-planner-install.json` in the module folder, holds the version,
source and file hashes.

Removal deletes only a module whose install record identifies a planner
install that r2modman does not manage (an unreadable `mods.yml` counts as
possibly managed), and leaves `config/` plan slots and ModpackLib in place.
Development builds also offer an install assembled at runtime from the local
`game-module/` checkout through the same flow; the checkout is only another
install source.

The installed module is current when the planner installed it from the same
source with exactly this planner's files and it is unmodified since; otherwise
install or update replaces it, even at the same version. A planner update
carries a new module: status offers an update while the installed module's
manifest version is older or its files were modified since install, never a
downgrade of a newer module. Sending needs only an installed compatibility file
equal to this planner's module's, so it is blocked only while the installed
module admits another plan header, which a schema or catalog change causes;
otherwise an older module still plays plans sent from this planner.

## Bug report

The desktop bug report saves one zip where the user chooses. The host
assembles it from explicit inputs: `report.json` (planner facts supplied by the
application, including the last send failure or a last send that was not made
active and the current settlement fault, merged with the host's status of the
established target), the open plan document when chosen, the event slot and
twelve plan slot files, `active-slot.json` and the slot overview when plans in
game are chosen, and log tails from `ReturnOfModding`: `LogOutput.log` and the
newest `backup/*_LogOutput.log` (last 2 MiB each) and `lovely.log` (last
1 MiB), each cut forward to a line start. Missing or unreadable sources are
recorded in `report.json`. Every entry replaces the user's profile folder with
`%USERPROFILE%` in any separator form, and the user name with `%USERNAME%`
where it follows the same parent folder under another root. Revealing the
report in its folder works only for the report this session last wrote.
