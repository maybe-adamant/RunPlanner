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
        overview = {}, diagnostics = { roomEntered = {}, beforeRoomExit = { owner = id } },
        timeline = { transactions = {}, dependencies = {}, obligations = {} },
    }
    for key, item in pairs(extra or {}) do value[key] = item end
    return value
end

local function planOf(rows, routeKey, extra)
    local value = { routeKey = routeKey or "Underworld", selectedOccurrenceIds = {}, occurrencesById = {} }
    for index, row in ipairs(rows) do
        value.selectedOccurrenceIds[index] = row.id
        value.occurrencesById[row.id] = row
    end
    for _, row in ipairs(extra or {}) do value.occurrencesById[row.id] = row end
    return value
end

-- F_A then F_B, F_PostBoss01, then G_A and G_B across a biome edge.
local function plan()
    return planOf({
        occurrence("a", "F_A", "F"), occurrence("b", "F_B", "F"), occurrence("c", "F_PostBoss01", "F"),
        occurrence("g", "G_A", "G"), occurrence("h", "G_B", "G"),
    })
end

-- A session that entered occurrence `index` of `value` and then mismatched there.
local function desynchronized(index, checkpoint, value)
    local state = session.create()
    state.plan = value or plan()
    assert(session.resumeAt(state, index))
    state.state, state.reason = "synchronized", "ready"
    local id = state.plan.selectedOccurrenceIds[index]
    route.enter(state.route, id, state.plan.occurrencesById[id].gameName)
    session.mismatch(state, { checkpoint = checkpoint or "room-exit-conformance:traitInventory" })
    return state
end

