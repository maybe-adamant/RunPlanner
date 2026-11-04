-- luacheck: globals TestPlanEndAndStores
-- A plan's end (a cut biome, a Hub stay ended after a visit) over the planner's
-- fixtures, and the room-exit reward store fact.
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local protocol = require("mods.protocol.decoder")
local route = require("mods.route.session")
local conformance = require("mods.protocol.conformance")
local readers = require("mods.room.conformance.readers")
local proof = require("mods.room.conformance.proof")
local text = require("mods.presentation.mismatch_text")
local json = require("mods/protocol/json")

TestPlanEndAndStores = {}

local function loadPlan(name)
    return assert(protocol.decode(fixtures.decode(name .. ".execution.json")))
end

local function walk(cursor)
    while route.expected(cursor) ~= nil do
        local occurrence = route.expected(cursor)
        assert(route.enter(cursor, occurrence.id, occurrence.gameName))
        assert(route.exit(cursor))
    end
end

local function hubOf(plan)
    for _, occurrence in ipairs(plan.occurrences) do
        if occurrence.overview.hub ~= nil then return occurrence.overview.hub end
    end
end

local function storeFact(occurrence)
    for _, fact in ipairs(occurrence.roomExitConformance and occurrence.roomExitConformance.facts or {}) do
        if fact.kind == "rewardStores" then return fact end
    end
end

