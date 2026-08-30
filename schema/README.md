# Project schema boundary

Schema 73 is the current Run Planner document baseline. A schema-72 document
contains two independent route plans, so the boundary is a reviewed one-to-many
split rather than a route-selection migration.

```bash
npm run schema:split-72-to-73 -- path/to/schema-72-project.runplanner.json
```

The command writes two sibling files, suffixed with `-Underworld-schema73` and
`-Surface-schema73`. It validates the exact schema-72 catalog boundary,
preserves each route subtree and root metadata, and refuses to overwrite either
output. It has no route-selection, in-place, or target-version mode.

The same pure transformation is exported from
`schema/split-project-72-to-73.js` for checkpoint conversion. The source value
is never mutated. The production decoder accepts schema 73 only; schema 72 and
older documents are not migrated in the application.

Run the focused boundary tests with:

```bash
npm run test:schema:split
```
