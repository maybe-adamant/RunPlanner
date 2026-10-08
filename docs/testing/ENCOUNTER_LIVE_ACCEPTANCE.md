# Encounter live acceptance

Pending in-game checks only; implementation is complete. Use a current matching
planner and game-module build. Native-source probes and automated tests do not
establish a live pass. The owner confirms results or explicitly waives checks;
retire this file when none remain.

## Obligations

- [ ] Aetos: no selection suppresses appearances throughout planned Olympus.
- [ ] Aetos: requested early and late waves force the chance at the selected
      encounter while native spawn pacing and departure remain intact.
- [ ] Aetos: an uncustomized GeneratedP target uses its native wave roll; if
      a one-wave roll is actually observed, it reports fallback without mismatch.
- [ ] Aetos: where reproducible, native ineligibility or a missed/skipped target
      diagnoses once and later encounters resume native behavior. Do not
      fabricate cooldown state or claim random fallback without live evidence.
- [ ] Aetos: Fig Leaf exclusion/propagation and Gorgon coexistence match the
      planner's event selection, with no new conformance obligation.
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

## Shop purchases

- [ ] Shrine of Hermes with Travel Deal held on entry: plan two rushed
      purchases with slot 3 bought first and slot 1 second, and buy the Travel
      Deal refill. Buy in that order in game. Slot 3's vacated position refills
      with the planned item, slot 1 does not refill, and the refill purchase
      executes without a conformance mismatch.
- [ ] World Shop and Stygian Well with Travel Deal held on entry: buy the
      refill authored on the Travel Deal line under the first purchase row. The
      refill appears in the first purchase's slot with the planned item and
      executes as before, without a conformance mismatch.
- [ ] World Shop with Gold Gold Gold held on entry: plan an Anvil of Fates as
      the first purchase and author a different Anvil result on its Gold Gold
      Gold copy. Buy the Anvil, then pick up the spawned copy. Each Anvil
      removes and adds exactly its planned traits, in that order, without a
      conformance mismatch.
- [ ] World Shop with Travel Deal held on entry: author an Anvil of Fates as
      the Travel Deal refill with a planned result. Buy the first item, then
      the refill Anvil. The Anvil removes and adds exactly its planned traits
      without a conformance mismatch.
- [ ] Stygian Well: plan and buy Kiss of Styx, and in a later run Centaur
      Soul. Each purchase executes and the room exits without a conformance
      mismatch; Centaur Soul raises max health by 25 without healing.

## Trait inventory conformance

- [ ] Fight Fight Fight: take it from Echo in the third biome and continue
      without dying. It is removed at the 13th room departure after the first,
      and no room exit reports a trait-inventory mismatch before or after.
- [ ] Evade Evade Evade: take it from Echo and dodge until its bonus is spent
      and the trait is gone. The next room exit tolerates its absence without a
      trait-inventory mismatch.
