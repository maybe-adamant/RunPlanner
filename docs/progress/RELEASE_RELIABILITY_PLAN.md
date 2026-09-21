# Release identity, compatible loading, and update discovery

Status: locked for implementation.
Base: `1388894f`.

## Outcome and scope

Users can identify the exact app build, keep opening supported older saves,
and discover a newer downloadable desktop release without following GitHub.
Deliver three bounded slices followed by closure. No executor changes.

Approved boundaries:

- App release identity is separate from authored schema and catalog identity.
- Schema 86 is the automatic migration support floor. This work does not bump
  schema, catalog, or execution protocol and creates no production migration.
- Future save-incompatible changes still require explicit project-owner approval.
- Updates are notifications and browser download links, not installation or
  executable replacement. Keep the Windows portable distribution.
- No older-than-86 migration promise, release-channel framework, account,
  telemetry, background polling service, or general-purpose migration framework.

## Governing authorities and present contacts

Read `AGENTS.md`, `docs/design/ARCHITECTURE.md` (Application, Construction and
Publication, Hosts), and `docs/design/AUTHORED_PROJECT_MODEL.md` (Authored
Document Boundary and Schema change approval). Engine edits additionally
require the full `docs/design/SIMULATION_AND_VALIDATION.md` entry guide.

- `.github/workflows/windows-portable.yml` already validates a stable SemVer
  input and supplies it through a Tauri config override. It currently publishes
  a release before uploading the archive and checksum.
- `apps/planner/vite.config.ts` builds the frontend; Tauri's default version
  points to the app package. Neither supplies a visible frontend build identity.
- `apps/planner/src/ui/shell/App.tsx` renders Schema and Catalog in About;
  About currently disappears on the new-project screen.
- `workspace/projectOperations.ts` directly parses Open inputs;
  `persistence/autosaveRecovery.ts` separately parses restored files/autosaves.
- `persistence/profileFile.ts` and `tauriProfileFileAdapter.ts` expose opened
  file writes and restored-file writes through different transport paths.
- `src-tauri/src/profile_file_session.rs` remembers/restores the active path
  and atomically writes restored files through `atomic_file`.
- `state/profileSessionSlice.ts` owns dirty/recovery baselines. Migration
  provenance must not be confused with an authored edit or canonical equality.
- Existing `schema/` migration scripts import Node filesystem facilities.
  Do not bundle those CLI entry points or import test fixtures into production.

External reference boundaries:

- GitHub release metadata supplies release tags, publication state and assets:
  https://docs.github.com/en/rest/releases/releases
- Tauri's Windows updater uses installer artifacts; its installation mechanism
  is excluded: https://v2.tauri.app/plugin/updater/

## Ownership

CI owns release/version/commit inputs and complete artifact publication. The
application composition root supplies immutable build identity and narrow host
capabilities. React renders them; it does not infer versions from schemas.

The application owns import orchestration and migration notices. Pure document
transforms belong with the engine's authored-document authority when an actual
approved schema transition is added. The current-schema decoder remains strict
and unaware of transport or automatic migration. Do not install legacy models
in simulation or treat invalid gameplay choices as migration failures.

Native adapters own filesystem preservation and release HTTP/browser effects.
Rust does not interpret or migrate planner semantics. Browser imports use the
same document-loading policy; browser downloads retain their existing Save As
behavior. Automatic update checks target packaged desktop releases, not local
development/browser builds with no comparable release identity.

## A — Visible build identity

Use the same validated CI release version for Tauri and frontend build metadata,
plus the source commit hash. Show Version and Build before Schema and Catalog
in About, including before any project is open. Local builds explicitly show
Development and a commit when available; never pretend package `0.1.0` is the
released version. Missing release metadata is a release-build failure, not a
fallback to development. Source archives without Git must still build locally.
Use an explicit CI-only official-release flag and validate both version and
commit hash when it is set; Vite production mode alone is not a release signal.

Keep release identity out of persisted projects, catalog and executor protocol.
No manual version edits across several manifests per release.

Primary checks: build-metadata validation, About rendering, CI/frontend/native
version agreement, and development fallback. Use the existing Vite/Tauri build
boundaries, not a new runtime version-discovery service.

Intended commit: `feat(planner): expose release version and build identity`.

## B — One compatible-loading boundary and safe preservation

Replace the two direct application parsing paths with one supported loader:

1. Parse JSON and inspect the format/version envelope without modifying input.
2. Accept the current format directly. For a supported older format, apply
   only its explicit ordered migration chain, without mutating source input.
3. Reject malformed envelopes, unsupported older versions, future schemas,
   missing transitions and unsupported source schema/catalog pairs with concise
   errors. Each future transition declares its supported source pair and target
   identity. Do not require the current catalog identity before that transition;
   the final strict decoder enforces current compatibility.
4. Strictly decode the final document and retain existing admission/preparation
   checks before publishing any project or changing the active file.
5. Return the current document plus explicit migration provenance. No sidecar
   map, guessed defaults, silent field removal, or blanket catalog restamping.

