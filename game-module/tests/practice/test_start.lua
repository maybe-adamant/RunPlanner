-- luacheck: globals TestPracticeStart
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local nativeGame = require("tests/harness/native_game")
local support = require("tests.harness.hook_composition")
local json = require("mods/protocol/json")
local decoder = require("mods.protocol.decoder")
local session = require("mods.runtime.session")
local loadoutSession = require("mods.loadout.session")
local loadoutHooks = require("mods.loadout.hooks")
local roomCoordinator = require("mods.room.coordinator")
local admission = require("mods.room.conformance.admission")
local readers = require("mods.room.conformance.readers")
local install = require("mods.practice.install")
local practiceHooks = require("mods.practice.hooks")

TestPracticeStart = {}

local function decode(name)
    local file = assert(io.open(fixtures.path(name .. ".execution.json"), "rb"))
    local plan = assert(decoder.decode(assert(json.decode(file:read("*a")))))
    file:close()
    return plan
end

local function copy(value)
    if type(value) ~= "table" then return value end
    local result = {}
    for key, item in pairs(value) do result[key] = copy(item) end
    return result
end

local function indexOf(values, wanted)
    for index, value in ipairs(values) do if value == wanted then return index end end
    return nil
end

-- A native hero and run whose trait functions record each contact. Max
-- health and Magick are the declared base plus every flat property change.
local function nativeWorld(base, start)
    local log, hero = {}, {
        Traits = {}, TraitDictionary = { BaseStaffAspect = { { Name = "BaseStaffAspect", Rarity = "Common" } } },
        MaxHealth = 0, MaxMana = 0, Health = 1,
    }
    hero.Traits[1] = hero.TraitDictionary.BaseStaffAspect[1]
    local run = { Hero = hero, TemporaryMetaUpgrades = {}, ShrineUpgradesDisabled = {}, RewardStores = {},
        KeepsakeCache = {} }
    local gameState = {
        LastWeaponUpgradeName = { WeaponStaffSwing = "BaseStaffAspect" },
        LastAwardTrait = "ManaOverTimeRefundKeepsake", EquippedFamiliar = "FrogFamiliar",
        ShrineUpgrades = {}, MetaUpgradeState = {}, TraitsTaken = { BaseStaffAspect = true },
        Resources = { Money = 0 }, RunHistory = {},
    }
    local traitData = setmetatable({
        StorePendingDeliveryItem = { Name = "StorePendingDeliveryItem", RemainingUses = 3, UsesAsEncounters = true },
        SkipEncounterKeepsake = { AcquireFunctionArgs = { SkipEncounterChance = 0.37 } },
    }, { __index = function(declarations, key)
        local declaration = { Name = key }
        rawset(declarations, key, declaration)
        return declaration
    end })
    local function record(...) log[#log + 1] = table.concat({ ... }, ":") end
    -- The game's own globals, apart from the module environment: native
    -- functions read what the install sets only through this table.
    local presentationOff = function() error("max-stat presentation is not part of the install") end
    local roomData = { N_Opening01 = { NextRoomSet = { "N" } }, N_PostBoss01 = { NextRoomSet = { "O" } },
        I_PreBoss02 = { Name = "I_PreBoss02" } }
    local nativeGlobals = { RoomData = roomData, MaxHealthIncreaseText = presentationOff,
        BonusHealthAndManaPresentation = presentationOff, InCombatTextArgs = presentationOff }
    local function index(trait)
        hero.TraitDictionary[trait.Name] = hero.TraitDictionary[trait.Name] or {}
        table.insert(hero.TraitDictionary[trait.Name], trait)
        hero.Traits[#hero.Traits + 1] = trait
    end
    local function remove(name)
        hero.TraitDictionary[name] = nil
        for position = #hero.Traits, 1, -1 do
            if hero.Traits[position].Name == name then table.remove(hero.Traits, position) end
        end
    end
    local function validate(property)
        local total = base[property]
        for _, trait in ipairs(hero.Traits) do
            for _, change in ipairs(trait.PropertyChanges or {}) do
                if change.LuaProperty == property then total = total + change.ChangeValue end
            end
        end
        hero[property] = total
    end
    local bindings = {
        GameState = gameState,
        TraitData = traitData,
        game = nativeGlobals,
        RoomData = roomData,
        TraitRarityData = { RarityUpgradeOrder = { "Common", "Rare", "Epic", "Heroic" } },
        MetaUpgradeCardData = {}, MetaUpgradeData = {},
        SpellData = { PotionSpell = { Name = "PotionSpell", TraitName = "SpellPotionTrait" } },
        RewardStoreData = (function()
            local stores = {}
            for _, store in ipairs(start and start.rewardStores or {}) do
                stores[store.name] = {}
                for position = 1, #store.remainingEntryCounts do
                    stores[store.name][position] = { Name = store.name .. position }
                end
            end
            return stores
        end)(),
        GetEquippedWeapon = function() return "WeaponStaffSwing" end,
        -- ShrineLogic.GetNumShrineUpgrades: a vow Circe disabled counts zero.
        GetNumShrineUpgrades = function(name)
            if run.ShrineUpgradesDisabled[name] then return 0 end
            return gameState.ShrineUpgrades[name] or 0
        end,
        RunShopGeneration = function(room)
            local mapRoom = nativeGlobals.roomData
            record("shop", room.Name, tostring(mapRoom and mapRoom.Name))
        end,
        GetProcessedTraitData = function(args)
            local data = { Name = args.TraitName, Rarity = args.Rarity, StackNum = args.StackNum }
            if args.TraitName == "RoomRewardMaxHealthTrait" or args.TraitName == "RoomRewardMaxManaTrait" then
                local property = args.TraitName == "RoomRewardMaxHealthTrait" and "MaxHealth" or "MaxMana"
                data.PropertyChanges = { { LuaProperty = property, ChangeValue = 25 } }
            end
            if args.TraitName == "SpellPotionTrait" then data.MaxUses = 3 end
            if args.TraitName:match("^Chaos") then data.PropertyChanges, data.RarityBonus = { {}, {} }, {} end
            if args.TraitName == "FocusLastStandBoon" then data.AcquireFunctionArgs = { Name = "Athena" } end
            -- TraitData_Essence: each <Element>Essence inherits its element boon's Elements.
            local essence = args.TraitName:match("^(%u%l+)Essence$")
            if essence then data.Elements = { essence } end
            return data
        end,
        AddTraitToHero = function(args)
            local trait = args.TraitData
            record("add", trait.Name, tostring(trait.Rarity))
            lu.assertTrue(args.SkipNewTraitHighlight and args.SkipQuestStatusCheck and args.SkipActivatedTraitUpdate
                and args.SkipSetup)
            lu.assertNil(args.FromLoot)
            gameState.TraitsTaken[trait.Name] = true
            index(trait)
            for _, change in ipairs(trait.PropertyChanges or {}) do
                if change.LuaProperty == "MaxHealth" then nativeGlobals.MaxHealthIncreaseText() end
            end
            return trait
        end,
        EquipKeepsake = function(_, name, args)
            record("equip", name, tostring(args.ForceRarity), tostring(args.FromLoot))
            index({ Name = name, Rarity = args.ForceRarity, Slot = "Keepsake" })
            table.insert(run.KeepsakeCache, name)
        end,
        GetHeroTrait = function(name) return hero.TraitDictionary[name] and hero.TraitDictionary[name][1] end,
        HeroHasTrait = function(name) return hero.TraitDictionary[name] ~= nil end,
        GetTraitCount = function(_, args)
            local trait = hero.TraitDictionary[args.Name] and hero.TraitDictionary[args.Name][1]
            return trait and (trait.StackNum or 1) or 0
        end,
        RemoveTrait = function(_, name) record("remove", name) remove(name) end,
        RemoveWeaponTrait = function(name) record("remove", name) remove(name) end,
        IncreaseTraitLevel = function(trait, stacks) record("level", trait.Name, tostring(stacks)) end,
        AddLastStand = function(args) record("lastStand", tostring(args.Name)) end,
        -- TraitLogic.UpdateHeroTraitDictionary's element tally.
        UpdateHeroTraitDictionary = function()
            hero.Elements = { Aether = 0, Earth = 0, Air = 0, Fire = 0, Water = 0 }
            for _, trait in ipairs(hero.Traits) do
                for _, element in ipairs(trait.Elements or {}) do
                    hero.Elements[element] = hero.Elements[element] + 1
                end
            end
        end,
        CallFunctionName = function(name) record("call", name) end,
        ShrineUpgradeExtractValues = function() end,
        GetTotalHeroTraitValue = function(name) return name == "BonusSpellUses" and 1 or 0 end,
        CreateTalentTree = function() return { Name = "Lung", { [2] = { Name = "PotionManaRestoreTalent" } } } end,
        DeepCopyTable = copy,
        UpdateTalentPointInvestedCache = function() record("investedCache") end,
        GetSurfaceShopText = function(item) return item.Name end,
        UnequipMetaUpgrades = function() record("unequipArcana") end,
        UpdateMoneyUI = function() record("moneyUI") end,
        ValidateMaxHealth = function() validate("MaxHealth") end,
        ValidateMaxMana = function() validate("MaxMana") end,
    }
    return { log = log, hero = hero, run = run, gameState = gameState, bindings = bindings,
        nativeGlobals = nativeGlobals, presentationOff = presentationOff }
end

local function recordingHexTree(log)
    return {
        attach = function() end,
        realize = function(expected, traitKey, _, action)
            log[#log + 1] = "hexTree:" .. traitKey .. ":" .. expected.layoutKey
            return action()
        end,
    }
end

-- Runs native StartNewRun's order of contacts (RunLogic.lua:439-532) through
-- the loadout and practice hooks.
local function startRun(plan, world, startArgs)
    local restore = nativeGame.install(world.bindings)
    local priorImport = _G.import
    _G.import = function(path) return require((path:gsub("%.lua$", ""):gsub("/", "."))) end
    local state = session.create()
    local module, _, callbacks = support.capture()
    local inbox = { load = function() return true, plan end, status = function() return {} end }
    local function getState() return state end
    local hexTree = recordingHexTree(world.log)
    loadoutHooks.attach(module, {
        inbox = inbox, session = session, loadout = loadoutSession, activePlanSlot = function() return 1 end,
    }, getState, function() end, roomCoordinator, hexTree)
    local scope = practiceHooks.attach(module, session, getState, function() end, loadoutSession, hexTree)
    _G.import = priorImport
    local created
    local ok, errorValue = pcall(callbacks.StartNewRun, nil, {}, function(previousRun, args)
        _G.CurrentRun = world.run
        callbacks.CreateNewHero(nil, {}, function() return world.hero end, previousRun, args)
        callbacks.EquipKeepsake(nil, {}, _G.EquipKeepsake, world.hero, _G.GameState.LastAwardTrait,
            { FromLoot = true, SkipNewTraitHighlight = true, AddToCache = true })
        callbacks.EquipMetaUpgrades(nil, {}, function() world.log[#world.log + 1] = "equipArcana" end,
            world.hero, { SkipNewTraitHighlight = true })
        world.log[#world.log + 1] = "rerollsAndDeathDefiance"
        callbacks.InitializeRewardStores(nil, {}, function(run)
            run.RewardStores = { Native = {} }
            world.log[#world.log + 1] = "initializeRewardStores"
        end, world.run)
        created = { args = copy(args), creating = scope.creatingStartRoom(state, args),
            useRecord = copy(world.run.UseRecord) }
        world.log[#world.log + 1] = "createRoom"
        if args.RoomName ~= nil then world.run.CurrentRoom = { Name = args.RoomName } end
        world.gameState.Resources.Money = world.gameState.Resources.Money + 10
        return world.run
    end, nil, startArgs)
    restore()
    assert(ok, errorValue)
    return state, callbacks, created
end

local function position(log, entry)
    return indexOf(log, entry) or error("missing " .. entry)
end

function TestPracticeStart.testOpeningRunOverridesCarryTheRouteRecords()
    local start = decode("surface-start-q-opening").startState
    local restore = nativeGame.install({ RoomData = {
        N_Opening01 = { NextRoomSet = { "N" }, RoomSetName = "N" }, N_PreHub01 = { RoomSetName = "N" },
    } })
    local overrides = install.runOverrides(start, "Surface")
    restore()
    lu.assertEquals(#overrides.RoomHistory, #start.roomHistory)
    lu.assertEquals(overrides.RoomHistory[1], { Name = "N_Opening01", RoomSetName = "N", NextRoomSet = { "N" } })
    lu.assertEquals(overrides.RoomHistory[2], { Name = "N_PreHub01", RoomSetName = "N" })
    -- An undeclared NextRoomSet still marks the biome boundary.
    lu.assertEquals(overrides.RoomHistory[26], { Name = "N_PostBoss01", NextRoomSet = {} })
    lu.assertEquals(overrides.EnteredBiomes, 3)
    lu.assertEquals(overrides.BiomeVisitOrder, { "N", "O", "P" })
    lu.assertEquals(overrides.BiomesReached, { N = true, O = true, P = true })
    lu.assertEquals({ overrides.EncounterDepth, overrides.LastDevotionDepth }, { 19, 30 })
    lu.assertTrue(overrides.RunPlannerPracticeStart)
    lu.assertEquals({ overrides.RunPlannerPracticeStartRoom, overrides.RunPlannerPracticeStartHistory },
        { "Q_Intro", #start.roomHistory })
    lu.assertNil(overrides.DreamBiomePool)
end

function TestPracticeStart.testDreamOpeningEntersAsALaterDreamBiome()
    local plan = decode("dream-start-n-opening")
    local overrides = install.runOverrides(plan.startState, plan.routeKey)
    lu.assertEquals(overrides.DreamBiomePool, { "G", "H", "I", "O", "P" })
    lu.assertEquals(overrides.PrevDreamBiome, "F")
    lu.assertEquals(overrides.EnteredBiomes, 2)
    -- Native Dream history starts with the Dream_Intro prologue.
    lu.assertEquals(overrides.RoomHistory[1], { Name = "Dream_Intro", NextRoomSet = {} })
    lu.assertEquals(overrides.RoomHistory[2].Name, "Q_Intro")
    local args = { RoomName = "Dream_Intro", RoomOverrides = { Kept = true } }
    install.redirect(args, plan.startState, plan.routeKey)
    lu.assertEquals(args, {
        RoomName = "N_Opening01", SkipChooseReward = true,
        RoomOverrides = { Kept = true, ForcedEntranceFunctionName = "RoomEntranceDreamBiomeStart" },
    })
end

function TestPracticeStart.testOpeningInstallsBeforeNativeRerollsAndRecordsBeforeTheStartRoom()
    local plan = decode("surface-start-q-opening")
    local start = plan.startState
    local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 }, start)
    local state, _, created = startRun(plan, world, { StartingBiome = "F" })
    local log = world.log

    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(state.route.index, indexOf(plan.selectedOccurrenceIds, start.occurrenceId))
    lu.assertEquals(created.args.RoomName, "Q_Intro")
    lu.assertTrue(created.creating)
    -- The slotted keepsake is equipped at its rank without its acquire effect.
    lu.assertEquals(log[1], "equip:ManaOverTimeRefundKeepsake:Epic:nil")
    local arcana, rerolls = position(log, "equipArcana"), position(log, "rerollsAndDeathDefiance")
    for _, row in ipairs(start.traits) do
        local added = position(log, "add:" .. row.name .. ":" .. tostring(row.rarity))
        lu.assertTrue(arcana < added and added < rerolls)
    end
    lu.assertTrue(position(log, "add:RoomRewardMaxHealthTrait:nil") < rerolls)
    lu.assertTrue(position(log, "hexTree:SpellPotionTrait:Lung") < rerolls)
    lu.assertTrue(rerolls < position(log, "initializeRewardStores"))
    -- Native presentation is silenced in the game's globals, then restored.
    lu.assertIs(world.nativeGlobals.MaxHealthIncreaseText, world.presentationOff)
    lu.assertIs(world.nativeGlobals.InCombatTextArgs, world.presentationOff)

    local hero, run = world.hero, world.run
    local health = hero.TraitDictionary.RoomRewardMaxHealthTrait[1]
    local mana = hero.TraitDictionary.RoomRewardMaxManaTrait[1]
    lu.assertEquals({ health.PropertyChanges[1].ChangeValue, mana.PropertyChanges[1].ChangeValue }, { 80, 135 })
    lu.assertNil(mana.Source)
    local delivery = hero.TraitDictionary.StorePendingDeliveryItem[1]
    lu.assertEquals(delivery.RemainingUses, 8)
    lu.assertEquals(delivery.OnExpire.SpawnShopItem, {
        Name = "MaxManaDrop", Type = "Consumable", ResourceCosts = { Money = 0 }, CostOverride = 0,
        PendingShopItem = true,
    })
    lu.assertEquals(hero.SlottedSpell.Talents.Name, "Lung")
    lu.assertEquals(hero.TraitDictionary.SpellPotionTrait[1].RemainingUses, 4)
    lu.assertEquals(world.gameState.TraitsTaken, { BaseStaffAspect = true })

    lu.assertEquals(#run.RoomHistory, #start.roomHistory)
    lu.assertEquals({ run.EnteredBiomes, run.EncounterDepth, run.LastDevotionDepth }, { 3, 19, 30 })
    lu.assertTrue(run.RunPlannerPracticeStart)
    lu.assertEquals(run.UseRecord, start.useRecord)
    lu.assertEquals(run.ConsumableRecord, start.consumableRecord)
    lu.assertEquals(run.KeepsakeCache, { "ManaOverTimeRefundKeepsake" })
    lu.assertEquals(run.NumTalentPoints, 0)
    lu.assertEquals(#run.RewardStores.RunProgress, 14)
    lu.assertEquals(run.RewardStores.RunProgress[1], { Name = "RunProgress5" })
    lu.assertEquals(run.RewardStores.RunProgress[10], { Name = "RunProgress17" })
    lu.assertEquals(run.RewardStores.RunProgress[14], { Name = "RunProgress14" })
    lu.assertNotNil(run.RewardStores.Native)
    -- The authored gold is added to the gold native StartNewRun credited.
    lu.assertEquals(world.gameState.Resources.Money, 130)
    lu.assertEquals(state.practiceStart.phase, "started")
end

function TestPracticeStart.testCollectedEssencesInstallAsHiddenEssenceTraits()
    local plan = copy(decode("surface-start-q-opening"))
    lu.assertEquals(plan.startState.elementEssences, { Fire = 0, Air = 0, Earth = 1, Water = 0 })
    plan.startState.elementEssences = { Fire = 2, Air = 0, Earth = 1, Water = 3 }
    local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 }, plan.startState)
    startRun(plan, world, { StartingBiome = "F" })
    local function held(name) return #(world.hero.TraitDictionary[name] or {}) end
    lu.assertEquals({ held("FireEssence"), held("AirEssence"), held("EarthEssence"), held("WaterEssence") },
        { 2, 0, 1, 3 })
    lu.assertEquals(held("ElementalEssence"), 0)
    lu.assertEquals(readers.read("elementCounts", world.run),
        { Aether = 0, Earth = 1, Air = 0, Fire = 2, Water = 3 })
end

-- RunLogic.GetBiomeDepth: rooms since the last NextRoomSet, the current one
-- included.
local function nativeBiomeDepth(run)
    local depth = 1
    for index = #run.RoomHistory, 1, -1 do
        if run.RoomHistory[index].NextRoomSet ~= nil then return depth end
        depth = depth + 1
    end
    return depth
end

-- The map load's UpdateRunHistoryCache (PatchLogic.lua:687-689), then native
-- StartRoom: hero setup, the room's own start effects and its presentation
-- (RoomLogic.lua:1114-1119).
local function enterStartRoom(name, mutate, base, roomStart)
    local plan = copy(decode(name))
    local world = nativeWorld(base or { MaxHealth = 70, MaxMana = 190 }, plan.startState)
    if mutate then mutate(plan, world) end
    local state, callbacks = startRun(plan, world, { StartingBiome = "F" })
    local restore = nativeGame.install(world.bindings)
    _G.CurrentRun = world.run
    world.run.BiomeDepthCache = nativeBiomeDepth(world.run)
    local setup, presented = nil, false
    callbacks.SetupHeroObject(nil, {}, function(room, applyLuaUpgrades)
        setup = { room.Name, applyLuaUpgrades }
    end, { Name = plan.startState.roomName }, false)
    if roomStart then roomStart(world) end
    callbacks.StartRoomPresentation(nil, {}, function() presented = true end, world.run, {})
    restore()
    return state, world, setup, presented, callbacks
end

local function withAdmission(result, action)
    local verify, calls = admission.verify, {}
    admission.verify = function(occurrence, startingLoadout, prefix)
        calls[#calls + 1] = { occurrence = occurrence.id, weapon = startingLoadout.weaponKey, prefix = prefix }
        if result == true then return true end
        return nil, result
    end
    local ok, errorValue = pcall(action)
    admission.verify = verify
    assert(ok, errorValue)
    return calls
end

function TestPracticeStart.testStartRoomForcesHeroSetupAndPassesTheSelfCheck()
    local state, world, setup, presented
    local calls = withAdmission(true, function()
        state, world, setup, presented = enterStartRoom("surface-start-q-opening")
    end)
    lu.assertEquals(setup, { "Q_Intro", true })
    lu.assertEquals({ world.hero.MaxHealth, world.hero.MaxMana, world.hero.Health }, { 150, 325, 150 })
    lu.assertEquals(calls, { { occurrence = "surface-q-intro", weapon = "WeaponStaffSwing", prefix = "practice-start" } })
    lu.assertTrue(presented)
    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(state.practiceStart.phase, "checked")
end

function TestPracticeStart.testMaxStatMismatchMakesExecutionPassive()
    local state, presented
    local calls = withAdmission(true, function()
        local entered = table.pack(enterStartRoom("surface-start-q-opening", nil, { MaxHealth = 70, MaxMana = 180 }))
        state, presented = entered[1], entered[4]
    end)
    lu.assertTrue(presented)
    lu.assertEquals(calls, {})
    lu.assertEquals(state.state, "desynchronized")
    lu.assertEquals(state.firstMismatch, { checkpoint = "practice-start:max-mana", expected = 325, observed = 315 })
end

-- A Centaur threshold or an Echo replay at the start Intro changes the maxima
-- after hero setup, where the check has already read them.
function TestPracticeStart.testIntroMaxStatEffectsFollowTheSelfCheck()
    local state, world
    withAdmission(true, function()
        state, world = enterStartRoom("surface-start-q-opening", nil, nil, function(nativeWorldState)
            nativeWorldState.hero.MaxHealth = nativeWorldState.hero.MaxHealth + 25
            nativeWorldState.hero.MaxMana = nativeWorldState.hero.MaxMana + 30
        end)
    end)
    lu.assertEquals({ world.hero.MaxHealth, world.hero.MaxMana }, { 175, 355 })
    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(state.practiceStart.phase, "checked")
end

function TestPracticeStart.testSelfCheckErrorIsAFault()
    local state, presented
    local verify = admission.verify
    admission.verify = function() error("reader failed") end
    local ok, errorValue = pcall(function()
        local entered = table.pack(enterStartRoom("surface-start-q-opening"))
        state, presented = entered[1], entered[4]
    end)
    admission.verify = verify
    assert(ok, errorValue)
    lu.assertTrue(presented)
    lu.assertEquals(state.state, "faulted")
    lu.assertEquals(state.firstFault.checkpoint, "practice-start:self-check")
end

-- After Save & Quit the start room is entered again by a fresh process whose
-- execution is not admitted; the run's own fields still force hero setup.
function TestPracticeStart.testResumedStartRoomForcesHeroSetupWithoutExecution()
    local _, world
    withAdmission(true, function() _, world = enterStartRoom("surface-start-q-opening") end)
    local module, _, callbacks = support.capture()
    local passive = session.create()
    practiceHooks.attach(module, session, function() return passive end, function() end, loadoutSession,
        recordingHexTree({}))
    local restore = nativeGame.install(world.bindings)
    _G.CurrentRun = world.run
    world.hero.MaxHealth, world.hero.Health = 70, 10
    local calls = {}
    local function nativeSetup(room, applyLuaUpgrades) calls[#calls + 1] = { room.Name, applyLuaUpgrades } end
    callbacks.SetupHeroObject(nil, {}, nativeSetup, { Name = "Q_Intro" }, false)
    local resumed = { world.hero.MaxHealth, world.hero.Health }
    -- RestoreUnlockRoomExits, and any later room, keep native setup.
    callbacks.SetupHeroObject(nil, {}, nativeSetup, { Name = "Q_Intro" }, nil)
    table.insert(world.run.RoomHistory, { Name = "Q_Intro" })
    callbacks.SetupHeroObject(nil, {}, nativeSetup, { Name = "Q_Intro" }, false)
    restore()
    lu.assertEquals(resumed, { 150, 150 })
    lu.assertEquals(calls, { { "Q_Intro", true }, { "Q_Intro" }, { "Q_Intro", false } })
    lu.assertNil(passive.practiceStart)
end

function TestPracticeStart.testConformanceFamilyMismatchMakesExecutionPassive()
    local state
    withAdmission({ checkpoint = "practice-start:traitInventory", expected = "planned", observed = "native" },
        function() state = enterStartRoom("surface-start-q-opening") end)
    lu.assertEquals(state.state, "desynchronized")
    lu.assertEquals(state.firstMismatch.checkpoint, "practice-start:traitInventory")
end

function TestPracticeStart.testDreamStartRedirectsWithTheDreamEntrance()
    local plan = decode("dream-start-n-opening")
    local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 }, plan.startState)
    world.run.IsDreamRun = true
    local state, _, created = startRun(plan, world, { RoomName = "Dream_Intro", StartingBiome = "F" })
    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(state.route.index, indexOf(plan.selectedOccurrenceIds, "N:start"))
    lu.assertEquals(created.args.RoomName, "N_Opening01")
    lu.assertTrue(created.args.SkipChooseReward)
    lu.assertEquals(created.args.RoomOverrides.ForcedEntranceFunctionName, "RoomEntranceDreamBiomeStart")
    lu.assertEquals(world.run.DreamBiomePool, { "G", "H", "I", "O", "P" })
    -- Without an authored gold amount only native starting gold remains.
    lu.assertEquals(world.gameState.Resources.Money, 10)
end

function TestPracticeStart.testLoadoutMismatchLeavesANativeRunUninstalled()
    local plan = decode("surface-start-q-opening")
    local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 })
    world.bindings.GetEquippedWeapon = function() return "WeaponDagger" end
    local state, _, created = startRun(plan, world, { StartingBiome = "F" })
    lu.assertEquals(state.firstMismatch.checkpoint, "starting-weapon")
    -- The run-start keepsake equip stays native, with its acquire effect.
    lu.assertEquals(world.log[1], "equip:ManaOverTimeRefundKeepsake:nil:true")
    lu.assertNil(created.args.RoomName)
    lu.assertFalse(created.creating)
    lu.assertNil(world.run.RoomHistory)
    lu.assertNil(world.hero.TraitDictionary.AntiArmorBoon)
    lu.assertEquals(world.gameState.Resources.Money, 10)
end

function TestPracticeStart.testPrebossRecordsFollowItsCreation()
    local plan = decode("underworld-start-i-preboss")
    local start = plan.startState
    local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 }, start)
    local state, _, created = startRun(plan, world, { StartingBiome = "F" })
    local log, run = world.log, world.run

    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(state.route.index, indexOf(plan.selectedOccurrenceIds, "golden-i-preboss"))
    lu.assertEquals(created.args, { StartingBiome = "F", RoomName = "I_PreBoss02" })
    lu.assertTrue(created.creating)
    lu.assertEquals(log[1], "equip:ManaOverTimeRefundKeepsake:Epic:nil")
    lu.assertTrue(position(log, "add:HestiaCastBoon:Rare") < position(log, "rerollsAndDeathDefiance"))
    -- The run-wide records replace what creation wrote, before StartRoom.
    lu.assertNil(created.useRecord)
    lu.assertEquals(run.UseRecord, start.useRecord)
    lu.assertEquals(run.LootTypeHistory, start.lootTypeHistory)
    lu.assertEquals(run.ConsumableRecord, start.consumableRecord)
    lu.assertEquals(#run.RewardStores.TartarusRewards, 7)
    lu.assertEquals({ run.EnteredBiomes, run.EncounterDepth }, { 4, 30 })
    lu.assertEquals(run.BiomeVisitOrder, { "F", "G", "H", "I" })
    lu.assertEquals(#run.RoomHistory, #start.roomHistory)
    -- Map load derives the biome depth from the stub history.
    lu.assertNil(run.BiomeDepthCache)
    lu.assertEquals({ run.BiomeEncounterDepth, run.BiomeBoonSkipCount }, { 6, 0 })
    lu.assertEquals(run.BiomeUseRecord, {})
    lu.assertEquals({ run.RemainingClockworkGoals, run.MaxClockworkNonGoalRewards }, { 0, 3 })
    lu.assertNil(run.BiomeTime)
    -- The shop is generated once, after creation, as LeaveRoom would.
    local shops = 0
    for _, entry in ipairs(log) do if entry:match("^shop:") then shops = shops + 1 end end
    lu.assertEquals(shops, 1)
    lu.assertTrue(position(log, "createRoom") < position(log, "shop:I_PreBoss02:I_PreBoss02"))
    lu.assertNil(world.nativeGlobals.roomData)
    lu.assertEquals(world.gameState.Resources.Money, 10)
    lu.assertEquals(state.practiceStart.phase, "started")
end

function TestPracticeStart.testOpeningGeneratesNoShop()
    local plan = decode("surface-start-q-opening")
    local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 }, plan.startState)
    startRun(plan, world, { StartingBiome = "F" })
    for _, entry in ipairs(world.log) do lu.assertNil(entry:match("^shop:")) end
end

local function prebossRoom(mutate)
    local start = copy(decode("underworld-start-i-preboss").startState)
    local world = nativeWorld({ MaxHealth = 0, MaxMana = 0 }, start)
    world.bindings.MetaUpgradeData = { BiomeSpeedShrineUpgrade = { ChangeValue = 420 } }
    if mutate then mutate(start, world) end
    local restore = nativeGame.install(world.bindings)
    _G.CurrentRun = world.run
    local ok, errorValue = pcall(install.prebossRoom, start, { Name = start.roomName })
    restore()
    assert(ok, errorValue)
    return world
end

function TestPracticeStart.testPrebossStartsWithTheFullTightDeadlineAllowance()
    local world = prebossRoom(function(_, nativeWorldState)
        nativeWorldState.gameState.ShrineUpgrades.BiomeSpeedShrineUpgrade = 2
    end)
    lu.assertEquals(world.run.BiomeTime, 420)
    world = prebossRoom(function(_, nativeWorldState)
        nativeWorldState.gameState.ShrineUpgrades.BiomeSpeedShrineUpgrade = 2
        nativeWorldState.run.ShrineUpgradesDisabled.BiomeSpeedShrineUpgrade = true
    end)
    lu.assertNil(world.run.BiomeTime)
end

function TestPracticeStart.testPrebossShopErrorRestoresTheGlobalRoomData()
    local start = decode("underworld-start-i-preboss").startState
    local world = nativeWorld({ MaxHealth = 0, MaxMana = 0 }, start)
    world.bindings.RunShopGeneration = function() error("shop failed", 0) end
    local prior = { Name = "Hub_Main" }
    world.nativeGlobals.roomData = prior
    local restore = nativeGame.install(world.bindings)
    _G.CurrentRun = world.run
    local ok, errorValue = pcall(install.prebossRoom, start, { Name = start.roomName })
    local roomData = world.nativeGlobals.roomData
    restore()
    lu.assertFalse(ok)
    lu.assertEquals(errorValue, "shop failed")
    lu.assertIs(roomData, prior)
end

function TestPracticeStart.testPrebossFigLeafFlagWithoutTheKeepsakeIsSkipped()
    local world = prebossRoom(function(start) start.biome.dionysusSkipActivated = true end)
    lu.assertNil(world.hero.TraitDictionary.PersistentDionysusSkipKeepsake)
end

function TestPracticeStart.testPrebossBiomeFlagsInstallTheirNativeFields()
    local skip = { Name = "PersistentDionysusSkipKeepsake", RemainingUses = 2 }
    local world = prebossRoom(function(start, nativeWorldState)
        start.biome.forfeitConsumed = true
        start.biome.dionysusSkipActivated = true
        start.biome.biomeUseRecord = { TalentDrop = 1 }
        nativeWorldState.hero.TraitDictionary.PersistentDionysusSkipKeepsake = { skip }
    end)
    lu.assertEquals(world.run.BiomeBoonSkipCount, 1)
    lu.assertTrue(skip.ActivatedThisBiome)
    lu.assertEquals(world.run.BiomeUseRecord, { TalentDrop = 1 })
end

function TestPracticeStart.testPrebossStartRoomSelfCheck()
    local state, world, setup, presented
    local calls = withAdmission(true, function()
        state, world, setup, presented = enterStartRoom("underworld-start-i-preboss")
    end)
    lu.assertEquals(setup, { "I_PreBoss02", true })
    lu.assertEquals({ world.hero.MaxHealth, world.hero.MaxMana, world.hero.Health }, { 130, 295, 130 })
    lu.assertEquals(calls, { { occurrence = "golden-i-preboss", weapon = "WeaponStaffSwing", prefix = "practice-start" } })
    lu.assertTrue(presented)
    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(state.practiceStart.phase, "checked")
end

function TestPracticeStart.testPrebossBiomeDepthMismatchMakesExecutionPassive()
    local state
    withAdmission(true, function()
        state = enterStartRoom("underworld-start-i-preboss", function(plan)
            plan.startState.biome.biomeDepthCache = plan.startState.biome.biomeDepthCache + 1
        end)
    end)
    lu.assertEquals(state.state, "desynchronized")
    lu.assertEquals(state.firstMismatch.checkpoint, "practice-start:biome-depth")
end

function TestPracticeStart.testDreamPrebossIsNotABiomeEntry()
    local start = copy(decode("dream-start-n-opening").startState)
    start.point, start.biomeVisitOrder = "preboss", { "F", "N" }
    local overrides = install.runOverrides(start, "Dream")
    lu.assertEquals(overrides.PrevDreamBiome, "F")
    lu.assertEquals(overrides.DreamBiomePool, { "G", "H", "I", "O", "P", "Q" })
    local args = { RoomName = "Dream_Intro" }
    install.redirect(args, start, "Dream")
    lu.assertEquals(args, { RoomName = start.roomName })
end

function TestPracticeStart.testInstallAppliesAcquireResultsWithoutAcquiring()
    local start = copy(decode("surface-start-q-opening").startState)
    start.traits = {
        { name = "HeraWeaponBoon", rarity = "Epic", stackNum = 3, upgradedTraitName = "ZeusWeaponBoon" },
        { name = "StaffDoubleAttackTrait", rarity = "Legendary", durationHammerUses = 4 },
        { name = "FocusLastStandBoon", rarity = "Rare" },
        { name = "IcarusSlotBoon", selectedTrait = "ApolloWeaponBoon", currentRoom = 2, roomsPerUpgradeAmount = 7 },
        { name = "EchoLastRunBoon", echoIncreaseStats = {
            statMultiplier = 0.5, blockDecay = false, startMaxHealth = 100, startMaxMana = 80,
        } },
    }
    start.chaosCurses = { { name = "ChaosHealthCurse", remainingUses = 3, curseValues = { healthPenalty = -20 },
        blessing = { name = "ChaosManaBlessing", rarity = "Rare", blessingValues = { magick = 30 } } } }
    start.chaosBlessings = { { name = "ChaosRarityBlessing", rarity = "Epic", blessingValues = { rareBonus = 0.1 },
        fromChaosKeepsake = true } }
    start.keepsake.traits = {
        { name = "ManaOverTimeRefundKeepsake", rarity = "Epic", slotted = true },
        { name = "RarifyKeepsake", rarity = "Rare", rarityUpgradeUses = 1 },
    }
    start.arcana = {
        { name = "Centaur", rarity = "Epic", currentRoom = 2 },
        { name = "Strength", rarity = "Rare", temporary = true },
    }
    start.disabledVows = { "BiomeSpeedShrineUpgrade" }
    start.aspectPerfect = true
    start.familiar = { name = "CatFamiliar", stackMultiplier = 2 }
    start.stygianWell.timedTraits = { { name = "TemporaryDiscountTrait", clock = "bosses", remainingUses = 2 } }
    start.stygianWell.hymnUses = 2
    start.stygianWell.yarnUses = 2
    local world = nativeWorld({ MaxHealth = 0, MaxMana = 0 })
    local hero = world.hero
    world.bindings.MetaUpgradeCardData = { Centaur = { TraitName = "ChamberHealthMetaUpgrade" },
        Strength = { TraitName = "HealthMetaUpgrade" } }
    world.bindings.MetaUpgradeData = { BiomeSpeedShrineUpgrade = { OnDisabledFunctionName = "DisableBiomeSpeedShrineUpgrade" } }
    local restore = nativeGame.install(world.bindings)
    _G.CurrentRun = world.run
    _G.EquipKeepsake(hero, "ManaOverTimeRefundKeepsake", { ForceRarity = "Epic" })
    for _, trait in ipairs({ { Name = "ChamberHealthMetaUpgrade", Rarity = "Common" },
        { Name = "CatFamiliarTrait", FamiliarTrait = true, FamiliarLastStandHealAmount = 10 } }) do
        hero.TraitDictionary[trait.Name] = { trait }
        hero.Traits[#hero.Traits + 1] = trait
    end
    local ok, errorValue = pcall(install.hero, start, {
        aspectKey = "BaseStaffAspect", hexTree = recordingHexTree(world.log), diagnostic = function() end,
    })
    restore()
    assert(ok, errorValue)
    local function trait(name) return hero.TraitDictionary[name][1] end
    lu.assertEquals({ trait("HeraWeaponBoon").StackNum, trait("HeraWeaponBoon").UpgradedTraitName }, { 3, "ZeusWeaponBoon" })
    lu.assertEquals(trait("StaffDoubleAttackTrait").OnExpire,
        { FunctionName = "HammerKeepsakeLostPresentation", FunctionArgs = "StaffDoubleAttackTrait" })
    lu.assertEquals({ trait("StaffDoubleAttackTrait").RemainingUses, trait("StaffDoubleAttackTrait").UsesAsEncounters },
        { 4, true })
    lu.assertEquals({ trait("IcarusSlotBoon").SelectedTrait, trait("IcarusSlotBoon").CurrentRoom,
        trait("IcarusSlotBoon").RoomsPerUpgrade.Amount }, { "ApolloWeaponBoon", 2, 7 })
    lu.assertEquals(trait("EchoLastRunBoon").PropertyChanges[2].ChangeValue, 50)
    local curse = trait("ChaosHealthCurse")
    lu.assertEquals({ curse.RemainingUses, curse.OnExpire.TraitData.Name }, { 3, "ChaosManaBlessing" })
    lu.assertTrue(trait("ChaosRarityBlessing").FromChaosKeepsake)
    lu.assertEquals(trait("RarifyKeepsake").RarityUpgradeData.Uses, 1)
    lu.assertNil(trait("RarifyKeepsake").Slot)
    lu.assertEquals({ trait("ChamberHealthMetaUpgrade").Rarity, trait("ChamberHealthMetaUpgrade").CurrentRoom },
        { "Epic", 2 })
    lu.assertTrue(world.run.TemporaryMetaUpgrades.Strength)
    lu.assertTrue(world.gameState.MetaUpgradeState.Strength.Equipped)
    lu.assertTrue(world.run.ShrineUpgradesDisabled.BiomeSpeedShrineUpgrade)
    lu.assertEquals(trait("BaseStaffAspect").Rarity, "Perfect")
    lu.assertEquals({ trait("TemporaryDiscountTrait").UsesAsBosses, trait("TemporaryDiscountTrait").RemainingUses },
        { true, 2 })
    lu.assertEquals(trait("LimitedSwapBonusTrait").Uses, 2)
    -- Each Fated Yarn purchase is its own single-use instance.
    lu.assertEquals(#hero.TraitDictionary.TemporaryBoonRarityTrait, 2)
    for _, yarn in ipairs(hero.TraitDictionary.TemporaryBoonRarityTrait) do lu.assertEquals(yarn.RemainingUses, 1) end
    local log = table.concat(world.log, ",")
    lu.assertStrContains(log, "remove:ChamberHealthMetaUpgrade,add:ChamberHealthMetaUpgrade:Epic")
    lu.assertStrContains(log, "call:DisableBiomeSpeedShrineUpgrade")
    lu.assertStrContains(log, "lastStand:LastStandFamiliar")
    lu.assertStrContains(log, "lastStand:Athena")
    lu.assertEquals(trait("CatFamiliarTrait").ReportedFamiliarLastStandAmount, 2)
    lu.assertEquals(world.gameState.TraitsTaken, { BaseStaffAspect = true })
end

-- Barren unequips the Arcana after native Death Defiance and rerolls and
-- before native starting gold, at either start point.
function TestPracticeStart.testBarrenUnequipsArcanaBeforeNativeStartingGold()
    for _, name in ipairs({ "surface-start-q-opening", "underworld-start-i-preboss" }) do
        local plan = copy(decode(name))
        plan.startState.arcanaBarren = true
        local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 }, plan.startState)
        local state = startRun(plan, world, { StartingBiome = "F" })
        local log = world.log
        lu.assertEquals(state.state, "synchronized")
        local unequip = position(log, "unequipArcana")
        lu.assertTrue(position(log, "initializeRewardStores") < unequip)
        lu.assertTrue(unequip < position(log, "createRoom"))
        local count = 0
        for _, entry in ipairs(log) do if entry == "unequipArcana" then count = count + 1 end end
        lu.assertEquals(count, 1)
    end
end

function TestPracticeStart.testEndRunRemovesOnlyAPracticeRun()
    local module, _, callbacks = support.capture()
    practiceHooks.attach(module, session, function() return nil end, function() end, loadoutSession,
        recordingHexTree({}))
    local earlier, practice = { Name = "earlier" }, { Name = "practice", RunPlannerPracticeStart = true }
    local gameState = { RunHistory = { earlier } }
    local stripped = {}
    -- SaveLogic.StripRunHistoryForSave strips each run by its distance from the end.
    local function nativeStrip()
        local strip = {}
        for index, run in ipairs(gameState.RunHistory) do strip[run.Name] = #gameState.RunHistory - index end
        stripped[#stripped + 1] = strip
    end
    local nativeGlobals = { PrevRun = earlier }
    local restore = nativeGame.install({ GameState = gameState, game = nativeGlobals,
        StripRunHistoryForSave = function() return callbacks.StripRunHistoryForSave(nil, {}, nativeStrip) end })
    local function nativeEndRun(run)
        table.insert(gameState.RunHistory, run)
        gameState.CompletedRunsCache = #gameState.RunHistory
        nativeGlobals.PrevRun = run
        _G.StripRunHistoryForSave()
    end
    callbacks.EndRun(nil, {}, nativeEndRun, practice)
    lu.assertEquals(gameState.RunHistory, { earlier })
    lu.assertEquals(gameState.CompletedRunsCache, 1)
    lu.assertIs(nativeGlobals.PrevRun, earlier)
    lu.assertEquals(stripped, { { earlier = 0 } })
    local native = { Name = "native" }
    callbacks.EndRun(nil, {}, nativeEndRun, native)
    local prevRun = nativeGlobals.PrevRun
    restore()
    lu.assertEquals(gameState.RunHistory, { earlier, native })
    lu.assertIs(prevRun, native)
    lu.assertEquals(stripped[2], { earlier = 1, native = 0 })
end

function TestPracticeStart.testStartRoomCreationUsesTheVerifiedPracticeLoadout()
    local roomHooks = require("mods.room.hooks")
    local routeSession = require("mods.route.session")
    local occurrence = {
        id = "start", gameName = "Q_Intro",
        overview = { encounterPhases = {}, requiredObjects = {}, additional = {} },
        transactionsByOwner = {}, timeline = { transactions = {}, dependencies = {}, obligations = {} },
        doors = { kind = "terminal" }, roomExitConformance = { facts = {} }, conformanceExpected = {},
    }
    local plan = { occurrences = { occurrence }, occurrencesById = { start = occurrence },
        selectedOccurrenceIds = { "start" }, startState = { roomName = "Q_Intro" } }
    local state = session.create()
    state.initialized, state.state, state.reason = true, "synchronized", "ready"
    state.plan, state.route = plan, routeSession.new(plan)
    state.room = roomCoordinator.new(plan, function(errorValue, expected, observed)
        return session.mismatch(state, errorValue, expected, observed)
    end, { onFault = function(errorValue, expected, observed)
        return session.fault(state, errorValue, expected, observed)
    end })
    local module, _, callbacks = support.capture()
    roomHooks.attach(module, session, function() return state end, function() end, routeSession, roomCoordinator, nil, {
        realizeIncomingReward = function(_, data) return data end,
        applyZagreusContractPresence = function() end,
    }, {
        startingRun = function() return true end,
        synchronizeStartingRoom = function() error("a practice loadout is verified before its start room") end,
    }, nil, { creatingStartRoom = function(_, args) return args.RoomName == "Q_Intro" end })
    local restore = nativeGame.install({ game = { RoomData = { Q_Intro = { Name = "Q_Intro" } } } })
    local created = callbacks.CreateRoom(nil, {}, function(roomData) return { Name = roomData.Name } end,
        { Name = "Q_Intro" }, { RoomName = "Q_Intro" })
    restore()
    lu.assertEquals(created.__runPlannerExecutionRoomId, "start")
    lu.assertEquals(state.state, "synchronized")
end

function TestPracticeStart.testPlanWithoutStartStatePassesThroughThePracticeHooks()
    local plan = copy(decode("surface-start-q-opening"))
    plan.startState = nil
    local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 })
    local state, callbacks, created = startRun(plan, world, { StartingBiome = "F" })
    lu.assertEquals(state.route.index, 1)
    lu.assertNil(state.practiceStart)
    lu.assertEquals(world.log[1], "equip:ManaOverTimeRefundKeepsake:nil:true")
    lu.assertNil(created.args.RoomName)
    lu.assertFalse(created.creating)
    lu.assertNil(world.run.RoomHistory)
    lu.assertNil(world.run.RunPlannerPracticeStart)
    lu.assertEquals(world.gameState.Resources.Money, 10)
    local restore = nativeGame.install(world.bindings)
    _G.CurrentRun = world.run
    world.run.RoomHistory = {}
    local setup
    callbacks.SetupHeroObject(nil, {}, function(room, applyLuaUpgrades)
        setup = { room.Name, applyLuaUpgrades }
    end, { Name = "Q_Intro" }, false)
    restore()
    lu.assertEquals(setup, { "Q_Intro", false })
end

function TestPracticeStart.testInstallFaultMakesExecutionPassiveAndTheRunContinues()
    local plan = decode("surface-start-q-opening")
    local world = nativeWorld({ MaxHealth = 70, MaxMana = 190 }, plan.startState)
    local processed = world.bindings.GetProcessedTraitData
    world.bindings.GetProcessedTraitData = function(args)
        if args.TraitName == plan.startState.traits[1].name then return nil end
        return processed(args)
    end
    local state, _, created = startRun(plan, world, { StartingBiome = "F" })
    lu.assertEquals(state.state, "faulted")
    lu.assertEquals(state.firstFault.checkpoint, "practice-start:trait")
    lu.assertNil(state.firstMismatch)
    -- The redirected run is still created natively from the start room.
    lu.assertEquals(created.args.RoomName, "Q_Intro")
    lu.assertTrue(world.run.RunPlannerPracticeStart)
end
