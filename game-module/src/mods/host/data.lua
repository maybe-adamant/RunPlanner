local data = {}

function data.buildStorage()
    return {
        {
            type = "int",
            alias = "ActivePlanSlot",
            default = 1,
            min = 1,
            max = 12,
            persist = false,
        },
        {
            type = "bool",
            alias = "ShowRoomGuide",
            label = "Show room guide",
            tooltip = "Show read-only planned room instructions on the HUD.",
            default = false,
        },
        {
            type = "bool",
            alias = "HighlightPlannedChoices",
            label = "Highlight planned choices",
            tooltip = "Mark the next planned door or choice when it is available.",
            default = false,
        },
    }
end

return data
