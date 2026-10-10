-- luacheck: globals TestLoadoutInstall
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local nativeGame = require("tests/harness/native_game")
local support = require("tests.harness.hook_composition")
local json = require("mods/protocol/json")
local decoder = require("mods.protocol.decoder")
local session = require("mods.runtime.session")
local roomCoordinator = require("mods.room.coordinator")
local loadoutHooks = require("mods.loadout.hooks")
local install = require("mods.loadout.install")

TestLoadoutInstall = {}

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

-- A mismatched profile: another weapon, Aspect, Arcana, Fear, keepsake and
-- familiar, and native contacts that record what the install derives.
local function nativeWorld()
    local gameState = {
        LastWeaponUpgradeName = { WeaponAxe = "AxeProfileAspect", WeaponStaffSwing = "StaffProfileAspect" },
        MetaUpgradeState = {
            CardDraw = { Equipped = false, Level = 1, Unlocked = true },
            ChanneledCast = { Level = 1, Unlocked = false },
            BonusRarity = { Equipped = true, Level = 2, Unlocked = true },
            LastStand = { Equipped = true, Level = 3, Unlocked = true, AdjacencyBonuses = { CustomMultiplier = 0.5 } },
            HighCost = { Level = 1 },
        },
        ShrineUpgrades = { EnemyHealthShrineUpgrade = 2, BossDifficultyShrineUpgrade = 1 },
        LastAwardTrait = "ProfileKeepsake", EquippedFamiliar = "CatFamiliar",
        KeepsakeChambers = { BossMetaUpgradeKeepsake = 3 },
        WeaponsUnlocked = { WeaponAxe = true }, FamiliarUpgrades = {},
    }
    local extracted = {}
    local cardData = {}
    for _, name in ipairs({ "CardDraw", "ChanneledCast", "BonusRarity", "LastStand" }) do
        cardData[name] = { Cost = 1, UpgradeResourceCost = { {}, {}, {} } }
    end
    cardData.HighCost = { Cost = 5, UpgradeResourceCost = { {} } }
    local bindings = {
        GameState = gameState,
        TraitRarityData = {
            RarityUpgradeOrder = { "Common", "Rare", "Epic", "Heroic" },
            WeaponRarityUpgradeOrder = { "Common", "Rare", "Epic", "Heroic", "Legendary", "Perfect" },
        },
        WeaponData = {
            WeaponStaffSwing = { SecondaryWeapon = "WeaponStaffBall" },
            WeaponAxe = { SecondaryWeapon = "WeaponAxeBlock" },
        },
        WeaponSets = { HeroPrimaryWeapons = { "WeaponStaffSwing", "WeaponAxe" } },
        MetaUpgradeCardData = cardData,
        FamiliarData = {
            FrogFamiliar = { TraitNames = { "FrogFamiliarTrait" } },
            CatFamiliar = { TraitNames = { "CatFamiliarTrait" } },
        },
        TraitData = { BossMetaUpgradeKeepsake = { ChamberThresholds = { 25, 50 } } },
        ShrineUpgradeExtractValues = function(name) extracted[name] = gameState.ShrineUpgrades[name] or 0 end,
        GetCurrentMetaUpgradeCost = function()
            local total = 0
            for name, state in pairs(gameState.MetaUpgradeState) do
                if state.Equipped then total = total + cardData[name].Cost end
            end
            gameState.MetaUpgradeCostCache = total
            return total
        end,
        GetTotalSpentShrinePoints = function()
            local total = 0
            for _, rank in pairs(gameState.ShrineUpgrades) do total = total + rank end
            return total
        end,
    }
    return { gameState = gameState, extracted = extracted, bindings = bindings }
end

local function profileHero()
    return { Weapons = { WeaponAxe = true, WeaponAxeBlock = true, WeaponCast = true } }
end

