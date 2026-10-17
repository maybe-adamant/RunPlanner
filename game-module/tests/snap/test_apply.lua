-- luacheck: globals TestSnapApply
local lu = require("luaunit")
local json = require("mods/protocol/json")
local nativeGame = require("tests/harness/native_game")
local admission = require("mods.room.conformance.admission")
local snap = require("mods.snap.apply")

TestSnapApply = {}

local ELEMENTS = { "Fire", "Air", "Earth", "Water" }

local function frame()
    return {
        traits = {
            equipped = {}, bannedTraitKeys = {},
            elements = { Aether = 0, Earth = 0, Air = 0, Fire = 0, Water = 0 },
        },
        arcana = { active = {} },
        vows = { configuredRanks = {}, effectiveRanks = {}, disabledKeys = {} },
        forfeit = "inactive",
        chaos = { active = {}, matured = {} },
        keepsakes = { usedKeys = {}, blockedKeys = {}, held = {} },
        equipment = {},
        rewardPriorities = {},
        hexProgress = {
            talentKeys = {}, closed = false, bankedPathPoints = 0, investedPathPoints = 0,
            olympianTalentInvested = false,
        },
        hexNodes = { nodes = {}, investedNodes = {} },
        rewardStores = {},
        artificer = json.null,
        retainedEffects = {
            steadyGrowth = {}, hermesShrineDeliveries = {},
            keepsakes = {
                olympianSources = {}, jeweledPom = json.null, experimentalHammers = {},
                callingCard = json.null, timePiece = json.null, figLeaf = json.null,
                gorgon = json.null, phial = json.null, figurine = json.null,
                stone = json.null, transcendentEmbryo = json.null,
            },
            stygianWell = {
                sparkUses = 0, yarnUses = 0, hymnUses = 0, discountUses = {}, emptySlotUses = {},
                extendedUses = 0,
            },
        },
    }
end

