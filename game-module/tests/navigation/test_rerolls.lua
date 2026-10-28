-- luacheck: globals TestRerolls
local lu = require("luaunit")
local navigation = require("mods.navigation.hooks")
local routeSession = require("mods.route.session")
local support = require("tests.harness.hook_composition")
local capture, stub = support.capture, support.stub

TestRerolls = {}

local GLOBALS = { "MapState", "game", "CurrentRun", "CollapseTableOrdered" }

local function withGlobals(values, body)
    local prior = {}
    for _, key in ipairs(GLOBALS) do prior[key] = _G[key] end
    for _, key in ipairs(GLOBALS) do _G[key] = values[key] end
    local ok, err = pcall(body)
    for _, key in ipairs(GLOBALS) do _G[key] = prior[key] end
    if not ok then error(err, 0) end
end

local function attached(plan, id, gameName)
    local module, _, callbacks = capture()
    local cursor = routeSession.new(plan)
    if id ~= nil then assert(routeSession.enter(cursor, id, gameName)) end
    local state = { state = "synchronized", plan = plan, route = cursor }
    local mismatches = {}
    local session = stub()
    session.mismatch = function(_, errorValue)
        mismatches[#mismatches + 1] = errorValue
        state.state = "desynchronized"
    end
    local scope = navigation.attach(module, session, function() return state end, function() end,
        routeSession, { checkpoint = function() return true end, window = function() return true end })
    return callbacks, scope, state, mismatches
end

local function reward(rewardType, source)
    return { rewardType = rewardType, producerLifecycleKey = "room", source = source }
end

-- A source room whose first door is rerolled twice; its destination is entered
-- with the last reroll. The third door leads into Fields with two cages.
local function plan()
    local source = {
        id = "src", gameName = "H_Combat01", biomeKey = "H", overview = {},
        rerolls = {
            { owner = "r1", target = { kind = "door", exitKey = "exit1" }, reward = reward("GiftDrop") },
            { owner = "r2", target = { kind = "cage", exitKey = "exit3", cageIndex = 2 },
                reward = reward("MaxManaDrop") },
            { owner = "r3", target = { kind = "door", exitKey = "exit1" }, reward = reward("Boon", "ApolloUpgrade") },
        },
        doors = { kind = "batch", owner = "batch", targets = {
            { exitKey = "exit1", index = 0, room = { id = "a", biomeKey = "H", gameName = "H_Combat02" },
                reward = reward("MaxHealthDrop") },
            { exitKey = "exit2", index = 1, room = { id = "b", biomeKey = "H", gameName = "H_Combat03" },
                reward = reward("Boon", "ZeusUpgrade") },
            { exitKey = "exit3", index = 2, room = { id = "c", biomeKey = "H", gameName = "H_Combat04" },
                cageRewards = { reward("RoomMoneyDrop"), reward("MaxHealthDrop") } },
        } },
    }
    local a = { id = "a", gameName = "H_Combat02", biomeKey = "H",
        overview = { incomingReward = reward("Boon", "ApolloUpgrade") } }
    local b = { id = "b", gameName = "H_Combat03", biomeKey = "H",
        overview = { incomingReward = reward("Boon", "ZeusUpgrade") } }
    local c = { id = "c", gameName = "H_Combat04", biomeKey = "H", overview = {} }
    return { selectedOccurrenceIds = { "src", "a" }, occurrencesById = { src = source, a = a, b = b, c = c } }
end

local function runWith()
    return {
        CurrentRoom = { Name = "H_Combat01", OfferedRewards = {} },
        RewardStores = { RunProgress = {
            { Name = "MaxHealthDrop" }, { Name = "GiftDrop" }, { Name = "Boon" }, { Name = "MaxManaDrop" },
        } },
    }
end

-- Native ChooseRoomReward over the run's store through the eligibility contact.
local function nativeChoose(callbacks)
    return function(run, room, store)
        for index, entry in ipairs(run.RewardStores[store] or {}) do
            if callbacks.IsRoomRewardEligible(nil, {}, function() return true end, run, room, entry, {}, {}) then
                table.remove(run.RewardStores[store], index)
                return entry.Name
            end
        end
    end
end

-- Native AttemptRerollDoor: one draw and setup without the Door argument.
local function nativeDoorReroll(callbacks)
    return function(run, door)
        local room = door.Room
        room.ForceLootName = nil
        room.ChosenRewardType = callbacks.ChooseRoomReward(nil, {}, nativeChoose(callbacks), run, room,
            room.RewardStoreName, {}, { IgnoreGameStateRequirements = false })
        callbacks.SetupRoomReward(nil, {}, function() end, run, room, {})
    end
end

local function door(objectId, roomId, gameName)
    return { ObjectId = objectId, Room = {
        Name = gameName, RewardStoreName = "RunProgress", __runPlannerExecutionRoomId = roomId,
    } }
end

function TestRerolls.testUnlockDrawsARerolledDoorsFirstDraw()
    local callbacks = attached(plan(), "src", "H_Combat01")
    local run = runWith()
    local room = door(1, "a", "H_Combat02").Room
    room.ForceLootName = "ApolloUpgrade"
    local chosen
    withGlobals({ CurrentRun = run }, function()
        chosen = callbacks.ChooseRoomReward(nil, {}, nativeChoose(callbacks), run, room, "RunProgress", {},
            { Door = { ObjectId = 1 } })
        callbacks.SetupRoomReward(nil, {}, function() end, run, room, {}, { Door = { ObjectId = 1 } })
    end)
    lu.assertEquals(chosen, "MaxHealthDrop")
    -- Room creation stamped the entered reward's god; the first draw has none.
    lu.assertNil(room.ForceLootName)
end

function TestRerolls.testEachPressDrawsTheNextPlannedRerollOfItsDoor()
    local callbacks, scope, state, mismatches = attached(plan(), "src", "H_Combat01")
    local run = runWith()
    local first = door(1, "a", "H_Combat02")
    first.Room.ChosenRewardType = "MaxHealthDrop"
    local second = door(2, "b", "H_Combat03")
    second.Room.ChosenRewardType, second.Room.ForceLootName = "Boon", "ZeusUpgrade"
    local cages = door(3, "c", "H_Combat04")
    cages.Room.CageRewards = {
        { RewardType = "RoomMoneyDrop" }, { RewardType = "MaxHealthDrop" },
    }
    local proved, errorValue
    withGlobals({
        CurrentRun = run, MapState = { OfferedExitDoors = { first, second, cages } },
        CollapseTableOrdered = function(values) return values end,
    }, function()
        callbacks.AttemptRerollDoor(nil, {}, nativeDoorReroll(callbacks), run, first)
        lu.assertEquals(first.Room.ChosenRewardType, "GiftDrop")
        -- AttemptReroll picked the first cage at random; the plan rerolls the second.
        cages.RerollIndex = 1
        callbacks.AttemptRerollFieldsDoor(nil, {}, function(currentRun, target)
            local cageRoom = { Name = target.Room.Name, RewardStoreName = "RunProgress",
                __runPlannerExecutionRoomId = target.Room.__runPlannerExecutionRoomId }
            local chosen = callbacks.ChooseRoomReward(nil, {}, nativeChoose(callbacks), currentRun, cageRoom,
                "RunProgress", target.Room.CageRewards)
            target.Room.CageRewards[target.RerollIndex] = { RewardType = chosen }
        end, run, cages)
        callbacks.AttemptRerollDoor(nil, {}, nativeDoorReroll(callbacks), run, first)
        proved, errorValue = scope.proveOutgoingDoors(state, run)
    end)
    lu.assertEquals(first.Room.ChosenRewardType, "Boon")
    lu.assertEquals(first.Room.ForceLootName, "ApolloUpgrade")
    lu.assertEquals(cages.RerollIndex, 2)
    lu.assertEquals(cages.Room.CageRewards[2].RewardType, "MaxManaDrop")
    lu.assertEquals(mismatches, {})
    -- Doors leave offering what their planned rerolls drew; the store lost each draw.
    lu.assertTrue(proved, errorValue)
    lu.assertEquals(run.RewardStores.RunProgress, { { Name = "MaxHealthDrop" } })
end

function TestRerolls.testAPressBeyondThePlanLeavesTheRouteNatively()
    local callbacks, _, state, mismatches = attached(plan(), "src", "H_Combat01")
    local run = runWith()
    local second = door(2, "b", "H_Combat03")
    local nativeCalls = 0
    withGlobals({ CurrentRun = run }, function()
        callbacks.AttemptRerollDoor(nil, {}, function() nativeCalls = nativeCalls + 1 end, run, second)
    end)
    lu.assertEquals(nativeCalls, 1)
    lu.assertEquals(mismatches, { { checkpoint = "reroll", expected = 0, observed = 1 } })
    lu.assertEquals(state.state, "desynchronized")
end

function TestRerolls.testDoorsProveTheirLastRerollNotTheFirstDraw()
    local _, scope, state = attached(plan(), "src", "H_Combat01")
    local run = runWith()
    local first = door(1, "a", "H_Combat02")
    first.Room.ChosenRewardType = "MaxHealthDrop"
    local second = door(2, "b", "H_Combat03")
    second.Room.ChosenRewardType, second.Room.ForceLootName = "Boon", "ZeusUpgrade"
    local cages = door(3, "c", "H_Combat04")
    cages.Room.CageRewards = { { RewardType = "RoomMoneyDrop" }, { RewardType = "MaxManaDrop" } }
    local proved, errorValue
    withGlobals({
        CurrentRun = run, MapState = { OfferedExitDoors = { first, second, cages } },
        CollapseTableOrdered = function(values) return values end,
    }, function()
        proved, errorValue = scope.proveOutgoingDoors(state, run)
    end)
    lu.assertNil(proved)
    lu.assertEquals(errorValue, { kind = "reward", index = 1, expected = "Boon", observed = "MaxHealthDrop" })
end

function TestRerolls.testHubBoardPressDrawsItsSlotsPlannedReroll()
    local hubPlan = {
        selectedOccurrenceIds = { "pre", "slot" },
        occurrencesById = {
            pre = { id = "pre", gameName = "N_PreHub01", biomeKey = "N", overview = {
                hub = {
                    room = { gameName = "N_Hub" },
                    slots = { { slotKey = "slot1", physicalDoorId = 50,
                        room = { id = "slot", biomeKey = "N", gameName = "N_Combat01" },
                        reward = reward("MaxHealthDrop") } },
                    rerolls = { { owner = "h1", slotKey = "slot1", reward = reward("GiftDrop") } },
                },
            }, doors = { kind = "terminal" } },
            slot = { id = "slot", gameName = "N_Combat01", biomeKey = "N",
                overview = { incomingReward = reward("GiftDrop") } },
        },
    }
    local callbacks, _, _, mismatches = attached(hubPlan)
    local run = runWith()
    run.CurrentRoom = { Name = "N_Hub", OfferedRewards = {} }
    local slotDoor = door(50, "slot", "N_Combat01")
    withGlobals({ CurrentRun = run }, function()
        callbacks.AttemptRerollDoor(nil, {}, nativeDoorReroll(callbacks), run, slotDoor)
        callbacks.AttemptRerollDoor(nil, {}, function() end, run, slotDoor)
    end)
    lu.assertEquals(slotDoor.Room.ChosenRewardType, "GiftDrop")
    lu.assertEquals(mismatches, { { checkpoint = "reroll", expected = 1, observed = 2 } })
end

function TestRerolls.testRestoredHubBoardKeepsItsOffersAndPressesTheLaterStaysReroll()
    -- slot2 is pressed once on the first Hub entry and again after main1's visit.
    local hub = {
        room = { gameName = "N_Hub" },
        slots = {
            { slotKey = "slot1", physicalDoorId = 101,
                room = { id = "main1", biomeKey = "N", gameName = "N_Combat01" },
                reward = reward("MaxHealthDrop") },
            { slotKey = "slot2", physicalDoorId = 102,
                room = { id = "main2", biomeKey = "N", gameName = "N_Combat02" },
                reward = reward("Boon", "ZeusUpgrade") },
        },
        rerolls = {
            { owner = "h1", slotKey = "slot2", reward = reward("Boon", "ApolloUpgrade") },
            { owner = "h2", slotKey = "slot2", reward = reward("GiftDrop") },
        },
    }
    local hubPlan = {
        selectedOccurrenceIds = { "pre", "main1", "main2" },
        occurrencesById = {
            pre = { id = "pre", gameName = "N_PreHub01", biomeKey = "N", overview = { hub = hub },
                doors = { kind = "terminal" } },
            main1 = { id = "main1", gameName = "N_Combat01", biomeKey = "N",
                overview = { incomingReward = reward("MaxHealthDrop") } },
            main2 = { id = "main2", gameName = "N_Combat02", biomeKey = "N",
                overview = { incomingReward = reward("GiftDrop") } },
        },
    }
    local callbacks, _, state, mismatches = attached(hubPlan)
    local run = runWith()
    run.CurrentRoom = { Name = "N_Hub", OfferedRewards = {} }
    local entryDoor = door(102, "main2", "N_Combat02")
    local restoredDoor = { ObjectId = 102 }
    withGlobals({
        CurrentRun = run, MapState = { OfferedExitDoors = { [102] = restoredDoor } },
        CollapseTableOrdered = function() return { restoredDoor } end,
        game = { RoomData = { N_Hub = { PredeterminedDoorRooms = { [101] = "N_Combat01", [102] = "N_Combat02" } } } },
    }, function()
        -- The first entry's press, then main1's visit returns to the restored Hub.
        state.route.index = 2
        callbacks.AttemptRerollDoor(nil, {}, nativeDoorReroll(callbacks), run, entryDoor)
        lu.assertEquals(entryDoor.Room.ForceLootName, "ApolloUpgrade")
        state.route.index = 3
        callbacks.DoUnlockRoomExits(nil, {}, function(currentRun)
            -- Native restore returns the persisted offer without a store draw.
            local nativeRoom = { Name = "N_Combat02", RewardStoreName = "RunProgress" }
            restoredDoor.Room = nativeRoom
            nativeRoom.ChosenRewardType = callbacks.ChooseRoomReward(nil, {}, function(_, room)
                room.ForceLootName = "ApolloUpgrade"
                return "Boon"
            end, currentRun, nativeRoom, "RunProgress", {}, { Door = restoredDoor })
            callbacks.SetupRoomReward(nil, {}, function() end, currentRun, nativeRoom, {}, { Door = restoredDoor })
            callbacks.AssignRoomToExitDoor(nil, {}, function(target, assigned) target.Room = assigned end,
                restoredDoor, nativeRoom)
        end, run, run.CurrentRoom)
        lu.assertEquals(restoredDoor.Room.ChosenRewardType, "Boon")
        lu.assertEquals(restoredDoor.Room.ForceLootName, "ApolloUpgrade")
        lu.assertEquals(restoredDoor.Room.__runPlannerExecutionRoomId, "main2")
        callbacks.AttemptRerollDoor(nil, {}, nativeDoorReroll(callbacks), run, restoredDoor)
    end)
    lu.assertEquals(restoredDoor.Room.ChosenRewardType, "GiftDrop")
    lu.assertNil(restoredDoor.Room.ForceLootName)
    lu.assertEquals(mismatches, {})
    -- Only the two presses drew from the store.
    lu.assertEquals(run.RewardStores.RunProgress, { { Name = "MaxHealthDrop" }, { Name = "MaxManaDrop" } })
end

local function chaosScreen(rerollCount)
    local chaos = require("mods.room.timeline.acquisitions.traits.chaos_offer")
    local module, _, callbacks = capture()
    local offer = { kind = "chaos", giver = "Chaos", selected = "option1", blessingKey = "ChaosBlessing",
        rarity = "Rare", selectedCurseValues = {}, blessingValues = {}, rerollCount = rerollCount, curseOptions = {
            { curseKey = "CurseA", requirementCount = 1 }, { curseKey = "CurseB", requirementCount = 1 },
            { curseKey = "CurseC", requirementCount = 1 },
        } }
    local payload = { transaction = { kind = "acquisition" },
        detail = { disposition = "normal", gameName = "TrialUpgrade", traitOffer = offer } }
    local loot = { Name = "TrialUpgrade", UpgradeOptions = {
        { ItemName = "RowA" }, { ItemName = "RowB" }, { ItemName = "RowC" },
    } }
    local handle, state, mismatches, completed = {}, { state = "synchronized" }, {}, 0
    local room = {
        current = function() return {} end,
        bound = function(_, _, native) return native == loot and handle or nil end,
        peek = function() return payload end,
        begin = function() return payload end,
    }
    local session = {
        complete = function() completed = completed + 1 end,
        diagnostic = function() end,
        mismatch = function(_, checkpoint, expected, observed)
            mismatches[#mismatches + 1] = { checkpoint, expected, observed }
        end,
    }
    chaos.attach(module, session, function() return state end, function() end, room)
    callbacks.HandleLootPickup(nil, {}, function() end, {}, loot, {})
    local function construct(reroll)
        callbacks.CreateBoonLootButtons(nil, {}, function() end, {}, loot, reroll, {})
    end
    local function choose()
        local chosen = false
        callbacks.HandleUpgradeChoiceSelection(nil, {}, function() chosen = true end, {},
            { LootData = loot, Data = { Name = "RowA" } }, {})
        return chosen
    end
    return construct, choose, mismatches, function() return completed end
end

function TestRerolls.testChaosChoiceBeforeItsPlannedRerollLeavesThePlan()
    local construct, choose, mismatches, completed = chaosScreen(1)
    construct(false)
    lu.assertTrue(choose())
    lu.assertEquals(mismatches, { { "screen-reroll", 1, 0 } })
    lu.assertEquals(completed(), 0)
end

function TestRerolls.testChaosChoiceAfterItsPlannedRerollStaysOnPlan()
    local construct, choose, mismatches = chaosScreen(1)
    construct(false)
    construct(true)
    lu.assertTrue(choose())
    lu.assertEquals(mismatches, {})
    construct(true)
    lu.assertEquals(mismatches, { { "screen-reroll", 1, 2 } })
end
