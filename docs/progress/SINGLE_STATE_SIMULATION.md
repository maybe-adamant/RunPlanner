# Single-State Simulation

Status: pinned 2026-11-01, scheduled after the popup UI work. No authored
schema change expected.

## Objective

Everything the user edits resolves against one concrete simulated state.
Branching survives only as lookahead: a yes/no search that answers "can this
happen", never as alternative states carried forward or offered as a choice.

## Settled conclusions

1. **Downstream edits never see unsettled upstream.** The editor refuses edits
   whose candidate context is unreached, so a pick (a Pom target, an offer
   row) always resolves against one state. Two branches disagreeing at an
   editable surface is an engine contract failure, treated like gold-ledger
   divergence, not a choice for the user. The Pom "Route state" picker was
   removed on that basis (2026-11-01); the capability now publishes one
   surface and throws a contract error if reached contexts disagree.
2. **Drawn bag-entry identity does not matter in today's catalog.** Drawing an
   offer consumes one canonical eligible same-item entry, which is sound
   because every same-item group in every counted store is one of:
   - identical conditions (Boon, side-room rewards; no store declares an
     interchangeable item any more);
   - mutually exclusive, never drawable together (early vs late Hammer; early
     vs late small Ash and Bones);
   - differing only by a condition that only ever turns true (Health, Mana
     and Gold drops' ordinary-loot count; Pom's "has a boon").
     The one condition that can turn false mid-run (lifetime totals crossing a
     threshold) applies to a whole group at once, so it cannot split branches.
     Bag-entry branching can therefore collapse to one state per draw with no
     change in what is valid.
3. **Offer sets do not come from the bag's identity choice.** What matters is
   that an activated entry of the type is drawn, not which one.
4. **Wheels have a fixed draw order.** `ShipsEncounterSetup`
   (`RoomLogic.lua:1411`) loops the wheels left then right, threading
   `rewardsChosen`, so offer 1 is the Left wheel and is drawn first. The wheel
   cohort order search is gone (owner, 2026-11-03); Hub boards keep their
   source-offer order search.

## Work

1. **Engine: collapse bag-entry branching.** Drawing an offer consumes one
   canonical eligible entry instead of branching over each
   (`reward-kernel/bag.ts` `consumeCountedOffer`), and the latent-bag merge
   that exists only to fold those branches goes with it. Wheel cohort order
   search remains as existence lookahead.
   _Status: done._ `consumeCountedOffer` returns one bag (the last eligible
   entry of the drawn type, matching the state the old dedupe kept), the
   per-draw `bagSemanticKey` merge and the normalized
   `interchangeableRewardTypes` field are gone; `mergeEquivalentRewardBranches`
   stays (cohort orders, Shop cohorts, site settlement, biome start). Wheel
   cohorts already collapse every valid order to one bag in every engine
   witness (probe: 18 two-order cohorts, all one state out); the equivalence
   corpus reaches no multi-offer wheel. Equivalence 157/157 unchanged.
2. **Catalog build-time guard.** Collapsing is only sound while no store holds
   two same-item entries whose conditions can both hold and later diverge.
   Today only a hand-maintained interchangeable list prevents that. The catalog
   compiler rejects such a declaration so real branching cannot return
   silently.
   _Status: done._ Store normalization classifies every same-item pair as
   identical, declared interchangeable, mutually exclusive (disjoint ranges,
   flags, routes or route keys) or a monotonic difference (closed switch over
   requirement kinds; unknown or reversible kinds are not monotonic) and
   rejects the rest naming store, item and entries. Every current group passes
   on its requirements alone, so RunProgress no longer declares the
   interchangeable list; the declaration remains as an escape hatch.
3. **Wheel side order and Pom single-state contract** (owner-approved
   2026-11-03).
   - Wheels draw offer 1 (Left) then offer 2 (Right) with no permutation; the
     `allOffers` ordering, its permutation fan-out and the unordered
     explanation are gone. A loader migration exchanges a saved wheel's offers
     (rerolled offers, picked index, reroll targets, embedded offer addresses)
     when the plan's block names it and the exchange clears it; done by the
     catalog-aware schema 100→101 migration step. Draft authors through candidates and the run
     import already maps Left to offer 1.
   - The level-resolution capability publishes one surface and asserts every
     reached context agrees on it; a disagreement is a
     `CandidateEvaluationContractError`. Draft, the run import and the Pom
     editor read the one surface; the editor's fault line is gone.
   - The editor labels a one-offer wheel's offer "Offer" and a two-offer
     wheel's "Left Offer" / "Right Offer".
     _Status: done._ Equivalence 157/157 unchanged; the migration swaps no wheel
     in any checked-in or catalog plan (4 two-offer wheels, all valid in side
     order).
