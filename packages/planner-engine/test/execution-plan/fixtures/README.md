# Execution fixtures

These checked-in JSON execution fixtures are generated protocol products, not
scratch serialization output.

- Generate their semantic content through the owning planner fixture/product
  builder. Do not hand-author wire fields that production cannot emit.
- Use the repository's Prettier JSON format for every fixture, including its
  trailing newline. Generate through `encodeExecutionPlan` and format that wire
  output with Prettier before writing it. Do not serialize the expanded
  in-memory plan, use plain `JSON.stringify` indentation, or write compact
  one-line fixtures. Published plans remain compact; this policy applies only
  to checked-in fixtures.
- A generator using Prettier's API resolves the repository configuration for
  the destination and passes its filepath to `prettier.format`. A shell-based
  refresh finishes with `npx prettier --write <changed-fixture-paths>` before
  handoff. This is part of generation, not a later cleanup pass.
  `npm run format:check` enforces the same format. Do not manually wrap lines
  or reformat unrelated fixtures during semantic changes.
- Regenerate only fixtures whose semantic product changed. For a protocol-wide
  scalar such as the version number, use a bounded mechanical edit rather than
  rebuilding otherwise unchanged products.
- This corpus is the only copy. The game module's Lua tests read it in place;
  run `npm run test:game-module` after changing a fixture.
- Before handoff, inspect fixture `git diff --numstat` and a representative
  diff. Unexpected whole-file churn or formatting-only changes are a failed
  fixture update and must be corrected before review.