-- The loadout hooks over the real session, with native StartNewRun's order of
-- contacts (RunLogic.lua:439-484).
local function attach(plan)
    local priorImport = _G.import
    _G.import = function(path) return require((path:gsub("%.lua$", ""):gsub("/", "."))) end
    local state = session.create()
    local module, _, callbacks = support.capture()
    local inbox = { load = function() return true, plan end, status = function() return {} end }
    local hexTree = { attach = function() end, prepare = function() end, clear = function() end }
    local scope = loadoutHooks.attach(module, {
        inbox = inbox, session = session, activePlanSlot = function() return 1 end,
    }, function() return state end, function() end, roomCoordinator, hexTree)
    _G.import = priorImport
    return state, callbacks, scope
end

local function startRun(callbacks, previousRun, args, onEquip)
    local run = { TemporaryMetaUpgrades = {}, ShrineUpgradesDisabled = {} }
    callbacks.StartNewRun(nil, {}, function(_, startArgs)
        _G.CurrentRun = run
        run.Hero = callbacks.CreateNewHero(nil, {}, function() return profileHero() end, previousRun, startArgs)
        callbacks.EquipKeepsake(nil, {}, function(_, key, equipArgs)
            if onEquip then onEquip(key, equipArgs) end
        end, run.Hero, _G.GameState.LastAwardTrait, { FromLoot = true, AddToCache = true })
        return run
    end, previousRun, args or {})
    return run
end

local function withWorld(world, action)
    local restore = nativeGame.install(world.bindings)
    local priorRun = _G.CurrentRun
    local ok, errorValue = pcall(action)
    _G.CurrentRun = priorRun
    restore()
    if not ok then error(errorValue, 0) end
end

function TestLoadoutInstall.testPlannedRunInstallsThePlanAndBacksUpTheProfile()
    local plan = decode("automatic-boss")
    plan.startingLoadout.fear.configuredRanks.EnemyEliteShrineUpgrade = 1
    local world = nativeWorld()
    withWorld(world, function()
        local state, callbacks = attach(plan)
        local equipped
        local run = startRun(callbacks, { Hero = profileHero() }, {}, function(key, args)
            equipped = { key = key, rarity = args.ForceRarity, fromLoot = args.FromLoot }
        end)
        local gameState = world.gameState
        lu.assertEquals(state.state, "synchronized")
        lu.assertEquals(gameState.LastWeaponUpgradeName,
            { WeaponAxe = "AxeProfileAspect", WeaponStaffSwing = "BaseStaffAspect" })
        local equippedCards = {}
        for name, card in pairs(gameState.MetaUpgradeState) do
            if card.Equipped then equippedCards[name] = true end
            lu.assertNil(card.AdjacencyBonuses)
        end
        lu.assertEquals(equippedCards, { ChanneledCast = true, BonusRarity = true, CardDraw = true })
        lu.assertEquals(gameState.MetaUpgradeCostCache, 3)
        lu.assertEquals(gameState.ShrineUpgrades.EnemyEliteShrineUpgrade, 1)
        lu.assertEquals(gameState.ShrineUpgrades.EnemyHealthShrineUpgrade, 0)
        lu.assertEquals(world.extracted.EnemyHealthShrineUpgrade, 0)
        lu.assertEquals(world.extracted.EnemyEliteShrineUpgrade, 1)
        lu.assertEquals(gameState.SpentShrinePointsCache, 1)
        lu.assertEquals(gameState.LastAwardTrait, "BossMetaUpgradeKeepsake")
        lu.assertEquals(gameState.EquippedFamiliar, "FrogFamiliar")
        -- The planned weapon replaces the profile's without unlocking it.
        lu.assertEquals(run.Hero.Weapons, { WeaponStaffSwing = true, WeaponStaffBall = true, WeaponCast = true })
        lu.assertEquals(gameState.WeaponsUnlocked, { WeaponAxe = true })
        lu.assertEquals(equipped, { key = "BossMetaUpgradeKeepsake", rarity = "Epic", fromLoot = true })
        -- Unlock and progression fields are untouched.
        lu.assertEquals(gameState.MetaUpgradeState.ChanneledCast.Unlocked, false)
        lu.assertEquals(gameState.MetaUpgradeState.LastStand.Level, 3)
        lu.assertEquals(gameState.KeepsakeChambers, { BossMetaUpgradeKeepsake = 3 })

        local saved = run[install.marker]
        lu.assertEquals(saved.profile.weaponKey, "WeaponAxe")
        lu.assertEquals(saved.profile.aspectKey, "StaffProfileAspect")
        lu.assertEquals(saved.profile.shrineUpgrades, { EnemyHealthShrineUpgrade = 2, BossDifficultyShrineUpgrade = 1 })
        lu.assertEquals(saved.profile.lastAwardTrait, "ProfileKeepsake")
        lu.assertEquals(saved.profile.equippedFamiliar, "CatFamiliar")
        lu.assertEquals(saved.profile.cards.LastStand,
            { Equipped = true, AdjacencyBonuses = { CustomMultiplier = 0.5 } })
        lu.assertEquals(saved.installed.cardLevels, { ChanneledCast = 3, BonusRarity = 3, CardDraw = 3 })
        lu.assertEquals({ saved.installed.aspectLevel, saved.installed.keepsakeLevel, saved.installed.familiarStacks },
            { 5, 3, 4 })
    end)
