-- Native setup owns occupancy, contents and callbacks; steer only its inputs.
local arachne = {}

local function copy(value)
    local result = {}
    for key, item in pairs(value) do result[key] = item end
    return result
end

local function selected(state, room, encounter)
    if state == nil or state.state ~= "synchronized" then return nil end
    local phase = room.encounterPhase(state, encounter)
    if phase == nil then return nil end
    local count, point
    for _, decision in ipairs(phase.customization or {}) do
        if decision.kind == "cocoonCount" then count = decision end
        if decision.kind == "cocoonRewardPoint" then point = decision end
    end
    return phase, count, point
end

local function diagnostic(session, state, phase, observed, position)
    if session and session.diagnostic then
        observed.encounterKey = phase.encounterKey
        session.diagnostic(state, position and "arachne-cocoon-position" or "arachne-cocoon-count", observed)
    end
end

local function contains(values, point)
    for _, value in ipairs(values or {}) do if value == point then return true end end
    return false
end

local function admits(nativeRoom, args, point)
    if not nativeRoom or not _G.MapState or type(_G.IsSpawnPointEligible) ~= "function" then return false end
    local required = args.RequiredSpawnPointType
    local kind = required or "EnemyPoint"
    local pool = nativeRoom.SpawnPoints and nativeRoom.SpawnPoints[kind]
    if pool == nil and type(_G.GetIdsByType) == "function" then pool = _G.GetIdsByType({ Name = kind }) end
    local member = contains(pool, point)
        or (required == nil and contains(_G.MapState.SpawnPoints, point))
    return member and _G.IsSpawnPointEligible(point, {}, nativeRoom, {})
end

function arachne.attach(module, session, getState, _report, room)
    -- A yielded unrelated thread cannot borrow this setup. Nested calls mask
    -- their caller; pcall retires every scope before returning or rethrowing.
    local scopes = setmetatable({}, { __mode = "k" })
    local mainThread = {}
    local function threadKey() return coroutine.running() or mainThread end

    module.hooks.wrap("SpawnArachneCocoons", "run-planner-arachne-spawn", function(_, _, base, source, args)
        local key = threadKey()
        local scope = scopes[key]
        if not scope then return base(source, args) end
        local prior = scope.spawning
        local claimed = not scope.spawnClaimed and source == scope.source and args == scope.args
        scope.spawning = claimed
        if claimed then scope.spawnClaimed = true end
        if not claimed then scopes[key] = nil end
        local result = table.pack(pcall(base, source, args))
        scopes[key] = scope
        scope.spawning = prior
        if not result[1] then error(result[2], 0) end
        if claimed then scope.spawned = true end
        return table.unpack(result, 2, result.n)
    end)

    module.hooks.wrap("SelectSpawnPoint", "run-planner-arachne-anchor", function(_, _, base,
        nativeRoom, enemy, encounter, ...)
        local scope = scopes[threadKey()]
        if scope and scope.spawning and not scope.pointUsed and nativeRoom == scope.nativeRoom
            and type(enemy) == "table" and enemy.PreferredSpawnPoint == "EnemyPoint"
            and enemy.RequiredSpawnPoint == scope.required then
            scope.pointUsed = true
            return scope.point
        end
        return base(nativeRoom, enemy, encounter, ...)
    end)

    module.hooks.wrap("GetRandomValue", "run-planner-arachne-reward", function(_, _, base, values, ...)
        local scope = scopes[threadKey()]
        if scope and scope.spawned and not scope.spawning and not scope.rewardUsed
            and values == scope.nativeRoom.CoocoonIds then
            scope.rewardUsed = true
            for _, id in ipairs(values) do
                local object = _G.MapState and _G.MapState.ActiveObstacles and _G.MapState.ActiveObstacles[id]
                if object and object.ObjectId == id and object.OccupyingSpawnPointId == scope.point then return id end
            end
            diagnostic(session, scope.state, scope.phase,
                { reason = "target-not-spawned", requested = scope.point }, true)
        end
        return base(values, ...)
    end)

    module.hooks.wrap("SetupArachneCombatEncounter", "run-planner-arachne-cocoon-count", function(_, runtime,
        base, eventSource, args)
        local key = threadKey()
        local prior = scopes[key]
        local active
        local state = getState(runtime)
        local phase, count, point = selected(state, room, eventSource)
        local source = type(eventSource) == "table" and eventSource or {}
        local nativeArgs = type(args) == "table" and args or {}
        local scoped = args
        local minimum = nativeArgs.CocoonCountMin or source.CocoonCountMin
        local maximum = nativeArgs.CocoonCountMax or source.CocoonCountMax
        if count then
            if type(minimum) ~= "number" or type(maximum) ~= "number"
                or count.count < minimum or count.count > maximum then
                diagnostic(session, state, phase, {
                    reason = "outside-native-range", requested = count.count, minimum = minimum, maximum = maximum,
                })
                count = nil
            else
                scoped = copy(nativeArgs)
                scoped.CocoonCountMin, scoped.CocoonCountMax = count.count, count.count
            end
        end
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        if point then
            if admits(nativeRoom, nativeArgs, point.spawnPointId) then
                active = { source = eventSource, args = scoped, nativeRoom = nativeRoom,
                    point = point.spawnPointId, phase = phase, state = state, required = nativeArgs.RequiredSpawnPointType }
            else
                diagnostic(session, state, phase, { reason = "point-unavailable", requested = point.spawnPointId }, true)
            end
        end
        scopes[key] = active
        local result = table.pack(pcall(base, eventSource, scoped))
        scopes[key] = prior
        local placed = nativeRoom and type(nativeRoom.CoocoonIds) == "table" and #nativeRoom.CoocoonIds or 0
        if not result[1] then
            if count or point then
                diagnostic(session, state, phase, {
                    reason = "setup-error", requested = count and count.count or point.spawnPointId,
                    placed = placed, error = tostring(result[2]),
                }, count == nil)
            end
            error(result[2], 0)
        end
        if count and placed < count.count then
            diagnostic(session, state, phase, { reason = "placement-shortfall", requested = count.count, placed = placed })
        end
        return table.unpack(result, 2, result.n)
    end)
end

return arachne
