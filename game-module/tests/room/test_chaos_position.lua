-- luacheck: globals TestChaosPosition
local lu = require("luaunit")
local hooks = require("mods.room.features.hooks")
local support = require("tests.harness.hook_composition")
local fixtures = require("tests.harness.fixture_loader")
local protocol = require("mods.protocol.decoder")
local json = require("mods.protocol.json")

TestChaosPosition = {}

function TestChaosPosition:setUp()
    self.getIds = _G.GetIdsByType
end

function TestChaosPosition:tearDown()
    _G.GetIdsByType = self.getIds
end

local function harness(additional)
    local module, _, callbacks = support.capture()
    local state = { state = "synchronized" }
    local diagnostics = {}
    local session = support.stub()
    session.diagnostic = function(_, kind, evidence)
        diagnostics[#diagnostics + 1] = { kind = kind, evidence = evidence }
    end
    hooks.attach(module, session, function() return state end, function() end, {
        additional = function() return additional, { id = "chaos" } end,
    })
    return callbacks, state, diagnostics
end

local function spawn(callbacks, args)
    return callbacks.SpawnObstacle(nil, {}, function(value) return value end, args)
end

function TestChaosPosition.testManualAndPublishedIxionUseSortedPointsAndNativeFlow()
    local file = assert(io.open(fixtures.path("fg-ixion-chaos.execution.json"), "rb"))
    local plan = assert(protocol.decode(assert(json.decode(file:read("*a")))))
    file:close()
    local ixion
    for _, occurrence in ipairs(plan.occurrences) do
        for _, additional in ipairs(occurrence.overview.additional or {}) do
            if additional.kind == "chaos" then ixion = additional end
        end
    end
    lu.assertNotNil(ixion)
    lu.assertEquals(ixion.spawnPointIndex, 1)
    lu.assertNotNil(ixion.ixionOrigin)
    for _, gate in ipairs({ { spawnPointIndex = 2 }, ixion }) do
        local callbacks = harness(gate)
        local ids = { 100, 2, 30 }
        _G.GetIdsByType = function(args)
            lu.assertEquals(args.Name, "SecretPoint")
            return ids
        end
        local run = { ixionUses = gate.ixionOrigin and 1 or 0, healthCost = 15 }
        local spawned, roomChoices, draws = {}, 0, 0
        local result = callbacks.HandleSecretSpawns(nil, {}, function(currentRun)
            lu.assertTrue(callbacks.IsSecretDoorEligible(nil, {}, function() return false end, currentRun, {}))
            -- Native eligibility, Ixion consumption, room choice and point draw
            -- still execute before the sole obstacle creation contact.
            if currentRun.ixionUses > 0 then currentRun.ixionUses = currentRun.ixionUses - 1; currentRun.healthCost = 0 end
            roomChoices = roomChoices + 1
            draws = draws + 1
            local args = { Name = "SecretDoor", DestinationId = 100, Group = "Standing", Custom = true }
            spawned[#spawned + 1] = spawn(callbacks, args)
            lu.assertEquals(args.DestinationId, 100)
            lu.assertEquals(spawn(callbacks, { Name = "WellShop", DestinationId = 100 }).DestinationId, 100)
            currentRun.door = spawned[1]
            return "native-result"
        end, run)
        lu.assertEquals(result, "native-result")
        lu.assertEquals(#spawned, 1)
        lu.assertEquals(spawned[1], { Name = "SecretDoor", DestinationId = gate.spawnPointIndex == 1 and 2 or 30,
            Group = "Standing", Custom = true })
        lu.assertEquals(ids, { 100, 2, 30 })
        lu.assertEquals({ roomChoices, draws, run.ixionUses }, { 1, 1, 0 })
        lu.assertEquals(run.healthCost, gate.ixionOrigin and 0 or 15)
        lu.assertIs(run.door, spawned[1])
        lu.assertEquals(spawn(callbacks, { Name = "SecretDoor", DestinationId = 100 }).DestinationId, 100)
    end
end

function TestChaosPosition.testDefaultUnsynchronizedAndUnrelatedSpawnsPassThrough()
    for _, mode in ipairs({ "default", "unsynchronized", "absent" }) do
        local gate = mode == "default" and {} or { spawnPointIndex = 2 }
        local callbacks, state = harness(mode ~= "absent" and gate or nil)
        if mode == "unsynchronized" then state.state = "desynchronized" end
        _G.GetIdsByType = function() error("native point lookup must remain untouched") end
        callbacks.HandleSecretSpawns(nil, {}, function()
            local args = { Name = "SecretDoor", DestinationId = 7 }
            lu.assertIs(spawn(callbacks, args), args)
        end, {})
    end
    local callbacks = harness({ spawnPointIndex = 2 })
    callbacks.HandleSecretSpawns(nil, {}, function()
        local args = { Name = "Shrine", DestinationId = 7 }
        lu.assertIs(spawn(callbacks, args), args)
    end, {})
end

function TestChaosPosition.testMissingIndexDiagnosesOnceAndLeavesNativeDestination()
    local callbacks, state, diagnostics = harness({ spawnPointIndex = 4 })
    _G.GetIdsByType = function() return { 10, 2 } end
    callbacks.HandleSecretSpawns(nil, {}, function()
        for _ = 1, 2 do
            local args = { Name = "SecretDoor", DestinationId = 10 }
            lu.assertIs(spawn(callbacks, args), args)
        end
    end, {})
    lu.assertEquals(diagnostics, { { kind = "chaos-position-unavailable", evidence = { spawnPointIndex = 4, pointCount = 2 } } })
    lu.assertEquals(state.state, "synchronized")
end

function TestChaosPosition.testNestedScopeRestoresOuterAndFaultClearsPosition()
    local gate = { spawnPointIndex = 2 }
    local callbacks, state = harness(gate)
    _G.GetIdsByType = function() return { 30, 10 } end
    callbacks.HandleSecretSpawns(nil, {}, function()
        gate.spawnPointIndex = nil
        callbacks.HandleSecretSpawns(nil, {}, function()
            lu.assertEquals(spawn(callbacks, { Name = "SecretDoor", DestinationId = 10 }).DestinationId, 10)
        end, {})
        gate.spawnPointIndex = 2
        state.state = "desynchronized"
        callbacks.HandleSecretSpawns(nil, {}, function()
            lu.assertEquals(spawn(callbacks, { Name = "SecretDoor", DestinationId = 10 }).DestinationId, 10)
        end, {})
        state.state = "synchronized"
        local ok, message = pcall(callbacks.HandleSecretSpawns, nil, {}, function()
            callbacks.SpawnObstacle(nil, {}, function() error("native spawn fault") end, { Name = "SecretDoor", DestinationId = 10 })
        end, {})
        lu.assertFalse(ok)
        lu.assertStrContains(message, "native spawn fault")
        lu.assertEquals(spawn(callbacks, { Name = "SecretDoor", DestinationId = 10 }).DestinationId, 30)
        lu.assertEquals(spawn(callbacks, { Name = "SecretDoor", DestinationId = 10 }).DestinationId, 10)
    end, {})
    local ok = pcall(callbacks.HandleSecretSpawns, nil, {}, function() error("native handler fault") end, {})
    lu.assertFalse(ok)
    lu.assertEquals(spawn(callbacks, { Name = "SecretDoor", DestinationId = 10 }).DestinationId, 10)
    lu.assertFalse(callbacks.IsSecretDoorEligible(nil, {}, function() return false end, {}, {}))
end

function TestChaosPosition.testPointLookupFaultPropagatesAndRestoresScope()
    local callbacks, _, diagnostics = harness({ spawnPointIndex = 1 })
    _G.GetIdsByType = function() error("native point lookup fault") end
    local ok, message = pcall(callbacks.HandleSecretSpawns, nil, {}, function()
        spawn(callbacks, { Name = "SecretDoor", DestinationId = 10 })
    end, {})
    lu.assertFalse(ok)
    lu.assertStrContains(message, "native point lookup fault")
    lu.assertEquals(diagnostics, {})
    lu.assertEquals(spawn(callbacks, { Name = "SecretDoor", DestinationId = 10 }).DestinationId, 10)
end
