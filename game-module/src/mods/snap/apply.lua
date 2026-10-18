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

-- Per-instance fields a re-add keeps: PersistentTraitKeys (TraitLogic.lua:2543-2560)
-- and the acquisition fields frames do not carry.
local INSTANCE_KEYS = { "BlockInRunRarify", "SelectedTrait", "RepeatedKeepsake", "GrantedTrait" }
local ECHO_STAT_KEYS = { "StartMaxHealth", "StartMaxMana", "StatMultiplier", "BlockDecay", "Decay", "PropertyChanges" }

local function carried(trait)
    local fields = {}
    if trait == nil then return fields end
    for _, list in ipairs({ _G.PersistentTraitKeys, INSTANCE_KEYS }) do
        for _, key in ipairs(list) do fields[key] = copy(trait[key]) end
    end
    if trait.StatMultiplier ~= nil then
        for _, key in ipairs(ECHO_STAT_KEYS) do fields[key] = copy(trait[key]) end
    end
    return fields
end

local function carry(fields, data)
    for key, value in pairs(fields) do data[key] = value end
    return data
end
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
    local kept = {}
    if slotted and (slottedRow == nil or slotted.Name ~= slottedRow.name or slotted.Rarity ~= slottedRow.rarity) then
        -- A rank change keeps the instance's fields, such as the Silken Sash's armor.
        if slottedRow and slotted.Name == slottedRow.name then kept = carried(slotted) end
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
        local args = practice.keepsakeEquipArgs({ SkipNewTraitHighlight = true, SkipQuestStatusCheck = true }, slottedRow)
        _G.EquipKeepsake(hero(), slottedRow.name, args)
        local equipped = find(slottedRow.name)
        if equipped then carry(kept, equipped) end
        -- KeepsakeLogic.lua:1307-1308: the rack records the slotted keepsake.
        _G.GameState.LastAwardTrait = slottedRow.name
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
        local fields = carried(trait)
        if trait then remove(trait) end
        practice.add(carry(fields, practice.processed(aspect.key, aspect.rarity)))
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
                    local fields = carried(current)
                    remove(current)
                    practice.add(carry(fields, practice.processed(current.Name, nil, stacks)))
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
-- remove plus a re-add carrying the instance's fields.
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
                local fields = carried(trait)
                remove(trait)
                practice.add(carry(fields, practice.processed(name, rowRarity(row), row.level)))
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
        -- Native never clears PendingSpellDrop, and a stale one blocks Selene (RequirementsData.lua:1349).
        run().PendingSpellDrop = false
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

local function olympian(node)
    return type(node.Pool) == "table" and (node.Pool.OlympianSpell ~= nil or node.Pool.OlympianCount ~= nil)
end

-- Whether the live tree realises exactly the planned non-Olympian node talents.
local function sameTree(spell, planned)
    local seen = 0
    for depth, column in ipairs(spell.Talents or {}) do
        for slot, node in pairs(column) do
            if type(node) == "table" and not olympian(node) then
                if planned[depth .. ":" .. tostring(slot)] ~= node.Name then return false end
                seen = seen + 1
            end
        end
    end
    local count = 0
    for _ in pairs(planned) do count = count + 1 end
    return seen == count
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
    if type(spell) == "table"
        and (spell.TraitName ~= progress.spellTraitKey or not sameTree(spell, nodes.nodes)) then
        stripSpell(spell)
        spell = nil
    end
    run().NumTalentPoints = progress.bankedPathPoints
    run().InvestedTalentPoints = #nodes.investedNodes
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
    local invested, stacks, rarity, duo = set(nodes.investedNodes), {}, {}, nil
    for depth, column in ipairs(spell.Talents) do
        for slot, node in pairs(column) do
            if type(node) == "table" and node.Name then
                local wanted = invested[depth .. ":" .. tostring(slot)] == true
                node.Invested = wanted or nil
                stacks[node.Name] = (stacks[node.Name] or 0) + (wanted and 1 or 0)
                if wanted then
                    rarity[node.Name] = rarity[node.Name] or node.Rarity
                    local declaration = _G.TraitData[node.Name]
                    if declaration and declaration.IsDuoBoon then duo = true end
                end
            end
        end
    end
    spell.ObtainedDuoTalent = duo
    for name, count in pairs(stacks) do
        local held = find(name) and _G.GetTraitCount(hero(), { Name = name }) or 0
        if held ~= count then
            local fields = carried(find(name))
            removeAll(name)
            if count > 0 then practice.add(carry(fields, practice.processed(name, rarity[name], count))) end
        end
    end
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

local function fault(checkpoint, expected, observed)
    return nil, { outcome = "fault", checkpoint = "snap:" .. checkpoint, expected = expected, observed = observed }
end

-- Every native declaration and capability the writes need, checked before the first one.
local function validate(frame, context)
    for _, store in ipairs(frame.rewardStores) do
        local declared = _G.RewardStoreData[store.name]
        if type(declared) ~= "table" or #declared ~= #store.remainingEntryCounts then
            return fault("reward-store", store.name, type(declared) == "table" and #declared or "undeclared")
        end
    end
    local names = {}
    for _, row in ipairs(frame.traits.equipped) do
        if universe[row.traitKey] then names[#names + 1] = row.traitKey end
    end
    for _, row in ipairs(frame.keepsakes.held) do names[#names + 1] = row.name end
    for _, row in ipairs(frame.chaos.active) do
        names[#names + 1], names[#names + 2] = row.curseKey, row.blessingKey
    end
    for _, row in ipairs(frame.chaos.matured) do names[#names + 1] = row.blessingKey end
    if frame.equipment.aspect then names[#names + 1] = frame.equipment.aspect.key end
    for _, row in ipairs(frame.arcana.active) do
        local card = _G.MetaUpgradeCardData[row.key]
        if type(card) ~= "table" or card.TraitName == nil then return fault("arcana", row.key, "undeclared") end
        names[#names + 1] = card.TraitName
    end
    for _, name in ipairs(names) do
        if type(_G.TraitData[name]) ~= "table" then return fault("trait", name, "undeclared") end
    end
    local spell, progress = hero().SlottedSpell, frame.hexProgress
    local slotting = progress.spellTraitKey ~= nil and next(frame.hexNodes.nodes) ~= nil
        and not (type(spell) == "table" and spell.TraitName == progress.spellTraitKey
            and sameTree(spell, frame.hexNodes.nodes))
    if slotting and (context == nil or context.hexTree == nil) then
        return fault("hex-tree", progress.spellTraitKey, "no Hex-tree realization")
    end
    return true
end

-- Snaps the hero to the occurrence's roomEntered frame and proves it with the
-- Practice start check, returning that result; an invalid frame touches nothing.
function snap.apply(occurrence, frame, _, context)
    local valid, failure = validate(frame, context)
    if not valid then return nil, failure end
    local expected = assert(conformance.admissionExpected(occurrence.diagnostics))
    local unit = hero()
    local captured = { health = unit.Health, lastStands = copy(unit.LastStands), maxLastStands = unit.MaxLastStands }
    practice.quietly(function()
        keepsakes(frame)
        equipment(frame, expected)
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
        -- Equips and blessings add Death Defiance (TraitLogic.lua:893-895); the captured state is kept.
        unit.LastStands, unit.MaxLastStands = captured.lastStands, captured.maxLastStands
    end)
    unit.Health = math.min(captured.health, unit.MaxHealth)
    return admission.verify(occurrence)
end

return snap
