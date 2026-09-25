# Trait offers: generation-time context and two minor legality corrections

## Status and objective

Locked 2026-09-24 after owner review; this is the execution contract. Base:
planner `7c39a536` with `docs/investigations/TRAIT_LEGALITY_PIPELINE.md`
committed alongside; executor `7a82446`, not touched by this plan. Inventory
the worktree before each gate and preserve unrelated edits.

Outcome: a trait offer is evaluated against the state the game generated it
from, refreshed only by the events that natively rebuild or invalidate it —
so the planner neither raises rarity nor admits Infusions the game cannot show
after a Chaos curse matures, and it does show them when a screen in the same
room has rebuilt the offer or an invalidation has deferred its generation to
the open. Two smaller legality rules are corrected alongside — Rejected
blocks a row only on three-option screens; Hades screens consume an Ordinary
charge — and the stale documentation statements are fixed at closure.

This is a correction of evaluation timing. The screen-construction model
(replacement/Hymn precedence, core seeding, priority seeds, rarity buckets,
draws, rescue, Duo entry, Fallback Gold) is faithful and does not change.

## Governing authorities and evidence

- AGENTS.md: ownership lanes, semantic commands, retained invalid state,
  fixture discipline, gate routine, documentation lifecycle.
- `docs/design/SIMULATION_AND_VALIDATION.md` (read in full before engine
  work), `docs/design/ROOM_LIFECYCLE_MODEL.md`, `docs/design/REWARD_MODEL.md`,
  `docs/design/AUTHORED_PROJECT_MODEL.md`.
- `docs/investigations/TRAIT_LEGALITY_PIPELINE.md`: native pipeline facts,
  discrepancies D1–D3, the D1 reachability census and the settled model shape
  with its citations. It is evidence for this plan, not authority.
- Audits under `docs/audits/rewards-and-acquisition/` own the promoted facts
  at closure.

## Source facts and chosen model

Native (cited in the investigation): a god loot's options are built by
`SetTraitsOnLoot` when the loot is created. Afterwards exactly four things
touch them. Closing any upgrade screen rebuilds every unopened loot in the
room immediately (`CloseUpgradeChoiceScreen`,
`UpgradeChoiceLogic.lua:1144-1153`). Three operations only delete the
options, which are then regenerated when the loot is opened
(`UpgradeChoiceLogic.lua:118-121`, recomputing rarity chances as well):
`AddRarityToTraits` (`TraitLogic.lua:3044-3050` — called on every Steady
Growth interval by `CheckChamberTraits` `:2919`, by the fountain-rarity
keepsake behind `HasRarifiableTraits`, and by Hera's supercharge inside its
screen), the Nemesis trade sale (`TradeDoExchange`, `TradeLogic.lua:191`; the
Purging Pool's `HandleSellChoiceSelection`, `SellTraitLogic.lua:327-329`,
does not), and the Embryo interval (`TraitLogic.lua:2935-2962`, run whether
or not a blessing exists to transform). Those are the only
run-reachable `UpgradeOptions = nil` sites; the remaining three
(`EventLogic.lua:650,657`, `InteractLogic.lua:722`) serve `SpawnAllLoot` and
`RespawnAfterUse`, reached only from `RoomDataTest.lua:213`. Level changes
never touch options (`AddStackToTraits`, `IncreaseTraitLevel`); trait
removal never does either (`RemoveTraitData`, so the Anvil and Echo's
consumed double-shop trait are silent). Ordinary rewards are
created at encounter end before `EndEncounterEffects` expires
encounter-counted curses; Fields cage rewards and World Shop items are
created at room entry. `EndEncounterEffects`, including `CheckChamberTraits`,
runs for every cage encounter (`RoomLogic.lua:2928` accepts the encounter
override), so in a multi-encounter room an invalidation after one encounter
can precede a silent curse maturation after a later one; the open then
regenerates with the later state. Curse maturation, essences and consumables
never touch a spawned offer. The pipeline has no weights and never denies a
god.

