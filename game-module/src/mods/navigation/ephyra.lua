-- Native Ephyra Hub and side-door adaptation. The planner owns the complete
-- board; this module only binds that product to native physical doors.
local nativeBindings = type(import) == "function" and import("mods/native_bindings.lua")
    or require("mods.native_bindings")
local ephyra = {}

local function copy(value, seen)
    if type(value) ~= "table" then return value end
    seen = seen or {}
    if seen[value] then return seen[value] end
    local result = {}
    seen[value] = result
    for key, item in pairs(value) do result[copy(key, seen)] = copy(item, seen) end
    return result
end

local function roomName(value)
    return type(value) == "table" and (value.GenusName or value.Name) or nil
end

local function rewardName(value)
    return type(value) == "table" and (value.RewardType or value.Name or value.Reward) or value
end

function ephyra.hubFountainObjectId(nativeRoom)
    return nativeBindings.navigation.hubFountainObjectIds[roomName(nativeRoom)]
end

-- UseHealthFountain records UseableOff; HealthFountainNExitCheck reads the same flag.
function ephyra.hubFountainUsed(nativeRoom)
    local objectId = ephyra.hubFountainObjectId(nativeRoom)
    local states = objectId and type(nativeRoom) == "table" and nativeRoom.ObjectStates or nil
    local objectState = type(states) == "table" and states[objectId] or nil
    return type(objectState) == "table" and objectState.UseableOff == true
end

function ephyra.hub(plan, nativeRoom)
    if roomName(nativeRoom) ~= "N_Hub" then return nil end
    for _, occurrence in pairs(plan and plan.occurrencesById or {}) do
        local hub = occurrence.overview and occurrence.overview.hub
        if hub and hub.room and hub.room.gameName == "N_Hub" then return hub end
    end
end

function ephyra.hubEntry(occurrence)
    local hub = occurrence and occurrence.overview and occurrence.overview.hub
    return hub and hub.room or nil
end

function ephyra.chooseHubEntry(occurrence, args, game)
    local target = ephyra.hubEntry(occurrence)
    if target == nil or type(args) == "table" and args.ForceNextRoomSet ~= nil then return nil end
    local declaration = game and game.RoomData and game.RoomData[target.gameName] or nil
    if declaration == nil then return nil end
    local result = copy(declaration)
    result.GenusName, result.Name = target.gameName, target.gameName
    return result
end

function ephyra.parentForSide(plan, sideId)
    for _, occurrence in pairs(plan and plan.occurrencesById or {}) do
        for _, slot in ipairs(occurrence.overview and occurrence.overview.localSlots or {}) do
            if slot.room and slot.room.id == sideId then return occurrence end
        end
    end
end

function ephyra.occurrenceForNative(state, routeSession, nativeRoom)
    local plan = state and state.plan
    local id = type(nativeRoom) == "table" and nativeRoom.__runPlannerExecutionRoomId or nil
    if id and plan and plan.occurrencesById[id] then return plan.occurrencesById[id] end
    local current = routeSession.current(state and state.route)
    if current and current.gameName == roomName(nativeRoom) then return current end
    local expected = routeSession.expected(state and state.route)
    if expected and expected.gameName == roomName(nativeRoom) then return expected end
    local last = state and state.route and state.route.lastExitedOccurrence
    local parent = last and ephyra.parentForSide(plan, last.id) or nil
    if parent and parent.gameName == roomName(nativeRoom) then return parent end
end

local function hubWasVisited(hub, route)
    local hubIds = {}
    for _, slot in ipairs(hub.slots or {}) do hubIds[slot.room.id] = true end
    local selected = route and route.plan and route.plan.selectedOccurrenceIds or {}
    for index = 1, math.max(0, (route and route.index or 1) - 1) do
        if hubIds[selected[index]] then return true end
    end
    return false
end

