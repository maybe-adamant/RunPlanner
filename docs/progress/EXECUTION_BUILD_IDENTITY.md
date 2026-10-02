# Execution build identity

Status: locked 2026-10-02 on `main` at `4e363f84`. Retires the execution
protocol number; compatibility moves to a module build identity.

## Objective

The execution protocol number predates the in-repo game module. In release
builds the host already requires the installed module's file hashes to equal
the bundled package, so the number protects only slot files written by an
older build and development checkout installs. Replace it with a build
identity that covers exactly those cases, and keep the plan wire bytes and the
checked-in fixtures free of any build identity so module or engine edits never
churn fixtures.

## Decisions

- `protocolVersion` leaves the plan document; `format` and `catalogVersion`
  stay. `planFingerprint` is recomputed without it (one final mechanical
  fixture regeneration). `catalogVersion` remains a hand-maintained game-data
  identity; the authored schema version is the only hand-maintained
  compatibility version for user documents.
- `buildId` is a sha256 over the sorted `path NUL sha256 LF` lines of the
  module `src/` payload as checked in (manifest, icon, license and readme
  excluded; engine source excluded: a wire change always changes the strict
  Lua decoder, and the fixture-decode lane catches engine/module drift).
  Computed in `game_module_assembly.rs` `assemble()`, shared by the bundled
  package and the debug checkout package; stamped into the packaged
  `execution-compatibility.json` as `{format, catalogVersion, buildId}`. The
  checked-in file carries no `buildId`; a hand-written one is refused.
- The host writes each slot as an envelope
  `{"format":"run-planner-slot","buildId":"…","plan":<plan bytes unchanged>}`
  and refuses publication when the installed module's `buildId` differs from
  the reference (bundled package; in a debug build with a Checkout install,
  the freshly assembled checkout package). Slot reading reports `Stale` when
  the envelope's `buildId` differs from the installed module's, including a
  bare pre-envelope root.
- The module reads its own `buildId` from the installed compatibility file;
  the inbox requires an exact envelope with a matching `buildId` before
  decoding (`stale-slot`: send again; `module-build-unknown`: install from the
  Game panel). The decoder checks only `format` and `catalogVersion`.
- The planner never learns the build identity; host status carries the
  bundled and installed `buildId` and per-slot `buildId` into the Game panel
  and bug reports.
- Deleted: `EXECUTION_PROTOCOL_VERSION`, Lua `protocol.VERSION`, the
  `protocolVersion` key in the compatibility file, the Rust struct field, both
  fingerprint bodies, inbox status and status UI, `appFacts.protocolVersion`,
  every "rejects protocol N" test, and the bump ceremony.

## Delivery

Two commits, landed back to back (the first alone removes the gate):

1. `refactor(execution): drop the protocol number from the plan`: engine
   model/compiler/codec, Lua decoder, fixture regeneration (two lines per
   fixture), TS and Lua test edits.
2. `feat(execution): gate plans on module build identity`: assembly stamping,
   package parsing, publication envelope and refusal, slot `Stale`, debug
   checkout reference, module build identity and inbox envelope, planner
   status/summary, bug-report facts, tests (assembly stability and refusal of
   a checked-in id; envelope bytes preserved; Stale; inbox stale/unknown/
   admitted), docs.

Acceptance: `npm run test:game-module` decodes every fixture with no build
identity involved; fixture `git diff --numstat` is exactly two lines per file;
Rust, Lua, TS lanes green; `GAME_INTEGRATION_BOUNDARY.md` describes the
envelope and build identity with no protocol-number wording; full `npm run
check` and `npm run test:equivalence` green (plan digests change once).

## Closure

Promote the compatibility contract into `GAME_INTEGRATION_BOUNDARY.md`; replace
the two dated "protocol 53" parentheticals in the audits with the probe
commit; delete this plan.