Chosen model, owner-settled:

- Anchor: each offer evaluates against the state at the lifecycle position
  where native builds its options. For an ordinary room reward that is the
  producing phase's `encounterCompleted` event, which the lifecycle appends
  immediately before `encounterEndEffectsApplied`
  (`simulation/lifecycle/execute.ts`, `recordEncounterCompletion`). For an
  offer with its own offer point (Fields cages, World Shop items, ship
  wheels) it is that offer's `offerPointMaterialized` event
  (`offer-lifecycle/fields-optional-materialization.ts`,
  `offer-lifecycle/shop-offer-point-materialized.ts`,
  `offer-lifecycle/reward-wheel-offer-point-materialized.ts`); a wheel's
  point precedes its own phase and follows the previous phase's deferred end
  effects (`declarations/lifecycles/ship.ts:14-17`, `execute.ts:405`), so
  no trait-relevant state separates it from native's spawn. Neither existing
  reward-identity event is the anchor: `rewardOffered` for an ordinary
  reward is emitted at `roomCreated` (`generation/room-created.ts`, from
  `history/compose.ts`), before the room is entered, and
  `targetRewardGenerationCheckpoint` reads the previous room's door-target
  generation. Both fix what the reward is, not what its options were built
  from.
- The engine has no screen event today. This plan adds exactly one, owner
  endorsed: a **trait offer screen completed** product, published exactly
  once per screen by its outermost settlement owner after the selected
  outcome, every child it settles, and the native-ordered charge consumption
  (Ordinary, Hymn, Yarn). `applyTraitOfferForAcquisition` returns a
  completion-capable result and never publishes on its own, because
  `settleEncounterTraitOffer` reaches it through three alternative call
  sites (`coordinator.ts:932,952,987`) ahead of its own additional effects: the
  publisher for encounter and NPC screens is `settleEncounterTraitOffer`'s
  final successful return, and for acquisition roles it is
  `applyProducerRoleHistory` (`rewards/acquisition/role-settlement.ts:487`)
  consuming that result. Every screen kind reaches those two owners: boon,
  hammer, Pom, Chaos (`chaosPair`, `traits/offers.ts:731`), NPC screens, and
  Fallback Gold, which native shows as a row in the same screen
  (`UpgradeChoiceLogic.lua:149-150`). Direct-child helpers never emit it;
  missing, invalid and blocked paths never emit it. Each other class below is
  a product returned by the transition that models its native contact, never
  an inference from which ledger kinds or equipped traits changed.
- Rebuild (immediate): the screen-completed product — natively every upgrade
  screen closes through `CloseUpgradeChoiceScreen`, which rebuilds every
  live loot in the room (`UpgradeChoiceLogic.lua:1144-1153`). Children stay
  inside the one product: the Concave Stone row (natively granted inside
  `HandleUpgradeChoiceSelection`, `UpgradeChoiceLogic.lua:1002-1023`, before
  the close), Circe's and Echo's `AcquireFunctionName` effects, and derived
  `levelMutation`s (Pom slot upgrade, natural selection, heroic promotion).
  Every unopened offer in the room re-anchors to the completed state and
  clears its stale mark.