-- Room hooks over stub room and navigation scopes, with snap mode on or off.
-- correct stands in for the snap writers; log.order records each correction's
-- frame owner and native LeaveRoom in call order.
-- options: offered doors, extra RoomData, a Hub departure proof, navigation hooks, CurrentRun,
-- and the frame differences an in-sync exit reads.
local function attached(state, snapOn, correct, rewardProof, options)
    options = options or {}
    local module, _, callbacks = support.capture()
    local log = { created = {}, order = {}, entered = {}, bound = {}, messages = {} }
    local room = {
        prepare = function() return {} end,
        realize = function(_, target) return { Name = target.gameName, __runPlannerExecutionRoomId = target.id } end,
        enter = function(_, entered) log.entered[#log.entered + 1] = entered.id end,
        bindEntryEncounters = function(_, nativeRoom) log.bound[#log.bound + 1] = nativeRoom.Name end,
        proveEntry = function() end, close = function() end,
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
            correct = function(frame, context)
                log.order[#log.order + 1] = "correct:" .. tostring(frame.owner)
                lu.assertNotNil(context.hexTree)
                if correct then return correct(frame, context) end
                return "in-sync"
            end,
            differences = function(frame)
                log.order[#log.order + 1] = "diff:" .. tostring(frame.owner)
                return options.differences or {}
            end,
            log = function(text) log.messages[#log.messages + 1] = text end,
            hexTree = {},
        })
    local runtime = { data = { read = function(alias) return alias == "SnapMode" and snapOn end } }
    if options.navigationHooks then
        navigationHooks.attach(module, session, function() return state end, function() end, route,
            { checkpoint = function() end, window = function() end }, nil, nil, nil, nil,
            function(runtime) return runtime.data.read("SnapMode") == true end)
    end
    local roomData = { F_B = { Name = "F_B" } }
    for name, data in pairs(options.roomData or {}) do roomData[name] = data end
    local restore = nativeGame.install({
        game = { RoomData = roomData, CreateRoom = function(data)
            log.created[#log.created + 1] = data
            return { Name = data.Name, __runPlannerExecutionRoomId = data.__runPlannerExecutionRoomId }
        end },
        CurrentRun = options.currentRun,
        RemoveValue = function(values, value)
            for index, item in ipairs(values) do
                if item == value then table.remove(values, index) return value end
            end
        end,
        MapState = { OfferedExitDoors = options.offered or {} },
        OverwriteTableKeys = function(target, values)
            for key, value in pairs(values or {}) do target[key] = value end
        end,
        -- The nearest native point of a kind is named by its source and kind.
        GetIdsByType = function(args) return { args.Name } end,
        GetClosest = function(args) return tostring(args.Id) .. ":" .. tostring(args.DestinationIds[1]) end,
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
        callbacks.LeaveRoom(nil, runtime, function(_, value)
            log.order[#log.order + 1] = "base"
            passed = value
        end, currentRun, door)
        return passed
    end
    local function start(nativeRoom)
        callbacks.StartRoom(nil, runtime, function() end, { CurrentRoom = nativeRoom }, nativeRoom)
    end
    return leave, start, log, restore, callbacks, runtime
end

local function corrected(difference)
    return function() return "corrected", difference or { checkpoint = "snap-exit:traitInventory" } end
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
    lu.assertEquals({ log.created, log.order }, { {}, { "base" } })
end

function TestSnapMode.testCorrectsTheHeroBeforeNativeLeaveRoomAndNothingAtTheNextStartRoom()
    local state = desynchronized(1)
    local leave, start, log, restore = attached(state, true, corrected())
    leave("F_A", { Room = { Name = "F_X" } })
    lu.assertEquals(log.order, { "correct:a", "base" })
    lu.assertEquals({ state.state, state.reason, state.route.index, state.route.lastExitedOccurrence.id },
        { "synchronized", "ready", 2, "a" })
    lu.assertNil(state.firstMismatch)
    lu.assertNil(state.route.firstMismatch)
    start({ Name = "F_B", __runPlannerExecutionRoomId = "b" })
    restore()
    lu.assertEquals(log.order, { "correct:a", "base" })
    lu.assertEquals(state.route.currentOccurrence.id, "b")
    lu.assertEquals(#state.snaps, 1)
    lu.assertEquals({ state.snaps[1].occurrenceId, state.snaps[1].mismatch.checkpoint },
        { "b", "room-exit-conformance:traitInventory" })
end

function TestSnapMode.testAMidRoomMismatchIsCorrectedAtTheExitAndTheNextRoomIsSteered()
    local state = session.create()
    state.plan = plan()
    assert(session.resumeAt(state, 1))
    state.state, state.reason = "synchronized", "ready"
    local leave, start, log, restore = attached(state, true, corrected())
    start({ Name = "F_A", __runPlannerExecutionRoomId = "a" })
    session.mismatch(state, { checkpoint = "trait-offer-blocked-row" })
    lu.assertEquals(state.state, "desynchronized")
    local door = { Room = { Name = "F_X" } }
    leave("F_A", door)
    lu.assertEquals(door.Room.__runPlannerExecutionRoomId, "b")
    start({ Name = "F_B", __runPlannerExecutionRoomId = "b" })
    restore()
    lu.assertEquals({ state.state, state.route.currentOccurrence.id }, { "synchronized", "b" })
    lu.assertEquals({ log.entered, log.bound }, { { "a", "b" }, { "F_A", "F_B" } })
    lu.assertEquals(state.snaps[1].mismatch.checkpoint, "trait-offer-blocked-row")
end

function TestSnapMode.testKeepsADoorThatAlreadyLeadsToThePlannedRoom()
    local state = desynchronized(1)
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "F_B", __runPlannerExecutionRoomId = "b" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(door.Room, { Name = "F_B", __runPlannerExecutionRoomId = "b" })
    lu.assertEquals(log.created, {})
    lu.assertEquals({ state.state, state.reason, state.route.index, #state.snaps }, { "synchronized", "ready", 2, 1 })
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
        room = { id = "c", gameName = "F_PostBoss01" }, reward = { rewardType = "MaxHealthDrop" },
        zagreusContractPresent = true,
    } } }
    local leave, _, log, restore = attached(state, true)
    leave("F_B", { Room = { Name = "F_X" } })
    restore()
    local data = log.created[1]
    lu.assertEquals({ data.Name, data.__runPlannerExecutionRoomId, data.RewardType,
        data.__runPlannerExecutionZagreusContractPresent }, { "F_PostBoss01", "c", "MaxHealthDrop", true })
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
        { room = { id = "b", gameName = "F_B" } }, { room = { id = "c", gameName = "F_PostBoss01" } },
    } }
    return state
end

function TestSnapMode.testAStrayDoorFromASynchronizedRoomIsForcedAtThatExit()
    local state = synchronizedAtBatchExit()
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "F_PostBoss01", __runPlannerExecutionRoomId = "c" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(door.Room.__runPlannerExecutionRoomId, "b")
    lu.assertEquals(#log.created, 1)
    lu.assertEquals({ state.state, state.reason, state.route.index }, { "synchronized", "ready", 2 })
    lu.assertEquals(state.snaps[1].mismatch.checkpoint, "exit-door")
end

function TestSnapMode.testAStrayDoorWithSnapOffDesynchronizesAtTheExit()
    local state = synchronizedAtBatchExit()
    local leave, _, log, restore = attached(state, false)
    local door = { Room = { Name = "F_PostBoss01", __runPlannerExecutionRoomId = "c" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(door.Room.__runPlannerExecutionRoomId, "c")
    lu.assertEquals(log.created, {})
    lu.assertEquals({ state.state, state.firstMismatch.checkpoint, state.firstMismatch.observed },
        { "desynchronized", "exit-door", "c" })
end

function TestSnapMode.testAnInSyncExitWithPassingConformanceWritesAndCountsNothing()
    for _, room in ipairs({ { Name = "F_B", __runPlannerExecutionRoomId = "b" }, { Name = "N_Hub" } }) do
        local state = synchronizedAtBatchExit()
        local door = { Room = room }
        local leave, _, log, restore = attached(state, true, corrected())
        lu.assertIs(leave("F_A", door), door)
        restore()
        lu.assertIs(door.Room, room)
        lu.assertEquals({ log.order, log.created, log.messages }, { { "diff:a", "base" }, {}, {} })
        lu.assertEquals({ state.state, state.reason, state.route.index, #state.snaps }, { "synchronized", "ready", 2, 0 })
    end
end

function TestSnapMode.testAPassingConformanceThatDisagreesWithTheFrameIsLoggedNotWritten()
    local state = synchronizedAtBatchExit()
    local leave, _, log, restore = attached(state, true, corrected(), nil, { differences = {
        { family = "keepsakes", paths = { "keepsakes.held.1.uses=1->0" } },
        { family = "chaos", paths = { "chaos.active.1.remaining=3->2" } },
    } })
    leave("F_A", { Room = { Name = "F_B", __runPlannerExecutionRoomId = "b" } })
    restore()
    lu.assertEquals({ log.order, #state.snaps, state.state }, { { "diff:a", "base" }, 0, "synchronized" })
    lu.assertEquals(log.messages, { "[RunPlanner] conformance/snap disagreement room=F_A slot=nil"
        .. " families=keepsakes,chaos paths=keepsakes.held.1.uses=1->0; chaos.active.1.remaining=3->2" })
end

function TestSnapMode.testAFailingExitConformanceCorrectsAndCounts()
    local state = synchronizedAtBatchExit()
    local leave, _, log, restore = attached(state, true, corrected())
    session.mismatch(state, { checkpoint = "room-exit-conformance:keepsakes" })
    leave("F_A", { Room = { Name = "F_B", __runPlannerExecutionRoomId = "b" } })
    restore()
    lu.assertEquals(log.order, { "correct:a", "base" })
    lu.assertEquals({ state.state, #state.snaps, state.snaps[1].occurrenceId, state.snaps[1].mismatch.checkpoint },
        { "synchronized", 1, "b", "room-exit-conformance:keepsakes" })
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

function TestSnapMode.testAnUnplannedChaosGateIsForcedToThePlannedDoorRoom()
    local state = synchronizedWithChaosGate(false)
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "Chaos_01", __runPlannerExecutionRoomId = "x" } }
    leave("F_A", door)
    restore()
    lu.assertEquals({ door.Room.Name, door.Room.__runPlannerExecutionRoomId, #log.created }, { "F_B", "b", 1 })
    lu.assertEquals({ state.state, state.snaps[1].mismatch.checkpoint }, { "synchronized", "exit-door" })
end

function TestSnapMode.testANormalDoorTakenInsteadOfThePlannedChaosGateIsForcedToTheChaosRoom()
    local state = synchronizedWithChaosGate(true)
    local leave, _, log, restore = attached(state, true)
    local door = { Room = { Name = "F_B", __runPlannerExecutionRoomId = "b" } }
    leave("F_A", door)
    restore()
    lu.assertEquals({ door.Room.Name, door.Room.__runPlannerExecutionRoomId, #log.created }, { "Chaos_01", "x", 1 })
    lu.assertEquals({ state.state, state.snaps[1].occurrenceId }, { "synchronized", "x" })
end

function TestSnapMode.testReloadedAndStoppedRunsAreNotArmed()
    local resumed = desynchronized(1)
    resumed.reason = "resumed-unsteered"
    lu.assertFalse(mode.armed(resumed))
    local stopped = desynchronized(1)
    stopped.snapDisabled = true
    lu.assertFalse(mode.armed(stopped))
    lu.assertTrue(mode.armed(desynchronized(1)))
end

function TestSnapMode.testAVerifyFailureStopsSnappingForTheRun()
    local state = desynchronized(1)
    local leave, _, log, restore = attached(state, true, function()
        return nil, { checkpoint = "snap-exit:keepsakes" }
    end)
    local door = { Room = { Name = "F_X" } }
    leave("F_A", door)
    restore()
    lu.assertEquals({ door.Room, log.created }, { { Name = "F_X" }, {} })
    lu.assertEquals({ state.state, state.reason, state.snapDisabled }, { "desynchronized", "snap-loop", true })
    lu.assertEquals(state.firstMismatch.checkpoint, "snap-exit:keepsakes")
    lu.assertFalse(mode.armed(state))
end

function TestSnapMode.testAnApplyFaultStopsSnappingAsAPlannerError()
    local state = desynchronized(1)
    local leave, _, _, restore = attached(state, true, function() error("native call failed") end)
    leave("F_A", { Room = { Name = "F_X" } })
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
    start({ Name = "F_PostBoss01", __runPlannerExecutionRoomId = "c" })
    restore()
    lu.assertEquals({ state.state, state.reason }, { "synchronized", "ready" })
    lu.assertEquals({ #state.snaps, state.snaps[1].occurrenceId, state.snaps[2].occurrenceId }, { 2, "b", "c" })
end

function TestSnapMode.testAnEntryMismatchAfterASnapOnlyReportsAndTheNextExitSnapsAgain()
    local state = desynchronized(1)
    local leave, start, _, restore = attached(state, true, nil, function()
        return nil, { checkpoint = "incoming-reward" }
    end)
    leave("F_A", { Room = { Name = "F_B" } })
    start({ Name = "F_B", __runPlannerExecutionRoomId = "b" })
    lu.assertEquals({ state.state, state.reason, state.snapDisabled }, { "desynchronized", "first-mismatch", nil })
    lu.assertEquals(state.firstMismatch.checkpoint, "incoming-reward")
    local door = { Room = { Name = "F_X" } }
    leave("F_B", door)
    restore()
    lu.assertEquals({ state.state, door.Room.__runPlannerExecutionRoomId, #state.snaps }, { "synchronized", "c", 2 })
end

function TestSnapMode.testAnOutOfSyncBiomeEdgeIsCorrectedAndEntersThePlannedOpening()
    local state = desynchronized(3)
    local leave, start, log, restore = attached(state, true, corrected())
    local edgeDoor = { Room = { Name = "G_X" } }
    leave("F_PostBoss01", edgeDoor)
    lu.assertEquals(log.order, { "correct:c", "base" })
    lu.assertEquals({ edgeDoor.Room.Name, edgeDoor.Room.__runPlannerExecutionRoomId, #log.created }, { "G_A", "g", 1 })
    lu.assertEquals({ state.state, state.route.index }, { "synchronized", 4 })
    start({ Name = "G_A", __runPlannerExecutionRoomId = "g" })
    restore()
    lu.assertEquals({ state.state, state.route.currentOccurrence.id }, { "synchronized", "g" })
end

-- A Dream run out of sync in its Postboss: native picks the next biome, then the opening.
-- options.enteredOutOfSync: the Postboss was entered after the run desynchronized;
-- options.endsHere: the plan ends at the Postboss.
local function dreamPostboss(snapOn, options)
    options = options or {}
    local rows = { occurrence("boss", "G_Boss01", "G"), occurrence("post", "Dream_PostBoss01", "Dream") }
    if not options.endsHere then
        rows[3], rows[4] = occurrence("open", "Q_Intro", "Q"), occurrence("next", "Q_Combat01", "Q")
    end
    local value = planOf(rows, "Dream")
    local state
    if options.enteredOutOfSync then
        state = desynchronized(1, nil, value)
        assert(route.exit(state.route))
    else
        state = desynchronized(2, "room-exit-conformance:keepsakes", value)
    end
    local currentRun = { CurrentRoom = { Name = "Dream_PostBoss01" }, IsDreamRun = true, DreamBiomePool = { "P", "Q" } }
    local leave, start, log, restore, callbacks, runtime = attached(state, snapOn, corrected(), nil, {
        currentRun = currentRun, roomData = { Q_Intro = { Name = "Q_Intro" } }, navigationHooks = true,
    })
    callbacks.SelectNextDreamBiome(nil, runtime, function()
        local picked = callbacks.RemoveRandomValue(nil, runtime, function(values) return table.remove(values, 1) end,
            currentRun.DreamBiomePool)
        currentRun.CurrentRoom.NextRoomSet = { picked }
    end, nil, {})
    local nextRoom = callbacks.ChooseStartingRoom(nil, runtime, function() return { Name = "P_Intro" } end,
        currentRun, { StartingBiome = currentRun.CurrentRoom.NextRoomSet[1] })
    return state, currentRun, nextRoom, leave, start, log, restore
end

function TestSnapMode.testAnOutOfSyncDreamPostbossChoosesThePlannedBiomeAndOpeningThenCorrectsAtTheExit()
    local state, currentRun, nextRoom, leave, start, log, restore = dreamPostboss(true)
    lu.assertEquals({ currentRun.CurrentRoom.NextRoomSet, currentRun.DreamBiomePool }, { { "Q" }, { "P" } })
    lu.assertEquals({ nextRoom.Name, nextRoom.__runPlannerExecutionRoomId, #log.created }, { "Q_Intro", "open", 1 })
    lu.assertEquals(state.state, "desynchronized")
    local door = { Room = nextRoom }
    lu.assertIs(leave(currentRun, door), door)
    lu.assertIs(door.Room, nextRoom)
    lu.assertEquals({ log.order, #log.created }, { { "correct:post", "base" }, 1 })
    lu.assertEquals({ state.state, state.route.index, state.route.lastExitedOccurrence.id }, { "synchronized", 3, "post" })
    start({ Name = "Q_Intro", __runPlannerExecutionRoomId = "open" })
    restore()
    lu.assertEquals({ state.state, state.route.currentOccurrence.id, #state.snaps }, { "synchronized", "open", 1 })
end

function TestSnapMode.testTheDreamBiomeChoiceStaysNativeWithSnapOffAnOutOfSyncEntryOrAPlanEndingThere()
    for _, case in ipairs({ { false }, { true, { enteredOutOfSync = true } }, { true, { endsHere = true } } }) do
        local state, currentRun, nextRoom, leave, _, log, restore = dreamPostboss(case[1], case[2])
        lu.assertEquals({ currentRun.CurrentRoom.NextRoomSet, nextRoom.Name, log.created }, { { "P" }, "P_Intro", {} })
        local door = { Room = nextRoom }
        leave(currentRun, door)
        restore()
        lu.assertIs(door.Room, nextRoom)
        lu.assertEquals({ state.state, #state.snaps }, { "desynchronized", 0 })
    end
end

function TestSnapMode.testABiomeEdgeStaysNativeAfterAnOutOfSyncEntryOrWhenThePlanEndsThere()
    local outOfSync = desynchronized(2)
    assert(route.exit(outOfSync.route))
    local endsHere = desynchronized(3, nil, planOf({
        occurrence("a", "F_A", "F"), occurrence("b", "F_B", "F"), occurrence("c", "F_PostBoss01", "F"),
    }))
    for _, state in ipairs({ outOfSync, endsHere }) do
        local leave, _, log, restore = attached(state, true)
        local door = { Room = { Name = "G_X" } }
        leave("F_PostBoss01", door)
        restore()
        lu.assertEquals({ door.Room, log.created, state.state }, { { Name = "G_X" }, {}, "desynchronized" })
    end
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

-- Ephyra: the Hub carrier, Hub slots m1/m2 (m3 unplanned), m1's side rooms s1/s2,
-- then the handoff; `selected` narrows the visited occurrences.
local function ephyraPlan(selected, departureFrames)
    local departures = {}
    for visit = 0, 2 do
        departures[visit + 1] = { precedingVisitCount = visit,
            beforeRoomExit = departureFrames ~= false and { owner = "hub-" .. visit } or nil }
    end
    local hub = {
        room = { gameName = "N_Hub" },
        slots = {
            { physicalDoorId = 101, room = { id = "m1", gameName = "N_Combat01" }, reward = { rewardType = "Boon" } },
            { physicalDoorId = 102, room = { id = "m2", gameName = "N_Combat02" }, reward = { rewardType = "Shop" } },
            { physicalDoorId = 103, room = { id = "m3", gameName = "N_Combat03" }, reward = { rewardType = "Shop" } },
        },
        finalHandoff = { id = "boss", gameName = "N_PreBoss01" },
        fountain = { precedingVisitCount = 1 },
        departures = departures,
    }
    local all = {
        pre = occurrence("pre", "N_PreHub01", "N", { overview = { hub = hub } }),
        m1 = occurrence("m1", "N_Combat01", "N", { overview = { localSlots = {
            { physicalDoorId = 201, generation = "generated", room = { id = "s1", gameName = "N_Sub01" } },
            { physicalDoorId = 202, generation = "generated", room = { id = "s2", gameName = "N_Sub02" } },
        } } }),
        s1 = occurrence("s1", "N_Sub01", "N"), s2 = occurrence("s2", "N_Sub02", "N"),
        m2 = occurrence("m2", "N_Combat02", "N"), m3 = occurrence("m3", "N_Combat03", "N"),
        boss = occurrence("boss", "N_PreBoss01", "N"),
    }
    local rows, extra, chosen = {}, {}, {}
    for _, id in ipairs(selected or { "pre", "m1", "s1", "s2", "m2", "boss" }) do
        rows[#rows + 1], chosen[id] = all[id], true
    end
    for id, row in pairs(all) do if not chosen[id] then extra[#extra + 1] = row end end
    return planOf(rows, "Surface", extra)
end

-- A synchronized session at `index`; `current` enters that occurrence, else the
-- cursor waits after `lastExited` in a native restore.
local function ephyraAt(index, current, lastExited, value)
    local state = session.create()
    state.plan = value or ephyraPlan()
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

function TestSnapMode.testAWrongHubDoorIsForcedAndTheHubExitUsesItsDepartureFrame()
    local state = ephyraAt(5, nil, "s2")
    local planned = { ObjectId = 102, Room = { Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" } }
    local taken = { ObjectId = 103, Room = { Name = "N_Combat03", __runPlannerExecutionRoomId = "m3" } }
    local leave, start, log, restore = attached(state, true, nil, nil,
        { offered = { [102] = planned, [103] = taken }, roomData = ephyraRoomData })
    local passed = leave("N_Hub", taken)
    lu.assertIs(passed, planned)
    lu.assertEquals({ log.created, log.order }, { {}, { "correct:hub-1", "base" } })
    lu.assertEquals({ state.state, state.reason, state.route.index, state.snaps[1].occurrenceId,
        state.snaps[1].mismatch.checkpoint, state.snaps[1].mismatch.observed },
        { "synchronized", "ready", 5, "m2", "exit-door", "m3" })
    start({ Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" })
    restore()
    lu.assertEquals({ state.route.currentOccurrence.id, #log.order }, { "m2", 2 })
end

-- Native LeaveRoom closes and records the door it is given, then presents the exit through it.
function TestSnapMode.testAWrongHubDoorWalksInOnTheTakenDoorAndKeepsThePlannedDoorsBookkeeping()
    local state = ephyraAt(5, nil, "s2")
    local planned = { ObjectId = 102, Room = { Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" } }
    local taken = { ObjectId = 103, Room = { Name = "N_Combat03", __runPlannerExecutionRoomId = "m3" } }
    local _, _, _, restore, callbacks, runtime = attached(state, true, nil, nil,
        { offered = { [102] = planned, [103] = taken }, roomData = ephyraRoomData })
    local hubRoom = { Name = "N_Hub" }
    local currentRun = { CurrentRoom = hubRoom, ClosedDoors = { N_Hub = {} }, RoomHistory = { {}, {} } }
    local entered, presented
    callbacks.LeaveRoom(nil, runtime, function(run, door)
        entered = door
        hubRoom.DoorRoomHistory = { [door.ObjectId] = #run.RoomHistory + 2 }
        run.ClosedDoors.N_Hub[door.ObjectId] = true
        callbacks.HubCombatRoomEntrance(nil, runtime, function(_, exitDoor) presented = exitDoor end, run, door)
    end, currentRun, taken)
    local afterwards
    callbacks.HubCombatRoomEntrance(nil, runtime, function(_, exitDoor) afterwards = exitDoor end, currentRun, planned)
    restore()
    lu.assertIs(entered, planned)
    lu.assertIs(presented, taken)
    lu.assertIs(afterwards, planned)
    lu.assertEquals({ currentRun.ClosedDoors.N_Hub, hubRoom.DoorRoomHistory }, { { [102] = true }, { [102] = 4 } })
    lu.assertEquals({ state.state, state.snaps[1].occurrenceId }, { "synchronized", "m2" })
end

function TestSnapMode.testAPlanWithoutTheHubFrameCorrectsAtTheNextRoomsExit()
    local state = ephyraAt(5, nil, "s2", ephyraPlan(nil, false))
    local planned = { ObjectId = 102, Room = { Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" } }
    local leave, start, log, restore = attached(state, true, corrected(), nil, {
        offered = { [102] = planned },
        departure = function() return nil, { checkpoint = "hub-departure-conformance:traitInventory" } end,
    })
    leave("N_Hub", planned)
    lu.assertEquals({ log.order, state.state, #state.snaps }, { { "base" }, "synchronized", 1 })
    start({ Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" })
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    leave("N_Combat02", { Room = { Name = "N_PreBoss01", __runPlannerExecutionRoomId = "boss" } })
    restore()
    lu.assertEquals(log.order, { "base", "correct:m2", "base" })
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
    lu.assertEquals({ currentRun.CurrentRoom.HeroStartPoint, currentRun.CurrentRoom.HeroEndPoint },
        { "201:HeroStart", "201:HeroEnd" })
    lu.assertEquals({ state.state, state.route.index, state.snaps[1].occurrenceId }, { "synchronized", 3, "s1" })
end

function TestSnapMode.testAnOutOfSyncSideRoomReturnIsCorrectedThroughItsNativeReturn()
    local state = desynchronized(3, nil, ephyraPlan())
    local leave, start, log, restore = attached(state, true, corrected())
    local door = { ObjectId = 400, ReturnToPreviousRoomName = "N_Combat01" }
    lu.assertIs(leave("N_Sub01", door), door)
    lu.assertEquals({ door.Room, log.created, log.order }, { nil, {}, { "correct:s1", "base" } })
    lu.assertEquals({ state.state, state.route.index, state.route.lastExitedOccurrence.id, #state.snaps },
        { "synchronized", 4, "s1", 1 })
    start({ Name = "N_Combat01" })
    restore()
    lu.assertEquals(state.route.transparentNativeRoom, "N_Combat01")
end

function TestSnapMode.testAnOutOfSyncMainRoomIsCorrectedAndForcedThroughItsHubReturn()
    local state = desynchronized(2, nil, ephyraPlan({ "pre", "m1", "m2", "boss" }))
    local planned, taken = hubReturn(), sideDoor(201, "s1")
    local leave, start, log, restore = attached(state, true, corrected(), nil, {
        offered = { [201] = taken, [300] = planned }, roomData = ephyraRoomData,
    })
    local currentRun = {
        CurrentRoom = { Name = "N_Combat01", CloseDoorOnReturn = 201 },
        RoomHistory = { { Name = "N_Hub", TimesVisited = 1 }, { Name = "N_Combat01" } },
    }
    lu.assertIs(leave(currentRun, taken), planned)
    lu.assertEquals({ planned.Room.Name, planned.Room.TimesVisited }, { "N_Hub", 2 })
    lu.assertEquals(log.order, { "correct:m1", "base" })
    lu.assertEquals({ state.state, state.route.index, state.route.lastExitedOccurrence.id, state.snaps[1].occurrenceId },
        { "synchronized", 3, "m1", "m2" })
    start({ Name = "N_Hub" })
    restore()
    lu.assertEquals(state.route.transparentNativeRoom, "N_Hub")
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
    lu.assertNil(currentRun.CurrentRoom.HeroStartPoint)
    lu.assertEquals({ planned.Room.Kept, planned.Room.Declared, planned.Room.TimesVisited }, { true, true, 2 })
    lu.assertNotIs(planned.Room, hubVisit)
    lu.assertEquals(hubVisit.TimesVisited, 1)
    lu.assertNil(currentRun.CurrentRoom.CloseDoorOnReturn)
    lu.assertEquals({ currentRun.CurrentRoom.NextHeroStartPoint, currentRun.CurrentRoom.NextHeroEndPoint }, { 11, 12 })
    lu.assertEquals({ state.state, state.reason, #state.snaps }, { "synchronized", "ready", 1 })
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
    lu.assertEquals(currentRun.CurrentRoom.HeroStartPoint, "201:HeroStart")
    lu.assertEquals(currentRun.CurrentRoom.CloseDoorOnReturn, 201)
    lu.assertEquals({ state.route.index, state.snaps[1].occurrenceId, state.snaps[1].mismatch.observed },
        { 3, "s1", "N_Hub" })
end

-- Native LeaveRoom given `door`: presents the exit through `presentation`; returns the door
-- LeaveRoom received and the door presented.
local function leaveAndPresent(callbacks, runtime, currentRun, taken, presentation)
    local entered, presented
    callbacks.LeaveRoom(nil, runtime, function(run, door)
        entered = door
        callbacks[presentation](nil, runtime, function(_, exitDoor) presented = exitDoor end, run, door)
    end, currentRun, taken)
    return entered, presented
end

function TestSnapMode.testEveryEphyraDoorSubstitutionPresentsOnTheTakenDoor()
    -- A wrong side door: the side room is the planned one, the walk-out is the taken door's.
    local state = ephyraAt(2, "N_Combat01")
    local planned, taken = sideDoor(201, "s1"), sideDoor(202, "s2")
    local _, _, _, restore, callbacks, runtime = attached(state, true, nil, nil, {
        offered = { [201] = planned, [202] = taken, [300] = hubReturn() }, roomData = ephyraRoomData,
    })
    local currentRun = { CurrentRoom = { Name = "N_Combat01" } }
    local entered, presented = leaveAndPresent(callbacks, runtime, currentRun, taken, "FastExitPresentation")
    restore()
    lu.assertEquals({ entered.ObjectId, presented.ObjectId, currentRun.CurrentRoom.HeroStartPoint },
        { 201, 202, "201:HeroStart" })

    -- A side door taken when the plan returns to the Hub.
    state = ephyraAt(5, nil, "s2")
    planned, taken = hubReturn(), sideDoor(201, "s1")
    _, _, _, restore, callbacks, runtime = attached(state, true, nil, nil, {
        offered = { [201] = taken, [300] = planned }, roomData = ephyraRoomData,
    })
    currentRun = { CurrentRoom = { Name = "N_Combat01" }, RoomHistory = { { Name = "N_Hub", TimesVisited = 1 } } }
    entered, presented = leaveAndPresent(callbacks, runtime, currentRun, taken, "FastExitPresentation")
    restore()
    lu.assertEquals({ entered.ObjectId, presented.ObjectId, currentRun.CurrentRoom.NextHeroStartPoint },
        { 300, 201, 11 })

    -- The Hub return taken when the plan goes to a side room.
    state = ephyraAt(2, "N_Combat01")
    planned, taken = sideDoor(201, "s1"), hubReturn()
    _, _, _, restore, callbacks, runtime = attached(state, true, nil, nil, {
        offered = { [201] = planned, [300] = taken }, roomData = ephyraRoomData,
    })
    currentRun = { CurrentRoom = { Name = "N_Combat01" } }
    entered, presented = leaveAndPresent(callbacks, runtime, currentRun, taken, "FastExitPresentation")
    restore()
    lu.assertEquals({ entered.ObjectId, presented.ObjectId }, { 201, 300 })

    -- An unsteered Hub slot door skipped for the final handoff.
    state = ephyraAt(5, nil, "s2")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local native = { ObjectId = 102, Room = { Name = "N_Combat02" } }
    local handoff = { ObjectId = 400, Room = { Name = "N_PreBoss01", __runPlannerExecutionRoomId = "boss" } }
    _, _, _, restore, callbacks, runtime = attached(state, true, nil, nil, { offered = { [102] = native, [400] = handoff } })
    entered, presented = leaveAndPresent(callbacks, runtime, { CurrentRoom = { Name = "N_Hub" } }, native,
        "LeaveRoomPresentation")
    -- Outside a substituted exit the presentation keeps its own door.
    local afterwards
    callbacks.FastExitPresentation(nil, runtime, function(_, exitDoor) afterwards = exitDoor end, {}, handoff)
    restore()
    lu.assertEquals({ entered.ObjectId, presented.ObjectId, afterwards.ObjectId }, { 400, 102, 400 })
end

function TestSnapMode.testAPlannedBoardDoorThatIsNotOfferedDeclines()
    local state = ephyraAt(5, nil, "s2")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local taken = { ObjectId = 103, Room = { Name = "N_Combat03" } }
    local leave, _, _, restore = attached(state, true, nil, nil, { offered = { [103] = taken } })
    local passed = leave("N_Hub", taken)
    restore()
    lu.assertIs(passed, taken)
    lu.assertEquals({ state.state, state.reason, #state.snaps }, { "desynchronized", "first-mismatch", 0 })
end

function TestSnapMode.testAHubDepartureMismatchIsCorrectedAgainstTheDepartureFrame()
    local state = ephyraAt(5, nil, "s2")
    local planned = { ObjectId = 102, Room = { Name = "N_Combat02", __runPlannerExecutionRoomId = "m2" } }
    local leave, _, log, restore = attached(state, true, corrected(), nil, {
        offered = { [102] = planned },
        departure = function() return nil, { checkpoint = "hub-departure-conformance:traitInventory" } end,
    })
    local passed = leave("N_Hub", planned)
    restore()
    lu.assertIs(passed, planned)
    lu.assertEquals(log.order, { "correct:hub-1", "base" })
    lu.assertEquals({ state.state, state.route.index, state.snaps[1].occurrenceId, state.snaps[1].mismatch.checkpoint },
        { "synchronized", 5, "m2", "hub-departure-conformance:traitInventory" })
end

function TestSnapMode.testAMismatchBeforeTheBoardEntersTheHubInSyncAndItsBoardIsSteered()
    local state = ephyraAt(1, "N_PreHub01")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local board = { [101] = { ObjectId = 101 }, [102] = { ObjectId = 102 }, [103] = { ObjectId = 103 } }
    local departures = 0
    local leave, start, log, restore, callbacks = attached(state, true, nil, nil, {
        offered = board, roomData = ephyraRoomData, navigationHooks = true,
        departure = function() departures = departures + 1; return true end,
    })
    local toHub = { ObjectId = 50, Room = { Name = "N_Hub" } }
    lu.assertIs(leave("N_PreHub01", toHub), toHub)
    lu.assertEquals({ toHub.Room, log.created, log.order }, { { Name = "N_Hub" }, {}, { "correct:pre", "base" } })
    lu.assertEquals({ state.state, state.route.index, state.route.lastExitedOccurrence.id, state.snaps[1].occurrenceId },
        { "synchronized", 2, "pre", "m1" })
    local hubRoom = { Name = "N_Hub" }
    start(hubRoom)
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
    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals({ board[101].Room.ChosenRewardType, board[101].Room.__runPlannerExecutionRoomId,
        board[102].Room.ChosenRewardType, board[102].Room.__runPlannerExecutionRoomId }, { "Boon", "m1", "Shop", "m2" })
    lu.assertIs(leave("N_Hub", board[101]), board[101])
    lu.assertEquals({ state.state, departures, log.order[3] }, { "synchronized", 1, "diff:hub-0" })
    start({ Name = "N_Combat01", __runPlannerExecutionRoomId = "m1" })
    restore()
    lu.assertEquals({ state.state, state.route.currentOccurrence.id, #state.snaps }, { "synchronized", "m1", 1 })
end

function TestSnapMode.testAnOutOfSyncHubRevisitStampsItsSlotDoorsAndForcesThePlannedOne()
    local state = ephyraAt(5, nil, "s2")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local planned = { ObjectId = 102, Room = { Name = "N_Combat02" } }
    local taken = { ObjectId = 103, Room = { Name = "N_Combat03" } }
    local other = { ObjectId = 101, Room = { Name = "N_Combat09" } }
    local leave, _, _, restore, callbacks = attached(state, true, nil, nil, {
        offered = { [101] = other, [102] = planned, [103] = taken }, roomData = ephyraRoomData, navigationHooks = true,
    })
    local hubRoom = { Name = "N_Hub" }
    callbacks.DoUnlockRoomExits(nil, {}, function() end, { CurrentRoom = hubRoom }, hubRoom)
    lu.assertEquals({ planned.Room.__runPlannerExecutionRoomId, taken.Room.__runPlannerExecutionRoomId,
        other.Room.__runPlannerExecutionRoomId }, { "m2", "m3", nil })
    lu.assertIs(leave("N_Hub", taken), planned)
    restore()
    lu.assertEquals({ state.state, state.route.index, state.snaps[1].occurrenceId }, { "synchronized", 5, "m2" })
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
    lu.assertEquals({ state.state, state.route.index, state.snaps[1].occurrenceId }, { "synchronized", 2, "m1" })

    local closed = ephyraAt(1, "N_PreHub01")
    session.mismatch(closed, { checkpoint = "room-exit-conformance:traitInventory" })
    local closedLeave, _, _, closedRestore = attached(closed, true, nil, nil, { offered = { [60] = chaos } })
    lu.assertIs(closedLeave("N_PreHub01", chaos), chaos)
    closedRestore()
    lu.assertEquals({ closed.state, #closed.snaps }, { "desynchronized", 0 })
end

function TestSnapMode.testAnOutOfSyncHubSkipsAnUnsteeredSlotDoorForTheFinalHandoff()
    local state = ephyraAt(5, nil, "s2")
    session.mismatch(state, { checkpoint = "room-exit-conformance:traitInventory" })
    local native = { ObjectId = 102, Room = { Name = "N_Combat02" } }
    local handoff = { ObjectId = 400, Room = { Name = "N_PreBoss01", __runPlannerExecutionRoomId = "boss" } }
    local leave, _, log, restore = attached(state, true, nil, nil, { offered = { [102] = native, [400] = handoff } })
    lu.assertIs(leave("N_Hub", native), handoff)
    restore()
    lu.assertEquals({ state.state, state.snaps[1].occurrenceId }, { "synchronized", "boss" })
    -- The skipped visit's departure: two main-room visits precede the handoff.
    lu.assertEquals(log.order, { "correct:hub-2", "base" })
end

function TestSnapMode.testARoomEnteredOutOfSyncIsFoundByNameAndResumesAtItsSuccessor()
    local state = desynchronized(3)
    assert(route.exit(state.route))
    local leave, start, log, restore = attached(state, true)
    local door = { Room = { Name = "G_X" } }
    leave("G_A", door)
    lu.assertEquals({ door.Room.__runPlannerExecutionRoomId, log.order }, { "h", { "correct:g", "base" } })
    lu.assertEquals({ state.state, state.route.index, state.route.lastExitedOccurrence.id }, { "synchronized", 5, "g" })
    start({ Name = "G_B", __runPlannerExecutionRoomId = "h" })
    restore()
    lu.assertEquals(state.route.currentOccurrence.id, "h")
end

function TestSnapMode.testAnOutOfSyncMainRoomRebuildsItsPlannedSideDoorAndStampsMatchingOnes()
    local state = desynchronized(2, "trait-offer-blocked-row", ephyraPlan())
    local native = { ObjectId = 201, Name = "SideDoor", Room = { Name = "N_Sub09" } }
    local matching = { ObjectId = 202, Name = "SideDoor", Room = { Name = "N_Sub02" } }
    local leave, start, log, restore, callbacks = attached(state, true, corrected(), nil, {
        offered = { [201] = native, [202] = matching, [300] = hubReturn() }, roomData = ephyraRoomData,
        navigationHooks = true,
    })
    local mainRoom = { Name = "N_Combat01", __runPlannerExecutionRoomId = "m1" }
    callbacks.DoUnlockRoomExits(nil, {}, function() end, { CurrentRoom = mainRoom }, mainRoom)
    lu.assertEquals({ native.Room.__runPlannerExecutionRoomId, matching.Room.__runPlannerExecutionRoomId }, { nil, "s2" })
    lu.assertIs(leave({ CurrentRoom = { Name = "N_Combat01" } }, hubReturn()), native)
    lu.assertEquals({ native.Room.Name, native.Room.__runPlannerExecutionRoomId, #log.created }, { "N_Sub01", "s1", 1 })
    lu.assertEquals(log.order, { "correct:m1", "base" })
    lu.assertEquals({ state.state, state.route.index, state.snaps[1].occurrenceId }, { "synchronized", 3, "s1" })
    start({ Name = "N_Sub01", __runPlannerExecutionRoomId = "s1" })
    restore()
    lu.assertEquals(state.route.currentOccurrence.id, "s1")
end

function TestSnapMode.testAnOutOfSyncMainRoomNeverSkipsAnUnofferedPlannedSideRoom()
    local state = desynchronized(2, "trait-offer-blocked-row", ephyraPlan())
    local taken = hubReturn()
    local leave, _, log, restore = attached(state, true, corrected(), nil, {
        offered = { [300] = taken }, roomData = ephyraRoomData,
    })
    lu.assertIs(leave({ CurrentRoom = { Name = "N_Combat01" }, RoomHistory = { { Name = "N_Hub" } } }, taken), taken)
    restore()
    lu.assertEquals({ state.state, #state.snaps, log.order }, { "desynchronized", 0, { "correct:m1", "base" } })
end
