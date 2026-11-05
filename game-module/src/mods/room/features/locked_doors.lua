-- Oceanus locked doors. In a planned room the module decides which doors lock
-- (the plan's, or none) at the native lock roll, and fields each planned press's
-- fight with its planned composition; the presses stay the player's. Room exit
-- proves how many fights were fought from native state, never from the order of
-- contacts.
local doors = type(import) == "function" and import("mods/navigation/doors.lua")
    or require("mods.navigation.doors")

local lockedDoors = {}

local UNLOCK = "unlockExit"

-- The planned locked doors by exit key, each its overview entry.
function lockedDoors.planned(occurrence)
    local result = {}
    local overview = occurrence and occurrence.overview
    for _, entry in ipairs(overview and overview.lockedExits or {}) do result[entry.exitKey] = entry end
    return result
end

-- How many locked doors the plan fights open in the room.
function lockedDoors.plannedFights(occurrence)
    local count = 0
    for _, entry in pairs(lockedDoors.planned(occurrence)) do
        if entry.unlock ~= nil then count = count + 1 end
    end
    return count
end

-- A pressed door's fight as a generated phase, for the composition pipeline.
function lockedDoors.phase(occurrence, exitKey)
    local entry = lockedDoors.planned(occurrence)[exitKey]
    if entry == nil or entry.unlock == nil then return nil end
    return { slotKey = UNLOCK .. ":" .. exitKey, encounterKey = entry.unlock.encounterKey,
        customization = entry.unlock.customization }
end

-- The phase a generated composition marker names, when it is a pressed door's fight.
function lockedDoors.markedPhase(occurrence, slotKey)
    local exitKey = type(slotKey) == "string" and slotKey:match("^" .. UNLOCK .. ":(.+)$") or nil
    return exitKey and lockedDoors.phase(occurrence, exitKey) or nil
end

local function completed(currentRun, encounterKey)
    local cache = type(currentRun) == "table" and currentRun.EncountersCompletedCache or nil
    return type(cache) == "table" and encounterKey ~= nil and (cache[encounterKey] or 0) or 0
end

-- Room entry: the fights completed so far, against which the exit counts.
function lockedDoors.recordEntry(nativeRoom, currentRun)
    if type(nativeRoom) ~= "table" or nativeRoom.LockExtraExitsWithEncounter == nil then return end
    nativeRoom.__runPlannerLockedDoorFightsAtEntry = completed(currentRun, nativeRoom.LockExtraExitsWithEncounter)
end

-- Room exit: the room fought exactly the planned locked doors open.
function lockedDoors.proveFights(occurrence, nativeRoom, currentRun)
    if type(nativeRoom) ~= "table" or nativeRoom.LockExtraExitsWithEncounter == nil
        or nativeRoom.__runPlannerLockedDoorFightsAtEntry == nil then
        return true
    end
    local observed = completed(currentRun, nativeRoom.LockExtraExitsWithEncounter)
        - nativeRoom.__runPlannerLockedDoorFightsAtEntry
    local expected = lockedDoors.plannedFights(occurrence)
    if observed ~= expected then
        return nil, { kind = "lockedDoorFights", expected = expected, observed = observed }
    end
    return true
end

-- The planned exit key of a native door of the active occurrence.
local function exitKeyOf(occurrence, door)
    local expected = occurrence and occurrence.doors
    for _, target in ipairs(expected and expected.kind == "batch" and expected.targets or {}) do
        if doors.targets(door, target.room and target.room.id) then return target.exitKey end
    end
    return nil
end
lockedDoors.exitKeyOf = exitKeyOf

function lockedDoors.attach(module, session, getState, report, room, generatedEncounter)
    local pressScope

    local function planned(runtime, nativeRoom)
        local state = getState(runtime)
        local active = state and room.current(state) or nil
        if state == nil or state.state ~= "synchronized" or active == nil or type(nativeRoom) ~= "table"
            or nativeRoom.__runPlannerExecutionRoomId ~= active.occurrence.id then
            return nil
        end
        return state, active.occurrence
    end

    local function diagnostic(state, occurrence, observed)
        if session.diagnostic then session.diagnostic(state, "locked-doors", observed, occurrence) end
    end

    -- Native rolls the room's flag at creation and each later door at the doors'
    -- opening; the plan decides both: its locked doors lock, every other stays open.
    module.hooks.wrap("CheckExitPreUnlock", "run-planner-locked-doors", function(_, runtime, base,
        door, args, doorIndex)
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local state, occurrence = planned(runtime, nativeRoom)
        if state == nil or type(door) ~= "table" then return base(door, args, doorIndex) end
        local locks = lockedDoors.planned(occurrence)
        nativeRoom.LockExtraExits = next(locks) ~= nil or nil
        local exitKey = exitKeyOf(occurrence, door)
        local chance = door.LockedWithEncounterChance
        -- Native RandomChance(nil) is unconditionally false and draws nothing.
        door.LockedWithEncounterChance = exitKey ~= nil and locks[exitKey] ~= nil and 1.0 or nil
        local result = table.pack(pcall(base, door, args, doorIndex))
        door.LockedWithEncounterChance = chance
        if not result[1] then error(result[2], 0) end
        if exitKey ~= nil and locks[exitKey] ~= nil and door.EncounterCost == nil then
            diagnostic(state, occurrence, { kind = "lock-not-rolled", exitKey = exitKey })
        end
        return table.unpack(result, 2, result.n)
    end)

    -- The first press of a locked door generates and starts its fight.
    module.hooks.wrap("AttemptUseDoor", "run-planner-locked-door-press", function(_, runtime, base, door, args)
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local state, occurrence = planned(runtime, nativeRoom)
        if state == nil or type(door) ~= "table" or door.EncounterCost == nil or door.EncounterCostStarted then
            return base(door, args)
        end
        local exitKey = exitKeyOf(occurrence, door)
        local phase = exitKey and lockedDoors.phase(occurrence, exitKey) or nil
        if phase == nil then
            diagnostic(state, occurrence, { kind = "unplanned-unlock", exitKey = exitKey })
            return base(door, args)
        end
        local prior = pressScope
        pressScope = { state = state, occurrence = occurrence, phase = phase, encounterKey = door.EncounterCost }
        local ok, result = pcall(base, door, args)
        pressScope = prior
        if not ok then error(result, 0) end
        report(runtime)
        return result
    end)

    -- AttemptUseDoor generates its fight directly; the press's composition steers it.
    module.hooks.wrap("GenerateEncounter", "run-planner-locked-door-fight", function(_, _, base,
        currentRun, nativeRoom, encounter)
        local scope = pressScope
        if scope == nil or type(encounter) ~= "table" or encounter.Name ~= scope.encounterKey then
            return base(currentRun, nativeRoom, encounter)
        end
        pressScope = nil
        return generatedEncounter.withSwitchEncounter(scope.state, scope.occurrence, scope.phase,
            function() return base(currentRun, nativeRoom, encounter) end)
    end)
end

return lockedDoors
