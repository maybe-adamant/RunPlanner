-- luacheck: globals TestAetos
local lu = require("luaunit")
local adapter = require("mods.room.timeline.encounters.aetos")
local protocol = require("mods.protocol.decoder")
local json = require("mods.protocol.json")
local fixtures = require("tests.harness.fixture_loader")

TestAetos = {}

local function harness(directive)
    local callbacks, diagnostics = {}, {}
    local phase = { slotKey = "Combat" }
    local occurrence = { id = "target", biomeKey = "P" }
    local native = { Tags = { "Outdoor" } }
    local encounter = { Name = "GeneratedP", SpawnWaves = { {}, {}, {} }, CurrentWaveNum = 1 }
    local events = {
        { FunctionName = "Other" },
        { FunctionName = "OlympusEagleSpawn", GameStateRequirements = {
            ChanceToPlay = 0.33, { SumPrevRooms = 20 }, { PathFalse = { "roomFlag" } },
        } },
        { FunctionName = "Gorgon" },
    }
    local state = { state = "synchronized", plan = { olympusAetos = directive } }
    local mapped = true
    local room = {
        occurrence = function() return mapped and occurrence or nil end,
        encounterPhase = function(_, value) return value == encounter and phase or nil end,
    }
    adapter.attach({ hooks = { wrap = function(name, _, fn) callbacks[name] = fn end } }, {
        diagnostic = function(_, _, observed) diagnostics[#diagnostics + 1] = observed end,
    }, function() return state end, function() end, room)
    local seen, nativeAllowed = {}, true
    local function dispatch(actual)
        for _, event in ipairs(actual or {}) do
            if event.FunctionName ~= "OlympusEagleSpawn" then
                seen[#seen + 1] = event.FunctionName
            elseif nativeAllowed and event.GameStateRequirements.ChanceToPlay == nil
                and encounter.CurrentWaveNum ~= 1 and native.Tags[1] == "Outdoor" then
                native.OlympusEagleSpawn = true
            end
        end
        return actual
    end
    local function wave(index, base, value)
        encounter.CurrentWaveNum = index
        return callbacks.RunEventsGeneric(nil, nil, base or dispatch, value or events, encounter)
    end
    return { state = state, phase = phase, occurrence = occurrence, native = native,
        encounter = encounter, events = events, diagnostics = diagnostics, seen = seen,
        wave = wave, reject = function() nativeAllowed = false end,
        setMapped = function(value) mapped = value end,
        nextEncounter = function() encounter = { Name = "GeneratedP", SpawnWaves = { {}, {} } } end,
        exit = function() callbacks.LeaveRoom(nil, nil, function() end, { CurrentRoom = native }) end }
end

local function withHarness(directive, fn)
    local priorRun, priorGame = _G.CurrentRun, _G.game
    local h = harness(directive)
    _G.CurrentRun = { CurrentRoom = h.native }
    _G.game = { EncounterData = { GeneratedP = { WaveStartUnthreadedEvents = h.events } } }
    local ok, err = pcall(fn, h)
    _G.CurrentRun, _G.game = priorRun, priorGame
    if not ok then error(err, 0) end
end

local function target(wave)
    return { kind = "target", occurrenceId = "target", phaseKey = "Combat", wave = wave or 2 }
end

function TestAetos.testNoneSuppressesOnlyAetosPreservingSiblingEvents()
    withHarness({ kind = "none" }, function(h)
        local actual = h.wave(2)
        lu.assertEquals(#actual, 2)
        lu.assertEquals(h.seen, { "Other", "Gorgon" })
        lu.assertEquals(#h.events, 3)
        lu.assertEquals(h.events[2].GameStateRequirements.ChanceToPlay, 0.33)
        lu.assertNil(h.native.OlympusEagleSpawn)
        lu.assertEquals(#h.diagnostics, 0)
    end)
end

function TestAetos.testTargetsWaveTwoAndThreeThenReleasesNative()
    for _, wave in ipairs({ 2, 3 }) do
        withHarness(target(wave), function(h)
            h.occurrence.id = "before"
            lu.assertEquals(#h.wave(2), 2)
            h.occurrence.id = "target"
            lu.assertEquals(#h.wave(1), 2)
            local actual = h.wave(wave)
            lu.assertEquals(actual[2].GameStateRequirements[1], h.events[2].GameStateRequirements[1])
            lu.assertNil(actual[2].GameStateRequirements.ChanceToPlay)
            lu.assertTrue(h.native.OlympusEagleSpawn)
            lu.assertIs(h.wave(wave), h.events)
            lu.assertEquals(#h.diagnostics, 0)
        end)
    end
end

function TestAetos.testActualOneWaveAndNativeCooldownFailOnlyDiagnostically()
    for _, missing in ipairs({ true, false }) do
        withHarness(target(), function(h)
            if missing then h.encounter.SpawnWaves = { {} } else h.reject() end
            h.wave(missing and 1 or 2)
            lu.assertNil(h.native.OlympusEagleSpawn)
            lu.assertEquals(#h.diagnostics, 1)
            lu.assertEquals(h.diagnostics[1].reason,
                missing and "missing-actual-wave" or "native-ineligible-or-missed")
            lu.assertEquals(#h.wave(2), 2)
            h.occurrence.id = "subsequent"
            -- A subsequent bound native encounter consumes the now-released directive.
            h.nextEncounter()
            lu.assertIs(h.wave(2), h.events)
            h.exit()
            lu.assertEquals(#h.diagnostics, 1)
            lu.assertEquals(h.state.state, "synchronized")
        end)
    end
end

function TestAetos.testUnmappedCallbackCannotRearmReleasedDirective()
    withHarness(target(), function(h)
        h.wave(2)
        h.setMapped(false)
        lu.assertIs(h.wave(2), h.events)
        h.setMapped(true)
        lu.assertIs(h.wave(2), h.events)
        lu.assertTrue(h.state.aetos.released)
    end)
end

function TestAetos.testMissingThirdWaveDoesNotRelocateOntoActualSecondWave()
    withHarness(target(3), function(h)
        h.encounter.SpawnWaves = { {}, {} }
        lu.assertEquals(#h.wave(1), 2)
        lu.assertEquals(#h.wave(2), 2)
        lu.assertNil(h.native.OlympusEagleSpawn)
        lu.assertEquals(#h.diagnostics, 1)
    end)
end

function TestAetos.testCallbackInvocationWithoutRoomFlagIsNotSuccess()
    withHarness(target(), function(h)
        local called = false
        h.wave(2, function(actual)
            called = true
            lu.assertNil(actual[2].GameStateRequirements.ChanceToPlay)
            -- Native callback may return early, for example when no longer Outdoor.
        end)
        lu.assertTrue(called)
        lu.assertEquals(#h.diagnostics, 1)
        lu.assertEquals(h.diagnostics[1].reason, "native-ineligible-or-missed")
        lu.assertEquals(#h.wave(3), 2)
        h.nextEncounter()
        lu.assertIs(h.wave(2), h.events)
    end)
end

function TestAetos.testSkippedOrMissedTargetExitReleasesWithoutAnyWaveContact()
    withHarness(target(), function(h)
        h.exit()
        lu.assertEquals(#h.diagnostics, 1)
        lu.assertIs(h.wave(2), h.events)
    end)
end

function TestAetos.testNativeErrorsAndYieldNeverMutateDeclaration()
    withHarness(target(), function(h)
        local co = coroutine.create(function()
            h.wave(2, function(actual)
                lu.assertNil(actual[2].GameStateRequirements.ChanceToPlay)
                coroutine.yield()
                error("native eagle error")
            end)
        end)
        lu.assertTrue(coroutine.resume(co))
        lu.assertEquals(h.events[2].GameStateRequirements.ChanceToPlay, 0.33)
        lu.assertIs(h.wave(2), h.events)
        local ok, err = coroutine.resume(co)
        lu.assertFalse(ok)
        lu.assertStrContains(err, "native eagle error")
        lu.assertEquals(h.events[2].GameStateRequirements.ChanceToPlay, 0.33)
    end)
end

function TestAetos.testUnrelatedDispatchUnboundAndBiomeDepartureRemainNative()
    withHarness({ kind = "none" }, function(h)
        local unrelated = { h.events[2] }
        lu.assertIs(h.wave(2, nil, unrelated), unrelated)
        h.occurrence.biomeKey = "Q"
        lu.assertIs(h.wave(2), h.events)
        lu.assertNil(h.state.aetos)
        h.occurrence.biomeKey = "P"
        h.state.state = "inactive"
        lu.assertIs(h.wave(2), h.events)
        lu.assertNil(h.state.aetos)
        h.state.state = "synchronized"
        h.state.plan = { olympusAetos = target() }
        h.wave(2)
        lu.assertTrue(h.native.OlympusEagleSpawn)
    end)
end

function TestAetos.testPlannerProducedNativeWaveTargetDecodesWithoutLuaMirror()
    local file = assert(io.open(fixtures.path("surface-generated-precombat.execution.json"), "rb"))
    local raw = file:read("*a"); file:close()
    local plan = assert(protocol.decode(assert(json.decode(raw))))
    lu.assertEquals(plan.olympusAetos.kind, "target")
    lu.assertEquals(plan.olympusAetos.wave, 2)
    local room = plan.occurrencesById[plan.olympusAetos.occurrenceId]
    lu.assertEquals(room.biomeKey, "P")
    lu.assertEquals(plan.olympusAetos.phaseKey, "Combat")
    for _, phase in ipairs(room.overview.encounterPhases) do
        if phase.slotKey == "Combat" then lu.assertNil(phase.customization) end
    end
end

function TestAetos.testMalformedDirectivesRejectedByRealDecoder()
    local file = assert(io.open(fixtures.path("surface-generated-precombat.execution.json"), "rb"))
    local raw = file:read("*a"); file:close()
    for _, value in ipairs({ false, {kind="target", occurrenceId="missing", phaseKey="Combat", wave=2},
        {kind="target", occurrenceId="target", phaseKey="Combat", wave=1},
        {kind="none", wave=2}, {kind="native"} }) do
        local plan = assert(json.decode(raw))
        plan.olympusAetos = value
        local decoded, err = protocol.decode(plan)
        lu.assertNil(decoded)
        lu.assertStrContains(err, "olympusAetos")
    end
end

return TestAetos
