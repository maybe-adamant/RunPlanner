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
   cohort order search is gone (owner, 2026-11-03). Hub boards draw in the
   game's native door order, derived from the catalog's door-setup order, so
   no board order is searched either.

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
   planner suites found no production path with more than one state.
   Equivalence 157/157 and the
   Draft corpus unchanged; performance flat.
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
   error, so the divergent-landing settlement fault is gone. A fountain use
   keeps its one Phial frontier; its candidate answers there and the editor
   marks a target possible only while that Phial is pending. A keepsake equip
   result keeps its one pre-equip state; an Echo replay with no reached state
   opens no result. A Hermes Shrine and a Purging Pool publish one assessment
   (each Pool reroll one), a Stygian Well its entry assessment and a
   chronological log of purchase and reroll assessments, and a Shrine Travel
   Deal refill one realized domain; their capabilities read them without
   agreement. Derived acquisition entries keep one frontier per entry (a probe
   over every suite found every cohort of size one, a later emission
   replacing the earlier), so `branchCohortSize` and
   `mergeRewardOfferExclusions` are gone, and a purchase publishes one price
   `context`, so the ledger's divergence and unknown-Twist faults are gone.
   An offer exclusion is the reached state's first failing gate:
   `allBranches`, the ranking and the editor's "Depending on earlier rolls"
   prefix are gone, and Draft notes every exclusion. Draft corpus unchanged.
   All Together sets are judged at one history; the per-history domains and
   the `branchDivergence` finding detail are gone.
   Then (2026-11-02, settlement internals): the walk state carries one
   optional `branch` (room action ends, the Overview cohort, target-history
   and Run State checkpoints and trait-child checkpoints likewise; a trait
   child recorded at a second state is a contract error); the producer
   frontier's constant `reachableBranchCount` is gone; a Well purchase and
   roll assess one state and the Well's pending roll lists that state's
   candidates; generated-pickup placements, the authored site, outgoing
   generation, the acquisition-point transition and the Contract pedestal
   pickup take one source state; the direct trait-set check reads one
   agreement state; and an offer exclusion takes one reason. The Echo replay
   source's `branchDivergence` reason is gone: a reached Echo replay without
   a last reward is a contract error (selecting Echo then is the offer's own
   finding; a probe over every suite and the equivalence corpus found none).
   A gold contact publishes one `context` from the reached state, so the
   seams' per-branch detection, divergent-prior and "settled in only some
   reached branches" faults are gone. Equivalence 157/157 after every commit.
   Then (2026-11-03, deeper layer): every lifecycle transition, offer
   processing (`processRewardOffer`, the generation cohort, exclusions),
   generation, site, role, Shop, pedestal and reached-offer settlement takes
   and returns one optional state; frontiers carry one `beforeEntry` /
   `beforeRole` state with one `realizedAcquisition` and Path context, and
   `selectedTraitOfferProducts` reads the one state. `branchList` /
   `singleBranch` are gone. Where settlement could still yield more than one
   state it throws: a Shop inventory with more than one generation witness.
   The Eris
   and Figurine/Arcana divergence throws, the pickup-maturity leak guard and
   the pending-Shop divergence fault are gone; an Artificer replacement keeps
   the one state that spent its use. A seam reaching an acquisition point
   requires the reached state (`reachedBranch`), so the Shrine delivery's
   `hermesDeliveryContextDisagreement` reason is gone; the clocked pickup's
   remaining unassessed case is `clockedPickupMaturityUnpublished` (the state
   matured the trait here, but no pickup frontier was published at that
   maturity). A gold gain publishes a reading or an unpriced reason by type,
   so the ledger's "no gold reading" fault is gone. Identifiers asserting
   agreement or plurality were renamed (`directTraitSetBranch`, `OfferGate`,
   `overviewEntry`); `RewardBranchState` and the `branch` field stay as the
   reached state's name. Equivalence 157/157 after every commit; Draft and
   run-import lanes deferred (no call sites changed). Performance against
   8c893ffce flat (second run: every metric within ±2 ms except Underworld
   rebuild +5.8 ms).
   Then (2026-11-03, leftovers): an Anvil, conversion and Hex capability reads
   its role's one recorded frontier (a probe over the engine and planner
   suites and the equivalence corpus found no role recorded twice; a second
   recording is a contract error), so the candidate's `branchCount` is gone;
   the unproduced `contractNotEquipped` exclusion is gone; a phantom exit
   publishes one optional drawn `offer` and execution reads it without the
   divergence check. The Hub board branch merged (native door order, policy
   `nativeDoorOrder`), and the equivalence baseline was re-recorded on the
   real single-state products without the shape adapters: validity unchanged
   everywhere, plans and candidates changed only by the Hub order.
   Then (2026-11-03, consumer lanes): Draft and run-import lanes pass
   unchanged; the Draft corpus at the pre-merge commit matched its baseline,
   and the re-recorded baseline differs only in Surface and Dream runs whose
   first change is Ephyra's Hub board door rewards (native order). The raw-run
   import measurement is unchanged. The planner's trait replacement reads the
   offer's one assessment.
   Remaining: test support keeps the list-returning
   `initializeTestRewardBranches` (about 25 call sites transform the list).
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
