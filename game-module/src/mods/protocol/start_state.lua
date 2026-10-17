-- Strict decoder for the mid-run start section: the planner's state at a later
-- biome's Opening or at a Preboss or Boss, in the native terms its install writes.
local p = type(import) == "function" and import("mods/protocol/primitives.lua")
    or require("mods.protocol.primitives")

local protocol = {}

local LABEL = "execution plan.startState"
local MAX_ROOM_HISTORY = 1024
local MAX_ACQUISITION_ORDINAL = 4
local biomes = { F = true, G = true, H = true, I = true, N = true, O = true, P = true, Q = true }
local traitRarities = {
    Common = true, Rare = true, Epic = true, Heroic = true, Legendary = true, Duo = true,
}
local keepsakeRarities = { Common = true, Rare = true, Epic = true, Heroic = true }
local maxStatSources = { trait = true, arcana = true, keepsake = true }
local wellClocks = { encounters = true, rooms = true, bosses = true }
local essenceElements = { "Fire", "Air", "Earth", "Water" }

-- Shape failures unwind as a tagged message; any other error is a decoder fault.
local function check(ok, label)
    if not ok then error({ startStateError = label }, 0) end
end

local function exact(value, required, optional, label)
    local record, errorMessage = p.exact(value, required, optional, label)
    check(record, errorMessage)
    return record
end

local function str(value, label) check(p.str(value, label), label .. " must be a non-empty string") end
local function int(value, label, min)
    check(p.int(value, label, min or 0), label .. " must be an integer")
end
local function num(value, label) check(p.num(value, label), label .. " must be finite") end
local function bool(value, label) check(p.bool(value, label), label .. " must be a boolean") end
local function trueFlag(value, label)
    check(value == nil or value == true, label .. " must be true when present")
end
local function one(value, allowed, label) check(allowed[value], label .. " is unsupported") end
local function numbers(value, label) check(p.recordNumbers(value, label), label .. " must map names to numbers") end
local function strings(value, label, max) check(p.strings(value, label, max), label .. " must be a string list") end

local function list(value, label, decode, max)
    check(p.arr(value, label, max), label .. " must be a bounded array")
    for index, entry in ipairs(value) do decode(entry, label .. "[" .. index .. "]") end
end

local function uniqueNames(rows, label)
    local seen = {}
    for _, row in ipairs(rows) do
        check(not seen[row.name], label .. " contains a duplicate name")
        seen[row.name] = true
    end
end

local function optional(value, decode, label)
    if value ~= nil then decode(value, label) end
end

local function trait(value, label)
    local row = exact(value, { "name" }, {
        "rarity", "stackNum", "blockInRunRarify", "upgradedTraitName", "selectedTrait",
        "grantedTrait", "repeatedKeepsake", "currentRoom", "acquisitionOrdinal", "echoIncreaseStats",
        "durationHammerUses",
    }, label)
    str(row.name, label .. ".name")
    optional(row.rarity, function(entry, entryLabel) one(entry, traitRarities, entryLabel) end, label .. ".rarity")
    optional(row.stackNum, function(entry, entryLabel) int(entry, entryLabel, 1) end, label .. ".stackNum")
    trueFlag(row.blockInRunRarify, label .. ".blockInRunRarify")
    optional(row.upgradedTraitName, str, label .. ".upgradedTraitName")
    optional(row.selectedTrait, str, label .. ".selectedTrait")
    trueFlag(row.grantedTrait, label .. ".grantedTrait")
    optional(row.repeatedKeepsake, str, label .. ".repeatedKeepsake")
    optional(row.currentRoom, int, label .. ".currentRoom")
    -- A biome ordinal indexes native RarityUpgradeOrder; it replaces rarity.
    optional(row.acquisitionOrdinal, function(entry, entryLabel)
        int(entry, entryLabel, 1)
        check(entry <= MAX_ACQUISITION_ORDINAL, entryLabel .. " must be at most " .. MAX_ACQUISITION_ORDINAL)
        check(row.rarity == nil, label .. " carries both rarity and acquisitionOrdinal")
    end, label .. ".acquisitionOrdinal")
    optional(row.echoIncreaseStats, function(entry, entryLabel)
        local stats = exact(entry, { "statMultiplier", "blockDecay", "startMaxHealth", "startMaxMana" }, {},
            entryLabel)
        num(stats.statMultiplier, entryLabel .. ".statMultiplier")
        bool(stats.blockDecay, entryLabel .. ".blockDecay")
        num(stats.startMaxHealth, entryLabel .. ".startMaxHealth")
        num(stats.startMaxMana, entryLabel .. ".startMaxMana")
    end, label .. ".echoIncreaseStats")
    optional(row.durationHammerUses, function(entry, entryLabel) int(entry, entryLabel, 1) end,
        label .. ".durationHammerUses")