- Invalidate (deferred): the Steady Growth interval reaching its count
  (engine `steadyGrowthProgress` with the reset; natively `CheckChamberTraits`
  calls `AddRarityToTraits` whenever `RoomsPerUpgrade.Rarity` fires,
  `TraitLogic.lua:2919`, and that function nils options unconditionally,
  `:3044-3050` — with or without a promotable target); the Embryo interval
  reaching its count (engine `advanceTranscendentEmbryoProgress` reached;
  natively the loot loop runs under `transformBlessing`, outside `if
oldBlessing`, `:2935-2962` — with or without a blessing to transform); the
  fountain-rarity keepsake (`rarityMutation` role `fountainRarity`; natively
  gated by `HasRarifiableTraits`, `InteractLogic.lua:769-773`, so it fires
  only with a promotion); and the Nemesis trade sale (`traitRemoval` role
  `nemesisTraitTrade`; `TradeDoExchange`, `TradeLogic.lua:191`). The Purging
  Pool sale (`purgingPoolSale`) is silent: `HandleSellChoiceSelection`
  (`SellTraitLogic.lua:327-329`) only removes the trait and pays. A stale
  offer's context becomes the state at the next rebuild in the room or at
  its open, whichever comes first; regeneration at open recomputes rarity
  chances too (`SetTraitsOnLoot` calls `GetRarityChances`,
  `TraitLogic.lua:1776`). The distinction is observable: Steady Growth after
  cage 1, Creation maturing after cage 2, then the open — native and the
  model both show Creation's elements; an immediate refresh would not.
- Silent: everything else, including these ledger checkpoints —
  `levelMutation` outside a completed screen, `elementContribution`
  (essences, `ElementalBoost`),
  `directTraitGrant`, `rarityBlock`, curse-expiry blessings, `traitRemoval`
  with roles `experimentalHammerExpiry` and `jeweledPomCleanup`,
  `chaosClock`, consumables, Death Defiance uses. `anvilTransformation` is
  silent: `ChaosHammerUpgrade` (`TraitLogic.lua:2573`) only calls
  `RemoveWeaponTrait`, `AddTraitToHero` and `InvalidateCheckpoint`, which is
  the save checkpoint (`RunLogic.lua:2698`), not a loot invalidation.
  `traitRemoval` role `echoShopDuplicateConsumed` is silent:
  `UseHeroTraitsWithValue` (`TraitLogic.lua:430`) ends in `RemoveTraitData`.
  The duplicate loot itself is created by `RemoveStoreItem` from `UseLoot`
  (`InteractLogic.lua:649`, `StoreLogic.lua:361-370`) before the source
  boon's screen opens and is rebuilt at that screen's close, so its context
  is the post-source-screen state. The engine already places the creation
  contact correctly and the rebuild not at all: `materializeShopGold`
  (`shop/settlement.ts:403,655`) captures `execution.candidate` before
  `settleOffer` (`:204`, called at `:679`) settles the source purchase's
  screen through `settleOwnedAcquisitionSite`, so `sourceTraitHistory` is the
  pre-purchase state, and the duplicate entry (`:444`) later settles against
  that frozen history unless a Pom target disappeared (`:549-575`). Under this
  plan the duplicate is a pending unopened offer from its materialization and
  the source screen's completion product re-anchors it; the duplicate-only
  `sourceTraitHistory` / `sourcePomEligibleTraitKeys` freeze is retired as
  superseded. Additions of boons are always screens and need no class of
  their own.
- Native's open-time `StackOnly` check (`CreateBoonLootButtons`,
  `UpgradeChoiceLogic.lua:122-131`: regenerate a Pom whose stored targets are
  no longer all held) has no reachable trigger in the modeled game once the
  Echo duplicate re-anchors at its source's completion. Echo boons are in no
  `LootData` or `FieldLootData` `TraitIndex` (`IsGodTrait` false,
  `TraitLogic.lua:1547-1560`), so consuming Gold Gold Gold strands nothing;
  hammers are not Pom targets; Jeweled Pom cleanup and Pool sales occur in
  postboss rooms without loot; the Nemesis trade invalidates. The engine's
  only copy of the rule (`sourcePomEligibleTraitKeys`, `state/model.ts:47`;
  `shop/settlement.ts:549-575`) guarded the pre-purchase freeze and is
  deleted with it; no general open-time check is added. Reward Reward Reward
  (`EchoLastReward`, `EventLogic.lua:1537`) creates its copy of the last
  reward inside the Echo screen's selection and that screen's close rebuilds
  it, so its creation contact is the Echo screen's completion: fresh
  context, never stale.
- Rarity rides the same anchor: held `RarityBonus` traits at the offer's
  context; temporary bonuses consumed at the offer's settlement as today.
