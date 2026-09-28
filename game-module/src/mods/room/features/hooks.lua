-- Native spawning contacts for structural room features. Resulting exit
-- binding remains navigation-owned; resource rolls remain feature-owned.
local resources = type(import) == "function"
    and import("mods/room/features/resources.lua")
    or require("mods.room.features.resources")
local fields = type(import) == "function"
    and import("mods/room/features/fields.lua")
    or require("mods.room.features.fields")
local npcShopping = type(import) == "function"
    and import("mods/room/features/npc_shopping.lua")
    or require("mods.room.features.npc_shopping")
local hooks = {}

function hooks.attach(module, session, getState, report, room)
    local secretScope
    local pendingAdditional

    module.hooks.wrap("HandleSecretSpawns", "run-planner-room-features", function(_, runtime, base, currentRun)
        local state = getState(runtime)
        local synchronized = state ~= nil and state.state == "synchronized"
        local previous = secretScope
        secretScope = nil
        if synchronized then
            local additional = room.additional(state, "chaos")
            secretScope = { present = additional ~= nil, additional = additional }
        end
        local ok, result = pcall(base, currentRun)
        secretScope = previous
        if not ok then error(result, 0) end
        if synchronized then report(runtime) end
        return result
    end)

    module.hooks.wrap("SpawnObstacle", "run-planner-chaos-position", function(_, runtime, base, args)
        local state = getState(runtime)
        local scope = secretScope
        if state == nil or state.state ~= "synchronized" or scope == nil or scope.consumed
            or scope.additional == nil or scope.additional.spawnPointIndex == nil
            or type(args) ~= "table" or args.Name ~= "SecretDoor" then return base(args) end
        scope.consumed = true
        local points = {}
        for _, id in ipairs(_G.GetIdsByType({ Name = "SecretPoint" })) do points[#points + 1] = id end
        table.sort(points)
        local index = scope.additional.spawnPointIndex
        local destination = points[index]
        if destination == nil then
            session.diagnostic(state, "chaos-position-unavailable", { spawnPointIndex = index,
                pointCount = #points })
            return base(args)
        end
        local positioned = {}
        for key, value in pairs(args) do positioned[key] = value end
        positioned.DestinationId = destination
        return base(positioned)
    end)

    module.hooks.wrap("IsSecretDoorEligible", "run-planner-chaos-eligibility", function(_, runtime, base,
        currentRun, currentRoom)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then return base(currentRun, currentRoom) end
        if secretScope ~= nil then return secretScope.present end
        return base(currentRun, currentRoom)
    end)

    module.hooks.wrap("IsSellTraitShopEligible", "run-planner-purging-pool-presence", function(_, runtime, base,
        currentRoom)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then return base(currentRoom) end
        local occurrence = room.occurrence(state, currentRoom)
        if occurrence ~= nil then return occurrence.overview.purgingPool ~= nil end
        return base(currentRoom)
    end)

    module.hooks.wrap("IsWellShopEligible", "run-planner-well-presence", function(_, runtime, base, currentRun,
        currentRoom)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then return base(currentRun, currentRoom) end
        local occurrence = room.occurrence(state, currentRoom)
        if occurrence ~= nil then return occurrence.overview.stygianWell ~= nil end
        return base(currentRun, currentRoom)
    end)

    module.hooks.wrap("IsSurfaceShopEligible", "run-planner-shrine-presence", function(_, runtime, base,
        currentRun, currentRoom)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then return base(currentRun, currentRoom) end
        local occurrence = room.occurrence(state, currentRoom)
        if occurrence ~= nil then return occurrence.overview.hermesShrine ~= nil end
        return base(currentRun, currentRoom)
    end)

    module.hooks.wrap("SpawnZagContract", "run-planner-zagreus-contract", function(_, runtime, base, nativeRoom,
        args)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then return base(nativeRoom, args) end
        local additional, occurrence = room.additional(state, "zagreusContract")
        pendingAdditional = occurrence and { occurrence = occurrence, additional = additional } or nil
        local ok, result = pcall(base, nativeRoom, args)
        pendingAdditional = nil
        if not ok then error(result, 0) end
        report(runtime)
        return result
    end)

    resources.attach(module, getState, report)
    fields.attach(module, session, getState, report, room)
    npcShopping.attach(module, session, getState, report, room)

    return {
        currentAdditional = function() return pendingAdditional end,
    }
end

return hooks
