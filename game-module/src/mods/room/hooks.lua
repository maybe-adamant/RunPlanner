-- Route/room handshake and current-room lifecycle contacts.
local snapMode = type(import) == "function" and import("mods/snap/mode.lua") or require("mods.snap.mode")

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

-- snapScope: { enabled(runtime), apply, hexTree } for snap mode; nil leaves it off.
function hooks.attach(module, session, getState, report, route, room, featureScope, navigation, loadoutScope,
    practiceScope, snapScope)
    assert(type(loadoutScope) == "table"
        and type(loadoutScope.synchronizeStartingRoom) == "function"
        and type(loadoutScope.startingRun) == "function"
        and type(loadoutScope.installedRun) == "function",
        "starting-room loadout scope is required")
    -- Snap mode steers a desynchronized run's next room to the planned next
    -- occurrence: the door's own room when it is that room, else one built as
    -- ChooseStartingRoom builds it. The session resynchronizes first so the
    -- new room's encounter and reward are steered inside LeaveRoom.
    local function steerSnap(runtime, state, currentRun, door)
        if snapScope == nil or not snapScope.enabled(runtime) then return end
        local target, index = snapMode.target(state, roomName(currentRun and currentRun.CurrentRoom))
        if target == nil then return end
        if not session.beginSnap(state, index) then report(runtime); return end
        room.prepare(state, target)
        if type(door) == "table" and roomName(door.Room) == target.gameName then
            door.Room.__runPlannerExecutionRoomId = target.id
        elseif state.state == "synchronized" then
            local gameValue = _G.game or game
            local data = room.realize(state, target, gameValue)
            if data ~= nil then data = navigation.realizeIncomingReward(target, data) end
            local createRoom = gameValue and gameValue.CreateRoom or _G.CreateRoom
            if type(data) == "table" and type(createRoom) == "function" and type(door) == "table" then
                door.Room = createRoom(data)
            end
        end
        if state.state ~= "synchronized" then session.stopSnapping(state) end
        report(runtime)
    end

    -- At the snapped room's StartRoom, before native setup binds the hero.
    local function settleSnap(runtime, state, nativeRoom)
        local pending = state.snapPending
        local occurrence = state.plan.occurrencesById[pending.occurrenceId]
        local ok, verified, failure = true, false, nil
        if state.state == "synchronized" and roomName(nativeRoom) ~= occurrence.gameName then
            failure = { checkpoint = "snap-room", expected = occurrence.gameName, observed = roomName(nativeRoom) }
        elseif state.state == "synchronized" then
            ok, verified, failure = pcall(snapScope.apply, occurrence, occurrence.diagnostics.roomEntered,
                state.plan, {
                    hexTree = snapScope.hexTree,
                    diagnostic = function(checkpoint, expected, observed)
                        session.diagnostic(state, checkpoint, { expected = expected, observed = observed })
                    end,
                })
            if not ok then
                failure = { outcome = "fault", checkpoint = "snap-apply", expected = occurrence.id,
                    observed = tostring(verified) }
            end
        end
        if ok and verified then session.completeSnap(state) else session.stopSnapping(state, failure) end
        report(runtime)
    end

    module.hooks.wrap("ChooseStartingRoom", "run-planner-starting-room", function(_, runtime, base, currentRun,
        args)
        local state = getState(runtime)
        if state == nil then return base(currentRun, args) end
        local enteringDreamBiome = state.state == "synchronized"
            and state.plan.routeKey == "Dream"
            and type(args) == "table" and args.StartingBiome ~= nil
            and currentRun and currentRun.IsDreamRun == true
        if state.state ~= "starting" and not enteringDreamBiome then
            report(runtime)
            return base(currentRun, args)
        end
        if state.state == "starting" and not loadoutScope.synchronizeStartingRoom(runtime, args) then
            report(runtime)
            return base(currentRun, args)
        end
        local occurrence = enteringDreamBiome and route.next(state.route) or route.expected(state.route)
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
        if state == nil or state.state ~= "synchronized" then return base(roomData, args) end
        local additional = featureScope and featureScope.currentAdditional()
        local id = type(roomData) == "table" and roomData.__runPlannerExecutionRoomId or nil
        local occurrence = opening
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
        local snapped = state.snapPending ~= nil
        if snapped then settleSnap(runtime, state, nativeRoom) end
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
        -- A snapped room that fails its own entry proofs means the snap did not hold.
        if snapped and state.state == "desynchronized" then session.stopSnapping(state) end
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

    module.hooks.wrap("LeaveRoom", "run-planner-room-exit", function(_, runtime, base, currentRun, door)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then
            if state ~= nil then steerSnap(runtime, state, currentRun, door) end
            return base(currentRun, door)
        end
        local nativeRoomName = roomName(currentRun and currentRun.CurrentRoom)
        if route.leaveTransparent and route.leaveTransparent(state.route, nativeRoomName) then
            if navigation.proveHubDeparture then
                local departed, departureError = navigation.proveHubDeparture(state, currentRun)
                if not departed then reportOutcome(session, state, departureError); report(runtime) end
            end
            return base(currentRun, door)
        end
        local proved, errorValue = navigation.proveOutgoingDoors(state, currentRun)
        if not proved then reportOutcome(session, state, errorValue) end
        if state.state == "synchronized" then room.close(state, currentRun, _G.GameState) end
        if state.state == "synchronized" then
            local ok, routeError = route.exit(state.route)
            if not ok then reportOutcome(session, state, routeError) end
        end
        if state.state == "synchronized" and route.expected(state.route) == nil then
            state.reason = "configured-prefix-complete"
        end
        if state.state == "desynchronized" then steerSnap(runtime, state, currentRun, door) end
        local result = base(currentRun, door)
        report(runtime)
        return result
    end)
end

return hooks
