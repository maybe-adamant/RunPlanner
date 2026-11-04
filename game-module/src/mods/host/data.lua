local data = {}

-- Every alias mirrors a shared file the planner also writes: ActivePlanSlot
-- active-slot.json and the options settings.json. None is kept in Lib config.

function data.buildStorage()
    return {
        {
            type = "int",
            alias = "ActivePlanSlot",
            default = 1,
            min = 0,
            max = 12,
            persist = false,
        },
        {
            type = "bool",
            alias = "ShowRoomGuide",
            label = "Show room guide",
            tooltip = "Show read-only planned room instructions on the HUD.",
            default = false,
            persist = false,
        },
        {
            type = "bool",
            alias = "HighlightPlannedChoices",
            label = "Highlight planned choices",
            tooltip = "Mark the next planned door or choice when it is available.",
            default = false,
            persist = false,
        },
        {
            type = "bool",
            alias = "SnapMode",
            label = "Snap back to the plan",
            tooltip = "After the run goes out of sync, take the next door back into the planned route and restore the planned build there.",
            default = false,
            persist = false,
        },
    }
end

return data
