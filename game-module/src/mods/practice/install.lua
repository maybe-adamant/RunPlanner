-- Practice mode start installation. Every value comes from the published
-- startState; native trait, keepsake and Arcana functions apply it to a fresh
-- run without running acquisition effects (no FromLoot).
local nativeBindings = type(import) == "function" and import("mods/native_bindings.lua")
    or require("mods.native_bindings")
local chaos = type(import) == "function" and import("mods/traits/chaos.lua") or require("mods.traits.chaos")
local proof = type(import) == "function" and import("mods/room/conformance/proof.lua")
    or require("mods.room.conformance.proof")

local install = {}

-- RunFlag marks a run that started at a later biome; native EndRun keeps it on
-- the run record, so removal from RunHistory survives save and reload. The
-- start room fields identify the start room in the saved run.
install.runFlag = "RunPlannerPracticeStart"
local startRoomField, startDepthField = "RunPlannerPracticeStartRoom", "RunPlannerPracticeStartHistory"

-- DreamRunLogic.SelectNextDreamBiome's pool, in its construction order.
local dreamPool = { "G", "H", "I", "O", "P", "Q", "F", "N" }

local addArgs = {
    SkipNewTraitHighlight = true, SkipQuestStatusCheck = true,
    SkipActivatedTraitUpdate = true, SkipSetup = true,
}

local function copy(value)
    if type(value) ~= "table" then return value end
    local result = {}
    for key, item in pairs(value) do result[key] = copy(item) end
    return result
end

local function fault(checkpoint, expected, observed)
    error({ outcome = "fault", checkpoint = "practice-start:" .. checkpoint,
        expected = expected, observed = observed }, 0)
end

local function hero() return _G.CurrentRun.Hero end

-- The published rarity is the instance's rarity even where the declaration
-- has no RarityLevels entry for it, as TraitLogic.IncreaseTraitLevel keeps it.
local function processed(name, rarity, stackNum, declaredRarityOnly)
    local data = _G.GetProcessedTraitData({ Unit = hero(), TraitName = name, Rarity = rarity, StackNum = stackNum })
    if type(data) ~= "table" then fault("trait", name, "undeclared") end
    if rarity ~= nil and not declaredRarityOnly then data.Rarity = rarity end
    if stackNum ~= nil then data.StackNum = stackNum end
    return data
end

local function add(data, extra)
    local args = { TraitData = data }
    for key, value in pairs(addArgs) do args[key] = value end
    for key, value in pairs(extra or {}) do args[key] = value end
    return _G.AddTraitToHero(args)
end

local function held(name)
    local trait = _G.GetHeroTrait(name)
    if trait == nil then fault("held-trait", name, "missing") end
    return trait
end

function install.slottedKeepsake(start)
    for _, row in ipairs(start.keepsake.traits) do
        if row.slotted then return row end
    end
    return nil
end

-- The run-start equip of the current keepsake at its planner rank, without
-- its acquire effect (KeepsakeLogic.EquipKeepsake, RunLogic.lua:478).
function install.keepsakeEquipArgs(args, row)
    local result = copy(args or {})
    result.FromLoot = nil
    result.ForceRarity = row.rarity
    return result
end