end

local function blessing(row, label)
    str(row.name, label .. ".name")
    one(row.rarity, traitRarities, label .. ".rarity")
    numbers(row.blessingValues, label .. ".blessingValues")
end

local function chaosCurse(value, label)
    local row = exact(value, { "name", "remainingUses", "curseValues", "blessing" }, {}, label)
    str(row.name, label .. ".name")
    int(row.remainingUses, label .. ".remainingUses", 1)
    numbers(row.curseValues, label .. ".curseValues")
    blessing(exact(row.blessing, { "name", "rarity", "blessingValues" }, {}, label .. ".blessing"),
        label .. ".blessing")
end

local function chaosBlessing(value, label)
    local row = exact(value, { "name", "rarity", "blessingValues" }, { "fromChaosKeepsake" }, label)
    blessing(row, label)
    trueFlag(row.fromChaosKeepsake, label .. ".fromChaosKeepsake")
end

local keepsakeCounts = {
    "remainingUses", "uses", "rarityUpgradeUses", "boonConversionUses", "currentRoom", "currentArmor",
}
local keepsakeMultipliers = { "currentKeepsakeDamageBonus", "escalatingKeepsakeValue" }
-- Bell, Fang and Silken Sash values, installed at a start but never framed.
local keepsakeValues = { currentArmor = true, currentKeepsakeDamageBonus = true, escalatingKeepsakeValue = true }

