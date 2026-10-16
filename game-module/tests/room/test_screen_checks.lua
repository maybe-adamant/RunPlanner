-- luacheck: globals TestScreenChecks
local lu = require("luaunit")
local checks = require("mods.room.timeline.acquisitions.traits.screen_checks")
local nativeGame = require("tests.harness.native_game")
local traitSupport = require("tests.room.ordinary_trait_support")

TestScreenChecks = {}

local function checkpoints(problems)
    local result = {}
    for _, problem in ipairs(problems) do result[#result + 1] = problem.checkpoint end
    return result
end

function TestScreenChecks:setUp()
    self.restore = nativeGame.install({
        CurrentRun = { Hero = { Traits = {
            { Name = "LimitedSwapBonusTrait", Uses = 1 },
            { Name = "TemporaryBoonRarityTrait", RemainingUses = 1 },
            { Name = "TemporaryBoonRarityTrait", RemainingUses = 1 },
            { Name = "UnpickedBoonKeepsake", Uses = 1, DoubleBoonChance = 0.25 },
            { Name = "RarifyKeepsake", RarityUpgradeData = { Uses = 2, RequireFated = true } },
            { Name = "ElementalRarityUpgradeBoon", Activated = true },
            { Name = "ZeusWeaponBoon", Slot = "Melee", Rarity = "Rare", StackNum = 2 },
        } } },
        HasHeroTraitValue = function(property)
            for _, trait in ipairs(_G.CurrentRun.Hero.Traits) do
                if property == "ForceSwaps" and trait.Name == "LimitedSwapBonusTrait" then return trait end
                if trait[property] ~= nil then return trait end
            end
            return nil
        end,
        GetHeroTrait = function(name)
            for _, trait in ipairs(_G.CurrentRun.Hero.Traits) do
                if trait.Name == name then return trait end
            end
        end,
        HeroHasTrait = function(name)
            for _, trait in ipairs(_G.CurrentRun.Hero.Traits) do
                if trait.Name == name then return true end
            end
            return false
        end,
        HeroSlotFilled = function(slot) return slot == "Melee" end,
        IsTraitEligible = function(data) return data.Name ~= "Ineligible" end,
        HasTraitRequirements = function(name) return name ~= "Unmet" end,
        TraitRequirements = { Unmet = {}, Met = {} },
        TraitData = nativeGame.anyTraitDeclarations(),
        GetUpgradedRarity = function(rarity) if rarity ~= "Heroic" then return "Epic" end end,
        GetTraitCount = function(_, args) return args.Name == "ZeusWeaponBoon" and 2 or 0 end,
        GetTotalHeroTraitValue = function(name)
            if name == "ExchangeLevelBonus" then return 2 end
            if name == "FatedPomLevelBonus" then return 1 end
            return 0
        end,
        IsFateValid = function() return true end,
        IsGodTrait = function(name) return name ~= "NotGod" end,
        IsGameStateEligible = function(spell) return spell.Name ~= "Locked" end,
        SpellData = { Open = { Name = "Open" }, Locked = { Name = "Locked", GameStateRequirements = {} } },
    })
    _G.TraitData.SlotBoon = { Name = "SlotBoon", Slot = "Melee" }
    _G.TraitData.Excluded = { Name = "Excluded", ExcludeTraitFromLastRunBoonPool = true }
end

function TestScreenChecks:tearDown()
    self.restore()
end

local function boostedGodLoot()
    return {
        Name = "ZeusUpgrade", GodLoot = true, RarityBoosted = true, UseSwapTrait = true,
    }
end

local exchangeOffer = {
    kind = "traits",
    options = { { key = "ZeusSpecialBoon", effectiveLevel = 4, replacement = {
        slot = "Melee", replacedTraitKey = "ZeusWeaponBoon", oldRarity = "Rare",
        newTraitKey = "ZeusSpecialBoon", requiredRarity = "Epic",
    } } },
}

local function removeTrait(name)
    local traits = _G.CurrentRun.Hero.Traits
    for index = #traits, 1, -1 do
        if traits[index].Name == name then table.remove(traits, index) end
    end
end

function TestScreenChecks.testAgreeingExpectationRecordsNothing()
    lu.assertEquals(checks.expectation({
        hymnUses = 1, yarnUses = 2, consumesHymn = true, consumesYarn = true, consumesOrdinary = false,
        concaveStone = { uses = 1, giverProcs = true }, rarifyUses = 2,
    }, boostedGodLoot()), {})
    lu.assertEquals(checks.expectation({ rarityFloor = true }), {})
end

function TestScreenChecks.testEachDisagreeingFieldNamesItsCheckpoint()
    table.insert(_G.CurrentRun.Hero.Traits, { Name = "ChaosCommonCurse", ForceCommon = true })
    local loot = { Name = "HermesUpgrade", TreatAsGodLootByShops = true, BlockDoubleBoon = true,
        ForceCommon = true }
    local problems = checks.expectation({
        hymnUses = 0, yarnUses = 1, consumesHymn = true, consumesYarn = true, consumesOrdinary = false,
        concaveStone = { uses = 0, giverProcs = true }, rarifyUses = 1, rarityFloor = false,
    }, loot)
    lu.assertEquals(checkpoints(problems), {
        "trait-screen-hymn", "trait-screen-yarn", "trait-screen-hymn-spend", "trait-screen-yarn-spend",
        "trait-screen-ordinary-spend", "trait-screen-concave-stone", "trait-screen-concave-stone-giver",
        "trait-screen-rarify", "trait-screen-rarity-floor",
    })
    lu.assertEquals(problems[1], { checkpoint = "trait-screen-hymn", expected = 0, observed = 1 })
    lu.assertEquals(problems[2], { checkpoint = "trait-screen-yarn", expected = 1, observed = 2 })
end

-- Two god loots rolled while Hymn was held both keep UseSwapTrait; only the
-- first screen spends it.
function TestScreenChecks.testAStickyHymnFlagDoesNotSpendTwice()
    local first, second = boostedGodLoot(), boostedGodLoot()
    lu.assertEquals(checks.expectation({ hymnUses = 1, consumesHymn = true }, first), {})
    removeTrait("LimitedSwapBonusTrait")
    lu.assertEquals(checks.expectation({ hymnUses = 0, consumesHymn = false }, second), {})
end

function TestScreenChecks.testAStickyOrdinaryFlagDoesNotSpendTwice()
    table.insert(_G.CurrentRun.Hero.Traits, { Name = "ChaosCommonCurse", ForceCommon = true })
    local first = { Name = "ZeusUpgrade", GodLoot = true, ForceCommon = true }
    local second = { Name = "ApolloUpgrade", GodLoot = true, ForceCommon = true }
    lu.assertEquals(checks.expectation({ consumesOrdinary = true }, first), {})
    removeTrait("ChaosCommonCurse")
    lu.assertEquals(checks.expectation({ consumesOrdinary = false }, second), {})
    local firstRun = { GodLoot = true, ForceCommon = true, ForceCommonWithoutCurse = true }
    lu.assertEquals(checks.expectation({ consumesOrdinary = false, consumesYarn = false }, firstRun), {})
end

function TestScreenChecks.testEligibilityNeverRollsChanceToPlay()
    local requirements = setmetatable({ ChanceToPlay = 0.1, { Path = { "GameState" } } }, {})
    _G.TraitData.Chancy = { Name = "Chancy", GameStateRequirements = requirements }
    _G.IsTraitEligible = function(data)
        if data.GameStateRequirements and data.GameStateRequirements.ChanceToPlay ~= nil then
            error("ChanceToPlay read")
        end
        return true
    end
    _G.IsGameStateEligible = function(_, given)
        if given.ChanceToPlay ~= nil then error("ChanceToPlay read") end
        return true
    end
    _G.SpellData.Chancy = { Name = "Chancy", GameStateRequirements = requirements }
    lu.assertEquals(checks.chaosRows({ kind = "chaos", blessingKey = "Chancy", curseOptions = {} }), {})
    lu.assertEquals(checks.ordinaryRows({ kind = "traits", options = { { key = "Chancy" } } }, {}), {})
    lu.assertEquals(checks.echoLastRunRows({ options = { { key = "Chancy" } } }), {})
    lu.assertEquals(checks.spellRows({ "Chancy" }, {}), {})
    lu.assertEquals(requirements.ChanceToPlay, 0.1)
end

function TestScreenChecks.testRarifyReadsTheLootSpecificSourceFirstAndFate()
    table.insert(_G.CurrentRun.Hero.Traits, { Name = "ForceZeusBoonKeepsake",
        RarityUpgradeData = { LootName = "ZeusUpgrade", Uses = 0 } })
    lu.assertEquals(checks.expectation({ rarifyUses = 0 }, boostedGodLoot()), {})
    lu.assertEquals(checks.expectation({ rarifyUses = 2 }, { Name = "ApolloUpgrade", GodLoot = true }), {})
    _G.IsFateValid = function() return false end
    lu.assertEquals(checks.expectation({ rarifyUses = 0 }, { Name = "ApolloUpgrade", GodLoot = true }), {})
end

function TestScreenChecks.testNativeErrorsAreFaultsAndOtherFindingsMismatches()
    _G.HasHeroTraitValue = function() error("boom") end
    local problems = checks.expectation({ hymnUses = 1 }, nil)
    lu.assertTrue(problems[1].fault)
    lu.assertEquals(problems[1].expected, "HasHeroTraitValue")
    lu.assertStrContains(problems[1].observed, "boom")
    local raised = {}
    local session = {
        fault = function(_, value) raised[#raised + 1] = { "fault", value.checkpoint, value.expected } end,
        mismatch = function(_, checkpoint, expected, observed)
            raised[#raised + 1] = { "mismatch", checkpoint, expected, observed }
        end,
    }
    lu.assertTrue(checks.report(session, {}, problems))
    lu.assertTrue(checks.report(session, {}, { { checkpoint = "trait-screen-yarn", expected = 1, observed = 0 } }))
    lu.assertFalse(checks.report(session, {}, {}))
    lu.assertEquals(raised, {
        { "fault", "native-api", "HasHeroTraitValue" },
        { "mismatch", "trait-screen-yarn", 1, 0 },
    })
end

function TestScreenChecks.testOrdinaryRowsUseTheNativeHelpers()
    local offer = { kind = "traits", options = {
        { key = "Fresh" }, { key = "ZeusWeaponBoon" }, { key = "Ineligible" }, { key = "Unmet" },
        { key = "SlotBoon" }, { key = "Met" },
    } }
    local problems = checks.ordinaryRows(offer, {})
    lu.assertEquals(problems, {
        { checkpoint = "trait-screen-row", expected = "ZeusWeaponBoon", observed = "held" },
        { checkpoint = "trait-screen-row", expected = "Ineligible", observed = "IsTraitEligible" },
        { checkpoint = "trait-screen-row", expected = "Unmet", observed = "HasTraitRequirements" },
        { checkpoint = "trait-screen-row", expected = "SlotBoon", observed = "slot filled" },
    })
    lu.assertEquals(checks.ordinaryRows({ kind = "fallbackGold" }, {}), {})
end

function TestScreenChecks.testExchangeRowsCheckTheTargetRarityAndNativeLevel()
    lu.assertEquals(checks.ordinaryRows(exchangeOffer, {}), {})
    local stale = { kind = "traits", options = { { key = "ZeusSpecialBoon", effectiveLevel = 3, replacement = {
        slot = "Melee", replacedTraitKey = "Missing", oldRarity = "Heroic",
        newTraitKey = "ZeusSpecialBoon", requiredRarity = "Epic",
    } } } }
    lu.assertEquals(checks.ordinaryRows(stale, {}), {
        { checkpoint = "trait-screen-row", expected = "ZeusSpecialBoon", observed = "exchange target not held" },
        { checkpoint = "trait-screen-row", expected = "ZeusSpecialBoon",
            observed = "exchange rarity cannot upgrade" },
        { checkpoint = "trait-screen-exchange-level", expected = 3, observed = 2 },
    })
end

function TestScreenChecks.testPomLevelAddsTheFatedBonusTheModuleMasksLater()
    lu.assertEquals(checks.pomLevel({ levelCount = 3 }, { StackNum = 2 }), {})
    lu.assertEquals(checks.pomLevel({ levelCount = 2 }, {}), {})
    _G.IsFateValid = function() return false end
    lu.assertEquals(checks.pomLevel({ levelCount = 3 }, { StackNum = 2 }),
        { { checkpoint = "trait-screen-pom-level", expected = 3, observed = 2 } })
end

function TestScreenChecks.testChaosSpellAndEchoRowsUseTheirNativeFilters()
    lu.assertEquals(checks.chaosRows({ kind = "chaos", blessingKey = "Ineligible",
        curseOptions = { { curseKey = "Fine" } } }),
        { { checkpoint = "trait-screen-row", expected = "Ineligible", observed = "IsTraitEligible" } })
    lu.assertEquals(checks.spellRows({ "Open", "Locked" }, {}),
        { { checkpoint = "trait-screen-row", expected = "Locked", observed = "IsGameStateEligible" } })
    lu.assertEquals(checks.spellRows({ "Locked" }, { StripRequirements = true }), {})
    _G.SessionMapState = { SelectedSpells = { "Locked" } }
    lu.assertEquals(checks.spellRows({ "Locked" }, {}), {})
    _G.SessionMapState = nil
    local problems = checks.echoLastRunRows({
        options = { { key = "Fresh" }, { key = "ZeusWeaponBoon" }, { key = "NotGod" }, { key = "SlotBoon" },
            { key = "Excluded" } },
        expectation = { rarityFloor = false },
    })
    lu.assertEquals(problems, {
        { checkpoint = "trait-screen-row", expected = "ZeusWeaponBoon", observed = "held" },
        { checkpoint = "trait-screen-row", expected = "NotGod", observed = "IsGodTrait" },
        { checkpoint = "trait-screen-row", expected = "SlotBoon", observed = "slot filled" },
        { checkpoint = "trait-screen-row", expected = "Excluded", observed = "excluded from last-run pool" },
        { checkpoint = "trait-screen-rarity-floor", expected = false, observed = true },
    })
end

function TestScreenChecks.testADifferingScreenStopsThePlanBeforeItsRowsInstall()
    local callbacks, _, completed, records = traitSupport.attached({
        kind = "traits", selected = "option1", options = { { key = "Fresh", rarity = "Common" } },
        expectation = { hymnUses = 1, consumesYarn = false },
    })
    local loot = { GodLoot = true, Name = "ApolloUpgrade", UpgradeOptions = {}, RarityBoosted = true }
    callbacks.SpawnRoomReward(nil, {}, function()
        local created = callbacks.CreateLoot(nil, {}, function() return loot end, {})
        callbacks.HandleLootPickup(nil, {}, function() return true end, {}, created, {})
        return created
    end, {}, {})
    callbacks.CreateBoonLootButtons(nil, {}, function() return true end, {}, loot, false, {})
    lu.assertEquals(loot.UpgradeOptions, {})
    lu.assertEquals(completed(), 0)
    lu.assertEquals(records(), {
        { checkpoint = "trait-screen-yarn-spend", expected = false, observed = true },
    })
end

return TestScreenChecks
