-- Installs each planned list once, after native stale-inventory refresh: the
-- initial list at the first opening, then each reroll's pins after its native reroll.
local poolInventory = type(import) == "function"
    and import("mods/room/features/inventory/purging_pool.lua")
    or require("mods.room.features.inventory.purging_pool")
local hooks = {}

function hooks.attach(module, session, getState, report, room, highlights)
    local openings = setmetatable({}, { __mode = "k" })
    local poolRerolls = setmetatable({}, { __mode = "k" })
    local function currentThread() return coroutine.running() or hooks end
    -- One marker per roll on the native room: reopening the menu keeps the shown list.
    local function handled(nativeRoom, roll)
        local marks = nativeRoom.__runPlannerPoolRollsHandled
        return type(marks) == "table" and marks[roll] == true
    end
    local function markHandled(nativeRoom, roll)
        nativeRoom.__runPlannerPoolRollsHandled = nativeRoom.__runPlannerPoolRollsHandled or {}
        nativeRoom.__runPlannerPoolRollsHandled[roll] = true
    end

    local function plannedPool(state, nativeRoom)
        if state == nil or state.state ~= "synchronized" or type(nativeRoom) ~= "table"
            or nativeRoom.__runPlannerExecutionRoomId == nil or nativeRoom.SellTraitShop == nil then
            return nil
        end
        local occurrence = room.occurrence(state, nativeRoom)
        local pool = occurrence and occurrence.overview.purgingPool
        if pool == nil then return nil end
        return { state = state, nativeRoom = nativeRoom, occurrence = occurrence, pool = pool }
    end

    module.hooks.wrap("OpenSellTraitMenu", "run-planner-pool-open", function(_, runtime, base, ...)
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local opening = plannedPool(getState(runtime), nativeRoom)
        if opening ~= nil and ((poolRerolls[nativeRoom] or 0) > 0 or handled(nativeRoom, 0)
            or #opening.pool.traits == 0) then opening = nil end
        if opening ~= nil then opening.roll = 0 end
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
        local allowed = planned and planned.pool.rerolls and #planned.pool.rerolls or 0
        if rerolls > allowed then
            session.mismatch(state, "screen-reroll", allowed, rerolls)
            report(runtime)
            return base(...)
        end
        local entry = planned.pool.rerolls[rerolls]
        if #entry.traits == 0 or handled(nativeRoom, rerolls) then planned = nil end
        if planned ~= nil then planned.roll = rerolls end
        local thread = currentThread()
        local prior = openings[thread]
        openings[thread] = planned
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
            and not handled(opening.nativeRoom, opening.roll)
            and (poolRerolls[opening.nativeRoom] or 0) == opening.roll then
            markHandled(opening.nativeRoom, opening.roll)
            -- Phial may change a planned trait outside the native random three;
            -- that does not trigger OpenSellTraitMenu's stale-row regeneration.
            -- A reroll's random exclusion of an earlier row is refreshed away too.
            _G.GenerateSellTraitValues(opening.nativeRoom)
            local ok, errorValue = poolInventory.steer(opening.occurrence, opening.nativeRoom, opening.roll)
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
