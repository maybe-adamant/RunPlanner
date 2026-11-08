-- Mourning Fields realization. Native code remains responsible for creating
-- cages, optional rewards, and encounters; this adapter only steers the
-- published point and reward choices for the active Fields room. A slot
-- without a published point draws natively from its pool without the planned
-- points, so native never takes a planned point.
local rerolls = type(import) == "function" and import("mods/navigation/rerolls.lua")
    or require("mods.navigation.rerolls")
local placement = type(import) == "function" and import("mods/room/features/placement.lua")
    or require("mods.room.features.placement")
local fields = {}

-- Planned points by one-based slot rank ("cage2" -> 2) and their reserved set.
local function cageSlots(layout)
    local byRank, reserved = {}, {}
    for _, cage in ipairs(layout.cagePoints or {}) do
        local rank = tonumber(string.match(cage.slotKey or "", "(%d+)$"))
        if rank ~= nil then byRank[rank] = cage.pointId end
        reserved[cage.pointId] = true
    end
    return byRank, reserved
end

local function optionalSlots(layout)
    local byIndex, reserved = {}, {}
    for index, optional in ipairs(layout.optionalRewards or {}) do
        if optional.pointId ~= nil then
            byIndex[index] = optional.pointId
            reserved[optional.pointId] = true
        end
    end
    if layout.nemesisPointId ~= nil then reserved[layout.nemesisPointId] = true end
    return byIndex, reserved
end

local function copyArgs(args)
    local result = {}
    for key, value in pairs(type(args) == "table" and args or {}) do result[key] = value end
    return result
end

local function scalar(value)
    local kind = type(value)
    if kind == "string" or kind == "number" or kind == "boolean" then return value end
    return nil
end

local function point(id, getLocation)
    local result = { id = scalar(id) }
    if result.id ~= nil then
        local location = getLocation({ Id = result.id })
        if type(location) == "table" then
            result.location = { X = scalar(location.X), Y = scalar(location.Y), Z = scalar(location.Z) }
        end
    end
    return result
end

local function reward(value)
    if type(value) ~= "table" then return { name = scalar(value) } end
    return {
        rewardType = scalar(value.rewardType or value.RewardType),
        source = scalar(value.source or value.ForceLootName),
        name = scalar(value.Name or value.LootName),
    }
end

local function object(id, value, getLocation)
    if type(value) ~= "table" then
        local objectId = scalar(id)
        return objectId ~= nil and { objectId = objectId } or nil
    end
    local objectId = scalar(value.ObjectId) or scalar(id)
    local result = {
        objectId = objectId,
        name = scalar(value.Name),
        spawnPointId = scalar(value.SpawnPointId),
        rewardId = scalar(value.RewardId),
    }
    if objectId ~= nil then result.location = point(objectId, getLocation).location end
    return result
end

