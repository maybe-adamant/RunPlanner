-- Install once at the pool screen after the planned native rerolls (the first
-- screen when none), after native stale-inventory refresh.
local poolInventory = type(import) == "function"
    and import("mods/room/features/inventory/purging_pool.lua")
    or require("mods.room.features.inventory.purging_pool")
local hooks = {}

function hooks.attach(module, session, getState, report, room, highlights)
    local openings = setmetatable({}, { __mode = "k" })
    local poolRerolls = setmetatable({}, { __mode = "k" })
    local function currentThread() return coroutine.running() or hooks end

    local function plannedPool(state, nativeRoom)
        if state == nil or state.state ~= "synchronized" or type(nativeRoom) ~= "table"
            or nativeRoom.__runPlannerExecutionRoomId == nil or nativeRoom.SellTraitShop == nil then
            return nil
        end
        local occurrence = room.occurrence(state, nativeRoom)
        local pool = occurrence and occurrence.overview.purgingPool
        if pool == nil or not pool.interacted then return nil end
        return { state = state, nativeRoom = nativeRoom, occurrence = occurrence, pool = pool }
    end

    module.hooks.wrap("OpenSellTraitMenu", "run-planner-pool-open", function(_, runtime, base, ...)
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local opening = plannedPool(getState(runtime), nativeRoom)
        if opening ~= nil and nativeRoom.__runPlannerPoolInventoryHandled then opening = nil end
        local thread = currentThread()
        local prior = openings[thread]
        openings[thread] = opening
        local results = table.pack(pcall(base, ...))
        openings[thread] = prior
        if not results[1] then error(results[2], 0) end
        return table.unpack(results, 2, results.n)
    end)

    -- A native reroll rebuilds the buttons within the same open menu.
    module.hooks.wrap("SellTraitScreenReroll", "run-planner-pool-reroll", function(_, runtime, base, ...)
        local state = getState(runtime)
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local planned = plannedPool(state, nativeRoom)
        if state == nil or state.state ~= "synchronized" or type(nativeRoom) ~= "table" then return base(...) end
        local rerolls = (poolRerolls[nativeRoom] or 0) + 1
        poolRerolls[nativeRoom] = rerolls
        local allowed = planned and planned.pool.rerollCount or 0
        if rerolls > allowed then
            session.mismatch(state, "screen-reroll", allowed, rerolls)
            report(runtime)
            return base(...)
        end
        local thread = currentThread()
        local prior = openings[thread]
        openings[thread] = not nativeRoom.__runPlannerPoolInventoryHandled and planned or nil
        local results = table.pack(pcall(base, ...))
        openings[thread] = prior
        if not results[1] then error(results[2], 0) end
        return table.unpack(results, 2, results.n)
    end)

    module.hooks.wrap("CreateSellButtons", "run-planner-pool-inventory", function(_, runtime, base, screen, ...)
        local thread = currentThread()
        local opening = openings[thread]
        -- Consume before rendering: rerolls rebuild buttons within the same open menu.
        openings[thread] = nil
        if opening and _G.CurrentRun and _G.CurrentRun.CurrentRoom == opening.nativeRoom
            and getState(runtime) == opening.state and opening.state.state == "synchronized"
            and not opening.nativeRoom.__runPlannerPoolInventoryHandled
            and (poolRerolls[opening.nativeRoom] or 0) == (opening.pool.rerollCount or 0) then
            opening.nativeRoom.__runPlannerPoolInventoryHandled = true
            -- Phial may change a planned trait outside the native random three;
            -- that does not trigger OpenSellTraitMenu's stale-row regeneration.
            -- A reroll's random exclusion of an earlier row is refreshed away too.
            _G.GenerateSellTraitValues(opening.nativeRoom)
            local ok, errorValue = poolInventory.steer(opening.occurrence, opening.nativeRoom)
            if not ok then
                session.diagnostic(opening.state, errorValue.checkpoint, {
                    expected = errorValue.expected, observed = errorValue.observed,
                })
            end
            report(runtime)
        end
        local results = table.pack(base(screen, ...))
        if highlights then highlights.store(runtime, getState(runtime), screen, "pool") end
        return table.unpack(results, 1, results.n)
    end)
end

return hooks