4. **Single-state frontier.** Replace the branch list with one state or
   impossible; delete `mergeEquivalentRewardBranches` /
   `equivalentBranchStateKey` and the existential aggregation (trait-offer
   `branchContexts` flatMap and `branchAgreement`, including the run import's
   carrier-children check; Shop every/some; the run-state divergence throw;
   phantom-exit per-branch pick) and per-branch evaluations, including the
   selected Pom assessment's `branches`. Equivalence identical throughout;
   performance measured.
   _Status: in progress._ Done: the walk carries one state or none (a second
   state is a `BiomeRewardSimulationContractError`); the merge and
   equivalence key are gone; the biome publishes `frontier`, target
   checkpoints and start captures carry one `state`, and Run State, start
   installation, seeds and execution assembly read it, deleting the run-state
   divergence throw, bag ranges, the start point's `branchesDisagree` and
   every seed/frontier agreement attestation (Gorgon, Fig Leaf, Shadow,
   Hordes, Spell reservation, talent closure, reward lookups, Echo replay).
   A probe over the equivalence corpus and the engine, Draft, run-import and
   planner suites found no production path with more than one state. The
   equivalence digest maps the new products onto the recorded branch-list
   shape until the baseline is next recorded. Equivalence 157/157 and the
   Draft corpus unchanged; performance flat. Hub boards keep their
   source-offer order search inside board settlement (one state out): the
   game assigns board rewards over `CollapseTableOrdered` doors that tie on
   one obstacle name, an order no authored or catalog fact carries.
   Then (2026-11-02): each trait offer keeps one contact, its own pre-offer
   context plus a blocked target or All Together child's context keyed by
   the child's address, and every candidate product answers at that state;
   `branchContexts` aggregation, `branchAgreement`, `branchSupport`,
   `activeArcanaByBranch`, the `branchDivergence` reason and the run
   import's agreement check are gone (a probe over every suite and the
   equivalence corpus found no offer with two distinct contexts). Selected
   trait-offer and Pom assessments publish one `assessment` (a second
   differing one is a contract error) and execution assembly reads it
   without `agreement()`. Shop inventory, the phantom exit's settled type,
   Gorgon rarity, the reroll pool, gold spawn and door readings and Nemesis
   random-event support read the one state; the Shop cohort agreement, the
   scarcest-branch phantom pick, the Gorgon divergence throw and the gold
   `divergent` reading are gone. Equivalence 157/157 after every commit.
   Then: Steady Growth and Transcendent Embryo outcomes land once each and
   publish one threshold's interval, progress and rarity; their candidates
   answer at it without `branchSupport`, and a second landing is a contract
   error, so the divergent-landing settlement fault is gone.
   A fountain use keeps its one Phial frontier; its candidate answers there
   and the editor marks a target possible only while that Phial is pending.
   A fountain use keeps its one Phial frontier; its candidate answers there
   and the editor marks a target possible only while that Phial is pending.
   A fountain use keeps its one Phial frontier; its candidate answers there
   and the editor marks a target possible only while that Phial is pending. A
   keepsake equip result keeps its one pre-equip state; an Echo replay with
   no reached state opens no result.
   A fountain use keeps its one Phial frontier; its candidate answers there
   and the editor marks a target possible only while that Phial is pending. A
   keepsake equip result keeps its one pre-equip state; an Echo replay with
   no reached state opens no result. A Hermes Shrine and a Purging Pool
   publish one assessment (each Pool reroll one), a Stygian Well its entry
   assessment and a chronological log of purchase and reroll assessments, and
   a Shrine Travel Deal refill one realized domain; their capabilities read
   them without agreement.
   Remaining: derived-entry `branchCohortSize`, offer exclusions'
   `allBranches`, gold purchase price contexts, the All Together settlement's
   per-history domains, and the settlement internals' zero-or-one lists.
5. **Trait offer state inspector.** With one state per draw, the offer-state
   popover's "Possible state N" blocks collapse to one; simplify it.
   _Status: done._ The presentation carries one rarity state and the
   popover shows it without per-state headings.
6. **Docs.** `SIMULATION_AND_VALIDATION.md` gains the rule: anything the user
   sees resolves against one state, branching is lookahead only. Revise the
   "existential over reachable latent branches" wording in
   `CANDIDATE_EVALUATION_MODEL.md` and `CONTEXTUAL_EDITOR_UX.md` to match.
   _Status: in progress._ The trait-offer candidate boundary, the
   existential-support bullet, the Circe domain note, the screen-expectation
   publication and the Offer State popover sentence now describe one state.

## Verification

- `npm run test:equivalence` before and after: validity must not change.
- `npm run test:draft-corpus` before and after (Draft walks bags).
- `npm run test:performance:snapshot` / `compare`: fewer branches should be
  faster; record the delta.
- Engine witnesses: a store with interchangeable same-item entries draws one
  state; the catalog guard rejects a divergent same-item pair; a wheel whose
  combination is valid only right-to-left is rejected and the migration
  exchanges it; Pom divergence reports a contract failure.

## Open

- The earlier inventory was read-only analysis, not an exhaustive proof for
  every trait-settlement path; the build-time guard and equivalence lane are
  what make the collapse safe. Confirm no other splitter (beyond bag entries
  and cohort order) yields divergent trait history before step 3.
