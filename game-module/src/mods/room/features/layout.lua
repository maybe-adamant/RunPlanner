-- Room layout: the published flip and entry of an entered room. A value the
-- arrival door derives (listed in `derived`) stays native and is only checked.
-- The flip is preset on the created room, so LeaveRoom, which computes a next
-- room's flip only while it is unset, keeps it; the entry is preset as the
-- room's own start and end points, which native keeps unless an arrival door's
-- NextHeroStartPoint replaces them.
local layout = {}

local function derived(published, field)
    for _, value in ipairs(published.derived or {}) do
        if value == field then return true end
    end
    return false
end

-- The published entry the runtime steers, absent where the arrival door derives it.
local function steeredEntry(published)
    if published == nil or derived(published, "entry") then return nil end
    return published.entry
end

-- Presets the published flip and entry on a room being created for the occurrence.
function layout.realize(nativeRoom, overview)
    local published = type(overview) == "table" and overview.layout or nil
    if type(nativeRoom) ~= "table" or published == nil then return nativeRoom end
    if not derived(published, "flipped") then nativeRoom.Flipped = published.flipped end
    local entry = steeredEntry(published)
    if entry ~= nil then
        nativeRoom.HeroStartPoint = entry.startPointId
        nativeRoom.HeroEndPoint = entry.endPointId
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
        local entry = steeredEntry(published)
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

    -- Entry and flip, steered or derived, are positional: a difference is a diagnostic, not a mismatch.
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
            if (nativeRoom.Flipped == true) ~= published.flipped then
                session.diagnostic(state, "room-flip", { expected = published.flipped, observed = nativeRoom.Flipped })
                differs = true
            end
            if differs then report(runtime) end
        end
        return base(currentRun, nativeRoom, ...)
    end)
end

return layout
