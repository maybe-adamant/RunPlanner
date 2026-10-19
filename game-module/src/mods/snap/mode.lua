-- Snap mode's decision at a room exit after a mismatch: the planned next
-- occurrence to snap into, or a declined transition.
local route = type(import) == "function" and import("mods/route/session.lua")
    or require("mods.route.session")
local ephyra = type(import) == "function" and import("mods/navigation/ephyra.lua")
    or require("mods.navigation.ephyra")

local mode = {}

local function framed(occurrence)
    return occurrence ~= nil and occurrence.diagnostics ~= nil and occurrence.diagnostics.roomEntered ~= nil
end

local function returnsToPrevious(door)
    return type(door) == "table" and (door.ReturnToPreviousRoom ~= nil or door.ReturnToPreviousRoomName ~= nil)
end

local function nativeName(value)
    return type(value) == "table" and (value.GenusName or value.Name) or nil
end

-- An ordinary exit reaches a fresh room of its own biome. The Hub carrier's exit first
-- enters the Hub, so its first hub visit is reached with the snap carried through the Hub:
-- through the taken door when it enters the Hub, else through the offered Hub door.
local function ordinary(plan, target, from, context)
    if target == nil or from == nil or target.biomeKey ~= from.biomeKey or not framed(target) then return nil end
    if not ephyra.onBoard(plan, target) then return { kind = "room" } end
    local hub = from.overview and from.overview.hub
    for _, slot in ipairs(hub and hub.slots or {}) do
        if slot.room and slot.room.id == target.id then
            local taken = type(context.door) == "table" and context.door or {}
            if nativeName(taken.Room) == hub.room.gameName then return { kind = "throughHub" } end
            for _, door in pairs(context.offered or {}) do
                if nativeName(door.Room) == hub.room.gameName then return { kind = "throughHub", door = door } end
            end
            return nil
        end
    end
    return nil
end

-- Exits the route cursor and returns the occurrence to snap into, its index and
-- the way in, or nil and "declined". roomName is the room being left; context
-- holds this exit's taken door, offered doors, run, game and whether it was in sync.
-- Board rooms snap through their own offered doors; elsewhere a declined target is
-- skipped once the room being left is found later in the plan.
function mode.target(state, roomName, context)
    context = context or {}
    local routeState = state.route
    if state.state ~= "desynchronized" or state.reason ~= "first-mismatch" or state.snapDisabled
        or state.firstMismatch == nil or routeState == nil then
        return nil, "declined"
    end
    local leaving = routeState.currentOccurrence or routeState.lastExitedOccurrence
    if routeState.currentOccurrence ~= nil then route.exit(routeState) end
    local plan, selected = state.plan, state.plan.selectedOccurrenceIds
    if ephyra.exit(plan, roomName) ~= nil then
        -- In sync only the planned next room counts, including a return through the Hub.
        local last = context.inSync and routeState.index or #selected
        for index = routeState.index, last do
            local target = plan.occurrencesById[selected[index]]
            local exit = ephyra.exit(plan, roomName, target, context.offered, context.currentRun, context.game,
                not context.inSync)
            if exit.door ~= nil and ((exit.enters and framed(target)) or (context.inSync and not exit.enters)) then
                exit.kind = "board"
                return target, index, exit
            end
        end
        return nil, "declined"
    end
    if returnsToPrevious(context.door) then return nil, "declined" end
    local target = route.expected(routeState)
    local way = ordinary(plan, target, leaving, context)
    if way ~= nil then return target, routeState.index, way end
    for index = routeState.index, #selected - 1 do
        local located = plan.occurrencesById[selected[index]]
        if located.gameName == roomName then
            local nextOccurrence = plan.occurrencesById[selected[index + 1]]
            way = ordinary(plan, nextOccurrence, located, context)
            if way == nil then break end
            routeState.lastExitedOccurrence = located
            return nextOccurrence, index + 1, way
        end
    end
    return nil, "declined"
end

return mode
