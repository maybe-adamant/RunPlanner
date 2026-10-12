# Community Events Plan

Status: locked. Base commit: `7b5dbb9ef`.

## Objective

Deliver a weekly community event plan to every player without an app update.
The app fetches a small signed event feed, writes the event plan into a
reserved, read-only slot 0 and announces the event in the notice banner. The
game module offers slot 0 like any other slot and names the event on the
victory screen.

## Constraints

- App and module stay coupled: both ship in every release and the app only
  sends plans stamped with its bundled module's build id.
- The build id covers module execution code only (`mods/presentation/` is
  excluded), so it stays stable while only events change.
- The updater's `latest.json` is not touched; events have their own feed.

## Decision

### Authoring

- `events/<event-id>/project.runplanner.json`: an ordinary planner project.
- `events/<event-id>/event.json`: `id`, `title`, `description`, optional
  `rules`, `startsAt`, `endsAt` (ISO).
- Events are added by pull request. CI refuses an event whose project is not
  complete and valid under the release engine.

### Feed

- Stable location: the `events` GitHub release (assets replaced in place):
  `events.json`, `events.json.sig` and one `<event-id>.runplanner.json` project
  file per listed event.
- `events.json` (versioned format) lists events with metadata, the project
  download URL and compiled plans keyed by build id:
  `plans: { "<buildId>": <execution plan> }`.
- Signed with the existing updater minisign key; the app verifies it with the
  embedded updater public key.
- Expired events (past `endsAt`) are dropped from the feed.

### Publishing (CI)

- `publish-events.yml` (manual and on push to `main` touching `events/`):
  validates and compiles every active event for the current release's build id
  with the current release engine, keeps plans already published for older
  build ids, signs and uploads the feed and project files.
- `release.yml` gains a step that recompiles active events for the new build id
  when a release changes it, so updated players keep the event and players who
  have not updated keep their older entry.

### App

- Fetch on start-up and when the Game panel opens (short cache); bounded size,
  signature check, strict decode. Offline keeps the last fetched event.
- The active event is the one whose window contains now and that carries a
  plan for the bundled module build; with several, the latest start wins. One
  event at a time.
- Slot 0 is written through the existing staged slot-and-overview transaction.
  The overview entry gains `event: { id, title, endsAt }`. Slot 0 is read-only
  in the Game panel (no Send here). When no event is active, slot 0 and its
  entry are cleared.
- Notice banner (`ReleaseUpdates.tsx`) becomes a notice area with two kinds:
  app update (unchanged, takes priority) and event:
  `Event: <title> · ends <date>` with Details (description and rules), Open
  project (downloads the project and opens it as a new unsaved copy), Copy link
  and Dismiss (per event id).

### Game module

- Slot 0 (`slot-0.runplanner.json`) is accepted by the inbox and the active
  slot; the dropdown lists it first as `Event: <title> (<label>)`.
- Plan tab details show the event title and end time from the overview.
- Victory row: when the running plan's fingerprint equals the overview's event
  entry fingerprint, the row reads `Planned event - <event title>`; otherwise
  `Planned run - <plan name>`. The status line (Complete / Out of sync) is
  unchanged. This is display only, not anti-cheat.

## Ownership

- Rust host: feed fetch, signature verification, slot 0 write, overview event
  fields.
- Planner app: notice area, Game panel slot 0 row, Open project.
- Game module: slot 0 acceptance (execution), dropdown/details/victory text
  (presentation).
- CI: publish workflow and the release step; compile through the engine's
  existing execution-plan assembly (no new compiler).

## Gates

1. Slot 0 end to end without network: module slot 0, overview event fields,
   Game panel read-only row, victory naming, and a developer "Import event
   feed file" action for testing.
2. Signed feed: format, verification, app fetch, notice area with Open project.
3. CI publishing: `publish-events.yml`, the release-time recompile and the first
   sample event; docs and live checklist.

## Tests

- Rust: feed decode limits, signature accept/reject, active-event selection,
  slot 0 transaction, clearing on expiry.
- App: notice priority and actions, Game panel slot 0 row, Open project as
  copy.
- Module: slot 0 decode and selection, dropdown and details text, victory
  naming by fingerprint.
- CI: workflow structure tests in the existing release-workflow test style.

## Non-goals

- Multiple simultaneous events, anti-cheat verification, Thunderstore or web
  delivery of events, and any change to app/module coupling.
