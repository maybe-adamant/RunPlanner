-- luacheck: globals TestPhantomExit
local lu = require("luaunit")
local navigation = require("mods.navigation.hooks")
local ephyra = require("mods.navigation.ephyra")
local routeSession = require("mods.route.session")
local support = require("tests.harness.hook_composition")
local capture, stub = support.capture, support.stub

TestPhantomExit = {}

local GLOBALS = { "MapState", "game", "CurrentRun", "CollapseTableOrdered" }

local function withGlobals(values, body)
    local prior = {}
    for _, key in ipairs(GLOBALS) do prior[key] = _G[key] end
    for _, key in ipairs(GLOBALS) do _G[key] = values[key] end
    local ok, err = pcall(body)
    for _, key in ipairs(GLOBALS) do _G[key] = prior[key] end
    if not ok then error(err, 0) end
end

-- Attaches the navigation hooks to a synchronized route entered at `id`.
local function attached(plan, id, gameName)
    local module, _, callbacks = capture()
    local cursor = routeSession.new(plan)
    assert(routeSession.enter(cursor, id, gameName))
    local state = { state = "synchronized", plan = plan, route = cursor }
    local mismatches = {}
    local session = stub()
    session.mismatch = function(_, errorValue) mismatches[#mismatches + 1] = errorValue end
    local scope = navigation.attach(module, session, function() return state end, function() end,
        routeSession, { checkpoint = function() return true end, window = function() return true end })
    return callbacks, scope, state, mismatches
end

-- Native DoUnlockRoomExits for the given doors: chooses each unassigned door's room
-- through ChooseNextRoomData, then its reward from the room's store, then assigns it.
local function nativeUnlock(callbacks, run, nativeRoom, doorsInOrder, nativeChoice)
    return function()
        for _, door in ipairs(doorsInOrder) do
            local data = callbacks.ChooseNextRoomData(nil, {}, function() return nativeChoice end,
                run, door.ChooseRoomArgs, doorsInOrder)
            local created = {}
            for key, value in pairs(data) do created[key] = value end
            created.RewardStoreName = created.IndividualRewardStore or "HubRewards"
            created.ChosenRewardType = callbacks.ChooseRoomReward(nil, {},
                function(currentRun, candidate, store)
                    if candidate.ForcedReward ~= nil then return candidate.ForcedReward end
                    for _, reward in ipairs(currentRun.RewardStores[store] or {}) do
                        if callbacks.IsRoomRewardEligible(nil, {}, function() return true end,
                            currentRun, candidate, reward, {}, {}) then return reward.Name end
                    end
                end, run, created, created.RewardStoreName, {}, { Door = door })
            if created.ChosenRewardType ~= nil then
                callbacks.SetupRoomReward(nil, {}, function() end, run, created, {}, { Door = door })
            end
            callbacks.AssignRoomToExitDoor(nil, {}, function(assignedDoor, room)
                assignedDoor.Room = room
                nativeRoom.ExitDoorRooms[assignedDoor.ObjectId] = room.Name
                nativeRoom.OfferedRewards = nativeRoom.OfferedRewards or {}
                if room.ChosenRewardType ~= nil then
                    nativeRoom.OfferedRewards[assignedDoor.ObjectId] = {
                        Type = room.ChosenRewardType, ForceLootName = room.ForceLootName,
                    }
                end
            end, door, created)
        end
    end
end

local ROOM_DATA = {
    N_Shop01 = { Name = "N_Shop01", ForcedReward = "Shop" },
    N_Combat01 = { Name = "N_Combat01" },
    N_Sub01 = { Name = "N_Sub01", IndividualRewardStore = "SubRoomRewards" },
    N_Sub02 = { Name = "N_Sub02", IndividualRewardStore = "SubRoomRewards" },
    N_Wrong = { Name = "N_Wrong" },
}

local function runWith(nativeRoom)
    return {
        CurrentRoom = nativeRoom, NumSubRoomsSpawned = 0,
        RewardStores = {
            HubRewards = { { Name = "MaxHealthDrop" }, { Name = "Boon" } },
            SubRoomRewards = { { Name = "MaxManaDrop" }, { Name = "MaxHealthDrop" } },
        },
    }
end

function TestPhantomExit.testMiniBossWithoutSideDoorsDrawsThePlannedReturnDoor()
    local main = {
        id = "mini", gameName = "N_MiniBoss01", biomeKey = "N",
        overview = { phantomExit = {
            placeholderRoomGameName = "N_Combat01",
            reward = { rewardType = "Boon", storeKey = "HubRewards", source = "ZeusUpgrade" },
        } },
        doors = { kind = "terminal" },
    }
    local plan = { selectedOccurrenceIds = { "mini" }, occurrencesById = { mini = main } }
    local callbacks, scope, state = attached(plan, "mini", "N_MiniBoss01")
    local returnDoor = { ObjectId = 999, Name = "EphyraExitDoorReturn", ReturnToPreviousRoomName = "N_Hub" }
    local nativeRoom = { Name = "N_MiniBoss01", TimesVisited = 1, ExitDoorRooms = {} }
    local run = runWith(nativeRoom)
    local proved, errorValue
    withGlobals({
        CurrentRun = run, game = { RoomData = ROOM_DATA },
        MapState = { OfferedExitDoors = { [999] = returnDoor } },
        CollapseTableOrdered = function() return { returnDoor } end,
    }, function()
        callbacks.DoUnlockRoomExits(nil, {}, nativeUnlock(callbacks, run, nativeRoom, { returnDoor }, ROOM_DATA.N_Wrong),
            run, nativeRoom)
        -- The used return door carries the Hub; the room's records keep the hidden draw.
        returnDoor.Room = { Name = "N_Hub" }
        proved, errorValue = scope.proveOutgoingDoors(state, run)
    end)

    lu.assertEquals(returnDoor.ChooseRoomArgs.RunPlannerEphyraDoorId, 999)
    lu.assertEquals(nativeRoom.ExitDoorRooms[999], "N_Combat01")
    lu.assertEquals(nativeRoom.OfferedRewards[999], { Type = "Boon", ForceLootName = "ZeusUpgrade" })
    lu.assertTrue(proved, errorValue)
end

function TestPhantomExit.testNoDrawPlaceholderKeepsItsNativeReward()
    local main = {
        id = "main", gameName = "N_Combat02", biomeKey = "N",
        overview = {
            phantomExit = { placeholderRoomGameName = "N_Shop01" },
            localSlots = { {
                slotKey = "side1", physicalDoorId = 201, generation = "generated",
                room = { id = "side", biomeKey = "N", gameName = "N_Sub01" },
                reward = { rewardType = "MaxHealthDrop", resolvedStoreKey = "SubRoomRewards" },
            } },
        },
        doors = { kind = "terminal" },
    }
    local side = { id = "side", gameName = "N_Sub01", biomeKey = "N", overview = {} }
    local plan = { selectedOccurrenceIds = { "main", "side" }, occurrencesById = { main = main, side = side } }
    local callbacks, _, _, mismatches = attached(plan, "main", "N_Combat02")
    local returnDoor = { ObjectId = 999, Name = "EphyraExitDoorReturnNE", ReturnToPreviousRoomName = "N_Hub" }
    local sideDoor = { ObjectId = 201, Name = "N_SubRoomDoor", ChooseRoomArgs = { ForceNextRoomSet = "N_SubRooms" } }
    local nativeRoom = { Name = "N_Combat02", TimesVisited = 1, ExitDoorRooms = {} }
    local run = runWith(nativeRoom)
    withGlobals({
        CurrentRun = run, game = { RoomData = ROOM_DATA },
        MapState = { OfferedExitDoors = { [999] = returnDoor, [201] = sideDoor } },
        CollapseTableOrdered = function() return { returnDoor, sideDoor } end,
    }, function()
        callbacks.DoUnlockRoomExits(nil, {},
            nativeUnlock(callbacks, run, nativeRoom, { returnDoor, sideDoor }, ROOM_DATA.N_Wrong), run, nativeRoom)
    end)

    lu.assertEquals(#mismatches, 0)
    lu.assertEquals(returnDoor.Room.Name, "N_Shop01")
    lu.assertNil(returnDoor.Room.__runPlannerExecutionRoomId)
    lu.assertEquals(returnDoor.Room.ChosenRewardType, "Shop")
    lu.assertEquals(sideDoor.Room.Name, "N_Sub01")
    lu.assertEquals(sideDoor.Room.__runPlannerExecutionRoomId, "side")
    lu.assertEquals(sideDoor.Room.ChosenRewardType, "MaxHealthDrop")
end

function TestPhantomExit.testSideRoomReturnDoorDrawsFromItsPlaceholderStore()
    local main = {
        id = "main", gameName = "N_Combat02", biomeKey = "N",
        overview = { localSlots = { {
            slotKey = "side1", physicalDoorId = 201, generation = "generated",
            room = { id = "side", biomeKey = "N", gameName = "N_Sub01" },
            reward = { rewardType = "MaxHealthDrop", resolvedStoreKey = "SubRoomRewards" },
        } } },
        doors = { kind = "terminal" },
    }
    local side = {
        id = "side", gameName = "N_Sub01", biomeKey = "N",
        overview = { phantomExit = {
            placeholderRoomGameName = "N_Sub02",
            reward = { rewardType = "MaxHealthDrop", storeKey = "SubRoomRewards" },
        } },
        doors = { kind = "terminal" },
    }
    -- The side visit is the route's current occurrence; its parent stays in the plan.
    local plan = { selectedOccurrenceIds = { "side" }, occurrencesById = { main = main, side = side } }
    local callbacks, scope, state, mismatches = attached(plan, "side", "N_Sub01")
    local returnDoor = { ObjectId = 77, Name = "N_SubRoomDoorReturn", ReturnToPreviousRoom = true }
    local nativeRoom = { Name = "N_Sub01", TimesVisited = 1, ExitDoorRooms = {} }
    local run = runWith(nativeRoom)
    local proved, errorValue
    withGlobals({
        CurrentRun = run, game = { RoomData = ROOM_DATA },
        MapState = { OfferedExitDoors = { [77] = returnDoor } },
        CollapseTableOrdered = function() return { returnDoor } end,
    }, function()
        callbacks.DoUnlockRoomExits(nil, {},
            nativeUnlock(callbacks, run, nativeRoom, { returnDoor }, ROOM_DATA.N_Wrong), run, nativeRoom)
        proved, errorValue = scope.proveOutgoingDoors(state, run)
    end)

    lu.assertEquals(#mismatches, 0)
    lu.assertEquals(returnDoor.Room.Name, "N_Sub02")
    lu.assertEquals(returnDoor.Room.RewardStoreName, "SubRoomRewards")
    lu.assertEquals(returnDoor.Room.ChosenRewardType, "MaxHealthDrop")
    lu.assertTrue(proved, errorValue)
end

function TestPhantomExit.testBindingWithAndWithoutSideSlots()
    local phantom = { placeholderRoomGameName = "N_Combat01" }
    local game = { RoomData = ROOM_DATA }
    local withSlots = {
        gameName = "N_Combat02",
        overview = { phantomExit = phantom, localSlots = { {
            slotKey = "side1", physicalDoorId = 201, generation = "generated",
            room = { id = "side", gameName = "N_Sub01" }, reward = { rewardType = "MaxHealthDrop" },
        } } },
    }
    local returnDoor = { ObjectId = 999, Name = "EphyraExitDoorReturn" }
    local sideDoor = { ObjectId = 201, Name = "N_SubRoomDoor" }
    local scope = assert(ephyra.scope({}, withSlots, { Name = "N_Combat02", TimesVisited = 1 }, game))
    ephyra.bindNativeDoors(scope, { sideDoor, returnDoor })
    lu.assertTrue(scope.byDoor[999].phantom)
    lu.assertEquals(scope.byDoor[201].room.id, "side")
    lu.assertEquals(returnDoor.ChooseRoomArgs.RunPlannerEphyraDoorId, 999)
    local chosen = ephyra.chooseSideRoom(scope, returnDoor.ChooseRoomArgs, game)
    lu.assertEquals(chosen.Name, "N_Combat01")
    lu.assertNil(chosen.__runPlannerExecutionRoomId)

    local withoutSlots = { gameName = "N_MiniBoss01", overview = { phantomExit = phantom } }
    local nativeRoom = { Name = "N_MiniBoss01" }
    scope = assert(ephyra.scope({}, withoutSlots, nativeRoom, game))
    ephyra.bindNativeDoors(scope, { { ObjectId = 5, Name = "EphyraExitDoorReturn" } })
    lu.assertTrue(scope.byDoor[5].phantom)

    -- A restored room reuses its recorded draw: nothing is steered or proved.
    nativeRoom.TimesVisited = 2
    lu.assertNil(ephyra.scope({}, withoutSlots, nativeRoom, game))
    scope = assert(ephyra.scope({}, withSlots, { Name = "N_Combat02", RestoreUnlockRoomExits = true }, game))
    local restoredReturn = { ObjectId = 999, Name = "EphyraExitDoorReturn" }
    ephyra.bindNativeDoors(scope, { restoredReturn })
    lu.assertNil(scope.byDoor[999])
    lu.assertNil(restoredReturn.ChooseRoomArgs)
    -- Another occurrence's phantom exit never steers this room.
    lu.assertNil(ephyra.scope({}, withoutSlots, { Name = "N_Combat03" }, game))
end

function TestPhantomExit.testConformanceChecksTheRecordedRoomAndReward()
    local phantom = {
        placeholderRoomGameName = "N_Combat01",
        reward = { rewardType = "Boon", storeKey = "HubRewards", source = "ZeusUpgrade" },
    }
    local occurrence = { gameName = "N_MiniBoss01", overview = { phantomExit = phantom } }
    local function prove(nativeRoom, doors)
        local scope = assert(ephyra.scope({}, occurrence, nativeRoom, { RoomData = {} }))
        return ephyra.prove(scope, doors)
    end
    local returnDoor = { ObjectId = 9, Name = "EphyraExitDoorReturn", Room = { Name = "N_Hub" } }
    local function room(exitRoom, offered)
        return { Name = "N_MiniBoss01", ExitDoorRooms = { [9] = exitRoom }, OfferedRewards = { [9] = offered } }
    end

    lu.assertTrue(prove(room("N_Combat01", { Type = "Boon", ForceLootName = "ZeusUpgrade" }), { returnDoor }))
    local _, missing = prove(room("N_Combat01", {}), { { ObjectId = 3, Name = "N_SubRoomDoor" } })
    lu.assertEquals(missing.kind, "ephyraReturnDoorMissing")
    local _, wrongRoom = prove(room("N_Shop01", { Type = "Boon" }), { returnDoor })
    lu.assertEquals(wrongRoom, {
        kind = "ephyraReturnDoorRoom", doorId = 9, expected = "N_Combat01", observed = "N_Shop01",
    })
    local _, wrongReward = prove(room("N_Combat01", { Type = "MaxHealthDrop" }), { returnDoor })
    lu.assertEquals(wrongReward.kind, "ephyraReturnDoorReward")
    lu.assertEquals(wrongReward.observed, "MaxHealthDrop")
    local _, wrongSource = prove(room("N_Combat01", { Type = "Boon", ForceLootName = "HeraUpgrade" }), { returnDoor })
    lu.assertEquals(wrongSource.kind, "ephyraReturnDoorRewardSource")
    lu.assertEquals(wrongSource.expected, "ZeusUpgrade")
end

function TestPhantomExit.testDesynchronizedUnlockLeavesTheReturnDoorNative()
    local main = {
        id = "mini", gameName = "N_MiniBoss01", biomeKey = "N",
        overview = { phantomExit = { placeholderRoomGameName = "N_Shop01" } },
        doors = { kind = "terminal" },
    }
    local plan = { selectedOccurrenceIds = { "mini" }, occurrencesById = { mini = main } }
    local callbacks, _, state = attached(plan, "mini", "N_MiniBoss01")
    state.state = "desynchronized"
    local returnDoor = { ObjectId = 999, Name = "EphyraExitDoorReturn" }
    local nativeRoom = { Name = "N_MiniBoss01", TimesVisited = 1, ExitDoorRooms = {} }
    local run = runWith(nativeRoom)
    local chosen
    withGlobals({
        CurrentRun = run, game = { RoomData = ROOM_DATA },
        MapState = { OfferedExitDoors = { [999] = returnDoor } },
        CollapseTableOrdered = function() return { returnDoor } end,
    }, function()
        callbacks.DoUnlockRoomExits(nil, {}, function()
            chosen = callbacks.ChooseNextRoomData(nil, {}, function() return ROOM_DATA.N_Wrong end,
                run, returnDoor.ChooseRoomArgs, { returnDoor })
        end, run, nativeRoom)
    end)

    lu.assertNil(returnDoor.ChooseRoomArgs)
    lu.assertEquals(chosen.Name, "N_Wrong")
end

return TestPhantomExit