end

function TestLoadoutInstall.testRankOverridesFollowTheSavedRun()
    local plan = decode("automatic-boss")
    local world = nativeWorld()
    withWorld(world, function()
        local state, callbacks = attach(plan)
        local run = startRun(callbacks, { Hero = profileHero() })
        -- A reload or a passive executor keeps the overrides: they read the run.
        session.beginNewRun(state)
        session.fault(state, "unrelated")
        local function native(value) return function() return value end end
        lu.assertEquals(callbacks.GetWeaponUpgradeLevel(nil, {}, native(1), "BaseStaffAspect"), 5)
        lu.assertEquals(callbacks.GetWeaponUpgradeLevel(nil, {}, native(2), "OtherAspect"), 2)
        lu.assertEquals(callbacks.GetMetaUpgradeLevel(nil, {}, native(1), "CardDraw"), 3)
        -- Every other card draws at its maximum.
        lu.assertEquals(callbacks.GetMetaUpgradeLevel(nil, {}, native(1), "HighCost"), 2)
        lu.assertEquals(callbacks.GetFamiliarTraitStacks(nil, {}, native(1), "FrogFamiliarTrait"), 4)
        lu.assertEquals(callbacks.GetFamiliarTraitStacks(nil, {}, native(1), "CatFamiliarTrait"), 1)
        -- The keepsake's chambers read at its planned rank for the call only.
        local chambers
        lu.assertEquals(callbacks.GetKeepsakeLevel(nil, {}, function(name, unmodified)
            chambers = world.gameState.KeepsakeChambers[name]
            return unmodified and "unmodified" or "level"
        end, "BossMetaUpgradeKeepsake", true), "unmodified")
        lu.assertEquals(chambers, 75)
        lu.assertEquals(world.gameState.KeepsakeChambers.BossMetaUpgradeKeepsake, 3)
        callbacks.GetKeepsakeLevel(nil, {}, function(name)
            chambers = world.gameState.KeepsakeChambers[name]
        end, "ProfileKeepsake")
        lu.assertNil(chambers)
        -- Temporary draws see every card unlocked during the call only.
        local unlocked
        callbacks.AddRandomMetaUpgrades(nil, {}, function()
            unlocked = world.gameState.MetaUpgradeState.ChanneledCast.Unlocked
        end, 1, {})
        lu.assertTrue(unlocked)
        lu.assertFalse(world.gameState.MetaUpgradeState.ChanneledCast.Unlocked)
        lu.assertNil(world.gameState.MetaUpgradeState.HighCost.Unlocked)

        -- Without an install every contact is native.
        run[install.marker] = nil
        lu.assertEquals(callbacks.GetMetaUpgradeLevel(nil, {}, native(1), "CardDraw"), 1)
        lu.assertEquals(callbacks.GetWeaponUpgradeLevel(nil, {}, native(1), "BaseStaffAspect"), 1)
    end)