function ephyra.scope(plan, occurrence, nativeRoom, game, route)
    local hub = ephyra.hub(plan, nativeRoom)
    local slots = hub and hub.slots or occurrence and occurrence.overview
        and occurrence.overview.localSlots or nil
    if slots == nil then return nil end
    local byDoor = {}
    local plannedDoorIds = {}
    for _, slot in ipairs(slots) do
        plannedDoorIds[slot.physicalDoorId] = true
        if hub ~= nil or slot.generation == "generated" then byDoor[slot.physicalDoorId] = slot end
    end
    local declaredDoorIds = {}
    local declaration = game and game.RoomData and game.RoomData[roomName(nativeRoom)] or nil
    for doorId in pairs(declaration and declaration.PredeterminedDoorRooms or {}) do
        declaredDoorIds[doorId] = true
    end
    return {
        hub = hub,
        slots = slots,
        byDoor = byDoor,
        plannedDoorIds = plannedDoorIds,
        declaredDoorIds = declaredDoorIds,
        initialBoard = hub == nil or not hubWasVisited(hub, route),
    }
end

function ephyra.forceSideAvailability(base, currentRun, source, args, slot)
    currentRun.CurrentRoom.UnavailableDoors = currentRun.CurrentRoom.UnavailableDoors or {}
    if slot.generation == "notGenerated" then
        currentRun.CurrentRoom.UnavailableDoors[source.ObjectId] = true
        return nil
    end
    local forcedArgs = {}
    for key, value in pairs(args or {}) do forcedArgs[key] = value end
    forcedArgs.AboveMinAvailableChance = 1
    return base(source, forcedArgs)
end

function ephyra.bindNativeDoors(scope, nativeDoors)
    for _, door in ipairs(nativeDoors or {}) do
        local slot = scope.byDoor[door.ObjectId]
        if slot ~= nil then
            if scope.hub ~= nil then
                local nativeRoom = door.Room or door.RoomData
                if type(nativeRoom) == "table" then
                    nativeRoom.__runPlannerExecutionRoomId = slot.room.id
                end
            else
                door.ChooseRoomArgs = copy(door.ChooseRoomArgs or {})
                door.ChooseRoomArgs.RunPlannerEphyraDoorId = door.ObjectId
            end
        end
    end
end

-- Stamps each offered board door whose native room is its slot's planned room.
function ephyra.stampSlotDoors(scope, nativeDoors)
    for _, door in ipairs(nativeDoors or {}) do
        local slot = scope.byDoor[door.ObjectId]
        local nativeRoom = door.Room or door.RoomData
        if slot ~= nil and type(nativeRoom) == "table" and roomName(nativeRoom) == slot.room.gameName then
            nativeRoom.__runPlannerExecutionRoomId = slot.room.id
        end
    end
end

function ephyra.chooseSideRoom(scope, args, game)
    local doorId = type(args) == "table" and args.RunPlannerEphyraDoorId or nil
    local slot = doorId and scope and scope.byDoor[doorId] or nil
    local declaration = slot and game and game.RoomData and game.RoomData[slot.room.gameName] or nil
    if declaration == nil then return nil end
    local result = copy(declaration)
    result.GenusName, result.Name = slot.room.gameName, slot.room.gameName
    result.__runPlannerExecutionRoomId = slot.room.id
    return result
end