- Nectar-gift respawns are meta-progression and stay unmodeled. Rejected
  (D2) blocks a row only when the screen has three options: blocked rows are
  the options beyond `CalcNumLootChoices`, which is the three-row maximum
  less one under `RestrictBoonChoices` (`TraitLogic.lua:1746-1754`,
  `UpgradeChoiceLogic.lua:153-162`). Hades screens (D3) are shop-aware in
  `FieldLootData` (`RunData.lua:556-569`): forced Common, consume an Ordinary
  charge, exempt from Rejected only.

No authored schema change: the offer's context and stale mark are simulation
state, never persisted. No execution protocol change: published offers are
the authored choices; only their legality assessment moves. The application
does not change: it consumes the same candidate domains and findings.

## Gate A — Minor legality corrections

### Deliverables

- Rejected: block a row only on a three-option screen
  (`packages/planner-engine/src/simulation/traits/offers.ts`, the composition
  rule and its candidate mirror). A one- or two-option screen under Rejected
  is fully selectable and completable.
- Hades screens advance the Ordinary clock: `advanceChaosClock(...,
'godBoonScreens')` in
  `simulation/rewards/trait-settlement/coordinator.ts:121` currently skips
  rarity-less givers through `isChaosGodScreenGiver`; a Hades screen counts.
  Express the fact as a catalog giver declaration (shop-aware /
  forced-Common giver), not a giver-name test; keep the Rejected exemption.
- Flip the pinned expectation at
  `packages/planner-engine/test/simulation/chaos-traits.test.ts:1298`
  (two-option block) to the native rule with a comment stating it.

### Ownership and acceptance

Engine owns both rules and their candidate mirrors; catalog owns the giver
fact. Witnesses: Rejected on one-, two- and three-option screens (block only
on three); a Hades screen consuming the last Ordinary charge so the next god
screen is unrestricted; Ordinary clock unchanged for genuinely rarity-less
non-shop givers. Run engine and catalog lanes plus typecheck. Measure the
golden fixtures: re-pin only findings that trace to the corrected rules.

Commit boundary: the two rule corrections and their tests.

## Gate B — Generation-time offer context

### Deliverables

- Inventory first (report before implementing): every reward kind that can
  carry a trait offer and the chronology event holding its
  options-generation position (`encounterCompleted` of the producing phase
  for ordinary rewards; `offerPointMaterialized` for cages, shop items and
  wheels), including any kind the two classes above do not cover — Devotion's
  initial pair versus its post-combat spurned reward, the Mystery Box's
  unwrap-time god loot, Hermes deliveries, Travel Deal refills and Echo
  duplicates each named with their engine event; every consumer of the
  single `evaluation.state` in `traits/offers.ts` and the coordinator,
  classified as generation-time or current-state input; and the products
  end effects return for the Steady Growth interval (`steadyGrowthProgress`
  reset) and the Embryo interval (`advanceTranscendentEmbryoProgress`
  reached), plus the fountain-use and Nemesis-trade settlement products.
- Catalog: no new declarations expected. Fields cage rewards (main and
  optional) and World Shop items keep their room-entry generation. Which
  interval effects invalidate offers is a closed engine rule over the
  existing disposition kinds — rarity upgrade and blessing transform do;
  stacks, mana, health and resource drops do not (`CheckChamberTraits`) —
  carried on the Steady Growth and Embryo declarations only if the engine
  cannot state it from the disposition kind. Add a generation declaration
  only where the inventory shows a trait-carrying reward whose creation
  contact the engine does not emit.