end

local function assertProfile(world, run)
    local gameState = world.gameState
    lu.assertNil(run[install.marker])
    lu.assertEquals(gameState.LastWeaponUpgradeName,
        { WeaponAxe = "AxeProfileAspect", WeaponStaffSwing = "StaffProfileAspect" })
    lu.assertEquals(gameState.ShrineUpgrades, { EnemyHealthShrineUpgrade = 2, BossDifficultyShrineUpgrade = 1 })
    lu.assertEquals(world.extracted.EnemyHealthShrineUpgrade, 2)
    lu.assertEquals(world.extracted.EnemyEliteShrineUpgrade, 0)
    lu.assertEquals(gameState.SpentShrinePointsCache, 3)
    lu.assertEquals(gameState.LastAwardTrait, "ProfileKeepsake")
    lu.assertEquals(gameState.EquippedFamiliar, "CatFamiliar")
    lu.assertEquals(gameState.MetaUpgradeState.CardDraw.Equipped, false)
    lu.assertNil(gameState.MetaUpgradeState.ChanneledCast.Equipped)
    lu.assertEquals(gameState.MetaUpgradeState.LastStand.AdjacencyBonuses, { CustomMultiplier = 0.5 })
    lu.assertEquals(gameState.MetaUpgradeCostCache, 2)
    lu.assertEquals(run.Hero.Weapons, { WeaponAxe = true, WeaponAxeBlock = true, WeaponCast = true })
    lu.assertEquals(run.TemporaryMetaUpgrades, {})
end

function TestLoadoutInstall.testDeathRestoresTheProfileAfterRecordRunStats()
    local plan = decode("automatic-boss")
    plan.startingLoadout.fear.configuredRanks.EnemyEliteShrineUpgrade = 1
    local world = nativeWorld()
    withWorld(world, function()
        local _, callbacks = attach(plan)
        local run = startRun(callbacks, { Hero = profileHero() })
        -- A temporary card drawn during the run is unequipped with the restore.
        world.gameState.MetaUpgradeState.HighCost.Equipped = true
        run.TemporaryMetaUpgrades.HighCost = true
        local recorded
        callbacks.RecordRunStats(nil, {}, function()
            recorded = { weapons = copy(run.Hero.Weapons), keepsake = world.gameState.LastAwardTrait }
        end)
        lu.assertEquals(recorded.keepsake, "BossMetaUpgradeKeepsake")
        lu.assertTrue(recorded.weapons.WeaponStaffSwing)
        lu.assertNil(world.gameState.MetaUpgradeState.HighCost.Equipped)
        assertProfile(world, run)
    end)
end

function TestLoadoutInstall.testClearRestoresWhenKillHeroEndsTheRun()
    local plan = decode("automatic-boss")
    plan.startingLoadout.fear.configuredRanks.EnemyEliteShrineUpgrade = 1
    local world = nativeWorld()
    withWorld(world, function()
        local _, callbacks = attach(plan)
        local run = startRun(callbacks, { Hero = profileHero() })
        -- RecordRunCleared marks the run cleared, records it and credits the
        -- cleared loadout in the boss room.
        local credited
        run.Cleared = true
        callbacks.RecordRunStats(nil, {}, function() end)
        credited = { familiar = world.gameState.EquippedFamiliar, weapons = copy(run.Hero.Weapons) }
        lu.assertEquals(credited.familiar, "FrogFamiliar")
        lu.assertTrue(credited.weapons.WeaponStaffSwing)
        -- Post-clear linked rooms re-equip from the run and still see the plan.
        lu.assertNotNil(run[install.marker])
        lu.assertEquals(world.gameState.LastAwardTrait, "BossMetaUpgradeKeepsake")
        lu.assertTrue(run.Hero.Weapons.WeaponStaffSwing)
        -- KillHero ends the cleared run without recording it again.
        local beforeSave
        callbacks.KillHero(nil, {}, function()
            beforeSave = world.gameState.EquippedFamiliar
        end, run.Hero, {})
        lu.assertEquals(beforeSave, "CatFamiliar")
        assertProfile(world, run)
    end)
