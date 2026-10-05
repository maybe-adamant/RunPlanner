# Anvil result on the reward

Status: locked 2026-10-05. Base: `2affd01c`. Schema bump 91 → 92 approved by
the project owner on 2026-10-05.

## Objective

The reward owns its pickup effect. An Anvil of Fates result is authored on the
reward that carries the Anvil, wherever that reward is settled: a World Shop
slot today, and the Gold Gold Gold duplicate of an Anvil purchase. Shop versus
pickup is a settlement difference, not an ownership difference.

## Facts

- Gold Gold Gold (`EchoDoubleShop`, `DuplicateWorldShopItem`) duplicates the
  first World Shop purchase except `SpellDrop` by spawning the same item as a
  pickup (`StoreLogic.lua:361-372`). A duplicated `ChaosWeaponUpgrade` is a
  second Anvil use with its own result.
- The catalog declares the pickup effect on the acquisition
  (`declarations/rewards/acquisitions.ts`), and role settlement already reads
  an Anvil result from any acquisition source
  (`simulation/rewards/acquisition/role-settlement.ts`). Only the authored
  storage (`ShopOfferState.anvilResult`) and the command
  (`ReplaceAnvilResult` on a `ShopOfferAddress`) are Shop-specific.
- Anvil of Fates is the only declared pickup effect. Obol Card and Nightmare
  duplicates need no extra authoring and already settle.

## Defect fixed first

Shop settlement records an explained entry failure for an acquisition-resolved
Gold duplicate but not for an owned-site duplicate
(`simulation/rewards/shop/settlement.ts`, owned-site branch). A failing owned
duplicate therefore adds the site-level `shopPurchaseUnavailable`
(`jointPurchaseOrder`) fallback, which has no workspace destination and throws
in projection. The owned-site branch records the failure when its settlement
emits findings, like the acquisition-resolved branch.

## Schema 92

- `AuthoredRewardState` gains the pickup-effect result keyed by acquisition
  role, beside `levelResolutionsByAcquisitionRole` (name chosen in gate 2;
  for example `anvilResultsByAcquisitionRole`). `ShopOfferState.anvilResult`
  is removed.
- Codec: a result is present exactly for roles whose concrete acquisition
  declares the Anvil pickup effect (null while unauthored), and absent
  otherwise, for every reward-state owner that can carry an Anvil.
- `ReplaceAnvilResult` addresses the acquisition role, not the Shop slot.
  Replacing the reward with a non-Anvil offer drops the result, as today.
- Migration `project-91-to-92`: move each Shop offer's `anvilResult` onto its
  reward's Anvil role; Gold duplicates of Anvil purchases gain a null result.
- Simulation passes the reward's result into role settlement for both the Shop
  slot and the Gold duplicate. The duplicate is assessed after the first Anvil.

## Execution

The Shop purchase transaction already carries the Anvil transformation. The
Gold duplicate pickup transaction carries its own transformation the same way.
If that changes protocol shape or module handling, gate 3 updates the decoder,
the Anvil transformation, Lua witnesses and the affected fixtures.

## Gates

1. `fix(engine): explain an owned Gold duplicate failure at its entry` — the
   settlement defect with an engine witness using a Gold duplicate of an Anvil
   purchase without a result: findings stay on the duplicate's entry or role,
   no site-level fallback; a workspace projection witness does not throw.
2. `feat(engine): own the Anvil result on the reward` — schema 92, codec,
   command, simulation, execution assembly, migration and loader test,
   fixtures, equivalence baseline (Anvil entries only).
3. `feat(game-module): …` — only if gate 2 changes what the module receives.
4. `feat(planner): author the Anvil result on any Anvil reward` — the Anvil
   result editor binds to the role address and appears on the Gold duplicate.
5. Closure: AUTHORED_PROJECT_MODEL, REWARD_MODEL, the acquisition audit's Gold
   Gold Gold disposition, live checklist entry; delete this plan.

## Non-goals

Other pickup effects, Gold Gold Gold eligibility changes, Spell exclusion
changes.