local function sortedObjects(values, predicate, getLocation)
    local result = {}
    for id, value in pairs(values or {}) do
        if type(value) == "table" and predicate(value) then
            result[#result + 1] = object(id, value, getLocation)
        end
    end
    table.sort(result, function(left, right) return tostring(left.objectId) < tostring(right.objectId) end)
    return result
end

local function encounterName(value)
    return type(value) == "table" and (value.GenusName or value.Name) or value
end

-- Each planned slot's point holds that slot's object: the cage of its
-- CageRewards entry, or an optional reward. Unplanned slots are not checked.
local function unplacedSlots(layout, nativeRoom, activeObstacles)
    local cagesAt = {}
    for _, value in pairs(activeObstacles or {}) do
        if type(value) == "table" and value.Name == "FieldsRewardCage" and value.SpawnPointId ~= nil then
            cagesAt[value.SpawnPointId] = value
        end
    end
    local result = {}
    for _, cage in ipairs(layout.cagePoints or {}) do
        local rank = tonumber(string.match(cage.slotKey or "", "(%d+)$"))
        local planned = rank and type(nativeRoom.CageRewards) == "table" and nativeRoom.CageRewards[rank] or nil
        local observed = cagesAt[cage.pointId]
        local wanted = type(planned) == "table" and encounterName(planned.Encounter) or nil
        if observed == nil or (wanted ~= nil and encounterName(observed.Encounter) ~= wanted) then
            result[#result + 1] = { slotKey = cage.slotKey, pointId = cage.pointId,
                observed = observed and encounterName(observed.Encounter) or nil }
        end
    end
    local restoredAt = {}
    local restores = type(nativeRoom.Encounter) == "table" and nativeRoom.Encounter.RewardsToRestore or {}
    for _, restore in pairs(restores) do
        if type(restore) == "table" and restore.SpawnRewardOnId ~= nil then restoredAt[restore.SpawnRewardOnId] = true end
    end
    for _, optional in ipairs(layout.optionalRewards or {}) do
        if optional.pointId ~= nil and not restoredAt[optional.pointId] then
            result[#result + 1] = { slotKey = optional.slotKey, pointId = optional.pointId }
        end
    end
    return result
end

local function completedSnapshot(occurrence, nativeRoom, context)
    local layout = occurrence.overview.fields
    local getLocation = context.getLocation
    local priorRewards = context.cageRewards or {}
    local plannedCages, plannedOptional = {}, {}
    for _, cage in ipairs(layout.cagePoints or {}) do
        local rank = tonumber(string.match(cage.slotKey or "", "(%d+)$"))
        plannedCages[#plannedCages + 1] = {
            slotKey = scalar(cage.slotKey), point = point(cage.pointId, getLocation),
            reward = reward(rank and priorRewards[rank]),
        }
    end
    for _, optional in ipairs(layout.optionalRewards or {}) do
        plannedOptional[#plannedOptional + 1] = {
            slotKey = scalar(optional.slotKey), point = point(optional.pointId, getLocation), reward = reward(optional.reward),
        }
    end
    local optional = sortedObjects(context.optionalRewards, function() return true end, getLocation)
    local restores = type(nativeRoom.Encounter) == "table" and nativeRoom.Encounter.RewardsToRestore or {}
    for _, observed in ipairs(optional) do
        local restore = restores[observed.objectId]
        if type(restore) == "table" then
            observed.restore = {
                rewardType = scalar(restore.RewardOverride), spawnPointId = scalar(restore.SpawnRewardOnId),
            }
        end
    end
    local cages = sortedObjects(context.activeObstacles, function(value)
        return value.Name == "FieldsRewardCage"
    end, getLocation)
    for _, cage in ipairs(cages) do
        local nativeReward = (context.lootObjects and context.lootObjects[cage.rewardId])
            or (context.activeObstacles and context.activeObstacles[cage.rewardId])
        cage.reward = object(cage.rewardId, nativeReward, getLocation)
    end
    local nemesis = context.sessionMapState and context.sessionMapState.Nemesis
    local entry = occurrence.overview.layout and occurrence.overview.layout.entry
    return {
        planned = {
            entryPair = {
                startPoint = point(entry and entry.startPointId, getLocation),
                endPoint = point(entry and entry.endPointId, getLocation),
            },
            cages = plannedCages, optionalRewards = plannedOptional,
            nemesisPoint = point(layout.nemesisPointId, getLocation),
        },
        observed = {
            entryPair = {
                startPoint = point(nativeRoom.HeroStartPoint, getLocation),
                endPoint = point(nativeRoom.HeroEndPoint, getLocation),
            },
            cages = cages,
            optionalRewards = optional,
            nemesis = object(nemesis and nemesis.ObjectId, nemesis, getLocation),
        },
    }
end

function fields.attach(module, session, getState, report, room)
    local active
    local activeNemesis

    local function currentLayout(state, nativeRoom)
        if state == nil or state.state ~= "synchronized" then return nil end
        local current = room.current(state)
        local occurrence = current and current.occurrence
        if occurrence == nil or type(occurrence.overview) ~= "table" then return nil end
        local id = type(nativeRoom) == "table" and nativeRoom.__runPlannerExecutionRoomId or nil
        if id ~= nil and id ~= occurrence.id then return nil end
        return occurrence.overview.fields
    end

    local function currentOccurrence(state, nativeRoom)
        if currentLayout(state, nativeRoom) == nil then return nil end
        local current = room.current(state)
        return current and current.occurrence
    end

    local function cageRewards(state, occurrence)
        local prior = state and state.route and state.route.lastExitedOccurrence
        for _, target in ipairs(prior and prior.doors and prior.doors.targets or {}) do
            if target.room and target.room.id == occurrence.id then return rerolls.cageRewards(prior, target) end
        end
        return nil
    end

    -- SpawnRewardCages draws every cage from its LootPoint pool, then every
    -- optional reward from its BonusRewardSpawnPoints pool; other draws pass.
    local function pool(scope, values)
        if values == scope.cagePool or values == scope.optionalPool then return values end
        if scope.cagePool == nil and placement.within(values, scope.cagePoints) then
            scope.cagePool = values
        elseif scope.optionalPool == nil and scope.cagePool ~= nil and placement.within(values, scope.optionalPoints) then
            scope.optionalPool = values
        end
        return (values == scope.cagePool or values == scope.optionalPool) and values or nil
    end

    module.hooks.wrap("RemoveRandomValue", "run-planner-fields-point-selection", function(_, runtime, base,
        values, ...)
        local scope = active
        if scope == nil or type(values) ~= "table" or pool(scope, values) == nil then return base(values, ...) end
        local wanted, reserved
        if values == scope.cagePool then
            scope.cageDraws = scope.cageDraws + 1
            wanted, reserved = scope.cageByRank[scope.cageDraws], scope.cageReserved
        else
            scope.optionalDraws = scope.optionalDraws + 1
            wanted, reserved = scope.optionalByIndex[scope.optionalDraws], scope.optionalReserved
        end
        if wanted ~= nil then
            reserved[wanted] = nil
            local taken = placement.take(values, wanted)
            if taken ~= nil then return taken end
            session.diagnostic(getState(runtime), "fields-point", { expected = wanted, observed = nil })
        end
        return placement.drawExcluding(base, values, reserved, ...)
    end)

    module.hooks.wrap("RandomChance", "run-planner-fields-optional-count", function(_, _runtime, base,
        chance, args, ...)
        local scope = active
        local chanceIndex = scope and scope.chanceIndex + 1 or nil
        local expectedChance = chanceIndex and scope.chances[chanceIndex] or nil
        if expectedChance == nil or chance ~= expectedChance then return base(chance, args, ...) end
        scope.chanceIndex = chanceIndex
        scope.optionalChanceResults = scope.optionalChanceResults + 1
        return scope.optionalChanceResults <= #scope.optionalRewards
    end)

    module.hooks.wrap("IsRoomRewardEligible", "run-planner-fields-optional-reward", function(_, _runtime,
        base, run, nativeRoom, candidate, previouslyChosen, args)
        local scope = active
        local expected = scope and scope.expectedReward
        if expected ~= nil and type(candidate) == "table" then
            return (candidate.Name or candidate.RewardType) == expected.reward.rewardType
        end
        return base(run, nativeRoom, candidate, previouslyChosen, args)
    end)

    module.hooks.wrap("ChooseRoomReward", "run-planner-fields-optional-choice", function(_, runtime, base,
        run, nativeRoom, rewardStore, chosen, args)
        local scope = active
        if scope == nil or rewardStore ~= scope.bonusRewardStore then
            return base(run, nativeRoom, rewardStore, chosen, args)
        end
        local expected = scope.optionalRewards[scope.rewardIndex + 1]
        if expected == nil then return base(run, nativeRoom, rewardStore, chosen, args) end
        scope.rewardIndex = scope.rewardIndex + 1
        scope.pendingReward = expected
        local prior = scope.expectedReward
        scope.expectedReward = expected
        local ok, result = pcall(base, run, nativeRoom, rewardStore, chosen, args)
        scope.expectedReward = prior
        if not ok then
            scope.pendingReward = nil
            error(result, 0)
        end
        local observed = type(result) == "table" and (result.Name or result.RewardType) or result
        if observed ~= expected.reward.rewardType then
            session.diagnostic(runtime and getState(runtime), "fields-optional-reward", {
                expected = expected.reward.rewardType, observed = observed,
            })
        end
        return result
    end)

    module.hooks.wrap("SpawnRoomReward", "run-planner-fields-optional-spawn", function(_, _, base,
        eventSource, args)
        local scope = active
        local expected = scope and scope.pendingReward
        local forcedArgs = args
        if expected ~= nil and expected.reward.source ~= nil then
            forcedArgs = copyArgs(args)
            forcedArgs.LootName = expected.reward.source
        end
        local ok, result = pcall(base, eventSource, forcedArgs)
        if scope ~= nil and expected ~= nil then scope.pendingReward = nil end
        if not ok then error(result, 0) end
        return result
    end)

    module.hooks.wrap("SpawnRewardCages", "run-planner-fields-spawn", function(_, runtime, base, nativeRoom,
        args)
        local state = getState(runtime)
        local layout = currentLayout(state, nativeRoom)
        if layout == nil then return base(nativeRoom, args) end
        local cageByRank, cageReserved = cageSlots(layout)
        local optionalByIndex, optionalReserved = optionalSlots(layout)
        local scope = {
            optionalRewards = layout.optionalRewards or {},
            cageByRank = cageByRank, cageReserved = cageReserved,
            optionalByIndex = optionalByIndex, optionalReserved = optionalReserved,
            cagePoints = placement.set(_G.GetIdsByType and _G.GetIdsByType({ Name = "LootPoint" })),
            optionalPoints = placement.set(_G.GetIds and _G.GetIds({ Name = "BonusRewardSpawnPoints" })),
            cageDraws = 0,
            optionalDraws = 0,
            chances = type(nativeRoom) == "table" and nativeRoom.OptionalRewardChances or {},
            chanceIndex = 0,
            optionalChanceResults = 0,
            rewardIndex = 0,
            pendingReward = nil,
            bonusRewardStore = type(nativeRoom) == "table" and nativeRoom.BonusRewardStoreName or nil,
        }
        local prior = active
        active = scope
        local ok, result = pcall(base, nativeRoom, args)
        active = prior
        if not ok then error(result, 0) end
        if scope.rewardIndex ~= #scope.optionalRewards then
            session.diagnostic(state, "fields-spawn", {
                expected = { optionalRewards = #scope.optionalRewards },
                observed = { optionalRewards = scope.rewardIndex },
            })
        end
        report(runtime)
        return result
    end)

    module.hooks.wrap("SpawnNemesisForRandomEvents", "run-planner-fields-nemesis-scope", function(_, runtime,
        base, source, args)
        local state = getState(runtime)
        local layout = currentLayout(state, _G.CurrentRun and _G.CurrentRun.CurrentRoom)
        if layout == nil or layout.nemesisPointId == nil then return base(source, args) end
        local prior = activeNemesis
        activeNemesis = { pointId = layout.nemesisPointId, used = false }
        local ok, result = pcall(base, source, args)
        local used = activeNemesis.used
        activeNemesis = prior
        if not ok then error(result, 0) end
        if not used then
            session.diagnostic(state, "fields-nemesis-point", {
                expected = layout.nemesisPointId, observed = nil,
            })
        end
        report(runtime)
        return result
    end)

    module.hooks.wrap("SelectSpawnPoint", "run-planner-fields-nemesis-point", function(_, _runtime, base,
        currentRoom, unit, source, args, depth)
        local scope = activeNemesis
        if scope == nil or scope.pointId == nil then
            return base(currentRoom, unit, source, args, depth)
        end
        if scope.used then return base(currentRoom, unit, source, args, depth) end
        scope.used = true
        return scope.pointId
    end)

    module.hooks.wrap("StartRoomPresentation", "run-planner-fields-completed-product", function(_, runtime,
        base, currentRun, nativeRoom, ...)
        local state = getState(runtime)
        local occurrence = currentOccurrence(state, nativeRoom)
        if occurrence ~= nil then
            local unplaced = unplacedSlots(occurrence.overview.fields, nativeRoom,
                _G.MapState and _G.MapState.ActiveObstacles)
            if #unplaced > 0 then session.diagnostic(state, "fields-placement", unplaced) end
            session.diagnostic(state, "fields-completed-product", completedSnapshot(occurrence, nativeRoom, {
                cageRewards = cageRewards(state, occurrence),
                activeObstacles = _G.MapState and _G.MapState.ActiveObstacles,
                optionalRewards = _G.MapState and _G.MapState.OptionalRewards,
                lootObjects = _G.LootObjects,
                sessionMapState = _G.SessionMapState,
                getLocation = _G.GetLocation,
            }))
            report(runtime)
        end
        return base(currentRun, nativeRoom, ...)
    end)
end

return fields
