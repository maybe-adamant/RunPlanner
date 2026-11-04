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

function TestPlanEndAndStores.testEveryRoomExitButTheEndRoomComparesThePlansStores()
    local plan = loadPlan("underworld-f-cut-end")
    lu.assertNil(plan.occurrencesById["golden-f-b5-e1"].rewardStoresExpected)
    for _, id in ipairs(plan.selectedOccurrenceIds) do
        local occurrence = plan.occurrencesById[id]
        if id ~= "golden-f-b5-e1" then
            lu.assertNotNil(occurrence.rewardStoresExpected, id)
            lu.assertNotNil(occurrence.rewardStoresExpected.RunProgress, id)
        end
    end
    for _, store in ipairs(plan.rewardStoreComparison) do lu.assertNotEquals(store.name, "Secrets") end
end

-- Native declarations aligned with each compared store's frame counts, and the
-- live store those counts describe.
local function nativeStores(expected)
    local declared, live = {}, {}
    for name, store in pairs(expected) do
        declared[name], live[name] = {}, {}
        for index, count in ipairs(store.remainingEntryCounts) do
            local entry = { Name = store.rewardTypes[(index - 1) % #store.rewardTypes + 1] }
            declared[name][index] = entry
            for _ = 1, count do live[name][#live[name] + 1] = { Name = entry.Name } end
        end
    end
    return declared, live
end

local function proveStores(occurrence, declared, live)
    local priorData = _G.RewardStoreData
    _G.RewardStoreData = declared
    local ok, issue = proof.prove(occurrence, function(kind, expected)
        if kind == "rewardStores" then return readers.read(kind, { RewardStores = live }, {}, expected) end
        if kind == "hermesDeliveries" then return expected end
        return expected
    end)
    _G.RewardStoreData = priorData
    return ok, issue
end

local function sameStores(left, right)
    for name, store in pairs(left or {}) do
        local other = right and right[name]
        if other == nil or #other.remainingEntryCounts ~= #store.remainingEntryCounts then return false end
        for index, count in ipairs(store.remainingEntryCounts) do
            if other.remainingEntryCounts[index] ~= count then return false end
        end
    end
    return left ~= nil
end

function TestPlanEndAndStores.testAnUnplannedDrawIsAMismatchAtTheRoomItWasMadeIn()
    -- A room whose planned stores do not change still compares them at its own exit.
    local plan = loadPlan("fg")
    local previous, quiet
    for _, id in ipairs(plan.selectedOccurrenceIds) do
        local occurrence = plan.occurrencesById[id]
        if previous ~= nil and sameStores(occurrence.rewardStoresExpected, previous.rewardStoresExpected) then
            quiet = occurrence
            break
        end
        previous = occurrence
    end
    lu.assertNotNil(quiet, "fg has a room whose planned stores stay unchanged")
    local isolated = { rewardStoresExpected = quiet.rewardStoresExpected }
    local declared, live = nativeStores(quiet.rewardStoresExpected)
    lu.assertTrue(proveStores(isolated, declared, live))
    table.remove(live.RunProgress)
    local ok, issue = proveStores(isolated, declared, live)
    lu.assertNil(ok)
    lu.assertEquals(issue.checkpoint, "room-exit-conformance:rewardStores")
    lu.assertEquals(text.difference(issue), "the rewards left to draw differ from the plan")
end

function TestPlanEndAndStores.testStoresCompareRemainingCountsByRewardType()
    local frame = { rewardStores = { { name = "RunProgress", remainingEntryCounts = { 1, 0, 2, 1 } } } }
    local comparison = assert(conformance.rewardStoreComparison(assert(json.decode(
        '[{"name":"RunProgress","rewardTypes":["Boon","MaxHealthDrop"]},{"name":"HubRewards","rewardTypes":["Boon"]}]')),
        "test"))
    -- A store the frame leaves out (it differs by planned branch) is not compared.
    local occurrence = { rewardStoresExpected = conformance.rewardStoresExpected(comparison, frame) }
    lu.assertNil(occurrence.rewardStoresExpected.HubRewards)
    local declared = {
        RunProgress = { { Name = "Boon" }, { Name = "MaxHealthDrop" }, { Name = "Boon" }, { Name = "Unrelated" } },
    }
    -- Boon: 1 + 2 by the declaration; uncompared types are ignored on both sides.
    lu.assertTrue(proveStores(occurrence, declared, { RunProgress = { { Name = "Boon" }, { Name = "Unrelated" },
        { Name = "Boon" }, { Name = "Boon" }, { Name = "Unrelated" } } }))
    local ok, issue = proveStores(occurrence, declared,
        { RunProgress = { { Name = "Boon" }, { Name = "Boon" }, { Name = "MaxHealthDrop" } } })
    lu.assertNil(ok)
    lu.assertEquals(issue.expected, { RunProgress = { Boon = 3, MaxHealthDrop = 0 } })
    lu.assertEquals(issue.observed, { RunProgress = { Boon = 2, MaxHealthDrop = 1 } })
end

function TestPlanEndAndStores.testTheComparisonMustNameDistinctStoresAndTypes()
    for _, case in ipairs({
        { '[{"name":"RunProgress","rewardTypes":["Boon"]},{"name":"RunProgress","rewardTypes":["Boon"]}]',
            "invalid or duplicate name" },
        { '[{"name":"RunProgress","rewardTypes":["Boon","Boon"]}]', "must be distinct" },
        { '[{"name":"RunProgress","rewardTypes":[]}]', "must be nonempty" },
    }) do
        local stores, reason = conformance.rewardStoreComparison(assert(json.decode(case[1])), "test")
        lu.assertNil(stores)
        lu.assertStrContains(reason, case[2])
    end
    local value = fixtures.decode("f-opening.execution.json")
    value.rewardStoreComparison = nil
    local decoded, reason = protocol.decode(value)
    lu.assertNil(decoded)
    lu.assertStrContains(reason, "rewardStoreComparison")
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
