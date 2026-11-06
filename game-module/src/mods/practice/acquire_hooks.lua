-- Every native trait AcquireFunctionName, classified for installs that skip
-- it. Practice and snap add traits without FromLoot, so native AddTraitData
-- never runs these (TraitLogic.lua:901-906), and none is safe to call outside
-- its acquisition: they read the current room, spawn pickups or open menus.
-- restoreState: the instance or run state the hook writes, written here.
-- alreadyApplied: the published start state or frame already carries the result.
-- presentation: only draws.
-- neverRun: a one-shot spawn, menu or heal whose result is not run state.
local acquire = {}

acquire.CLASSES = { restoreState = true, alreadyApplied = true, presentation = true, neverRun = true }

-- PowersLogic.StartChaosTimer and StartHermesKeepsakeTimer. Expiry is not
-- modeled, so an installed timer starts full.
local function fullTimer(trait) trait.CurrentTime = trait.StartingTime end

local function restore(write) return { class = "restoreState", write = write } end
local applied = { class = "alreadyApplied" }
local presentation = { class = "presentation" }
local never = { class = "neverRun" }

-- `source` holds the published per-instance fields (start-state wire names);
-- an absent field keeps what the instance already carries, as a snap re-add's
-- carried fields.
acquire.hooks = {
    StartHermesKeepsakeTimer = restore(fullTimer),
    StartChaosTimer = restore(fullTimer),
    -- PowersLogic.BankGold: the loan's payout. A paid-back loan keeps the
    -- declared 0 (CombatLogic.lua:3962).
    BankGold = restore(function(trait, source)
        if source.storedGold ~= nil then trait.StoredGold = source.storedGold end
    end),
    -- The granted boon is a published trait (GrantedTrait); the run's Fated
    -- status it checks is written by install.records and snap.
    GiveRandomHadesBoonAndBoostBoons = restore(function() end),
    -- Athena's Death Defiance exists only through its acquire.
    AddLastStand = restore(function(trait)
        local args = {}
        for key, value in pairs(trait.AcquireFunctionArgs or {}) do args[key] = value end
        args.Silent = true
        _G.AddLastStand(args)
    end),
    -- EventLogic.EchoIncreaseStats at the published multiplier (RoomLogic.lua:4245-4256).
    EchoIncreaseStats = restore(function(trait, source)
        local stats = source.echoIncreaseStats
        if stats == nil then return end
        trait.StartMaxHealth, trait.StartMaxMana = stats.startMaxHealth, stats.startMaxMana
        trait.StatMultiplier, trait.BlockDecay = stats.statMultiplier, stats.blockDecay
        trait.Decay = trait.AcquireFunctionArgs and trait.AcquireFunctionArgs.Decay
        trait.PropertyChanges = {
            { LuaProperty = "MaxMana", ChangeValue = stats.startMaxMana * stats.statMultiplier,
                ChangeType = "Add", AsInt = true },
            { LuaProperty = "MaxHealth", ChangeValue = stats.startMaxHealth * stats.statMultiplier,
                ChangeType = "Add", AsInt = true },
        }
    end),
    EchoRepeatKeepsake = restore(function(trait, source)
        if source.repeatedKeepsake ~= nil then trait.RepeatedKeepsake = source.repeatedKeepsake end
    end),
    HeraSuperchargeBoon = restore(function(trait, source)
        if source.upgradedTraitName ~= nil then trait.UpgradedTraitName = source.upgradedTraitName end
    end),
    IcarusUpgradeBoon = restore(function(trait, source)
        if source.selectedTrait ~= nil then trait.SelectedTrait = source.selectedTrait end
    end),
    -- ManaLogic.SetManaRegenUnique keys the blessing's regen source by its
    -- instance Id, which AddTraitData keeps when already set.
    SetManaRegenUnique = restore(function(trait)
        trait.Id = trait.Id or _G.GetTraitUniqueId()
        if trait.SetupFunction and trait.SetupFunction.Args then trait.SetupFunction.Args.Name = trait.Id end
    end),

    RewardStoreAddPriority = applied,
    ChaosBlessingBonus = applied,
    GiveDurationHammer = applied,
    DionysusSkipTrait = applied,
    AttemptAdvanceKeepsake = applied,
    AthenaRefillLastStands = applied,
    EchoRefillLastStands = applied,
    DistributeLevels = applied,
    EchoDoubleLevelBoon = applied,
    SacrificeAllBoon = applied,
    UpgradeAspect = applied,
    UpgradeHammers = applied,
    GrantBoons = applied,
    GrantPotionBonusCharges = applied,
    GrantRandomMaxHealth = applied,
    CirceMetaUpgradeRarity = applied,
    CirceRandomMetaUpgrade = applied,
    CirceRemoveShrineUpgrades = applied,
    CircePetMultiplier = applied,
    RemoveArcana = applied,
    UpdateUpgradableTraitCount = applied,
    UpdateLastMomentManaRestoreEligibility = applied,
    UpdateStoreItemCostText = applied,
    -- Its talent points are the published unspent bank.
    KeepsakeAcquireSpellDrop = applied,
    -- Native EquipKeepsake grants Silver Wheel's Magick without FromLoot.
    KeepsakeAddMaxMana = applied,

    HeavyArmorInitialPresentation = presentation,
    SetupBloodDropDisplay = presentation,

    GiveRandomConsumables = never,
    EchoLastReward = never,
    EchoLastRunBoon = never,
    AddTraitResources = never,
    -- A one-shot heal; current health is not installed state.
    CirceHeal = never,
}

-- Applies the restoreState writer of the trait's acquire hook to an instance
-- installed without it, before or after its add. Unclassified hooks fault.
function acquire.restore(trait, source)
    local name = type(trait) == "table" and trait.AcquireFunctionName or nil
    if name == nil then return trait end
    local entry = acquire.hooks[name]
    if entry == nil then
        error({ outcome = "fault", checkpoint = "practice-start:acquire-hook",
            expected = "classified acquire hook", observed = name }, 0)
    end
    if entry.write then entry.write(trait, source or {}) end
    return trait
end

-- Every AcquireFunctionName the game's TraitData declares that the table does
-- not classify, sorted; a game patch that adds one shows here.
function acquire.unclassified(traitData)
    local missing, seen = {}, {}
    for _, data in pairs(type(traitData) == "table" and traitData or {}) do
        local name = type(data) == "table" and data.AcquireFunctionName or nil
        if type(name) == "string" and acquire.hooks[name] == nil and not seen[name] then
            seen[name] = true
            missing[#missing + 1] = name
        end
    end
    table.sort(missing)
    return missing
end

-- Faults a Practice start naming the first unclassified hook.
function acquire.requireClassified(traitData)
    local missing = acquire.unclassified(traitData)
    if #missing > 0 then
        error({ outcome = "fault", checkpoint = "practice-start:acquire-hook",
            expected = "classified acquire hook", observed = table.concat(missing, ", ") }, 0)
    end
end

-- Load-time audit against the game's declarations.
do
    local missing = acquire.unclassified(rawget(_G, "TraitData"))
    local log = rawget(_G, "rom") and rom.log
    for _, name in ipairs(missing) do
        if log and log.warning then
            log.warning("[RunPlanner] unclassified trait acquire hook " .. name .. "; Practice starts will refuse")
        elseif log and log.info then
            log.info("[RunPlanner] unclassified trait acquire hook " .. name .. "; Practice starts will refuse")
        end
    end
end

return acquire