end

function TestLoadoutInstall.testDeathKillHeroLeavesTheRestoreToRecordRunStats()
    local plan = decode("automatic-boss")
    local world = nativeWorld()
    withWorld(world, function()
        local _, callbacks = attach(plan)
        local run = startRun(callbacks, { Hero = profileHero() })
        local recorded
        callbacks.KillHero(nil, {}, function()
            recorded = world.gameState.LastAwardTrait
            callbacks.RecordRunStats(nil, {}, function() end)
        end, run.Hero, {})
        lu.assertEquals(recorded, "BossMetaUpgradeKeepsake")
        lu.assertNil(run[install.marker])
        lu.assertEquals(world.gameState.LastAwardTrait, "ProfileKeepsake")
    end)
end

function TestLoadoutInstall.testRackSwappedKeepsakeReadsAtTheMatureRank()
    local plan = decode("automatic-boss")
    local world = nativeWorld()
    world.bindings.TraitData.ReincarnationKeepsake = { ChamberThresholds = { 25, 50 } }
    world.gameState.KeepsakeChambers.ReincarnationKeepsake = 10
    withWorld(world, function()
        local _, callbacks = attach(plan)
        local run = startRun(callbacks, { Hero = profileHero() })
        local chambers
        callbacks.GetKeepsakeLevel(nil, {}, function(name)
            chambers = world.gameState.KeepsakeChambers[name]
        end, "ReincarnationKeepsake")
        lu.assertEquals(chambers, 75)
        lu.assertEquals(world.gameState.KeepsakeChambers.ReincarnationKeepsake, 10)
        run[install.marker] = nil
        callbacks.GetKeepsakeLevel(nil, {}, function(name)
            chambers = world.gameState.KeepsakeChambers[name]
        end, "ReincarnationKeepsake")
        lu.assertEquals(chambers, 10)
    end)
end

function TestLoadoutInstall.testHeroEquipFailureUndoesThePartialSwap()
    local plan = decode("automatic-boss")
    local world = nativeWorld()
    -- The weapon swap fails after clearing the profile's weapon.
    world.bindings.WeaponSets.HeroPrimaryWeapons = { "WeaponStaffSwing", "WeaponAxe", "WeaponBroken" }
    setmetatable(world.bindings.WeaponData, { __index = function(_, name)
        if name == "WeaponBroken" then error("native weapon data failed") end
    end })
    withWorld(world, function()
        local state, callbacks = attach(plan)
        local run = startRun(callbacks, { Hero = profileHero() })
        lu.assertEquals(state.state, "faulted")
        lu.assertEquals(state.firstFault.checkpoint, "loadout-install:hero")
        lu.assertNil(run[install.marker])
        lu.assertEquals(run.Hero.Weapons, profileHero().Weapons)
        lu.assertEquals(world.gameState.LastAwardTrait, "ProfileKeepsake")
    end)
end

function TestLoadoutInstall.testSafetyRestoresAtTheNextRunAndHubLoad()
    local plan = decode("automatic-boss")
    plan.startingLoadout.fear.configuredRanks.EnemyEliteShrineUpgrade = 1
    local world = nativeWorld()
    withWorld(world, function()
        local _, callbacks = attach(plan)
        local run = startRun(callbacks, { Hero = profileHero() })
        local heroWeapons
        callbacks.DeathAreaRoomTransition(nil, {}, function() heroWeapons = copy(run.Hero.Weapons) end, {})
        lu.assertTrue(heroWeapons.WeaponAxe)
        assertProfile(world, run)
    end)
    world = nativeWorld()
    withWorld(world, function()
        local _, callbacks = attach(plan)
        local ended = startRun(callbacks, { Hero = profileHero() })
        -- The next run restores the ended run before backing up the profile.
        local next = startRun(callbacks, ended)
        lu.assertNil(ended[install.marker])
        lu.assertEquals(ended.Hero.Weapons, { WeaponAxe = true, WeaponAxeBlock = true, WeaponCast = true })
        lu.assertEquals(next[install.marker].profile.lastAwardTrait, "ProfileKeepsake")
        lu.assertEquals(next[install.marker].profile.aspectKey, "StaffProfileAspect")
    end)
