-- luacheck: globals TestFieldsCages
local lu = require("luaunit")
local navigation = require("mods.navigation.hooks")
local routeSession = require("mods.route.session")
local support = require("tests.harness.hook_composition")
local capture, stub = support.capture, support.stub

TestFieldsCages = {}

local GLOBALS = { "MapState", "game", "CurrentRun", "CollapseTableOrdered" }

local function withGlobals(values, body)
    local prior = {}
    for _, key in ipairs(GLOBALS) do prior[key] = _G[key] end
    for _, key in ipairs(GLOBALS) do _G[key] = values[key] end
    local ok, err = pcall(body)
    for _, key in ipairs(GLOBALS) do _G[key] = prior[key] end
    if not ok then error(err, 0) end
end

local function copy(value)
    if type(value) ~= "table" then return value end
    local result = {}
    for key, item in pairs(value) do result[key] = copy(item) end
    return result
end

local function reward(rewardType, source)
    return { rewardType = rewardType, producerLifecycleKey = "RoomReward", resolvedStoreKey = "RunProgress",
        source = source }
end

-- H_Intro offers two Fields doors; each target names its first cage draws.
local function plan(cageCount)
    local function cages(...)
        local all = { ... }
        local result = {}
        for index = 1, cageCount do result[index] = all[index] end
        return result
    end
    local source = {
        id = "src", gameName = "H_Intro", biomeKey = "H", overview = {},
        doors = { kind = "batch", owner = "batch", resolvedSharedRewardStoreKey = "RunProgress", targets = {
            { exitKey = "exit1", index = 1, room = { id = "a", biomeKey = "H", gameName = "H_Combat02" },
                cageRewards = cages(reward("RoomMoneyDrop"), reward("Boon", "HeraUpgrade"), reward("TalentDrop")) },
            { exitKey = "exit2", index = 2, room = { id = "b", biomeKey = "H", gameName = "H_Combat03" },
                cageRewards = cages(reward("MaxManaDrop"), reward("MaxHealthDrop"), reward("GiftDrop")) },
        } },
    }
    local a = { id = "a", gameName = "H_Combat02", biomeKey = "H", overview = {} }
    local b = { id = "b", gameName = "H_Combat03", biomeKey = "H", overview = {} }
    return { selectedOccurrenceIds = { "src", "a" }, occurrencesById = { src = source, a = a, b = b } }
end

local function attached(planValue)
    local module, _, callbacks = capture()
    local cursor = routeSession.new(planValue)
    assert(routeSession.enter(cursor, "src", "H_Intro"))
    local state = { state = "synchronized", plan = planValue, route = cursor }
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

local function store()
    return {
        { Name = "MaxHealthDrop" }, { Name = "Boon" }, { Name = "RoomMoneyDrop" }, { Name = "MaxManaDrop" },
        { Name = "TalentDrop" }, { Name = "GiftDrop" }, { Name = "StackUpgrade" },
    }
end

-- Native ChooseRoomReward: remove the first eligible store entry.
local function nativeChoose(callbacks)
    return function(run, room, storeName)
        for index, entry in ipairs(run.RewardStores[storeName] or {}) do
            if callbacks.IsRoomRewardEligible(nil, {}, function() return true end, run, room, entry, {}, {}) then
                table.remove(run.RewardStores[storeName], index)
                room.ForceLootName = entry.ForceLootName or room.ForceLootName
                return entry.Name
            end
        end
    end
end

-- Native DoUnlockRoomExits: create each door's room, roll the shared cage count,
-- then draw each door's cages from its store, copying the door's room.
local function nativeUnlock(callbacks, offered)
    return function(run, room)
        for _, door in ipairs(offered) do
            local data = callbacks.ChooseNextRoomData(nil, {}, function() return nil end, run, {}, offered)
            door.Room = callbacks.CreateRoom and callbacks.CreateRoom(nil, {}, copy, data, {}) or copy(data)
            door.Room.NeedsReward = true
        end
        -- The native roll here always misses the max chance.
        room.NumDoorCageRewards = callbacks.SelectFieldsDoorCageCount(nil, {}, function(currentRun)
            currentRun.FieldsMaxDoorsRolled = currentRun.FieldsMaxDoorsRolled or 0
            return room.MinDoorCageRewards
        end, run, room)
        for _, door in ipairs(offered) do
            local doorRoom = door.Room
            doorRoom.RewardStoreName = run.NextRewardStoreName
            -- A Fields door offers no reward of its own; the plan draws none.
            doorRoom.ChosenRewardType = callbacks.ChooseRoomReward(nil, {}, nativeChoose(callbacks), run,
                doorRoom, doorRoom.RewardStoreName, {}, { Door = door })
            if doorRoom.MaxCageRewards ~= nil then
                doorRoom.CageRewards = {}
                for _ = 1, room.NumDoorCageRewards or 2 do
                    local cageRoom = copy(doorRoom)
                    cageRoom.ChosenRewardType = callbacks.ChooseRoomReward(nil, {}, nativeChoose(callbacks), run,
                        cageRoom, cageRoom.RewardStoreName, {})
                    callbacks.SetupRoomReward(nil, {}, function() end, run, cageRoom, {}, { Door = door })
                    doorRoom.CageRewards[#doorRoom.CageRewards + 1] = {
                        RewardType = cageRoom.ChosenRewardType, ForceLootName = cageRoom.ForceLootName,
                    }
                end
            end
        end
    end
