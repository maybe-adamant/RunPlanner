-- Snap mode's decision at a room exit after a mismatch: the planned next
-- occurrence to snap into, a declined transition, or a recurring mismatch.
local route = type(import) == "function" and import("mods/route/session.lua")
    or require("mods.route.session")

local mode = {}

-- Hubs and their visits, side rooms and handoffs: Ephyra's board is never snapped into.
local function hubShaped(plan, occurrence, roomName)
    for _, carrier in pairs(plan.occurrencesById) do
        local overview = carrier.overview or {}
        local hub = overview.hub
        if hub then
            if (hub.room and hub.room.gameName == roomName) or carrier.id == occurrence.id
                or (hub.finalHandoff and hub.finalHandoff.id == occurrence.id) then
                return true
            end
            for _, slot in ipairs(hub.slots or {}) do
                if slot.room and slot.room.id == occurrence.id then return true end
            end
        end
        for _, slot in ipairs(overview.localSlots or {}) do
            if slot.room and (slot.room.id == occurrence.id or carrier.id == occurrence.id) then return true end
        end
    end
    return false
end

-- Exits the route cursor and returns the occurrence to snap into with its
-- index, or nil and "declined" or "loop". roomName is the room being left.
function mode.target(state, roomName)
    local routeState, mismatch = state.route, state.firstMismatch
    if state.state ~= "desynchronized" or state.reason ~= "first-mismatch" or state.snapDisabled
        or mismatch == nil or routeState == nil then
        return nil, "declined"
    end
    local mismatchIndex, leaving = routeState.index, routeState.currentOccurrence or routeState.lastExitedOccurrence
    if routeState.currentOccurrence ~= nil then route.exit(routeState) end
    -- The same check failing again at the snapped occurrence or the next one is a loop.
    local last = state.snaps and state.snaps[#state.snaps]
    if last and last.mismatch and last.mismatch.checkpoint == mismatch.checkpoint
        and (mismatchIndex == last.index or mismatchIndex == last.index + 1) then
        return nil, "loop"
    end
    local target = route.expected(routeState)
    if target == nil or leaving == nil or target.biomeKey ~= leaving.biomeKey
        or not (target.diagnostics and target.diagnostics.roomEntered)
        or hubShaped(state.plan, target, roomName) then
        return nil, "declined"
    end
    return target, routeState.index
end

return mode