-- Run-wide fields written before the start room exists: one stub RoomHistory
-- record per departed room, so native run and biome depth derive from it.
function install.runOverrides(start, routeKey)
    local roomData = _G.RoomData or {}
    local history = {}
    for index, record in ipairs(start.roomHistory) do
        local declared = roomData[record.name] or {}
        -- RunData.lua:498-502 gives every room its room set's name.
        local entry = { Name = record.name, RoomSetName = declared.RoomSetName }
        if record.nextRoomSet then entry.NextRoomSet = copy(declared.NextRoomSet) or {} end
        history[index] = entry
    end
    local reached, visited = {}, {}
    for index, key in ipairs(start.biomeVisitOrder) do reached[key], visited[index] = true, key end
    local overrides = {
        RoomHistory = history,
        EnteredBiomes = #start.biomeVisitOrder,
        BiomeVisitOrder = visited,
        BiomesReached = reached,
        EncounterDepth = start.encounterDepth,
        LastDevotionDepth = start.lastDevotionDepth,
        [install.runFlag] = true,
        [startRoomField] = start.roomName,
        [startDepthField] = #history,
    }
    if routeKey == "Dream" then
        local pool, excluded = {}, { [start.biomeKey] = true }
        for _, key in ipairs(start.biomeVisitOrder) do excluded[key] = true end
        for _, key in ipairs(dreamPool) do
            if not excluded[key] then pool[#pool + 1] = key end
        end
        overrides.DreamBiomePool = pool
        -- The biome completed before the current one (DreamRunLogic.lua:76); a
        -- Preboss's visit order already includes its own biome.
        local previous = #start.biomeVisitOrder - (start.point == "preboss" and 1 or 0)
        overrides.PrevDreamBiome = start.biomeVisitOrder[previous]
    end
    return overrides
end

-- Native StartNewRun creates args.RoomName directly. A later Dream biome's
-- Opening enters as DreamRunLogic.EnterNextDreamBiome does from a Dream
-- Postboss; a Preboss is not a biome entry.
function install.redirect(args, start, routeKey)
    args.RoomName = start.roomName
    if routeKey == "Dream" and start.point == "opening" then
        args.SkipChooseReward = true
        args.RoomOverrides = copy(args.RoomOverrides) or {}
        args.RoomOverrides.ForcedEntranceFunctionName = "RoomEntranceDreamBiomeStart"
    end
end

local function applyTraitFields(data, row)
    if row.blockInRunRarify then data.BlockInRunRarify = true end
    if row.upgradedTraitName then data.UpgradedTraitName = row.upgradedTraitName end
    if row.selectedTrait then data.SelectedTrait = row.selectedTrait end
    if row.repeatedKeepsake then data.RepeatedKeepsake = row.repeatedKeepsake end
    if row.currentRoom then data.CurrentRoom = row.currentRoom end
    if row.roomsPerUpgradeAmount or row.roomsPerUpgradeMaxMana then
        data.RoomsPerUpgrade = data.RoomsPerUpgrade or {}
        data.RoomsPerUpgrade.Amount = row.roomsPerUpgradeAmount or data.RoomsPerUpgrade.Amount
        data.RoomsPerUpgrade.MaxMana = row.roomsPerUpgradeMaxMana or data.RoomsPerUpgrade.MaxMana
    end
    if row.grantedTrait then
        -- PowersLogic.GiveRandomHadesBoonAndBoostBoons.
        data.GrantedTrait = true
        local lastStand = _G.GameState.MetaUpgradeState and _G.GameState.MetaUpgradeState.LastStand
        if lastStand and lastStand.Equipped then _G.CurrentRun.DeathDefianceDamageBoonEligible = true end
    end
    local stats = row.echoIncreaseStats
    if stats then
        -- EventLogic.EchoIncreaseStats at the current multiplier (RoomLogic.lua:4245-4256).
        data.StartMaxHealth, data.StartMaxMana = stats.startMaxHealth, stats.startMaxMana
        data.StatMultiplier, data.BlockDecay = stats.statMultiplier, stats.blockDecay
        data.Decay = data.AcquireFunctionArgs and data.AcquireFunctionArgs.Decay
        data.PropertyChanges = {
            { LuaProperty = "MaxMana", ChangeValue = stats.startMaxMana * stats.statMultiplier,
                ChangeType = "Add", AsInt = true },
            { LuaProperty = "MaxHealth", ChangeValue = stats.startMaxHealth * stats.statMultiplier,
                ChangeType = "Add", AsInt = true },
        }
    end
    if row.durationHammerUses then
        -- PowersLogic.AddRandomHammer.
        data.RemainingUses = row.durationHammerUses
        data.UsesAsEncounters = true
        data.OnExpire = { FunctionName = "HammerKeepsakeLostPresentation", FunctionArgs = row.name }
    end
end

local function installTraits(start)
    for _, row in ipairs(start.traits) do
        local data = processed(row.name, row.rarity, row.stackNum)
        applyTraitFields(data, row)
        add(data)
        if row.name == "FocusLastStandBoon" then
            -- Athena's Death Defiance is added only by its acquire function.
            local args = copy(held(row.name).AcquireFunctionArgs) or {}
            args.Silent = true
            _G.AddLastStand(args)
        end
    end
end

local function installChaos(start)
    for _, row in ipairs(start.chaosCurses) do
        local blessing = chaos.applyBlessing(processed(row.blessing.name, row.blessing.rarity),
            row.blessing.name, row.blessing.blessingValues)
        local curse = chaos.applyCurse(processed(row.name, row.blessing.rarity, nil, true), row.name,
            row.remainingUses, row.curseValues)
        curse.OnExpire = curse.OnExpire or {}
        curse.OnExpire.TraitData = blessing
        add(curse)
    end
    for _, row in ipairs(start.chaosBlessings) do
        local blessing = chaos.applyBlessing(processed(row.name, row.rarity), row.name, row.blessingValues)
        if row.fromChaosKeepsake then
            -- PowersLogic.AddRandomChaosBlessing.
            blessing.FromChaosKeepsake = true
            blessing.CustomTitle = "ChaosCombo_ChaosKeepsakePrefix_" .. row.name
        end
        add(blessing)
    end
end

local function keepsakeCounters(trait, row)
    if row.remainingUses ~= nil then trait.RemainingUses = row.remainingUses end
    if row.uses ~= nil then trait.Uses = row.uses end
    if row.rarityUpgradeUses ~= nil then
        trait.RarityUpgradeData = trait.RarityUpgradeData or {}
        trait.RarityUpgradeData.Uses = row.rarityUpgradeUses
    end
    if row.boonConversionUses ~= nil then trait.BoonConversionUses = row.boonConversionUses end
    if row.currentRoom ~= nil then trait.CurrentRoom = row.currentRoom end
    if row.currentKeepsakeDamageBonus ~= nil then trait.CurrentKeepsakeDamageBonus = row.currentKeepsakeDamageBonus end
    if row.escalatingKeepsakeValue ~= nil then trait.EscalatingKeepsakeValue = row.escalatingKeepsakeValue end
end

local function installKeepsakes(start)
    local rarity
    for _, row in ipairs(start.keepsake.traits) do
        if row.name == "SkipEncounterKeepsake" then rarity = row.rarity end
        if row.slotted then
            keepsakeCounters(held(row.name), row)
        else
            -- A kept Permanent keepsake or Echo copy is held without a slot
            -- (KeepsakeLogic.UnequipKeepsake; TraitLogic.AddTrait OverwriteSlot).
            local data = processed(row.name, row.rarity)
            data.Slot, data.ActiveSlotOffsetIndex = nil, nil
            keepsakeCounters(data, row)
            add(data)
        end
    end
    local skip = start.keepsake.persistentDionysusSkip
    if skip ~= nil then
        -- PowersLogic.DionysusSkipTrait.
        local data = processed("PersistentDionysusSkipKeepsake", rarity)
        local declared = _G.TraitData.SkipEncounterKeepsake
        data.RemainingUses = skip.remainingUses
        data.SkipEncounterChance = declared and declared.AcquireFunctionArgs
            and declared.AcquireFunctionArgs.SkipEncounterChance
        add(data, { SkipUIUpdate = true })
    end
end

local function installArcana(start)
    local cards, states = _G.MetaUpgradeCardData, _G.GameState.MetaUpgradeState
    for _, card in ipairs(start.arcana) do
        local traitName = cards[card.name] and cards[card.name].TraitName
        if traitName == nil then fault("arcana", card.name, "undeclared") end
        if card.temporary then
            -- MetaUpgradeLogic.AddRandomMetaUpgrades.
            states[card.name] = states[card.name] or {}
            states[card.name].Equipped = true
            _G.CurrentRun.TemporaryMetaUpgrades[card.name] = true
            if not _G.HeroHasTrait(traitName) then
                add(processed(traitName, card.rarity), { SourceName = card.name })
            end
        elseif held(traitName).Rarity ~= card.rarity then
            -- EventLogic.CirceUpgradeArcana raises a card by re-adding it.
            _G.RemoveWeaponTrait(traitName, { Silent = true })
            add(processed(traitName, card.rarity), { SourceName = card.name })
        end
        local trait = held(traitName)
        if card.currentRoom ~= nil then trait.CurrentRoom = card.currentRoom end
        if card.metaConversionUses ~= nil then
            local capacity = trait.MetaConversionUses or card.metaConversionUses
            trait.MetaConversionUses = card.metaConversionUses
            _G.CurrentRun.MetaConversionUses = capacity - card.metaConversionUses
        end
    end
    for _, vow in ipairs(start.disabledVows) do
        -- EventLogic.CirceRemoveShrineUpgrades.
        _G.CurrentRun.ShrineUpgradesDisabled[vow] = true
        local declaration = _G.MetaUpgradeData[vow]
        if declaration and declaration.OnDisabledFunctionName then
            _G.CallFunctionName(declaration.OnDisabledFunctionName)
        end
        _G.ShrineUpgradeExtractValues(vow)
    end
end

local function installEquipment(start, aspectKey)
    if start.aspectPerfect and aspectKey ~= nil then
        -- Premium Service re-adds the aspect a rank higher (TraitLogic.UpgradeAspect).
        _G.RemoveTrait(hero(), aspectKey)
        add(processed(aspectKey, "Perfect"))
    end
    local familiar = start.familiar
    local bonus = familiar and familiar.stackMultiplier - 1 or 0
    if bonus <= 0 then return end
    -- EventLogic.CircePetMultiplier.
    local increase = {}
    for _, trait in ipairs(hero().Traits) do
        if trait.FamiliarTrait then
            if trait.FamiliarLastStandHealAmount ~= nil then
                for _ = 1, bonus do
                    _G.AddLastStand({
                        Name = "LastStandFamiliar", Icon = "ExtraLifeCatFamiliar", InsertAtEnd = true,
                        IncreaseMax = true, Silent = true,
                        HealAmount = _G.GetTotalHeroTraitValue("FamiliarLastStandHealAmount"),
                    })
                end
                trait.ReportedFamiliarLastStandAmount = familiar.stackMultiplier
            else
                increase[#increase + 1] = trait
            end
        end
    end
    for _, trait in ipairs(increase) do
        local stacks = (trait.StackNum or 1) * bonus + (trait.CirceBonusStacks or 0) * bonus
        _G.IncreaseTraitLevel(trait, math.floor(stacks + 0.5))
    end
end

-- Each recorded grant no installed trait re-creates is one plain hidden trait,
-- as RoomLogic.AddMaxHealth/AddMaxMana add them, without a Source.
local function installHiddenGrants(start)
    for _, grant in ipairs(start.maxStats.hiddenGrants) do
        if grant.maxHealth ~= 0 then
            local data = processed("RoomRewardMaxHealthTrait")
            data.PropertyChanges[1].ChangeValue = grant.maxHealth
            add(data)
        end
        if grant.maxMana ~= 0 then
            local data = processed("RoomRewardMaxManaTrait")
            data.PropertyChanges[1].ChangeValue = grant.maxMana
            data.Source = nil
            add(data)
        end
    end
end

local function installWell(start)
    local well, names = start.stygianWell, nativeBindings.conformance.stygianWellTraits
    for _, row in ipairs(well.timedTraits) do
        local data = processed(row.name)
        data.RemainingUses = row.remainingUses
        if row.clock == "bosses" then
            -- An Archaic Seal extension (StoreLogic.lua:1206-1212).
            data.UsesAsEncounters, data.UsesAsRooms, data.UsesAsBosses = false, false, true
        end
        add(data, { SkipAddToHUD = true })
    end
    -- Each purchase is its own instance with the declared single use
    -- (TraitData_Store.lua:282-320).
    for _, key in ipairs({ "sparkUses", "yarnUses", "extendedUses" }) do
        for _ = 1, well[key] do
            local data = processed(names[key])
            data.RemainingUses = 1
            add(data, { SkipAddToHUD = true })
        end
    end
    if well.hymnUses > 0 then
        -- EventLogic.AddLimitedSwapTrait.
        local data = processed(names.hymnUses)
        data.Uses = well.hymnUses
        add(data)
    end
end

-- A pending Hermes order is the delivery trait SurfaceShopLogic builds at
-- purchase; it spawns its item when its uses expire.
local function installDeliveries(start)
    for _, delivery in ipairs(start.hermesDeliveries) do
        local data = copy(_G.TraitData.StorePendingDeliveryItem)
        local item = {
            Name = delivery.rewardType, Type = "Consumable",
            ResourceCosts = { Money = 0 }, CostOverride = 0, PendingShopItem = true,
        }
        data.RemainingUses = delivery.remainingUses
        data.OnExpire = { SpawnShopItem = item }
        data.ShopItemName = item.Name
        data.ItemDisplayName = _G.GetSurfaceShopText(item, { ForTraitTray = true })
        if item.Name == "SpellDrop" then _G.CurrentRun.PendingSpellDrop = true end
        add(data, { SkipUIUpdate = true })
    end
end

local function spellName(traitName)
    for name, data in pairs(_G.SpellData) do
        if type(data) == "table" and data.TraitName == traitName then return name end
    end
    fault("spell", traitName, "undeclared")
end

-- The Spell as SpellScreenLogic installs it, then each invested talent as the
-- talent screen does without FromLoot (TalentScreenLogic.lua:525-534).
local function installHex(start, hexTree, diagnostic)
    local hex = start.hex
    if hex == nil then return end
    local spell = hero().SlottedSpell
    if not (type(spell) == "table" and spell.TraitName == hex.spellTraitName) then
        if not _G.HeroHasTrait(hex.spellTraitName) then add(processed(hex.spellTraitName)) end
        local name = spellName(hex.spellTraitName)
        local function create() return _G.CreateTalentTree(_G.SpellData[name]) end
        local talents = hex.tree and hexTree.realize(hex.tree, hex.spellTraitName, diagnostic, create) or create()
        spell = _G.DeepCopyTable(_G.SpellData[name])
        spell.Talents = _G.DeepCopyTable(talents)
        hero().SlottedSpell = spell
    end
    for _, key in ipairs(hex.investedNodes) do
        local depth, slot = key:match("^(%d+):(%d+)$")
        local column = spell.Talents[tonumber(depth)]
        local node = type(column) == "table" and column[tonumber(slot)] or nil
        if type(node) ~= "table" then
            diagnostic("practice-start:hex-node", key, "missing")
        else
            node.Invested = true
            local declaration = _G.TraitData[node.Name]
            if declaration and declaration.IsDuoBoon then spell.ObtainedDuoTalent = true end
            if _G.HeroHasTrait(node.Name) then
                _G.IncreaseTraitLevel(_G.GetHeroTrait(node.Name))
            else
                add(processed(node.Name, node.Rarity))
            end
        end
    end
    _G.CurrentRun.InvestedTalentPoints = #hex.investedNodes
    _G.UpdateTalentPointInvestedCache()
end

local function refillSpell(start)
    local trait = start.hex and _G.GetHeroTrait(start.hex.spellTraitName)
    if trait and trait.MaxUses then
        trait.RemainingUses = trait.MaxUses + _G.GetTotalHeroTraitValue("BonusSpellUses")
    end
end

-- Max-stat presentation is not part of the install.
local presentation = { "MaxHealthIncreaseText", "BonusHealthAndManaPresentation", "InCombatTextArgs" }

-- The hero's state, after native StartNewRun equipped the keepsake, familiar,
-- aspect and Arcana and before it counts rerolls and Death Defiance
-- (RunLogic.lua:478-497), so both include the installed traits.
function install.hero(start, context)
    local taken, silenced = {}, {}
    for key, value in pairs(_G.GameState.TraitsTaken or {}) do taken[key] = value end
    for _, name in ipairs(presentation) do
        silenced[name] = _G[name]
        _G[name] = function() end
    end
    local ok, result = pcall(function()
        installArcana(start)
        installEquipment(start, context.aspectKey)
        installTraits(start)
        installChaos(start)
        installKeepsakes(start)
        installHiddenGrants(start)
        installWell(start)
        installDeliveries(start)
        installHex(start, context.hexTree, context.diagnostic)
        refillSpell(start)
        _G.UpdateHeroTraitDictionary()
    end)
    for _, name in ipairs(presentation) do _G[name] = silenced[name] end
    if _G.GameState.TraitsTaken ~= nil then
        for key in pairs(_G.GameState.TraitsTaken) do
            if taken[key] == nil then _G.GameState.TraitsTaken[key] = nil end
        end
    end
    if not ok then error(result, 0) end
end

local function rewardStores(start)
    for _, store in ipairs(start.rewardStores) do
        local declared = _G.RewardStoreData[store.name]
        if type(declared) ~= "table" or #declared ~= #store.remainingEntryCounts then
            fault("reward-store", store.name, declared and #declared or "undeclared")
        end
        -- Remaining entries in declaration order, then each refill's copies.
        local entries, pass, more = {}, 1, true
        while more do
            more = false
            for index, count in ipairs(store.remainingEntryCounts) do
                if count >= pass then entries[#entries + 1] = copy(declared[index]) end
                if count > pass then more = true end
            end
            pass = pass + 1
        end
        _G.CurrentRun.RewardStores[store.name] = entries
    end
end

-- Barren holds the Arcana unequipped. Removed after native Death Defiance and
-- rerolls and before native StartNewRun credits starting gold
-- (RunLogic.lua:489-514), at either start point.
function install.barren(start)
    -- PowersLogic.RemoveArcana.
    if start.arcanaBarren then _G.UnequipMetaUpgrades(nil, hero()) end
end

-- Run-wide records: an Opening's after native InitializeRewardStores and before
-- the start room's creation reads them (RunLogic.lua:502-506), a Preboss's
-- after its creation.
function install.records(start)
    local run = _G.CurrentRun
    run.UseRecord = copy(start.useRecord)
    run.LootTypeHistory = copy(start.lootTypeHistory)
    run.ConsumableRecord = copy(start.consumableRecord)
    run.RewardPriorities = copy(start.rewardPriorities)
    run.KeepsakeCache = copy(start.keepsake.keepsakeCache)
    run.BlockedKeepsakes = copy(start.keepsake.blockedKeepsakes)
    run.WellShopPurchases = copy(start.stygianWell.wellShopPurchases)
    if start.hex ~= nil then run.NumTalentPoints = start.hex.talentPoints end
    rewardStores(start)
end

-- Native LeaveRoom generates every next room's shop (RoomLogic.lua:4394), which
-- StartNewRun never does. RunShopGeneration names the room from the global
-- roomData that map load sets (RoomLogic.lua:207, StoreLogic.lua:449), nil
-- after a hub map; the name only feeds RequiredNextMaps and RequiredFalseNextMaps,
-- which no store item declares.
local function generateShop(room)
    local prior = _G.roomData
    _G.roomData = _G.RoomData[room.GenusName or room.Name]
    local ok, result = pcall(_G.RunShopGeneration, room)
    _G.roomData = prior
    if not ok then error(result, 0) end
end

-- A Preboss's captured state already includes its own creation, so its records
-- replace what native CreateRoom wrote, before StartRoom reads them. The map
-- load before StartRoom derives BiomeDepthCache from the stub history
-- (PatchLogic.lua:687-689); the self-check compares it.
function install.prebossRoom(start, room)
    install.records(start)
    local run, biome = _G.CurrentRun, start.biome
    run.BiomeEncounterDepth = biome.biomeEncounterDepth
    run.BiomeUseRecord = copy(biome.biomeUseRecord)
    -- Forfeit's single rank allows one use per biome (ShrineLogic.lua:918-921).
    run.BiomeBoonSkipCount = biome.forfeitConsumed and 1 or 0
    local skip = biome.dionysusSkipActivated and _G.GetHeroTrait("PersistentDionysusSkipKeepsake")
    if skip then
        -- EncounterLogic.HandleEnemySpawns marks the skip for the biome.
        skip.ActivatedThisBiome = true
    end
    if biome.clockwork ~= nil then
        -- RewardLogic.InitClockworkGoalReward runs at I_Intro.
        run.RemainingClockworkGoals = biome.clockwork.remainingClockworkGoals
        run.MaxClockworkNonGoalRewards = biome.clockwork.maxClockworkNonGoalRewards
    end
    -- Tight Deadline grants its allowance only in a BiomeStartRoom
    -- (RoomLogic.lua:1205-1215); a Preboss start begins with it full.
    if _G.GetNumShrineUpgrades("BiomeSpeedShrineUpgrade") > 0 then
        run.BiomeTime = math.max(run.BiomeTime or 0, 0) + _G.MetaUpgradeData.BiomeSpeedShrineUpgrade.ChangeValue
    end
    generateShop(room)
end

-- The authored gold on top of native starting gold, written as
-- DeathLoopLogic.lua:136 writes Money so lifetime totals are not credited.
function install.creditGold(start)
    if start.gold == 0 then return end
    local resources = _G.GameState.Resources
    resources.Money = (resources.Money or 0) + start.gold
    _G.UpdateMoneyUI()
end

-- Whether native StartRoom is entering the practice run's start room, on first
-- entry or after Save & Quit. StartRoom passes false for every room after the
-- first; RestoreUnlockRoomExits and the hub pass nil (RoomLogic.lua:1114, 1490).
function install.startRoom(run, room, applyLuaUpgrades)
    return applyLuaUpgrades == false and type(run) == "table" and run[install.runFlag] == true
        and type(room) == "table" and (room.GenusName or room.Name) == run[startRoomField]
        and type(run.RoomHistory) == "table" and #run.RoomHistory == run[startDepthField]
end

-- A non-empty RoomHistory skips first-room hero setup (RoomLogic.lua:1114-1119);
-- the start room still applies trait Lua upgrades and validates the maxima.
function install.heroSetup(base, room)
    local result = base(room, true)
    _G.ValidateMaxHealth()
    _G.ValidateMaxMana()
    local unit = hero()
    unit.Health = unit.MaxHealth
    return result
end

-- The maxima, and a Preboss's biome depth as the map load derived it.
function install.verifyStart(start)
    local unit = hero()
    local ok, mismatch = proof.compare("practice-start:max-health", start.maxStats.maxHealth, unit.MaxHealth)
    if not ok then return nil, mismatch end
    ok, mismatch = proof.compare("practice-start:max-mana", start.maxStats.maxMana, unit.MaxMana)
    if not ok or start.biome == nil then return ok, mismatch end
    return proof.compare("practice-start:biome-depth", start.biome.biomeDepthCache, _G.CurrentRun.BiomeDepthCache)
end

return install
