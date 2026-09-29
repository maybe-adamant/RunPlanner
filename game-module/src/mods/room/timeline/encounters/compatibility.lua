-- Native encounter lifecycle compatibility. A differently named native
-- encounter may stand for a published phase when every bounded lifecycle
-- policy native start, end, skip and envelope code reads agrees in the same
-- room/phase role. Traits, rosters, eligibility, history and presentation are
-- not compared; runtime progress on the live object is never read.
local compatibility = {}

-- Encounter start callbacks that each call StartEncounterEffects once.
local startCallbacks = {
    BeginArachneEncounter = true, BeginArtemisEncounter = true, BeginIcarusEncounter = true,
    BeginHeraclesEncounter = true, BeginNemesisEncounter = true, BeginCrawlerEncounter = true,
    BeginPerfectClearEncounter = true,
}
-- Native start contacts whose lifecycle is not classified for substitution.
local unclassifiedStartContacts = {
    BeginEliteChallenge = true, BeginOpeningEncounter = true, StartDevotionTest = true,
}
-- RunEvents reads these lists from the static declaration.
local eventLists = { "ThreadedEvents", "PreUnthreadedEvents", "UnthreadedEvents", "PostUnthreadedEvents" }

local dimensions = {
    "depth", "endEffects", "bossEffects", "spawnMultiplierUses", "figLeafSkip", "figLeafBlock",
    "skipPropagation", "gorgonBlock", "gorgonSkipStart", "startEffects", "envelopeTermination",
}

-- Native reads these flags with Lua truthiness: nil and false agree.
local function flag(value) return value ~= nil and value ~= false end

function compatibility.nativeName(value)
    return type(value) == "table" and (value.GenusName or value.Name or value.EncounterName) or value
end

-- index is the phase position; multiple marks membership in room.Encounters;
-- primary is the room's first native encounter for later phases.
function compatibility.role(index, multiple, primary)
    return {
        index = index, multiple = multiple == true,
        primaryType = type(primary) == "table" and primary.EncounterType or nil,
    }
end

local function startContacts(declaration, role)
    local count, athena, classified = 0, false, false
    for _, list in ipairs(eventLists) do
        local events = declaration[list]
        for _, event in ipairs(type(events) == "table" and events or {}) do
            local name = type(event) == "table" and event.FunctionName or nil
            if unclassifiedStartContacts[name] then return nil end
            if startCallbacks[name] then
                count, classified = count + 1, true
            elseif name == "ShipsEncounterSetup" then
                classified = true
                if not flag(declaration.SkipShipsEncounterSetup) then count = count + 1 end
            elseif name == "BeginAthenaEncounter" then
                -- Starts effects only in a one-encounter multiple-encounter envelope.
                classified = true
                athena = athena or role.multiple
            end
        end
    end
    return count, athena, classified
end

-- Effective policy of one inherited declaration in one room/phase role.
-- Later multiple-encounter phases take SkipEncounterStart and
-- CanEncounterSkipIfNotFirst from SetupRoomMultipleEncountersData.
local function policy(declaration, role)
    if type(declaration) ~= "table" then return nil, "declaration" end
    if declaration.SetupEvents ~= nil then return nil, "setup" end
    local later = role.multiple and role.index > 1
    local canSkip = flag(declaration.CanEncounterSkip)
    if later and declaration.CanEncounterSkipIfNotFirst ~= nil then
        canSkip = flag(declaration.CanEncounterSkipIfNotFirst)
    end
    local primaryType = role.index == 1 and declaration.EncounterType or role.primaryType
    local forced = flag(declaration.ForceEncounterStart)
    local startBranch = not flag(declaration.SkipEncounterStart) and not later
        and (primaryType ~= "NonCombat" or forced)
    local ordinary = startBranch and (forced or (role.index == 1 and not flag(declaration.DelayedStart)))
    local callbacks, athena, classified = startContacts(declaration, role)
    if callbacks == nil then return nil, "startEffects" end
    -- A delayed primary start without a classified contact is started elsewhere.
    if startBranch and not ordinary and role.index == 1 and not classified then
        return nil, "startEffects"
    end
    local starts = (ordinary and 1 or 0) + callbacks
    local endEnabled = declaration.EncounterType ~= "NonCombat" and not flag(declaration.SkipEndEncounterEffects)
    local bossActive = starts > 0 or athena or endEnabled
    return {
        depth = flag(declaration.CountsForRoomEncounterDepth),
        endEffects = endEnabled,
        bossEffects = bossActive and ((declaration.EncounterType == "Boss" and "boss" or "other")
            .. (flag(declaration.SkipBossTraits) and "+skipBossTraits" or "")) or "inactive",
        spawnMultiplierUses = endEnabled and not flag(declaration.BlockSpawnMultipliers),
        figLeafSkip = canSkip,
        figLeafBlock = flag(declaration.BlockDionysusEncounterKeepsake),
        skipPropagation = role.multiple and canSkip and flag(declaration.PreSpawnEnemies)
            and flag(declaration.SkipEndEncounterEffects),
        gorgonBlock = flag(declaration.BlockAthenaEncounterKeepsake),
        gorgonSkipStart = not startBranch and flag(declaration.CheckAthenaEncounterKeepsakeOnSkipEncounterStart),
        startEffects = tostring(starts) .. (athena and "+athena" or ""),
        envelopeTermination = role.multiple and flag(declaration.BlockMultipleEncounters),
    }
end

-- Returns true when actualKey may bind to the phase published as expectedKey,
-- or nil plus the ordered lifecycle facts that differ or cannot be proven.
function compatibility.compare(declarations, expectedKey, actualKey, role)
    if expectedKey == actualKey then return true end
    local source = type(declarations) == "table" and declarations or {}
    local expected, expectedUnknown = policy(source[expectedKey], role)
    local actual, actualUnknown = policy(source[actualKey], role)
    if expected == nil or actual == nil then
        local unknown = { expectedUnknown or actualUnknown }
        if expectedUnknown and actualUnknown and actualUnknown ~= expectedUnknown then
            unknown[2] = actualUnknown
        end
        return nil, unknown
    end
    local conflicts = {}
    for _, dimension in ipairs(dimensions) do
        if expected[dimension] ~= actual[dimension] then conflicts[#conflicts + 1] = dimension end
    end
    if #conflicts > 0 then return nil, conflicts end
    return true
end

return compatibility