function ephyra.prove(scope, nativeDoors)
    local byDoor = {}
    local nonBoardDoors = {}
    for _, door in ipairs(nativeDoors or {}) do
        byDoor[door.ObjectId] = door
        if scope.declaredDoorIds[door.ObjectId] == nil then
            nonBoardDoors[#nonBoardDoors + 1] = door
        end
    end
    for doorId in pairs(scope.declaredDoorIds) do
        if byDoor[doorId] ~= nil and scope.plannedDoorIds[doorId] == nil then
            return nil, {
                kind = "ephyraUnexpectedDoor", doorId = doorId,
                expected = false, observed = true,
            }
        end
    end
    for _, slot in ipairs(scope.slots) do
        local expectedPresent = scope.hub ~= nil or slot.generation == "generated"
        local door = byDoor[slot.physicalDoorId]
        if expectedPresent ~= (door ~= nil) then
            return nil, {
                kind = "ephyraDoorAvailability", doorId = slot.physicalDoorId,
                expected = expectedPresent, observed = door ~= nil,
            }
        end
        if expectedPresent then
            local nativeRoom = door.Room or door.RoomData
            if roomName(nativeRoom) ~= slot.room.gameName then
                return nil, {
                    kind = "ephyraDoorRoom", doorId = slot.physicalDoorId,
                    expected = slot.room.gameName, observed = roomName(nativeRoom),
                }
            end
            local observedReward = rewardName(door.RewardType or door.Reward
                or type(nativeRoom) == "table" and
                    (nativeRoom.ChosenRewardType or nativeRoom.RewardType))
            if observedReward ~= slot.reward.rewardType then
                return nil, {
                    kind = "ephyraDoorReward", doorId = slot.physicalDoorId,
                    expected = slot.reward.rewardType, observed = observedReward,
                }
            end
            if slot.reward.source ~= nil and
                (type(nativeRoom) ~= "table" or nativeRoom.ForceLootName ~= slot.reward.source) then
                return nil, {
                    kind = "ephyraDoorRewardSource", doorId = slot.physicalDoorId,
                    expected = slot.reward.source, observed = nativeRoom.ForceLootName,
                }
            end
        end
    end
    if scope.hub ~= nil then
        if #nonBoardDoors ~= 0 then
            return nil, {
                kind = "ephyraUnexpectedDoor", doorId = nonBoardDoors[1].ObjectId,
                expected = false, observed = true,
            }
        end
    end
    return true
end

function ephyra.proveHubEntry(occurrence, nativeDoors)
    local target = ephyra.hubEntry(occurrence)
    if target == nil then return nil end
    if type(nativeDoors) ~= "table" or #nativeDoors ~= 1 then
        return nil, {
            kind = "ephyraHubEntryCount", expected = 1,
            observed = type(nativeDoors) == "table" and #nativeDoors or nil,
        }
    end
    local door = nativeDoors[1]
    local nativeRoom = door and (door.Room or door.RoomData)
    if roomName(nativeRoom) ~= target.gameName then
        return nil, {
            kind = "ephyraHubEntryRoom", expected = target.gameName,
            observed = roomName(nativeRoom),
        }
    end
    return true
end

local function planHub(plan)
    for _, occurrence in pairs(plan and plan.occurrencesById or {}) do
        local hub = occurrence.overview and occurrence.overview.hub
        if hub and hub.room then return hub end
    end
end

local function hubTargets(hub, occurrence)
    if hub.finalHandoff and hub.finalHandoff.id == occurrence.id then return true end
    for _, slot in ipairs(hub.slots or {}) do
        if slot.room and slot.room.id == occurrence.id then return true end
    end
    return false
end

-- Hub slots, side rooms and the final handoff are reached only through the board's own doors.
function ephyra.onBoard(plan, occurrence)
    local hub = planHub(plan)
    if hub ~= nil and hubTargets(hub, occurrence) then return true end
    return ephyra.parentForSide(plan, occurrence.id) ~= nil
end

-- The Hub room a return door re-enters, built as AttemptUseDoor builds it (RoomLogic.lua:843-857).
local function returnRoom(currentRun, name, game)
    local history = currentRun and currentRun.RoomHistory or {}
    for index = #history, 1, -1 do
        local previous = history[index]
        if previous.Name == name then
            local result = {}
            for key, value in pairs(previous) do result[key] = value end
            for key, value in pairs(game and game.RoomData and game.RoomData[name] or {}) do
                if result[key] == nil then result[key] = value end
            end
            result.TimesVisited = (result.TimesVisited or 0) + 1
            return result
        end
    end
end

local function stampedTarget(door)
    local nativeRoom = door.Room or door.RoomData
    return door.__runPlannerExecutionDoorTarget
        or type(nativeRoom) == "table" and nativeRoom.__runPlannerExecutionRoomId or nil
end

-- The board's exit from the Hub or a main room towards `target`: nil off the board,
-- else { door, enters, room } with the offered door (nil when none) and whether it enters `target`.
-- stampedOnly enters a Hub slot only through a door steered for it, never an
-- unsteered native one; a main room's side door is rebuilt instead (rebuild), and
-- its return to the Hub needs no steering. localSlot marks a planned side room.
function ephyra.exit(plan, nativeRoomName, target, offered, currentRun, game, stampedOnly)
    local hub = planHub(plan)
    if hub == nil or nativeRoomName == nil then return nil end
    local main
    if nativeRoomName ~= hub.room.gameName then
        for _, slot in ipairs(hub.slots or {}) do
            if slot.room and slot.room.gameName == nativeRoomName then
                main = plan.occurrencesById[slot.room.id] or { overview = {} }
            end
        end
        if main == nil then return nil end
    end
    local result = {}
    if target == nil then return result end
    offered = offered or {}
    for _, door in pairs(offered) do
        if stampedTarget(door) == target.id then
            result.door, result.enters, result.localSlot = door, true, main ~= nil or nil
            return result
        end
    end
    if stampedOnly and main == nil then return result end
    if main == nil then
        for _, slot in ipairs(hub.slots or {}) do
            if slot.room and slot.room.id == target.id then
                result.door = offered[slot.physicalDoorId]
                result.enters = result.door ~= nil
                return result
            end
        end
        if hub.finalHandoff and hub.finalHandoff.id == target.id then
            for _, door in pairs(offered) do
                if roomName(door.Room) == target.gameName then result.door, result.enters = door, true end
            end
        end
        return result
    end
    for _, slot in ipairs(main.overview and main.overview.localSlots or {}) do
        if slot.room and slot.room.id == target.id then
            result.door, result.localSlot = offered[slot.physicalDoorId], true
            result.enters = result.door ~= nil
            -- A side room is a fresh room: an unsteered side door is rebuilt for its target.
            result.rebuild = stampedOnly and result.enters or nil
            return result
        end
    end
    if hubTargets(hub, target) then
        for _, door in pairs(offered) do
            if door.ReturnToPreviousRoomName == hub.room.gameName then
                result.room = returnRoom(currentRun, hub.room.gameName, game)
                if result.room ~= nil then result.door = door end
            end
        end
    end
    return result
end

-- The door taken from the Hub or a main room instead of the offered planned door; nil otherwise.
function ephyra.stray(plan, nativeRoomName, expected, door, offered, currentRun, game)
    local exit = expected and ephyra.exit(plan, nativeRoomName, expected, offered, currentRun, game)
    local planned = exit and exit.door
    if planned == nil or type(door) ~= "table" or planned == door
        or (door.ObjectId ~= nil and door.ObjectId == planned.ObjectId) then return nil end
    return stampedTarget(door) or roomName(door.Room) or door.ObjectId
end

-- Leaves through the planned door instead of the taken one: undoes what AttemptUseDoor
-- recorded for the taken door (RoomLogic.lua:862-869) and records the planned one.
function ephyra.substitute(currentRun, taken, exit, game)
    local planned, current = exit.door, currentRun.CurrentRoom
    local declaration = game and game.RoomData and game.RoomData[current.Name] or current
    local onUse = declaration.OnUseSetRunData or {}
    for key in pairs(onUse[taken.Name] or {}) do current[key] = nil end
    if taken.CloseOnReturnAnimation ~= nil then current.CloseDoorOnReturn = nil end
    if planned.CloseOnReturnAnimation ~= nil then current.CloseDoorOnReturn = planned.ObjectId end
    _G.OverwriteTableKeys(current, onUse[planned.Name])
    if exit.room ~= nil then planned.Room = exit.room end
    -- HandleSubRoomData stored the return entrance nearest the taken door; the return re-enters at the planned one.
    if exit.localSlot and planned ~= taken then
        local function nearest(kind)
            return _G.GetClosest({ Id = planned.ObjectId, DestinationIds = _G.GetIdsByType({ Name = kind }) })
        end
        current.HeroStartPoint, current.HeroEndPoint = nearest("HeroStart"), nearest("HeroEnd")
    end
    return planned
end

function ephyra.finalHandoff(state, routeSession, nativeRoomData)
    local currentRun = _G.CurrentRun
    local hub = ephyra.hub(state and state.plan, currentRun and currentRun.CurrentRoom)
    local expected = routeSession.expected(state and state.route)
    if hub == nil or expected == nil or expected.id ~= hub.finalHandoff.id
        or expected.gameName ~= hub.finalHandoff.gameName
        or roomName(nativeRoomData) ~= expected.gameName then return nil end
    return expected
end

return ephyra
