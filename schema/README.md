# Project schema boundary

Schema 77 is the current Run Planner document baseline. It admits the complete
selected-trait consequence inside Echo's Boon Boon Boon outcome. Migrate the
immediately preceding single-route schema with:

```bash
npm run schema:migrate-76-to-77 -- path/to/schema-76-project.runplanner.json
```

The command writes one `-schema77` sibling, preserves the complete authored
route, and never overwrites the source.

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
is never mutated. The production decoder accepts schema 77 only; stale
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

Run the focused boundary tests with:

```bash
npm run test:schema:split
npm run test:schema:migrate
```
