-- Snap: return the live hero to one room's roomEntered frame by writing only
-- the differences, before native StartRoom binds the hero. Every write reuses
-- the Practice writers; state no check reads stays live.
local practice = type(import) == "function" and import("mods/practice/install.lua")
    or require("mods.practice.install")
local readers = type(import) == "function" and import("mods/room/conformance/readers.lua")
    or require("mods.room.conformance.readers")
local conformance = type(import) == "function" and import("mods/protocol/conformance.lua")
    or require("mods.protocol.conformance")
local admission = type(import) == "function" and import("mods/room/conformance/admission.lua")
    or require("mods.room.conformance.admission")
local proof = type(import) == "function" and import("mods/room/conformance/proof.lua")
    or require("mods.room.conformance.proof")
local nativeBindings = type(import) == "function" and import("mods/native_bindings.lua")
    or require("mods.native_bindings")
local modeledTraits = type(import) == "function" and import("modeled_traits.lua") or require("modeled_traits")
local json = type(import) == "function" and import("mods/protocol/json.lua") or require("mods.protocol.json")

local snap = {}

-- Removal never runs OnExpire: a curse grants no blessing, a delivery spawns nothing.
local REMOVE = { SkipExpire = true, SkipActivatedTraitUpdate = true }
local ELEMENTS = { "Fire", "Air", "Earth", "Water" }
local universe = {}
for _, key in ipairs(modeledTraits.traits) do universe[key] = true end

local function copy(value)
    if type(value) ~= "table" then return value end
    local result = {}
    for key, item in pairs(value) do result[key] = copy(item) end
    return result
end

local function present(value) return value ~= nil and not json.isNull(value) end
local function run() return _G.CurrentRun end
local function hero() return _G.CurrentRun.Hero end

local function find(name)
    for _, trait in ipairs(hero().Traits) do
        if trait.Name == name then return trait end
    end
    return nil
end

