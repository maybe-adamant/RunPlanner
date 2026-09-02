# Project schema boundary

Schema 74 is the current Run Planner document baseline. It adds the
declaration-owned required Boss Reward action to each Boss room chronology.
Migrate the immediately preceding single-route schema with:

```bash
npm run schema:migrate-73-to-74 -- path/to/schema-73-project.runplanner.json
```

The command writes one `-schema74` sibling, preserves every existing room
action in order, appends the required Boss Reward action to each Boss, and
never overwrites the source.

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
is never mutated. The production decoder accepts schema 74 only; stale
documents are not migrated implicitly in the application.

Run the focused boundary tests with:

```bash
npm run test:schema:split
npm run test:schema:migrate
```