Use a small explicit ordered transition list; it is empty while current schema
equals the support floor. Do not add a pretend 86-to-87 transition. Tests may
inject test-only transformations to exercise sequencing and failures; they
must be clearly transport/mechanism tests, not claims about a future schema.
Retain a real schema-86 import/roundtrip witness. Each future approved migration
must add source-document fixtures and final strict-decoder coverage.

### Current delivery and future migration safety

- Open, remembered-file startup and autosave recovery all use the same loader.
  Preserve current startup precedence and blocked-recovery protection.
- Loading never rewrites the source file. Current schema-86 loads retain normal
  dirty-state, saving and recovery behavior. Unsupported inputs remain intact.
- This gate establishes the loader and migration mechanism, not an unused
  backup/session subsystem. No file can actually migrate in this release,
  because the supported floor and current schema are both 86.
- Before shipping the first real migration, its plan must implement original
  byte preservation for migrated disk files and autosave recovery, a concise
  upgraded-in-memory notice, and explicit pending-save provenance. Preservation
  must precede overwrite, fail safely, survive restart/retry, and cover opened
  and restored files plus Save As targeting the source. New/Open must retire
  tracking without deleting retained backups. Use the scoped native file and
  atomic-write authority; do not move migration semantics into Rust.
- That future migration cannot be declared complete merely by adding its pure
  transform. It must prove the preservation workflow with real source fixtures.

Primary checks: loader boundary and existing projectOperations/autosaveRecovery
tests. Cover unchanged current inputs; failed transform/decode/admission without
session mutation; unsupported version/catalog; disk/recovery equivalence; and
existing Save/Save As/cancel behavior. Test-only transitions prove sequence
dispatch and final strict decoding. Do not pretend they prove future migration
semantics or native backup safety, and do not duplicate their matrix in UI tests.

Intended commit: `feat(planner): establish migration-safe project loading`.

## C — Release discovery and complete publication

For a packaged desktop release, make one asynchronous startup check after app
initialization. Never await it to show the editor or restore a project. Use a
bounded request timeout and validated GitHub release metadata for the fixed
official repository. Compare parsed stable SemVer, not strings or schema
numbers. Ignore drafts/prereleases and do not recommend downgrade/same version.

Notify only when the newer release has the supported portable archive and its
checksum. Offer Download, Later, and Skip this version. Download opens the
validated HTTPS release asset/link in the default browser; it never closes the
app or alters files. Do not render remote release notes as trusted HTML or
accept arbitrary URL schemes/hosts from remote metadata.

Later dismisses for this session; Skip persists only the exact release version.
Add Check for updates in About. Manual checks bypass suppression and explicitly
report checking, current, newer, or unavailable. Automatic timeout/offline/rate
limit/malformed responses are quiet. Preference storage failure must not prevent
app startup. No credentials or GitHub token shipped in the executable.

Use a narrow native release-check/browser-opening adapter, with frontend
presentation/session coordination. Keep network permissions bounded; don't
relax the application CSP broadly or introduce the installer updater plugin.
Avoid duplicate startup checks under React StrictMode or repeated renders.

Publish safely: create a draft release, upload archive and checksum, then
publish/mark latest only after completion. Preserve tag/SHA safeguards and make
retries resume the same draft safely. Do not clobber an already published
release's assets; reject an already published version with an instruction to
choose a new version. Require each new stable release version to exceed the
highest published stable SemVer before publishing/marking latest. Check this
at final publication as well as preparation. Do not alter old tags or release
records as part of implementing this workflow.

Primary checks: semantic-version comparison, malformed/absent assets, URL
validation, offline/rate-limit handling, skip/manual behavior, single startup
invocation, no startup blocking, and draft/upload/publish workflow order.
Use mocked responses in tests, not live GitHub availability. Verify packaged
Version/Build and browser opening in a desktop smoke test; publishing an actual
release remains a separately authorized action.

Intended commit: `feat(planner): notify users of downloadable releases`.

## Review, closure and retirement

Reuse one write-capable executor across all three slices, with focused packets
and narrow verification at each handoff. After all three slices stabilize,
use one independent reviewer for the combined delivery and one bounded
remediation pass. Do not spawn a separate reviewer per slice. Main session
owns Git, cross-slice assessment and closure.

Adversarial acceptance: a newer app version with identical schema is visibly
distinct; current saves need no migration; failed loading cannot damage the
active project or source; the first real migration retains an explicit
original-preservation delivery requirement; no update
network outcome can prevent offline authoring; no incomplete release is offered.

Run narrow owning tests while implementing, then one `npm run check` plus the
owning native desktop checks at closure. Keep generated fixtures unchanged
unless their actual semantic product changed. Record truthful validation in
commits, including any pending real Windows smoke test.

At closure revise the existing Architecture host/persistence explanation and
Authored Project Model document boundary to describe application migration
before strict decoding and the preservation requirement for a real migration.
Retain explicit schema-change approval. Update concise
user-facing release/support-floor help where it is needed. Do not create a sprawling
updater manual or append bug-fix narratives. Remove this temporary plan after
delivery; pre-86 CLI tooling is not retired by this plan.
