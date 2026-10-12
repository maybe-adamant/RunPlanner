-- Marks the nodes a writable Path screen plans to invest. The native screen
-- keeps every choice, and the reader checks legality facts.
local pathNodes = {}

local OVERLAY_GROUP = "Combat_Menu_Overlay_Additive"
local OVERLAY_ANIMATION = "ActiveTrait"

function pathNodes.create()
    local planned, openScreen = nil, nil

    local instance = {}

    -- `depth:slot` keys of the screen now open, or nil when no plan applies.
    function instance.plan(nodeKeys)
        planned, openScreen = nil, nil
        if type(nodeKeys) ~= "table" or #nodeKeys == 0 then return end
        planned = {}
        for _, key in ipairs(nodeKeys) do planned[key] = true end
    end

    -- Runs after native UpdateTalentButtons: while enabled, one overlay on each
    -- planned node still to be chosen on this screen, none elsewhere.
    function instance.refresh(screen, enabled)
        if planned ~= nil then openScreen = screen end
        local active = enabled and planned or nil
        local components = type(screen) == "table" and screen.Components or nil
        if type(components) ~= "table" then return end
        screen.RunPlannerPlannedOverlays = screen.RunPlannerPlannedOverlays or {}
        local overlays = screen.RunPlannerPlannedOverlays
        for key, overlayId in pairs(overlays) do
            local depth, slot = key:match("^(%d+):(%d+)$")
            local node = components["TalentObject" .. depth .. "_" .. slot]
            local data = type(node) == "table" and node.Data or nil
            if active == nil or not active[key] or data == nil or data.Invested or data.QueuedInvested then
                _G.Destroy({ Id = overlayId })
                overlays[key] = nil
            end
        end
        if active == nil then return end
        for key in pairs(active) do
            local depth, slot = key:match("^(%d+):(%d+)$")
            local node = depth and components["TalentObject" .. depth .. "_" .. slot] or nil
            local data = type(node) == "table" and node.Data or nil
            if overlays[key] == nil and data ~= nil and not data.Invested and not data.QueuedInvested then
                local overlay = _G.CreateScreenComponent({
                    Name = "BlankObstacle",
                    Group = OVERLAY_GROUP,
                    Scale = screen.DefaultTalentScale,
                    Animation = OVERLAY_ANIMATION,
                    DestinationId = node.Id,
                    Attach = true,
                })
                overlays[key] = overlay.Id
            end
        end
    end

    -- Re-applies the open planned screen after the setting or session changes.
    function instance.refreshOpen(enabled)
        if openScreen ~= nil then instance.refresh(openScreen, enabled) end
    end

    return instance
end

return pathNodes
