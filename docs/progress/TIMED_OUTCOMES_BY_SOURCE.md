# Timed Outcomes by Source

Status: locked 2026-10-25. Base commit: `fae907300`. Major schema change
approved by the owner on 2026-10-25, with old outcomes dropped.

## Objective

Steady Growth targets and Transcendent Embryo blessings survive unrelated
edits. Today they are stored by the encounter phase where a cycle lands
(`steadyGrowthTargetByPhase`, `transcendentEmbryoBlessingByPhase`), so a phase
cannot say which cycle a choice was for, and edit settlement resets inherited
choices it cannot prove still correspond — even after a change and its revert.
Keyed by their source and cycle, like Hermes deliveries and clocked pickups are
keyed by their source, they need no reset rule.

## Model

1. **Outcomes live on their source.** A Steady Growth target is stored on the
   trait offer that gives Steady Growth, as cycle → target trait. An Embryo
   blessing is stored on the equip that installs the Embryo (the starting
   keepsake's equip result or the Postboss rack that equips it), as cycle →
   blessing. The address is the source's authored address plus the cycle; it
   uses authored addresses, not the history's positional ordinal.
2. **Position is derived.** Procs are automatic, so an outcome has no authored
   position: the simulation applies it where its cycle lands, and the editor
   shows it there. A timing shift moves it without any edit.
3. **Dependencies are findings, never resets.** An outcome whose value is
   illegal where its cycle lands (target not held, blessing not available from
   the current marked blessing) is the existing `…OutcomeUnavailable` finding;
   a reached cycle without one is `…OutcomeMissing`. A cycle that is never
   reached keeps its outcome dormant, as unreached choices are today. Changing
   the source away follows the source's existing rule: another trait picked or
   another rack keepsake removes its outcomes; a changed route-start keepsake
   leaves them dormant, like its other equip results. A Steady Growth gained
   as the Concave Stone extra pick grows like any other (today it never
   advances — fixed in gate 3).
4. **Two Steady Growths are separate.** Each source has its own cycles, so two
   Steady Growths maturing at one encounter no longer share one target.
5. **Branches must agree.** The authored path to a landing is deterministic, so
   reached branches that disagree on where a cycle lands are an engine
   contract failure, reported as a settlement fault (bug-report path), never
   an editor feature.
6. **Edit settlement** loses its Steady Growth and Embryo reset arms
   (`edit-settlement.ts` ~258-303). The shared contact machinery stays for
   clocked pickups and Hermes deliveries.
7. **Schema** 98 → 99. The migration drops phase-keyed outcomes; the player
   re-authors them once. Execution-plan wire fields keep their meaning; the
   published `owner` strings and `phaseKey`/`window` now come from the
   source address and the landing.

## Gates

1. **Authored model:** types, addresses, codec, commands, the 98 → 99
   migration with its CLI, test and `schema/README.md` entry; regenerate the
   `surface-scheduled-lifecycle` checkpoint from its route builder; command and
   codec tests.
2. **Simulation and execution plan:** lookup by source and cycle at the
   encounter-end seam, Embryo transformation identities from the new address,
   findings, candidates, timeline nodes; the compiler reads outcomes by source;
   regenerate execution fixtures, game-module fingerprint tests and the
   equivalence baseline once (only Steady Growth/Embryo-bearing entries move).
3. **Edit settlement:** remove the reset arms; rewrite the tests pinning the
   conservative reset; add the regression test (change an N boon pick and
   change it back; every downstream outcome survives) and a branch-disagreement
   fault test.
   3b. **Source-keyed resets:** clocked pickups and Hermes deliveries are already
   keyed by their source, so their conservative "reset inherited when newly
   reached" rules go too: kept, with findings where invalid. Regression: the
   change-and-revert round trip restores the project exactly.

4. **Editor:** projections, interactions and rows bind to the new address; no
   visible change; draft samplers follow.
5. **Closure:** docs (`AUTHORED_PROJECT_MODEL`, `TRAIT_OFFERS`, scheduled
   outcomes audit, others naming the phase maps), delete this plan.

Each gate gets an independent review (schema change). Lanes per gate as
touched; `npm run test:equivalence` before and after gate 2; `npm run check`
at closure.

## Non-goals

- Translating old outcomes by simulation.
- Changing Steady Growth or Embryo game behaviour or the Embryo equip result.
