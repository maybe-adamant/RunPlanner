-- luacheck: globals TestLockedDoors
-- Oceanus locked door witnesses over the planner's locked-door fixture: the
-- lock roll steered to the plan, the press's fight composed at its generation,
-- and the state-based count of fights at room exit.
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local protocol = require("mods.protocol.decoder")
local lockedDoors = require("mods.room.features.locked_doors")
local support = require("tests.harness.hook_composition")
local guide = require("mods.presentation.room_guide")
local text = require("mods.presentation.mismatch_text")

TestLockedDoors = {}

local FIGHT = "GeneratedG_ExtraDoor"

local function occurrenceOf(id)
    local plan = assert(protocol.decode(fixtures.decode("underworld-g-locked-doors.execution.json")))
    return assert(plan.occurrencesById[id], id)
end

local function pressedRoom() return occurrenceOf("golden-g-b1-e1") end
local function unpressedRoom() return occurrenceOf("golden-g-b2-e1") end
local function openRoom() return occurrenceOf("golden-g-b4-e1") end

-- The shipped hooks over a synchronized room.
local function attached(occurrence)
    local module, _, callbacks = support.capture()
    local state = { state = "synchronized" }
    local active = { occurrence = occurrence }
    local diagnostics, phases = {}, {}
    local room = { current = function() return active end }
    local generated = {
        withSwitchEncounter = function(_, _, phase, action)
            phases[#phases + 1] = phase
            return action()
        end,
    }
    lockedDoors.attach(module, { diagnostic = function(_, _, observed) diagnostics[#diagnostics + 1] = observed end },
        function() return state end, function() end, room, generated)
    return callbacks, diagnostics, phases, state
end

local function withRoom(nativeRoom, action)
    local prior = _G.CurrentRun
    _G.CurrentRun = { CurrentRoom = nativeRoom, EncountersCompletedCache = {} }
    local ok, errorValue = pcall(action, _G.CurrentRun)
    _G.CurrentRun = prior
    if not ok then error(errorValue, 0) end
end

-- One native door per planned target, in processing order.
local function nativeDoors(occurrence)
    local result = {}
    for index, target in ipairs(occurrence.doors.targets) do
        result[index] = { ObjectId = index, __runPlannerExecutionDoorTarget = target.room.id,
            LockedWithEncounterChance = 0.8 }
    end
    return result
end

-- RoomLogic.CheckExitPreUnlock: the first door is chosen open, later ones lock
-- when the room's flag is set and their chance succeeds (RandomChance(nil) fails).
local function preUnlock(room)
    return function(door, _, index)
        room.FirstExitChosen = room.FirstExitChosen or false
        if room.LockExtraExitsWithEncounter ~= nil and room.LockExtraExits and room.FirstExitChosen then
            if door.LockedWithEncounterChance ~= nil and door.LockedWithEncounterChance >= 0.5 then
                door.SkipUnlock = true
                door.CanBeRerolled = false
                door.EncounterCost = room.LockExtraExitsWithEncounter
            end
        else
            room.FirstExitChosen = true
        end
        return index
    end
end

local function rollLocks(callbacks, occurrence, nativeFlag)
    local room = { __runPlannerExecutionRoomId = occurrence.id, LockExtraExitsWithEncounter = FIGHT,
        LockExtraExits = nativeFlag }
    local doors = nativeDoors(occurrence)
    withRoom(room, function()
        for index, door in ipairs(doors) do
            callbacks.CheckExitPreUnlock(nil, {}, preUnlock(room), door, {}, index)
        end
    end)
    local locked = {}
    for index, door in ipairs(doors) do
        locked[index] = door.EncounterCost ~= nil
        lu.assertEquals(door.LockedWithEncounterChance, 0.8)
    end
    return locked, room, doors
end

function TestLockedDoors.testTheFixturePublishesLocksPressesAndFights()
    lu.assertEquals(lockedDoors.plannedFights(pressedRoom()), 1)
    lu.assertEquals(lockedDoors.plannedFights(unpressedRoom()), 0)
    lu.assertEquals(lockedDoors.plannedFights(openRoom()), 0)
    local phase = lockedDoors.phase(pressedRoom(), "exit2")
    lu.assertEquals(phase.slotKey, "unlockExit:exit2")
    lu.assertEquals(phase.encounterKey, FIGHT)
    lu.assertEquals(phase.customization[1].kind, "generated")
    lu.assertNil(lockedDoors.phase(unpressedRoom(), "exit2"))
    lu.assertEquals(lockedDoors.markedPhase(pressedRoom(), "unlockExit:exit2").slotKey, "unlockExit:exit2")
    local rows = {}
    for _, row in ipairs(pressedRoom().roomGuide) do
        if row.description.kind == "unlockExit" then rows[#rows + 1] = row.description end
    end
    lu.assertEquals(rows, { { kind = "unlockExit", exitKey = "exit2" } })
end

function TestLockedDoors.testTheGuideNamesThePressedDoor()
    local projection = guide.project({ kind = "room", occurrence = pressedRoom(),
        isCompleted = function() return false end, shrineProgress = function() return "pending" end })
    local found = false
    for _, row in ipairs(projection and projection.rows or {}) do
        if row.instruction == "Unlock door 2" then found = true end
    end
    lu.assertTrue(found)
end

function TestLockedDoors.testThePlannedDoorsLockAndNoOtherDoes()
    local callbacks = attached(unpressedRoom())
    -- The room's flag is the plan's, whatever native rolled at creation.
    local locked, room = rollLocks(callbacks, unpressedRoom(), nil)
    lu.assertEquals(locked, { false, true, true })
    lu.assertTrue(room.LockExtraExits)
    callbacks = attached(pressedRoom())
    lu.assertEquals(rollLocks(callbacks, pressedRoom(), true), { false, true })
    -- A planned room without locks opens every door, a native flag included.
    callbacks = attached(openRoom())
    locked, room = rollLocks(callbacks, openRoom(), true)
    lu.assertEquals(locked, { false, false })
    lu.assertNil(room.LockExtraExits)
end

function TestLockedDoors.testAnUnsynchronizedRoomKeepsTheNativeRoll()
    local callbacks, _, _, state = attached(openRoom())
    state.state = "desynchronized"
    lu.assertEquals(rollLocks(callbacks, openRoom(), true), { false, true })
end

function TestLockedDoors.testAPlannedPressComposesItsFight()
    local occurrence = pressedRoom()
    local callbacks, diagnostics, phases = attached(occurrence)
    local room = { __runPlannerExecutionRoomId = occurrence.id, LockExtraExitsWithEncounter = FIGHT }
    local door = nativeDoors(occurrence)[2]
    door.EncounterCost = FIGHT
    withRoom(room, function(run)
        callbacks.AttemptUseDoor(nil, {}, function(pressed)
            local encounter = { Name = pressed.EncounterCost }
            callbacks.GenerateEncounter(nil, {}, function() end, run, room, encounter)
            pressed.EncounterCostStarted = true
            pressed.EncounterCost = nil
        end, door, {})
    end)
    lu.assertEquals(diagnostics, {})
    lu.assertEquals(#phases, 1)
    lu.assertEquals(phases[1].slotKey, "unlockExit:exit2")
    -- The second press traverses; no fight is generated again.
    withRoom(room, function(run)
        callbacks.AttemptUseDoor(nil, {}, function()
            callbacks.GenerateEncounter(nil, {}, function() end, run, room, { Name = FIGHT })
        end, door, {})
    end)
    lu.assertEquals(#phases, 1)
end

function TestLockedDoors.testAnUnplannedPressIsNativeAndReported()
    local occurrence = unpressedRoom()
    local callbacks, diagnostics, phases = attached(occurrence)
    local room = { __runPlannerExecutionRoomId = occurrence.id, LockExtraExitsWithEncounter = FIGHT }
    local door = nativeDoors(occurrence)[3]
    door.EncounterCost = FIGHT
    withRoom(room, function(run)
        callbacks.AttemptUseDoor(nil, {}, function()
            callbacks.GenerateEncounter(nil, {}, function() end, run, room, { Name = FIGHT })
        end, door, {})
    end)
    lu.assertEquals(phases, {})
    lu.assertEquals(diagnostics, { { kind = "unplanned-unlock", exitKey = "exit3" } })
end

function TestLockedDoors.testExitCountsTheFightsFoughtInTheRoom()
    local occurrence = pressedRoom()
    local room = { LockExtraExitsWithEncounter = FIGHT }
    local run = { CurrentRoom = room, EncountersCompletedCache = { [FIGHT] = 2 } }
    lockedDoors.recordEntry(room, run)
    local ok, issue = lockedDoors.proveFights(occurrence, room, run)
    lu.assertNil(ok)
    lu.assertEquals(issue, { kind = "lockedDoorFights", expected = 1, observed = 0 })
    run.EncountersCompletedCache[FIGHT] = 3
    lu.assertTrue(lockedDoors.proveFights(occurrence, room, run))
    -- A fight the plan does not have is a mismatch, in a room planned without fights too.
    local open = { LockExtraExitsWithEncounter = FIGHT }
    lockedDoors.recordEntry(open, run)
    run.EncountersCompletedCache[FIGHT] = 4
    ok, issue = lockedDoors.proveFights(openRoom(), open, run)
    lu.assertNil(ok)
    lu.assertEquals(issue, { kind = "lockedDoorFights", expected = 0, observed = 1 })
    -- A room that cannot lock proves nothing.
    lu.assertTrue(lockedDoors.proveFights(openRoom(), {}, run))
end

function TestLockedDoors.testTheMismatchReadsAsFoughtDoors()
    lu.assertEquals(text.difference({ kind = "lockedDoorFights", expected = 1, observed = 0 }),
        "fought 0 locked doors (planned 1)")
end

return TestLockedDoors
