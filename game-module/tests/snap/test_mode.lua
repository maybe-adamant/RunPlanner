-- luacheck: globals TestSnapMode
local lu = require("luaunit")
local nativeGame = require("tests/harness/native_game")
local support = require("tests.harness.hook_composition")
local session = require("mods.runtime.session")
local route = require("mods.route.session")
local roomHooks = require("mods.room.hooks")
local mode = require("mods.snap.mode")
local presentation = require("mods.presentation.run_presentation")
local victorySummary = require("mods.presentation.victory_summary")
local doors = require("mods.navigation.doors")
local navigationHooks = require("mods.navigation.hooks")

TestSnapMode = {}

local function occurrence(id, gameName, biomeKey, extra)
    local value = {
        id = id, gameName = gameName, biomeKey = biomeKey,
        overview = {}, diagnostics = { roomEntered = {} },
        timeline = { transactions = {}, dependencies = {}, obligations = {} },
    }
    for key, item in pairs(extra or {}) do value[key] = item end
    return value
end

-- F_A then F_B, F_C, then G_A and G_B across a biome edge.
local function plan()
    local rows = {
        occurrence("a", "F_A", "F"), occurrence("b", "F_B", "F"), occurrence("c", "F_C", "F"),
        occurrence("g", "G_A", "G"), occurrence("h", "G_B", "G"),
    }
    local value = { routeKey = "Underworld", selectedOccurrenceIds = {}, occurrencesById = {} }
    for index, row in ipairs(rows) do
        value.selectedOccurrenceIds[index] = row.id
        value.occurrencesById[row.id] = row
    end
    return value
end

-- A session that entered occurrence `index` and then mismatched there.
local function desynchronized(index, checkpoint)
    local state = session.create()
    state.plan = plan()
    assert(session.resumeAt(state, index))
    state.state, state.reason = "synchronized", "ready"
    route.enter(state.route, state.plan.selectedOccurrenceIds[index],
        state.plan.occurrencesById[state.plan.selectedOccurrenceIds[index]].gameName)
    session.mismatch(state, { checkpoint = checkpoint or "room-exit-conformance:traitInventory" })
    return state
end