- Engine: the simulation state records, per spawned-unopened offer, its
  generation context and a stale mark. The context is a reference to the
  immutable branch substate that offer generation reads (trait history,
  keepsakes, Chaos state, room rarity override — the inventory fixes the
  exact read-set), captured at the offer's options-generation position; not
  a history sequence (same-sequence branches differ) and not a copy of the
  whole `SimulationState`. It participates in `equivalentBranchStateKey`
  (`rewards/branch-primitives.ts:86`) and candidate deduplication: equal live
  equipment with different prepared contexts or stale marks must not merge.
  The screen-completed product re-anchors every unopened offer in the room
  and clears stale marks; an invalidation product sets the stale mark on
  every unopened offer in the room; at open, a stale offer's context is the
  open-time state. `evaluateReachedTraitOffer` (called from
  `trait-settlement/coordinator.ts` ~:297 with `branch.state`) receives the
  prepared or open-time context for identity eligibility, base rarity and
  replacement; screen-open restrictions (Rejected), Denial, Calling Card,
  level and keepsake calculations, selected targets, charge consumption and
  the history append in `recordReachedTraitOffer` keep the current state, so
  intervening history is never discarded. Owners:
  `simulation/rewards/biome/offer-lifecycle/`, the biome chronology,
  `lifecycle-transitions/encounter-end-effects.ts` for the two interval
  products, `fountain-used.ts` and the Nemesis settlement for theirs, the
  trait-settlement coordinator for the screen-completed product and for
  consumption, and `shop/settlement.ts` for registering the Echo duplicate
  as a pending offer at `materializeShopGold` and retiring its frozen
  source-history path together with `sourcePomEligibleTraitKeys`.
- Rebuild and invalidation are typed products returned by the transitions
  that own the native contacts — end effects for the two intervals, fountain
  use, Nemesis trade settlement, and the outer completion of a trait-offer
  settlement — as one closed union, so an unclassified source fails to
  compile. They are never inferred from ledger checkpoint kinds, from
  `replaceSimulationTraitHistory`, or from equipped-trait diffs, and the
  Steady Growth and Embryo products fire on the interval whether or not the
  outcome changed a trait. No room-name or biome conditionals anywhere in
  the fold.
- Findings and candidate domains keep their shapes; only their content moves.
  Retained authored offers that become context-invalid surface the existing
  trait findings and repair through the existing commands (no rewrite on
  load).

### Ownership and acceptance

Engine owns the context, the stale mark, their refresh and consumption;
catalog owns only a declaration the inventory proves necessary; no
application or executor change (verify: `apps/planner` diff empty;
execution fixtures byte-stable unless an authored fixture offer genuinely
moves, reported before regeneration).

Witnesses (engine, product-level, no re-implemented rules in helpers):

- Fields, curse maturing on the first cage encounter, cages magick + boon:
  boon evaluates without the blessing (no rebuild, no invalidation).
- Same room, cages hammer + boon, hammer taken first: boon evaluates with the
  blessing (rebuild at the hammer screen).
- Fields, Steady Growth firing at cage 1's end, Creation maturing at cage 2's
  end, boon opened last: boon evaluates with Creation's elements (deferred
  regeneration at open).
- Same sequence with a Pom taken between cage 2 and the boon: the Pom screen
  rebuilds; the boon evaluates with the elements (rebuild clears the mark).
- Ordinary combat room, curse maturing on its encounter: the boon evaluates
  without the blessing; the next room's boon with it.
- O ship: wheel-2 boon after a consumable wheel-1 reward and a curse maturing
  on encounter 1 evaluates with the blessing (own generation after the silent
  change).
- Dream World Shop: essence bought before the shop boon, with and without the
  random-stack consumable in between — no new Infusion (silent events).
- Rarity: a `RarityBonus` blessing maturing after generation does not raise
  the offer's rarity; a rebuild after maturation does.
- Retained invalid state: a saved offer that is context-invalid under the
  new anchor surfaces its finding and repairs via `ReplaceTraitOffer`.
- Product infrastructure: a Pom screen and a Fallback Gold screen each
  publish one completion and rebuild a waiting boon; a screen with a Concave
  Stone row or an NPC child effect publishes exactly one completion, after
  its Ordinary/Hymn charge is consumed, and the waiting boon re-anchors once;
  a Steady Growth interval with no promotable trait and an Embryo interval
  with no blessing each mark waiting offers stale; two branches with
  identical equipped traits but different prepared contexts or stale marks
  stay distinct through merge and candidate deduplication; acquiring from an
  older prepared context leaves every intervening ledger event in the
  current history.
