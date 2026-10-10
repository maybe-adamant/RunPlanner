-- Run-scoped loadout install. The plan's weapon, Aspect, Arcana, Fear,
-- keepsake and familiar replace the profile's GameState loadout for one run,
-- as a Chaos Trial does (BountyLogic.StartPackagedBounty), and the profile's
-- values come back after it (BountyLogic.RestorePackagedBountyGameState).
-- Unlocks and progression are never written.
local practice = type(import) == "function" and import("mods/practice/install.lua")
    or require("mods.practice.install")

local install = {}

-- The saved run carries the profile backup and the installed ranks, so the
-- rank overrides and the restore survive Save & Quit and a passive executor.
install.marker = "RunPlannerProfileLoadout"

local function fault(checkpoint, expected, observed)
    error({ outcome = "fault", checkpoint = "loadout-install:" .. checkpoint,
        expected = expected, observed = observed }, 0)
end

local function copy(values)
    local result = {}
    for key, value in pairs(values or {}) do result[key] = value end
    return result
end

local function indexOf(values, wanted)
    for index, value in ipairs(values or {}) do if value == wanted then return index end end
    return nil
end

local function level(order, rarity, checkpoint, key)
    local value = indexOf(_G.TraitRarityData[order], rarity)
    if value == nil then fault(checkpoint, key .. ":" .. tostring(rarity), "undeclared rarity") end
    return value
end

-- The installed values and the ranks the rank overrides return. A Practice
-- mode start's slotted keepsake is the run's keepsake.
local function installed(plan)
    local loadout, keepsake = plan.startingLoadout, plan.startingKeepsake
    local keepsakeKey, keepsakeRarity = keepsake.keepsakeKey, keepsake.rarity
    if plan.startState ~= nil then
        local row = practice.slottedKeepsake(plan.startState)
        keepsakeKey, keepsakeRarity = row and row.name, row and row.rarity
    end
    if type(_G.WeaponData[loadout.weaponKey]) ~= "table" then fault("weapon", loadout.weaponKey, "undeclared") end
    local cardLevels, states = {}, _G.GameState.MetaUpgradeState
    for _, card in ipairs(loadout.arcana) do
        if type(states[card.key]) ~= "table" then fault("arcana", card.key, "undeclared") end
        cardLevels[card.key] = level("RarityUpgradeOrder", card.rarity, "arcana", card.key)
    end
    local familiar = loadout.familiar
    if familiar ~= nil and type(_G.FamiliarData[familiar.name]) ~= "table" then
        fault("familiar", familiar.name, "undeclared")
    end
    return {
        weaponKey = loadout.weaponKey,
        aspectKey = loadout.aspectKey,
        aspectLevel = loadout.aspectKey and level("WeaponRarityUpgradeOrder", loadout.aspectRarity, "aspect",
            loadout.aspectKey),
        cardLevels = cardLevels,
        shrineUpgrades = copy(loadout.fear.configuredRanks),
        keepsakeKey = keepsakeKey,
        keepsakeLevel = keepsakeKey and level("RarityUpgradeOrder", keepsakeRarity, "keepsake", keepsakeKey),
        familiarName = familiar and familiar.name,
        familiarStacks = familiar and familiar.traitStacks,
    }
end

-- EquipPlayerWeapon's hero-table effect (CombatLogic.lua:4728-4757) without
-- its WeaponsUnlocked write.
local function equipWeapon(weapons, weaponKey)
    for _, name in ipairs(_G.WeaponSets.HeroPrimaryWeapons) do
        local data = _G.WeaponData[name]
        weapons[name] = nil
        if data and data.SecondaryWeapon then weapons[data.SecondaryWeapon] = nil end
    end
    local data = _G.WeaponData[weaponKey]
    weapons[weaponKey] = true
    if data and data.SecondaryWeapon then weapons[data.SecondaryWeapon] = true end
end

-- Vow values and point caches derived from the loadout, as the Chaos Trial
-- restore recomputes them (BountyLogic.lua:747-750).
local function refresh(vows)
    for name in pairs(vows) do _G.ShrineUpgradeExtractValues(name) end
    _G.GetCurrentMetaUpgradeCost()
    _G.GameState.SpentShrinePointsCache = _G.GetTotalSpentShrinePoints()
end

local function vowNames(...)
    local names = {}
    for _, values in ipairs({ ... }) do
        for name in pairs(values or {}) do names[name] = true end
    end
    return names
end

local function record(run)
    local value = type(run) == "table" and run[install.marker] or nil
    return type(value) == "table" and value or nil
end

-- Returns the profile's values to GameState and the hero, and clears the
-- marker. Returns whether the run carried an install.
function install.restore(run)
    local saved = record(run)
    if saved == nil then return false end
    local gameState, profile, planned = _G.GameState, saved.profile, saved.installed
    local vows = vowNames(gameState.ShrineUpgrades, profile.shrineUpgrades)
    gameState.LastWeaponUpgradeName[planned.weaponKey] = profile.aspectKey
    for name, state in pairs(gameState.MetaUpgradeState) do
        local card = profile.cards[name]
        if card ~= nil then state.Equipped, state.AdjacencyBonuses = card.Equipped, card.AdjacencyBonuses end
    end
    gameState.ShrineUpgrades = copy(profile.shrineUpgrades)
    gameState.LastAwardTrait = profile.lastAwardTrait
    gameState.EquippedFamiliar = profile.equippedFamiliar
    if profile.weaponKey ~= nil and type(run.Hero) == "table" and type(run.Hero.Weapons) == "table" then
        equipWeapon(run.Hero.Weapons, profile.weaponKey)
    end
    run.TemporaryMetaUpgrades = {}
    run[install.marker] = nil
    refresh(vows)
    return true
