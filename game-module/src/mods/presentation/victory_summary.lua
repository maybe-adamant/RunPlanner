-- Victory-screen summary of the admitted plan. Rows are produced from the
-- session snapshot and the slot overview when the RunClear screen opens.
local presentation = type(import) == "function" and import("mods/presentation/run_presentation.lua")
    or require("mods.presentation.run_presentation")
local names = type(import) == "function" and import("mods/presentation/names.lua")
    or require("mods.presentation.names")

local safeHooks = type(import) == "function" and import("mods/host/presentation_hooks.lua")
    or require("mods.host.presentation_hooks")

local victorySummary = {}

victorySummary.TABLE = "victory-summary"

victorySummary.declaration = {
    region = "victoryStack",
    maxRows = 4,
    columns = { { key = "text" } },
}

-- RunClear opens inside the final boss room before LeaveRoom, so a synchronized
-- session in the last planned room has realized the whole plan.
local function outcome(snapshot)
    if presentation.isComplete(snapshot) then return "Complete" end
    local place = presentation.stopPlace(snapshot)
    if snapshot.state == "desynchronized" then
        return place and "Out of sync at " .. place or "Out of sync"
    end
    if snapshot.state == "faulted" then
        return place and "Stopped at " .. place .. " (planner error)" or "Stopped (planner error)"
    end
    if snapshot.state == "synchronized" and type(snapshot.current) == "table" then
        local ids = snapshot.plan.selectedOccurrenceIds
        if snapshot.current.id == ids[#ids] then return "Complete" end
        return "Planned through " .. names.room(snapshot.current.gameName)
    end
    return nil
end

-- entries and present are the slot overview read: the running slot's entry may
-- name the plan, and the event slot's entry names the event a plan with its
-- fingerprint belongs to while the event slot's file exists.
function victorySummary.rows(snapshot, entries, present)
    if type(snapshot) ~= "table" or type(snapshot.plan) ~= "table" then return {} end
    local result = outcome(snapshot)
    if result == nil then return {} end
    entries = type(entries) == "table" and entries or {}
    local event = presentation.runningEvent(snapshot.plan, entries, present)
    return {
        { text = event and "Planned event - " .. event.title
            or "Planned run - " .. presentation.planName(snapshot.plan, entries[snapshot.slot], snapshot.slot) },
        { text = result },
    }
end

function victorySummary.attach(module, inspect, slotOverview)
    assert(type(module) == "table" and type(module.overlays) == "table", "victory summary module is required")
    assert(type(inspect) == "function", "victory summary inspection is required")
    assert(type(slotOverview) == "table" and type(slotOverview.read) == "function",
        "victory summary slot overview is required")
    local spec = {}
    for key, value in pairs(victorySummary.declaration) do spec[key] = value end
    spec.order = module.overlays.order.module
    module.overlays.createTable(victorySummary.TABLE, spec)

    safeHooks.afterHook(module, "OnScreenOpened", "victory-summary", function(_, _, overlay, event)
        local screen = type(event) == "table" and type(event.args) == "table" and event.args[1] or nil
        if type(screen) ~= "table" or screen.Name ~= "RunClear" then return end
        local ok, rows = pcall(function()
            local entries, present = slotOverview.read()
            return victorySummary.rows(inspect(), entries, present)
        end)
        overlay.setTable(victorySummary.TABLE, ok and rows or {})
        overlay.refresh(victorySummary.TABLE)
    end)
end

return victorySummary
