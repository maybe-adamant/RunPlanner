# Event Local Compile Plan

Status: locked. Base commit: `8fc819432`.

## Objective

A community event stays playable across module builds. The signed feed carries
each event's authored project reference instead of compiled plans. The planner
downloads and verifies the project, then compiles it with its own engine for the
module build it installs, and writes slot 0.

This is a clean break: older planners do not read the new feed.

## Current state

- Feed `run-planner-event-feed` v1. Each event document has `plans`, keyed by
  module build id, holding compiled plans.
  - The host picks `plans[build_id]` (`community_event.rs:329-331`) and skips the
    event silently without one (`event_feed.rs:176`).
- The publish workflow does the following:
  - reads the latest release's `module-build.json`;
  - compiles each event for that build;
  - merges older builds' plans from the published feed;
  - signs and uploads.
  - Any build-id change invalidates the event until republished.
- `game_event_publish` writes only host-held plan bytes, chosen by event id and
  fingerprint.

## Design

### Feed v2

- The feed is `run-planner-event-feed` `formatVersion: 2`.
- Each event entry has:
  - `id`, `title`, `description`, `rules?`;
  - `startsAt`, `endsAt`;
  - `projectUrl`, `projectSha256`;
  - `projectSchemaVersion`.
- No `plans`. The signature, trusted comment, prehashing, replay protection,
  limits and exact `projectUrl` rule are unchanged.
- On v0.19.x the version bump fails the feed decode before caching. Those apps
  keep their cached v1 event until its `endsAt`, then clear slot 0 with the
  ended notice. They never see v2 events.

### Planner

- **Host.** `event_feed_refresh` decodes v2 and selects the active event as
  today. For the active event, the host:
  - downloads the project (`event_project_download` path, 8 MiB cap);
  - verifies `projectSha256`;
  - holds the verified project text with the session.
- **Schema gate.** An event whose `projectSchemaVersion` is newer than the
  planner's current schema, or older than the loader floor, is reported as not
  playable. It is not downloaded. The notice reads "Update the planner to play
  this event".
- **Application.** The controller receives the verified project text. It then
  calls the existing headless chain:
  - `loadProjectDocument`;
  - `assertPublicProjectAdmission`;
  - `simulateProjectAssembly`;
  - `compileEventPlan` with the event title as the display name;
  - `encodeExecutionPlan`.
- **Memoising.** The compiled plan is memoised by `projectSha256`, the module
  build id and the catalog version, so syncs do not re-simulate.
- **Compile failure.** A compile failure shows a notice and leaves slot 0
  untouched.
- **Host trust binding.** `game_event_publish` accepts the plan JSON from the
  application, and writes it only when:
  - the event is the active verified event;
  - the plan decodes and validates;
  - the plan's `projectId` equals the verified project's `projectId`.

  Slot write, overview and `SlotEvent` are otherwise unchanged. The victory
  "Planned event" fingerprint match keeps working, because the overview records
  the written plan.

- **Retired:**
  - the per-build selection, `NoPlanForBuild` and the `plans` decoding;
  - the plan-bytes-only rule in the boundary doc.

### Events repository

- **validate.yml / check-local.sh:** the builder compiles every event with the
  latest planner release, to catch authoring errors. It then emits the v2 feed
  and runs `events_ci check`.
- **publish.yml:** build the v2 feed (metadata, project URL, hash and schema
  version), sign, verify, upload the projects and then the feed.
  - Remove the `module-build.json` read, the per-build compile, the older-build
    merge and the published-feed verification step used for that merge.
  - Keep the daily, push and dispatch triggers.
  - Drop the `planner-release` dispatch.
- **Docs:** update `events/README.md`, `README.md` and the template to the v2
  shape.

### Planner release workflow

- Stop producing and uploading `module-build.json`
  (`build-linux.yml:138-157,231`, `release.yml:142`).
- Remove `events_ci module-build`.
- Keep `events_ci check`, `verify` and `build-id`. `build-id` serves the pinned
  web-hosting plan.
- Update `releaseBuildWorkflow.test.ts`.

### Development builds

- The Import/Export of an event document with embedded plans
  (`community_event.rs:339-353`, `communityEvents.ts:288-340`) is retired.
- Import now loads a local event folder: `event.json` plus
  `project.runplanner.json`. It runs through the same validation, schema gate and
  local compile as a feed event, without the signature, and writes slot 0.

## Gates

1. **Planner.**
   - feed v2 decoding and the schema gate;
   - host project download and verification held per session;
   - the trust-binding `game_event_publish`;
   - controller local compile, memoisation and failure notice;
   - the development event-folder Import;
   - the builder emitting v2;
   - the release workflow change and `events_ci` cleanup;
   - re-signed feed fixtures;
   - docs: `GAME_INTEGRATION_BOUNDARY.md` (event slot and event feed),
     `CONTRIBUTING.md` (community events) and
     `COMMUNITY_EVENTS_LIVE_ACCEPTANCE.md`.
2. **Planner release.** Ship it, owner action.
3. **Events repository.** Update the workflows and docs to v2. Publish the v2
   feed right after the release. Retire this plan.

## Tests

- **Host (Rust):**
  - v2 decode, including refusals and the schema gate;
  - project hash verification;
  - publish refused for an inactive event, an undecodable plan or a mismatched
    `projectId`;
  - v1 feed refused.
- **Application:**
  - the controller compiles the verified project and publishes;
  - memoisation;
  - compile failure keeps slot 0;
  - schema-gate notice;
  - the end-of-event flow is unchanged.
- **Builder:** v2 output shape, with every event compiled for validation.
- **Release workflow:** no `module-build.json` asset.

## Non-goals

- Backward compatibility with v1 feeds or v0.19.x planners.
- A minimum planner version in the feed.
- Changing the signing key, signature scheme or slot-0 module behaviour.
