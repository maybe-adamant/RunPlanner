# Encounter admission live acceptance

## Status

Pending live acceptance, 2026-09-25. Automated closure of the encounter budget
correction, one-time native admission, Arachne cocoon count, Anomaly roster and
Hub fountain deliveries (execution protocol 47, authored schema 88) preceded
in-game verification. Native-source probes and
executor tests do not establish these obligations; do not record an in-game
pass from a source probe.

Tartarus entry identity and NPC shopping protection are also implemented and
independently reviewed (execution protocol 48, authored schema still 88).
Planner verification passed after refreshing eight catalog snapshot hashes:
3,831 correctness tests across the full run and focused snapshot rerun, plus
typecheck, fixture integrity, performance, lint, formatting and build. The
executor passed 687 tests and lint; all 20 fixture mirrors match byte-for-byte.
Inherited Q shopping callback coverage is retained; native eligibility keeps
it inert. The live obligations below remain open.

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
- [ ] With an Aromatic Phial target, leaving the Hub at the fountain's due
      point without using it reports a `hub-fountain` `missed` diagnostic and a
      `hub-departure-conformance:traitInventory` mismatch. Without a target, the
      same skip reports only the `missed` diagnostic and execution continues.
      Resyncing after a fountain use this session did not observe reports the
      `unobserved` diagnostic; every departure still checks its planned inventory.
- [ ] An early Phial upgrade fails at the immediate Hub departure, even when
      it matches the target planned for a later interval. With no Phial, all
      seven departures (including Preboss) pass with the planned inventory.
- [ ] The Hub map is readable at the fountain and each visit, and each guided
      marker targets the correct fountain or Soul Pylon.
- [ ] The first Tartarus combat uses its published Standard/Small Chronos-intro
      identity; native presentation runs without an encounter mismatch.
- [ ] A Shop inside the published Nemesis or Heracles protection window
      suppresses that NPC's shopping callback before its history flags are set;
      the later planned NPC encounter remains eligible.
- [ ] Shopping outside the protection window, for the other NPC, and while
      execution is unbound or desynchronized remains native.
