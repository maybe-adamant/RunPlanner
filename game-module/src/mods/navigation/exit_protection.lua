-- Protect only the authored continuation from Nemesis: native code retains her
-- eligibility, timing, movement and takeover of other doors. Oceanus door locks
-- are the plan's (room/features/locked_doors.lua).
local doors = type(import) == "function" and import("mods/navigation/doors.lua")
    or require("mods.navigation.doors")
local exitProtection = {}

function exitProtection.attach(module, getState, routeSession)
    local mainThread = {}
    local nemesisScopes = setmetatable({}, { __mode = "k" })

    local function pickedDestination(state)
        if state == nil or state.state ~= "synchronized" then return nil end
        local route = state.route
        if routeSession.current(route) == nil then return nil end
        return route.plan.selectedOccurrenceIds[route.index + 1]
    end

    module.hooks.wrap("NemesisTakeRoomExit", "run-planner-nemesis-exit-scope", function(_, runtime, base, ...)
        local state = getState(runtime)
        local destination = pickedDestination(state)
        if destination == nil then return base(...) end
        local thread = coroutine.running() or mainThread
        local prior = nemesisScopes[thread]
        nemesisScopes[thread] = {
            state = state, route = state.route, occurrence = routeSession.current(state.route),
            destination = destination,
        }
        -- Native selection follows waits; keep its scope local to this coroutine.
        local result = table.pack(pcall(base, ...))
        nemesisScopes[thread] = prior
        if not result[1] then error(result[2], 0) end
        return table.unpack(result, 2, result.n)
    end)

    module.hooks.wrap("GetRandomValue", "run-planner-nemesis-exit-choice", function(_, runtime, base, values, ...)
        local thread = coroutine.running() or mainThread
        local scope = nemesisScopes[thread]
        if scope == nil or values == nil then return base(values, ...) end
        local state = getState(runtime)
        if state ~= scope.state or state.state ~= "synchronized" or state.route ~= scope.route
            or routeSession.current(state.route) ~= scope.occurrence then
            nemesisScopes[thread] = nil
            return base(values, ...)
        end
        local offered = _G.MapState.OfferedExitDoors
        local candidates, protected = {}, false
        for _, door in pairs(values) do
            -- Scope alone is insufficient: only the native candidate door list
            -- belongs to this decision, not incidental presentation randomness.
            if type(door) ~= "table" or offered[door.ObjectId] ~= door then return base(values, ...) end
            if doors.targets(door, scope.destination) then
                protected = true
            else
                candidates[#candidates + 1] = door
            end
        end
        if next(values) == nil then return base(values, ...) end
        nemesisScopes[thread] = nil -- the later movement/presentation needs no scope
        if not protected then return base(values, ...) end
        -- Native code teleports instead of selecting when <= 1 door is eligible.
        if #candidates == 0 then return base(values, ...) end
        return base(candidates, ...)
    end)
end

return exitProtection