-- A fake hero and the native calls apply makes; removals record their args.
local function world(traits)
    local hero = {
        Traits = traits or {}, Health = 40, MaxHealth = 100, Elements = {},
        LastStands = { { Name = "LastStandSkelly" } }, MaxLastStands = 1,
    }
    local run = { Hero = hero, TemporaryMetaUpgrades = {}, ShrineUpgradesDisabled = {}, RewardStores = {} }
    local log = { removed = {}, added = {} }
    local function removeData(_, trait, args)
        for index, held in ipairs(hero.Traits) do
            if held == trait then table.remove(hero.Traits, index) break end
        end
        log.removed[#log.removed + 1] = { name = trait.Name, args = args }
    end
    local function find(name)
        for _, trait in ipairs(hero.Traits) do if trait.Name == name then return trait end end
    end
    local restore = nativeGame.install({
        CurrentRun = run,
        GameState = { MetaUpgradeState = {}, TraitsTaken = {}, ShrineUpgrades = {} },
        game = {},
        TraitData = setmetatable({ ReincarnationKeepsake = { Slot = "Keepsake" } },
            { __index = function() return {} end }),
        MetaUpgradeCardData = {}, MetaUpgradeData = {}, RewardStoreData = {},
        PersistentTraitKeys = { "Uses", "RemainingUses" },
        GetProcessedTraitData = function(args)
            return { Name = args.TraitName, Rarity = args.Rarity, StackNum = args.StackNum,
                PropertyChanges = { {}, {} } }
        end,
        AddTraitToHero = function(args)
            table.insert(hero.Traits, args.TraitData)
            log.added[#log.added + 1] = args.TraitData.Name
            return args.TraitData
        end,
        RemoveTraitData = removeData,
        RemoveTrait = function(unit, name, args) removeData(unit, find(name), args) end,
        RemoveWeaponTrait = function(name) while find(name) do removeData(hero, find(name), {}) end end,
        IncreaseTraitLevel = function() error("snap never raises a level in place") end,
        GetTraitCount = function(_, args)
            local count = 0
            for _, trait in ipairs(hero.Traits) do
                if trait.Name == args.Name then count = count + (trait.StackNum or 1) end
            end
            return count
        end,
        HeroHasTrait = function(name) return find(name) ~= nil end,
        GetHeroTrait = find,
        -- TraitLogic.UpdateHeroTraitDictionary's element totals from essence traits.
        UpdateHeroTraitDictionary = function()
            hero.Elements = {}
            for _, trait in ipairs(hero.Traits) do
                for _, element in ipairs(ELEMENTS) do
                    if trait.Name == element .. "Essence" or trait.Name == "ElementalEssence" then
                        hero.Elements[element] = (hero.Elements[element] or 0) + 1
                    end
                end
            end
        end,
        ValidateMaxHealth = function() end, ValidateMaxMana = function() end,
        UpdateTalentPointInvestedCache = function() end,
        UnequipKeepsake = function(_, name) removeData(hero, find(name), {}) end,
        EquipKeepsake = function(_, name, args)
            -- KeepsakeLogic.EquipKeepsake: Reincarnation adds a Death Defiance.
            table.insert(hero.Traits, { Name = name, Rarity = args.ForceRarity, Slot = "Keepsake" })
            if name == "ReincarnationKeepsake" then
                table.insert(hero.LastStands, { Name = "ReincarnationKeepsake" })
                hero.MaxLastStands = hero.MaxLastStands + 1
            end
        end,
        GetNumShrineUpgrades = function() return 0 end,
        ShrineUpgradeExtractValues = function() end, CallFunctionName = function() end,
        RemoveIncomingDamageModifier = function() end, AddIncomingDamageModifier = function() end,
        GetSurfaceShopText = function(item) return item.Name end,
    })
    local verify = admission.verify
    admission.verify = function() return true end
    return hero, log, function()
        admission.verify = verify
        restore()
    end
end

local function apply(value)
    local occurrence = { diagnostics = { roomEntered = value } }
    return snap.apply(occurrence, value, {}, {})
end

local function names(hero)
    local result = {}
    for _, trait in ipairs(hero.Traits) do result[#result + 1] = trait.Name end
    table.sort(result)
    return result
end

function TestSnapApply.testRemovesUnplannedCursesAndDeliveriesWithoutTheirExpiry()
    local hero, log, restore = world({
        { Name = "ChaosHealthCurse", RemainingUses = 2, PropertyChanges = { { ChangeValue = -10 } },
            OnExpire = { TraitData = { Name = "ChaosHealthBlessing", Rarity = "Rare",
                PropertyChanges = { { ChangeValue = 30 } } } } },
        { Name = "StorePendingDeliveryItem", ShopItemName = "MaxManaDrop", RemainingUses = 3 },
    })
    lu.assertTrue(apply(frame()))
    restore()
    lu.assertEquals(names(hero), {})
    for _, removal in ipairs(log.removed) do lu.assertTrue(removal.args.SkipExpire, removal.name) end
    lu.assertEquals(#log.removed, 2)
end

function TestSnapApply.testKeepsExactTraitsAndFixesALevelByReaddingNeverRaisingIt()
    local exact = { Name = "ApolloWeaponBoon", Rarity = "Epic", StackNum = 1 }
    local hero, log, restore = world({
        exact,
        { Name = "ZeusWeaponBoon", Rarity = "Common", StackNum = 1, Uses = 2 },
        { Name = "AphroditeWeaponBoon", Rarity = "Rare", StackNum = 1 },
    })
    local value = frame()
    value.traits.equipped = {
        { traitKey = "ApolloWeaponBoon", rarity = "Epic", level = 1 },
        { traitKey = "ZeusWeaponBoon", rarity = "Rare", level = 3 },
        { traitKey = "PoseidonWeaponBoon", rarity = "Common", level = 1 },
    }
    lu.assertTrue(apply(value))
    restore()
    lu.assertEquals(names(hero), { "ApolloWeaponBoon", "PoseidonWeaponBoon", "ZeusWeaponBoon" })
    lu.assertIs(hero.Traits[1], exact)
    local zeus
    for _, trait in ipairs(hero.Traits) do if trait.Name == "ZeusWeaponBoon" then zeus = trait end end
    lu.assertEquals({ zeus.Rarity, zeus.StackNum, zeus.Uses }, { "Rare", 3, 2 })
    for _, removal in ipairs(log.removed) do lu.assertTrue(removal.args.SkipExpire, removal.name) end
end

function TestSnapApply.testSplitsAnElementalEssenceForARemovalAndAddsTheRest()
    local hero, _, restore = world({ { Name = "ElementalEssence" }, { Name = "FireEssence" } })
    local value = frame()
    value.traits.elements = { Aether = 0, Fire = 0, Air = 1, Earth = 2, Water = 1 }
    lu.assertTrue(apply(value))
    restore()
    lu.assertEquals(names(hero), { "AirEssence", "EarthEssence", "EarthEssence", "WaterEssence" })
    lu.assertEquals(hero.Elements, { Air = 1, Earth = 2, Water = 1 })
end

function TestSnapApply.testRestoresDeathDefianceAfterAKeepsakeReequipAndClampsHealth()
    local hero, _, restore = world({ { Name = "ManaOverTimeRefundKeepsake", Rarity = "Epic", Slot = "Keepsake" } })
    local value = frame()
    value.keepsakes.held = { { name = "ReincarnationKeepsake", rarity = "Rare", slotted = true } }
    hero.MaxHealth = 30
    lu.assertTrue(apply(value))
    restore()
    lu.assertEquals(names(hero), { "ReincarnationKeepsake" })
    lu.assertEquals(hero.LastStands, { { Name = "LastStandSkelly" } })
    lu.assertEquals(hero.MaxLastStands, 1)
    lu.assertEquals(hero.Health, 30)
end

function TestSnapApply.testInvestsThePlannedNodesAndSetsTalentStacksByReadding()
    local talents = {
        { { Name = "TalentA", Rarity = "Rare", Invested = true } },
        { { Name = "TalentB", Rarity = "Common" }, { Name = "TalentB", Rarity = "Common" } },
    }
    local hero, _, restore = world({
        { Name = "SpellPotionTrait" }, { Name = "TalentA", Rarity = "Rare", StackNum = 1 },
    })
    hero.SlottedSpell = { TraitName = "SpellPotionTrait", Talents = talents }
    local value = frame()
    value.hexProgress.spellTraitKey = "SpellPotionTrait"
    value.hexProgress.bankedPathPoints = 1
    value.hexNodes.investedNodes = { "2:1", "2:2" }
    lu.assertTrue(apply(value))
    local run = _G.CurrentRun
    restore()
    lu.assertEquals({ run.NumTalentPoints, run.InvestedTalentPoints }, { 1, 2 })
    lu.assertNil(talents[1][1].Invested)
    lu.assertTrue(talents[2][1].Invested and talents[2][2].Invested)
    lu.assertEquals(names(hero), { "SpellPotionTrait", "TalentB" })
    lu.assertEquals(hero.Traits[2].StackNum, 2)
end

function TestSnapApply.testReturnsTheStartCheckFailure()
    local _, _, restore = world({})
    local mismatch = { checkpoint = "practice-start:traitInventory" }
    admission.verify = function() return nil, mismatch end
    local ok, failure = apply(frame())
    restore()
    lu.assertNil(ok)
    lu.assertIs(failure, mismatch)
end

function TestSnapApply.testWritesArcanaCardsByOriginAndReenablesAVow()
    local hero, _, restore = world({
        { Name = "CardATrait", Rarity = "Epic" }, { Name = "CardCTrait", Rarity = "Epic" },
    })
    local gameState, run = _G.GameState, _G.CurrentRun
    _G.MetaUpgradeCardData = { CardA = { TraitName = "CardATrait" }, CardB = { TraitName = "CardBTrait" },
        CardC = { TraitName = "CardCTrait" } }
    gameState.MetaUpgradeState = { CardA = { Equipped = true }, CardB = {}, CardC = { Equipped = true } }
    _G.MetaUpgradeData = { EnemyDamageShrineUpgrade = { ChangeValue = 1.5 } }
    run.ShrineUpgradesDisabled.EnemyDamageShrineUpgrade = true
    local modifiers = {}
    _G.ShrineUpgradeExtractValues = function() end
    _G.RemoveIncomingDamageModifier = function(_, name) modifiers[name] = nil end
    _G.AddIncomingDamageModifier = function(_, data) modifiers[data.Name] = data.NonTrapDamageTakenMultiplier end
    local value = frame()
    value.arcana.active = {
        { key = "CardA", origin = "manual", rarity = "Epic", held = false },
        { key = "CardB", origin = "temporary", rarity = "Heroic", held = true },
    }
    lu.assertTrue(apply(value))
    restore()
    lu.assertEquals(names(hero), { "CardBTrait" })
    lu.assertEquals(hero.Traits[1].Rarity, "Heroic")
    lu.assertEquals({ gameState.MetaUpgradeState.CardA.Equipped, gameState.MetaUpgradeState.CardB.Equipped,
        gameState.MetaUpgradeState.CardC.Equipped }, { true, true, false })
    lu.assertEquals(run.TemporaryMetaUpgrades, { CardB = true })
    lu.assertEquals(run.ShrineUpgradesDisabled, {})
    lu.assertEquals(modifiers, { EnemyDamageShrineUpgrade = 1.5 })
end

function TestSnapApply.testTheModelledTraitsMatchTheModuleCatalog()
    lu.assertEquals(require("modeled_traits").catalogVersion, require("mods.protocol.decoder").CATALOG_VERSION)
end
