# Encounter admission live acceptance

## Status

Pending live acceptance, 2026-09-25. Automated closure of the encounter budget
correction, one-time native admission, Arachne cocoon count, Anomaly roster and
Hub fountain deliveries (execution protocol 47, authored schema 88) preceded
in-game verification. Native-source probes and
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
- [ ] F postboss runs its native `Story_Chronos_01` carrier without an
      encounter mismatch and stays synchronized through the fountain, Purging
      Pool and the exit into G. Its Chronos conversation remains conditional on
      game progression.
- [ ] An F and a G Arachne combat customized to the declared minimum (8) and
      maximum (14) cocoon counts places that many cocoons, or reports an
      `arachne-cocoon-count` `placement-shortfall` diagnostic. Breaking the
      native reward cocoon still spawns the room reward and releases the
      encounter.
- [ ] A customized Anomaly installs its ordered roster with a `roster-installed`
      diagnostic. The same roster keeps replenishing until capture success, and
      again in a separate run until capture failure; neither outcome produces a
      `roster-not-realized` or `roster-admission` diagnostic, and native cleanup
      removes the remaining enemies.
- [ ] With an Aromatic Phial target, a Hub fountain placed first, one placed
      between two visits, and one placed after the last visit each guide the
      use at that point and survive the intervening Hub returns. The forced
      rarity upgrade is visible on the next room's offer.
- [ ] Leaving the Hub at the fountain's due point without using it reports an
      `obligation:hubDeparture` mismatch. Resyncing after a fountain use this
      session did not observe reports only the `hub-fountain` `unobserved`
      diagnostic and continues.
- [ ] The Hub map is readable at the fountain and each visit, and each guided
      marker targets the correct fountain or Soul Pylon.
