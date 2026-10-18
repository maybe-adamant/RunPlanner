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

-- F_A then F_B, F_C, then G_A across a biome edge, plus an N hub carrier.
local function plan()
    local rows = {
        occurrence("a", "F_A", "F"), occurrence("b", "F_B", "F"), occurrence("c", "F_C", "F"),
        occurrence("g", "G_A", "G"),
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
local function attached(state, snapOn, apply, rewardProof)
    local module, _, callbacks = support.capture()
    local log = { created = {} }
    local room = {
        prepare = function() return {} end,
        realize = function(_, target) return { Name = target.gameName, __runPlannerExecutionRoomId = target.id } end,
        enter = function() end, bindEntryEncounters = function() end, proveEntry = function() end,
        close = function() end,
    }
    local navigation = {
        realizeIncomingReward = function(_, data) return data end,
        proveIncomingReward = rewardProof or function() return true end,
        proveOutgoingDoors = function() return true end,
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
    local restore = nativeGame.install({
        game = { CreateRoom = function(data)
            log.created[#log.created + 1] = data
            return { Name = data.Name, __runPlannerExecutionRoomId = data.__runPlannerExecutionRoomId }
        end },
    })
    local function leave(currentRoomName, door)
        local passed
        callbacks.LeaveRoom(nil, runtime, function(_, value) passed = value end,
            { CurrentRoom = { Name = currentRoomName } }, door)
        return passed
    end
    local function start(nativeRoom)
        callbacks.StartRoom(nil, runtime, function() end, { CurrentRoom = nativeRoom }, nativeRoom)
    end
    return leave, start, log, restore
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
    local door = { Room = { Name = "F_B" } }
    leave("F_A", door)
    restore()
    lu.assertEquals(door.Room.__runPlannerExecutionRoomId, "b")
    lu.assertEquals(log.created, {})
    lu.assertEquals({ state.state, state.reason, state.route.index }, { "synchronized", "snap-pending", 2 })
    lu.assertEquals(state.snapPending.mismatch.checkpoint, "room-exit-conformance:traitInventory")
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

function TestSnapMode.testDeclinesBiomeEdgesHubsMissingFramesAndUnsnappableSessions()
    local edge = desynchronized(3)
    lu.assertEquals({ mode.target(edge, "F_C") }, { nil, "declined" })
    local hub = desynchronized(1)
    hub.plan.occurrencesById.b.overview.hub = { room = { gameName = "N_Hub" }, slots = {} }
    lu.assertEquals({ mode.target(hub, "F_A") }, { nil, "declined" })
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