function TestPlanEndAndStores.testACutEndRoomIsTheLastRoomAndCompletesThePrefix()
    local plan = loadPlan("underworld-f-cut-end")
    local last = plan.selectedOccurrenceIds[#plan.selectedOccurrenceIds]
    lu.assertEquals(last, "golden-f-b5-e1")
    lu.assertEquals(plan.occurrencesById[last].doors.kind, "terminal")
    lu.assertEquals(plan.extent.biomeKeys, { "F" })
    local cursor = route.new(plan)
    walk(cursor)
    -- The next native room is past the plan: the cursor reports the prefix complete.
    lu.assertNil(route.expected(cursor))
    lu.assertTrue(route.enter(cursor, nil, "F_Combat01"))
end

function TestPlanEndAndStores.testAHubStayEndedAfterAVisitHasNoHandoffOrLaterDeparture()
    local plan = loadPlan("surface-n-partial-hub")
    local hub = hubOf(plan)
    lu.assertNil(hub.finalHandoff)
    lu.assertEquals(#hub.departures, hub.requiredVisitCount)
    lu.assertNotNil(hub.fountain)
    lu.assertEquals(plan.selectedOccurrenceIds[#plan.selectedOccurrenceIds], "surface-n-combat05-sideDoor1")
    local cursor = route.new(plan)
    local departures = 0
    while route.expected(cursor) ~= nil do
        if route.hubDeparture(cursor) ~= nil then departures = departures + 1 end
        local occurrence = route.expected(cursor)
        assert(route.enter(cursor, occurrence.id, occurrence.gameName))
        assert(route.exit(cursor))
    end
    lu.assertEquals(departures, hub.requiredVisitCount)
    lu.assertNil(route.hubDeparture(cursor))
end

function TestPlanEndAndStores.testAHubHandoffStillRequiresItsFountainAndEveryDeparture()
    local value = fixtures.decode("surface-n.execution.json")
    for _, occurrence in ipairs(value.occurrences) do
        if occurrence.overview.hub ~= nil then table.remove(occurrence.overview.hub.departures) end
    end
    local decoded, reason = protocol.decode(value)
    lu.assertNil(decoded)
    lu.assertStrContains(reason, "departures has invalid length")
end

function TestPlanEndAndStores.testTheEndRoomComparesNoRewardStores()
    local plan = loadPlan("underworld-f-cut-end")
    lu.assertNil(storeFact(plan.occurrencesById["golden-f-b5-e1"]))
    local compared = 0
    for _, occurrence in ipairs(plan.occurrences) do
        local fact = storeFact(occurrence)
        if fact ~= nil then
            compared = compared + 1
            for _, store in ipairs(fact.stores) do
                local expected = occurrence.conformanceExpected.rewardStores[store.name]
                lu.assertEquals(expected.rewardTypes, store.rewardTypes)
                lu.assertNotNil(expected.remainingEntryCounts)
            end
        end
    end
    lu.assertTrue(compared > 0)
end

local function storeOccurrence()
    local frame = { rewardStores = { { name = "RunProgress", remainingEntryCounts = { 1, 0, 2, 1 } } } }
    local value = assert(json.decode(
        '{"facts":[{"kind":"rewardStores","stores":[{"name":"RunProgress","rewardTypes":["Boon","MaxHealthDrop"]}]}]}'))
    local expected = assert(conformance.resolve(value, { beforeRoomExit = frame }, "test"))
    return { roomExitConformance = value, conformanceExpected = expected }
end

local DECLARED = {
    RunProgress = { { Name = "Boon" }, { Name = "MaxHealthDrop" }, { Name = "Boon" }, { Name = "Unrelated" } },
}

local function prove(occurrence, live)
    local priorData = _G.RewardStoreData
    _G.RewardStoreData = DECLARED
    local ok, issue = proof.prove(occurrence, function(kind, expected)
        return readers.read(kind, { RewardStores = { RunProgress = live } }, {}, expected)
    end)
    _G.RewardStoreData = priorData
    return ok, issue
end

function TestPlanEndAndStores.testStoresCompareRemainingCountsByRewardType()
    local occurrence = storeOccurrence()
    -- Boon: 1 + 2 by the declaration; uncompared types are ignored on both sides.
    lu.assertTrue(prove(occurrence, { { Name = "Boon" }, { Name = "Unrelated" }, { Name = "Boon" },
        { Name = "Boon" }, { Name = "Unrelated" } }))
    local ok, issue = prove(occurrence, { { Name = "Boon" }, { Name = "Boon" }, { Name = "MaxHealthDrop" } })
    lu.assertNil(ok)
    lu.assertEquals(issue.checkpoint, "room-exit-conformance:rewardStores")
    lu.assertEquals(issue.expected, { RunProgress = { Boon = 3, MaxHealthDrop = 0 } })
    lu.assertEquals(issue.observed, { RunProgress = { Boon = 2, MaxHealthDrop = 1 } })
    lu.assertEquals(text.difference(issue), "the rewards left to draw differ from the plan")
end

function TestPlanEndAndStores.testAStoreFactMustNameAFramedStoreAndDistinctTypes()
    local frame = { beforeRoomExit = { rewardStores = { { name = "RunProgress", remainingEntryCounts = { 1 } } } } }
    for _, case in ipairs({
        { '[{"name":"HubRewards","rewardTypes":["Boon"]}]', "store the frame lacks" },
        { '[{"name":"RunProgress","rewardTypes":["Boon","Boon"]}]', "must be distinct" },
        { '[]', "must be nonempty" },
    }) do
        local value = assert(json.decode('{"facts":[{"kind":"rewardStores","stores":' .. case[1] .. '}]}'))
        local expected, reason = conformance.resolve(value, frame, "test")
        lu.assertNil(expected)
        lu.assertStrContains(reason, case[2])
    end
end

function TestPlanEndAndStores.testAFieldsBatchMustCarryItsCageRollOutcome()
    local plan = loadPlan("underworld-fgh")
    local outcomes = 0
    for _, occurrence in ipairs(plan.occurrences) do
        if occurrence.doors.cageCountOutcome ~= nil then outcomes = outcomes + 1 end
    end
    lu.assertTrue(outcomes > 0)
    local value = fixtures.decode("underworld-fgh.execution.json")
    for _, occurrence in ipairs(value.occurrences) do
        if occurrence.doors.cageCountOutcome ~= nil then occurrence.doors.cageCountOutcome = nil break end
    end
    local decoded, reason = protocol.decode(value)
    lu.assertNil(decoded)
    lu.assertStrContains(reason, "cageCountOutcome is required")
end

return TestPlanEndAndStores
