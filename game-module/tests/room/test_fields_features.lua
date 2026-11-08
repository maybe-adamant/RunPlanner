-- Mourning Fields feature realization. Native setup owns object creation; the
-- adapter only selects the published finite placements and optional outcomes.
-- luacheck: globals TestFieldsFeatures
local lu = require("luaunit")
local fields = require("mods.room.features.fields")
local coordinator = require("mods.room.coordinator")
local support = require("tests.harness.hook_composition")

TestFieldsFeatures = {}

-- The room's cage (LootPoint) and optional (BonusRewardSpawnPoints) point sets.
local points = { cages = {}, optional = {} }

function TestFieldsFeatures:setUp()
    self.getIdsByType, self.getIds = _G.GetIdsByType, _G.GetIds
    points = { cages = { 11, 12, 13, 31, 32, 33, 34, 81, 82, 83 }, optional = { 21, 22, 23, 51 } }
    _G.GetIdsByType = function(args)
        lu.assertEquals(args.Name, "LootPoint")
        return points.cages
    end
    _G.GetIds = function(args)
        lu.assertEquals(args.Name, "BonusRewardSpawnPoints")
        return points.optional
    end
end

function TestFieldsFeatures:tearDown()
    _G.GetIdsByType, _G.GetIds = self.getIdsByType, self.getIds
end

