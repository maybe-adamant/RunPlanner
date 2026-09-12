# Fields cage Forfeit correction

## Contract and status

Locked for the user-requested planner correction. Planner base: `af60cf0a`.
The executor hook-correction plan and its uncommitted A1 draft remain paused.
This change does not edit the game module.

The user confirmed in game that a particular Fields cage contains the onion
before pickup. Native `SpawnRewardCages` iterates `room.CageRewards` in order,
calling `SpawnRoomReward` for each. Its Boon/Hermes branches call
`CheckBoonSkipShrineUpgrade`, which consumes the single per-biome use during
spawn. Picking another cage first does not move that substitution.

## Outcome and ownership

Keep the authored cage offer and its counted bag/source identity. When the
selected Fields room is entered, fix the first qualifying active cage's
physical reward to Red Onion if Forfeit is still available. Its later pickup
uses that fixed outcome; all other cages retain their actual rewards regardless
of pickup order. Do not offer Onion as a freely selectable RunProgress reward.

Engine simulation owns the substitution, retained source identity, counter,
acquisition and candidate products. Existing application reward controls consume
the engine's realized-acquisition product. Catalog declarations already describe
Forfeit's one use and qualifying types. No new persisted field, schema version,
execution protocol or UI-specific semantic rule is intended.

Authorities: `SIMULATION_AND_VALIDATION.md` (chronology, settlement handoffs,
branch equivalence), `REWARD_MODEL.md` (offers versus concrete acquisitions and
Forfeit), `H_GAME_RULES.md` (cage generation versus entry/pickup), and the
Forfeit section of `TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`.

## One correction slice

- Leave bag generation in `generation/local-generation.ts` at `roomCreated`;
  offered but unentered sibling rooms must not spend Forfeit.
- Fix the active cage outcomes in `lifecycle-transitions/room-entered.ts`
  before entry Run State capture. Use canonical cage order, not timeline order.
- Reuse owner-addressed `rewardForfeited` evidence to carry the fixed outcome
  into acquisition settlement. If later settlement reads it, branch equivalence
  must distinguish that semantic owner/outcome; do not key all diagnostic
  history or add a second substitution ledger without a demonstrated need.
- `acquisition/role-settlement.ts` must settle that already-fixed Onion through
  its existing concrete-acquisition/Time Piece/Sea Star path without consuming
  Forfeit again or requiring a boon trait selection. Ordinary incoming,
  Artificer, and Ship substitution behavior remains unchanged.
- Move the existing Fields Olympian-provider materialization contact out of
  offered-room generation into the same entered-room traversal. Only a real
  spawned boon consumes it; the Onion does not invoke native GiveLoot.
- Retain complete realized-acquisition frontiers for the editor and repair
  queries. Correct the cage acquisition-point key mismatch (`cages:` versus
  `localReward:cages:`) if required by this reached-cage path, without widening
  into a candidate-system refactor.
- Existing stored boon choices remain representable when their cage becomes
  Onion; they are dormant, not deleted. Earlier reward/loadout changes rebuild
  the substitution from scratch.

Do not infer Forfeit from `acquisitionEnabled`: that field controls an incoming
producer lifecycle, not a physical Onion substitution. Execution-plan assembly
remains a consumer of engine outcomes, not a place to repair this rule.

## Acceptance and review

Primary matrix owner: `test/simulation/forfeit-room-rewards.test.ts`, using the
existing Fields fixture builders and real simulation/commands. Cover one
coherent Fields witness with ordered cage generation and reversed pickup:

- a nonqualifying first cage, then Boon/Hermes qualifying cages;
- entry consumes Forfeit and fixes the owner before any pickup;
- unentered sibling and inactive cages do not consume it;
- changing pickup order does not move the Onion or consume a second use;
- inactive/already-consumed Forfeit leaves real boons unchanged;
- Onion uses consumable history, no boon selection, and preserves offer/bag
  identity; retained authored trait choices do not block that pickup;
- representative existing reward-control projection shows Red Onion and keeps
  the later real boon editable, without a new React policy.

Add a narrow branch-equivalence witness for different fixed owners and retain
existing incoming/Ship/Artificer regression coverage rather than duplicating it.
Use focused correctness tests during implementation, then independent review
and one bounded remediation pass. Main session owns broad closure checks.

Update the durable Forfeit and H authorities, removing the blanket exclusion
of direct room-local rewards in favor of the exact native spawning path.
Delete this temporary plan at closure. Do not resume executor A1 until this
correction is settled; its physical reward proof must be reassessed separately.
