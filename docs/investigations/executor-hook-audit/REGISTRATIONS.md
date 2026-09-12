# Executor registration census

This is the exhaustive source-registration checklist for the working tree identified
in [the audit index](README.md), not an additional runtime registry.

All 157 sites use `module.hooks.wrap`. Four sites expand through named local
registration helpers; together they install 168 wrappers. Repeated native names
are intentional separate registrations and require separate scope justification.
The semantic matrices are [world](WORLD.md), [acquisitions](ACQUISITIONS.md), and
[effects](EFFECTS.md). Paths below are relative to executor `src/`.

| Executor source                                              | Native function/expression          | Registration tag/expression                                      |
| ------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------- |
| `mods/keepsakes/aromatic_phial.lua:21`                       | `"AddRarityToTraits"`               | `"run-planner-aromatic-phial-target"`                            |
| `mods/keepsakes/concave_stone.lua:62`                        | `"HasHeroTraitValue"`               | `"run-planner-scope-concave-stone-roll"`                         |
| `mods/keepsakes/concave_stone.lua:76`                        | `"RandomChance"`                    | `"run-planner-steer-concave-stone-roll"`                         |
| `mods/keepsakes/equip_results.lua:38`                        | `functionName`                      | `hookId`                                                         |
| `mods/keepsakes/equip_results.lua:60`                        | `"AddRandomChaosBlessing"`          | `"run-planner-equip-embryo-result"`                              |
| `mods/keepsakes/equip_results.lua:76`                        | `"GetProcessedTraitData"`           | `"run-planner-equip-embryo-values"`                              |
| `mods/keepsakes/equip_results.lua:84`                        | `"GetRandomArrayValue"`             | `"run-planner-equip-selection"`                                  |
| `mods/keepsakes/fig_leaf.lua:24`                             | `functionName`                      | `hookId`                                                         |
| `mods/keepsakes/fig_leaf.lua:40`                             | `"RandomChance"`                    | `"run-planner-fig-leaf-decision"`                                |
| `mods/keepsakes/gorgon.lua:13`                               | `"AthenaUse"`                       | `"run-planner-gorgon-athena-use"`                                |
| `mods/keepsakes/transcendent_embryo.lua:12`                  | `"AddRandomChaosBlessing"`          | `"run-planner-embryo"`                                           |
| `mods/keepsakes/transcendent_embryo.lua:36`                  | `"GetRandomArrayValue"`             | `"run-planner-automatic-selection"`                              |
| `mods/keepsakes/transcendent_embryo.lua:45`                  | `"GetProcessedTraitData"`           | `"run-planner-embryo-values"`                                    |
| `mods/loadout/hooks.lua:48`                                  | `"StartNewRun"`                     | `"run-planner-start"`                                            |
| `mods/loadout/hooks.lua:65`                                  | `"CreateNewHero"`                   | `"run-planner-session-start"`                                    |
| `mods/loadout/hooks.lua:83`                                  | `"EquipKeepsake"`                   | `"run-planner-equip-keepsake"`                                   |
| `mods/navigation/hooks.lua:41`                               | `"SetupRoomReward"`                 | `"run-planner-reward-source"`                                    |
| `mods/navigation/hooks.lua:73`                               | `"IsRoomRewardEligible"`            | `"run-planner-room-reward-eligibility"`                          |
| `mods/navigation/hooks.lua:85`                               | `"ChooseRoomReward"`                | `"run-planner-room-reward"`                                      |
| `mods/navigation/hooks.lua:135`                              | `"AssignRoomToExitDoor"`            | `"run-planner-additional-exit-binding"`                          |
| `mods/navigation/hooks.lua:153`                              | `"ChooseNextRoomData"`              | `"run-planner-door-room"`                                        |
| `mods/navigation/hooks.lua:189`                              | `"DoUnlockRoomExits"`               | `"run-planner-doors"`                                            |
| `mods/navigation/hooks.lua:236`                              | `"UseExitDoor"`                     | `"run-planner-exit-usable"`                                      |
| `mods/navigation/hooks.lua:244`                              | `"ChooseAvailableN_HubDoors"`       | `"run-planner-ephyra-hub-board"`                                 |
| `mods/navigation/hooks.lua:265`                              | `"CheckN_SubRoomDoorUnavailable"`   | `"run-planner-ephyra-side-board"`                                |
| `mods/room/features/fields.lua:55`                           | `"RemoveRandomValue"`               | `"run-planner-fields-point-selection"`                           |
| `mods/room/features/fields.lua:81`                           | `"RandomChance"`                    | `"run-planner-fields-optional-count"`                            |
| `mods/room/features/fields.lua:92`                           | `"IsRoomRewardEligible"`            | `"run-planner-fields-optional-reward"`                           |
| `mods/room/features/fields.lua:102`                          | `"ChooseRoomReward"`                | `"run-planner-fields-optional-choice"`                           |
| `mods/room/features/fields.lua:128`                          | `"SpawnRoomReward"`                 | `"run-planner-fields-optional-spawn"`                            |
| `mods/room/features/fields.lua:143`                          | `"SpawnRewardCages"`                | `"run-planner-fields-spawn"`                                     |
| `mods/room/features/fields.lua:179`                          | `"SpawnNemesisForRandomEvents"`     | `"run-planner-fields-nemesis-scope"`                             |
| `mods/room/features/fields.lua:197`                          | `"SelectSpawnPoint"`                | `"run-planner-fields-nemesis-point"`                             |
| `mods/room/features/hooks.lua:15`                            | `"HandleSecretSpawns"`              | `"run-planner-room-features"`                                    |
| `mods/room/features/hooks.lua:26`                            | `"IsSecretDoorEligible"`            | `"run-planner-chaos-eligibility"`                                |
| `mods/room/features/hooks.lua:34`                            | `"IsSellTraitShopEligible"`         | `"run-planner-purging-pool-presence"`                            |
| `mods/room/features/hooks.lua:43`                            | `"IsWellShopEligible"`              | `"run-planner-well-presence"`                                    |
| `mods/room/features/hooks.lua:52`                            | `"IsSurfaceShopEligible"`           | `"run-planner-shrine-presence"`                                  |
| `mods/room/features/hooks.lua:61`                            | `"SpawnZagContract"`                | `"run-planner-zagreus-contract"`                                 |
| `mods/room/features/inventory/button_hooks.lua:73`           | `"CreateStoreButtons"`              | `"run-planner-store-button-bindings"`                            |
| `mods/room/features/inventory/button_hooks.lua:81`           | `"CreateSurfaceShopButtons"`        | `"run-planner-shrine-disposition"`                               |
| `mods/room/features/inventory/button_hooks.lua:105`          | `"RandomInt"`                       | `"run-planner-shrine-delivery-delay"`                            |
| `mods/room/features/inventory/hooks.lua:42`                  | `"FillInShopOptions"`               | `"run-planner-inventory"`                                        |
| `mods/room/features/inventory/hooks.lua:86`                  | `"GetEligibleInteractedGod"`        | `"run-planner-inventory-source"`                                 |
| `mods/room/features/inventory/purging_pool_hooks.lua:20`     | `"GenerateSellTraitShop"`           | `"run-planner-pool-inventory"`                                   |
| `mods/room/features/inventory/purging_pool_hooks.lua:33`     | `"CreateSellButtons"`               | `"run-planner-pool-inventory"`                                   |
| `mods/room/features/inventory/shrine_refill.lua:7`           | `"HandleSurfaceShopAction"`         | `"run-planner-shrine-refill"`                                    |
| `mods/room/features/inventory/well_refill.lua:16`            | `"HandleStorePurchase"`             | `"run-planner-well-refill"`                                      |
| `mods/room/features/inventory/world_item_hooks.lua:16`       | `"RestockWorldItem"`                | `"run-planner-travel-deal-refill"`                               |
| `mods/room/features/inventory/world_item_hooks.lua:47`       | `"SpawnZagContractRewards"`         | `"run-planner-contract-inventory"`                               |
| `mods/room/features/inventory/world_item_hooks.lua:58`       | `"SpawnStoreItemInWorld"`           | `"run-planner-bind-world-shop-item"`                             |
| `mods/room/features/resources.lua:70`                        | `"SetupHarvestPoints"`              | `"run-planner-resource-point-presence"`                          |
| `mods/room/features/resources.lua:89`                        | `exitFunctionName`                  | `"run-planner-resource-" .. string.lower(exitFamily) .. "-exit"` |
| `mods/room/features/resources.lua:107`                       | `"GrantElementFromTool"`            | `"run-planner-resource-element"`                                 |
| `mods/room/features/resources.lua:132`                       | `"RandomChance"`                    | `"run-planner-resource-element-roll"`                            |
| `mods/room/hooks.lua:27`                                     | `"ChooseStartingRoom"`              | `"run-planner-starting-room"`                                    |
| `mods/room/hooks.lua:62`                                     | `"CreateRoom"`                      | `"run-planner-create-room"`                                      |
| `mods/room/hooks.lua:97`                                     | `"StartRoom"`                       | `"run-planner-room-entry"`                                       |
| `mods/room/hooks.lua:150`                                    | `"LeaveRoom"`                       | `"run-planner-room-exit"`                                        |
| `mods/room/timeline/acquisitions/binding.lua:33`             | `"SpawnRoomReward"`                 | `"run-planner-scope-acquisition-producer"`                       |
| `mods/room/timeline/acquisitions/binding.lua:52`             | `"CreateLoot"`                      | `"run-planner-bind-loot-carrier"`                                |
| `mods/room/timeline/acquisitions/binding.lua:73`             | `"CreateConsumableItem"`            | `"run-planner-bind-direct-carrier"`                              |
| `mods/room/timeline/acquisitions/levels/hooks.lua:123`       | `"GetTotalHeroTraitValue"`          | `"run-planner-level-fated-bonus"`                                |
| `mods/room/timeline/acquisitions/levels/hooks.lua:129`       | `"UseLoot"`                         | `"run-planner-level-use-loot"`                                   |
| `mods/room/timeline/acquisitions/levels/hooks.lua:146`       | `"HandleLootPickup"`                | `"run-planner-level-begin-loot"`                                 |
| `mods/room/timeline/acquisitions/levels/hooks.lua:173`       | `"CreateBoonLootButtons"`           | `"run-planner-level-screen"`                                     |
| `mods/room/timeline/acquisitions/levels/hooks.lua:213`       | `"HandleUpgradeChoiceSelection"`    | `"run-planner-level-selection"`                                  |
| `mods/room/timeline/acquisitions/levels/hooks.lua:242`       | `"UseConsumableItem"`               | `"run-planner-level-use-consumable"`                             |
| `mods/room/timeline/acquisitions/levels/hooks.lua:283`       | `"ConsumableUsedPresentation"`      | `"run-planner-level-direct-accepted"`                            |
| `mods/room/timeline/acquisitions/levels/hooks.lua:303`       | `"UseStoreRewardRandomStack"`       | `"run-planner-level-direct-entry"`                               |
| `mods/room/timeline/acquisitions/levels/hooks.lua:320`       | `"AddStackToTraits"`                | `"run-planner-level-direct-terminal"`                            |
| `mods/room/timeline/acquisitions/mystery/hooks.lua:26`       | `"CreateLoot"`                      | `"run-planner-mystery-provider-bind"`                            |
| `mods/room/timeline/acquisitions/mystery/hooks.lua:71`       | `"UnwrapRandomLoot"`                | `"run-planner-mystery-unwrap"`                                   |
| `mods/room/timeline/acquisitions/mystery/hooks.lua:103`      | `"GiveLoot"`                        | `"run-planner-mystery-provider"`                                 |
| `mods/room/timeline/acquisitions/npc/circe.lua:60`           | `"CirceRandomMetaUpgrade"`          | `"run-planner-circe-arcana"`                                     |
| `mods/room/timeline/acquisitions/npc/circe.lua:76`           | `"AddRandomMetaUpgrades"`           | `"run-planner-circe-arcana-native"`                              |
| `mods/room/timeline/acquisitions/npc/circe.lua:84`           | `"RandomChance"`                    | `"run-planner-circe-cast-count-admission"`                       |
| `mods/room/timeline/acquisitions/npc/circe.lua:100`          | `"CirceMetaUpgradeRarity"`          | `"run-planner-circe-arcana-rarity"`                              |
| `mods/room/timeline/acquisitions/npc/circe.lua:109`          | `"CirceRemoveShrineUpgrades"`       | `"run-planner-circe-fear"`                                       |
| `mods/room/timeline/acquisitions/npc/circe.lua:118`          | `"RemoveRandomValue"`               | `"run-planner-circe-arcana-selection"`                           |
| `mods/room/timeline/acquisitions/npc/circe.lua:139`          | `"GetRandomKey"`                    | `"run-planner-circe-fear-selection"`                             |
| `mods/room/timeline/acquisitions/npc/echo.lua:76`            | `"EchoLastRunBoon"`                 | `"run-planner-echo-last-run-menu"`                               |
| `mods/room/timeline/acquisitions/npc/echo.lua:89`            | `"OpenUpgradeChoiceMenu"`           | `"run-planner-echo-last-run-rows"`                               |
| `mods/room/timeline/acquisitions/npc/echo.lua:110`           | `"SelectEchoBoon"`                  | `"run-planner-echo-last-run-selection"`                          |
| `mods/room/timeline/acquisitions/npc/echo.lua:139`           | `"GetLootSourceName"`               | `"run-planner-echo-last-run-loot-history"`                       |
| `mods/room/timeline/acquisitions/npc/echo.lua:146`           | `"EchoDoubleLevelBoon"`             | `"run-planner-echo-pom-target"`                                  |
| `mods/room/timeline/acquisitions/npc/echo.lua:167`           | `"GetRandomKey"`                    | `"run-planner-echo-pom-selection"`                               |
| `mods/room/timeline/acquisitions/npc/hooks.lua:91`           | `functionName`                      | `"run-planner-npc-entry"`                                        |
| `mods/room/timeline/acquisitions/npc/hooks.lua:130`          | `"OpenUpgradeChoiceMenu"`           | `"run-planner-npc-menu"`                                         |
| `mods/room/timeline/acquisitions/npc/hooks.lua:146`          | `"HandleUpgradeChoiceSelection"`    | `"run-planner-npc-selection"`                                    |
| `mods/room/timeline/acquisitions/npc/icarus.lua:26`          | `"UpgradeHammers"`                  | `"run-planner-icarus-latest-model"`                              |
| `mods/room/timeline/acquisitions/npc/icarus.lua:45`          | `"RemoveRandomValue"`               | `"run-planner-icarus-hammer-target"`                             |
| `mods/room/timeline/acquisitions/path/hooks.lua:68`          | `"UseConsumableItem"`               | `"run-planner-path-use"`                                         |
| `mods/room/timeline/acquisitions/path/hooks.lua:90`          | `"ConsumableUsedPresentation"`      | `"run-planner-path-accepted"`                                    |
| `mods/room/timeline/acquisitions/path/hooks.lua:113`         | `"OpenSpellScreen"`                 | `"run-planner-aspect-path-route"`                                |
| `mods/room/timeline/acquisitions/path/hooks.lua:128`         | `"OpenTalentScreen"`                | `"run-planner-path-screen-return"`                               |
| `mods/room/timeline/acquisitions/pickups/hooks.lua:48`       | `"UseConsumableItem"`               | `"run-planner-direct-pickup-use"`                                |
| `mods/room/timeline/acquisitions/pickups/hooks.lua:88`       | `"ConsumableUsedPresentation"`      | `"run-planner-direct-pickup-accepted"`                           |
| `mods/room/timeline/acquisitions/sea_star.lua:54`            | `"GetTotalHeroTraitValue"`          | `"run-planner-sea-star-chance-gate"`                             |
| `mods/room/timeline/acquisitions/sea_star.lua:65`            | `"RandomChance"`                    | `"run-planner-sea-star-chance-result"`                           |
| `mods/room/timeline/acquisitions/spell/hooks.lua:59`         | `"RemoveRandomValue"`               | `"run-planner-spell-offer-order"`                                |
| `mods/room/timeline/acquisitions/spell/hooks.lua:69`         | `"CreateSpellButtons"`              | `"run-planner-spell-offer-buttons"`                              |
| `mods/room/timeline/acquisitions/spell/hooks.lua:82`         | `"PregenerateSpells"`               | `"run-planner-spell-offer-pregeneration"`                        |
| `mods/room/timeline/acquisitions/spell/hooks.lua:96`         | `"OpenSpellScreen"`                 | `"run-planner-spell-begin"`                                      |
| `mods/room/timeline/acquisitions/spell/hooks.lua:110`        | `"AcceptAndCloseSpellScreen"`       | `"run-planner-spell-selection"`                                  |
| `mods/room/timeline/acquisitions/traits/chaos_offer.lua:122` | `"HandleLootPickup"`                | `"run-planner-chaos-acquisition"`                                |
| `mods/room/timeline/acquisitions/traits/chaos_offer.lua:142` | `"CreateBoonLootButtons"`           | `"run-planner-chaos-initial-screen"`                             |
| `mods/room/timeline/acquisitions/traits/chaos_offer.lua:161` | `"CreateUpgradeChoiceButton"`       | `"run-planner-chaos-row"`                                        |
| `mods/room/timeline/acquisitions/traits/chaos_offer.lua:190` | `"GetProcessedTraitData"`           | `"run-planner-chaos-processed-values"`                           |
| `mods/room/timeline/acquisitions/traits/hooks.lua:237`       | `"GetRandomValue"`                  | `"run-planner-steer-all-together"`                               |
| `mods/room/timeline/acquisitions/traits/hooks.lua:262`       | `"GrantBoons"`                      | `"run-planner-complete-all-together"`                            |
| `mods/room/timeline/acquisitions/traits/hooks.lua:299`       | `"FYShuffle"`                       | `"run-planner-steer-natural-selection-order"`                    |
| `mods/room/timeline/acquisitions/traits/hooks.lua:326`       | `"DistributeLevels"`                | `"run-planner-complete-natural-selection"`                       |
| `mods/room/timeline/acquisitions/traits/hooks.lua:351`       | `"HeraSuperchargeBoon"`             | `"run-planner-complete-targeted-acquisition"`                    |
| `mods/room/timeline/acquisitions/traits/hooks.lua:371`       | `"AddRarityToTraits"`               | `"run-planner-force-targeted-acquisition-rarity"`                |
| `mods/room/timeline/acquisitions/traits/hooks.lua:391`       | `"HandleLootPickup"`                | `"run-planner-begin-ordinary-loot"`                              |
| `mods/room/timeline/acquisitions/traits/hooks.lua:426`       | `"CreateBoonLootButtons"`           | `"run-planner-install-ordinary-offer"`                           |
| `mods/room/timeline/acquisitions/traits/hooks.lua:450`       | `"CreateUpgradeChoiceButton"`       | `"run-planner-align-ordinary-rejected"`                          |
| `mods/room/timeline/acquisitions/traits/hooks.lua:461`       | `"HandleUpgradeChoiceSelection"`    | `"run-planner-complete-ordinary-offer"`                          |
| `mods/room/timeline/encounters/automatic.lua:22`             | `"AddRarityToTraits"`               | `"run-planner-steady-growth"`                                    |
| `mods/room/timeline/encounters/boss.lua:10`                  | `"Kill"`                            | `"run-planner-boss-defeated"`                                    |
| `mods/room/timeline/encounters/boss.lua:28`                  | `"AddRandomMetaUpgrades"`           | `"run-planner-boss-arcana"`                                      |
| `mods/room/timeline/encounters/boss.lua:54`                  | `"RandomChance"`                    | `"run-planner-boss-arcana-admission"`                            |
| `mods/room/timeline/encounters/boss.lua:61`                  | `"RemoveRandomValue"`               | `"run-planner-boss-arcana-selection"`                            |
| `mods/room/timeline/encounters/hooks.lua:37`                 | `"SetupRoomMultipleEncountersData"` | `"run-planner-encounter-assembly"`                               |
| `mods/room/timeline/encounters/hooks.lua:51`                 | `"ChooseEncounter"`                 | `"run-planner-encounter-choice"`                                 |
| `mods/room/timeline/encounters/hooks.lua:94`                 | `"StartEncounter"`                  | `"run-planner-encounter-start"`                                  |
| `mods/room/timeline/encounters/hooks.lua:106`                | `"EndEncounterEffects"`             | `"run-planner-encounter-end"`                                    |
| `mods/room/timeline/encounters/nemesis.lua:41`               | `"SpawnNemesisForRandomEvents"`     | `"run-planner-nemesis-spawn"`                                    |
| `mods/room/timeline/encounters/nemesis.lua:49`               | `"CheckAvailableTextLines"`         | `"run-planner-nemesis-family"`                                   |
| `mods/room/timeline/encounters/nemesis.lua:78`               | `"NemesisTradeChoice"`              | `"run-planner-nemesis-trade"`                                    |
| `mods/room/timeline/encounters/nemesis.lua:108`              | `"RemoveTrait"`                     | `"run-planner-nemesis-trait-removal"`                            |
| `mods/room/timeline/encounters/nemesis.lua:123`              | `"NemesisDamageContestTimer"`       | `"run-planner-nemesis-contest"`                                  |
| `mods/room/timeline/encounters/nemesis.lua:146`              | `"NPCRewardDropPreProcess"`         | `"run-planner-nemesis-reward-source"`                            |
| `mods/room/timeline/encounters/nemesis.lua:156`              | `"NPCRewardDropPreProcessArgs"`     | `"run-planner-nemesis-reward-options"`                           |
| `mods/room/timeline/encounters/nemesis.lua:182`              | `"NPCRewardDrop"`                   | `"run-planner-nemesis-reward"`                                   |
| `mods/room/timeline/encounters/thessaly.lua:54`              | `"ShipsEncounterSetup"`             | `"run-planner-ship-wheel-realization"`                           |
| `mods/room/timeline/encounters/thessaly.lua:76`              | `"RandomChance"`                    | `"run-planner-ship-wheel-count"`                                 |
| `mods/room/timeline/encounters/thessaly.lua:83`              | `"ChooseNextRewardStore"`           | `"run-planner-ship-wheel-store"`                                 |
| `mods/room/timeline/encounters/thessaly.lua:88`              | `"CreateDoorRewardPreview"`         | `"run-planner-bind-ship-wheel"`                                  |
| `mods/room/timeline/encounters/thessaly.lua:98`              | `"UseShipWheel"`                    | `"run-planner-observe-ship-wheel"`                               |
| `mods/room/timeline/interactions/fountain.lua:17`            | `"UseHealthFountain"`               | `"run-planner-fountain"`                                         |
| `mods/room/timeline/transformations/anvil.lua:27`            | `"RemoveRandomValue"`               | `"run-planner-anvil-random"`                                     |
| `mods/room/timeline/transformations/anvil.lua:54`            | `"ChaosHammerUpgrade"`              | `"run-planner-anvil-upgrade"`                                    |
| `mods/room/timeline/transformations/artificer.lua:124`       | `"ConvertMetaRewardPresentation"`   | `"run-planner-artificer-accepted"`                               |
| `mods/room/timeline/transformations/artificer.lua:169`       | `"CreateLoot"`                      | `"run-planner-artificer-replacement-loot"`                       |
| `mods/room/timeline/transformations/artificer.lua:174`       | `"CreateConsumableItem"`            | `"run-planner-artificer-replacement-consumable"`                 |
| `mods/room/timeline/transformations/artificer.lua:180`       | `"SpawnRoomReward"`                 | `"run-planner-artificer-replacement-spawn"`                      |
| `mods/room/timeline/transformations/artificer.lua:205`       | `"Destroy"`                         | `"run-planner-artificer-source-destroyed"`                       |
| `mods/room/timeline/transformations/use.lua:40`              | `"UseConsumableItem"`               | `"run-planner-outcome-use"`                                      |
| `mods/room/timeline/transformations/use.lua:77`              | `"ConsumableUsedPresentation"`      | `"run-planner-outcome-accepted"`                                 |
| `mods/room/timeline/transformations/well_twist.lua:18`       | `"AwardRandomStoreItem"`            | `"run-planner-well-twist-award"`                                 |
| `mods/room/timeline/transformations/well_twist.lua:27`       | `"GetRandomValue"`                  | `"run-planner-well-twist-use"`                                   |
| `mods/spells/hex_tree.lua:46`                                | `"CreateTalentTree"`                | `"run-planner-hex-tree"`                                         |
| `mods/spells/hex_tree.lua:59`                                | `"GetRandomValue"`                  | `"run-planner-hex-layout"`                                       |
| `mods/spells/hex_tree.lua:68`                                | `"IsGameStateEligible"`             | `"run-planner-hex-god-sent-absence"`                             |
| `mods/spells/hex_tree.lua:74`                                | `"RemoveRandomValue"`               | `"run-planner-hex-special-talents"`                              |

## Dynamic expansion

- `keepsakes/equip_results.lua`: three immediate keepsake result contacts.
- `keepsakes/fig_leaf.lua`: two native encounter spawn handlers.
- `room/features/resources.lua`: four native exit-harvest families.
- `room/timeline/acquisitions/npc/hooks.lua`: six named story-choice functions.

Their concrete function names and individual dispositions are expanded in the
family matrices. Host `once_loaded.game`, ReLoad initialization and UI callbacks
are inventoried separately in the index; they are not native gameplay wrappers.
