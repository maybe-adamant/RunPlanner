# Run-Scoped Reward-Store Ratio and the O Pair Relation

Status: approved and locked; implementation not started.
Base: `0c6655c7`.

## Objective

Make the reward-store support controller read the same history the game reads:
one run-wide entered-store ratio, fed by every biome, with native's exact
exclusions and counting granularity. Then present O's door-store pair relation
truthfully: a read-only inherited store where the ship wheel decided it, the
existing selector and forced-store surfaces everywhere else.

Room legality is out of scope and unchanged: eligibility owns which rooms may
align; this plan owns only the pair reward relation between a decision's store
policy and its target's store ownership.

## Evidence

`docs/investigations/REWARD_STORE_RATIO_SCOPE.md` records the native
controller (`chance = 11T − 10C`, `AdjustSpeed = 10`, no clamp, saturation as
the common case, H always RunProgress), the count definition
(`CalcMetaProgressRatio` over the whole `run.RoomHistory`, one count per
encounter carrying a store, else one per room with a chosen reward and store),
the exclusions (`IgnoreForRewardStoreCount` on the N hub bases and
`F_Boss01`/`F_Boss02` only — G and later bosses are structurally identical and
unflagged, a game-data inconsistency we mirror, not rationalize), and that
Dream Dives run the controller unmodified over reordered itineraries.

Planner state: `reward-store-support.ts` already implements the formula,
partition, findings and candidate bounds; its only scope defect is the
per-biome filter on `enteredRewardStores` (`:71-73`), which is documented
nowhere as intended. The count census is already declaration-owned through
`enteredRewardStoreHistory` on every room in every biome, including
`F_Boss01/02: none` and the whole N hub; O ships declare `none`, which under-
counts native's per-encounter wheel contributions. H/I/Q batches deliberately
carry no authored base store (their biome rules stand unchanged); their
entered rooms still count natively.

Real O pair relation (all O decisions are single-door):

| Source policy → target ownership                           | Surface                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| any → ship combat / Story / Shop / Preboss (no door store) | none                                                              |
| any → Miniboss / Devotion (declaration-forced RunProgress) | existing forced-store presentation                                |
| sourceOfferPoint (ship) → Fountain (two-store counted)     | read-only inherited store with a wheel link — the one new product |
| authoredBaseStore (non-ship) → Fountain                    | existing selector, bounded by run-scoped support                  |

## Accepted Shape and Guardrails

1. The support ratio consumes the run-wide `enteredRewardStores` ledger.
   Remove the biome filter; do not add a scope parameter that lets a consumer
   choose a window.
2. Counting stays declaration-owned. Verify every biome's
   `enteredRewardStoreHistory` declarations against the native predicate
   (`ChosenRewardType` and `RewardStoreName` both present, `Ignore` flags
   honored); correct individual declarations only with the source citation in
   the audit. Whether a `ForcedReward` boss room natively receives a
   `RewardStoreName` (G and later bosses) must be established from source
   before their declarations are judged.
3. Ship rooms count once per active wheel encounter, as native counts
   encounters. Model this as a declaration-owned history kind, not a
   room-name special case in the fold.
4. H/I/Q gain no authored store controls and no batch policy changes; their
   biome rules stand. Their contribution is count-only.
5. The O read-only inherited-store row is a projection of the same authored
   resolution the commands use (`sourceOfferPointStoreKey`), never a second
   derivation; it links to the owning wheel control. Forced-store and selector
   rows reuse the existing presentations unchanged.
6. Support findings and candidate domains move where the corrected ratio
   moves them. Measure the delta on the golden fixtures before asserting new
   expectations; never normalize a difference away without tracing it to the
   corrected scope.
7. Dream itineraries must witness the order-independence: the same rooms in a
   reordered itinerary produce the same run-wide count.

No probability analysis or RNG replay (the documented support-only boundary
stands). No new counted fact outside the existing ledger. No authoring schema
or execution protocol change expected; stop and amend if one appears.

## Delivery

### Gate A — Run-scoped counting

Entry requirement, accepted before any landing: verify declarations per
guardrail 2 (including the G-boss predicate question) and the exact ledger
write/read symbols, then apply the filter removal in a scratch state, run the
engine suite once, and produce a fixture-migration inventory — exactly which
golden-fixture batch stores flip per route family, and which failures are
fixture-induced versus genuinely re-pinned expectations. The inventory is the
scope check: a bounded mechanical migration proceeds; broad route-validity
flips stop the gate for a plan amendment.

Then one slice: filter removal, the per-encounter ship counting kind with its
catalog declarations, any individually corrected declarations, and the golden
fixture builders re-authored to run-scope-legal stores in the same commit,
with the inventory as the audit trail so review can distinguish moved policy
from weakened assertions. Primary tests with the store-support suite; measure
and re-pin `baseRewardStoreUnavailable` and candidate-domain expectations at
F/G/O/P batches; state-baseline counts explained if moved; fixture JSON
unchanged unless a semantic product genuinely moved, reported before
regeneration. Add the Dream reorder witness (guardrail 7).

### Gate B — O pair-relation presentation

The inherited-store row on `sourceOfferPoint` decisions with its wheel link,
witnessed through the workspace products for each row of the pair table
(reusing the existing forced-store and selector witnesses where they already
exist). No engine change expected in this gate.

### Gate C — Closure

Independent review after the slices stabilize; one full `npm run check`;
promote the controller math, count census, exclusion inconsistency (F bosses
flagged, G+ bosses not) and the per-encounter fact into
`docs/audits/rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md`; revise the
affected biome-rule store paragraphs only where their explanation is now
inaccurate; delete this plan and
`docs/investigations/REWARD_STORE_RATIO_SCOPE.md`.

## Audit-Against and Non-Goals

- No per-biome ratio window survives anywhere, including caches and candidate
  paths.
- No G/preboss/room-name conditionals in the fold; declarations select
  behavior.
- No store selector appears on ship decisions; no read-only row appears where
  a selector belongs.
- H/I/Q authoring surfaces are byte-identical before and after.
- The plan does not decide Fountain reachability; eligibility already owns it.
