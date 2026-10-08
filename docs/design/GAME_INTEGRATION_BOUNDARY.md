# Game Integration Boundary

## Contract

The strict execution protocol carries a
complete-valid configured Underworld, Fresh File or Surface prefix, through
`F/G/H/I` (both Underworld profiles) or `N/O/P/Q`, or a public Dream prefix. The desktop
publisher writes an execution-only JSON artifact to one of six fixed Plan
Executor slots in the established game target; the browser build has no
publication capability. Sending a plan also makes its slot active. The
Executor reads the active slot from `active-slot.json` (see
[Shared configuration folder](#shared-configuration-folder)), reads only that
plan slot at the next run admission, and freezes the decoded plan for the live
session. Execution normally admits at
run start; publication does not hot-swap a live session. One bounded recovery
path may instead admit a freshly loaded game at the start of an explicitly
marked Postboss occurrence when its native room, weapon/aspect, and published
entry-conformance state match. No other mid-run attachment, edited-plan repair,
or recovery after a mismatch is supported.

The transport names the slots `slot-1.runplanner.json` through
`slot-6.runplanner.json` under the Run Planner game module configuration directory. The
planner changes the active slot only when the user sends a plan or picks a slot,
and never chooses a game target on the user's behalf. There is no
compatibility alias or implicit migration. An empty or
invalid selected slot therefore remains a bounded admission error, while
publishing another slot does not disturb a frozen live session.

### Distribution and the game target

The game module ships inside the planner. The desktop build assembles
`game-module/` into the plugin folder that r2modman would produce for a
Thunderstore package: the `src/` payload and the package files (`manifest.json`,
`icon.png`, `LICENSE`, `README.md`) flattened into
`ReturnOfModding/plugins/adamantRunPlanner-Run_Planner/`. The manifest comes from
`manifest.template.json` stamped with the planner version; the module has no
version of its own. The Tauri-free `run-planner-game-host` crate
(`apps/planner/src-tauri/game-host/`) owns this lane over explicit paths; its
`build.rs` embeds that folder, with per-file SHA-256 hashes, into the binary at
compile time, so every build carries exactly one
module and never downloads game packages.

Compatibility has two parts, both independent of the release number and the
authored save schema:

- The plan header's `format` and `catalogVersion` must equal the module's
  checked-in `execution-compatibility.json`, `{format, catalogVersion}`. The
  module's tests keep that declaration aligned with its decoder and decode the
  planner-engine execution fixtures in place.
- The module **build identity** (`buildId`) is SHA-256 over the sorted
  `path NUL sha256 LF` lines of the checked-in `src/` payload; the manifest,
  icon, license and readme, and the engine source, are outside it. A wire change
  always changes the strict Lua decoder, so it changes the build, while the
  fixture-decode lane catches engine/module drift. Assembly (shared by the
  embedded package and the development checkout install) computes it and
  stamps the packaged `execution-compatibility.json` as
  `{format, catalogVersion, buildId}`; a checked-in `buildId` is refused. The
  plan wire and the execution fixtures never carry a build identity.

The game target is an application setting in the desktop configuration
directory, never authored state or history. The Game panel's Game location offers
**Find r2modman profiles**, which lists the Hades II profiles under the
platform's r2modman data root (`%APPDATA%\r2modmanPlus-local\HadesII\profiles`
on Windows; other platforms currently offer only the folder picker), and
**Choose folder…**, which accepts any folder that is, or directly contains, a
real `ReturnOfModding` folder: an r2modman profile or a manual Hell2Modding
install. Discovery marks each profile's existing copy from cheap folder checks:
the same ownership rule as removal (a planner install record that r2modman
does not manage), a planner record whose `mods.yml` cannot be read, another
copy (Thunderstore or r2modman-managed), or none. The record keeps whether the
target was discovered or chosen. Links, files and paths resolving outside the
chosen folder are rejected; every write stays inside its `ReturnOfModding`
folder.

The planner tracks one target. Changing it only changes the saved setting: it
never installs into the new target or removes from the old one. The candidate
is validated by the same rules, without saving, before anything else; an
invalid one reports its reason and changes nothing, and reselecting the current
target is no change. Switching away from a target holding a planner install
first asks whether to keep that copy, which is then untracked and receives no
planner updates, or to remove it through the ordinary remove path; removal is
offered only when the host reports the module removable. A refused removal, or
a failure to set the new target after removal, leaves the target unchanged and
is reported. **Forget** clears the saved setting without touching files, and
publishing is blocked until a target is set again. Plan slots under the old
target's `config/` are never touched.

Status is reported by the host and presented by the application:

- the installed module against this build, by file hashes and version;
- whether r2modman manages the module, read from `mods.yml` (not applicable
  when the target has no `mods.yml`);
- ModpackLib, compatible when its version is at or above the module manifest's
  `adamant-ModpackLib` requirement with the same major version;
- dependencies named by the module and ModpackLib manifests that have no
  plugin folder with a manifest; Hell2Modding is present when its `d3d12.dll`
  sits beside `ReturnOfModding`;
- a leftover `RunPlanner_Modpack` coordinator, as a non-blocking notice.

The planner reports ModpackLib and dependencies but never installs, updates or
removes them, and never edits `mods.yml`. Users install ModpackLib through
r2modman, which brings its dependency chain. The ModpackLib step links to its Thunderstore page. The host owns the allowlist of pages it opens in the browser: that page and the repository's new-issue page.

**Install** or **Update** operates only on the established target and
does nothing when the installed files already match this build. A folder the
planner did not install, or one r2modman manages, is replaced only after
explicit consent; the r2modman warning explains that disabling or uninstalling
the package there renames or deletes the planner's files. The new module is
staged beside `plugins/`, verified against its hashes and swapped in by rename;
a failure keeps the prior install. The replaced copy is first copied to the
planner's application data (`game-module-backup/`, latest only), never under
`plugins/`, which Hell2Modding would load; a failed backup aborts the install.
If a swap and its restore both fail, status reports the previous install left
beside `plugins/`; the next successful install backs it up before removing it.
Stale staging and removal folders are cleared when an install starts. The planner-owned install record,
`run-planner-install.json` in the module folder, holds the version, source and
file hashes. **Remove game module** deletes only a module whose install record
identifies a planner install that r2modman does not manage (an unreadable
`mods.yml` counts as possibly managed), and leaves
`config/` plan slots and ModpackLib in place. Development builds also offer an
install assembled at runtime from the local `game-module/` checkout through
the same flow; such an install is publishable in development builds while its
files match its record.

A planner update carries a new module, so the installed copy stops matching
the build: status offers **Update** and sending stays blocked until it runs.
The planner does not check whether the game is running.

**Create bug report…** (Game panel and About, desktop only) saves one zip
where the user chooses. The host assembles it from explicit inputs:
`report.json` (planner facts supplied by the application, including the last
send failure or a last send that was not made active, merged with the host's
status of the established target), the open plan document when chosen, the
six plan slot files and `active-slot.json` when plans in game are chosen, and
log tails from `ReturnOfModding`: `LogOutput.log` and the newest `backup/*_LogOutput.log`
(last 2 MiB each) and `lovely.log` (last 1 MiB), each cut forward to a line
start. Missing or unreadable sources are recorded in `report.json`. Every entry
replaces the user's profile folder with `%USERPROFILE%` in any separator form,
and the user name with `%USERNAME%` where it follows the same parent folder
under another root. **Show in folder** reveals only the report this session
last wrote.

### Shared configuration folder

Anything both the planner and the game module need lives in
`config/adamantRunPlanner-Run_Planner/`, in a format they own together:

- the six plan slots `slot-N.runplanner.json`, which only the planner writes,
  each the envelope
  `{"format":"run-planner-slot","buildId":"…","plan":<plan>}` with the plan
  bytes unchanged and the whole file within 1 MiB;
- `active-slot.json`, the plan slot the module plays next, which both write.

Settings that only the game uses, such as the room guide, highlights and
`Enabled`, stay in ModpackLib storage. The planner never reads or writes the
ModpackLib `.cfg`.

`active-slot.json` is the only record of the active slot:

```json
{ "format": "run-planner-active-slot", "formatVersion": 1, "slot": 3 }
```

- Both sides decode strictly: exactly these three keys, `slot` an integer
  from 1 through 6, and at most 1 KiB. The module writes the compact form
  `{"format":"run-planner-active-slot","formatVersion":1,"slot":3}`.
- The planner writes it atomically, as it writes plan slots. The module writes
  a temporary file beside it, removes the old file, then renames (retrying
  the rename once), because
  `os.rename` cannot replace a file on Windows. A reader can briefly find the
  file missing, never partial.
- A missing or invalid file means slot 1 to the module, which rewrites the file
  only when the player picks a slot. The planner shows no active slot until
  one is picked. The module logs one `[RunPlanner] active-slot` line per slot
  it writes and one per change of invalid content it reads. Because a missing
  file already shows slot 1, the in-game picker saves slot 1 only after another
  slot was picked; it shows a hint while no choice is saved.
- Last writer wins. Neither side keeps a copy: the module reads the file at
  new-run admission, loadout and Postboss resync, and the planner reads it
  with the slot facts. A change made during a run takes effect at the next
  admission.
- Sending a plan also makes its slot active. The planner makes a slot active
  only when that slot holds a plan; the in-game picker offers all six.

### Publication preconditions

Sending a plan uses only the established target and performs no discovery.
The host rechecks the target when publishing and refuses with the blocking
reasons, including found and required versions, unless the installed module
matches this build and ModpackLib is compatible. Before any write, the installed
`execution-compatibility.json` must match the outgoing plan header's `format`
and `catalogVersion`, and its `buildId` must equal the reference build: the
embedded package, or, in a development build whose install record names a
checkout install, the checkout freshly assembled at send time (a mismatch asks
to **Install from checkout** again). The slot is then written as an envelope
naming that build. `mods.yml` is never edited, and under `config/` the planner writes only
the shared folder described above. After writing the plan the host writes
`active-slot.json`; if only that write fails, the send still succeeds, the plan
stays, and the result carries the activation problem, which the planner shows
as a notice rather than a failed send. Making a slot active without sending
has the same target checks and requires the slot to hold a readable plan.

A sent plan's identity chain is the saved file, then the document's
`projectId`, then the compiled `planFingerprint`. Its name is the saved file's
stem (`Surface Phial run.runplanner.json` names "Surface Phial run"); there is
no separate authored name. Sending therefore needs a saved file with no unsaved
changes: a clean file sends, a file with unsaved changes offers **Save and
send**, which saves in place first, and a never-saved project offers **Save and
send…**, which opens Save As and sends under the chosen name, or sends nothing
if cancelled. The plan carries the stem as the optional,
presentation-only `displayName`, which is outside `planFingerprint`; the game module accepts it
and only logs it. Save As from an already-saved file gives the copy a new `projectId`
(the first save of a never-saved project keeps its own), so earlier sends no
longer match it.

Once the module is ready, the Game panel shows the six slots as a table: Slot,
Plan, Route, Ends, Aspect and Sent. The host reads each slot under the same
link and containment rules and the 1 MiB bound, and reports it as empty,
present, stale or unreadable with its modified time, the envelope's `buildId`,
and only existing wire fields: `projectId`, `displayName`, `routeKey`, `extent.biomeKeys`,
`startingLoadout.weaponKey` and `startingLoadout.aspectKey`, and
`planFingerprint`. The application labels the route, final biome, aspect and
weapon (by its `shortLabel`) from the catalog; a loadout without an aspect
shows "None", and a plan without `displayName` shows _Unnamed_, Sent is a compact relative time with the exact local time as
its title and description, and an unreadable slot shows only "Unreadable". A
slot whose envelope names another build than the installed module, or a bare
plan written before slots carried an envelope, is stale and shows only "Sent by
another build — send again"; it cannot be made active, and the header's quick
send treats the open project's own stale slot like its present one. Host status
also carries the bundled and installed `buildId` into bug reports.

The Slot column is an **Active slot** radio group, with arrow-key choice, that
shows `active-slot.json` as last read. No radio is selected while the file is
missing or invalid; a file naming a slot without a readable plan shows that row
selected, and such rows cannot be chosen. Picking a slot that holds a plan
writes the file without resending. The group is unavailable while the write is
pending, the slots are then re-read, and a failed write leaves a short notice
and the selection unchanged. A successful send selects its slot.

A slot with the open project's `projectId` is marked **current** when its
fingerprint matches the compiled plan and **older version** otherwise, by plain
identity equality. **Send here** fills an empty slot and
**Replace** overwrites an occupied one after confirmation, both taking the Save
and send forms when a save is needed; all are absent while the current project
cannot compile, which the panel explains from the compiler's error code: a
known route, extent or opening code gets its own sentence, and any other failure
asks to resolve the plan's findings, never showing raw compiler text. That
reason shows in a warning callout with a **Show findings** action, present only
when the evaluation has a next repair, which closes the panel and navigates to
it exactly as the Next repair banner does. The planner remembers the last slot
sent for the loaded project as UI-session state only: a send from the Game panel
or the header sets it, and loading, creating or replacing the document, or
restarting, clears it.

The header always shows one send button beside the Game button, with a fixed
minimum width so no state shifts the header, and explains every state in its
hint:

| State                                  | Label                         | Clicking                                     |
| -------------------------------------- | ----------------------------- | -------------------------------------------- |
| No project open                        | Send to game                  | nothing (Open a plan first)                  |
| Module not ready                       | Send to game                  | nothing (Set up the game in the Game panel)  |
| Engine reports the plan ineligible     | Send to game                  | nothing (the Game panel's reason)            |
| No usable session slot, or never saved | Send to game…                 | opens the Game panel at Plans                |
| Ready                                  | Send · Slot N                 | sends, saving unsaved changes in place first |
| Saving, then sending                   | Saving…, Sending…             | nothing                                      |
| Result, for 3 seconds                  | ✓ Sent · Slot N or ! Not sent | nothing                                      |

It re-sends only to the session slot, and only while it is empty or holds the
same `projectId`, so it never overwrites another project's plan. It reads the
engine's execution-plan eligibility without compiling and compiles only when
clicked. A hidden status region announces each result. A failed send, from
either place, is kept as UI-session state until the next send or a document
replacement: the Game panel shows it as a Last send notice and the Game button
shows **!** ("Game — last send failed"). Otherwise the Game button shows the same
overall state as the panel with a distinct symbol and a text alternative,
including when status could not be read.

The compiler consumes the exact simulation assembly that the planner already
validated. It does not rerun candidate policy or duplicate validation. The
Executor strictly decodes this bounded artifact, translates its closed facts
through fixed native adapters, observes the player-controlled trace, and stops
enforcement at the first mismatch. The native game continues from that point;
neither side searches, repairs, or replans.

The planner engine and its complete-valid evaluation document are the sole
authority for concrete acquisition semantics. Each acquisition event carries
its resolved offer, producer lifecycle and store provenance, generated-parent
provenance when applicable, concrete roles, and settlement ownership. The
compiler is only a lossless shape translator from that engine document to the
execution-plan wire: it may select records by their semantic addresses, require
branch agreement, encode addresses, and copy the exact selected trait and level
products. It must not derive domain meaning. If the wire needs another semantic
fact, that fact must first become an explicit engine product. In particular,
the compiler must not recover Artificer, Sea Star, Echo, or other producer
meaning from encoded keys, inspect authored room internals as a fallback, or
substitute a lifecycle point for producer provenance.

The editable project and execution plan are separate schemas. An incomplete or
invalid project can be saved, but it cannot be published. The wire carries
resolved game identifiers and semantic owners, never authored commands,
candidate products, findings, UI labels, callbacks, or Lua.

Each occurrence carries an ordered room-guide projection, empty for unselected
occurrences, with small resolved description operands and optional exact
transaction owners. The module presents it as read-only guidance: owner
completion can hide its
associated row, while informational rows remain visible. Guide rows neither
add transactions nor participate in Timeline dependencies, obligations, or
conformance; unavailable or desynchronized room state hides the presentation.

Feature presence and feature interaction remain distinct facts on the wire.
A native room field locked by `BlockedByRequirements`, such as the H Postboss
Pool on a fresh profile, is unusable natively and counts as absent.
A present uninteracted Stygian Well or Pool of Purging is emitted with
`interacted: false` and no fabricated inventory. A present interacted feature
is emitted with `interacted: true` and its exact engine-owned inventory. The
native adapter must realize the object in both cases, pass through vanilla
inventory generation only in the former, and constrain the latter.

Door destinations carry explicit `zagreusContractPresent` for both batch and
fixed navigation. This is the same canonical additional-exit presence published
in the destination Overview, copied for an earlier consumer rather than
independently inferred. Navigation applies the value after native room
initialization and before its incoming preview; the native contract spawn
later reads that same flag. The executor does not identify midshops or inspect
future Overview features to reconstruct the door's advertisement. The
additional exit and its binding remain destination-room-owned.

Fixed continuations, including Zagreus and Anomaly returns, reference the
destination occurrence rather than repeating its reward inline. Navigation
resolves that destination's published incoming reward for both realization and
exit proof; absence of an inline reward does not mean no reward. Native required
Boss drops retain their explicit preservation policy.

An occurrence's optional `suppressedNpcShopping` names only the native shopping
events that would invalidate a later planned Nemesis or Heracles encounter.
The engine derives this protection from reached encounter preparation and its
exact room-history window; execution assembly copies it without lookahead.
At a synchronized, bound occurrence the module suppresses the named
`CheckNemesisShoppingEvent` or `CheckHeraclesShoppingEvent` callback before its
history flags or shopping thread. Other callbacks, unbound rooms and
desynchronized execution remain native. Suppression is diagnostic, not a new
transaction or mismatch obligation.

### Run modifiers

The optional top-level `runModifiers` execution product carries the complete
declared run-modifier record authored in Loadout: today the optional
`enemyGoldDropChance` and `encounterGoldRange` percentages, each present only
while enabled. It is separate from `startingLoadout` and native equipment
conformance. Native settings are omitted by the producer, preserving default
document fingerprints. The planner decoder validates a present record
against the declaration table; the module reads only the modifiers it
implements, validates those values, and ignores unknown keys, which remain part
of the fingerprinted contents. Fingerprint verification uses the record's
actual presence without inserting defaults.

The module binds settings to the admitted plan and native `CurrentRun` identity.
They become active only after starting-loadout verification or supported
Postboss entry admission. Changing the selected slot does not change them.
Only these run-wide modifiers continue after `configured-prefix-complete`;
ordinary room steering remains passive. Rejection, mismatch, executor fault,
death, Crossroads presence, and a different native run prevent their application.
Activation and temporary scopes are process-local, never native-save-backed.

Enemy gold drop chance replaces only the positive chance input for capped
hostile-enemy death drops with the chosen percentage; native amounts,
`BlockMoney`, and encounter-store accounting remain authoritative. Reaction,
breakable and uncapped drops are outside this setting. Encounter gold range
narrows the native budget bounds to one value for the duration of each
`GenerateEncounter` call with numeric bounds, so native still makes its one
budget draw and applies its depth ramp and money multiplier; it composes with
the planner-owned base-difficulty narrowing in either wrap order and also
applies to native generations. Gold-urn generation is unchanged.
The [run-modifier source audit](../audits/loadout-and-progression/RUN_MODIFIERS_GAME_DATA_AUDIT.md)
owns exact native contacts and exclusions.

Temporary scopes are coroutine-local, nesting-safe, and restored on return or
error. Missing required native functions and escaping host errors fault execution;
recognized unsupported contacts pass through with bounded diagnostics. Modifier
diagnostics may continue after prefix completion without enabling other adapters.
There are no gold-total conformance obligations.

### Content fingerprint

The compiler and execution decoders verify the expanded execution product with
the same FNV-1a 32-bit checksum, rendered as eight lowercase hexadecimal digits.
The fingerprint excludes itself; diagnostic transport deltas are expanded before
hashing. It detects inconsistent contents, not malicious tampering.

The canonical input is independent of JSON formatting and host locale:

- Null is `z`; booleans are `t` and `f`.
- A finite number is `n`, its 16 lowercase big-endian IEEE-754 binary64 hex
  digits, then `;`. Negative zero is normalized to positive zero. Non-finite
  values are rejected; fractional values are never rounded for hashing.
- A string is `s`, its UTF-8 bytes as lowercase hex, then `;`. Strings must
  contain Unicode scalar values; unpaired UTF-16 surrogates are rejected.
- Arrays concatenate their value tokens between `[` and `]` in array order.
- Objects concatenate key-string tokens and value tokens between `{` and `}`,
  sorted by the keys' UTF-8 byte sequence. There are no extra separators.

Canonicalization changes require a decoder change and republishing;
decoders do not try alternate fingerprints for older publications.

## Execution ownership

### Prefer the published answer

The executor reuses the planner's completed decision work in this order:

1. **Insert the published result directly** at a supported native boundary
   when it accepts the answer cleanly: trait offers, inventory, room choices,
   targets, and resolved operands. Do not reconstruct those results through
   many RNG hooks merely to imitate the native generation path.
2. **Steer the specific native random decision** when direct insertion is not
   a clean fit. Identify the action and its exact decision, then select the
   published candidate or yes/no result while preserving native application.
3. **Recreate native behavior only as a justified last resort.** A native
   clock, eligibility calculation, payment, consumption, or effect loop must
   not be implemented again merely because the planner simulates it.

Deciding an outcome is distinct from applying it. Copying an already-resolved
trait screen is direct result insertion, not recreation of acquisition. The
native game still owns player selection and application of that selection.
Likewise, exact room-content realization may use a native generation input;
this does not authorize manufacturing unrelated gameplay preconditions.
Condition overrides must state which native branch they affect and why a
published-result input or a specific RNG contact cannot suffice. A native
eligibility function name alone neither justifies nor condemns the adapter.

Scope/binding and checkpoint coordination support these interventions; they
are not competing ways to implement the gameplay effect. For every scope
retained across a thread, yield, or deferred callback, identify the information
unavailable at a single intervention point, the exact consumer, and its
retirement boundary. Prefer fewer lifetime assumptions, not fewer hooks at
the cost of recreating native logic. Native threaded dispatch alone does not
justify a thread-spanning executor scope.

The planner workspace already separates the information the runtime consumes:

| Planner surface | Execution meaning                                                      | Runtime responsibility                                                   |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Overview        | What the occurrence contains                                           | Realize supported room objects and fixed contents, then observe contact  |
| Timeline        | Consequential occurrence actions and their sparse dependencies         | Realize enforceable facts; bind native actions to published transactions |
| Doors           | Which exits exist, what they offer, and which continuation is selected | Generate supported exits/rewards and observe the selected traversal      |

The protocol preserves concrete room and reward identifiers, repeatable room
occurrences with stable IDs, physical exit identity and order, picked and
unpicked offers, lifecycle ordering, semantic owner addresses, selected
acquisitions versus mere offers, canonical Run State checkpoints, and catalog
compatibility information.

Fields door targets carry cage rewards even when unpicked. Physical entry,
cage and optional-reward placements are entered-room facts: they are required
only for selected Fields occurrences, not for their unpicked door alternatives.

Encounter customization travels inside the matching `overview.encounterPhases`
record, despite being authored on the application's Timeline. Adapters consume
the existing native encounter binding and resolved operands; they do not search
for a matching Boss elsewhere in the room. Omitted decisions remain native.
Explicit decisions steer reached behavior without adding required attacks,
transactions or conformance facts. The [encounter audit](../audits/game-execution-contacts/NPCS_ENCOUNTERS_AND_AUTOMATICS.md#boss-decisions)
owns the supported native contacts and narrowly agreed progression overrides.

A cocoon count and reward point are independent optional Arachne combat
decisions. `SetupArachneCombatEncounter` receives a private argument copy with
equal count bounds only when a count is selected; native `RandomInt` still runs.
The reward point is a native anchor ID, not a map label or coordinate. Before
steering, the adapter checks the actual required/preferred point pool (including
F's fallback pool) and live `IsSpawnPointEligible` occupancy. It substitutes that
anchor for the first native cocoon placement, one of the native count, then
selects its actual object only at the reward draw over the exact `CoocoonIds`
table. Native setup retains occupancy, sizes, contents and all reward callbacks.

The interception is scoped to the bound setup and its spawn call, isolated by
Lua thread and nested contact, and cleaned up on return or error. Story/direct
spawning, omitted decisions and unbound contacts remain native. An unavailable
point or count outside native bounds declines independently with a diagnostic.
A missing placed target falls back to native reward selection; placement
shortfall remains diagnostic and setup errors are rethrown. Neither placement
choice creates a transaction or new desynchronization condition.

An extent containing Olympus requires one `olympusAetos` directive: `none`, or
an exact selected occurrence, phase and wave target. Other extents omit it.
The assembler copies the valid reached appearance from encounter history; the
executor neither scans future rooms nor reconstructs planner eligibility.
Existing authored saves without a selection remain compatible but newly
published plans explicitly suppress Aetos in Olympus. Older execution artifacts
require re-export; this does not change the authored schema.

`none` suppresses only the native Aetos wave event. A target suppresses it before
the requested actual wave, then removes only `ChanceToPlay` from a private
event-requirements copy passed to the native dispatcher. Native requirements,
Outdoor checks, spawning, cooldown and cap restoration remain native. A room
spawn flag confirms success; a missing actual wave, live ineligibility or a
missed/skipped target produces one diagnostic and releases subsequent encounters
to native behavior. Failure cannot relocate the appearance to another wave of
the target encounter. Native one-wave GeneratedP is valid best-effort fallback,
including when composition admission itself fell back. Target departure closes
a missed attempt. There is no Aetos transaction or conformance mismatch, and
runtime uncertainty does not enter planner findings. Scope is session-local and
retires on biome departure, lost binding or reset; unrelated dispatch is native.

An infinite roster owns only the ordered `FillEnemyTypes` draws of an
`InfiniteSpawns` encounter. It has no budget, wave or count admission. At the
same generation-scoped `CalculateActiveEnemyCap` contact, before mutation, the
executor checks one native wave, an empty manual template, the effective type
bounds and pool, and each type through live `IsEnemyEligible` against a wave
holding the earlier types. That applies blacklists, draw-order exclusions and
the elite limit as native does. Acceptance installs ordered generated entries with
native draw side effects and no `TotalCount`. Native `FillEnemyCounts` marks them
infinite; Fangs and Menace remain native. Decline, realization failure and
diagnostics follow the finite contract.

Encounter selection checks the requested variant through native eligibility before
forcing it. Enemy introductions are never in a room's `LegalEncounters`, so
native `IsEncounterEligible` rejects them. For a published introduction the
executor then applies native's replacement gate exactly as `SetupEncounter`
does (`RunLogic.lua:1125-1148`): some enemy's `EnemyData.IntroEncounterName`
names it, it is not completed, and its `GameStateRequirements`, if any, pass
native `IsGameStateEligible`. The planner proves the trigger enemy admissible
at that room when authoring; like every other forced identity, the executor
does not re-prove it. Native check errors still decline ownership.
Rejection delegates selection to the game with a diagnostic and without
applying the rejected variant's customization. Existing conformance checks resulting
state, including NPC traits; this admission adds no mismatch boundary.

A native encounter whose name differs from its published phase, such as an enemy
introduction or native fallback after a rejected force, binds to that phase only
when the inherited native declarations share lifecycle policy in the same room and
phase role. The executor-owned comparator covers encounter depth, ordinary and boss
end/start effects, spawn-dependent uses, Fig Leaf and Gorgon policy, skip
propagation, classified start contacts and envelope termination, applying the
later-phase start and skip overrides of multiple-encounter assembly. Selection and
room-entry proof use the same comparator; a compatible substitution logs one
diagnostic naming both keys and never installs the published variant's
customization. An unclassified start path, setup callback, missing declaration or
policy difference keeps the existing encounter mismatch, naming the differing facts.
Unmodeled carriers remain exact; a different native choice for an already carried
phase is left unclaimed.

Generated composition is native or fully owned. The resolved export contains every
wave's enemy identities, source provenance and counts, including fixed/template
seeds, plus applicable Fangs and Menace outcomes, an optional variable base roll
and a required `expectedBudget`. That budget is the engine's exact final encounter
budget from the same preparation assessment that derived the counts; neither the
compiler nor the runtime recomputes it. The execution protocol requires it on
every generated customization. Plans published for another module build are
sent again from their authored projects; execution-only wire changes do not
require an authored-project migration.

An introduction's declared fixed first waves are published as `fixed` waves with
their exact counts, so every generated customization covers all its waves. Native
`GenerateEncounter` keeps declared `SpawnWaves` as pre-existing waves and never
fills them. Admission verifies each such wave by name and equal
`CountMin`/`CountMax`, treats it as installed, and admits and fills only the
generated suffix; any other pre-existing wave declines. A named generated seed
keeps its declared name and is never sampled. Native `SetupEncounter` replaces an
introduction containing its own unfinished enemy with a regenerated copy of
itself and does not rescan that replacement, so the first generation declines as
an introduction substitution and the replacement is admitted.

The exact phase scopes synchronous native preparation, with a stamped destination
handoff for reward-owned Devotion. Uncustomized encounters delegate unchanged. A
supplied base roll is validated against the effective native range, including hard
overrides, before native consumes it; an invalid roll declines customization.
Native then computes `DifficultyRating` with all its modifiers, Hordes and minimum.
At the generation-scoped `CalculateActiveEnemyCap` contact, after that rating and
before wave construction, the executor makes one whole-encounter admission decision:

- exported `expectedBudget` against native `DifficultyRating`, float-tolerant;
- the published wave count within the effective native wave bounds;
- role-correct composition eligibility on the effective prepared encounter, with
  preselection context and run/encounter blacklist effects in selection order;
  shared highlights, fixed seeds and sampled additions keep their native roles;
- the published Fangs perks against native ordered compatibility for their target;
- positive Menace conversions against native target mapping or replacement pool
  and its availability gates; zero conversions need no target;
- native introduction substitution, using its actual skip, completion and
  introduction-requirement conditions.

Acceptance configures the published wave count and suppresses native highlight
generation; native fill contacts then mount the roster and counts, and later
hooks apply Fangs and Menace from that same decision without per-wave re-checks.
Decline records the reason with expected and observed evidence, and native
generation continues uncustomized. A valid supplied base roll is retained on
decline: that is native continuation from a legal roll, not untouched RNG history.

Planner evaluation and decoding own the facts admission trusts: highlight
placement, Fangs roster membership and elite eligibility, source counts, rounding,
count limits and Menace count bounds. The game retains active-enemy caps, spawn
pacing, groups, retries and native perk application. There is no rollback,
second generator, Lua budget or count arithmetic, or mid-combat re-generation.
Scope is restored on return or error; unrelated work and introduction replacements
never inherit an override. Native errors propagate. A missing admission or fill
contact, or a native error after acceptance, is reported as a realization failure,
never as clean native fallback. These outcomes are diagnostic-only, not a new
transaction or mismatch boundary.

Commands fall into three execution dispositions:

| Disposition | Examples                                                                | Contract                                                                  |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Realize     | room/door generation, reward identity, selected trait offer, Chaos pair | Apply only through a verified fixed adapter                               |
| Observe     | entering a room, choosing an exit, or completing a required interaction | Compare only explicit structural facts and obligated transactions         |
| Verify      | Named changed traits, charges, clocks, and retained effects             | Compare only published room-exit conformance facts; never steer with them |

Some timeline steps combine these responsibilities. An acquisition adapter
claims a ready owner and inserts or steers its published outcome, but completing
that steering handle is not proof that the player chose or retained the
authored result. The plan remains conditional on player cooperation;
enforcement does not erase player agency.

Exact source correlation precedes readiness. A materialized native action must
bind to its published owner rather than to another transaction with a similar
god, reward, or item payload. If the player consumes that exact action before
its published prerequisites complete, the runtime records the generic
`transaction-prerequisite` mismatch and becomes passive while still invoking
the native action. This protects DAG order without turning transaction
completion into semantic result verification.

Native hooks and conformance checkpoints are deliberately different concepts.
Encounter start/end, cleanup, screen construction, and similar callbacks may
schedule a realization or identify the lifecycle window in which a semantic
transaction occurs. Their exact callback names, duplicate contacts, and
representation-only ordering are not independent conformance requirements.
The planner models encounter completion unlocking rewards; the executor relies
on native pickup availability rather than reproducing that gate. Acquisition
discovery does not require the authored encounter window to be active. Exact
source bindings and acquisition DAG prerequisites still apply, and nested
outcomes remain attached to their producer. A pickup can occur earlier or later
than its authored placement when those dependencies permit it. Automatic effects
remain bound to their exact, transient encounter callback contact. Resulting
acquisition state is checked at room exit, not by asserting that player input
happened inside the spawning callback.
Read-only encounter/composition admission probes may reject an override with a
diagnostic when eligibility cannot be established. This bounded fallback does not
swallow errors from actual native generation, spawning or effect application.
The supported native game functions used by those adapters are required host
infrastructure. A missing function or an error raised by it propagates as an
executor fault; it is not converted into ineligibility, a default value, or a
plan mismatch. Protected calls are used only as exception-safe cleanup around
temporary forcing scopes, and they restore that scope before immediately
rethrowing the original error.
When a standard checkpoint fails, or an exact-bound irreversible action begins
before its published prerequisites, the runtime records the mismatch and stops
planner realization. It must still invoke the native operation and must not
prevent player input, room creation, or traversal. An ordinary steering failure
remains diagnostic until one of those boundaries proves divergence.

Fields layout steering publishes planned versus observed entry points, cage
rewards/points, optional rewards/points and Nemesis placement as diagnostics.
Positional differences do not themselves invalidate the remaining simulation
and are not mismatches. Record original reward inputs and actual spawned
objects without reconstructing native substitutions such as Forfeit. Existing
room-exit conformance remains responsible for the modeled resulting state.

The conformance surface is bounded to:

| Checkpoint                    | Compared product                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Room entered                  | occurrence/room identity, published Overview content, and any obligation due at `roomEntered`                                                                      |
| Semantic Timeline transaction | the exact published transaction bound to the native action when it is an explicit obligation; acquisition handles instead express steering and local DAG readiness |
| Exits ready                   | complete exit count, physical types, target room identities, reward identities, and obligations due at outgoing generation                                         |
| Room exit                     | obligations due at `exitUsable` and `roomExit`, and only the planner-published named conformance facts that changed in this occurrence                             |
| Hub departure                 | the full modeled trait inventory published in `hub.departures` for that completed-visit count, on every departure                                                  |

The published `exitUsable` deadline is checked at actual room closure, before
the timeline is discarded. It does not require a separate door-use callback:
native `AttemptUseDoor` rejects locked attempts and reaches `LeaveRoom` for
departure. A failed obligation check stops realization, never native traversal.

The runtime may use several native calls to build one product. Conformance is
decided against the completed semantic product rather than by requiring each
construction callback to mirror an execution-plan row. This keeps lifecycle
wiring available for realization without turning native implementation detail
into a second game model.

Numeric state comparisons allow only absolute floating-point roundoff of
`1e-9`, shared by room-exit conformance, postboss admission, and starting Fear
checks. They do not round published values or native steering operands. Types,
keys, identities, booleans, and collection structure remain exact; non-finite
values fail. A one-unit counter difference or a meaningful fractional difference
still desynchronizes. Diagnostic logs retain double-precision numeric detail.

Well conformance compares aggregate remaining uses across independent Yarn,
Ixion, and Extended Shop trait instances, the single accumulated Hymn `Uses`
counter, and individual timed-effect durations. This applies at room exit and
Postboss admission: forced downstream offers and Chaos gates cannot independently
prove that a temporary effect was consumed. These are checkpoint balances, not
per-consumption provenance checks.

Rewards destroyed by Time Piece retain their generation and placement products,
but publish no acquisition transaction. This applies equally to incoming rewards,
Hub and side-room rewards, Fields cages, and Ship wheels. A wheel still publishes
its selection; an acquisition, when present, must match that selection and depend
on it. Keepsake charge conformance covers Time Piece without a destruction hook.

Selected acquisition transactions remain on the wire with their exact roles,
payloads, and meaningful local dependencies, but they are not checkpoint
obligations. Their completion means that the native action reached its declared
terminal and may release a local dependent; it does not attest that steering or
the resulting state matched. A missing or different player acquisition does
not become an adapter-local semantic comparison: durable modeled results are
checked only by the sparse named room-exit conformance facts selected by the
planner. Simulation-neutral health, Magick, Gold, Armor, healing, and
meta-progression results intentionally have no blocking completion proof.
Arachne's eight dresses and Icarus's Protective/Volatile Coating remain in
planner history but are excluded from trait presence and absence checks at
both room exit and postboss admission: native armor depletion can remove them,
and their survival is not a prerequisite for modeled outcomes. This is not a
blanket exclusion of armor-related boons, keepsakes, or other NPC traits.
The executor trusts planner eligibility and does not preflight exact trait rows
through `IsTraitEligible`, duo requirements, replacement constraints, or a
second offer-legality policy before forcing them.

The route-start keepsake is a pre-room realization, not a room Timeline step.
The wire carries its exact selected key and any already-authored immediate
equip result. A run that starts without a keepsake or aspect, as on a fresh
profile, omits `startingKeepsake.keepsakeKey` and `startingLoadout.aspectKey`
(never JSON null), and its Run State diagnostics omit the current keepsake. An
absent aspect requires no recorded aspect for the weapon, at run start and at
Postboss admission; admission still proves every published family. Inside `StartNewRun`, the Executor admits and freezes the plan
before native `CreateNewHero` construction, making the starting Hex available
to aspect construction. The nested `EquipKeepsake` contact arms its immediate
result and lets the matching native acquire callback consume it. Later rack
changes use the same callback adapter
from their ordinary Timeline trace. Only the opening presentation is delayed;
Jeweled Pom, Experimental Hammer, and Transcendent Embryo acquire their result
when the keepsake is equipped.

The opening is realized where native creates it. Normally that is
`ChooseStartingRoom`. A brand-new game instead runs
`StartNewGame → StartNewRun(nil, { RoomName })`, which calls `CreateRoom`
directly; when that call is nested in `StartNewRun` and names the expected
opening, the `CreateRoom` contact completes loadout verification and prepares
and realizes the opening the same way, so native does not roll an unplanned
reward. Loadout timing is unchanged.

## Supported fixed-route surface

The supported fixed-route surface covers ordinary rooms and rewards, supported
encounters and selected trait offers, fixed Preboss/Boss/Postboss continuation,
World Shops, Stygian Wells, Purging Pools, Keepsake Racks, fountains, resources,
and their supported acquisition dispositions. It also covers the following
special topology and interaction owners:

- Narcissus, Artemis, and supported Nemesis random-event resolutions;
- Anomaly replacement and its authored return;
- Zagreus Contract as a distinct additional exit;
- natural and Ixion-generated Chaos gates;
- H Fields cage placement and cage rewards;
- N Hub doors, rewards, side-room presence, and side-room rewards;
- O ShipCombat phase count, wheel cohorts, wheel rewards, and selected pickups;
- P's native ordered PreCombat/Combat envelope and Heracles suffix termination;
- Q's ordinary depth-eligible rooms, World Shop, fixed Boss link, and terminal
  topology;
- three authored distinct Chaos curse options, the selected curse/blessing
  pair, acquisition, and the selected Chaos map's declaration-sized visible
  return batch to G.

The N Hub overview publishes its required room-visit count and its one
required fountain use as `hub.fountain`: a `fountainUse` interaction owned by
the Hub fountain address, the number of completed room visits and Hub returns
preceding it, and any Aromatic Phial target. It is a Hub-owned interaction,
not a next-room Timeline transaction.

Each Hub interval, from Hub entry or a visit's return to the departure into the
next visit or the final handoff, is its own conformance window. Room-exit facts
cannot observe it because they compare one occurrence's own entry and exit.
`hub.departures` publishes one frame for each completed-visit count, from zero
through the required visit count, including the final handoff. Each frame has
`facts: [{ kind: 'traitInventory' }]` and the expected `traits.equipped` rows,
in the Run State frame's shape. The executor compares the full modeled inventory
on every Hub departure, independently of whether a fountain use or trait change
was planned in that interval. An early Phial upgrade therefore fails at the
immediate departure even if it matches the upgrade planned for later. Fountain
use and timing remain diagnostic: only a resulting inventory discrepancy fails
conformance.

For Chaos, the selected blessing is reserved for the selected curse before the
native screen is constructed. The other two blessings remain distinct
native-generated peers. Their omission from the engine document is deliberate:
they are neither acquired nor consumed by later planner semantics.

Ixion and natural generation are not different kinds of Chaos room. The origin
records only whether Ixion inserted the gate so removing that purchase can
remove its generated topology. A visible Chaos gate consumes one pending Ixion
regardless of how the gate originated.

A Chaos entry in `overview.additional` may publish `spawnPointIndex`, a positive
one-based index into numerically sorted native SecretPoint IDs. Omission leaves
random placement unchanged. The scoped SecretDoor spawn adapter substitutes
only its destination, preserving native gate creation, destination-room choice,
health cost and Ixion consumption. An unavailable point produces a diagnostic
and leaves the native destination unchanged, not a placement-only mismatch.

Complete Run State snapshots are diagnostic-only at the published room-entered
and before-room-exit checkpoints. They may expose counters, ranged reward-bag
counts, acquired traits, and retained effects for later adjudication, but a
difference in that diagnostic frame never blocks execution by itself. The
planner separately publishes the sparse named facts that changed during the
room. Only a mismatch in one of those named conformance facts, a required
Timeline obligation, or another explicit structural/transaction comparison
stops further planner enforcement. The native contact still completes and the
Executor never chooses a substitute room, reward, or action.

Eris is the same kind of boundary. Her talk is a guide row, not a transaction,
and the planner's observation that she spawned is not on the wire; the executor
never steers her spawn. Her gift is an ordinary direct pickup. Her curse is
proved at the intro room's exit in both directions, before any later bag that
her gift's Ashes would change is trusted. Where she is planned, the curse is in
the room's `traitInventory` frames, so its absence is a mismatch. At a route
Eris host whose curse is not held at exit, the `traitInventory` fact carries
`absentTraitKeys: ["ErisCurseTrait"]`, added to the fact when the room has no
other trait change; the executor proves those keys absent like the frames'
removed traits, so an unplanned curse is a mismatch. A route already cursed at
that room asserts nothing, and mature routes, which host no Eris, publish no
`absentTraitKeys`.

A Pool of Purging sale illustrates the boundary. The authored sale does not
become an execution Timeline transaction: Overview constrains the visible Pool
inventory and the room-exit `traitInventory` fact proves the expected trait
removal. The Executor neither reimplements the sale nor requires its individual
button callback to complete an action handle.

Shop, Well, and Shrine inventory is likewise Overview content. Ordinary
payment, affordability, and purchase-counter behavior remain native and do not
publish execution transactions. A purchased row instead publishes its acquired
result, which the ordinary source-independent acquisition, transformation, or
item-effect adapter settles. Travel Deal is the sole dynamic inventory
exception: the wire names its exact refill realization and payload. World
Shop's dedicated refill callback can report an unexpected refill
diagnostically; Well and Shrine use generic native contacts and pass through
when no refill was published.

World Shop Overview rows are the emitted items in native order: a row's index
is its compact `StoreOptions` position and its `profileSlotIndex` names the
declared slot it realizes. A validly empty slot publishes no row, so later
items shift left; the Executor maps rows onto native `GroupsOf` slots by that
index, omits a group with no rows, and never regenerates inventory itself. The
Travel Deal replacement's `slotIndex` is the same compact position.

## Mismatch classification

Runtime contacts have five distinct outcomes. Adapters must not promote a
weaker outcome into a mismatch merely because they can observe it.

| Outcome             | Meaning                                                                                             | Runtime disposition                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Admission rejection | A selected slot is absent, malformed, incompatible, or not a complete execution plan.               | Do not create a synchronized session; report the admission error.                                            |
| Executor fault      | A required host function is missing or throws, or a decoded-plan/session invariant fails.           | Restore temporary forcing scope, report or propagate the fault, and do not describe it as player divergence. |
| Incidental contact  | Native code reaches a supported hook but no compatible published owner claims it.                   | Pass through unchanged without completing a transaction or desynchronizing.                                  |
| Diagnostic          | A bounded actuator could not install or apply its intended steering.                                | Record bounded evidence, log it once, and continue native behavior without changing synchronization.         |
| Execution mismatch  | A standard checkpoint or premature exact-owner action proves the remaining simulated prefix unsafe. | Preserve the first mismatch, stop later realization, and let the native game continue.                       |

Each admitted session logs its slot, plan identity, the first 12 characters of
the module build, catalog and module version once. The first execution mismatch reports the plan/catalog fingerprints, semantic
owner, checkpoint, expected value, observed value, and bounded event context.
The executor then becomes passive: the game continues natively, and no hooked
game function returns early merely because the execution session
desynchronized.

- A `playerDivergence` means the player performed a different observable action
  from the published trace.
- A `conformanceDiscrepancy` means the player followed the trace but the live
  game did not match a realized or verified fact.

A non-player discrepancy is evidence that the planner under-models the game or
that a native adapter is wrong. It must be adjudicated against game data and
corrected at the planner-engine or adapter authority. A compiler correction is
appropriate only when its lossless translation omitted or misencoded an
already-explicit engine fact. The Executor must not hide a discrepancy with
fallback planning.

Representative boundaries keep this policy concrete:

- A trait, Pom, or automatic-effect adapter completes when its native steering
  terminal returns. A local steering failure is diagnostic; the published
  room-exit trait, Arcana, keepsake, or retained-effect fact proves the durable
  outcome.
- Travel Deal binds one exact dynamic refill carrier, generation, and slot. An
  unrelated refill passes through. A refill at the wrong published slot is
  diagnostic and does not complete the declared refill; the outstanding
  obligation fails at its ordinary deadline if the exact terminal never
  occurs.
- Artificer completes only after the expected replacement is observed and the
  source is destroyed. A presentation callback or wrong replacement is useful
  diagnostic evidence, but it is not the declared terminal.
- A native encounter, pickup, purchase, or transformation with no compatible
  owner is incidental. Its existence is not itself a reason to stop a run.

Faults remain a separate infrastructure boundary. Unknown Timeline handles,
conflicting native bindings, missing decoded owners, unsupported lifecycle
checkpoints, closed-session use, malformed post-admission payloads, and missing
or throwing required native functions are executor defects. Exception guards
may restore temporary forcing state before rethrowing; they are never fallback
gameplay behavior.

## Compatibility, transport, and security

The transport is canonical data-only JSON with a strict decoder, exact module
build and catalog compatibility, bounded collections, closed unions, and no silent
coercion. It permits no dynamic evaluation, executable expressions, arbitrary
paths or commands, or class reconstruction from untrusted names. Compression
or an outer checksum is unnecessary unless later transport evidence justifies
it. Run State diagnostics remain complete in the planner's semantic plan; on
the wire, frame zero replaces every closed top-level diagnostic section and
later sequential frames replace only changed sections. `artificer: null` is an
explicit replacement that clears prior state.

Publication is target-scoped transport, not authored or execution semantics.
The desktop adapter revalidates the established target at write time, maps a
caller-supplied slot number in the closed range 1 through 6 to its fixed
filename, confines the destination below that target's Run Planner game module
configuration tree, rejects links and non-regular files, enforces the existing
1 MiB bound, and atomically replaces only the selected slot. The Run Planner game module
reads the active slot from `active-slot.json` (see
[Shared configuration folder](#shared-configuration-folder)), displays the
selected slot's bounded status, and loads and freezes that one slot only at the
next new-run or eligible Postboss admission. Changing the active slot cannot
hot-swap a live session. The read-only inspector separates the selected slot's plan preview
from the frozen session's loadout, room progress, admission, and failure
information. It reports existing execution status without adding conformance
checks or revalidating player state during rendering.

Runtime execution state is process-local, never native-save-backed, and resets
explicitly at new-run admission. Postboss recovery is a fresh admission, not
restoration of serialized executor state. It is attempted once when a new game
process attaches to an existing run at a selected occurrence marked
`resumeBoundary: "postbossEntry"`. The executor
adopts the already-restored native room, compares the existing bounded
conformance families plus weapon/aspect identity, and constructs fresh route
and room coordinators at that occurrence. A mismatch makes execution passive;
the executor does not search another slot, retry at later rooms, replay loadout
effects, or reconstruct earlier Timeline progress.

The Run Planner game module reads its own `buildId` from its installed
`execution-compatibility.json` at load. Before decoding, the inbox requires
the exact slot envelope naming that build: another build or a bare plan is
`stale-slot` (send the plan again), and a module without a readable build
identity is `module-build-unknown` (install it from the Game panel). The
decoder then verifies the plan's `format` and `catalogVersion` before a
session opens. Runtime identifier existence and checkpoint contact are conformance
checks, not permission to reproduce planner eligibility policy. Exact source
binding and published prerequisite readiness are execution coordination, not
eligibility inference.

## Dream navigation

Dream execution publishes the ordered configured prefix, not an independently
editable runtime itinerary. Startup and Postboss recovery require the native
run mode to match the plan. The native `Dream_Intro` prologue is outside the
occurrence cursor; the first biome receives the published starting reward and
later entries use their resolved rewardless declarations.

The existing cursor supplies the next biome during native selection, including
selection before Postboss departure. Scoped pool removal preserves native
bookkeeping; `ChooseStartingRoom` prepares the published entry without replacing
the active predecessor session. After the configured prefix, selection becomes
native. Dream Points, difficulty, transitions and final completion remain game
owned. The [hook map](../audits/game-execution-contacts/FEATURE_HOOK_MAP.md#dream-route-navigation)
owns the exact contacts and scope lifetimes.

## Deferred scope

Wrong continuation is detected by the next room-entry identity check; the
executor deliberately has no separate selected-transition conformance
checkpoint.

Automatic diagnostic import remains deferred. Automated protocol and hook
coverage does not substitute for live-game verification of a complete Dream run.
