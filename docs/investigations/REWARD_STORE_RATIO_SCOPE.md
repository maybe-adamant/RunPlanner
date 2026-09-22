# Reward-store ratio scope and reordered itineraries

## Question

The planner's reward-store support model evaluates the native Major/Minor
controller with a per-biome entered-store count. Native counts the whole run.
Is the biome scoping a deliberate simplification or a defect — and do the
declaration-level simplifications for H/I/Q/N hold when Dream Dives play
biomes out of canonical order?

## Established facts (native, 2026-09-22)

Scripts: `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.

- `ChooseNextRewardStore` (`RoomLogic.lua:3847-3869`): `chance = T + 10·(T − C)`
  with `T` from `run.TargetMetaRewardsRatio` or the current room (biome base
  blocks: F 0.315, G 0.35, H 0.0, I 0.25, O 0.30, P 0.20, Q 0.15; N falls to
  the Hero default 0.45), `C` from `CalcMetaProgressRatio`.
  `Hero.TargetMetaRewardsAdjustSpeed = 10` (`HeroData.lua:72`), unmodified
  anywhere. `RandomChance` does not clamp; `chance >= 1` is always
  MetaProgress and `chance <= 0` effectively always RunProgress.
- `CalcMetaProgressRatio` (`RewardLogic.lua:469-489`) counts **entered** rooms
  over the whole `run.RoomHistory` plus the current room; one count per
  encounter carrying a `RewardStoreName` (multi-wheel ship rooms contribute
  more than one), else one per room with a chosen reward and store. Returns
  `nil` before anything is counted, which makes `chance = T` exactly.
  Exclusions by declaration: the entire N hub (`BaseN`, `BaseN_SubRooms`) and
  `F_Boss01`/`F_Boss02` (`IgnoreForRewardStoreCount`).
- Consequences: the free window is always exactly 0.1 wide; saturation is the
  common case; counted rooms 1 and 2 of any counting window are forced on
  every reachable path; H's target 0.0 forces RunProgress at every H door.
- Forced stores (`ForcedRewardStore`) count into `C` without a roll; a
  per-door forced override also leaks onto later doors of the same unlock loop
  through a shared local (`RoomLogic.lua:3921-3926`).
- Dream Dives run this controller unmodified: `DreamRunLogic.lua` sets no
  ratio override and no bounty linkage. `TargetMetaRewardsRatio = 0`
  (always-RunProgress) is packaged-bounty-only (`BountyData.lua:55`).

## Established facts (planner)

- The support-only model exists and is documented as a deliberate
  simplification ("preserve only possible and forced RunProgress/MetaProgress
  support", F/G/O rule tables): `simulation/rewards/biome/reward-store-support.ts`
  implements the same formula and threshold partition, feeding
  `supportStoreKeys`, `selectedPossible` and `baseRewardStoreUnavailable`,
  consumed by validation and candidates.
- The entered-store count is filtered to the current biome
  (`reward-store-support.ts:71-73`). No document records that scope; G's rules
  describe store provenance as retained "for future entered-room ratio
  history" without a biome bound.
- H/I/Q batches deliberately carry no Run/Meta base store; their store
  behavior is declaration-owned (H min/max cage model and Preboss RunProgress;
  I `TartarusRewards` provenance and per-room forced stores; Q rewardless
  combats and forced miniboss stores). N is inert natively (whole-hub count
  exclusion). All documented in the biome rules.
- Divergence surface under canonical routes: G and P early batches (their
  native count carries the predecessor biome's history; F is the run start; O
  follows the excluded N hub, so its window is nearly biome-local anyway).

## Open questions

1. Is the per-biome count scope a deliberate planner boundary? Nothing in the
   docs or code claims it; git history not yet examined.
2. Dream reordering: when H (always-RunProgress, still counted) or I/Q
   (declaration-owned stores, still counted natively?) precede a
   controller-consuming biome in a Dream itinerary, native's run-wide `C`
   differs sharply from the planner's per-biome window. Which Dream orders are
   legal, and what do H/I/Q rooms contribute to `C` natively (their forced and
   declaration stores count like any entered room)?
3. Do the H/I/Q declaration simplifications themselves remain observably
   correct out of order — i.e. is any of their door behavior secretly
   ratio-dependent rather than declaration-forced?
4. Ship rooms count once per encounter natively; the planner's ledger counts
   per room. Matters only where the controller is consumed.
5. If the scope is corrected to run-wide, native exclusions (N hub, F bosses)
   must be reproduced, and the finding/fixture impact at G/P batches (and any
   Dream case) needs measurement before locking a plan.

## Current disposition

None. Deliberately parked before any decision: canonical-route divergence is
bounded (G/P early batches), the Dream interaction is unassessed, and the fix
would move a validation surface. Next step when resumed: answer questions 1-3,
then choose between a run-wide-scope correction plan and documenting the
per-biome boundary as a chosen simplification.
