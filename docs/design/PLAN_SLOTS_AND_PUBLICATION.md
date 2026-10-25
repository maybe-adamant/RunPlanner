# Plan Slots and Publication

The desktop publisher writes an execution-only plan to one of twelve fixed plan
slots in the established [game target](GAME_MODULE_DISTRIBUTION.md#game-target);
the browser build has no publication capability. Sending a plan also makes its
slot active. The module reads the active slot at the next run admission, loads
only that slot and freezes the decoded plan for the live session, so
publishing another slot, or changing the active one, never disturbs a frozen
session. There is no compatibility alias or implicit migration: an empty or
invalid selected slot is a bounded admission error.

This document owns the shared configuration folder, the slot files and their
publication transaction, slot sources and rebuild, the community event slot
and the two signed feeds. The Game tab and send control that present these
belong to the [editor](EDITOR_MODEL.md#game-screen-and-the-editors-send-control).

## Shared configuration folder

Anything both the planner and the game module need lives in
`config/adamantRunPlanner-Run_Planner/`, in a format they own together:

- the twelve plan slots `slot-1.runplanner.json` through
  `slot-12.runplanner.json` and the event slot `slot-0.runplanner.json`, which
  only the planner writes, each the plan bytes as compiled, within 1 MiB;
- beside each sendable slot, its planner-owned source
  `slot-N.source.runplanner.json` (see
  [Slot sources and rebuild](#slot-sources-and-rebuild)), which the module never
  reads; the event slot has none;
- `active-slot.json`, the plan slot the module plays next, which both write;
- `slots.runplanner.json`, the [slot overview](#slot-overview), which only the
  planner writes.

Settings that only the game uses, such as the room guide, highlights and
`Enabled`, stay in ModpackLib storage. The planner never reads or writes the
ModpackLib `.cfg`.

### Active slot

`active-slot.json` is the only record of the active slot:

```json
{ "format": "run-planner-active-slot", "formatVersion": 1, "slot": 3 }
```

- Both sides decode strictly: exactly these three keys, `slot` an integer from
  0 (the event slot) through 12 written without a leading zero, and at most
  1 KiB. The module writes the compact form
  `{"format":"run-planner-active-slot","formatVersion":1,"slot":3}`.
- The planner writes it atomically, as it writes plan slots. The module writes
  a temporary file beside it, removes the old file, then renames (retrying the
  rename once), because `os.rename` cannot replace a file on Windows. A reader
  can briefly find the file missing, never partial.
- A missing or invalid file means slot 1 to the module, which rewrites the file
  only when the player picks a slot. The planner shows such a file as slot 1
  too, without writing it. The module logs one `[RunPlanner] active-slot` line
  per slot it writes and one per change of invalid content it reads. Because a
  missing file already shows slot 1, the in-game picker saves slot 1 only after
  another slot was picked.
- Last writer wins. Neither side keeps a copy: the module reads the file at
  new-run admission, and the planner reads it with the slot facts. A change
  made during a run takes effect at the next admission.
- The planner makes a slot active only when it holds a plan the installed
  module admits, by sending to it or by choosing it; choosing needs only an
  established target whose slots can be read, so it works while the module or
  ModpackLib needs an update. The in-game picker offers all twelve, and the
  event slot first while it holds a file or is the active slot. Writing the
  event slot never changes the active slot; clearing it, or a plan slot, while
  it is active makes slot 1 active (see [Clear and Undo](#clear-and-undo)).

### Slot overview

`slots.runplanner.json` names each occupied slot for display, so the module
need not decode every plan to describe them:

```json
{
  "format": "run-planner-slot-overview",
  "formatVersion": 2,
  "slots": {
    "3": {
      "label": "Circe - Surface",
      "planName": "Surface Phial run",
      "sentAt": "2026-10-12T10:00:00.000Z",
      "aspect": "Circe (Staff)",
      "route": "Surface",
      "endBiome": "Olympus",
      "startingKeepsake": "Silver Wheel",
      "startingFear": 8,
      "practiceStart": "Thessaly · Boss",
      "catalogVersion": "…",
      "schemaVersion": "<current>",
      "schemaRevision": "<current>",
      "fingerprint": "…"
    },
    "0": {
      "label": "Circe - Surface",
      "…": "the same summary fields",
      "event": {
        "id": "2026-w42-staff",
        "title": "Week 42: Staff sprint",
        "endsAt": "2026-10-19T00:00:00Z"
      },
      "catalogVersion": "…",
      "schemaVersion": "<current>",
      "schemaRevision": "<current>",
      "fingerprint": "…"
    }
  }
}
```

- The application computes the display summary when it sends, from the
  compiled plan and catalog labels: `label` is the aspect's name without
  "Aspect of" and the route ("Circe - Surface"), naming the weapon too when
  several catalog aspects share that name ("Melinoë (Axe) - Surface"), or only
  the weapon's short label when the plan has no aspect; `aspect` adds the
  weapon's short label, `endBiome` names the extent's terminal biome,
  `startingFear` is the configured Fear total the Oath shows, and
  `practiceStart` names a Practice mode start's biome and point. `planName`,
  `startingKeepsake` and `practiceStart` are omitted when the plan has none.
  The summary goes to the host with the send.
- The host adds the plan's `catalogVersion`, schema pair (integers) and
  `planFingerprint` as `fingerprint`, as read back from the staged slot file,
  and regenerates the whole file with every send (see
  [Publication](#publication)). The overview is the only store of summaries: a
  slot keeps its entry only while its file still holds that catalog, pair and
  fingerprint, so a slot emptied, made unreadable or replaced outside the
  planner loses its entry at the next send, and a slot without a known summary
  has no entry. A missing or invalid previous overview, or one of another
  format version, holds no entries.
- Entries are advisory, for listing and describing slots: a missing entry is
  unknown, and the module checks the plan header and `fingerprint` only on the
  one slot it loads. An overview that would exceed 64 KiB fails the send.
- The module reads the overview beside `active-slot.json`, at most once a
  second while its window is drawn and once when the victory screen opens. A
  missing or invalid file holds no entries; an invalid entry is skipped on its
  own.
- Only the event slot's entry carries `event`: the event's `id`, `title` (at
  most 80 characters) and UTC ISO 8601 `endsAt`. Regeneration keeps it only on
  slot 0 and only while it still validates, and the module reads it only from
  key `"0"`. It is kept and dropped like any other entry; because the module
  always checks that `slot-0.runplanner.json` exists, an entry left behind by a
  slot 0 file removed outside the planner names no event, and the next clear
  removes it.
- The in-game picker labels a slot from its entry. Without an entry, a slot
  whose file exists is labelled "Slot N" and any other slot is labelled empty.
  The event slot is labelled `Event: <title> (<label>)` from an entry with its
  event, "Event" when its file exists without one, and "Event (none)" when it
  is active without a file; its details add the event title and its end in
  local time. Existence is checked by opening the file, never by reading it.
- The shown slot is loaded once, and again whenever its entry's fingerprint, or
  the existence of its file, changes. Its details come from its entry; when the
  loaded plan's fingerprint differs from the entry, they come from the loaded
  plan instead. A slot that is not loaded is marked outdated when its entry
  names another catalog or schema pair than the module admits.

## Publication

Publication is target-scoped transport, not authored or execution semantics.
Sending uses only the established target and performs no discovery. The host
rechecks the target when publishing and refuses with the blocking reasons,
including found and required versions, unless the installed module admits the
plan header of this planner's module and ModpackLib is compatible. Before any
write, the installed `execution-compatibility.json` must equal the outgoing
plan header's `format`, `catalogVersion` and schema pair; otherwise the send
asks to update the module.

The host maps a caller-supplied slot number in the closed range 1 through 12
to its fixed filename (the event slot is written only by the
[event operations](#event-slot)), confines the destination below the target's
module configuration folder, rejects links and non-regular files and enforces
the 1 MiB bound. The slot is written with the plan bytes unchanged. `mods.yml`
is never edited, and under `config/` the planner writes only the shared folder.

The slot, its source and the overview change together: the host stages the
complete files beside their destinations, with copies of the slot's and the
source's previous files, then replaces the slot, then the source, then the
overview. If a later file cannot be replaced, the earlier ones are restored
from their copies (or removed when they had no file) and the send fails; no
staged file remains either way. Clearing a slot follows the same order with a
removal in place of the slot write. Only then does the host write
`active-slot.json`; if only the activation fails, the send still succeeds, the
plan stays, and the result carries the activation problem, which the planner
shows as a notice rather than a failed send.

A sent plan's identity chain is the document's `projectId`, then the compiled
`planFingerprint`. Its name is the project's authored
[`name`](AUTHORED_PROJECT_MODEL.md#persistence-and-validation), not the file's.
Sending compiles the open plan as it stands; it does not save first, since
every edit is already being saved. The plan carries the name as the optional,
presentation-only `displayName`, which is outside `planFingerprint`; the game
module accepts it and only logs it. A duplicate gives the copy a new
`projectId`, so earlier sends no longer match it.

### Reading slots

The host reads each slot under the same link and containment rules and the
1 MiB bound, and reports it as empty, present, stale or unreadable with its
modified time and only existing wire fields: `projectId`, `displayName`,
`routeKey`, `extent.biomeKeys`, `startingLoadout.weaponKey` and
`startingLoadout.aspectKey`, and `planFingerprint`. A slot whose plan names
another catalog or schema pair than the installed module admits is stale:
outdated for the module, it cannot be played next. The host also reports
whether each slot has a source.

### Clear and Undo

Clearing removes a filled plan slot (1 to 12) with its source and overview
entry on any established target whose slots can be read; the event slot is
never cleared this way. The host returns what it removed, as stored: the plan
text, its source, its summary while the overview still described it, and
whether the slot was active. A cleared active slot hands over to slot 1, as a
missing file would, unless the player picked another slot meanwhile or the
cleared slot was slot 1. Undo has the host write the removed files back while
the slot is still empty, and makes the slot active again while slot 1, which
took over, still is. A slot file that is not bounded text clears without an
Undo.

## Slot sources and rebuild

Sending also stores the plan's source beside its slot,
`slot-N.source.runplanner.json`:

```json
{
  "format": "run-planner-slot-source",
  "formatVersion": 1,
  "internalRunModifiers": false,
  "project": <the saved project document>
}
```

`internalRunModifiers` records whether internal-stage run modifiers took part
in the compile. An older source may also carry `displayName`, which the
loader uses to name an unnamed project. The host writes the source in the
send's transaction, refuses one that is not of this format or exceeds 8 MiB,
reads it back under the same link and bound rules, and reports whether each
slot has one. A send never leaves another plan's source beside a slot.

A slot is outdated when its plan names another catalog or schema pair than the
installed module admits. After the planner installs or updates the module, and
when the user asks for it, the application rebuilds every outdated slot that
has a source, provided nothing blocks sending:

- It loads the source's project through the project loader, which migrates an
  older major, and compiles it exactly as a public project sent would be, with
  internal run modifiers only when they were stored and this is a development
  build.
- A plan that compiles is written again with its source, now holding the
  document as loaded, and a summary whose sent time is the rebuild time. The
  slot number is kept, and the active slot is never changed. The host writes a
  rebuild only while the slot is still outdated, so a plan sent meanwhile
  stands, and the application runs one rebuild at a time.
- A source that cannot be read, or a rebuilt plan that cannot be written,
  stays outdated with that reason.
- A project saved under another schema pair that no longer builds stays
  outdated and asks to be opened and sent again.
- A project saved under this planner's schema pair that no longer builds breaks
  the [same-version invariant](AUTHORED_PROJECT_MODEL.md#schema-change-approval):
  it stays outdated, asks for a bug report, and the next bug report carries
  the compiler's error.
- A slot without a source stays outdated until it is sent again.

Rebuild results last for the session.

## Event slot

Slot 0 holds the community event plan. It is the same envelope, read and loaded
by the module like any other slot, but it is read-only to the user: sending can
never target it (the host refuses any send outside 1 through 12). It can be
made active through the same host write as any other slot.

The application keeps slot 0 in step with the [event feed](#event-feed)
without any user action: at start-up and whenever the Game tab opens it writes
the active event, or clears slot 0 when there is none. Only two host
operations change it, each through the same staged slot-and-overview
transaction as a send:

- **Write** takes an event id, a plan and its display summary. The host writes
  slot 0 only for the event that is active now and only when this session
  verified that event's project, with its own `event` metadata (id, title and
  end); the application cannot supply event metadata. The plan is trusted as a
  send's is: the host checks its header and that its `projectId` equals the
  verified project's, a consistency check against a plan compiled from
  something else, not an authentication, and the module decodes the whole plan.
  It has the same target and compatibility checks as a send, and leaves a slot
  already holding that plan and event as it is. It never touches
  `active-slot.json`.
- **Clear** removes slot 0 and its entry together (an entry left without its
  file included) and needs only an established target. While an event is
  active whose plan the application did not write, the host keeps slot 0 only
  when its overview entry names that event, so an earlier event's plan never
  outlasts its event. Without verified event data (no feed fetched or cached
  this session), the host clears slot 0 only when its own overview entry names
  an event that has ended, and otherwise keeps it. When `active-slot.json`
  names slot 0, the host then makes slot 1 active, since the slot played before
  the event may no longer hold its plan. It reads the file again just before
  that write and writes only while it still names slot 0, so a slot picked
  meanwhile stands; the result reports a move only when slot 1 was written.
  When slot 1 is empty, the next run has no plan until a slot is chosen and
  plays unplanned.

The host validates the event metadata before any write: an `id` of lower-case
letters, digits and inner hyphens within 64 characters, a non-blank single-line
`title` within 80 characters and an `endsAt` of the form
`YYYY-MM-DDTHH:MM:SS[.fraction]Z`.

Development builds (and release builds made with `VITE_INTERNAL_FEATURES=1`)
can import an authored event folder, `event.json` with
`project.runplanner.json` as the events repository holds them, into the host in
place of the feed's event for the session, and clear it again. The host
validates the metadata as a feed event's (the id must equal the folder name),
takes the project URL beside the feed, the project's SHA-256 and its schema
pair, and holds the project as verified. The same schema gate, compilation and
write then apply, without a signature. Clearing returns to the feed's event.
The host registers the local-folder commands only in those builds
(`debug_assertions`, or the `internal_features` cfg its build script sets from
`VITE_INTERNAL_FEATURES=1`).

The module names a running plan by its event when its `planFingerprint` equals
the event slot entry's `fingerprint`, wherever it was loaded from: Current Run
reads "Event: <title>", and the victory summary's first row reads
`Planned event - <title>` instead of `Planned run - <plan name>`, provided the
event slot's file still exists. This is display only; the status row is
unchanged.

## Signed feeds

### Event feed

Events are authored and published in the separate
[RunPlanner-Events](https://github.com/maybe-adamant/RunPlanner-Events)
repository; the planner only reads its feed. The repository name is one
constant on each side, the game host and the application. The feed is
`events.json` with its signature `events.json.sig`, both on that repository's
`events` release
(`https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/`):

```json
{ "format": "run-planner-event-feed", "formatVersion": 2, "events": [<event>] }
```

Each event is `id`, `title`, `description`, optional `rules`, `startsAt`,
`endsAt`, `projectUrl`, `projectSha256` (lower-case hex),
`projectSchemaVersion` and optional `projectSchemaRevision` (absent means 0),
the authored schema pair of the project file. The feed carries no compiled
plans: the planner compiles each event itself, so an event plays on every
module that admits that planner's plans. The signature is `tauri signer sign`
output, a prehashed minisign signature, made with a dedicated event key, not
the updater key. The app embeds the event public key from
`apps/planner/src-tauri/event-feed.pub` at compile time; while that file holds
its checked-in placeholder, the host refuses to verify any feed and events stay
off. The trusted comment, which the signature covers, must name
`file:events.json`, and its `timestamp` orders feeds.

- The host downloads the feed (at most 16 MiB) and signature (at most 4 KiB)
  over HTTPS only, verifies the signature before decoding, and decodes
  strictly. A malformed feed, one of another format version, one listing more
  than 32 events, a bad signature, or a feed signed earlier than the newest
  feed already verified (in this session or in the cache) is refused whole.
  Within it, an invalid event, one whose `projectUrl` is not exactly
  `https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/<id>.runplanner.json`,
  or a repeated id is refused alone and logged.
- Text fields are bounded, with no control or Unicode format characters, and
  times are UTC instants; an event must end after it starts.
- The active event is the one whose window (`startsAt` inclusive, `endsAt`
  exclusive) contains now; of several, the latest start wins, then the greater
  id. There is at most one.
- Start-up reads the feed at most once every ten minutes; opening the Game tab
  also retries at once after a failed fetch. The last verified feed and its
  signature are kept together in one file in the application data folder
  (`event-feed/events.cache`) and verified again when read. A failed fetch
  keeps the feed already held or falls back to that copy, so a verified event
  stays offline until it ends; with neither, slot 0 is kept until its own event
  ends. While the app runs, it syncs once more just after the active event's
  end, so an ended event slot is cleared without a restart.
- The application passes the project schemas its loader opens: the majors from
  the loader floor to the current one, and the current major's revision. An
  active event whose major lies outside them, or whose revision of the current
  major is newer, is not downloaded and asks for a planner update. Otherwise
  the host downloads the project file (at most 8 MiB, HTTPS only) from its
  verified `projectUrl`, refuses it unless its SHA-256 matches
  `projectSha256`, and holds the verified text for the session.
- The application compiles the verified project headlessly, as a public
  project opened and sent would be (loaded, admitted, simulated and compiled),
  with the event title as the plan's name, and remembers the plan by event id,
  title, project hash and catalog version. It computes the display summary from
  that plan and asks the host to write it. When the plan cannot be written (an
  unloadable schema, a project that does not compile, or one that could not be
  downloaded), the application clears slot 0, which the host keeps only while
  it holds this event's plan; a cleared active slot hands over to slot 1. The
  application says why the event cannot be played, except while slot 0 still
  holds this event's plan and only the download failed; a later sync retries
  the download.
- Opening an event's project adds its verified project file, downloaded as
  above when the session does not hold it (the session holds only the active
  event's), to the library as a copy with its own `projectId`, so a copy sent
  to a slot is not the event's plan, and opens it.

Publishing is the events repository's workflow. It builds the feed with the
planner's builder (`npm run events:build`), which compiles every event's
project as the planner does, only to refuse one that would not play, checks the
result with the host decoder (`events_ci check`), publishes only a changed
feed, and verifies its signature with the event key before uploading. The
builder writes `projectSchemaRevision` only when it is not 0, because older
planners refuse an event naming an unknown field. The `events`
release is a pre-release. An event starts and ends by its own dates, since the
app selects the active event by time.

### Plan catalog feed

Template plans are authored and published in the separate
[RunPlanner-Catalog](https://github.com/maybe-adamant/RunPlanner-Catalog)
repository; the planner only reads its index. The repository name is one
constant on each side, the game host and the catalog builder. The index is
`catalog.json` with its signature `catalog.json.sig` on that repository's
`catalog` release, each entry's plan published beside it as
`<id>.runplanner.json`:

```json
{
  "format": "run-planner-catalog-feed",
  "formatVersion": 1,
  "categories": [{ "id": "speedrun", "label": "Speedrun" }],
  "entries": [<entry>]
}
```

Each entry is `id` (the entry folder's slug), `title`, `description`,
`category`, `tags`, `author`, `routeKey`, `biomeCount`, `planSchemaVersion`,
optional `planSchemaRevision` (absent means 0), `planUrl` and `planSha256`.
The builder (`npm run catalog:build`) refuses an `entry.json` that is not
exactly `title` (one line, at most 80 characters), `description` (one line, at
most 200), `category` (an id from `categories.json`), `tags` (at most 8
distinct slugs of at most 24 characters, never the category's id or its label
spelled as a tag) and `author` (one line, at most 64), a plan over 1 MiB, and a
plan the planner cannot load and compile to a sendable plan; route, biome count
and schema come from the loaded plan. Folders starting with `_` are templates.
The categories, their labels and order are the catalog repository's
`categories.json`, copied into the index; the planner has none of its own. The
index carries plans as saved, so a planner release needs no republish. The
signature and the replay rule are the event feed's, with a dedicated catalog
key whose public half the app embeds from
`apps/planner/src-tauri/catalog-feed.pub` (the catalog is off while it holds
its placeholder), and the trusted comment must name `file:catalog.json`.

- Both feeds share one host implementation of signature and file-name
  verification, the placeholder key, the replay floor, the cached copy
  (`catalog-feed/catalog.cache` in application data for the catalog, verified
  again when read) and the session's fetch state; downloads are HTTPS only.
- The index is fetched at start-up and when the Catalog is shown (a failed
  fetch is retried at once there), at most once every ten minutes otherwise,
  at most 16 MiB. Offline the cached index stands; with neither, the Catalog
  cannot load.
- Decoding is strict: a malformed index, category list (1 to 16 distinct slugs
  with one-line labels) or one listing more than 2000 entries is refused whole;
  an entry breaking the builder's rules, one whose `planUrl` is not exactly its
  own file beside the index, or a repeated id is refused alone and logged.
- Adding an entry to the library asks the host for the entry's plan (at most
  1 MiB, HTTPS only), which it downloads from the verified URL and refuses
  unless its SHA-256 matches `planSha256`. The application refuses an entry
  saved in a schema its loader does not open without downloading it.

The catalog repository's workflows check every entry with the latest planner
release's builder and the `catalog_ci` example (`check` decodes the index as
the app does; `verify` checks a signature), and publish a changed index signed
with the catalog key.
