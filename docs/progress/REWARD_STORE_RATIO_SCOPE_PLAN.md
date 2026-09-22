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

Saved-project policy: previously valid authored routes that become
context-invalid under the corrected controller surface the existing
`baseRewardStoreUnavailable` finding and are repaired by re-picking the store,
like every other support rule. No advisory-only special case and no automatic
rewrite of authored state.

No probability analysis or RNG replay (the documented support-only boundary
stands). No new counted fact outside the existing ledger. No authoring schema
or execution protocol change expected; stop and amend if one appears.

## Delivery

The Gate A entry measurement was executed at base `71a93d6d` and stopped the
original single-slice shape on both of its triggers: the census contradicts
native beyond individual corrections (I, Q and `C_Boss01` under-count, plus
`I_Story01`), and the filter removal alone flips all three golden route
families invalid at their second biome's first batch, with a self-referential
fixture migration (each re-authored store moves the ratio for every later
batch). The gate is therefore split.

### Gate A1 — Census corrections under the current scope

Deliverable one, requiring explicit user sign-off before any correction
lands: a complete per-room enumeration of every catalog room — declared
`enteredRewardStoreHistory`, the native count verdict with its exact source
citation, and correction required or not. No sampling; every room, every
biome, boss/preboss/postboss/miniboss/story/shop/special rooms included.

After sign-off, one slice under the existing per-biome scope so fixtures
barely move: the signed-off declaration corrections, the per-encounter ship
counting kind with its catalog declarations, and the consolidation of the two
same-named `enteredStoreKey` helpers (`history/lifecycleInput.ts:22` and
`reward-store-support.ts:16`, swapped argument orders) onto one owner.
Primary tests beside the ledger and store-support owners.

### Gate A2 — Filter removal and sequential fixture re-authoring

Only after A1 lands: remove the per-biome filter (no scope parameter), re-run
the fixture-migration measurement against the corrected census, and re-author
the golden fixture builders sequentially under the run-scoped controller —
each batch store chosen legal given the entries before it. Re-pin
`baseRewardStoreUnavailable` and candidate-domain expectations traced to the
corrected scope; repair the two fixture builders that throw; state-baseline
counts explained if moved; fixture JSON regenerated only where a semantic
product genuinely moved, reported first. Add the Dream reorder witness
(guardrail 7).

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
