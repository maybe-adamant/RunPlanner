-- luacheck: globals TestArachne
local lu = require("luaunit")
local arachne = require("mods.room.timeline.encounters.arachne")

TestArachne = {}

local function attach(phase, encounter, state)
    local callbacks, diagnostics = {}, {}
    local module = { hooks = { wrap = function(name, _, callback) callbacks[name] = callback end } }
    local session = {
        diagnostic = function(_, checkpoint, observed)
            diagnostics[#diagnostics + 1] = { checkpoint = checkpoint, observed = observed }
        end,
    }
    arachne.attach(module, session, function() return state end, function() end, {
        encounterPhase = function(_, native) return native == encounter and phase or nil end,
    })
    return callbacks, diagnostics
end

local function combatPhase(count)
    return {
        slotKey = "Encounter", encounterKey = "ArachneCombatF", kind = "combat",
        customization = count and { { decisionKey = "cocoonCount", kind = "cocoonCount", count = count } } or nil,
    }
end

local function nativeArgs()
    return {
        CocoonCountMin = 8, CocoonCountMax = 14, RequiredSpawnPointType = "EnemyPoint",
        CocoonOptions = { "ArachneCocoon_G", "ArachneCocoonMedium_G", "ArachneCocoonLarge_G" },
    }
end

-- Mirrors SetupArachneCombatEncounter/SpawnArachneCocoons: one RandomInt draw from the
-- supplied bounds, native placement up to the available points, then reward selection.
local function nativeSetup(draws, points, rewardPicks)
    return function(eventSource, args)
        local function randomInt(minimum, maximum)
            draws[#draws + 1] = { minimum = minimum, maximum = maximum, args = args }
            return maximum
        end
        local count = randomInt(args.CocoonCountMin or eventSource.CocoonCountMin,
            args.CocoonCountMax or eventSource.CocoonCountMax)
        local ids = {}
        for index = 1, math.min(count, points) do
            ids[index] = 100 + index
            _G.CurrentRun.CurrentRoom.CoocoonIds = ids
        end
        rewardPicks[#rewardPicks + 1] = { options = args.CocoonOptions, ids = _G.CurrentRun.CurrentRoom.CoocoonIds }
        if _G.CurrentRun.CurrentRoom.CoocoonIds == nil then error("native reward cocoon missing", 0) end
        return "native"
    end
end

local function withRoom(callback)
    local prior = _G.CurrentRun
    _G.CurrentRun = { CurrentRoom = { Name = "G_Combat10" } }
    local ok, result = pcall(callback)
    _G.CurrentRun = prior
    if not ok then error(result, 0) end
    return result
end

function TestArachne.testRequestedCountDrawsWithEqualBoundsFromAPrivateCopy()
    withRoom(function()
        local encounter = {}
        local callbacks, diagnostics = attach(combatPhase(11), encounter, { state = "synchronized" })
        local draws, picks, args = {}, {}, nativeArgs()
        local result = callbacks.SetupArachneCombatEncounter(nil, {}, nativeSetup(draws, 20, picks), encounter, args)
        lu.assertEquals(result, "native")
        lu.assertEquals(#draws, 1)
        lu.assertEquals({ draws[1].minimum, draws[1].maximum }, { 11, 11 })
        lu.assertFalse(rawequal(draws[1].args, args))
        lu.assertTrue(rawequal(draws[1].args.CocoonOptions, args.CocoonOptions))
        lu.assertEquals(draws[1].args.RequiredSpawnPointType, "EnemyPoint")
        lu.assertEquals({ args.CocoonCountMin, args.CocoonCountMax }, { 8, 14 })
        lu.assertEquals(#picks[1].ids, 11)
        lu.assertEquals(diagnostics, {})
    end)
end

function TestArachne.testDefaultAndUnsynchronizedSetupStayNative()
    withRoom(function()
        for _, case in ipairs({
            { phase = combatPhase(nil), state = { state = "synchronized" } },
            { phase = combatPhase(11), state = { state = "desynchronized" } },
            { phase = combatPhase(11), state = nil },
        }) do
            local encounter = {}
            local callbacks, diagnostics = attach(case.phase, encounter, case.state)
            local draws, picks, args = {}, {}, nativeArgs()
            callbacks.SetupArachneCombatEncounter(nil, {}, nativeSetup(draws, 20, picks), encounter, args)
            lu.assertTrue(rawequal(draws[1].args, args))
            lu.assertEquals({ draws[1].minimum, draws[1].maximum }, { 8, 14 })
            lu.assertEquals(diagnostics, {})
        end
    end)
end

function TestArachne.testUnboundEncounterStaysNative()
    withRoom(function()
        local callbacks = attach(combatPhase(11), {}, { state = "synchronized" })
        local draws, picks, args = {}, {}, nativeArgs()
        callbacks.SetupArachneCombatEncounter(nil, {}, nativeSetup(draws, 20, picks), {}, args)
        lu.assertTrue(rawequal(draws[1].args, args))
    end)
end

function TestArachne.testCountOutsideNativeBoundsDeclinesWithDiagnostic()
    withRoom(function()
        local encounter = {}
        local callbacks, diagnostics = attach(combatPhase(15), encounter, { state = "synchronized" })
        local draws, picks, args = {}, {}, nativeArgs()
        callbacks.SetupArachneCombatEncounter(nil, {}, nativeSetup(draws, 20, picks), encounter, args)
        lu.assertTrue(rawequal(draws[1].args, args))
        lu.assertEquals(diagnostics, { {
            checkpoint = "arachne-cocoon-count",
            observed = {
                reason = "outside-native-range", encounterKey = "ArachneCombatF",
                requested = 15, minimum = 8, maximum = 14,
            },
        } })
    end)
end

function TestArachne.testPlacementShortfallStaysNativeWithDiagnostic()
    withRoom(function()
        local encounter = {}
        local callbacks, diagnostics = attach(combatPhase(12), encounter, { state = "synchronized" })
        local draws, picks = {}, {}
        callbacks.SetupArachneCombatEncounter(nil, {}, nativeSetup(draws, 9, picks), encounter, nativeArgs())
        lu.assertEquals(#picks[1].ids, 9)
        lu.assertEquals(diagnostics, { {
            checkpoint = "arachne-cocoon-count",
            observed = { reason = "placement-shortfall", encounterKey = "ArachneCombatF", requested = 12, placed = 9 },
        } })
    end)
end

function TestArachne.testZeroPlacementKeepsNativeErrorAfterDiagnostic()
    withRoom(function()
        local encounter = {}
        local callbacks, diagnostics = attach(combatPhase(8), encounter, { state = "synchronized" })
        local ok, errorValue = pcall(callbacks.SetupArachneCombatEncounter, nil, {},
            nativeSetup({}, 0, {}), encounter, nativeArgs())
        lu.assertFalse(ok)
        lu.assertEquals(errorValue, "native reward cocoon missing")
        lu.assertEquals(diagnostics, { {
            checkpoint = "arachne-cocoon-count",
            observed = {
                reason = "setup-error", encounterKey = "ArachneCombatF", requested = 8, placed = 0,
                error = "native reward cocoon missing",
            },
        } })
    end)
end

local function withPlacement(callback)
    local priorRun, priorMap, priorEligible, priorIds = _G.CurrentRun, _G.MapState,
        _G.IsSpawnPointEligible, _G.GetIdsByType
    local world = { used = {}, draws = {}, random = {}, nextId = 1000 }
    _G.CurrentRun = { CurrentRoom = { SpawnPoints = { EnemyPoint = { 1, 2, 3, 4, 5, 6, 7, 8,
        9, 10, 11, 12, 13, 14, 40191, 560737 } } } }
    _G.MapState = { SpawnPoints = { 99 }, ActiveObstacles = {} }
    _G.IsSpawnPointEligible = function(id, encounter, nativeRoom, args)
        lu.assertEquals(encounter, {})
        lu.assertIs(nativeRoom, _G.CurrentRun.CurrentRoom)
        lu.assertEquals(args, {})
        return not world.used[id]
    end
    _G.GetIdsByType = function() return { 40191, 560737 } end
    local ok, result = pcall(callback, world)
    _G.CurrentRun, _G.MapState, _G.IsSpawnPointEligible, _G.GetIdsByType =
        priorRun, priorMap, priorEligible, priorIds
    if not ok then error(result, 0) end
end

-- Native contact witness: no adapter policy lives here. The supplied points
-- form the available native draw order; obstacle setup reserves each point.
local function placementSetup(callbacks, world, options)
    options = options or {}
    local function random(values)
        world.random[#world.random + 1] = values
        return values[#values]
    end
    local function draw(values)
        return callbacks.GetRandomValue(nil, {}, random, values)
    end
    local function spawn(source, args)
        local count = args.CocoonCountMax or source.CocoonCountMax
        world.draws[#world.draws + 1] = { args.CocoonCountMin or source.CocoonCountMin, count }
        local ids = {}
        for _ = 1, count do
            local point = callbacks.SelectSpawnPoint(nil, {}, function()
                for _, id in ipairs(options.points or _G.CurrentRun.CurrentRoom.SpawnPoints.EnemyPoint) do
                    if not world.used[id] then return id end
                end
            end, _G.CurrentRun.CurrentRoom,
                { PreferredSpawnPoint = "EnemyPoint", RequiredSpawnPoint = args.RequiredSpawnPointType }, {})
            if not point then return end
            draw(args.CocoonOptions)
            draw({ "money", "enemy" })
            world.nextId = world.nextId + 1
            local id = world.nextId
            local object = { ObjectId = id, OccupyingSpawnPointId = point, SpawnUnitOnDeath = "enemy",
                MoneyDropOnDeath = 5 }
            world.used[point] = (world.used[point] or 0) + 1
            _G.MapState.ActiveObstacles[id] = object
            ids[#ids + 1] = id
            _G.CurrentRun.CurrentRoom.CoocoonIds = ids
            if options.afterObject then options.afterObject(object) end
        end
    end
    return function(source, args)
        if options.beforeSpawn then options.beforeSpawn() end
        callbacks.SpawnArachneCocoons(nil, {}, spawn, source, args)
        if options.afterSpawn then options.afterSpawn() end
        local reward = _G.MapState.ActiveObstacles[draw(_G.CurrentRun.CurrentRoom.CoocoonIds)]
        reward.OnDeathFunctionName = "SpawnRoomReward"
        reward.OnDeathFunctionArgs = { NofifyWaitersName = "ArachneRewardFound" }
        reward.SpawnUnitOnDeath = nil
        _G.CurrentRun.CurrentRoom.SpawnRewardOnId = reward.ObjectId
        return reward
    end
end

local function positionPhase(count, point)
    local phase = combatPhase(count)
    phase.customization = phase.customization or {}
    phase.customization[#phase.customization + 1] =
        { decisionKey = "cocoonRewardPoint", kind = "cocoonRewardPoint", spawnPointId = point }
    return phase
end

function TestArachne.testProducerCorpusSteersBothAndPositionOnlyWithoutExtraCocoons()
    local fixtures = require("tests.harness.fixture_loader")
    local protocol = require("mods.protocol.decoder")
    local json = require("mods.protocol.json")
    local file = assert(io.open(fixtures.path("underworld-arachne-cocoons.execution.json"), "rb"))
    local wire = file:read("*a")
    file:close()
    local plan = assert(protocol.decode(assert(json.decode(wire))))
    local visited = 0
    for _, occurrence in ipairs(plan.occurrences) do
        for _, phase in ipairs(occurrence.overview.encounterPhases) do
            if phase.encounterKey == "ArachneCombatF" or phase.encounterKey == "ArachneCombatG" then
                visited = visited + 1
                withPlacement(function(world)
                    local isF = phase.encounterKey == "ArachneCombatF"
                    local source, args = {}, nativeArgs()
                    if isF then args.RequiredSpawnPointType = nil end
                    local callbacks, diagnostics = attach(phase, source, { state = "synchronized" })
                    local reward = callbacks.SetupArachneCombatEncounter(nil, {},
                        placementSetup(callbacks, world), source, args)
                    local count, point = isF and 11 or 14, isF and 40191 or 560737
                    lu.assertEquals(world.draws, { { isF and 11 or 8, count } })
                    lu.assertEquals(#_G.CurrentRun.CurrentRoom.CoocoonIds, count)
                    lu.assertEquals(world.used[point], 1)
                    lu.assertEquals(reward.OccupyingSpawnPointId, point)
                    lu.assertEquals(reward.OnDeathFunctionName, "SpawnRoomReward")
                    lu.assertEquals(reward.OnDeathFunctionArgs, { NofifyWaitersName = "ArachneRewardFound" })
                    lu.assertNil(reward.SpawnUnitOnDeath)
                    lu.assertEquals(reward.MoneyDropOnDeath, 5)
                    lu.assertEquals(#world.random, count * 2)
                    lu.assertEquals(diagnostics, {})
                end)
            end
        end
    end
    lu.assertEquals(visited, 2)
end

function TestArachne.testPositionAdmissionAndCountAreIndependent()
    for _, case in ipairs({
        { point = 99, required = false, accepted = true, count = 11 },
        { point = 99, required = true, accepted = false, count = 11 },
        { point = 999, accepted = false, count = 11 },
        { point = 40191, occupied = true, accepted = false, count = 11 },
        { point = 40191, accepted = true, count = 15 },
    }) do
        withPlacement(function(world)
            local source, args = {}, nativeArgs()
            if not case.required then args.RequiredSpawnPointType = nil end
            if case.occupied then world.used[case.point] = 1 end
            local callbacks, diagnostics = attach(positionPhase(case.count, case.point), source,
                { state = "synchronized" })
            local reward = callbacks.SetupArachneCombatEncounter(nil, {},
                placementSetup(callbacks, world), source, args)
            lu.assertEquals(reward.OccupyingSpawnPointId == case.point, case.accepted)
            lu.assertEquals(world.draws, { case.count == 15 and { 8, 14 } or { 11, 11 } })
            lu.assertEquals(#diagnostics, case.accepted and case.count ~= 15 and 0 or 1)
        end)
    end
end

function TestArachne.testMissingSpawnedObjectFallsBackAndShortfallIsDiagnostic()
    withPlacement(function(world)
        local source = {}
        local callbacks, diagnostics = attach(positionPhase(11, 40191), source, { state = "synchronized" })
        local reward = callbacks.SetupArachneCombatEncounter(nil, {}, placementSetup(callbacks, world, {
            points = { 1, 2 },
            afterObject = function(object)
                if object.OccupyingSpawnPointId == 40191 then object.OccupyingSpawnPointId = nil end
            end,
        }), source, nativeArgs())
        lu.assertEquals(reward.OccupyingSpawnPointId, 2)
        lu.assertEquals(#_G.CurrentRun.CurrentRoom.CoocoonIds, 3)
        lu.assertEquals(diagnostics[1].observed.reason, "target-not-spawned")
        lu.assertEquals(diagnostics[2].observed.reason, "placement-shortfall")
    end)
end

function TestArachne.testScopesMaskNestedContactsAndRetireOnErrors()
    withPlacement(function(world)
        local source = {}
        local callbacks, diagnostics = attach(positionPhase(nil, 40191), source, { state = "synchronized" })
        local function nativePoint() return 99 end
        local function point()
            return callbacks.SelectSpawnPoint(nil, {}, nativePoint, _G.CurrentRun.CurrentRoom,
                { PreferredSpawnPoint = "EnemyPoint", RequiredSpawnPoint = "EnemyPoint" }, {})
        end
        local function random() return 99 end
        local reward = callbacks.SetupArachneCombatEncounter(nil, {}, placementSetup(callbacks, world, {
            beforeSpawn = function()
                -- Unbound nested setup must not inherit the outer position.
                callbacks.SetupArachneCombatEncounter(nil, {}, function()
                    lu.assertEquals(point(), 99)
                end, {}, nativeArgs())
                -- A failing nested preflight leaves the caller's setup intact.
                local eligible = _G.IsSpawnPointEligible
                _G.IsSpawnPointEligible = function() error("preflight") end
                lu.assertFalse(pcall(callbacks.SetupArachneCombatEncounter, nil, {}, function() end,
                    source, nativeArgs()))
                _G.IsSpawnPointEligible = eligible
            end,
            afterObject = function()
                callbacks.SpawnArachneCocoons(nil, {}, function() lu.assertEquals(point(), 99) end,
                    {}, nativeArgs())
                local thread = coroutine.create(function() lu.assertEquals(point(), 99) end)
                lu.assertTrue(coroutine.resume(thread))
            end,
            afterSpawn = function()
                local duplicate = {}
                for i, id in ipairs(_G.CurrentRun.CurrentRoom.CoocoonIds) do duplicate[i] = id end
                lu.assertEquals(callbacks.GetRandomValue(nil, {}, random, duplicate), 99)
                callbacks.SpawnArachneCocoons(nil, {}, function()
                    lu.assertEquals(callbacks.GetRandomValue(nil, {}, random,
                        _G.CurrentRun.CurrentRoom.CoocoonIds), 99)
                end, {}, nativeArgs())
            end,
        }), source, nativeArgs())
        lu.assertEquals(reward.OccupyingSpawnPointId, 40191)
        lu.assertEquals(diagnostics, {})
        lu.assertEquals(point(), 99)
        world.used[40191] = nil
        local ok = pcall(callbacks.SetupArachneCombatEncounter, nil, {}, function(s, a)
            callbacks.SpawnArachneCocoons(nil, {}, function() error("spawn failed", 0) end, s, a)
        end, source, nativeArgs())
        lu.assertFalse(ok)
        lu.assertEquals(point(), 99)
        callbacks.SpawnArachneCocoons(nil, {}, function() lu.assertEquals(point(), 99) end, {}, nativeArgs())
    end)
end

function TestArachne.testPositionStaysNativeForUnboundUnsynchronizedAndStoryContacts()
    for _, mode in ipairs({ "unbound", "unsynchronized", "story" }) do
        withPlacement(function(world)
            local source = {}
            local callbacks, diagnostics = attach(positionPhase(nil, 40191),
                mode == "unbound" and {} or source,
                { state = mode == "unsynchronized" and "desynchronized" or "synchronized" })
            if mode == "story" then
                callbacks.SpawnArachneCocoons(nil, {}, function()
                    lu.assertEquals(callbacks.SelectSpawnPoint(nil, {}, function() return 99 end,
                        _G.CurrentRun.CurrentRoom, { PreferredSpawnPoint = "EnemyPoint" }, {}), 99)
                    local ids = { 1, 2 }
                    _G.CurrentRun.CurrentRoom.CoocoonIds = ids
                    lu.assertEquals(callbacks.GetRandomValue(nil, {}, function() return 2 end, ids), 2)
                end, source, nativeArgs())
            else
                local reward = callbacks.SetupArachneCombatEncounter(nil, {},
                    placementSetup(callbacks, world), source, nativeArgs())
                lu.assertEquals(reward.OccupyingSpawnPointId, 14)
                lu.assertEquals(world.draws, { { 8, 14 } })
            end
            lu.assertEquals(diagnostics, {})
        end)
    end
end