local function each(name)
    local found = {}
    for _, trait in ipairs(hero().Traits) do
        if trait.Name == name then found[#found + 1] = trait end
    end
    return found
end

-- The hero's traits now, so removals during a pass do not skip entries.
local function traits()
    local list = {}
    for index, trait in ipairs(hero().Traits) do list[index] = trait end
    return list
end

local function remove(trait) _G.RemoveTraitData(hero(), trait, REMOVE) end
local function removeAll(name) for _, trait in ipairs(each(name)) do remove(trait) end end
local function set(list)
    local result = {}
    for _, key in ipairs(list or {}) do result[key] = true end
    return result
end

-- Whether a family already reads exactly as the frame expects it.
local function matches(expected, kind)
    return proof.compare("snap:" .. kind, expected[kind],
        readers.read(kind, run(), _G.GameState, expected[kind])) == true
end

local function isKeepsake(trait)
    local declared = _G.TraitData[trait.Name]
    return type(declared) == "table" and declared.Slot == "Keepsake"
end

-- KeepsakeLogic.UnequipKeepsake/EquipKeepsake with the planned rank, then
-- unslotted keepsakes and every held keepsake's counters.
local function keepsakes(frame)
    local rows, slottedRow, wanted = frame.keepsakes.held, nil, {}
    for _, row in ipairs(rows) do
        wanted[row.name] = row
        if row.slotted then slottedRow = row end
    end
    local slotted
    for _, trait in ipairs(hero().Traits) do
        if trait.Slot == "Keepsake" then slotted = trait end
    end
    if slotted and (slottedRow == nil or slotted.Name ~= slottedRow.name or slotted.Rarity ~= slottedRow.rarity) then
        _G.UnequipKeepsake(hero(), slotted.Name)
        slotted = nil
    end
    for _, trait in ipairs(traits()) do
        local row = wanted[trait.Name]
        if isKeepsake(trait) and trait.Slot ~= "Keepsake"
            and (row == nil or row.slotted or trait.Rarity ~= row.rarity) then
            remove(trait)
        end
    end
    if slottedRow and slotted == nil then
        _G.EquipKeepsake(hero(), slottedRow.name, practice.keepsakeEquipArgs({}, slottedRow))
    end
    for _, row in ipairs(rows) do
        if not row.slotted and find(row.name) == nil then
            -- A kept Permanent keepsake or Echo copy is held without a slot.
            local data = practice.processed(row.name, row.rarity)
            data.Slot, data.ActiveSlotOffsetIndex = nil, nil
            practice.add(data)
        end
        local trait = find(row.name)
        if trait then practice.keepsakeCounters(trait, row) end
    end
    run().KeepsakeCache = copy(frame.keepsakes.usedKeys)
    run().BlockedKeepsakes = copy(frame.keepsakes.blockedKeys)
end

-- Premium Service's re-add (TraitLogic.UpgradeAspect) and Circe's stacks
-- (EventLogic.CircePetMultiplier), each only when it differs.
local function equipment(frame, expected)
    local aspect = frame.equipment.aspect
    local trait = aspect and find(aspect.key)
    if aspect and (trait == nil or trait.Rarity ~= aspect.rarity) then
        if trait then remove(trait) end
        practice.add(practice.processed(aspect.key, aspect.rarity))
    end
    local familiar = frame.equipment.familiar
    if familiar == nil or matches(expected, "equipment") then return end
    local multiplier = familiar.stackMultiplier
    for _, current in ipairs(traits()) do
        if current.FamiliarTrait then
            if current.FamiliarLastStandHealAmount ~= nil then
                current.ReportedFamiliarLastStandAmount = multiplier > 1 and multiplier or nil
            else
                local bonus = current.CirceBonusStacks or 0
                local stacks = (_G.GetFamiliarTraitStacks(current.Name) + bonus) * multiplier - bonus
                if current.StackNum ~= stacks then
                    remove(current)
                    practice.add(practice.processed(current.Name, nil, stacks))
                end
            end
        end
    end
end

-- MetaUpgradeLogic's card writes: a held card at its rarity, a Barren-held
-- card equipped without its trait, an unplanned card removed.
local function arcana(frame)
    local states, temporary = _G.GameState.MetaUpgradeState, run().TemporaryMetaUpgrades
    local planned = {}
    for _, row in ipairs(frame.arcana.active) do planned[row.key] = row end
    for key, card in pairs(_G.MetaUpgradeCardData) do
        local state, traitName = states[key], card.TraitName
        if type(state) == "table" and traitName then
            local row, trait = planned[key], find(traitName)
            if row == nil then
                if trait then _G.RemoveWeaponTrait(traitName, { Silent = true }) end
                state.Equipped, temporary[key] = false, nil
            else
                state.Equipped, temporary[key] = true, row.origin == "temporary" or nil
                if trait and (not row.held or trait.Rarity ~= row.rarity) then
                    _G.RemoveWeaponTrait(traitName, { Silent = true })
                    trait = nil
                end
                if row.held and trait == nil then
                    practice.add(practice.processed(traitName, row.rarity), { SourceName = key })
                end
            end
        end
    end
    local artificer = frame.artificer
    if present(artificer) then
        run().MetaConversionUses = artificer.usedCount
        for _, trait in ipairs(hero().Traits) do
            if artificer.remainingCount ~= nil and type(trait.MetaConversionUses) == "number" then
                trait.MetaConversionUses = artificer.remainingCount
            end
        end
    end
end

-- EventLogic.CirceRemoveShrineUpgrades and its reverse; a re-enabled vow
-- restores what StartNewRun set from it (RunLogic.lua:24-28, 488).
local function vows(frame)
    local disabled, planned = run().ShrineUpgradesDisabled, set(frame.vows.disabledKeys)
    for vow in pairs(planned) do
        if not disabled[vow] then
            disabled[vow] = true
            local declaration = _G.MetaUpgradeData[vow]
            if declaration and declaration.OnDisabledFunctionName then
                _G.CallFunctionName(declaration.OnDisabledFunctionName)
            end
            _G.ShrineUpgradeExtractValues(vow)
        end
    end
    for vow in pairs(copy(disabled)) do
        if not planned[vow] then
            disabled[vow] = nil
            _G.ShrineUpgradeExtractValues(vow)
            if vow == "EnemyDamageShrineUpgrade" then
                _G.RemoveIncomingDamageModifier(hero(), vow)
                _G.AddIncomingDamageModifier(hero(), {
                    Name = vow, NonTrapDamageTakenMultiplier = _G.MetaUpgradeData[vow].ChangeValue,
                })
            elseif vow == "BiomeSpeedShrineUpgrade" then
                run().ActiveBiomeTimer = _G.GetNumShrineUpgrades(vow) > 0
            end
        end
    end
    if frame.forfeit ~= "inactive" then
        -- Forfeit's single rank allows one use per biome (ShrineLogic.lua:918-921).
        local rank = _G.GetNumShrineUpgrades(nativeBindings.conformance.shrineUpgrades.forfeit)
        run().BiomeBoonSkipCount = frame.forfeit == "consumed" and rank or 0
    end
    run().BannedTraits = set(frame.traits.bannedTraitKeys)
end

local function traitMatches(trait, row)
    if row.hammerRank ~= nil then
        if (trait.Rarity == "Legendary" and "RankII" or "RankI") ~= row.hammerRank then return false end
    elseif row.rarity ~= nil and trait.Rarity ~= row.rarity then
        return false
    end
    return row.level == nil or _G.GetTraitCount(hero(), { Name = trait.Name }) == row.level
end

local function rowRarity(row) return row.hammerRank == "RankII" and "Legendary" or row.rarity end

-- Modelled traits: exact matches stay, extras go, a wrong level or rarity is a
-- remove plus a re-add carrying PersistentTraitKeys (TraitLogic.lua:2543-2560).
local function modeled(frame)
    local disposable, planned = nativeBindings.conformance.disposableTraits, {}
    for _, row in ipairs(frame.traits.equipped) do
        if universe[row.traitKey] and not disposable[row.traitKey] then planned[row.traitKey] = row end
    end
    local kept = {}
    for _, trait in ipairs(traits()) do
        local name = trait.Name
        if universe[name] and not disposable[name] then
            local row = planned[name]
            if row == nil or kept[name] then
                remove(trait)
            elseif traitMatches(trait, row) then
                kept[name] = true
            else
                local persistent = {}
                for _, key in ipairs(_G.PersistentTraitKeys) do persistent[key] = trait[key] end
                remove(trait)
                local data = practice.processed(name, rowRarity(row), row.level)
                for key, value in pairs(persistent) do data[key] = value end
                practice.add(data)
                kept[name] = true
            end
        end
    end
    for name, row in pairs(planned) do
        if not kept[name] then practice.add(practice.processed(name, rowRarity(row), row.level)) end
    end
end

local function chaosFamily(frame, expected)
    if matches(expected, "chaos") and matches(expected, "chaosValues") then return end
    for _, trait in ipairs(traits()) do
        if trait.Name:match("^Chaos.*Curse$") or trait.Name:match("^Chaos.*Blessing$") then remove(trait) end
    end
    local embryo = frame.retainedEffects.keepsakes.transcendentEmbryo
    local marked = present(embryo) and embryo.markedBlessingKey or nil
    local curses, blessings = {}, {}
    for _, row in ipairs(frame.chaos.active) do
        curses[#curses + 1] = {
            name = row.curseKey, remainingUses = row.remaining, curseValues = row.curseValues,
            blessing = { name = row.blessingKey, rarity = row.rarity, blessingValues = row.blessingValues },
        }
    end
    for _, row in ipairs(frame.chaos.matured) do
        blessings[#blessings + 1] = {
            name = row.blessingKey, rarity = row.rarity, blessingValues = row.blessingValues,
            fromChaosKeepsake = row.blessingKey == marked or nil,
        }
    end
    practice.chaos({ chaosCurses = curses, chaosBlessings = blessings })
end

-- Well charges and pending Hermes orders, rewritten whole when they differ.
local function wellFamily(frame, expected)
    if not matches(expected, "stygianWell") then
        local names, well = nativeBindings.conformance.stygianWellTraits, frame.retainedEffects.stygianWell
        for _, name in pairs(names) do removeAll(name) end
        local timed = {}
        for key, list in pairs({ discountUses = well.discountUses, emptySlotUses = well.emptySlotUses }) do
            for _, uses in ipairs(list) do
                timed[#timed + 1] = {
                    name = names[key], clock = uses < 0 and "bosses" or "encounters", remainingUses = math.abs(uses),
                }
            end
        end
        practice.well({ stygianWell = {
            timedTraits = timed, sparkUses = well.sparkUses, yarnUses = well.yarnUses,
            hymnUses = well.hymnUses, extendedUses = well.extendedUses,
        } })
    end
    local planned, live = {}, {}
    for _, row in ipairs(frame.retainedEffects.hermesShrineDeliveries) do
        planned[#planned + 1] = row.rewardType .. ":" .. row.remainingUses
    end
    for _, trait in ipairs(each("StorePendingDeliveryItem")) do
        live[#live + 1] = tostring(trait.ShopItemName) .. ":" .. tostring(trait.RemainingUses)
    end
    table.sort(planned)
    table.sort(live)
    if table.concat(planned, ",") ~= table.concat(live, ",") then
        removeAll("StorePendingDeliveryItem")
        practice.deliveries({ hermesDeliveries = frame.retainedEffects.hermesShrineDeliveries })
    end
end

-- Per-instance ledgers the frames carry, and the run's reward priorities.
local function ledgers(frame)
    for _, row in ipairs(frame.retainedEffects.steadyGrowth) do
        local trait = find(row.traitKey)
        if trait then trait.CurrentRoom = row.progress end
    end
    local effects = frame.retainedEffects.keepsakes
    for _, row in ipairs(effects.experimentalHammers) do
        local trait = row.active and find(row.traitKey) or nil
        if trait then
            -- PowersLogic.AddRandomHammer.
            trait.RemainingUses, trait.UsesAsEncounters = row.remainingUses, true
            trait.OnExpire = { FunctionName = "HammerKeepsakeLostPresentation", FunctionArgs = row.traitKey }
        end
    end
    if present(effects.jeweledPom) and effects.jeweledPom.active then
        local granted = find(effects.jeweledPom.grantedTraitKey)
        if granted then granted.GrantedTrait = true end
    end
    run().RewardPriorities = copy(frame.rewardPriorities)
end

local function stripSpell(spell)
    for _, column in ipairs(spell.Talents or {}) do
        for _, node in pairs(column) do
            if type(node) == "table" and node.Invested then removeAll(node.Name) end
        end
    end
    removeAll(spell.TraitName)
    hero().SlottedSpell = nil
end

-- The Spell, its realised tree and the invested nodes; each talent's stack is
-- a remove plus a re-add at its count, never IncreaseTraitLevel.
local function hex(frame, context)
    local progress, nodes = frame.hexProgress, frame.hexNodes
    local spell = hero().SlottedSpell
    if type(spell) == "table" and spell.TraitName ~= progress.spellTraitKey then
        stripSpell(spell)
        spell = nil
    end
    if progress.spellTraitKey == nil then return end
    if type(spell) ~= "table" then
        local talents = progress.talentKeys
        local tree = progress.layoutKey and next(nodes.nodes) and {
            layoutKey = progress.layoutKey, nodes = nodes.nodes,
            godSent = #talents == 2 and { olympianTalentKey = talents[1], lineageTalentKey = talents[2] } or nil,
        } or nil
        spell = practice.slotSpell({ spellTraitName = progress.spellTraitKey, tree = tree },
            context.hexTree, context.diagnostic)
    end
    local invested, stacks, rarity = set(nodes.investedNodes), {}, {}
    for depth, column in ipairs(spell.Talents) do
        for slot, node in pairs(column) do
            if type(node) == "table" and node.Name then
                local wanted = invested[depth .. ":" .. tostring(slot)] == true
                node.Invested = wanted or nil
                stacks[node.Name] = (stacks[node.Name] or 0) + (wanted and 1 or 0)
                if wanted then
                    rarity[node.Name] = rarity[node.Name] or node.Rarity
                    local declaration = _G.TraitData[node.Name]
                    if declaration and declaration.IsDuoBoon then spell.ObtainedDuoTalent = true end
                end
            end
        end
    end
    for name, count in pairs(stacks) do
        local held = find(name) and _G.GetTraitCount(hero(), { Name = name }) or 0
        if held ~= count then
            removeAll(name)
            if count > 0 then practice.add(practice.processed(name, rarity[name], count)) end
        end
    end
    run().NumTalentPoints = progress.bankedPathPoints
    run().InvestedTalentPoints = #nodes.investedNodes
    run().AllSpellInvestedCache = progress.closed
    _G.UpdateTalentPointInvestedCache()
end

-- Hidden <Element>Essence traits until Hero.Elements matches; a removal the
-- element's own essences cannot cover splits one ElementalEssence.
local function essences(frame)
    _G.UpdateHeroTraitDictionary()
    local diffs = {}
    for _, element in ipairs(ELEMENTS) do
        diffs[element] = frame.traits.elements[element] - (hero().Elements[element] or 0)
    end
    for _, element in ipairs(ELEMENTS) do
        local name = element .. "Essence"
        for _ = 1, math.max(diffs[element], 0) do practice.add(practice.processed(name)) end
        for _ = 1, math.max(-diffs[element], 0) do
            local own = find(name)
            if own then
                remove(own)
            else
                local elemental = find("ElementalEssence")
                if elemental == nil then break end
                remove(elemental)
                for _, other in ipairs(ELEMENTS) do
                    if other ~= element then practice.add(practice.processed(other .. "Essence")) end
                end
            end
        end
    end
    _G.UpdateHeroTraitDictionary()
end

-- Snaps the hero to the occurrence's roomEntered frame and proves it with the
-- Practice start check, returning that result.
function snap.apply(occurrence, frame, _, context)
    local expected = assert(conformance.admissionExpected(occurrence.diagnostics))
    local unit = hero()
    local captured = { health = unit.Health, lastStands = copy(unit.LastStands), maxLastStands = unit.MaxLastStands }
    practice.quietly(function()
        keepsakes(frame)
        equipment(frame, expected)
        unit.LastStands, unit.MaxLastStands = captured.lastStands, captured.maxLastStands
        arcana(frame)
        vows(frame)
        modeled(frame)
        chaosFamily(frame, expected)
        wellFamily(frame, expected)
        ledgers(frame)
        hex(frame, context or {})
        practice.rewardStores({ rewardStores = frame.rewardStores })
        essences(frame)
        _G.ValidateMaxHealth(true)
        _G.ValidateMaxMana()
    end)
    unit.Health = math.min(captured.health, unit.MaxHealth)
    return admission.verify(occurrence)
end

return snap