end

local function unlock(cageCount, fieldsMaxDoorsRolled)
    local callbacks, scope, state, mismatches = attached(plan(cageCount))
    local run = {
        RewardStores = { RunProgress = store() }, BiomeDepthCache = 1,
        FieldsMaxDoorsRolled = fieldsMaxDoorsRolled,
    }
    local source = {
        Name = "H_Intro", MinDoorCageRewards = 2, MaxDoorCageRewards = 3, MaxDoorCageCeiling = 2,
        MaxDoorDepthChanceTable = { [1] = { MaxDoorChance = 0.5 } },
    }
    run.CurrentRoom = source
    local offered = { { ObjectId = 1 }, { ObjectId = 2 } }
    local proved, errorValue
    withGlobals({
        CurrentRun = run, MapState = { OfferedExitDoors = offered },
        CollapseTableOrdered = function(values) return values end,
        game = { RoomData = { H_Combat02 = { MaxCageRewards = 3 }, H_Combat03 = { MaxCageRewards = 3 } } },
    }, function()
        callbacks.DoUnlockRoomExits(nil, {}, nativeUnlock(callbacks, offered), run, source)
        proved, errorValue = scope.proveOutgoingDoors(state, run)
    end)
    return { run = run, offered = offered, proved = proved, errorValue = errorValue, mismatches = mismatches }
end

local function names(entries)
    local result = {}
    for index, entry in ipairs(entries) do result[index] = entry.Name end
    return result
end

function TestFieldsCages.testCagesAreDrawnFromTheNativeStoreAsPlanned()
    local result = unlock(2)
    lu.assertEquals(result.mismatches, {})
    lu.assertTrue(result.proved, result.errorValue)
    lu.assertEquals(result.offered[1].Room.CageRewards, {
        { RewardType = "RoomMoneyDrop" }, { RewardType = "Boon", ForceLootName = "HeraUpgrade" },
    })
    lu.assertEquals(result.offered[2].Room.CageRewards, {
        { RewardType = "MaxManaDrop" }, { RewardType = "MaxHealthDrop" },
    })
    -- Every cage of both doors, the untaken one included, left the store.
    lu.assertEquals(names(result.run.RewardStores.RunProgress), { "TalentDrop", "GiftDrop", "StackUpgrade" })
end

function TestFieldsCages.testAPlannedMinRollLeavesTheMaxDoorCounter()
    local result = unlock(2, 1)
    lu.assertEquals(result.mismatches, {})
    lu.assertEquals(result.run.FieldsMaxDoorsRolled, 1)
end

function TestFieldsCages.testAPlannedMaxRollAdvancesTheMaxDoorCounter()
    local result = unlock(3)
    lu.assertEquals(result.mismatches, {})
    lu.assertTrue(result.proved, result.errorValue)
    lu.assertEquals(result.run.FieldsMaxDoorsRolled, 1)
    lu.assertEquals(#result.offered[1].Room.CageRewards, 3)
    lu.assertEquals(result.offered[2].Room.CageRewards[3], { RewardType = "GiftDrop" })
    lu.assertEquals(names(result.run.RewardStores.RunProgress), { "StackUpgrade" })
end

function TestFieldsCages.testAPlannedMaxPastTheNativeCeilingIsAMismatch()
    local result = unlock(3, 2)
    lu.assertEquals(result.mismatches, { { kind = "cageCount", expected = 3, observed = 2 } })
    lu.assertEquals(result.run.FieldsMaxDoorsRolled, 2)
    -- The native roll stands, and native draws fill its cages.
    lu.assertEquals(#result.offered[1].Room.CageRewards, 2)
end
