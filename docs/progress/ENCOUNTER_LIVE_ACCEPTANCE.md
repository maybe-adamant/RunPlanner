# Encounter admission live acceptance

## Status

Pending live acceptance, 2026-09-24. Automated closure of the encounter budget
correction and one-time native admission delivery (execution protocol 46,
authored schema 87) preceded in-game verification. Native-source probes and
executor tests do not establish these obligations; do not record an in-game
pass from a source probe.

The owner confirms each item from a live run. Delete this file once every item
is confirmed, or when the owner explicitly waives the remainder.

## Obligations

- [ ] An ordinary customized generated encounter installs its published waves,
      highlight and counts, with a `generated-installed` diagnostic.
- [ ] A `GeneratedP_PreCombat` customization with a variable base roll admits
      with the supplied roll and matching native `DifficultyRating`.
- [ ] A representative corrected budget admits without `budget-mismatch`: one
      field-NPC combat with a nonzero modifier and one H passive encounter.
- [ ] Published Fangs perks and positive Menace conversions reach the spawned
      units.
- [ ] An uncustomized encounter in the same run remains native.
- [ ] Where safely reachable, an admission rejection produces a
      `generated-admission` diagnostic with its reason and expected/observed
      evidence, and the encounter continues natively.
- [ ] Supplying a base roll as a single-value `RandomInt(n, n)` range consumes
      exactly one engine RNG step, as the unsupplied native roll does.
