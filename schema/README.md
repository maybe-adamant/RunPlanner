# Project schema migrations

`migrate-project.js` upgrades readable Run Planner project JSON through the explicit migrations
registered in the script. It never migrates backwards and refuses to skip an unimplemented schema
step.

```bash
npm run schema:migrate -- path/to/project.json
npm run schema:migrate -- --output path/to/migrated.json path/to/project.json
npm run schema:migrate -- --in-place test/fixtures/authored-project/checkpoints/example.runplanner.json
```

The default command writes a sibling file whose name ends in the target schema. `--in-place` is
intended for version-controlled fixtures after their semantic intent has been reviewed.

The current `49 -> 50` migration adds the new SpellDrop trait-offer owner as `null`. Schema 49 did
not record which three spells appeared or which was selected, so the generic migrator preserves that
unknown state instead of inventing an outcome. The schema-50 editor can then resolve the retained
missing child normally.

For a future schema bump, add exactly one `N -> N+1` function and register it in `migrations`. Keep a
migration only when old state has an unambiguous representation or can be preserved as an explicit
incomplete value. If a bump requires reconstructing lost player intent, use a one-off reviewed
migration instead of adding a guess to this tool.

Run the migration tests with:

```bash
npm run test:schema:migrations
```