-- Room hooks over stub room and navigation scopes, with snap mode on or off.
-- options: offered doors, extra RoomData, a Hub departure proof, and navigation hooks to attach.
local function attached(state, snapOn, apply, rewardProof, options)
    options = options or {}
    local module, _, callbacks = support.capture()
    local log = { created = {} }
    local room = {
        prepare = function() return {} end,
        realize = function(_, target) return { Name = target.gameName, __runPlannerExecutionRoomId = target.id } end,
        enter = function() end, bindEntryEncounters = function() end, proveEntry = function() end,
        close = function() end,
    }
    local navigation = {
        doorTargets = doors.targets, plannedRoom = doors.plannedRoom,
        realizeIncomingReward = function(_, data) return data end,
        proveIncomingReward = rewardProof or function() return true end,
        proveOutgoingDoors = function() return true end,
        proveHubDeparture = options.departure,
    }
    local loadoutScope = {
        synchronizeStartingRoom = function() return true end, startingRun = function() return false end,
        installedRun = function() return false end,
    }
    roomHooks.attach(module, session, function() return state end, function() end, route, room, nil, navigation,
        loadoutScope, nil, {
            enabled = function(runtime) return runtime.data.read("SnapMode") == true end,
            apply = apply or function() return true end,
            hexTree = {},
        })
    local runtime = { data = { read = function(alias) return alias == "SnapMode" and snapOn end } }
    if options.navigationHooks then
        navigationHooks.attach(module, session, function() return state end, function() end, route,
            { checkpoint = function() end, window = function() end })
    end
    local roomData = { F_B = { Name = "F_B" } }
    for name, data in pairs(options.roomData or {}) do roomData[name] = data end
    local restore = nativeGame.install({
        game = { RoomData = roomData, CreateRoom = function(data)
            log.created[#log.created + 1] = data
            return { Name = data.Name, __runPlannerExecutionRoomId = data.__runPlannerExecutionRoomId }
        end },
        MapState = { OfferedExitDoors = options.offered or {} },
        OverwriteTableKeys = function(target, values)
            for key, value in pairs(values or {}) do target[key] = value end
        end,
        CollapseTableOrdered = function(value)
            local rows = {}
            for _, door in pairs(value or {}) do rows[#rows + 1] = door end
            table.sort(rows, function(left, right) return left.ObjectId < right.ObjectId end)
            return rows
        end,
    })
    -- `current` is the room name being left or the whole native run.
    local function leave(current, door)
        local passed
        local currentRun = type(current) == "table" and current or { CurrentRoom = { Name = current } }
        callbacks.LeaveRoom(nil, runtime, function(_, value) passed = value end, currentRun, door)
        return passed
    end
    local function start(nativeRoom)
        callbacks.StartRoom(nil, runtime, function() end, { CurrentRoom = nativeRoom }, nativeRoom)
    end
    return leave, start, log, restore, callbacks
end

function TestSnapMode.testSnapOffLeavesADesynchronizedRunExactlyAsBefore()
    local state = desynchronized(1)
    local leave, _, log, restore = attached(state, false)
    local door = { Room = { Name = "F_X" } }
    local passed = leave("F_A", door)
    restore()
    lu.assertIs(passed, door)
    lu.assertEquals(door.Room, { Name = "F_X" })
    lu.assertEquals({ state.state, state.reason, state.route.index }, { "desynchronized", "first-mismatch", 1 })
    lu.assertEquals(log.created, {})
end

function TestSnapMode.testKeepsADoorThatAlreadyLeadsToThePlannedRoom()
    local state = desynchronized(1)
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "F_B", __runPlannerExecutionRoomId = "b" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(door.Room, { Name = "F_B", __runPlannerExecutionRoomId = "b" })
    lu.assertEquals(log.created, {})
    lu.assertEquals({ state.state, state.reason, state.route.index }, { "synchronized", "snap-pending", 2 })
    lu.assertEquals(state.snapPending.mismatch.checkpoint, "room-exit-conformance:traitInventory")
end

function TestSnapMode.testRebuildsADoorRoomOfTheSameNameMadeForAnotherOccurrence()
    local state = desynchronized(1)
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "F_B", __runPlannerExecutionRoomId = "other-f-b" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(#log.created, 1)
    lu.assertEquals(door.Room.__runPlannerExecutionRoomId, "b")
end

function TestSnapMode.testBuildsThePlannedDoorRoomWithItsZagreusContract()
    local state = desynchronized(2)
    state.plan.occurrencesById.a.doors = { kind = "batch", targets = { {
        room = { id = "b", gameName = "F_B" }, reward = { rewardType = "Boon", source = "ZeusUpgrade" },
        zagreusContractPresent = true,
    } } }
    state.plan.occurrencesById.b.doors = { kind = "batch", targets = { {
        room = { id = "c", gameName = "F_C" }, reward = { rewardType = "MaxHealthDrop" },
        zagreusContractPresent = true,
    } } }
    local leave, _, log, restore = attached(state, true)
    leave("F_B", { Room = { Name = "F_X" } })
    restore()
    local data = log.created[1]
    lu.assertEquals({ data.Name, data.__runPlannerExecutionRoomId, data.RewardType,
        data.__runPlannerExecutionZagreusContractPresent }, { "F_C", "c", "MaxHealthDrop", true })
end

function TestSnapMode.testBuildsThePlannedRoomWhenTheDoorLeadsElsewhere()
    local state = desynchronized(1)
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "F_X" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(#log.created, 1)
    lu.assertEquals(door.Room, { Name = "F_B", __runPlannerExecutionRoomId = "b" })
end

-- A session in F_A, still synchronized, whose batch exit offers F_B (planned) and F_C.
local function synchronizedAtBatchExit()
    local state = session.create()
    state.plan = plan()
    assert(session.resumeAt(state, 1))
    state.state, state.reason = "synchronized", "ready"
    route.enter(state.route, "a", "F_A")
    state.plan.occurrencesById.a.doors = { kind = "batch", targets = {
        { room = { id = "b", gameName = "F_B" } }, { room = { id = "c", gameName = "F_C" } },
    } }
    return state
end

function TestSnapMode.testAStrayDoorFromASynchronizedRoomSnapsAtThatExit()
    local state = synchronizedAtBatchExit()
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "F_C", __runPlannerExecutionRoomId = "c" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(door.Room.__runPlannerExecutionRoomId, "b")
    lu.assertEquals(#log.created, 1)
    lu.assertEquals({ state.state, state.reason, state.route.index }, { "synchronized", "snap-pending", 2 })
    lu.assertEquals(state.snapPending.mismatch.checkpoint, "exit-door")
end

function TestSnapMode.testAStrayDoorWithSnapOffDesynchronizesAtTheExit()
    local state = synchronizedAtBatchExit()
    local leave, _, log, restore = attached(state, false)
    local door = { Room = { Name = "F_C", __runPlannerExecutionRoomId = "c" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(door.Room.__runPlannerExecutionRoomId, "c")
    lu.assertEquals(log.created, {})
    lu.assertEquals({ state.state, state.firstMismatch.checkpoint, state.firstMismatch.observed },
        { "desynchronized", "exit-door", "c" })
end

function TestSnapMode.testThePlannedOrAnUnstampedDoorLeavesInSync()
    for _, room in ipairs({ { Name = "F_B", __runPlannerExecutionRoomId = "b" }, { Name = "N_Hub" } }) do
        local state = synchronizedAtBatchExit()
        local leave, _, _, restore = attached(state, true)
        leave("F_A", { Room = room })
        restore()
        lu.assertEquals({ state.state, state.reason, state.route.index }, { "synchronized", "ready", 2 })
    end
end

-- The batch exit plus a planned Chaos gate to occurrence x; `chaosNext` selects x after F_A.
local function synchronizedWithChaosGate(chaosNext)
    local state = synchronizedAtBatchExit()
    local chaos = occurrence("x", "Chaos_01", "F")
    state.plan.occurrencesById.x = chaos
    state.plan.occurrencesById.a.overview.additional = { { kind = "chaos", owner = "a-chaos", room = chaos } }
    if chaosNext then table.insert(state.plan.selectedOccurrenceIds, 2, "x") end
    return state
end

function TestSnapMode.testAnUnplannedChaosGateSnapsToThePlannedDoorRoom()
    local state = synchronizedWithChaosGate(false)
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "Chaos_01", __runPlannerExecutionRoomId = "x" } }
    leave("F_A", door)
    restore()
    lu.assertEquals({ door.Room.Name, door.Room.__runPlannerExecutionRoomId, #log.created }, { "F_B", "b", 1 })
    lu.assertEquals({ state.state, state.reason, state.snapPending.mismatch.checkpoint },
        { "synchronized", "snap-pending", "exit-door" })
end

function TestSnapMode.testANormalDoorTakenInsteadOfThePlannedChaosGateSnapsToTheChaosRoom()
    local state = synchronizedWithChaosGate(true)
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "F_B", __runPlannerExecutionRoomId = "b" } }
    leave("F_A", door)
    restore()
    lu.assertEquals({ door.Room.Name, door.Room.__runPlannerExecutionRoomId, #log.created }, { "Chaos_01", "x", 1 })
    lu.assertEquals({ state.state, state.reason, state.snapPending.occurrenceId }, { "synchronized", "snap-pending", "x" })
end

function TestSnapMode.testDeclinesBiomeEdgesHubsMissingFramesAndUnsnappableSessions()
    local edge = desynchronized(3)
    lu.assertEquals({ mode.target(edge, "F_C") }, { nil, "declined" })
    local board = desynchronized(1)
    board.plan.occurrencesById.c.overview.hub = { room = { gameName = "N_Hub" }, slots = {
        { physicalDoorId = 1, room = { id = "b", gameName = "F_B" } },
    } }
    lu.assertEquals({ mode.target(board, "F_A") }, { nil, "declined" })
    local frameless = desynchronized(1)
    frameless.plan.occurrencesById.b.diagnostics = nil
    lu.assertEquals({ mode.target(frameless, "F_A") }, { nil, "declined" })
    local resumed = desynchronized(1)
    resumed.reason = "resumed-unsteered"
    lu.assertEquals({ mode.target(resumed, "F_A") }, { nil, "declined" })
    local stopped = desynchronized(1)
    stopped.snapDisabled = true
    lu.assertEquals({ mode.target(stopped, "F_A") }, { nil, "declined" })
end

function TestSnapMode.testResynchronizesAtThePlannedRoomAfterASuccessfulSnap()
    local state = desynchronized(1)
    local applied
    local leave, start, _, restore = attached(state, true, function(target, frame, _, context)
        applied = { target.id, frame, context.hexTree ~= nil }
        return true
    end)
    leave("F_A", { Room = { Name = "F_B" } })
    start({ Name = "F_B", __runPlannerExecutionRoomId = "b" })
    restore()
    lu.assertEquals(applied, { "b", {}, true })
    lu.assertEquals({ state.state, state.reason, state.firstMismatch }, { "synchronized", "ready", nil })
    lu.assertNil(state.route.firstMismatch)
    lu.assertEquals(state.route.currentOccurrence.id, "b")
    lu.assertEquals(#state.snaps, 1)
    lu.assertEquals({ state.snaps[1].occurrenceId, state.snaps[1].mismatch.checkpoint },
        { "b", "room-exit-conformance:traitInventory" })
end

function TestSnapMode.testAVerifyFailureStopsSnappingForTheRun()
    local state = desynchronized(1)
    local leave, start, _, restore = attached(state, true, function()
        return nil, { checkpoint = "practice-start:keepsakes" }
    end)
    leave("F_A", { Room = { Name = "F_B" } })
    start({ Name = "F_B", __runPlannerExecutionRoomId = "b" })
    restore()
    lu.assertEquals({ state.state, state.reason, state.snapDisabled }, { "desynchronized", "snap-loop", true })
    lu.assertEquals(state.firstMismatch.checkpoint, "practice-start:keepsakes")
    lu.assertEquals({ mode.target(state, "F_B") }, { nil, "declined" })
end

function TestSnapMode.testAnApplyFaultStopsSnappingAsAPlannerError()
    local state = desynchronized(1)
    local leave, start, _, restore = attached(state, true, function() error("native call failed") end)
    leave("F_A", { Room = { Name = "F_B" } })
    start({ Name = "F_B", __runPlannerExecutionRoomId = "b" })
    restore()
    lu.assertEquals({ state.state, state.reason, state.snapDisabled }, { "faulted", "executor-fault", true })
    lu.assertEquals(state.firstFault.checkpoint, "snap-apply")
end

function TestSnapMode.testConsecutiveMispicksOfTheSameKindEachSnap()
    local state = desynchronized(1)
    local leave, start, _, restore = attached(state, true)
    leave("F_A", { Room = { Name = "F_B" } })
    start({ Name = "F_B", __runPlannerExecutionRoomId = "b" })
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    leave("F_B", { Room = { Name = "F_X" } })
    start({ Name = "F_C", __runPlannerExecutionRoomId = "c" })
    restore()
    lu.assertEquals({ state.state, state.reason }, { "synchronized", "ready" })
    lu.assertEquals({ #state.snaps, state.snaps[1].occurrenceId, state.snaps[2].occurrenceId }, { 2, "b", "c" })
end

function TestSnapMode.testAnEntryMismatchInTheSnappedRoomStopsSnapping()
    local state = desynchronized(1)
    local leave, start, _, restore = attached(state, true, nil, function()
        return nil, { checkpoint = "incoming-reward" }
    end)
    leave("F_A", { Room = { Name = "F_B" } })
    start({ Name = "F_B", __runPlannerExecutionRoomId = "b" })
    restore()
    lu.assertEquals({ state.state, state.reason, state.snapDisabled }, { "desynchronized", "snap-loop", true })
    lu.assertEquals(state.firstMismatch.checkpoint, "incoming-reward")
end

function TestSnapMode.testSnapsAppearInTheStatusWindowAndVictoryRows()
    local value = plan()
    local snapshot = {
        plan = value, state = "synchronized", current = value.occurrencesById.c,
        snaps = { { occurrenceId = "b" }, { occurrenceId = "c" } },
    }
    lu.assertStrContains(presentation.snapped(snapshot), "Snapped back 2 times")
    lu.assertNil(presentation.snapped({ plan = value, snaps = {} }))
    local rows = victorySummary.rows(snapshot, {}, {})
    lu.assertEquals(rows[3], { text = "Snapped back 2 times" })
    snapshot.snaps = {}
    lu.assertEquals(#victorySummary.rows(snapshot, {}, {}), 2)
end

-- Ephyra: the Hub carrier, Hub slots m1/m2 (m3 unplanned), m1's side rooms s1/s2, then the handoff.
local function ephyraPlan()
    local hub = {
        room = { gameName = "N_Hub" },
        slots = {
            { physicalDoorId = 101, room = { id = "m1", gameName = "N_Combat01" }, reward = { rewardType = "Boon" } },
            { physicalDoorId = 102, room = { id = "m2", gameName = "N_Combat02" }, reward = { rewardType = "Shop" } },
            { physicalDoorId = 103, room = { id = "m3", gameName = "N_Combat03" }, reward = { rewardType = "Shop" } },
        },
        finalHandoff = { id = "boss", gameName = "N_PreBoss01" },
    }
    local rows = {
        occurrence("pre", "N_PreHub01", "N", { overview = { hub = hub } }),
        occurrence("m1", "N_Combat01", "N", { overview = { localSlots = {
            { physicalDoorId = 201, generation = "generated", room = { id = "s1", gameName = "N_Sub01" } },
            { physicalDoorId = 202, generation = "generated", room = { id = "s2", gameName = "N_Sub02" } },
        } } }),
        occurrence("s1", "N_Sub01", "N"), occurrence("s2", "N_Sub02", "N"),
        occurrence("m2", "N_Combat02", "N"), occurrence("boss", "N_PreBoss01", "N"),
    }
    local value = { routeKey = "Surface", selectedOccurrenceIds = {}, occurrencesById = {
        m3 = occurrence("m3", "N_Combat03", "N"),
    } }
    for index, row in ipairs(rows) do
        value.selectedOccurrenceIds[index] = row.id
        value.occurrencesById[row.id] = row
    end
    return value
end

-- A synchronized session at `index`; `current` enters that occurrence, else the
-- cursor waits after `lastExited` in a native restore.
local function ephyraAt(index, current, lastExited)
    local state = session.create()
    state.plan = ephyraPlan()
    assert(session.resumeAt(state, index))
    state.state, state.reason = "synchronized", "ready"
    if current then
        route.enter(state.route, state.plan.selectedOccurrenceIds[index], current)
    else
        state.route.lastExitedOccurrence = state.plan.occurrencesById[lastExited]
    end
    return state
end

local function sideDoor(objectId, id)
    return { ObjectId = objectId, Name = "SideDoor", CloseOnReturnAnimation = "Close",
        Room = { Name = id, __runPlannerExecutionRoomId = id } }
end

local function hubReturn()
    return { ObjectId = 300, Name = "EphyraExitDoorReturn", ReturnToPreviousRoomName = "N_Hub" }
end

local ephyraRoomData = {
    N_Hub = { Name = "N_Hub", Declared = true,
        PredeterminedDoorRooms = { [101] = "N_Combat01", [102] = "N_Combat02", [103] = "N_Combat03" } },
    N_Combat01 = { Name = "N_Combat01", OnUseSetRunData = {
        EphyraExitDoorReturn = { NextHeroStartPoint = 11, NextHeroEndPoint = 12 },
    } },
}

function TestSnapMode.testAWrongHubDoorLeavesThroughThePlannedMainRoomDoor()
    local state = ephyraAt(5, nil, "s2")
    local planned = { ObjectId = 102, Room = { Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" } }
    local taken = { ObjectId = 103, Room = { Name = "N_Combat03", __runPlannerExecutionRoomId = "m3" } }
    local applied
    local leave, start, log, restore = attached(state, true, function(target)
        applied = target.id
        return true
    end, nil, { offered = { [102] = planned, [103] = taken }, roomData = ephyraRoomData })
    local passed = leave("N_Hub", taken)
    lu.assertIs(passed, planned)
    lu.assertEquals(log.created, {})
    lu.assertEquals({ state.state, state.reason, state.snapPending.occurrenceId,
        state.snapPending.mismatch.checkpoint, state.snapPending.mismatch.observed },
        { "synchronized", "snap-pending", "m2", "exit-door", "m3" })
    start({ Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" })
    restore()
    lu.assertEquals({ applied, state.reason, #state.snaps }, { "m2", "ready", 1 })
end

function TestSnapMode.testAWrongSideDoorLeavesThroughThePlannedSideDoor()
    local state = ephyraAt(2, "N_Combat01")
    local planned, taken = sideDoor(201, "s1"), sideDoor(202, "s2")
    local leave, _, _, restore = attached(state, true, nil, nil, {
        offered = { [201] = planned, [202] = taken, [300] = hubReturn() }, roomData = ephyraRoomData,
    })
    local currentRun = { CurrentRoom = { Name = "N_Combat01", CloseDoorOnReturn = 202 } }
    local passed = leave(currentRun, taken)
    restore()
    lu.assertIs(passed, planned)
    lu.assertEquals(currentRun.CurrentRoom.CloseDoorOnReturn, 201)
    lu.assertEquals({ state.reason, state.snapPending.occurrenceId }, { "snap-pending", "s1" })
end

function TestSnapMode.testASideDoorTakenWhenThePlanReturnsToTheHubLeavesThroughTheHubReturn()
    local state = ephyraAt(5, nil, "s2")
    local planned, taken = hubReturn(), sideDoor(201, "s1")
    local leave, start, _, restore = attached(state, true, nil, nil, {
        offered = { [201] = taken, [300] = planned }, roomData = ephyraRoomData,
    })
    local hubVisit = { Name = "N_Hub", TimesVisited = 1, Kept = true }
    local currentRun = {
        CurrentRoom = { Name = "N_Combat01", CloseDoorOnReturn = 201 },
        RoomHistory = { hubVisit, { Name = "N_Combat01" }, { Name = "N_Sub02" } },
    }
    local passed = leave(currentRun, taken)
    lu.assertIs(passed, planned)
    lu.assertEquals({ planned.Room.Kept, planned.Room.Declared, planned.Room.TimesVisited }, { true, true, 2 })
    lu.assertNotIs(planned.Room, hubVisit)
    lu.assertEquals(hubVisit.TimesVisited, 1)
    lu.assertNil(currentRun.CurrentRoom.CloseDoorOnReturn)
    lu.assertEquals({ currentRun.CurrentRoom.NextHeroStartPoint, currentRun.CurrentRoom.NextHeroEndPoint }, { 11, 12 })
    -- The return completes the snap; the Hub stays a transparent native re-entry.
    lu.assertEquals({ state.state, state.reason, state.snapPending, #state.snaps }, { "synchronized", "ready", nil, 1 })
    start({ Name = "N_Hub" })
    restore()
    lu.assertEquals({ state.state, state.route.index, state.route.transparentNativeRoom }, { "synchronized", 5, "N_Hub" })
end

function TestSnapMode.testTheHubReturnTakenWhenThePlanSaysSideRoomLeavesThroughTheSideDoor()
    local state = ephyraAt(2, "N_Combat01")
    local planned, taken = sideDoor(201, "s1"), hubReturn()
    taken.Room = { Name = "N_Hub" }
    local leave, _, _, restore = attached(state, true, nil, nil, {
        offered = { [201] = planned, [300] = taken }, roomData = ephyraRoomData,
    })
    local currentRun = { CurrentRoom = { Name = "N_Combat01", NextHeroStartPoint = 11, NextHeroEndPoint = 12 } }
    local passed = leave(currentRun, taken)
    restore()
    lu.assertIs(passed, planned)
    lu.assertNil(currentRun.CurrentRoom.NextHeroStartPoint)
    lu.assertNil(currentRun.CurrentRoom.NextHeroEndPoint)
    lu.assertEquals(currentRun.CurrentRoom.CloseDoorOnReturn, 201)
    lu.assertEquals({ state.reason, state.snapPending.occurrenceId, state.snapPending.mismatch.observed },
        { "snap-pending", "s1", "N_Hub" })
end

function TestSnapMode.testAPlannedBoardDoorThatIsNotOfferedDeclines()
    local state = ephyraAt(5, nil, "s2")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local taken = { ObjectId = 103, Room = { Name = "N_Combat03" } }
    local leave, _, _, restore = attached(state, true, nil, nil, { offered = { [103] = taken } })
    local passed = leave("N_Hub", taken)
    restore()
    lu.assertIs(passed, taken)
    lu.assertEquals({ state.state, state.reason }, { "desynchronized", "first-mismatch" })
end

function TestSnapMode.testAHubDepartureMismatchSnapsThroughThePlannedSlotDoor()
    local state = ephyraAt(5, nil, "s2")
    local planned = { ObjectId = 102, Room = { Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" } }
    local leave, _, _, restore = attached(state, true, nil, nil, {
        offered = { [102] = planned },
        departure = function() return nil, { checkpoint = "hub-departure-conformance:traitInventory" } end,
    })
    local passed = leave("N_Hub", planned)
    restore()
    lu.assertIs(passed, planned)
    lu.assertEquals({ state.reason, state.snapPending.occurrenceId, state.snapPending.mismatch.checkpoint },
        { "snap-pending", "m2", "hub-departure-conformance:traitInventory" })
end

function TestSnapMode.testAMismatchBeforeTheBoardSnapsThroughTheHubsFirstEntry()
    local state = ephyraAt(1, "N_PreHub01")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local board = { [101] = { ObjectId = 101 }, [102] = { ObjectId = 102 }, [103] = { ObjectId = 103 } }
    local applied, departures = nil, 0
    local leave, start, log, restore, callbacks = attached(state, true, function(target)
        applied = target.id
        return true
    end, nil, { offered = board, roomData = ephyraRoomData, navigationHooks = true,
        departure = function()
            departures = departures + 1
            return nil, { checkpoint = "hub-departure-conformance:traitInventory" }
        end })
    local toHub = { ObjectId = 50, Room = { Name = "N_Hub" } }
    lu.assertIs(leave("N_PreHub01", toHub), toHub)
    lu.assertEquals({ toHub.Room, log.created }, { { Name = "N_Hub" }, {} })
    lu.assertEquals({ state.state, state.reason, state.snapPending.occurrenceId }, { "synchronized", "snap-pending", "m1" })
    local hubRoom = { Name = "N_Hub" }
    start(hubRoom)
    lu.assertNil(applied)
    lu.assertEquals(state.route.transparentNativeRoom, "N_Hub")
    -- The Hub's first board is generated and proved in sync: each slot door is steered and stamped.
    _G.CurrentRun = { CurrentRoom = hubRoom, RewardStores = { HubRewards = { { Name = "Shop" }, { Name = "Boon" } } } }
    callbacks.DoUnlockRoomExits(nil, {}, function(run)
        for objectId, door in pairs(board) do
            local nativeTarget = { Name = ephyraRoomData.N_Hub.PredeterminedDoorRooms[objectId] }
            nativeTarget.ChosenRewardType = callbacks.ChooseRoomReward(nil, {}, function(currentRun, candidate, store)
                for _, reward in ipairs(currentRun.RewardStores[store]) do
                    if callbacks.IsRoomRewardEligible(nil, {}, function() return true end,
                        currentRun, candidate, reward, {}, {}) then return reward.Name end
                end
            end, run, nativeTarget, "HubRewards", {}, { Door = door })
            door.Room, door.RewardType = nativeTarget, nativeTarget.ChosenRewardType
        end
    end, _G.CurrentRun, hubRoom)
    _G.CurrentRun = nil
    lu.assertEquals({ state.state, state.reason }, { "synchronized", "snap-pending" })
    lu.assertEquals({ board[101].Room.ChosenRewardType, board[101].Room.__runPlannerExecutionRoomId,
        board[102].Room.ChosenRewardType, board[102].Room.__runPlannerExecutionRoomId }, { "Boon", "m1", "Shop", "m2" })
    -- The Hub departure proof waits for the pending snap's frame.
    lu.assertIs(leave("N_Hub", board[101]), board[101])
    lu.assertEquals({ state.state, state.reason, departures }, { "synchronized", "snap-pending", 0 })
    lu.assertEquals(state.snapPending.mismatch.checkpoint, "room-exit-conformance:traitInventory")
    start({ Name = "N_Combat01", __runPlannerExecutionRoomId = "m1" })
    restore()
    lu.assertEquals({ applied, state.state, state.reason, #state.snaps }, { "m1", "synchronized", "ready", 1 })
end

function TestSnapMode.testSnappingResumesPastADeclinedBiomeEdge()
    local state = desynchronized(3)
    local leave, start, log, restore = attached(state, true)
    local edgeDoor = { Room = { Name = "G_A" } }
    leave("F_C", edgeDoor)
    lu.assertEquals({ edgeDoor.Room, log.created, state.state }, { { Name = "G_A" }, {}, "desynchronized" })
    local door = { Room = { Name = "G_X" } }
    leave("G_A", door)
    lu.assertEquals({ state.reason, state.snapPending.occurrenceId, door.Room.__runPlannerExecutionRoomId },
        { "snap-pending", "h", "h" })
    start({ Name = "G_B", __runPlannerExecutionRoomId = "h" })
    restore()
    lu.assertEquals({ state.state, state.reason, state.route.currentOccurrence.id }, { "synchronized", "ready", "h" })
end

function TestSnapMode.testAChaosGateFromTheHubCarrierLeavesThroughTheHubDoor()
    local state = ephyraAt(1, "N_PreHub01")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local hubDoor = { ObjectId = 50, Room = { Name = "N_Hub" } }
    local chaos = { ObjectId = 60, Room = { Name = "Chaos_01" } }
    local leave, _, log, restore = attached(state, true, nil, nil, { offered = { [50] = hubDoor, [60] = chaos } })
    lu.assertIs(leave("N_PreHub01", chaos), hubDoor)
    restore()
    lu.assertEquals({ chaos.Room, log.created }, { { Name = "Chaos_01" }, {} })
    lu.assertEquals({ state.reason, state.snapPending.occurrenceId }, { "snap-pending", "m1" })

    local closed = ephyraAt(1, "N_PreHub01")
    session.mismatch(closed, { checkpoint = "room-exit-conformance:traitInventory" })
    local closedLeave, _, _, closedRestore = attached(closed, true, nil, nil, { offered = { [60] = chaos } })
    lu.assertIs(closedLeave("N_PreHub01", chaos), chaos)
    closedRestore()
    lu.assertEquals({ closed.state, closed.snapPending }, { "desynchronized", nil })
end

function TestSnapMode.testAnOutOfSyncHubSkipsAnUnsteeredSlotDoorForTheFinalHandoff()
    local state = ephyraAt(5, nil, "s2")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local native = { ObjectId = 102, Room = { Name = "N_Combat02" } }
    local handoff = { ObjectId = 400, Room = { Name = "N_PreBoss01", __runPlannerExecutionRoomId = "boss" } }
    local leave, _, _, restore = attached(state, true, nil, nil, { offered = { [102] = native, [400] = handoff } })
    lu.assertIs(leave("N_Hub", native), handoff)
    restore()
    lu.assertEquals({ state.reason, state.snapPending.occurrenceId }, { "snap-pending", "boss" })
end

function TestSnapMode.testASnapSupersedingAPendingOneKeepsItsMismatchAndCountsOnce()
    local state = ephyraAt(1, "N_PreHub01")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local planned = { ObjectId = 101, Room = { Name = "N_Combat01", __runPlannerExecutionRoomId = "m1" } }
    local taken = { ObjectId = 102, Room = { Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" } }
    local leave, start, _, restore = attached(state, true, nil, nil, { offered = { [101] = planned, [102] = taken } })
    leave("N_PreHub01", { ObjectId = 50, Room = { Name = "N_Hub" } })
    start({ Name = "N_Hub" })
    lu.assertIs(leave("N_Hub", taken), planned)
    lu.assertEquals({ state.snapPending.occurrenceId, state.snapPending.mismatch.checkpoint },
        { "m1", "room-exit-conformance:traitInventory" })
    start({ Name = "N_Combat01", __runPlannerExecutionRoomId = "m1" })
    restore()
    lu.assertEquals({ state.reason, #state.snaps }, { "ready", 1 })
end
