-- Source-backed room-exit readers. These functions project native run
-- ownership into the already-decoded expected shape; they do not reconstruct
-- planner chronology or action provenance.
local chaos = type(import) == "function" and import("mods/traits/chaos.lua") or require("mods.traits.chaos")
local nativeBindings = type(import) == "function" and import("mods/native_bindings.lua")
    or require("mods.native_bindings")
local conformanceBindings = nativeBindings.conformance
local keepsakeConformance = type(import) == "function" and import("mods/keepsakes/conformance.lua")
    or require("mods.keepsakes.conformance")
local readers = {}
local elementKeys = { "Aether", "Earth", "Air", "Fire", "Water" }
local supported = {
    traitInventory = true, elementCounts = true,
    steadyGrowth = true, chaos = true, keepsakeEffects = true,
    rewardPriorities = true, pathOfStars = true, forfeit = true, stygianWell = true,
    keepsakes = true, equipment = true, arcana = true, vows = true, chaosValues = true, hexNodes = true,
}

local function traitKey(value)
    return type(value) == "table" and (value.Name or value.TraitName) or value
end

local function traits(run)
    local hero = type(run) == "table" and run.Hero or nil
    return type(hero) == "table" and hero.Traits or nil
end

local function elements(run)
    local hero = type(run) == "table" and run.Hero or nil
    local native = type(hero) == "table" and hero.Elements or nil
    local result = {}
    for _, key in ipairs(elementKeys) do
        result[key] = type(native) == "table" and (native[key] or 0) or 0
    end
    return result
end

local function findTrait(run, key)
    for _, trait in pairs(traits(run) or {}) do
        if traitKey(trait) == key then return trait end
    end
    return nil
end

