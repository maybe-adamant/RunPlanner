# Authored checkpoints

Checkpoints are real authored projects for interactions that span the route.
Each is a current-schema document decoded and frozen through the production
codec, not a serialized evaluation or rendered workspace. The manifest attests
identity, intent, provenance and canonical bytes, and static imports keep
changed-test reachability. Command, codec and history tests stay
command-driven; downstream tests use a checkpoint instead of replaying the
whole route to reach a starting state.

Checkpoint support owns manifest and registry closure, static loader
reachability, and recipe-backed canonical-byte integrity. Engine domain suites
own the reached scenario and export workflows.

`npm run fixtures:checkpoints:regenerate` rewrites only recipe-backed
checkpoints through `encodeProjectDocument`; normal integrity checks verify
their recipe equality. This is not save migration: migrate source saves before
regeneration when the schema changes. Imported user-authored checkpoints keep
canonical loader and integrity coverage and are not reconstructed by the
command.

A fixture migration preserves each scenario's intent, passes current strict
decoding and regenerates canonical bytes and hashes. A one-to-many migration
emits every document rather than silently selecting a sibling. Temporary
transformers are removed after conversion; no permanent alternate fixture
decoder is introduced. Generated execution fixtures follow the separate
discipline in their
[README](../../../../packages/planner-engine/test/execution-plan/fixtures/README.md).
