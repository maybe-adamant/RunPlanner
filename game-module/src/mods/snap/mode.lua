-- Snap mode's decisions at a room exit: the plan's hero state for the room being
-- left, and after a mismatch the planned occurrence the exit returns to.
local route = type(import) == "function" and import("mods/route/session.lua")
    or require("mods.route.session")
local ephyra = type(import) == "function" and import("mods/navigation/ephyra.lua")
    or require("mods.navigation.ephyra")

local mode = {}

local function returnsToPrevious(door)
    return type(door) == "table" and (door.ReturnToPreviousRoom ~= nil or door.ReturnToPreviousRoomName ~= nil)
end

local function nativeName(value)
    return type(value) == "table" and (value.GenusName or value.Name) or nil
end

-- Whether an exit can still be corrected: a planned run that has not stopped snapping.
function mode.armed(state)
    if state.snapDisabled or state.abandoned or state.plan == nil or state.route == nil then return false end
    return state.state == "synchronized" or (state.state == "desynchronized" and state.reason == "first-mismatch")
end

-- The Hub's departure frame toward the occurrence at `index` (the cursor's when
-- nil), else the frame of the occurrence being left when it is that native room;
-- nil when the plan has none.
function mode.frame(state, nativeRoom, leaving, index)
    if ephyra.hub(state.plan, nativeRoom) ~= nil then
        local departure = route.hubDeparture(state.route, index)
        return departure and departure.beforeRoomExit
    end
    if leaving == nil or leaving.gameName ~= nativeName(nativeRoom) then return nil end
    return leaving.diagnostics and leaving.diagnostics.beforeRoomExit
end

-- The planned occurrence after `roomName` when the route entered that room in
-- sync, without moving the cursor; nil otherwise or when the plan ends there.
function mode.plannedNext(state, roomName)
    local current = state.route.currentOccurrence
    if current == nil or current.gameName ~= roomName then return nil end
    return route.next(state.route)
end

-- An ordinary exit reaches a fresh room; across a biome edge only from a Postboss
-- the route entered in sync. The Hub carrier's exit enters the Hub, through the
-- taken door when it does, else through the offered Hub door.
local function ordinary(plan, target, from, context, entered)
    if target == nil or from == nil then return nil end
    if target.biomeKey ~= from.biomeKey and not (entered and from.gameName:find("_PostBoss") ~= nil) then
        return nil
    end
    if not ephyra.onBoard(plan, target) then return { kind = "room" } end
    local hub = from.overview and from.overview.hub
    for _, slot in ipairs(hub and hub.slots or {}) do
        if slot.room and slot.room.id == target.id then
            local taken = type(context.door) == "table" and context.door or {}
            if nativeName(taken.Room) == hub.room.gameName then return { kind = "hub" } end
            for _, door in pairs(context.offered or {}) do
                if nativeName(door.Room) == hub.room.gameName then return { kind = "hub", door = door } end
            end
            return nil
        end
    end
    return nil
end

-- Exits the route cursor and returns { leaving, target, index, way } for a
-- desynchronized run; target is nil when the transition is declined. roomName is
-- the room being left; context holds this exit's taken door, offered doors, run,
-- game and whether it was in sync. Board rooms leave through their own offered
-- doors; a side room returns to its parent; elsewhere a declined cursor target is
-- skipped once the room being left is found later in the plan.
function mode.target(state, roomName, context)
    context = context or {}
    local routeState, plan = state.route, state.plan
    local selected = plan.selectedOccurrenceIds
    -- The room being left was entered in sync when the route still holds it, or the
    -- exit itself was in sync and only its door strayed.
    local entered = routeState.currentOccurrence or (context.inSync and routeState.lastExitedOccurrence) or nil
    local decision = { leaving = routeState.currentOccurrence or routeState.lastExitedOccurrence }
    if routeState.currentOccurrence ~= nil then route.exit(routeState) end
    if ephyra.exit(plan, roomName) ~= nil then
        -- In sync only the planned next room counts, including a return to the Hub.
        local last = context.inSync and routeState.index or #selected
        for index = routeState.index, last do
            local target = plan.occurrencesById[selected[index]]
            local exit = ephyra.exit(plan, roomName, target, context.offered, context.currentRun, context.game,
                not context.inSync)
            if exit.door ~= nil then
                exit.kind = "board"
                decision.target, decision.index, decision.way = target, index, exit
                return decision
            end
            -- A planned side room is never skipped.
            if exit.localSlot then return decision end
        end
        return decision
    end
    local leaving = decision.leaving
    if returnsToPrevious(context.door) then
        -- The native return already re-enters the side room's parent.
        if leaving ~= nil and leaving.gameName == roomName and ephyra.parentForSide(plan, leaving.id) ~= nil then
            decision.target, decision.index, decision.way = route.expected(routeState), routeState.index,
                { kind = "return" }
            if decision.target == nil then decision.way = nil end
        end
        return decision
    end
    -- A cursor occurrence that is the room being left was entered out of sync; its successor is found below.
    local target = route.expected(routeState)
    local way = target ~= nil and not (entered == nil and target.gameName == roomName)
        and ordinary(plan, target, leaving, context, entered ~= nil and leaving == entered) or nil
    if way ~= nil then
        decision.target, decision.index, decision.way = target, routeState.index, way
        return decision
    end
    for index = routeState.index, #selected - 1 do
        local located = plan.occurrencesById[selected[index]]
        if located.gameName == roomName then
            local nextOccurrence = plan.occurrencesById[selected[index + 1]]
            way = ordinary(plan, nextOccurrence, located, context, located == entered)
            if way == nil then break end
            decision.leaving, decision.target, decision.index, decision.way = located, nextOccurrence, index + 1, way
            return decision
        end
    end
    return decision
end

return mode