local function fixture(layout, occurrenceId)
    local module, _, callbacks = support.capture()
    local occurrence = { id = occurrenceId or "fields", overview = { fields = layout } }
    local state = { state = "synchronized", room = { current = { occurrence = occurrence } } }
    local mismatches, diagnostics = {}, {}
    local reports = 0
    local session = {
        mismatch = function(_, kind, expected, observed)
            mismatches[#mismatches + 1] = type(kind) == "table" and kind
                or { kind = kind, expected = expected, observed = observed }
        end,
        diagnostic = function(_, kind, observed)
            diagnostics[#diagnostics + 1] = observed
            diagnostics[kind] = observed
        end,
    }
    fields.attach(module, session, function() return state end, function() reports = reports + 1 end, coordinator)
    return callbacks, state, mismatches, diagnostics, function() return reports end, occurrence
end

function TestFieldsFeatures.testTwoCagesAndOptionalConsumableUsePublishedPlacements()
    local callbacks, _, mismatches, _, reports = fixture({
        cagePoints = {
            { slotKey = "cage1", pointId = 11 },
            { slotKey = "cage2", pointId = 12 },
        },
        optionalRewards = {
            {
                slotKey = "optional1", pointId = 21,
                reward = { rewardType = "MaxHealthDrop", source = "MaxHealthDrop" },
            },
        },
    })
    local nativeRoom = {
        OptionalRewardChances = { 0.95, 0.75, 0.50 },
        BonusRewardStoreName = "FieldsOptionalRewards",
    }
    local cages = { 11, 12, 13 }
    local optional = { 21, 22 }
    local selectedReward
    local result = callbacks.SpawnRewardCages(nil, {}, function(room)
        lu.assertEquals(callbacks.RemoveRandomValue(nil, {}, function(values)
            return table.remove(values, 1)
        end, cages), 11)
        lu.assertEquals(callbacks.RemoveRandomValue(nil, {}, function(values)
            return table.remove(values, 1)
        end, cages), 12)
        lu.assertTrue(callbacks.RandomChance(nil, {}, function() return false end, 0.95, {}))
        lu.assertFalse(callbacks.RandomChance(nil, {}, function() return true end, 0.75, {}))
        lu.assertFalse(callbacks.RandomChance(nil, {}, function() return true end, 0.50, {}))
        lu.assertEquals(callbacks.RemoveRandomValue(nil, {}, function(values)
            return table.remove(values, 1)
        end, optional), 21)
        selectedReward = callbacks.ChooseRoomReward(nil, {}, function(run, rewardRoom, store)
            lu.assertEquals(store, "FieldsOptionalRewards")
            local candidate = { Name = "MaxHealthDrop" }
            lu.assertTrue(callbacks.IsRoomRewardEligible(nil, {}, function() return false end,
                run, rewardRoom, candidate, {}, {}))
            return candidate.Name
        end, {}, {}, "FieldsOptionalRewards", {}, {})
        lu.assertEquals(selectedReward, "MaxHealthDrop")
        callbacks.SpawnRoomReward(nil, {}, function(_, args)
            lu.assertEquals(args.RewardOverride, "MaxHealthDrop")
            lu.assertEquals(args.LootName, "MaxHealthDrop")
            return { Name = "MaxHealthDrop" }
        end, room, { RewardOverride = selectedReward, SpawnRewardOnId = 21, NotRequiredPickup = true })
        return true
    end, nativeRoom, {})

    lu.assertTrue(result)
    lu.assertEquals(cages, { 13 })
    lu.assertEquals(optional, { 22 })
    lu.assertEquals(selectedReward, "MaxHealthDrop")
    lu.assertEquals(mismatches, {})
    lu.assertEquals(reports(), 1)
end

function TestFieldsFeatures.testThreeCagesAreBoundedToTheThreePublishedPoints()
    local callbacks, _, mismatches = fixture({
        cagePoints = {
            { slotKey = "cage1", pointId = 31 },
            { slotKey = "cage2", pointId = 32 },
            { slotKey = "cage3", pointId = 33 },
        },
        optionalRewards = {},
    })
    local nativeRoom = { OptionalRewardChances = {}, BonusRewardStoreName = "FieldsOptionalRewards" }
    local points = { 31, 32, 33, 34 }
    callbacks.SpawnRewardCages(nil, {}, function()
        for _, expected in ipairs({ 31, 32, 33 }) do
            lu.assertEquals(callbacks.RemoveRandomValue(nil, {}, function(values)
                return table.remove(values, 1)
            end, points), expected)
        end
        return true
    end, nativeRoom, {})
    lu.assertEquals(points, { 34 })
    lu.assertEquals(mismatches, {})
end

function TestFieldsFeatures.testHCombat13UsesTheSameFieldsAdapter()
    local callbacks, _, mismatches = fixture({
        cagePoints = {
            { slotKey = "cage1", pointId = 81 },
            { slotKey = "cage2", pointId = 82 },
        },
        optionalRewards = {},
    }, "h-combat13")
    local nativeRoom = {
        __runPlannerExecutionRoomId = "h-combat13",
        OptionalRewardChances = {},
        BonusRewardStoreName = "FieldsOptionalRewards",
    }
    local points = { 81, 82, 83 }
    callbacks.SpawnRewardCages(nil, {}, function()
        for _, expected in ipairs({ 81, 82 }) do
            lu.assertEquals(callbacks.RemoveRandomValue(nil, {}, function(values)
                return table.remove(values, 1)
            end, points), expected)
        end
        return true
    end, nativeRoom, {})
    lu.assertEquals(points, { 83 })
    lu.assertEquals(mismatches, {})
end

function TestFieldsFeatures.testNemesisUsesPublishedPointAndMustInvokeTheNativeSelector()
    local callbacks, state, mismatches, _, reports = fixture({
        cagePoints = {
            { slotKey = "cage1", pointId = 41 },
            { slotKey = "cage2", pointId = 42 },
        },
        optionalRewards = {},
        nemesisPointId = 51,
    })
    local nativeRoom = { __runPlannerExecutionRoomId = "fields" }
    local priorRun = _G.CurrentRun
    _G.CurrentRun = { CurrentRoom = nativeRoom }
    local selected = callbacks.SpawnNemesisForRandomEvents(nil, {}, function(source)
        return callbacks.SelectSpawnPoint(nil, {}, function() return 99 end,
            nativeRoom, {}, source, {}, 0)
    end, {}, {})
    _G.CurrentRun = priorRun

    lu.assertEquals(selected, 51)
    lu.assertEquals(mismatches, {})
    lu.assertEquals(reports(), 1)
    lu.assertEquals(state.state, "synchronized")
end

function TestFieldsFeatures.testMissingNemesisSelectorDiagnosesWithoutBlockingNativeCall()
    local callbacks, _, _, diagnostics = fixture({
        cagePoints = {
            { slotKey = "cage1", pointId = 61 },
            { slotKey = "cage2", pointId = 62 },
        },
        optionalRewards = {},
        nemesisPointId = 71,
    })
    local returned = callbacks.SpawnNemesisForRandomEvents(nil, {}, function() return "native" end, {}, {})
    lu.assertEquals(returned, "native")
    lu.assertEquals(diagnostics[1].expected, 71)
end

local function completedFixture()
    local layout = {
        cagePoints = {
            { slotKey = "cage1", pointId = 11 },
            { slotKey = "cage2", pointId = 12 },
        },
        optionalRewards = {
            { slotKey = "optional1", pointId = 21,
                reward = { rewardType = "MaxHealthDrop", source = "MaxHealthDrop" } },
        },
        nemesisPointId = 31,
    }
    local callbacks, state, mismatches, diagnostics, reports, occurrence = fixture(layout)
    state.route = { lastExitedOccurrence = { doors = { targets = {
        { room = { id = occurrence.id }, cageRewards = {
            { rewardType = "Boon", source = "DemeterUpgrade" }, { rewardType = "MaxManaDrop" },
        } },
    } } } }
    local nativeRoom = {
        __runPlannerExecutionRoomId = occurrence.id,
        HeroStartPoint = 101, HeroEndPoint = 102,
        CageRewards = {
            { RewardType = "Boon", ForceLootName = "DemeterUpgrade" }, { RewardType = "MaxManaDrop" },
        },
        Encounter = { RewardsToRestore = {
            [201] = { RewardOverride = "MaxHealthDrop", SpawnRewardOnId = 21 },
        } },
    }
    return callbacks, state, mismatches, diagnostics, reports, nativeRoom
end

local function withCompletedNativeProduct(fn)
    local priorMap, priorLoot, priorSession, priorLocation = _G.MapState, _G.LootObjects, _G.SessionMapState, _G.GetLocation
    local optional = { ObjectId = 201, Name = "MaxHealthDrop", SpawnPointId = 21 }
    _G.MapState = {
        ActiveObstacles = {
            [101] = { ObjectId = 101, Name = "FieldsRewardCage", SpawnPointId = 11, RewardId = 401 },
            [102] = { ObjectId = 102, Name = "FieldsRewardCage", SpawnPointId = 12, RewardId = 402 },
            [201] = optional,
        },
        OptionalRewards = { [201] = optional },
    }
    _G.LootObjects = {
        [401] = { ObjectId = 401, Name = "DemeterUpgrade" },
        [402] = { ObjectId = 402, Name = "MaxManaDrop" },
    }
    _G.SessionMapState = { Nemesis = { ObjectId = 301 } }
    _G.GetLocation = function(args)
        return ({ [11] = { X = 1, Y = 1 }, [12] = { X = 2, Y = 2 }, [21] = { X = 3, Y = 3 },
            [31] = { X = 4, Y = 4 }, [101] = { X = 1, Y = 1 }, [102] = { X = 2, Y = 2 },
            [201] = { X = 3, Y = 3 }, [301] = { X = 4, Y = 4 }, [401] = { X = 1, Y = 1 },
            [402] = { X = 2, Y = 2 } })[args.Id]
    end
    local ok, errorValue = pcall(fn)
    _G.MapState, _G.LootObjects, _G.SessionMapState, _G.GetLocation = priorMap, priorLoot, priorSession, priorLocation
    if not ok then error(errorValue, 0) end
end

local function present(callbacks, nativeRoom)
    local continued = false
    local result = callbacks.StartRoomPresentation(nil, {}, function(_, room)
        continued = true
        lu.assertEquals(room, nativeRoom)
        return "native"
    end, {}, nativeRoom)
    lu.assertTrue(continued)
    lu.assertEquals(result, "native")
end

function TestFieldsFeatures.testCompletedFieldsProductSnapshotsTheRealSessionBeforePresentation()
    local callbacks, _, mismatches, diagnostics, reports, nativeRoom = completedFixture()
    withCompletedNativeProduct(function()
        present(callbacks, nativeRoom)
        _G.MapState.ActiveObstacles[101].SpawnPointId = 99
        _G.LootObjects[401].Name = "changed-after-snapshot"
    end)
    lu.assertEquals(mismatches, {})
    lu.assertEquals(reports(), 1)
    local snapshot = diagnostics["fields-completed-product"]
    lu.assertEquals(snapshot.planned.cages[1].reward, { rewardType = "Boon", source = "DemeterUpgrade" })
    lu.assertEquals(snapshot.observed.cages[1].reward, {
        objectId = 401, name = "DemeterUpgrade", spawnPointId = nil, rewardId = nil,
        location = { X = 1, Y = 1, Z = nil },
    })
    lu.assertEquals(snapshot.observed.optionalRewards[1].restore,
        { rewardType = "MaxHealthDrop", spawnPointId = 21 })
    lu.assertEquals(snapshot.observed.nemesis.location, { X = 4, Y = 4, Z = nil })
end

function TestFieldsFeatures.testCompletedFieldsProductRecordsMissingObjectsWithoutMismatch()
    local callbacks, state, mismatches, diagnostics, _, nativeRoom = completedFixture()
    withCompletedNativeProduct(function()
        _G.MapState.ActiveObstacles[102] = nil
        _G.MapState.OptionalRewards[201] = nil
        present(callbacks, nativeRoom)
    end)
    lu.assertEquals(mismatches, {})
    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(#diagnostics["fields-completed-product"].observed.cages, 1)
    lu.assertEquals(diagnostics["fields-completed-product"].observed.optionalRewards, {})
end

function TestFieldsFeatures.testCompletedFieldsProductRecordsDisplacedObjectsWithoutMismatch()
    local callbacks, state, mismatches, diagnostics, _, nativeRoom = completedFixture()
    withCompletedNativeProduct(function()
        _G.MapState.ActiveObstacles[101].SpawnPointId = 99
        _G.GetLocation = function(args)
            return ({ [11] = { X = 1, Y = 1 }, [12] = { X = 2, Y = 2 }, [21] = { X = 3, Y = 3 },
                [31] = { X = 4, Y = 4 }, [101] = { X = 9, Y = 9 }, [102] = { X = 2, Y = 2 },
                [201] = { X = 3, Y = 3 }, [301] = { X = 8, Y = 8 }, [401] = { X = 9, Y = 9 },
                [402] = { X = 2, Y = 2 } })[args.Id]
        end
        present(callbacks, nativeRoom)
    end)
    lu.assertEquals(mismatches, {})
    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(diagnostics["fields-completed-product"].observed.cages[1].spawnPointId, 99)
    lu.assertEquals(diagnostics["fields-completed-product"].observed.nemesis.location, { X = 8, Y = 8, Z = nil })
    lu.assertEquals(diagnostics["fields-placement"], { { slotKey = "cage1", pointId = 11 } })
end

function TestFieldsFeatures.testCompletedFieldsProductRecordsOnionBesideOriginalBoonOffer()
    local callbacks, state, mismatches, diagnostics, _, nativeRoom = completedFixture()
    withCompletedNativeProduct(function()
        _G.LootObjects[401].Name = "RoomRewardConsolationPrize"
        present(callbacks, nativeRoom)
    end)
    lu.assertEquals(mismatches, {})
    lu.assertEquals(state.state, "synchronized")
    lu.assertEquals(diagnostics["fields-completed-product"].planned.cages[1].reward,
        { rewardType = "Boon", source = "DemeterUpgrade" })
    lu.assertEquals(diagnostics["fields-completed-product"].observed.cages[1].reward.name, "RoomRewardConsolationPrize")
end

-- A native-like draw that takes the second remaining point and leaves a hole.
local function secondDraw(values)
    local keys = {}
    for key in pairs(values) do keys[#keys + 1] = key end
    table.sort(keys)
    local key = keys[2] or keys[1]
    local value = values[key]
    values[key] = nil
    return value
end

function TestFieldsFeatures.testUnplannedSlotsDrawNativelyWithoutPlannedPoints()
    local callbacks, _, mismatches, diagnostics = fixture({
        cagePoints = { { slotKey = "cage2", pointId = 12 } },
        optionalRewards = {
            { slotKey = "optional1", reward = { rewardType = "MaxHealthDrop" } },
            { slotKey = "optional2", pointId = 21, reward = { rewardType = "MaxHealthDrop" } },
        },
        nemesisPointId = 23,
    })
    local nativeRoom = { OptionalRewardChances = { 0.5, 0.5 }, BonusRewardStoreName = "FieldsOptionalRewards" }
    -- Native pools may already hold holes.
    local cages = { [1] = 11, [3] = 13, [4] = 12 }
    local optional = { 21, 22, 23 }
    local drawn = {}
    callbacks.SpawnRewardCages(nil, {}, function()
        for _ = 1, 3 do drawn[#drawn + 1] = callbacks.RemoveRandomValue(nil, {}, secondDraw, cages) end
        -- An unrelated draw inside the scope stays native.
        local other = { 900, 901 }
        lu.assertEquals(callbacks.RemoveRandomValue(nil, {}, secondDraw, other), 901)
        for _ = 1, 2 do drawn[#drawn + 1] = callbacks.RemoveRandomValue(nil, {}, secondDraw, optional) end
        return true
    end, nativeRoom, {})
    -- cage1 draws over {11, 13} (12 is planned), cage2 takes 12, cage3 the rest;
    -- optional1 draws over {22} (21 planned, 23 the Nemesis point), optional2 takes 21.
    lu.assertEquals(drawn, { 13, 12, 11, 22, 21 })
    lu.assertEquals(cages, {})
    lu.assertEquals(optional, { 23 })
    lu.assertEquals(mismatches, {})
    lu.assertNil(diagnostics["fields-point"])
end

function TestFieldsFeatures.testUnavailablePlannedPointDiagnosesAndDrawsNatively()
    local callbacks, _, _, diagnostics = fixture({
        cagePoints = { { slotKey = "cage1", pointId = 13 } },
        optionalRewards = {},
    })
    local cages = { 11, 12 }
    points.cages = { 11, 12, 13 }
    local drawn
    callbacks.SpawnRewardCages(nil, {}, function()
        drawn = callbacks.RemoveRandomValue(nil, {}, secondDraw, cages)
        return true
    end, { OptionalRewardChances = {}, BonusRewardStoreName = "FieldsOptionalRewards" }, {})
    lu.assertEquals(drawn, 12)
    lu.assertEquals(diagnostics["fields-point"], { expected = 13, observed = nil })
end

function TestFieldsFeatures.testPlacementChecksOnlyPlannedSlotsAgainstTheirCage()
    local callbacks, _, mismatches, diagnostics, _, nativeRoom = completedFixture()
    nativeRoom.CageRewards[1].Encounter = { Name = "CageA" }
    nativeRoom.CageRewards[2].Encounter = { Name = "CageB" }
    withCompletedNativeProduct(function()
        -- cage1's point holds cage2's encounter; the planned optional holds its point.
        _G.MapState.ActiveObstacles[101].Encounter = { Name = "CageB" }
        _G.MapState.ActiveObstacles[102].Encounter = { Name = "CageB" }
        present(callbacks, nativeRoom)
    end)
    lu.assertEquals(mismatches, {})
    lu.assertEquals(diagnostics["fields-placement"], { { slotKey = "cage1", pointId = 11, observed = "CageB" } })
end
