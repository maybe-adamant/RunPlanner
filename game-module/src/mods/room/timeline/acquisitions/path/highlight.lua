-- Marks the nodes a writable Path screen plans to invest. Guidance only: the
-- native screen keeps every choice, and the reader checks legality facts.
local highlight = {}

local OVERLAY_GROUP = "Combat_Menu_Overlay_Additive"
local OVERLAY_ANIMATION = "ActiveTrait"

function highlight.create()
    local planned = nil

    local instance = {}

    -- `depth:slot` keys of the screen now open, or nil when no plan applies.
    function instance.plan(nodeKeys)
        planned = nil
        if type(nodeKeys) ~= "table" or #nodeKeys == 0 then return end
        planned = {}
        for _, key in ipairs(nodeKeys) do planned[key] = true end
    end

    function instance.clear() planned = nil end

    -- Runs after native UpdateTalentButtons: one overlay on each planned node
    -- still to be chosen on this screen, none elsewhere.
    function instance.refresh(screen)
        local components = type(screen) == "table" and screen.Components or nil
        if type(components) ~= "table" then return end
        screen.RunPlannerPlannedOverlays = screen.RunPlannerPlannedOverlays or {}
        local overlays = screen.RunPlannerPlannedOverlays
        for key, overlayId in pairs(overlays) do
            local depth, slot = key:match("^(%d+):(%d+)$")
            local node = components["TalentObject" .. depth .. "_" .. slot]
            local data = type(node) == "table" and node.Data or nil
            if planned == nil or not planned[key] or data == nil or data.Invested or data.QueuedInvested then
                _G.Destroy({ Id = overlayId })
                overlays[key] = nil
            end
        end
        if planned == nil then return end
        for key in pairs(planned) do
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

    return instance
end

return highlight
