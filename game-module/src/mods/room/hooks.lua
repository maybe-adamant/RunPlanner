-- Route/room handshake and current-room lifecycle contacts.
local snapMode = type(import) == "function" and import("mods/snap/mode.lua") or require("mods.snap.mode")
local doors = type(import) == "function" and import("mods/navigation/doors.lua")
    or require("mods.navigation.doors")
local ephyra = type(import) == "function" and import("mods/navigation/ephyra.lua")
    or require("mods.navigation.ephyra")

local hooks = {}

local function roomName(value)
    return type(value) == "table" and (value.GenusName or value.Name) or nil
end

local function reportOutcome(session, state, errorValue)
    if type(errorValue) == "table" and errorValue.outcome == "fault" then
        return session.fault(state, errorValue)
    end
    return session.mismatch(state, errorValue)
end

-- snapScope: { enabled(runtime), correct, differences, log, hexTree } for snap mode; nil leaves it off.
function hooks.attach(module, session, getState, report, route, room, featureScope, navigation, loadoutScope,
    practiceScope, snapScope)
    assert(type(loadoutScope) == "table"
        and type(loadoutScope.synchronizeStartingRoom) == "function"
        and type(loadoutScope.startingRun) == "function"
        and type(loadoutScope.installedRun) == "function",
        "starting-room loadout scope is required")

    -- The planned Dream opening CreateRoom realizes for an out-of-sync snap.
    local plannedCreation
    -- A substituted Ephyra door { planned, taken } while native LeaveRoom runs.
    local exitWalk

    -- Writes the plan's hero state for the room being left before native LeaveRoom;
    -- nil when the correction failed and snapping stopped.
    local function correctHero(state, frame, owner)
        local ok, outcome, detail = pcall(snapScope.correct, frame, {
            hexTree = snapScope.hexTree,
            diagnostic = function(checkpoint, expected, observed)
                session.diagnostic(state, checkpoint, { expected = expected, observed = observed })
            end,
        })
        if not ok then
            session.stopSnapping(state, { outcome = "fault", checkpoint = "snap-apply", expected = owner,
                observed = tostring(outcome) })
            return nil
        end
        if outcome == nil then session.stopSnapping(state, detail); return nil end
        return outcome, detail
    end

    -- An exit that passed its conformance still agrees with the full exit frame;
    -- any difference is a design issue, logged and never written.
    local function reportDisagreement(state, nativeRoom, frame)
        local found = snapScope.differences(frame)
        if #found == 0 or snapScope.log == nil then return end
        local families, paths = {}, {}
        for _, difference in ipairs(found) do
            families[#families + 1] = difference.family
            for _, path in ipairs(difference.paths) do paths[#paths + 1] = path end
        end
        snapScope.log("[RunPlanner] conformance/snap disagreement room=" .. tostring(roomName(nativeRoom))
            .. " slot=" .. tostring(state.planSlot) .. " families=" .. table.concat(families, ",")
            .. " paths=" .. table.concat(paths, "; "))
    end

    -- Snap mode at an exit after the room's own checks: a synchronized exit writes
    -- nothing. A desynchronized one corrects the hero to the room's exit frame and
    -- resumes at the planned next occurrence through the planned door: the offered
    -- board door in Ephyra, the native return from a side room, else the door's
    -- own room when it was prepared for that occurrence, else the room the planned
    -- door would have offered, built and created as ChooseStartingRoom does.
    -- Returns the door LeaveRoom leaves through.
    local function snapExit(runtime, state, currentRun, door, inSync)
        exitWalk = nil
        if snapScope == nil or not snapScope.enabled(runtime) or not snapMode.armed(state) then return door end
        local gameValue = _G.game or game
        local nativeRoom = currentRun and currentRun.CurrentRoom
        local decision = { leaving = state.route.lastExitedOccurrence }
        if state.state == "desynchronized" then
            decision = snapMode.target(state, roomName(nativeRoom), {
                door = door, offered = _G.MapState and _G.MapState.OfferedExitDoors, currentRun = currentRun,
                game = gameValue, inSync = inSync,
            })
        end
        local leaving = decision.leaving
        local frame = snapMode.frame(state, nativeRoom, leaving, decision.index)
        if state.state == "synchronized" then
            if frame ~= nil then reportDisagreement(state, nativeRoom, frame) end
            return door
        end
        if frame ~= nil and correctHero(state, frame, leaving and leaving.id or roomName(nativeRoom)) == nil then
            report(runtime)
            return door
        end
        local target, way = decision.target, decision.way
        if target == nil then report(runtime); return door end
        local mismatch = state.firstMismatch
        if way.door ~= nil then
            local taken = door
            door = ephyra.substitute(currentRun, door, way, gameValue)
            if taken ~= door then exitWalk = { planned = door, taken = taken } end
        end
        if not session.resync(state, decision.index, leaving) then report(runtime); return door end
        -- The planned room is entered with its planned reroll pool.
        if target.rerollPoolAtEntry ~= nil and type(currentRun) == "table" then
            currentRun.NumRerolls = math.max(0, target.rerollPoolAtEntry)
        end
        if way.kind == "room" or (way.kind == "board" and way.enters) then room.prepare(state, target) end
        local rebuild = way.rebuild
            or way.kind == "room" and type(door) == "table" and not navigation.doorTargets(door, target.id)
        if rebuild then
            local data = navigation.plannedRoom(state.plan, decision.index, gameValue)
                or room.realize(state, target, gameValue)
            if data ~= nil then data = navigation.realizeIncomingReward(target, data) end
            local createRoom = gameValue and gameValue.CreateRoom or _G.CreateRoom
            if type(data) == "table" and type(createRoom) == "function" and type(door) == "table" then
                door.Room = createRoom(data)
            end
        end
        session.recordSnap(state, { occurrenceId = target.id, mismatch = mismatch })
        report(runtime)
        return door
    end

    local function boardStray(state, nativeRoomName, door, currentRun)
        local expected = route.expected(state.route)
        return ephyra.stray(state.plan, nativeRoomName, expected, door,
            _G.MapState and _G.MapState.OfferedExitDoors, currentRun, _G.game or game), expected
    end

    module.hooks.wrap("ChooseStartingRoom", "run-planner-starting-room", function(_, runtime, base, currentRun,
        args)
        local state = getState(runtime)
        if state == nil then return base(currentRun, args) end
        local dreamEntry = (state.state == "synchronized" or state.state == "desynchronized")
            and state.plan ~= nil and state.plan.routeKey == "Dream"
            and type(args) == "table" and args.StartingBiome ~= nil
            and currentRun and currentRun.IsDreamRun == true
        local enteringDreamBiome = dreamEntry and state.state == "synchronized"
        -- Snap mode steers an out-of-sync Dream exit to the planned opening; its LeaveRoom resynchronizes.
        local snapOpening = dreamEntry and state.state == "desynchronized" and snapScope ~= nil
            and snapScope.enabled(runtime) and snapMode.armed(state)
            and snapMode.plannedNext(state, roomName(currentRun.CurrentRoom)) or nil
        if snapOpening ~= nil then
            local gameValue = _G.game or game
            local data = room.realize(state, snapOpening, gameValue)
            if data ~= nil then data = navigation.realizeIncomingReward(snapOpening, data) end
            local createRoom = gameValue and gameValue.CreateRoom or _G.CreateRoom
            if type(data) ~= "table" or type(createRoom) ~= "function" then
                report(runtime)
                return base(currentRun, args)
            end
            plannedCreation = snapOpening
            local ok, value = pcall(createRoom, data, args)
            plannedCreation = nil
            if not ok then error(value, 0) end
            report(runtime)
            return value
        end
        if state.state ~= "starting" and not enteringDreamBiome then
            report(runtime)
            return base(currentRun, args)
        end
        if state.state == "starting" and not loadoutScope.synchronizeStartingRoom(runtime, args) then
            report(runtime)
            return base(currentRun, args)
        end
        -- A Dream plan ending at its Postboss has no next occurrence; native picks the room.
        local occurrence
        if enteringDreamBiome then
            occurrence = route.next(state.route)
        else
            occurrence = route.expected(state.route)
        end
        if occurrence == nil or room.prepare(state, occurrence) == nil
            or state.state ~= "synchronized" then
            report(runtime)
            return base(currentRun, args)
        end
        local gameValue = _G.game or game
        local data = occurrence and room.realize(state, occurrence, gameValue) or nil
        if data ~= nil then data = navigation.realizeIncomingReward(occurrence, data) end
        if type(data) == "table" then
            local createRoom = gameValue.CreateRoom or _G.CreateRoom
            if type(createRoom) ~= "function" then
                session.fault(state, {
                    outcome = "fault", checkpoint = "native-api", expected = "CreateRoom", observed = "missing",
                })
                report(runtime)
                return base(currentRun, args)
            end
            local value = createRoom(data, args)
            report(runtime)
            return value
        end
        report(runtime)
        return base(currentRun, args)
    end)

    module.hooks.wrap("CreateRoom", "run-planner-create-room", function(_, runtime, base, roomData, args)
        local state = getState(runtime)
        -- StartNewGame's StartNewRun(nil, { RoomName }) creates the opening
        -- directly, bypassing ChooseStartingRoom, and so does a Practice mode
        -- start, which is already synchronized.
        local opening
        local practice = state ~= nil and state.state == "synchronized" and practiceScope ~= nil
            and practiceScope.creatingStartRoom(state, args)
        if state ~= nil and (state.state == "starting" or practice) and loadoutScope.startingRun()
            and type(args) == "table" and args.RoomName ~= nil then
            local expected = route.expected(state.route)
            if expected ~= nil and args.RoomName == expected.gameName then
                if (not practice and not loadoutScope.synchronizeStartingRoom(runtime, args))
                    or room.prepare(state, expected) == nil or state.state ~= "synchronized" then
                    report(runtime)
                    return base(roomData, args)
                end
                opening = expected
            end
        end
        local planned = plannedCreation
        if state == nil or (state.state ~= "synchronized" and planned == nil) then return base(roomData, args) end
        local additional = planned == nil and featureScope and featureScope.currentAdditional() or nil
        local id = type(roomData) == "table" and roomData.__runPlannerExecutionRoomId or nil
        local occurrence = opening or planned
            or id and state.plan.occurrencesById[id]
            or additional and additional.occurrence
            or navigation.resolveNativeRoom and navigation.resolveNativeRoom(state, roomData)
        if occurrence ~= nil then
            local realized = room.realize(state, occurrence, _G.game or game, roomData)
            if type(realized) == "table" then
                roomData = navigation.realizeIncomingReward(occurrence, realized)
                if additional ~= nil then
                    roomData = navigation.bindAdditionalRoom(roomData, additional.additional)
                end
            end
        end
        local result = base(roomData, args)
        navigation.applyZagreusContractPresence(roomData, result)
        if type(result) == "table" and occurrence ~= nil then
            room.realizeFeatures(state, occurrence, result)
            result.__runPlannerExecutionRoomId = occurrence.id
            local binding = additional and additional.additional or nil
            if binding == nil and type(roomData) == "table"
                and roomData.__runPlannerExecutionAdditionalOwner ~= nil then
                binding = {
                    owner = roomData.__runPlannerExecutionAdditionalOwner,
                    kind = roomData.__runPlannerExecutionAdditionalKind,
                }
            end
            if binding ~= nil then navigation.bindAdditionalRoom(result, binding) end
        end
        report(runtime)
        return result
    end)

    module.hooks.wrap("StartRoom", "run-planner-room-entry", function(_, runtime, base, currentRun, nativeRoom)
        local state = getState(runtime)
        if state == nil then return base(currentRun, nativeRoom) end
        local liveRun = type(currentRun) == "table" and currentRun or _G.CurrentRun
        if currentRun == nil then currentRun = liveRun end
        if nativeRoom == nil and type(liveRun) == "table" then nativeRoom = liveRun.CurrentRoom end
        -- A run loaded into a fresh process continues unsteered.
        if loadoutScope.installedRun(liveRun) then session.resumeUnsteered(state) end
        if state.state ~= "synchronized" then report(runtime); return base(currentRun, nativeRoom) end
        local expected = route.expected(state.route)
        local id = type(nativeRoom) == "table" and nativeRoom.__runPlannerExecutionRoomId or nil
        if route.enterTransparent and route.enterTransparent(state.route, roomName(nativeRoom)) then
            return base(currentRun, nativeRoom)
        end
        if id == nil and expected and roomName(nativeRoom) == expected.gameName then id = expected.id end
        -- Native room restoration can discard planner-private fields. Once the
        -- route cursor has resolved the exact occurrence by game name, restore
        -- its identity before any native room lifecycle runs. Peripheral hooks
        -- such as auto-harvest then consult the same occurrence through exit.
        if type(nativeRoom) == "table" and id ~= nil then
            nativeRoom.__runPlannerExecutionRoomId = id
        end
        local occurrence, errorValue = route.enter(state.route, id, roomName(nativeRoom))
        if occurrence == true then
            state.state, state.reason = "inactive", "configured-prefix-complete"
            report(runtime)
            return base(currentRun, nativeRoom)
        end
        if occurrence == nil then reportOutcome(session, state, errorValue) else room.enter(state, occurrence) end
        -- Every grant and spend before this room is settled by its entry.
        if state.state == "synchronized" and occurrence.rerollPoolAtEntry ~= nil and type(liveRun) == "table"
            and liveRun.NumRerolls ~= occurrence.rerollPoolAtEntry then
            session.mismatch(state, {
                checkpoint = "reroll-pool", expected = occurrence.rerollPoolAtEntry, observed = liveRun.NumRerolls,
            })
        end
        report(runtime)
        if state.state == "synchronized" then room.bindEntryEncounters(state, nativeRoom) end
        local result = base(currentRun, nativeRoom)
        if state.state == "synchronized" then
            local rewardOk, rewardError = navigation.proveIncomingReward(occurrence, nativeRoom)
            if not rewardOk then reportOutcome(session, state, rewardError) end
        end
        if state.state == "synchronized" then
            room.proveEntry(state, nativeRoom, {
                activeObstacles = _G.MapState and _G.MapState.ActiveObstacles,
                offeredExitDoors = _G.MapState and _G.MapState.OfferedExitDoors,
            })
        end
        report(runtime)
        return result
    end)

    module.hooks.wrap("RestoreUnlockRoomExits", "run-planner-room-restore", function(_, runtime, base,
        currentRun, nativeRoom)
        local state = getState(runtime)
        -- Loading a save into a cleared room restores it here instead of StartRoom
        -- (RoomLogic.lua:233-237).
        if state and loadoutScope.installedRun(currentRun) and session.resumeUnsteered(state) then
            report(runtime)
        end
        if state and state.state == "synchronized" then
            route.enterTransparent(state.route, roomName(nativeRoom))
        end
        return base(currentRun, nativeRoom)
    end)

    -- Native LeaveRoom keeps the planned Ephyra door's bookkeeping; its exit presentation plays on the
    -- door taken. Ephyra's slot, side, return and boss doors resolve to these exit functions.
    for _, name in ipairs({ "HubCombatRoomEntrance", "FastExitPresentation", "LeaveRoomPresentation" }) do
        module.hooks.wrap(name, "run-planner-snap-exit-walk", function(_, _, base, currentRun, exitDoor, ...)
            local walk = exitWalk
            if walk ~= nil and exitDoor == walk.planned then exitDoor = walk.taken end
            return base(currentRun, exitDoor, ...)
        end)
    end

    module.hooks.wrap("LeaveRoom", "run-planner-room-exit", function(_, runtime, base, currentRun, door)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then
            if state ~= nil then door = snapExit(runtime, state, currentRun, door) end
            local result = base(currentRun, door)
            exitWalk = nil
            return result
        end
        local nativeRoomName = roomName(currentRun and currentRun.CurrentRoom)
        if route.leaveTransparent and route.leaveTransparent(state.route, nativeRoomName) then
            if navigation.proveHubDeparture then
                local departed, departureError = navigation.proveHubDeparture(state, currentRun)
                if not departed then reportOutcome(session, state, departureError); report(runtime) end
            end
            -- The Hub and a restored main room leave through the board door to the planned next room.
            local stray, expected
            if state.state == "synchronized" then stray, expected = boardStray(state, nativeRoomName, door, currentRun) end
            if stray ~= nil then
                session.mismatch(state, { checkpoint = "exit-door", expected = expected.id, observed = stray })
            end
            door = snapExit(runtime, state, currentRun, door, stray ~= nil)
            local result = base(currentRun, door)
            exitWalk = nil
            return result
        end
        local proved, errorValue = navigation.proveOutgoingDoors(state, currentRun)
        if not proved then reportOutcome(session, state, errorValue) end
        if state.state == "synchronized" then room.close(state, currentRun, _G.GameState) end
        if state.state == "synchronized" then
            local ok, routeError = route.exit(state.route)
            if not ok then reportOutcome(session, state, routeError) end
        end
        -- A door prepared for another published target or additional exit, or
        -- any board door but the planned one, leaves the route here.
        local expected = state.state == "synchronized" and route.expected(state.route) or nil
        local stray = expected and (doors.strayTarget(state.route.lastExitedOccurrence, door,
            expected.id, state.route.plan.occurrencesById) or boardStray(state, nativeRoomName, door, currentRun))
        if stray ~= nil then
            session.mismatch(state, { checkpoint = "exit-door", expected = expected.id, observed = stray })
        end
        if state.state == "synchronized" and expected == nil then
            state.reason = "configured-prefix-complete"
        end
        door = snapExit(runtime, state, currentRun, door, stray ~= nil)
        local result = base(currentRun, door)
        exitWalk = nil
        report(runtime)
        return result
    end)
end

return hooks
