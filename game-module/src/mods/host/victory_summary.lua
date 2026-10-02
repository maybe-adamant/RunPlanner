-- Victory-screen summary of the admitted plan. Rows are produced from the
-- session snapshot when the RunClear screen opens; nothing else is read.
local names = type(import) == "function" and import("mods/room/names.lua")
    or require("mods.room.names")

local victorySummary = {}

victorySummary.TABLE = "victory-summary"

victorySummary.declaration = {
    region = "victoryStack",
    maxRows = 4,
    columns = { { key = "text" } },
}

-- RunClear opens inside the final boss room before LeaveRoom, so a synchronized
-- session's current occurrence is the last room realized as planned. Otherwise
-- the last exited occurrence is: the cursor never leaves a mismatched, faulted,
-- hub, or transparent room.
local function plannedThrough(snapshot)
    if type(snapshot) ~= "table" then return nil end
    local current = snapshot.current
    if snapshot.state == "synchronized" and type(current) == "table" and current.gameName ~= nil then
        return current
    end
    local exited = snapshot.lastExited
    if type(exited) == "table" and exited.gameName ~= nil then return exited end
    return nil
end

function victorySummary.rows(snapshot)
    local rows = {}
    local occurrence = plannedThrough(snapshot)
    if occurrence ~= nil then
        rows[#rows + 1] = { text = "Planned through " .. names.room(occurrence.gameName) }
    end
    return rows
end

function victorySummary.attach(module, inspect)
    assert(type(module) == "table" and type(module.overlays) == "table", "victory summary module is required")
    assert(type(inspect) == "function", "victory summary inspection is required")
    local spec = {}
    for key, value in pairs(victorySummary.declaration) do spec[key] = value end
    spec.order = module.overlays.order.module
    module.overlays.createTable(victorySummary.TABLE, spec)

    module.overlays.afterHook("OnScreenOpened", function(_, _, overlay, event)
        local screen = type(event) == "table" and type(event.args) == "table" and event.args[1] or nil
        if type(screen) ~= "table" or screen.Name ~= "RunClear" then return end
        local ok, rows = pcall(function() return victorySummary.rows(inspect()) end)
        overlay.setTable(victorySummary.TABLE, ok and rows or {})
        overlay.refresh(victorySummary.TABLE)
    end)
end

return victorySummary
