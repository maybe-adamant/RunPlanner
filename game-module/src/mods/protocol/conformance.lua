-- Resolve named room-exit conformance facts against an already-expanded
-- diagnostic state. The diagnostic decoder owns sparse-frame validation; this
-- module owns only the fact-kind-to-state projection.
local p = type(import) == "function" and import("mods/protocol/primitives.lua")
    or require("mods.protocol.primitives")
local nativeBindings = type(import) == "function" and import("mods/native_bindings.lua")
    or require("mods.native_bindings")
local disposableTraits = nativeBindings.conformance.disposableTraits

local conformance = {}

local function inventoryTrait(row)
    if disposableTraits[row.traitKey] then return nil end
    local projected = { traitKey = row.traitKey }
    if row.rarity ~= nil then projected.rarity = row.rarity end
    if row.level ~= nil then projected.level = row.level end
    if row.hammerRank ~= nil then projected.hammerRank = row.hammerRank end
    return projected
end

local function traitInventoryExpected(frames)
    local entry = frames and frames.roomEntered
    local exit = frames and frames.beforeRoomExit
    if type(entry) ~= "table" or type(exit) ~= "table"
        or type(entry.traits) ~= "table" or type(exit.traits) ~= "table" then
        return nil
    end
    local modeled = {}
    for _, row in ipairs(entry.traits.equipped or {}) do
        if type(row) == "table" and type(row.traitKey) == "string" then modeled[row.traitKey] = true end
    end
    for _, row in ipairs(exit.traits.equipped or {}) do
        if type(row) == "table" and type(row.traitKey) == "string" then modeled[row.traitKey] = true end
    end
    local present, observed = {}, {}
    for _, row in ipairs(exit.traits.equipped or {}) do
        if type(row) == "table" and modeled[row.traitKey] then
            local projected = inventoryTrait(row)
            if projected ~= nil then present[#present + 1] = projected end
            observed[row.traitKey] = true
        end
    end
    local absent = {}
    for _, row in ipairs(entry.traits.equipped or {}) do
        if type(row) == "table" and modeled[row.traitKey] and not observed[row.traitKey]
            and not disposableTraits[row.traitKey] then
            absent[#absent + 1] = row.traitKey
        end
    end
    table.sort(present, function(left, right) return left.traitKey < right.traitKey end)
    table.sort(absent)
    return { present = present, absent = absent }
end

-- The value at a path of nested frame fields, or nil when any is absent.
local function field(state, ...)
    local value = state
    for _, key in ipairs({ ... }) do
        if type(value) ~= "table" then return nil end
        value = value[key]
    end
    return value
end

local function sorted(values, key)
    if type(values) ~= "table" then return nil end
    local result = {}
    for index, value in ipairs(values) do result[index] = value end
    table.sort(result, key and function(left, right) return left[key] < right[key] end or nil)
    return result
end

local function chaosKeys(state)
    local chaos = field(state, "chaos")
    if type(chaos) ~= "table" then return nil end
    local active, matured = {}, {}
    for index, row in ipairs(chaos.active or {}) do
        active[index] = {
            curseKey = row.curseKey, blessingKey = row.blessingKey, rarity = row.rarity,
            clock = row.clock, remaining = row.remaining,
        }
    end
    for index, row in ipairs(chaos.matured or {}) do
        matured[index] = { blessingKey = row.blessingKey, rarity = row.rarity }
    end
    return { active = active, matured = matured }
end

local function chaosValues(state)
    local chaos = field(state, "chaos")
    if type(chaos) ~= "table" then return nil end
    local active, matured = {}, {}
    for index, row in ipairs(chaos.active or {}) do
        active[index] = {
            curseKey = row.curseKey, curseValues = row.curseValues, blessingValues = row.blessingValues,
        }
    end
    for index, row in ipairs(chaos.matured or {}) do
        matured[index] = { blessingKey = row.blessingKey, blessingValues = row.blessingValues }
    end
    return { active = active, matured = matured }
end

-- Held keepsakes by name with rank and slot; counters are proved by keepsakeEffects.
local function keepsakeRanks(state)
    local held = field(state, "keepsakes", "held")
    if type(held) ~= "table" then return nil end
    local rows = {}
    for index, row in ipairs(held) do
        rows[index] = { name = row.name, rarity = row.rarity, slotted = row.slotted == true }
    end
    return sorted(rows, "name")
end

-- A card Barren holds unequipped has no trait, so its rarity is not observable.
local function arcana(state)
    local active, artificer = field(state, "arcana", "active"), field(state, "artificer")
    if type(active) ~= "table" or artificer == nil then return nil end
    local cards = {}
    for index, card in ipairs(active) do
        cards[index] = {
            key = card.key, temporary = card.origin == "temporary", held = card.held,
            rarity = card.held and card.rarity or nil,
        }
    end
    local result = { cards = sorted(cards, "key") }
    if not p.json.isNull(artificer) then
        result.artificer = { usedCount = artificer.usedCount, remainingCount = artificer.remainingCount }
    end
    return result
end

local function vows(state)
    local ranks, banned = field(state, "vows"), field(state, "traits", "bannedTraitKeys")
    if type(ranks) ~= "table" or type(banned) ~= "table" then return nil end
    return {
        configuredRanks = ranks.configuredRanks, effectiveRanks = ranks.effectiveRanks,
        disabledKeys = sorted(ranks.disabledKeys), bannedTraitKeys = sorted(banned),
    }
end

local function hexNodes(state)
    local nodes = field(state, "hexNodes")
    if type(nodes) ~= "table" then return nil end
    return { nodes = nodes.nodes, investedNodes = sorted(nodes.investedNodes) }
end

local readers = {
    elementCounts = function(state) return field(state, "traits", "elements") end,
    steadyGrowth = function(state) return field(state, "retainedEffects", "steadyGrowth") end,
    chaos = chaosKeys,
    keepsakeEffects = function(state) return field(state, "retainedEffects", "keepsakes") end,
    rewardPriorities = function(state) return field(state, "rewardPriorities") end,
    pathOfStars = function(state) return field(state, "hexProgress") end,
    forfeit = function(state) return field(state, "forfeit") end,
    stygianWell = function(state) return field(state, "retainedEffects", "stygianWell") end,
    keepsakes = keepsakeRanks,
    equipment = function(state) return field(state, "equipment") end,
    arcana = arcana,
    vows = vows,
    chaosValues = chaosValues,
    hexNodes = hexNodes,
    traitInventory = traitInventoryExpected,
}

conformance.admissionKinds = {
    "traitInventory", "elementCounts", "steadyGrowth", "chaos", "keepsakeEffects",
    "rewardPriorities", "pathOfStars", "forfeit", "stygianWell",
    "keepsakes", "equipment", "arcana", "vows", "chaosValues", "hexNodes",
}

local function traitInventoryEntryExpected(entry)
    local traits = entry and entry.traits
    if type(traits) ~= "table" or type(traits.equipped) ~= "table" then return nil end
    local present = {}
    for _, row in ipairs(traits.equipped) do
        if type(row) ~= "table" or type(row.traitKey) ~= "string" then return nil end
        local projected = inventoryTrait(row)
        if projected ~= nil then present[#present + 1] = projected end
    end
    table.sort(present, function(left, right) return left.traitKey < right.traitKey end)
    return { present = present, absent = {} }
end

local function admissionStateValue(entry, kind)
    if kind == "traitInventory" then return traitInventoryEntryExpected(entry) end
    return readers[kind](entry)
end

-- A Hub departure frame names its modeled traits only; none are proved absent.
function conformance.hubDepartureExpected(departure)
    return { traitInventory = traitInventoryEntryExpected(departure) }
end

function conformance.admissionExpected(value)
    local entry = value and value.roomEntered or value
    if type(entry) ~= "table" then return nil, "start room self-check requires roomEntered diagnostics" end
    local expected = {}
    for _, kind in ipairs(conformance.admissionKinds) do
        local projected = admissionStateValue(entry, kind)
        if projected == nil then
            return nil, "start room self-check requires roomEntered " .. kind
        end
        expected[kind] = projected
    end
    return expected
end

function conformance.resolve(value, state, label)
    local record, errorMessage = p.exact(value, { "facts" }, {}, label)
    if not record then return nil, errorMessage end
    local facts, factsError = p.arr(record.facts, label .. ".facts")
    if not facts then return nil, factsError end
    local exitState = state and state.beforeRoomExit or state
    local expected = {}
    for index, factValue in ipairs(facts) do
        local factLabel = label .. ".facts[" .. index .. "]"
        local inventory = type(factValue) == "table" and factValue.kind == "traitInventory"
        local fact, factError = p.exact(factValue, { "kind" }, inventory and { "absentTraitKeys" } or {}, factLabel)
        if not fact then return nil, factError end
        local read = readers[fact.kind]
        if not read or expected[fact.kind] ~= nil then
            return p.fail(label .. " has unsupported or duplicate conformance fact")
        end
        expected[fact.kind] = read(fact.kind == "traitInventory" and state or exitState)
        if expected[fact.kind] == nil then
            return p.fail(factLabel .. " requires complete diagnostic frames")
        end
        if fact.absentTraitKeys ~= nil then
            -- Traits asserted absent beyond the frames join the proved absences.
            local keys, keysError = p.strings(fact.absentTraitKeys, factLabel .. ".absentTraitKeys")
            if not keys then return nil, keysError end
            if #keys == 0 then return p.fail(factLabel .. ".absentTraitKeys must be nonempty") end
            local absent, framed, seen = expected.traitInventory.absent, {}, {}
            for _, key in ipairs(absent) do framed[key] = true end
            for _, key in ipairs(keys) do
                if seen[key] then return p.fail(factLabel .. ".absentTraitKeys must be distinct") end
                seen[key] = true
                if not framed[key] then absent[#absent + 1] = key end
            end
            table.sort(absent)
        end
    end
    return expected
end

return conformance
