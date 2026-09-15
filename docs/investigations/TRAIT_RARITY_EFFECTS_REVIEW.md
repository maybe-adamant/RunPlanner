# Trait rarity effects: game/planner matrix

## Question and boundary

Which effects can change a generated, selected, directly granted or already
equipped trait's rarity, and does the planner preserve their native precedence?

Investigated on 2026-09-15 against the local game scripts at
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts` and the planner at
`034082eb` with the reviewed, uncommitted initial-offer Gate A replacement fix.
The amended initial-offer plan schedules C1/C2 in Gate B, C3 in Gate C and C4
in Gate D, before composition in Gate E. This document remains evidence, not
the implementation contract. Bridal's C5/C6 and BBB remain separate follow-ups.

This is an inventory of mechanisms and their important crossings, not a claim
that every combination has passed an in-game run. “Aligned” below means the
examined declarations and control flow agree. Executed probes are distinguished
from static traces. Echo Boon Boon Boon's rarity behavior is inventoried, but its
eligibility/composition redesign remains outside the initial-offer plan.

## The stages are not interchangeable

| Stage                   | Native authority                                                                       | Consequence for the planner                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and provider     | `HeroData.lua:170`; `RoomLogic.lua:GetRarityChances` at 2126                           | Choose the provider base and one contextual override before adding bonuses.                                                                                                  |
| Forced Common           | `RoomLogic.lua:IsRarityForcedCommon` at 2093; `TraitLogic.lua:SetTraitsOnLoot` at 1758 | Clears the chance table before normal generation. Not a negative contribution to that table.                                                                                 |
| Numeric contributions   | `RoomLogic.lua:GetRarityChances`                                                       | All additions first, then multipliers. Values above one are retained; this is not a normalized probability distribution.                                                     |
| Screen construction     | `TraitLogic.lua:SetTraitsOnLoot`, especially 1827–2026                                 | Priority identities roll within their own rarity support. Remaining positions roll against nonempty rarity buckets. Exact replacements and final rescue are separate stages. |
| In-menu Rarification    | `UpgradeChoiceLogic.lua:UpgradeMouseOverUpgradeChoice` at 1203                         | Acts on an existing row and consumes a specific keepsake source; does not reroll the ledger.                                                                                 |
| Selected acquisition    | `UpgradeChoiceLogic.lua:HandleUpgradeChoiceSelection`; direct grant functions          | The offered rarity need not equal the resulting equipped rarity. Preserve both.                                                                                              |
| Later equipped mutation | `TraitLogic.lua:UpgradeAllCommon`, `AddRarityToTraits`, targeted acquisition functions | May change another trait's level or clock as well as the target rarity. Those consequences belong to history settlement.                                                     |

Ordinary provider order is Common → Rare → Epic → Duo → Legendary; later
successful checks replace earlier ones. Heroic is absent from that order.
Athena explicitly adds Heroic; Artemis stops at Epic. A trait's own rarity
support still matters, but **remaining-fill bucket support is not equivalent
to checking each proposed trait independently**. That latter correction already
belongs to initial-offer Gate E.

## A. Chance sources, overrides and blockers

Percentages below are chance-table additions, not final offer probabilities.
Rank lists are I / II / III / IV.

| Effect/source                           | Native fact and timing                                                                                                                                                                                                                                                                          | Current planner / disposition                                                                                                                                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Olympian base                           | Rare 10%, Epic 5%, Duo 12%, Legendary 10%; no fresh Heroic. `HeroData.lua:170`.                                                                                                                                                                                                                 | `catalog.boonRarityBases`, `traits/rarity.ts`: aligned.                                                                                                                                                                                          |
| Hermes base                             | Rare 6%, Epic 3%, Legendary 1%, Duo 0%. `HeroData.lua:185`.                                                                                                                                                                                                                                     | Separate Hermes base: aligned. Do not apply the Olympian base merely because Hermes is shop-aware.                                                                                                                                               |
| Excellence                              | Rare +30/40/50/60%; Legendary ×1.30/1.40/1.50/1.60 after additions. Native processed-value rounding applies to rank multipliers. `TraitData_MetaUpgrade.lua:810`; `TraitLogic.lua:GetProcessedValue`.                                                                                           | `declarations/arcana-fear.ts`, `boonRarityFactsForOffer`: aligned for supported ordinary/NPC ledgers. Also affects Chaos's Rare check natively; see C3.                                                                                          |
| Divinity                                | Epic +5/10/15/20%. `TraitData_MetaUpgrade.lua:894`.                                                                                                                                                                                                                                             | Same owners: aligned for ordinary/NPC ledgers. Also affects Chaos natively; see C3.                                                                                                                                                              |
| The Queen                               | Duo +6/8/10/12%. `TraitData_MetaUpgrade.lua:855`.                                                                                                                                                                                                                                               | Same owners: aligned. A positive Duo entry cannot create Duo traits for a provider without them.                                                                                                                                                 |
| Barren                                  | Removes active Arcana, restores them on expiry; also forces its paired nonfixed Chaos blessing to Heroic. `TraitData_Chaos.lua:1160`; `PowersLogic.lua:RemoveArcana` at 4836.                                                                                                                   | Active rarity-card contributions are suppressed by `boonRarityFactsForOffer`; paired Heroic is enforced by Chaos normalization. These are two separate effects.                                                                                  |
| Favor                                   | Rare +40–50% Common, +54–67% Rare, +67–84% Epic, +80–100% Heroic. Epic, Duo and Legendary each +10%, independent of Favor rarity. No `GodLootOnly` restriction. `TraitData_Chaos.lua:172`.                                                                                                      | Matured or directly granted Favor contributes authored magnitude through trait history. Ordinary/NPC contribution is aligned; Chaos screen consumption of those facts is missing (C3).                                                           |
| Yarn of Ariadne                         | One use: Rare +100%, Epic +25%, Duo +10%, Legendary +10%; god/shop-aware loot only. A normal boosted screen marks `RarityBoosted`; closing it consumes the limited bonus. `TraitData_Store.lua:280`; `TraitLogic.lua:1778`; `UpgradeChoiceLogic.lua:1127`.                                      | Numeric amounts and normal consumption exist. Forced-Common settlement incorrectly retains the numeric ledger and spends Yarn: C1. Gorgon II–IV and Chaos suppress temporary bonuses.                                                            |
| Proper Upbringing: future screens       | While activated, adds `GodLootOnly` Rare +100%; does not assign every offered boon Rare. Higher checks still win. `TraitData_Elementals.lua:118`.                                                                                                                                               | Declaration-owned contribution is aligned. Ordinary must bypass it, not be tested against a previously built guaranteed-Rare ledger: C1. Activation/expiry transitions are separate rows below.                                                  |
| Ordinary                                | For eligible god/shop-aware loot, clears the chance table and forces fresh Common. Suppresses the ordinary replacement roll, but not Hymn's earlier forced swaps or later replacement vacancy rescue. `RoomLogic.lua:2093`; `TraitLogic.lua:1758–1803,1965`.                                    | Override and replacement distinction exist. Call-site ordering is inconsistent with numeric facts and Gorgon: C1/C2.                                                                                                                             |
| Miniboss room                           | Sparse room override wins over the item's override; omitted entries retain provider base. Applies to loot generated there, including deliveries, not merely the principal room reward. `RoomLogic.lua:2145`; room declarations below.                                                           | All eight biome override families are declared. They are inputs to the same ledger, not separate boosts. They do **not** bypass Ordinary in the installed base game.                                                                             |
| Boosted Boon / upgraded shop Hermes     | Item override Rare 90%, Epic 25%, Legendary 10%; omitted Duo retains base. `StoreLogic.lua:166,194,212`; `StoreData.lua` I/Q inventories.                                                                                                                                                       | Distinct Boon/Boosted Boon source facts and shop Hermes upgrade context already exist. Room override still has precedence; Ordinary still wins earlier. Travel Deal changes the source slot, not this rule.                                      |
| Gorgon Amulet                           | Rank I/II/III/IV sets a **chance override** Common/Rare/Epic/Heroic = 1. II–IV also ignore temporary rarity bonuses. Other unlimited contributions and a room override still participate. `EncounterPresentation.lua:1428`; `TraitData_Keepsake.lua:2236`.                                      | Uses the shared ledger, then chooses its lowest reachable rarity as the fixed authored Athena result. That deterministic support choice is not a native guarantee of one uniform roll at every rank. Ordinary is missing from this resolver: C2. |
| Artemis / Athena / Dionysus             | All are `TreatAsGodLootByShops`; ordinary rarity modifiers apply. Artemis uses Common/Rare/Epic; Athena Common/Rare/Epic/Heroic; Dionysus uses the default order intersected with trait support. `NPCData_Artemis/Athena/Dionysus.lua`.                                                         | Shop-aware provider classification and source roll orders exist. Keep these providers in acceptance coverage; Gorgon is not the only NPC rarity contact.                                                                                         |
| Chaos's own screen                      | `TrialUpgrade`: Rare 40%, Epic 10%, Duo 0%, Legendary 5% item override; ignores temporary bonuses, is not god loot. Nonfixed ordinary pairs roll Epic then Rare. Barren forces Heroic; a blessing with one declared rarity uses it directly. `LootData_Chaos.lua:16,94`; `TraitLogic.lua:1710`. | Pair rarity shape is checked, but exact-context chance feasibility is not: C3. Excellence/Divinity/Favor apply natively; Yarn and Proper's god-only bonus do not. Queen and the Legendary multiplier do not alter the Epic/Rare pair roll.       |
| Trial of the Gods                       | `GiveLoot` sets `BlockRarities = { Duo = true }`, implemented as a zero chance entry. `EncounterLogic.lua:1686,1692`; `TraitLogic.lua:1782`.                                                                                                                                                    | Planner uses `devotionNoDuo`. Ordinary roll behavior agrees; native final-rescue zero-entry behavior needs the bounded decision in Q1.                                                                                                           |
| Denial / Rejected / pool exhaustion     | Denial removes identities and disables the final rarity-rescue pass. Rejected makes one option unselectable; it does not make that option disappear or reroll its rarity. `TraitLogic.lua:1980`; `UpgradeChoiceLogic.lua`.                                                                      | These change support or selection, not the numeric ledger. Staged composition is already Gate E scope. Do not treat high-tier probability as a mandatory high-tier quota.                                                                        |
| Infusion / Duo / Legendary declarations | Rarity support, `BlockInRunRarify`, and presentation are distinct. Infusion display can conceal a real Common/Rare/Epic value; some Infusions support Common only.                                                                                                                              | Current explicit internal rarity and Infusion presentation preserve repairability. Mixed-support bucket feasibility belongs to Gate E; no new cosmetic rarity enum is needed.                                                                    |

### Miniboss override inventory

These are room overrides, not additions. A dash means “retain provider base”.

| Rooms        | Rare | Epic | Duo | Legendary | Native evidence                      |
| ------------ | ---: | ---: | --: | --------: | ------------------------------------ |
| F minibosses |  .90 |  .07 |   — |       .05 | `RoomDataF.lua:1058,1134,1215`       |
| G minibosses |  .90 |  .10 |   — |       .05 | `RoomDataG.lua:1899,1981,2047`       |
| H minibosses |  .90 |  .10 |   — |       .05 | `RoomDataH.lua:1121,1219`            |
| I minibosses |  .90 |  .10 | .20 |       .20 | `RoomDataI.lua:2870` and inheritance |
| N minibosses |  .90 |  .10 |   — |       .05 | `RoomDataN.lua:2946` and inheritance |
| O minibosses |  .90 |  .10 |   — |       .05 | `RoomDataO.lua:1648,1791`            |
| P minibosses |  .90 |  .10 | .20 |       .20 | `RoomDataP.lua:2520,2640`            |
| Q minibosses | 1.00 |  .70 | .20 |       .20 | `RoomDataQ.lua:1355` and inheritance |

The apparent room-override exemption in `IsRarityForcedCommon` requires
`CurrentRun.Hero.BoonData.AllowRarityOverride`. It is absent from the BoonData
declaration and no installed script enables it. The similarly named StackData
field is unrelated. Do not turn that dormant conditional into an active
miniboss exemption.

## B. Post-roll mutation and direct grants

These mechanisms must not be implemented by adding more inputs to the
fresh-offer chance ledger. The bounded independent review covered this half of
the inventory; discrepancies here are static traces unless explicitly noted.

| Effect/source                            | Native fact and timing                                                                                                                                                                                                                                                                                             | Current planner / disposition                                                                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core-slot replacement                    | Explicit promotion of the replaced trait's rarity, rather than a new random rarity roll. Hymn changes replacement selection/support and level benefit, not that distinction. `TraitLogic.lua:GetReplacementTraits`, `SetTraitsOnLoot`.                                                                             | Gate A removes the fresh-roll rejection of an otherwise exact replacement. Initial-screen composition still owns whether that replacement can appear.                                                                                             |
| Calling Card                             | Fated screen Rarification, one step per action, up to Heroic; 2/4/6/8 uses. May act on an unselected row. `TraitData_Keepsake.lua:2338`; `UpgradeChoiceLogic.lua:1203`.                                                                                                                                            | `keepsakes/reward-effects.ts:evaluateCallingCardOffer` owns ordered row actions and charges. Promotion and Fated/charge guards are present; the alleged competing slotted-source case is unreachable (see reachability disposition).              |
| Nine god keepsakes                       | Zeus/Hera/Poseidon/Demeter/Apollo/Aphrodite/Hephaestus/Hestia/Ares share one-use provider-specific Rarification. I/II/III allow a source row up to Common/Rare/Epic, then promote one step. No separate Heroic keepsake profile. `TraitData_Keepsake.lua:BaseBoonUpgradeKeepsake` at 77 and provider declarations. | Same action owner, not nine separate policies. Cherished reconstruction keeps the Epic source cap and refills the nested use without restoring provider priority. Equipping one invalidates Calling Card through the existing Unfated transition. |
| Aromatic Phial                           | At fountain use, one eligible Common boon becomes Rare/Epic/Heroic by keepsake I/II/III. Consumption and effective-target domains differ for saturated cooldown boons. `InteractLogic.lua:741`; `TraitLogic.lua:2967`.                                                                                             | `keepsakes/trait-effects.ts:assessPhialTraitTargets` and `rewards/biome/lifecycle-transitions/fountain-used.ts` preserve those domains. Later promotion of Bridal inherits C6.                                                                    |
| Proper: activation / reactivation        | Upgrade equipped eligible Common god/shop traits to Rare, respecting `BlockInRunRarify`; separately assign Proper itself Rare even if acquired Epic. Deactivation removes the future-offer bonus, not earlier upgrades. `TraitLogic.lua:2629`.                                                                     | `traits/history/fold.ts:promoteActiveFloorTargets` runs for newly active sources and preserves offered/equipped distinction. This part is aligned.                                                                                                |
| Proper: Ordinary expiry                  | Ordinary's expiration explicitly reruns the already-active Proper upgrade pass. `TraitData_Chaos.lua:1007`; `TraitLogic.lua:1328`.                                                                                                                                                                                 | Missing from the Chaos clock/history transition (C4); it is not another activation.                                                                                                                                                               |
| Bridal Glow                              | Promote one preferred stackable non-Heroic god boon to Heroic; if that pool is empty, use a broader eligible god/shop pool. Add 1/2/3/4 levels according to Bridal's own rarity and remember the target. `TraitLogic.lua:HeraSuperchargeBoon` at 2823.                                                             | `traits/level-effects.ts` plus targeted settlement/history own the result. Preferred pool exists; fallback pool is absent (C5).                                                                                                                   |
| Bridal: later source upgrade             | `CreditMissingStacks` credits the remembered target for the increase in Bridal's rarity-scaled level benefit. Triggered by native in-run rarity mutation. `TraitData_Hera.lua:2040`; `TraitLogic.lua:3032`.                                                                                                        | Proper activation has a special credit path; ordinary rarity-mutation folding lacks it (C6).                                                                                                                                                      |
| Steady Growth                            | Every 6/5/4/3 eligible encounters by source rarity, promote an eligible boon one step; prefer another target over itself. Upgrading Growth itself preserves remaining time, bounded by the new interval. `TraitLogic.lua:CreditAccumulatedTime`, `CheckChamberTraits`, `AddRarityToTraits`.                        | `traits/history/transitions.ts` and `fold.ts:withRarityAndSteadyGrowthCredit` own the clock/credit. Examined logic agrees. A Growth promotion of Bridal inherits C6.                                                                              |
| Concave Stone                            | Acquires a residual row from the existing screen; no fresh rarity roll. If the primary selection activated Proper, the native selection path can upgrade that residual before acquiring it. `UpgradeChoiceLogic.lua:1002–1023`.                                                                                    | `keepsakes/trait-effects.ts:concaveStoneResidualOptionKeys`, trait settlement's frozen secondary acquisition and Proper post-choice handling retain the screen result. Do not apply Yarn or recompose the residual as a new offer.                |
| Echo Boon Boon Boon                      | Copy prior-run rarity (default Common), not prior boon level; already-active Proper promotes a Common direct grant to Rare. `EventLogic.lua:EchoLastRunBoon`, `SelectEchoBoon` at 1580 onward.                                                                                                                     | `traits/offer-domain.ts:echoLastRunBoonOutcomes` represents authored possible prior rarities rather than importing a previous-run cache. Supported approximation; no fresh roll. Eligibility remains deferred.                                    |
| All Together                             | Directly grant chosen infusion children at default Common without another screen roll. `TraitLogic.lua:GrantBoons` at 2703.                                                                                                                                                                                        | `traits/offers.ts:recordDirectTraitGrants` is the direct-grant path. This does not justify testing the children as fresh Common offers under a guaranteed Rare ledger.                                                                            |
| Transcendent Embryo                      | Direct Chaos blessing at Common/Rare/Epic/Heroic for keepsake I/II/III/IV; no chance roll. The native clock replaces it every eight eligible encounters. `PowersLogic.lua:4869`.                                                                                                                                   | Existing direct Chaos events and `keepsakes/trait-effects.ts` own tier, magnitude and replacement. A Favor result subsequently contributes normally to eligible ledgers.                                                                          |
| Cherished Heirloom / Echo Gift Gift Gift | Change keepsake rank/source availability and reconstruction. They can indirectly change Gorgon/Embryo tiers, Calling Card uses, etc.; not an independent boon-rarity bonus. `KeepsakeLogic.lua:AdvanceKeepsake`; Echo gift handling.                                                                               | Existing keepsake state owns this. Preserve current Embryo blessing/progress; future replacement uses the new tier. Do not add an extra rarity contribution for the gift itself.                                                                  |
| Circe Lapis Lazuli Insight               | Promotes eligible active manually equipped Arcana one rank. Native source-rarity counts are 2/2/3/5. `EventLogic.lua:CirceMetaUpgradeRarity` at 1363.                                                                                                                                                              | Planner rarityless NPC / rank-III Arcana baseline promotes up to two eligible cards to Heroic via `arcana-fear.ts:promoteArcana`; active rarity cards then supply their new numeric contributions. Chosen baseline, not a fresh-boon mutation.    |
| Judgment / Crystal Figurine              | Activate Arcana whose rarity contributions then become live; they do not directly reroll or promote a boon.                                                                                                                                                                                                        | Existing Arcana activation and ledger derivation own the result. Barren suppression must still apply.                                                                                                                                             |
| Icarus Latest Model                      | Promotes a selected permanent hammer to native Legendary. `PowersLogic.lua:UpgradeHammers` at 3688.                                                                                                                                                                                                                | Represented as Hammer Rank II via the targeted transition, not as an ordinary Legendary boon offer.                                                                                                                                               |
| Experimental Hammer / Anvil              | Direct hammer grants normally start at the base hammer rank. Removal/replacement is not a boon-rarity roll.                                                                                                                                                                                                        | Existing hammer acquisition/rank semantics remain separate from fresh boon rarity.                                                                                                                                                                |

### Effects which must not be mistaken for rarity modifiers

| Effect                                        | Actual responsibility                                                                                                                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natural Selection                             | Distributes eight **levels** over eligible core slots (`TraitLogic.lua:DistributeLevels` at 2759), not rarity upgrades.                                                                                                                  |
| Queen's / King's Ransom                       | Remove opposite-provider boons, grant eligible surviving source-provider boons four levels per sacrificed identity. Fixed-Duo source does not promote target rarity (`SacrificeAllBoon` at 2724).                                        |
| Jeweled Pom / Persephone / Poms / Pom Slices  | Level effects. Jeweled Pom's Hades grant is rarityless in the planner and bypasses ordinary rarity generation (`PowersLogic.lua:4895`).                                                                                                  |
| Uncommon Grace / Hubris / cooldown saturation | Consumers of actual internal rarity, not modifiers. Audit witnesses should observe them where a rarity mutation affects activation, priming or level eligibility.                                                                        |
| Hex Rare/Epic/God Sent nodes                  | Talent identities and layout roles, not this boon chance ledger.                                                                                                                                                                         |
| Echo's outer choice / story presentation      | Native `EchoChoice` assigns Epic to outer choices; `ForceCommonAppearanceTrait` elsewhere is cosmetic. Neither turns rarityless NPC effects into ordinary god offers.                                                                    |
| Premium Service                               | Raises weapon-aspect rank (`TraitLogic.lua:UpgradeAspect` at 2801). No corresponding aspect-rank mutation was found in the examined engine. Separate aspect/combat-model question, not silently included in this boon-screen correction. |
| Sea Star / mystery boxes / extra pickups      | Produce or resolve reward sources. Any ensuing fresh screen uses that source's normal rarity context; the spawning trait is not itself a rarity bonus.                                                                                   |

## C. Confirmed discrepancies and bounded questions

### C1. Forced Common is applied after some consumers have already built a ledger

`rewards/trait-settlement/coordinator.ts:withBoonRarityFacts` builds numeric facts
before `traits/offers.ts:offerGenerationAdjustedTraitOfferContext` installs
Ordinary's Common override. `boonRarityFactsForOffer` returns existing facts
before testing the override. Row assessment therefore sees both forced Common
and a numeric table which can forbid Common. The same settlement wrapper uses
the existence of those facts to decide whether to consume Yarn.

Executed probe: acquire Ordinary, retain one Yarn use, settle a Common Zeus
Attack/Special/Cast screen. Result: three `rarityRollUnavailable` findings and
Yarn uses 1 → 0. A freshly generated native screen under Ordinary has no chance
ledger and is not marked `RarityBoosted`, so neither result is correct.

This is not a request to special-case Yarn. Forced-screen context must be
resolved before ledger construction, candidate assessment and limited-bonus
consumption derive their products. Proper or a guaranteed room roll can expose
the same conflicting-context problem.

### C2. Gorgon resolves rarity without the forced-screen context

`rewards/biome/encounter-acquisition/gorgon-started.ts:31` calls
`boonRarityFactsForOffer` directly. A probe with active Ordinary and rank III
Gorgon returns Epic, while native Athena generation forces Common.
`encounter-settlement.ts:199` materializes rows at the early resolved rarity;
later generic assessment can require Common, leaving inconsistent products.

Use the same source/forced-rarity precedence as the ordinary screen path.
Separately retain the current fixed-rarity authoring simplification unless a
broader Gorgon authoring change is explicitly chosen.

### C3. Chaos pair rarity has shape validation but no exact-context roll check

`authored-project/traits/state.ts:normalizeAuthoredChaosTraitOffer` correctly
distinguishes Legendary-only blessings, Barren/Heroic and ordinary C/R/E pairs.
`traits/offers.ts:302` checks contextual curse/blessing requirements but never
applies the Chaos screen's rarity chances.

Executed probe: a Common ordinary Chaos pair with active rank-IV Excellence is
accepted with no assessments/findings. Native Chaos Rare is .40 + .60 = 1;
Epic may supersede it, but Common cannot survive. This is a separate provider
contact, not a need to make Chaos share the ordinary three-bucket editor.

### C4. Ordinary expiry omits Proper's native recheck

Native `ChaosCommonCurse.OnExpire.RecheckBoons` invokes `UpgradeAllCommon` when
Proper is already active. A Common boon acquired during Ordinary can therefore
be promoted when the curse ends, without a new element-activation transition.
The engine's `traits/history/fold.ts` Chaos clock branch matures the blessing
and continues; its floor helper only runs for newly active sources.

Static source/control-flow finding, not a new full-project witness. The
correction belongs to the existing expiration/history transition, not a UI
rewrite or an unconditional floor after every acquisition.

### C5. Bridal Glow's fallback-only target domain is missing

Native offer eligibility first requires `HasSuperchargeableBoon`
(`TraitData_Hera.lua:1999`; `TraitLogic.lua:1626`): a permanent, levelable,
rarity-upgradable god boon, with the Hephaestus cooldown restriction. An
inventory containing only Heroic or nonstackable boons does **not** prove a
normal Bridal offer is legal. Do not relax that prerequisite.

At acquisition, `HeraSuperchargeBoon` first calls `AddRarityToTraits` with
stackable and non-Heroic restrictions. If no target is found, it calls again
without those restrictions. This protects a changed state after generation.
For example: the only preferred target is Epic Zeus Attack; a Hera screen
offers its Heroic replacement alongside Bridal. The primary pick replaces
Zeus Attack, then Concave Stone acquires the frozen Bridal row. The broader
native pool can use the now-Heroic, levelable Hera Attack: rarity remains
Heroic and Bridal still adds levels.

`traits/level-effects.ts:261,315` only supplies the preferred pool.
`assessSelectedTargetedAcquisition` treats an empty pool as legal with no
targeted transition, including frozen Stone settlement. Thus the relevant
failure is a missing acquisition effect/target after the primary choice,
not permission to offer Bridal in an initially fallback-only state.

This is a source-traced carrier sequence, not an executed product witness.
Retain the ordinary offer prerequisite and preferred target priority; support
the native acquisition fallback only when the preferred pool is empty.

### C6. Later Bridal rarity upgrades omit target-level credit

Native `AddRarityToTraits` invokes Bridal's `CreditMissingStacks` hook. Raising
Common Bridal to Rare owes its remembered target one additional level;
Common to Heroic owes three, provided that target remains owned and stackable.
The engine's `traits/history/fold.ts:367` rarity-mutation branch changes rarity
and Growth timing, but not Bridal's owed levels. A separate credit exists in
Proper's activation helper, so that one path does not prove Phial/Growth parity.

Static finding. Reuse existing targeted acquisition evidence in the history
mutation owner; do not thread new target payloads through every rarity caller.

### Q1. Zero chance and absent chance differ in the final rescue

Native final rescue tests whether a chance entry exists, without rolling it;
Lua treats zero as truthy. Trial's blocked Duo becomes a zero entry, whereas
forced Common normally clears entries. Thus the ordinary “Duo cannot roll”
statement does not prove “Duo cannot appear in final rescue”. Exact source:
`TraitLogic.lua:1782,1980–2015`.

The locked initial-offer plan already flags this question. Retain a bounded
native exhaustion witness or an explicit planner simplification before changing
the existing hard Trial restriction. No production exception is added by this
audit.

## Reachability disposition: Calling Card and god keepsakes

The apparent spent-provider / Calling Card precedence difference is not a
reachable defect for a slotted god keepsake. Equipping an opposing keepsake
makes the run Unfated, clears Calling Card charges, and prevents later in-run
selection of Calling Card. Native evidence: `KeepsakeLogic.lua:833,1222–1235`.
The planner already enforces this through
`keepsakes/state.ts:keepsakeSelectionUnavailableReason`, `deriveFatedStatus`
and replacement charge cleanup; `evaluateCallingCardOffer` also requires
Fated status before spending a Calling Card use.

A local source-lookup difference alone does not establish a usable competing
source. No precedence correction is recommended for that hypothetical state.
Unslotted Echo sources retain their existing separate lifecycle; the rejected
slotted-source witness does not establish a defect there either.

## Coverage and next decision

Inventory method: inspect declarations of `RarityBonus`,
`MultiplicativeRarityBonus`, source overrides, forced/blocked rarities,
`RarityUpgradeData`, direct rarity assignments and in-run mutation functions;
then trace their supported catalog and engine consumers. External save
progression, first-ever-run tutorial forcing and reroll behavior are outside
the current planner contract. Cosmetic `ForceCommonAppearanceTrait` inheritance
is not proof of a forced-Common generated offer.

The three executed probes above called the real engine settlement/resolution
functions using existing test support. They were diagnostic, intentionally
failed against the native expectation, and were removed after recording the
result. They are not full project or live-game witnesses. Existing reviewed
Gate A source and tests were left untouched.

The numeric ledger is already the correct authority; do not replace it with a
new rarity framework. The amended plan gives source/forced-rarity precedence,
Chaos's provider check and Ordinary's expiry recheck separate reviewable gates
before composing native buckets. Bridal's acquisition and mutation gaps remain
outside that work.

Agreed planning split: C5 and C6 belong together in one focused **Bridal Glow
correction**, outside the broader rarity work:

- preserve Bridal's existing offer prerequisite, and use the native fallback
  target domain only when its preferred acquisition-time pool is empty;
- when Bridal's rarity later increases, credit the already-targeted boon with
  the additional levels, subject to the native ownership/stackability guards.

That correction owns target selection and settlement. It does not change
fresh-offer rarity generation or introduce a generic fallback mechanism. The
two findings remain here as follow-up evidence, explicitly excluded from the
amended initial-offer plan.

Documentation disposition: the durable
`docs/audits/traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md` owns chance arithmetic
and precedence, but still describes Chaos effects as future consumers and
contains old schema-stage commentary. At delivery closure, revise that
explanation in place and update the appropriate trait/keepsake
evidence rows. Do not promote this temporary investigation wholesale or append
one durable paragraph per bug.
