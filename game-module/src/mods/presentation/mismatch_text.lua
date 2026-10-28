-- Player-facing wording for a session's first mismatch, fault or admission
-- record. Display only: the records are read, never compared or repaired.
local names = type(import) == "function" and import("mods/presentation/names.lua")
    or require("mods.presentation.names")
local json = type(import) == "function" and import("mods/protocol/json.lua") or require("mods.protocol.json")

local text = {}

local function isNull(value) return value == nil or json.isNull(value) end

-- "jeweledPom" and "BossChronos02" become "jeweled pom" and "Boss Chronos 02".
local function words(key)
    key = tostring(key)
    local spaced = key:gsub("_", " "):gsub("(%l)(%u)", "%1 %2"):gsub("(%a)(%d)", "%1 %2")
    return key:match("^%l") and spaced:lower() or spaced
end

local function isRoomName(value)
    return names.biome(value) ~= nil or value:match("^Chaos_%d+$") ~= nil or value:match("^Dream_") ~= nil
end

function text.name(value)
    if type(value) ~= "string" then return tostring(value) end
    if isRoomName(value) then return names.room(value) end
    return names.display(value, nil) or words(value)
end

local function scalar(value)
    if isNull(value) then return "none" end
    if type(value) == "boolean" then return value and "yes" or "no" end
    if type(value) == "number" then
        return value == math.floor(value) and string.format("%d", value) or string.format("%g", value)
    end
    if type(value) == "table" and type(value.gameName) == "string" then return names.room(value.gameName) end
    if type(value) == "table" and type(value.traitKey) == "string" then
        local parts = {}
        if value.rarity ~= nil then parts[#parts + 1] = text.name(value.rarity) end
        if value.level ~= nil then parts[#parts + 1] = "level " .. scalar(value.level) end
        if value.hammerRank ~= nil then parts[#parts + 1] = text.name(value.hammerRank) end
        return text.name(value.traitKey) .. (#parts > 0 and " (" .. table.concat(parts, ", ") .. ")" or "")
    end
    if type(value) == "table" then return nil end
    return text.name(value)
end

-- Identities, indexes and positions mean nothing to a player; they stay in Diagnostics.
local HIDDEN_FIELDS = {
    id = true, owner = true, location = true, point = true, index = true, slotKey = true,
    acquisitionOrder = true, traceback = true,
}

local function hidden(key)
    return type(key) ~= "string" or HIDDEN_FIELDS[key] == true or key:match("Ids?$") ~= nil
        or key:match("Index$") ~= nil or key:match("Identity$") ~= nil
end

local function sortedKeys(value)
    local keys = {}
    for key in pairs(value) do
        if not hidden(key) then keys[#keys + 1] = key end
    end
    table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
    return keys
end

-- Readable lines for one expected or observed value; nested records indent.
function text.lines(value, indent, depth, out)
    indent, depth, out = indent or "", depth or 0, out or {}
    local single = scalar(value)
    if single ~= nil then out[#out + 1] = indent .. single; return out end
    if depth >= 4 then out[#out + 1] = indent .. "..."; return out end
    if #value > 0 then
        local inline = {}
        for _, item in ipairs(value) do inline[#inline + 1] = scalar(item) or false end
        local allScalar = true
        for _, item in ipairs(inline) do allScalar = allScalar and item ~= false end
        if allScalar then out[#out + 1] = indent .. table.concat(inline, ", "); return out end
        for _, item in ipairs(value) do text.lines(item, indent, depth + 1, out) end
        return out
    end
    local keys = sortedKeys(value)
    if #keys == 0 then out[#out + 1] = indent .. "none"; return out end
    for _, key in ipairs(keys) do
        local nested = value[key]
        local line = scalar(nested)
        if line ~= nil then
            out[#out + 1] = indent .. words(key) .. ": " .. line
        else
            out[#out + 1] = indent .. words(key) .. ":"
            text.lines(nested, indent .. "  ", depth + 1, out)
        end
    end
    return out
end

local function checkpointOf(issue)
    if type(issue) ~= "table" then return nil end
    return issue.checkpoint or issue.kind
end

local DOOR_KINDS = {
    target = true, count = true, reward = true, rewardSource = true, cageRewards = true,
    cageReward = true, cageRewardSource = true, sharedRewardStore = true,
    additionalCount = true, additionalBinding = true,
}
local INVENTORY = {
    ["shop-inventory-offer"] = "shop", ["shop-refill-group"] = "shop", ["shop-refill-slot"] = "shop",
    ["shop-empty-group"] = "shop", ["contract-inventory"] = "shop", ["inventory-generation"] = "shop",
    ["well-inventory"] = "Stygian Well", ["well-refill-inventory"] = "Stygian Well",
    ["well-refill-slot"] = "Stygian Well", ["shrine-inventory-offer"] = "Hermes shrine",
    ["shrine-refill-inventory"] = "Hermes shrine", ["purging-pool-inventory"] = "Purging Pool",
}
local TRAIT_CHOICE = {
    ["npc-trait-offer"] = true, ["npc-trait-requirements"] = true, ["trait-offer-blocked-row"] = true,
    ["level-offer-held"] = true, ["concave-stone-unplanned"] = true, ["concave-stone-residual-excluded"] = true,
    ["trait-screen-row"] = true,
}
-- What a trait screen found different when it opened.
local TRAIT_SCREEN = {
    ["trait-screen-hymn"] = "Sacrificial Hymn has a different number of uses than planned",
    ["trait-screen-yarn"] = "Yarn has a different number of uses than planned",
    ["trait-screen-hymn-spend"] = "this screen uses Sacrificial Hymn differently than planned",
    ["trait-screen-yarn-spend"] = "this screen uses Yarn differently than planned",
    ["trait-screen-ordinary-spend"] = "the Ordinary curse applies to this screen differently than planned",
    ["trait-screen-concave-stone"] = "Concave Stone has a different number of uses than planned",
    ["trait-screen-concave-stone-giver"] = "Concave Stone can't trigger on this screen as planned",
    ["trait-screen-rarify"] = "a different number of rarity upgrades is available than planned",
    ["trait-screen-rarity-floor"] = "Proper Upbringing's rarity floor differs from the plan",
    ["trait-screen-exchange-level"] = "an exchange row has a different level than planned",
    ["trait-screen-pom-level"] = "the Pom grants a different number of levels than planned",
}
local LIFECYCLE = {
    roomEntered = "entering the room", exitUsable = "when the exits opened",
    roomExit = "leaving the room", outgoingGeneration = "when the doors appeared",
}
local OBLIGATION_DEADLINES = {
    roomEntered = "as the room started", exitUsable = "before the exits opened",
    roomExit = "before leaving the room", outgoingGeneration = "before the doors appeared",
}

-- When in the room the check ran, in plain words.
function text.checkpoint(issue)
    local checkpoint = checkpointOf(issue)
    if type(checkpoint) ~= "string" then return "a plan check" end
    if checkpoint == "room-entry" then return "entering the room" end
    if checkpoint:match("^room%-exit%-conformance:") then return "leaving the room" end
    if checkpoint:match("^hub%-departure%-conformance:") then return "leaving the hub" end
    if checkpoint:match("^practice%-start:") then return "practice start" end
    local obligation = checkpoint:match("^obligation:(.+)$")
    if obligation then return LIFECYCLE[obligation] or "a planned step" end
    if checkpoint == "transaction-prerequisite" then return "planned order" end
    if DOOR_KINDS[checkpoint] or checkpoint:match("^ephyra") then return "when the doors appeared" end
    if checkpoint == "incomingReward" then return "room reward" end
    if TRAIT_CHOICE[checkpoint] or TRAIT_SCREEN[checkpoint] then return "a trait choice" end
    if checkpoint == "encounter" or checkpoint == "encounterCount" then return "encounter" end
    if INVENTORY[checkpoint] then return INVENTORY[checkpoint] .. " stock" end
    return "a plan check"
end

local function list(values)
    return table.concat(values, ", ")
end

local function rowsOf(value)
    local rows = {}
    for _, row in ipairs(type(value) == "table" and value or {}) do
        if type(row) == "table" and type(row.traitKey) == "string" then rows[#rows + 1] = row end
    end
    return rows
end

local function keysOf(value)
    local keys = {}
    for _, key in ipairs(type(value) == "table" and value or {}) do
        if type(key) == "string" then keys[#keys + 1] = key end
    end
    return keys
end

local function traitDifference(expected, observed)
    if type(expected) ~= "table" or type(observed) ~= "table" then return nil end
    local seen, missing, extra, changed = {}, {}, {}, {}
    for _, row in ipairs(rowsOf(observed.present)) do seen[row.traitKey] = row end
    for _, row in ipairs(rowsOf(expected.present)) do
        local found = seen[row.traitKey]
        if found == nil then
            missing[#missing + 1] = text.name(row.traitKey)
        else
            for _, field in ipairs({ "rarity", "level", "hammerRank" }) do
                if row[field] ~= nil and row[field] ~= found[field] then
                    changed[#changed + 1] = text.name(row.traitKey) .. " is " .. (scalar(found[field]) or "different")
                        .. ", planned " .. (scalar(row[field]) or "different")
                    break
                end
            end
        end
    end
    local stillAbsent = {}
    for _, key in ipairs(keysOf(observed.absent)) do stillAbsent[key] = true end
    for _, key in ipairs(keysOf(expected.absent)) do
        if not stillAbsent[key] then extra[#extra + 1] = text.name(key) end
    end
    local parts = {}
    if #missing > 0 then parts[#parts + 1] = "missing " .. list(missing) end
    if #extra > 0 then parts[#parts + 1] = "still has " .. list(extra) .. ", planned gone" end
    for _, line in ipairs(changed) do parts[#parts + 1] = line end
    return #parts > 0 and table.concat(parts, "; ") or nil
end

local function equal(left, right)
    if isNull(left) and isNull(right) then return true end
    if type(left) ~= type(right) then return false end
    if type(left) ~= "table" then return left == right end
    for key, value in pairs(left) do if not equal(value, right[key]) then return false end end
    for key, value in pairs(right) do if left[key] == nil and not isNull(value) then return false end end
    return true
end

-- The record fields that differ, named in words.
local function differingParts(expected, observed)
    if type(expected) ~= "table" or type(observed) ~= "table" then return nil end
    local parts = {}
    local keys = {}
    for key in pairs(expected) do keys[key] = true end
    for key in pairs(observed) do keys[key] = true end
    for key in pairs(keys) do
        if not hidden(key) and not equal(expected[key], observed[key]) then
            parts[#parts + 1] = names.display(key, nil) or words(key)
        end
    end
    table.sort(parts)
    return #parts > 0 and list(parts) or nil
end

local function counters(expected, observed)
    if type(expected) ~= "table" or type(observed) ~= "table" then return nil end
    local parts = {}
    local keys = sortedKeys(expected)
    for _, key in ipairs(keys) do
        if expected[key] ~= observed[key] then
            parts[#parts + 1] = text.name(key) .. " " .. (scalar(observed[key]) or "?")
                .. " (planned " .. (scalar(expected[key]) or "?") .. ")"
        end
    end
    return #parts > 0 and list(parts) or nil
end

local function plannedFound(noun, expected, observed)
    local planned, found = scalar(expected), scalar(observed)
    if planned == nil or found == nil then return nil end
    return "planned " .. noun .. planned .. ", found " .. found
end

local CONFORMANCE = {
    traitInventory = traitDifference,
    elementCounts = function(expected, observed)
        local parts = counters(expected, observed)
        return parts and "element counts " .. parts or nil
    end,
    keepsakeEffects = function(expected, observed)
        local parts = differingParts(expected, observed)
        return parts and "keepsake effects differ: " .. parts or "keepsake effects differ from the plan"
    end,
    forfeit = function(expected, observed) return plannedFound("forfeit ", expected, observed) end,
    chaos = function() return "active Chaos effects differ from the plan" end,
    stygianWell = function() return "Stygian Well items differ from the plan" end,
    pathOfStars = function() return "Path of Stars differs from the plan" end,
    steadyGrowth = function() return "Steady Growth differs from the plan" end,
    rewardPriorities = function() return "upcoming reward order differs from the plan" end,
}

-- One sentence describing what differed, or nil when the shape is unknown.
function text.difference(issue)
    local checkpoint = checkpointOf(issue)
    if type(checkpoint) ~= "string" then return nil end
    local expected, observed = issue.expected, issue.observed
    if checkpoint == "room-entry" then
        local planned = type(expected) == "table" and expected.gameName
        local entered = type(observed) == "table" and observed.gameName
        if planned and entered then
            return "planned " .. names.room(planned) .. ", entered " .. names.room(entered)
        end
        return nil
    end
    local conformance = checkpoint:match(":(%a+)$")
    if conformance and CONFORMANCE[conformance] and checkpoint:match("conformance:") then
        return CONFORMANCE[conformance](expected, observed)
    end
    if checkpoint == "practice-start:traitInventory" then return traitDifference(expected, observed) end
    if checkpoint:match("^practice%-start:") then return "the practice start state differs from the plan" end
    local obligation = checkpoint:match("^obligation:(.+)$")
    if obligation then
        return "a planned step wasn't done " .. (OBLIGATION_DEADLINES[obligation] or "in time")
    end
    if checkpoint == "transaction-prerequisite" then
        return "a planned step happened before the step it depends on"
    end
    if checkpoint == "npc-trait-offer" then return "the game offered different rows than the plan" end
    if checkpoint == "npc-trait-requirements" then
        return "planned " .. text.name(expected) .. " wasn't eligible to be offered"
    end
    if checkpoint == "trait-offer-blocked-row" then
        return expected == "blocked row" and "the plan rejected a row the game didn't lock"
            or "the game locked a row the plan didn't reject"
    end
    if checkpoint == "level-offer-held" then
        return "planned Pom target " .. text.name(expected) .. " isn't held, so the game re-rolled the rows"
    end
    if checkpoint == "trait-screen-row" then
        return "planned " .. text.name(expected) .. " can't be offered now"
    end
    if TRAIT_SCREEN[checkpoint] then return TRAIT_SCREEN[checkpoint] end
    if checkpoint == "concave-stone-unplanned" then return "Concave Stone gave an unplanned second boon" end
    if checkpoint == "concave-stone-residual-excluded" then
        return "Concave Stone's planned " .. text.name(expected) .. " wasn't offered"
    end
    if checkpoint == "target" then
        local planned, found = scalar(expected), scalar(observed)
        return planned and found and ("a door led to " .. found .. " instead of " .. planned) or nil
    end
    if checkpoint == "count" or checkpoint == "additionalCount" then
        return plannedFound("", expected, observed) and ("planned " .. scalar(expected) .. " doors, found "
            .. scalar(observed)) or nil
    end
    if checkpoint == "reward" or checkpoint == "incomingReward" or checkpoint == "cageReward" then
        return plannedFound("reward ", expected, observed)
    end
    if checkpoint == "encounter" then return plannedFound("encounter ", expected, observed) end
    if checkpoint == "encounterCount" then
        return plannedFound("", expected, observed) and ("planned " .. scalar(expected) .. " encounters, found "
            .. scalar(observed)) or nil
    end
    if INVENTORY[checkpoint] then return "the " .. INVENTORY[checkpoint] .. " items differ from the plan" end
    if checkpoint == "ephyraDoorRoom" or checkpoint == "ephyraHubEntryRoom" then
        local planned, found = scalar(expected), scalar(observed)
        return planned and found and ("a door led to " .. found .. " instead of " .. planned) or nil
    end
    if checkpoint == "ephyraDoorReward" or checkpoint == "ephyraDoorRewardSource" then
        return plannedFound("reward ", expected, observed)
    end
    if checkpoint == "ephyraDoorAvailability" then
        return expected == true and "a planned Ephyra door was missing" or "an Ephyra door was open that the plan kept closed"
    end
    if checkpoint == "ephyraUnexpectedDoor" then return "an Ephyra door was open that the plan didn't use" end
    if checkpoint == "ephyraReturnDoorMissing" then return "the Ephyra return door was missing" end
    if checkpoint == "ephyraReturnDoorRoom" then
        return plannedFound("return-door room ", expected, observed)
    end
    if checkpoint == "ephyraReturnDoorReward" or checkpoint == "ephyraReturnDoorRewardSource" then
        return plannedFound("return-door reward ", expected, observed)
    end
    if checkpoint == "ephyraHubEntryCount" then
        return plannedFound("", expected, observed) and ("planned " .. scalar(expected) .. " door, found "
            .. scalar(observed)) or nil
    end
    return nil
end

-- Why a selected plan was not used for this run.
function text.admission(issue)
    local checkpoint = checkpointOf(issue)
    if checkpoint == "run-start" then
        local code = type(issue.observed) == "table" and issue.observed.code or nil
        if code == "stale-slot" then return "Made for another Run Planner version - update the mod or resend." end
        if code == "not-published" then return "Nothing was sent to this slot." end
        return "The plan in this slot can't be read - resend it from the app."
    end
    if checkpoint == "run-mode" then
        return issue.expected == "Dream" and "This plan is for a Dream Dive." or "This plan isn't for a Dream Dive."
    end
    if checkpoint == "fresh-file" then return "This plan needs a brand-new save." end
    if checkpoint == "chaos-trial" then return "Plans don't run during a Chaos Trial." end
    if checkpoint == "loadout-restore" then return "The previous run's loadout couldn't be restored." end
    if checkpoint == "room-exit-conformance" then return "This plan needs a newer Run Planner mod." end
    return "The plan couldn't start."
end

return text