local function modeledTraitInventory(run, expected)
    local wanted, expectedRows = {}, {}
    for _, row in ipairs(expected and expected.present or {}) do
        if type(row) == "table" and type(row.traitKey) == "string" then
            wanted[row.traitKey], expectedRows[row.traitKey] = true, row
        end
    end
    for _, key in ipairs(expected and expected.absent or {}) do
        if type(key) == "string" then wanted[key] = true end
    end
    local present, observed = {}, {}
    for _, trait in pairs(traits(run) or {}) do
        local key = traitKey(trait)
        if wanted[key] and not observed[key] then
            local expectedRow = expectedRows[key]
            local row = { traitKey = key }
            if expectedRow and expectedRow.rarity ~= nil then row.rarity = trait.Rarity end
            if expectedRow and expectedRow.level ~= nil then
                row.level = _G.GetTraitCount(run.Hero, { Name = key })
            end
            if expectedRow and expectedRow.hammerRank ~= nil then
                row.hammerRank = trait.Rarity == "Legendary" and "RankII" or "RankI"
            end
            present[#present + 1], observed[key] = row, true
        end
    end
    local absent = {}
    for _, key in ipairs(expected and expected.absent or {}) do
        if not observed[key] then absent[#absent + 1] = key end
    end
    table.sort(present, function(left, right) return left.traitKey < right.traitKey end)
    table.sort(absent)
    return { present = present, absent = absent }
end

local function enabledKeys(values)
    local result = {}
    for key, enabled in pairs(values or {}) do if enabled then result[#result + 1] = key end end
    table.sort(result)
    return result
end

local function activeChaos(run)
    local active, matured = {}, {}
    for _, trait in pairs(traits(run) or {}) do
        if type(trait) == "table" and type(trait.Name) == "string" then
            if trait.Name:match("^Chaos.*Curse$") then
                local blessing = trait.OnExpire and trait.OnExpire.TraitData
                if type(blessing) == "table" then
                    active[#active + 1] = {
                        curseKey = trait.Name, blessingKey = blessing.Name,
                        rarity = blessing.Rarity, clock = chaos.clock(trait),
                        remaining = trait.RemainingUses,
                    }
                end
            elseif trait.Name:match("^Chaos.*Blessing$") then
                matured[#matured + 1] = { blessingKey = trait.Name, rarity = trait.Rarity }
            end
        end
    end
    return { active = active, matured = matured }
end

local function chaosValues(run)
    local active, matured = {}, {}
    for _, trait in pairs(traits(run) or {}) do
        if type(trait) == "table" and type(trait.Name) == "string" then
            if trait.Name:match("^Chaos.*Curse$") then
                local blessing = trait.OnExpire and trait.OnExpire.TraitData
                if type(blessing) == "table" then
                    active[#active + 1] = {
                        curseKey = trait.Name, curseValues = chaos.curseValues(trait, trait.Name),
                        blessingValues = chaos.blessingValues(blessing, blessing.Name),
                    }
                end
            elseif trait.Name:match("^Chaos.*Blessing$") then
                matured[#matured + 1] = {
                    blessingKey = trait.Name, blessingValues = chaos.blessingValues(trait, trait.Name),
                }
            end
        end
    end
    return { active = active, matured = matured }
end

-- Every held keepsake trait (declared Slot Keepsake); unslotted ones lose their Slot.
local function keepsakeRanks(run)
    local rows, declared = {}, _G.TraitData or {}
    for _, trait in pairs(traits(run) or {}) do
        local key = traitKey(trait)
        local data = type(key) == "string" and declared[key] or nil
        if type(trait) == "table" and type(data) == "table" and data.Slot == "Keepsake" then
            rows[#rows + 1] = { name = key, rarity = trait.Rarity, slotted = trait.Slot == "Keepsake" }
        end
    end
    table.sort(rows, function(left, right) return left.name < right.name end)
    return rows
end

-- Circe multiplies each familiar trait's stacks plus its CirceBonusStacks
-- (EventLogic.CircePetMultiplier), so that ratio is the applied multiplier.
local function familiarMultiplier(run)
    local multiplier, cat
    for _, trait in pairs(traits(run) or {}) do
        if type(trait) == "table" and trait.FamiliarTrait then
            if trait.FamiliarLastStandHealAmount ~= nil then
                cat = trait.ReportedFamiliarLastStandAmount or 1
            else
                local bonus = trait.CirceBonusStacks or 0
                local value = ((trait.StackNum or 1) + bonus) / (_G.GetFamiliarTraitStacks(trait.Name) + bonus)
                if multiplier ~= nil and math.abs(multiplier - value) > 1e-9 then return "inconsistent" end
                multiplier = value
            end
        end
    end
    return multiplier or cat
end

local function equipment(run, gameState, expected)
    local result = {}
    local aspect = type(expected) == "table" and expected.aspect or nil
    if type(aspect) == "table" then
        local trait = findTrait(run, aspect.key)
        result.aspect = { key = aspect.key, rarity = type(trait) == "table" and trait.Rarity or nil }
    end
    local name = type(gameState) == "table" and gameState.EquippedFamiliar or nil
    if name ~= nil then result.familiar = { name = name, stackMultiplier = familiarMultiplier(run) } end
    return result
end

-- Equipped cards with their held trait; The Artificer's charges are its trait's
-- MetaConversionUses and the run's spent MetaConversionUses.
local function arcana(run, gameState, expected)
    local cards, states = {}, type(gameState) == "table" and gameState.MetaUpgradeState or {}
    local temporary = type(run) == "table" and run.TemporaryMetaUpgrades or {}
    local declared = _G.MetaUpgradeCardData or {}
    for key, state in pairs(states or {}) do
        local card = declared[key]
        if type(card) == "table" and type(state) == "table" and state.Equipped then
            local trait = card.TraitName and findTrait(run, card.TraitName) or nil
            cards[#cards + 1] = {
                key = key, temporary = (temporary or {})[key] == true, held = trait ~= nil,
                rarity = type(trait) == "table" and trait.Rarity or nil,
            }
        end
    end
    table.sort(cards, function(left, right) return left.key < right.key end)
    local result = { cards = cards }
    local planned = type(expected) == "table" and expected.artificer or nil
    if type(planned) == "table" then
        result.artificer = { usedCount = type(run) == "table" and run.MetaConversionUses or 0 }
        if planned.remainingCount ~= nil then
            local remaining = 0
            for _, trait in pairs(traits(run) or {}) do
                if type(trait) == "table" and type(trait.MetaConversionUses) == "number" then
                    remaining = remaining + trait.MetaConversionUses
                end
            end
            result.artificer.remainingCount = remaining
        end
    end
    return result
end

local function vows(run, gameState, expected)
    local native = type(gameState) == "table" and gameState.ShrineUpgrades or {}
    local configured, effective = {}, {}
    for key in pairs(type(expected) == "table" and expected.configuredRanks or {}) do
        configured[key] = native[key] or 0
    end
    for key in pairs(type(expected) == "table" and expected.effectiveRanks or {}) do
        effective[key] = _G.GetNumShrineUpgrades(key)
    end
    -- An unplanned ranked vow stays visible so equality rejects it.
    for key, rank in pairs(native) do
        if type(rank) == "number" and rank > 0 then
            if configured[key] == nil then configured[key] = rank end
            if effective[key] == nil then effective[key] = _G.GetNumShrineUpgrades(key) end
        end
    end
    return {
        configuredRanks = configured, effectiveRanks = effective,
        disabledKeys = enabledKeys(type(run) == "table" and run.ShrineUpgradesDisabled or nil),
        bannedTraitKeys = enabledKeys(type(run) == "table" and run.BannedTraits or nil),
    }
end

local function olympian(node)
    local pool = type(node.Pool) == "table" and node.Pool or {}
    return pool.OlympianSpell ~= nil or pool.OlympianCount ~= nil
end

-- The realised talent on every non-Olympian node and every invested node, by `depth:slot`.
local function hexNodes(run)
    local hero = type(run) == "table" and run.Hero or nil
    local spell = type(hero) == "table" and hero.SlottedSpell or nil
    local talents = type(spell) == "table" and spell.Talents or nil
    local nodes, invested = {}, {}
    for depth, column in ipairs(type(talents) == "table" and talents or {}) do
        for slot, node in pairs(column) do
            if type(node) == "table" then
                local key = depth .. ":" .. tostring(slot)
                if not olympian(node) and type(node.Name) == "string" then nodes[key] = node.Name end
                if node.Invested == true then invested[#invested + 1] = key end
            end
        end
    end
    table.sort(invested)
    return { nodes = nodes, investedNodes = invested }
end

local function forfeit(run)
    local rank = _G.GetNumShrineUpgrades(conformanceBindings.shrineUpgrades.forfeit)
    if type(rank) ~= "number" or rank <= 0 then return "inactive" end
    local count = type(run) == "table" and run.BiomeBoonSkipCount or nil
    if type(count) ~= "number" then return nil end
    return count >= rank and "consumed" or "available"
end

local function pathOfStars(run, expected)
    local hero = type(run) == "table" and run.Hero or nil
    local spell = type(hero) == "table" and hero.SlottedSpell or nil
    local talents = type(spell) == "table" and spell.Talents or nil
    local nativeTalentKeys = {}
    local expectedKeys = type(expected) == "table" and expected.talentKeys or nil
    local expectedSet = {}
    for _, key in ipairs(expectedKeys or {}) do expectedSet[key] = true end
    -- Only the inserted God Sent pair is a conformance identity; it decides the
    -- tree's capacity. Other node talents are realised from the plan, not checked.
    -- Native trees have sequential depths but sparse positions within each depth.
    local olympianTalentInvested = false
    for _, column in ipairs(talents or {}) do
        for _, node in pairs(column) do
            local pool = type(node.Pool) == "table" and node.Pool or {}
            if type(node.Name) == "string" and (pool.OlympianSpell ~= nil or pool.OlympianCount ~= nil) then
                nativeTalentKeys[node.Name] = true
            end
            if pool.OlympianSpell ~= nil and node.Invested == true then olympianTalentInvested = true end
        end
    end
    local talentKeys, emitted = {}, {}
    for _, key in ipairs(expectedKeys or {}) do
        if nativeTalentKeys[key] then
            talentKeys[#talentKeys + 1] = key
            emitted[key] = true
        end
    end
    local unexpected = {}
    for key in pairs(nativeTalentKeys) do
        if not emitted[key] and not expectedSet[key] then unexpected[#unexpected + 1] = key end
    end
    table.sort(unexpected)
    for _, key in ipairs(unexpected) do talentKeys[#talentKeys + 1] = key end
    return {
        -- SpellData.Name is the native spell-table key; planner conformance
        -- publishes the installed trait identity carried by TraitName.
        spellTraitKey = type(spell) == "table" and spell.TraitName or nil,
        layoutKey = type(talents) == "table" and talents.Name or nil,
        talentKeys = talentKeys,
        closed = type(run) == "table" and run.AllSpellInvestedCache or false,
        bankedPathPoints = type(run) == "table" and (run.NumTalentPoints or 0) or 0,
        investedPathPoints = type(run) == "table" and (run.InvestedTalentPoints or 0) or 0,
        olympianTalentInvested = olympianTalentInvested,
    }
end

local function steadyGrowth(run, expected)
    local result = {}
    for _, row in ipairs(expected or {}) do
        local trait = findTrait(run, row.traitKey)
        local roomsPerUpgrade = type(trait) == "table" and trait.RoomsPerUpgrade or nil
        result[#result + 1] = {
            traitKey = row.traitKey,
            progress = type(trait) == "table" and (trait.CurrentRoom or 0) or 0,
            interval = type(roomsPerUpgrade) == "table" and (roomsPerUpgrade.Amount or 0) or 0,
        }
    end
    return result
end

local function remaining(run, key)
    local trait = findTrait(run, key)
    return type(trait) == "table" and (trait.RemainingUses or trait.Uses or 1) or 0
end

local function totalRemaining(run, key)
    local total = 0
    for _, trait in pairs(traits(run) or {}) do
        if traitKey(trait) == key then total = total + (trait.RemainingUses or 0) end
    end
    return total
end

local function durationList(run, key)
    local result = {}
    for _, trait in pairs(traits(run) or {}) do
        if traitKey(trait) == key then
            local uses = trait.RemainingUses or 0
            -- The planner uses a negative counter for an Extended item whose
            -- native duration advances on bosses rather than encounters.
            result[#result + 1] = trait.UsesAsBosses and -uses or uses
        end
    end
    table.sort(result)
    return result
end

local function stygianWell(run)
    local keys = conformanceBindings.stygianWellTraits
    return {
        sparkUses = totalRemaining(run, keys.sparkUses),
        yarnUses = totalRemaining(run, keys.yarnUses),
        hymnUses = remaining(run, keys.hymnUses),
        discountUses = durationList(run, keys.discountUses),
        emptySlotUses = durationList(run, keys.emptySlotUses),
        extendedUses = totalRemaining(run, keys.extendedUses),
    }
end

function readers.read(kind, run, gameState, expected)
    if kind == "traitInventory" then return modeledTraitInventory(run, expected) end
    if kind == "elementCounts" then return elements(run) end
    if kind == "steadyGrowth" then return steadyGrowth(run, expected) end
    if kind == "chaos" then return activeChaos(run) end
    if kind == "keepsakeEffects" then return keepsakeConformance.read(run, gameState, expected) end
    if kind == "rewardPriorities" then return type(run) == "table" and run.RewardPriorities or nil end
    if kind == "pathOfStars" then return pathOfStars(run, expected) end
    if kind == "forfeit" then return forfeit(run) end
    if kind == "stygianWell" then return stygianWell(run) end
    if kind == "keepsakes" then return keepsakeRanks(run) end
    if kind == "equipment" then return equipment(run, gameState, expected) end
    if kind == "arcana" then return arcana(run, gameState, expected) end
    if kind == "vows" then return vows(run, gameState, expected) end
    if kind == "chaosValues" then return chaosValues(run) end
    if kind == "hexNodes" then return hexNodes(run) end
    return nil
end

function readers.supports(kind)
    return supported[kind] == true
end

function readers.diagnostic(run)
    return {
        rewardPriorities = type(run) == "table" and run.RewardPriorities or nil,
        bannedTraits = type(run) == "table" and enabledKeys(run.BannedTraits) or {},
        chaos = activeChaos(run), pathOfStars = pathOfStars(run),
    }
end

return readers