end

function TestLoadoutInstall.testFailedRestoreRefusesTheNextInstall()
    local plan = decode("automatic-boss")
    local world = nativeWorld()
    withWorld(world, function()
        local state, callbacks = attach(plan)
        local broken = { [install.marker] = { profile = {}, installed = {} }, Hero = profileHero() }
        startRun(callbacks, broken)
        lu.assertEquals(state.reason, "admission-rejected")
        lu.assertEquals(state.admissionError.checkpoint, "loadout-restore")
        lu.assertEquals(world.gameState.LastAwardTrait, "ProfileKeepsake")
    end)
end

function TestLoadoutInstall.testInstallFailureFaultsAndKeepsTheProfile()
    local plan = decode("automatic-boss")
    local world = nativeWorld()
    -- The install's write fails; the backup is restored before the fault.
    local nativeCost, failed = world.bindings.GetCurrentMetaUpgradeCost, false
    world.bindings.GetCurrentMetaUpgradeCost = function()
        if not failed then
            failed = true
            error("native cost failed")
        end
        return nativeCost()
    end
    withWorld(world, function()
        local state, callbacks = attach(plan)
        local equipped
        local run = startRun(callbacks, { Hero = profileHero() }, {}, function(_, args) equipped = args end)
        lu.assertEquals(state.state, "faulted")
        lu.assertEquals(state.firstFault.checkpoint, "loadout-install")
        lu.assertNil(run[install.marker])
        lu.assertEquals(world.gameState.LastAwardTrait, "ProfileKeepsake")
        lu.assertEquals(world.gameState.LastWeaponUpgradeName.WeaponStaffSwing, "StaffProfileAspect")
        lu.assertTrue(world.gameState.MetaUpgradeState.BonusRarity.Equipped)
        lu.assertEquals(run.Hero.Weapons, profileHero().Weapons)
        lu.assertNil(equipped.ForceRarity)
    end)
end

function TestLoadoutInstall.testFreshFileInstallsNothingAndAdmitsOnlyABrandNewSave()
    local plan = decode("fresh-file-fghi")
    local world = nativeWorld()
    withWorld(world, function()
        local state, callbacks = attach(plan)
        local run = startRun(callbacks, nil)
        lu.assertEquals(state.state, "synchronized")
        lu.assertNil(run[install.marker])
        lu.assertEquals(world.gameState.LastAwardTrait, "ProfileKeepsake")
        lu.assertTrue(run.Hero.Weapons.WeaponAxe)
        startRun(callbacks, { Hero = profileHero() })
        lu.assertEquals(state.reason, "admission-rejected")
        lu.assertEquals(state.admissionError.checkpoint, "fresh-file")
    end)
end

function TestLoadoutInstall.testChaosTrialRefusesAdmission()
    local plan = decode("automatic-boss")
    for _, case in ipairs({ { args = { ActiveBounty = "PackageBountyChaos" } }, { stored = {} } }) do
        local world = nativeWorld()
        world.bindings.StoredGameState = case.stored
        withWorld(world, function()
            local state, callbacks = attach(plan)
            local run = startRun(callbacks, { Hero = profileHero() }, case.args)
            lu.assertEquals(state.admissionError.checkpoint, "chaos-trial")
            lu.assertNil(run[install.marker])
            lu.assertEquals(world.gameState.LastAwardTrait, "ProfileKeepsake")
        end)
    end
end
