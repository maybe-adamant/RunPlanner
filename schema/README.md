# Project schema boundary

Schema 81 preserves the exact declaration-owned option selected in each World
Shop slot. This distinguishes ordinary Boons from the boosted Boons declared
by the I and Q World Shops without inventing a second reward type.

```bash
npm run schema:migrate-80-to-81 -- path/to/schema-80-project.runplanner.json
```

Unambiguous inventory entries receive their exact option key. A legacy Q mixed
slot containing `RandomLoot` remains unresolved because either the ordinary or
boosted option could have produced it; reopen that item in the planner to
repair it. The command never overwrites the source.

Schema 80 replaced the
sequence-bearing source portion of generated clocked-pickup entry keys with
the stable semantic acquisition identity and updates matching Room Action
references. Migrate the immediately preceding single-route schema with:

```bash
npm run schema:migrate-79-to-80 -- path/to/schema-79-project.runplanner.json
```

The command preserves generated pickup payloads and authoring detail, rewrites
entry keys and matching references together, and refuses migrated-key
collisions. It never overwrites the source.

Schema 79 moved a purchased World Shop Mystery Boon's god source and trait
result from generated inventory to its room-exit acquisition entry. Migrate the immediately preceding
single-route schema with:

```bash
npm run schema:migrate-78-to-79 -- path/to/schema-78-project.runplanner.json
```

The command preserves a purchased Mystery Boon's authored source and trait
result at acquisition time. An unpurchased Mystery remains type-only inventory,
because its hidden source never resolves.

Schema 78 added occurrence-owned Fields entry, cage, optional-reward, and
Passive Nemesis placement leaves. Migrate schema 77 with:

```bash
npm run schema:migrate-77-to-78 -- path/to/schema-77-project.runplanner.json
```

The command writes one `-schema78` sibling, preserves the complete authored
route, initializes the new Fields placements as unresolved, and never
overwrites the source.

A schema-72 document contains two independent route plans, so its boundary is
a reviewed one-to-many split rather than a route-selection migration.

```bash
npm run schema:split-72-to-73 -- path/to/schema-72-project.runplanner.json
```

The command writes two sibling files, suffixed with `-Underworld-schema73` and
`-Surface-schema73`. It validates the exact schema-72 catalog boundary,
preserves each route subtree and root metadata, and refuses to overwrite either
output. It has no route-selection, in-place, or target-version mode.

The schema-72 splitter's pure transformation is exported from
`schema/split-project-72-to-73.js` for checkpoint conversion. The source value
is never mutated. The production decoder accepts schema 81 only; stale
documents are not migrated implicitly in the application.

Migrate a schema-74 document with:

```bash
npm run schema:migrate-74-to-75 -- path/to/schema-74-project.runplanner.json
```

The command preserves each authored Embryo blessing identity and adds an empty
`blessingValues` object for repair. The planner requires those operands to be
completed before the result can be used, and the command never overwrites the
source.

## Schema 75 to 76

Adds an unresolved Anvil result to existing authored Anvil purchases while
preserving the selected shop offer.

```bash
npm run schema:migrate-75-to-76 -- path/to/schema-75-project.runplanner.json
```

The command adds a `null` result for each existing Anvil World Shop offer and
never overwrites the source. New Anvil purchases remain unresolved until the
author selects their result.

## Schema 76 to 77

Completes Echo Boon Boon Boon's nested selected result with the three
option-owned volatile carrier consequences.

```bash
npm run schema:migrate-76-to-77 -- path/to/schema-76-project.runplanner.json
```

The command writes one `-schema77` sibling and never overwrites the source.

Run the focused boundary tests with:

```bash
npm run test:schema:split
npm run test:schema:migrate
```