- Echo duplicate: a duplicated god boon evaluates against the
  post-source-screen state — the boon just bought is excluded and its
  prerequisites are visible; a duplicated Pom targets the source screen's
  outcome; a source screen left incomplete publishes no completion, so the
  duplicate keeps its creation context and surfaces the existing findings.
- Echo duplicate Pom target refresh: buy a Pom with Gold Gold Gold (the
  duplicate copies the purchased loot's own name, `StoreLogic.lua:366`), leave
  the duplicate Pom waiting, buy a boon that replaces a held boon and
  complete that screen, then open the duplicate Pom: its targets exclude the
  replaced trait and include its replacement (the completion re-anchor
  covers what the deleted `sourceTargetDisappeared` rule guarded). Reward
  Reward Reward: the copied boon reward evaluates against the
  post-Echo-screen state.

Blast radius: measure on the golden fixtures and the checkpoint corpus
before pinning; expect movement only where a curse matures on a reward
encounter, in Dream shops with essences, in multi-screen rooms, at Steady
Growth and Embryo intervals, and for Echo duplicates once their frozen
source history is retired. Trace
every re-pin to the corrected anchor; never normalize a difference away.
State-baseline counts explained if moved. Run engine, catalog and the
application lanes that consume trait findings; no full check mid-gate.

Commit boundary: the context model, declarations, tests and any traced
re-pins.

## Gate C — Closure

Independent review after both gates stabilize, then one full
`npm run check` and one same-host `npm run test:performance:compare`, because
retained contexts and the branch key grow state; explain any retained-state
growth and show obsolete prepared records disappear at open, room exit and
retirement. Promote: the generation-time rule, the rebuild/invalidate
classes and deferred regeneration into `docs/design/REWARD_MODEL.md`
(replacing its inconsistent spawn-time / pickup-time statements at `:1018`
and `:1164`), the native pipeline facts and reachability census into the
acquisition and composition audits (fixing the stale statements the
investigation lists under Documentation-only: `RestrictBoonChoices` "has no
modeled supplier", the one-row block presented as universal, Pom as the sole
regenerated offer, and evaluation at pickup), and the Hades/Rejected facts
into the Chaos audit. Delete this plan
and `TRAIT_LEGALITY_PIPELINE.md`; keep only genuine unresolved evidence in
its owning audit. No bug-changelog paragraphs.

Live acceptance (owner-confirmed, recorded in a checklist that survives
automated closure): Fields curse-maturation pair (magick then boon:
pre-blessing; hammer then boon: post-blessing); the Steady Growth then
Creation cage sequence; an ordinary room's boon after a curse matures on its
encounter; a Hades screen consuming the last Ordinary charge; a two-option
screen under Rejected fully selectable; Dream shop essence before the shop
boon.

Commit boundary: closure documentation. No push without an explicit request.

## Delivery discipline and exclusions

For each gate, main inventories the worktree, locks a focused packet, uses
one write-capable executor and a fresh independent reviewer after
stabilization, then one bounded remediation pass. Main owns Git and the
final bird's-eye review.

Excluded: any change to screen construction, weights (none exist natively),
denial (never occurs natively), authored schema, execution protocol, the
application, the executor's trait installation, Nectar-gift respawn
modeling, and any progression-flag census. Echo's and Selene's selection
algorithms stay unchanged; their creation and completion contacts (the Echo
duplicate — the engine's shop Gold materialization — and Echo screens) are
in scope. No new spawn-timing
declarations except where the Gate B inventory shows a trait-carrying reward
whose creation contact the engine does not emit — then add that contact,
reported before implementation. Each engine addition must name the native
contact it models and the event class it belongs to.