-- One held keepsake trait: the slotted one, or one held unslotted.
local function keepsakeTrait(value, label, frame)
    local optionalKeys = { "slotted" }
    for _, key in ipairs(keepsakeCounts) do
        if not (frame and keepsakeValues[key]) then optionalKeys[#optionalKeys + 1] = key end
    end
    for _, key in ipairs(keepsakeMultipliers) do
        if not frame then optionalKeys[#optionalKeys + 1] = key end
    end
    local row = exact(value, { "name", "rarity" }, optionalKeys, label)
    str(row.name, label .. ".name")
    one(row.rarity, keepsakeRarities, label .. ".rarity")
    trueFlag(row.slotted, label .. ".slotted")
    for _, key in ipairs(keepsakeCounts) do
        if row[key] ~= nil then int(row[key], label .. "." .. key) end
    end
    for _, key in ipairs(keepsakeMultipliers) do
        if row[key] ~= nil then num(row[key], label .. "." .. key) end
    end
end

local function keepsakeTraits(value, label, frame)
    list(value, label, function(entry, entryLabel) keepsakeTrait(entry, entryLabel, frame) end)
    uniqueNames(value, label)
    local slotted = 0
    for _, held in ipairs(value) do
        if held.slotted then slotted = slotted + 1 end
    end
    check(slotted <= 1, label .. " holds more than one slotted keepsake")
end

local function keepsake(value, label)
    local row = exact(value, { "keepsakeCache", "blockedKeepsakes", "traits" },
        { "persistentDionysusSkip" }, label)
    strings(row.keepsakeCache, label .. ".keepsakeCache")
    strings(row.blockedKeepsakes, label .. ".blockedKeepsakes")
    keepsakeTraits(row.traits, label .. ".traits")
    optional(row.persistentDionysusSkip, function(entry, entryLabel)
        int(exact(entry, { "remainingUses" }, {}, entryLabel).remainingUses, entryLabel .. ".remainingUses")
    end, label .. ".persistentDionysusSkip")
end

local function arcanaCard(value, label)
    local row = exact(value, { "name", "rarity" },
        { "temporary", "unequipped", "currentRoom", "metaConversionUses" }, label)
    str(row.name, label .. ".name")
    one(row.rarity, keepsakeRarities, label .. ".rarity")
    trueFlag(row.temporary, label .. ".temporary")
    trueFlag(row.unequipped, label .. ".unequipped")
    optional(row.currentRoom, int, label .. ".currentRoom")
    optional(row.metaConversionUses, int, label .. ".metaConversionUses")
end

-- The expected maxima, and the recorded grants no installed trait re-creates.
local function maxStats(value, label)
    local row = exact(value, { "maxHealth", "maxMana", "hiddenGrants" }, {}, label)
    int(row.maxHealth, label .. ".maxHealth", 1)
    int(row.maxMana, label .. ".maxMana")
    list(row.hiddenGrants, label .. ".hiddenGrants", function(entry, entryLabel)
        local grant = exact(entry, { "source", "maxHealth", "maxMana" }, {}, entryLabel)
        local sourceLabel = entryLabel .. ".source"
        check(p.obj(grant.source, sourceLabel), sourceLabel .. " must be an object")
        if grant.source.kind == "pickups" then
            exact(grant.source, { "kind" }, {}, sourceLabel)
        else
            local source = exact(grant.source, { "kind", "key" }, {}, sourceLabel)
            one(source.kind, maxStatSources, sourceLabel .. ".kind")
            str(source.key, sourceLabel .. ".key")
        end
        num(grant.maxHealth, entryLabel .. ".maxHealth")
        num(grant.maxMana, entryLabel .. ".maxMana")
    end)
end

local function well(value, label)
    local row = exact(value, {
        "timedTraits", "sparkUses", "yarnUses", "hymnUses", "extendedUses", "wellShopPurchases",
    }, {}, label)
    list(row.timedTraits, label .. ".timedTraits", function(entry, entryLabel)
        local timed = exact(entry, { "name", "clock", "remainingUses" }, {}, entryLabel)
        str(timed.name, entryLabel .. ".name")
        one(timed.clock, wellClocks, entryLabel .. ".clock")
        int(timed.remainingUses, entryLabel .. ".remainingUses", 1)
    end)
    for _, key in ipairs({ "sparkUses", "yarnUses", "hymnUses", "extendedUses" }) do
        int(row[key], label .. "." .. key)
    end
    numbers(row.wellShopPurchases, label .. ".wellShopPurchases")
    for key, count in pairs(row.wellShopPurchases) do int(count, label .. ".wellShopPurchases." .. key, 1) end
end

local function investedNodes(value, label)
    strings(value, label)
    local seen = {}
    for _, node in ipairs(value) do
        check(node:match("^[1-9]%d*:%d+$") and not seen[node], label .. " must be distinct node keys")
        seen[node] = true
    end
end

local function rewardStores(value, label)
    list(value, label, function(entry, entryLabel)
        local store = exact(entry, { "name", "remainingEntryCounts" }, {}, entryLabel)
        str(store.name, entryLabel .. ".name")
        list(store.remainingEntryCounts, entryLabel .. ".remainingEntryCounts", int)
    end)
end

local function hex(value, label)
    local row = exact(value, { "spellTraitName", "investedNodes", "talentPoints", "allSpellInvested" },
        { "tree" }, label)
    str(row.spellTraitName, label .. ".spellTraitName")
    optional(row.tree, function(entry, entryLabel)
        local _, treeError = p.hexTree(entry, entryLabel, { "layoutKey", "nodes" })
        check(treeError == nil, tostring(treeError))
    end, label .. ".tree")
    investedNodes(row.investedNodes, label .. ".investedNodes")
    int(row.talentPoints, label .. ".talentPoints")
    bool(row.allSpellInvested, label .. ".allSpellInvested")
end

local function biome(value, label)
    local row = exact(value, {
        "biomeDepthCache", "biomeUseRecord", "forfeitConsumed", "dionysusSkipActivated",
    }, { "biomeEncounterDepth", "clockwork" }, label)
    int(row.biomeDepthCache, label .. ".biomeDepthCache")
    optional(row.biomeEncounterDepth, int, label .. ".biomeEncounterDepth")
    numbers(row.biomeUseRecord, label .. ".biomeUseRecord")
    bool(row.forfeitConsumed, label .. ".forfeitConsumed")
    bool(row.dionysusSkipActivated, label .. ".dionysusSkipActivated")
    optional(row.clockwork, function(entry, entryLabel)
        local clockwork = exact(entry, { "remainingClockworkGoals", "maxClockworkNonGoalRewards" }, {}, entryLabel)
        int(clockwork.remainingClockworkGoals, entryLabel .. ".remainingClockworkGoals")
        int(clockwork.maxClockworkNonGoalRewards, entryLabel .. ".maxClockworkNonGoalRewards")
    end, label .. ".clockwork")
end

local function shape(value)
    local row = exact(value, {
        "point", "biomeKey", "occurrenceId", "roomName", "gold", "biomeVisitOrder", "roomHistory",
        "encounterDepth", "aspectPerfect", "traits", "elementEssences", "chaosCurses", "chaosBlessings", "keepsake", "arcana",
        "disabledVows", "maxStats", "itemArmor", "stygianWell", "hermesDeliveries",
        "rewardPriorities", "useRecord", "lootTypeHistory", "consumableRecord", "bannedTraits", "rewardStores",
    }, { "lastDevotionDepth", "biome", "familiar", "hex" }, LABEL)
    check(row.point == "opening" or row.point == "preboss" or row.point == "boss", LABEL .. ".point is unsupported")
    one(row.biomeKey, biomes, LABEL .. ".biomeKey")
    str(row.occurrenceId, LABEL .. ".occurrenceId")
    str(row.roomName, LABEL .. ".roomName")
    int(row.gold, LABEL .. ".gold")
    strings(row.biomeVisitOrder, LABEL .. ".biomeVisitOrder", 4)
    list(row.roomHistory, LABEL .. ".roomHistory", function(entry, entryLabel)
        local room = exact(entry, { "name" }, { "nextRoomSet" }, entryLabel)
        str(room.name, entryLabel .. ".name")
        trueFlag(room.nextRoomSet, entryLabel .. ".nextRoomSet")
    end, MAX_ROOM_HISTORY)
    int(row.encounterDepth, LABEL .. ".encounterDepth")
    optional(row.lastDevotionDepth, function(entry, entryLabel) int(entry, entryLabel, 1) end,
        LABEL .. ".lastDevotionDepth")
    optional(row.biome, biome, LABEL .. ".biome")
    bool(row.aspectPerfect, LABEL .. ".aspectPerfect")
    optional(row.familiar, function(entry, entryLabel)
        local familiar = exact(entry, { "name", "stackMultiplier" }, {}, entryLabel)
        str(familiar.name, entryLabel .. ".name")
        int(familiar.stackMultiplier, entryLabel .. ".stackMultiplier", 1)
    end, LABEL .. ".familiar")
    list(row.traits, LABEL .. ".traits", trait)
    uniqueNames(row.traits, LABEL .. ".traits")
    local essences = exact(row.elementEssences, essenceElements, {}, LABEL .. ".elementEssences")
    for _, element in ipairs(essenceElements) do
        int(essences[element], LABEL .. ".elementEssences." .. element)
    end
    list(row.chaosCurses, LABEL .. ".chaosCurses", chaosCurse)
    list(row.chaosBlessings, LABEL .. ".chaosBlessings", chaosBlessing)
    keepsake(row.keepsake, LABEL .. ".keepsake")
    list(row.arcana, LABEL .. ".arcana", arcanaCard)
    uniqueNames(row.arcana, LABEL .. ".arcana")
    strings(row.disabledVows, LABEL .. ".disabledVows")
    maxStats(row.maxStats, LABEL .. ".maxStats")
    int(row.itemArmor, LABEL .. ".itemArmor")
    well(row.stygianWell, LABEL .. ".stygianWell")
    list(row.hermesDeliveries, LABEL .. ".hermesDeliveries", function(entry, entryLabel)
        local delivery = exact(entry, { "rewardType", "remainingUses" }, {}, entryLabel)
        str(delivery.rewardType, entryLabel .. ".rewardType")
        int(delivery.remainingUses, entryLabel .. ".remainingUses")
    end)
    optional(row.hex, hex, LABEL .. ".hex")
    strings(row.rewardPriorities, LABEL .. ".rewardPriorities")
    numbers(row.useRecord, LABEL .. ".useRecord")
    numbers(row.lootTypeHistory, LABEL .. ".lootTypeHistory")
    numbers(row.consumableRecord, LABEL .. ".consumableRecord")
    strings(row.bannedTraits, LABEL .. ".bannedTraits")
    rewardStores(row.rewardStores, LABEL .. ".rewardStores")
    return row
end

-- The start names a selected occurrence of a configured biome after the route
-- start: its biome's first selected room for an Opening, a later one for a
-- Preboss or Boss. That it is the Preboss or completion Boss room the
-- fingerprinted assembly guarantees.
-- Execution's route cursor starts at that index.
local function references(start, plan, occurrencesById)
    local cursor
    for index, id in ipairs(plan.selectedOccurrenceIds) do
        if id == start.occurrenceId then cursor = index break end
    end
    check(cursor ~= nil, LABEL .. ".occurrenceId must be selected")
    local occurrence = occurrencesById[start.occurrenceId]
    check(occurrence ~= nil and occurrence.biomeKey == start.biomeKey and occurrence.gameName == start.roomName,
        LABEL .. " contradicts its occurrence identity")
    local biomeKeys, biomeIndex = plan.extent.biomeKeys, nil
    for index, key in ipairs(biomeKeys) do
        if key == start.biomeKey then biomeIndex = index break end
    end
    local midBiome = start.point ~= "opening"
    check(biomeIndex ~= nil and (midBiome or biomeIndex > 1),
        LABEL .. ".biomeKey must be a configured biome after the route start")
    local entered = midBiome and biomeIndex or biomeIndex - 1
    check(#start.biomeVisitOrder == entered, LABEL .. ".biomeVisitOrder must be the biomes entered before the start")
    for index = 1, entered do
        check(start.biomeVisitOrder[index] == biomeKeys[index],
            LABEL .. ".biomeVisitOrder must be the biomes entered before the start")
    end
    local first
    for index, id in ipairs(plan.selectedOccurrenceIds) do
        local entry = occurrencesById[id]
        if entry and entry.biomeKey == start.biomeKey then first = index break end
    end
    check((cursor == first) ~= midBiome, LABEL .. ".occurrenceId is not the start point's room")
    check((start.biome ~= nil) == midBiome, LABEL .. ".biome is present exactly for a Preboss or Boss start")
    check(start.biome == nil
        or (start.biome.clockwork ~= nil) == (start.biomeKey == "I" and start.point == "preboss"),
        LABEL .. ".biome.clockwork is present exactly for an I Preboss")
end

local function guarded(decode)
    local ok, result = pcall(decode)
    if ok then return result end
    if type(result) == "table" and result.startStateError then return nil, result.startStateError end
    error(result, 0)
end

function protocol.decode(value, plan, occurrencesById)
    return guarded(function()
        local start = shape(value)
        references(start, plan, occurrencesById)
        return start
    end)
end

-- Held keepsake rows, node keys and store contents, shared with the Run State frames.
function protocol.keepsakeTraits(value, label, frame)
    return guarded(function() keepsakeTraits(value, label, frame) return true end)
end
function protocol.investedNodes(value, label)
    return guarded(function() investedNodes(value, label) return true end)
end
function protocol.rewardStores(value, label)
    return guarded(function() rewardStores(value, label) return true end)
end


return protocol