end

-- Before native CreateNewHero: backs up the profile onto the run, then writes
-- the plan into the GameState fields native StartNewRun reads. A failed write
-- restores the backup before the fault is raised.
function install.apply(plan, run)
    local planned = installed(plan)
    local gameState = _G.GameState
    local states = gameState.MetaUpgradeState
    local profile = {
        aspectKey = gameState.LastWeaponUpgradeName[planned.weaponKey],
        cards = {},
        shrineUpgrades = copy(gameState.ShrineUpgrades),
        lastAwardTrait = gameState.LastAwardTrait,
        equippedFamiliar = gameState.EquippedFamiliar,
    }
    for name, state in pairs(states) do
        profile.cards[name] = { Equipped = state.Equipped, AdjacencyBonuses = state.AdjacencyBonuses }
    end
    run[install.marker] = { profile = profile, installed = planned }
    local ok, errorValue = pcall(function()
        gameState.LastWeaponUpgradeName[planned.weaponKey] = planned.aspectKey
        for name, state in pairs(states) do
            state.Equipped = planned.cardLevels[name] ~= nil
            state.AdjacencyBonuses = nil
        end
        local vows = vowNames(gameState.ShrineUpgrades, planned.shrineUpgrades)
        local ranks = {}
        for name in pairs(vows) do ranks[name] = planned.shrineUpgrades[name] or 0 end
        gameState.ShrineUpgrades = ranks
        gameState.LastAwardTrait = planned.keepsakeKey
        gameState.EquippedFamiliar = planned.familiarName
        refresh(vows)
    end)
    if not ok then
        install.restore(run)
        error(errorValue, 0)
    end
end

-- After native CreateNewHero: records the profile's weapon and gives the new
-- hero the planned one.
function install.equipHero(run, hero)
    local saved = record(run)
    if saved == nil then return end
    if type(hero) ~= "table" or type(hero.Weapons) ~= "table" then fault("hero", "hero weapons", hero) end
    for _, name in ipairs(_G.WeaponSets.HeroPrimaryWeapons) do
        if hero.Weapons[name] then
            saved.profile.weaponKey = name
            break
        end
    end
    local prior = copy(hero.Weapons)
    local ok, errorValue = pcall(equipWeapon, hero.Weapons, saved.installed.weaponKey)
    if not ok then
        for name in pairs(hero.Weapons) do hero.Weapons[name] = nil end
        for name, value in pairs(prior) do hero.Weapons[name] = value end
        error(errorValue, 0)
    end
end

-- WeaponUpgradeLogic.GetWeaponUpgradeLevel for the installed Aspect.
function install.weaponUpgradeLevel(run, traitName)
    local saved = record(run)
    if saved == nil or saved.installed.aspectKey ~= traitName then return nil end
    return saved.installed.aspectLevel
end

-- MetaUpgradeLogic.GetMetaUpgradeLevel: an installed card's planned rank,
-- every other card at its maximum (MetaUpgradeLogic.lua:21) for temporary draws.
function install.metaUpgradeLevel(run, name)
    local saved = record(run)
    if saved == nil then return nil end
    local planned = saved.installed.cardLevels[name]
    if planned ~= nil then return planned end
    local card = _G.MetaUpgradeCardData[name]
    return card and card.UpgradeResourceCost and #card.UpgradeResourceCost + 1 or nil
end

-- FamiliarShopLogic.GetFamiliarTraitStacks for the installed familiar's traits.
function install.familiarTraitStacks(run, traitName)
    local saved = record(run)
    local name = saved and saved.installed.familiarName
    local familiar = name and _G.FamiliarData[name]
    if familiar == nil or indexOf(familiar.TraitNames, traitName) == nil then return nil end
    return saved.installed.familiarStacks
end

-- Runs a native call with action-local state, restored even on error.
local function scoped(write, undo, action)
    write()
    local results = table.pack(pcall(action))
    undo()
    if not results[1] then error(results[2], 0) end
    return table.unpack(results, 2, results.n)
end

-- KeepsakeLogic.GetKeepsakeLevel with the keepsake's chambers at the
-- planner's rank for the call: the installed keepsake at its planned rank, and
-- any keepsake swapped in at the rack at the mature file's full chambers (rank
-- III). Native level bonuses still apply on top.
function install.withKeepsakeChambers(run, traitName, action)
    local saved = record(run)
    local declaration = _G.TraitData[traitName]
    if saved == nil or type(declaration) ~= "table" or type(declaration.ChamberThresholds) ~= "table" then
        return action()
    end
    local rank = saved.installed.keepsakeKey == traitName and saved.installed.keepsakeLevel or math.huge
    local chambers = 0
    for index, threshold in ipairs(declaration.ChamberThresholds) do
        if index >= rank then break end
        chambers = chambers + threshold
    end
    local records, prior = _G.GameState.KeepsakeChambers, nil
    return scoped(function()
        prior = records[traitName]
        records[traitName] = chambers
    end, function() records[traitName] = prior end, action)
end

-- MetaUpgradeLogic.AddRandomMetaUpgrades draws from every card for the call.
-- Unlocked is never held: QuestUnlockAllCards would complete.
function install.withUnlockedCards(run, action)
    if record(run) == nil then return action() end
    local states, prior = _G.GameState.MetaUpgradeState, {}
    return scoped(function()
        for name, state in pairs(states) do
            prior[name] = state.Unlocked
            state.Unlocked = true
        end
    end, function()
        for name, state in pairs(states) do state.Unlocked = prior[name] end
    end, action)
end

return install
