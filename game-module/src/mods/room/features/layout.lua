-- Room layout: the published flip and entry of an entered room. Absent values
-- stay native. The flip is preset on the created room, so LeaveRoom, which
-- computes a next room's flip only while it is unset, keeps it; the entry is
-- preset as the room's own start and end points, which native keeps unless an
-- arrival door's NextHeroStartPoint replaces them.
local layout = {}

-- Presets the published flip and entry on a room being created for the occurrence.
function layout.realize(nativeRoom, overview)
    local published = type(overview) == "table" and overview.layout or nil
    if type(nativeRoom) ~= "table" or published == nil then return nativeRoom end
    if published.flipped ~= nil then nativeRoom.Flipped = published.flipped end
    if published.entry ~= nil then
        nativeRoom.HeroStartPoint = published.entry.startPointId
        nativeRoom.HeroEndPoint = published.entry.endPointId
    end
    return nativeRoom
end

function layout.attach(module, session, getState, report, room)
    -- Each entered occurrence's entry is steered and checked once; a revisit stays native.
    local steered = setmetatable({}, { __mode = "k" })
    local checked = setmetatable({}, { __mode = "k" })

    local function activeLayout(state, nativeRoom)
        if state == nil or state.state ~= "synchronized" or type(nativeRoom) ~= "table"
            or nativeRoom.__runPlannerExecutionRoomId == nil then return nil end
        local active = room.current(state)
        if active == nil or nativeRoom.__runPlannerExecutionRoomId ~= active.occurrence.id then return nil end
        return active, active.occurrence.overview.layout
    end

    -- A published entry wins over an arrival door's NextHeroStartPoint, which
    -- native otherwise prefers to the room's own points.
    module.hooks.wrap("GatherRoomPresentationObjects", "run-planner-room-entry-point", function(_, runtime, base,
        currentRun, currentRoom, ...)
        local state = getState(runtime)
        local active, published = activeLayout(state, currentRoom)
        local entry = published and published.entry
        if entry == nil or steered[active] or type(currentRun) ~= "table" or currentRun.StoredHeroLocation then
            return base(currentRun, currentRoom, ...)
        end
        steered[active] = true
        currentRoom.HeroStartPoint, currentRoom.HeroEndPoint = entry.startPointId, entry.endPointId
        if currentRun.NextHeroStartPoint ~= nil or currentRun.NextHeroEndPoint ~= nil then
            if currentRun.NextHeroStartPoint ~= entry.startPointId then
                session.diagnostic(state, "room-entry-forced", {
                    expected = entry.startPointId, observed = currentRun.NextHeroStartPoint,
                })
                report(runtime)
            end
            currentRun.NextHeroStartPoint, currentRun.NextHeroEndPoint = nil, nil
        end
        return base(currentRun, currentRoom, ...)
    end)

    -- Entry and flip are positional: a difference is a diagnostic, not a mismatch.
    module.hooks.wrap("StartRoomPresentation", "run-planner-room-layout-observed", function(_, runtime, base,
        currentRun, nativeRoom, ...)
        local state = getState(runtime)
        local active, published = activeLayout(state, nativeRoom)
        if published ~= nil and not checked[active] then
            checked[active] = true
            local differs = false
            if published.entry ~= nil and nativeRoom.HeroStartPoint ~= published.entry.startPointId then
                session.diagnostic(state, "room-entry", {
                    expected = published.entry.startPointId, observed = nativeRoom.HeroStartPoint,
                })
                differs = true
            end
            if published.flipped ~= nil and nativeRoom.Flipped ~= published.flipped then
                session.diagnostic(state, "room-flip", { expected = published.flipped, observed = nativeRoom.Flipped })
                differs = true
            end
            if differs then report(runtime) end
        end
        return base(currentRun, nativeRoom, ...)
    end)
end

return layout
