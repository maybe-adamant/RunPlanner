-- luacheck: globals TestRuntimeSession
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local route = require("mods.route.session")
local room = require("mods.room.coordinator")
local runtime = require("mods.runtime.session")
local timeline = require("mods.room.timeline.bindings")
local timelineSession = require("mods.room.timeline.session")
local protocol = require("mods.protocol.decoder")
local occurrenceProtocol = require("mods.protocol.occurrences")
local json = require("mods.protocol.json")

TestRuntimeSession = {}

function TestRuntimeSession.testNewRunResetClearsEveryProcessLocalExecutionReference()
    local value = runtime.create()
    value.initialized = true
    value.state = "desynchronized"
    value.reason = "first-mismatch"
    value.plan = { stale = true }
    value.aetos = { released = true, plan = value.plan }
    value.route = { stale = true }
    value.room = { current = { stale = true } }
    value.firstMismatch = { checkpoint = "stale" }
    value.loggedMismatch = value.firstMismatch
    value.loggedSession = value.plan
    value.firstFault = { checkpoint = "stale-fault" }
    value.loggedFault = value.firstFault
    value.admissionError = { checkpoint = "stale-admission" }
    value.loggedAdmission = value.admissionError
    value.diagnostics = { { stale = true } }

    runtime.beginNewRun(value)

    lu.assertFalse(value.initialized)
    lu.assertEquals(value.state, "inactive")
    lu.assertEquals(value.reason, "not-started")
    lu.assertNil(value.plan)
    lu.assertNil(value.aetos)
    lu.assertNil(value.route)
    lu.assertNil(value.room)
    lu.assertNil(value.firstMismatch)
    lu.assertNil(value.loggedMismatch)
    lu.assertNil(value.loggedSession)
    lu.assertNil(value.firstFault)
    lu.assertNil(value.loggedFault)
    lu.assertNil(value.admissionError)
    lu.assertNil(value.loggedAdmission)
    lu.assertEquals(value.diagnostics, {})
end

local function fingerprintBody(plan)
    return {
        format = plan.format,
        catalogVersion = plan.catalogVersion,
        projectId = plan.projectId,
        routeKey = plan.routeKey,
        startingLoadout = plan.startingLoadout,
        startingKeepsake = plan.startingKeepsake,
        extent = plan.extent,
        selectedOccurrenceIds = plan.selectedOccurrenceIds,
        resources = plan.resources,
        occurrences = plan.occurrences,
    }
end

local function occurrence()
    return {
        id = "one", gameName = "F_Test", overview = { encounterPhases = {}, requiredObjects = {} },
        transactionsByOwner = {
            owner = {
                owner = "owner", kind = "acquisition", offerKey = "offer",
                window = { kind = "standard", phase = "beforeCombat" },
            },
        },
        timeline = { dependencies = {}, obligations = {} }, doors = { kind = "terminal" },
        roomExitConformance = { facts = {} }, conformanceExpected = {},
    }
end

local function state()
    local row = occurrence()
    local plan = { occurrences = { row }, occurrencesById = { one = row }, selectedOccurrenceIds = { "one" } }
    local value = { state = "synchronized", route = route.new(plan), room = room.new(plan, nil, {
        timelineIndex = timeline.index,
    }), diagnostics = {} }
    local entered = assert(route.enter(value.route, "one", "F_Test"))
    assert(room.enter(value, entered))
    return value
end

function TestRuntimeSession.testUnsupportedConformancePlanIsRejectedAtAdmission()
    for _, kind in ipairs({ "echoShopDuplicate", "hermesShrineDeliveries" }) do
        local row = occurrence()
        row.roomExitConformance = { facts = { { kind = kind } } }
        local plan = {
            kind = "ready", occurrences = { row }, occurrencesById = { one = row },
            selectedOccurrenceIds = { "one" },
        }
        local value = {}
        lu.assertNil(runtime.start(value, { load = function() return true, plan end }))
        lu.assertEquals(value.admissionError.observed, kind)
        lu.assertNil(value.firstMismatch)
        lu.assertEquals(value.state, "inactive")
    end
end

function TestRuntimeSession.testMalformedPlanAdmissionPreservesTheInboxDecoderReasonWithoutMismatch()
    local value = {}
    local fakeInbox = {
        load = function() return false, "malformed-plan" end,
        status = function()
            return { error = { code = "malformed-plan", message = "specific decoder rejection" } }
        end,
    }
    lu.assertNil(runtime.start(value, fakeInbox))
    lu.assertEquals(value.admissionError.observed, {
        code = "malformed-plan",
        message = "specific decoder rejection",
    })
    lu.assertNil(value.firstMismatch)
    lu.assertEquals(value.state, "inactive")
end

function TestRuntimeSession.testDreamPlanRequiresTheNativeDreamRunFlag()
    local prior = _G.CurrentRun
    _G.CurrentRun = {}
    local row = occurrence()
    local plan = {
        kind = "ready", routeKey = "Dream", occurrences = { row },
        occurrencesById = { one = row }, selectedOccurrenceIds = { "one" },
    }
    local value = {}
    lu.assertNil(runtime.start(value, { load = function() return true, plan end }))
    lu.assertEquals(value.admissionError.checkpoint, "run-mode")
    lu.assertEquals(value.admissionError.observed, { isDreamRun = false })
    _G.CurrentRun = prior
end

function TestRuntimeSession.testUnknownCoreHandleIsAFaultWithoutAMismatch()
    local row = occurrence()
    local plan = { kind = "ready", occurrences = { row }, occurrencesById = { one = row },
        selectedOccurrenceIds = { "one" } }
    local value = {}
    lu.assertTrue(runtime.start(value, { load = function() return true, plan end }))
    local entered = assert(route.enter(value.route, "one", "F_Test"))
    lu.assertNotNil(room.enter(value, entered))

    lu.assertNil(room.begin(value, {}))
    lu.assertEquals(value.firstFault.checkpoint, "timeline-handle")
    lu.assertNil(value.firstMismatch)
    lu.assertEquals(value.state, "faulted")
end

function TestRuntimeSession.testMissingRoomDeclarationIsAFaultWithoutAMismatch()
    local row = occurrence()
    local plan = { kind = "ready", occurrences = { row }, occurrencesById = { one = row },
        selectedOccurrenceIds = { "one" } }
    local value = {}
    lu.assertTrue(runtime.start(value, { load = function() return true, plan end }))

    lu.assertNil(room.realize(value, row, { RoomData = {} }))
    lu.assertEquals(value.firstFault.checkpoint, "room-declaration")
    lu.assertNil(value.firstMismatch)
    lu.assertEquals(value.state, "faulted")
end

function TestRuntimeSession.testFirstTerminalOutcomeCannotBeOverwrittenByTheOtherKind()
    local mismatchFirst = runtime.create()
    runtime.mismatch(mismatchFirst, "room-entry", "F_Test", "F_Wrong")
    runtime.fault(mismatchFirst, "timeline-handle", "known handle", "unknown")
    lu.assertEquals(mismatchFirst.state, "desynchronized")
    lu.assertEquals(mismatchFirst.firstMismatch.checkpoint, "room-entry")
    lu.assertNil(mismatchFirst.firstFault)

    local faultFirst = runtime.create()
    runtime.fault(faultFirst, "timeline-handle", "known handle", "unknown")
    runtime.mismatch(faultFirst, "room-entry", "F_Test", "F_Wrong")
    lu.assertEquals(faultFirst.state, "faulted")
    lu.assertEquals(faultFirst.firstFault.checkpoint, "timeline-handle")
    lu.assertNil(faultFirst.firstMismatch)
end

function TestRuntimeSession.testOccurrenceDiagnosticsAreBoundedBeforeAMismatch()
    local value = state()
    for index = 1, 20 do runtime.diagnostic(value, "run-state", { index = index }) end
    lu.assertEquals(#value.diagnostics, 16)
    lu.assertEquals(value.diagnostics[1].observed.index, 5)
    runtime.mismatch(value, "room-entry", "F_Test", "F_Wrong")
    lu.assertEquals(value.firstMismatch.checkpoint, "room-entry")
    lu.assertEquals(#value.diagnostics, 16)
end

function TestRuntimeSession.testAdmissionLoadsTheSelectedSlotAndFreezesItsPlan()
    local first = occurrence()
    first.gameName = "F_First"
    local second = occurrence()
    second.id, second.gameName = "two", "F_Second"
    local selected, plans = nil, { [3] = {
        kind = "ready", occurrences = { first }, occurrencesById = { one = first },
        selectedOccurrenceIds = { "one" },
    }, [4] = {
        kind = "ready", occurrences = { second }, occurrencesById = { two = second },
        selectedOccurrenceIds = { "two" },
    } }
    local inbox = {
        load = function(slot) selected = slot; return true, plans[slot] end,
        status = function() return {} end,
    }
    local value = {}
    lu.assertTrue(runtime.start(value, inbox, nil, 3))
    lu.assertEquals(selected, 3)
    lu.assertEquals(value.planSlot, 3)
    lu.assertTrue(rawequal(value.plan, plans[3]))
end

function TestRuntimeSession.testInboxSlotSelectionCannotMutateAnAdmittedPlan()
    local row = occurrence()
    local plan = { kind = "ready", occurrences = { row }, occurrencesById = { one = row }, selectedOccurrenceIds = { "one" } }
    local selected = 1
    local inbox = {
        load = function(slot) selected = slot; return true, plan end,
        select = function(slot) selected = slot end,
        status = function() return {} end,
    }
    local value = {}
    lu.assertTrue(runtime.start(value, inbox, nil, 1))
    inbox.select(6)
    lu.assertEquals(selected, 6)
    lu.assertTrue(rawequal(value.plan, plan))
    lu.assertEquals(value.plan.occurrences[1].id, "one")
    lu.assertEquals(value.planSlot, 1)
    runtime.beginNewRun(value)
    lu.assertNil(value.plan)
    lu.assertNil(value.planSlot)
end

function TestRuntimeSession.testStartingPhaseExposesOnlyTheBoundedStartingOccurrence()
    local row = occurrence()
    local plan = {
        kind = "ready", occurrences = { row }, occurrencesById = { one = row },
        selectedOccurrenceIds = { "one" },
    }
    local value = {}
    lu.assertTrue(runtime.start(value, { load = function() return true, plan end }, "starting"))
    lu.assertEquals(value.state, "starting")
    lu.assertEquals(route.expected(value.route), row)
    lu.assertNil(room.current(value))
end

function TestRuntimeSession.testOnlyAnUnadmittedProcessReportsAResumedRunUnsteered()
    local row = occurrence()
    local plan = {
        kind = "ready", occurrences = { row }, occurrencesById = { one = row },
        selectedOccurrenceIds = { "one" },
    }
    local fresh = runtime.create()
    lu.assertTrue(runtime.resumeUnsteered(fresh))
    lu.assertEquals(runtime.status(fresh), { state = "inactive", reason = "resumed-unsteered" })
    local admitted = runtime.create()
    lu.assertTrue(runtime.start(admitted, { load = function() return true, plan end }, "starting", 1))
    lu.assertFalse(runtime.resumeUnsteered(admitted))
    lu.assertEquals(admitted.reason, "ready")
    local rejected = runtime.create()
    runtime.start(rejected, { load = function() return false end }, "starting", 1)
    lu.assertFalse(runtime.resumeUnsteered(rejected))
    lu.assertEquals(rejected.reason, "admission-rejected")
end

function TestRuntimeSession.testRouteRecoveryConstructorRejectsAnInvalidIndex()
    local plan = { selectedOccurrenceIds = { "one", "two" } }
    local recovered, errorValue = route.newAt(plan, 0)
    lu.assertNil(recovered)
    lu.assertEquals(errorValue.checkpoint, "route-index")
    lu.assertEquals(route.new(plan).index, 1)
end

function TestRuntimeSession.testPreparedDestinationBindingsAreReusedWhenTheRoomStarts()
    local row = occurrence()
    local plan = { occurrences = { row }, occurrencesById = { one = row }, selectedOccurrenceIds = { "one" } }
    local value = { state = "synchronized", route = route.new(plan), room = room.new(plan, nil, {
        timelineIndex = timeline.index,
    }), diagnostics = {} }

    local prepared = room.prepare(value, row)
    lu.assertNotNil(prepared)
    local native = {}
    local handle = assert(room.resolve(value, prepared, { kind = "offer", offerKey = "offer" }))
    lu.assertTrue(rawequal(assert(room.bind(value, prepared, handle, native)), handle))
    local entered = assert(route.enter(value.route, "one", "F_Test"))
    lu.assertNotNil(room.enter(value, entered))
    lu.assertEquals(value.room.current.occurrence, row)
    lu.assertTrue(rawequal(room.bound(value, value.room.current, native), handle))
    lu.assertNil(value.room.prepared)
end

function TestRuntimeSession.testPreparedBindingsCannotLeakToAnotherOccurrence()
    local first = occurrence()
    local second = occurrence()
    second.id, second.gameName = "two", "F_Next"
    local plan = {
        occurrences = { first, second },
        occurrencesById = { one = first, two = second },
        selectedOccurrenceIds = { "one", "two" },
    }
    local value = { state = "synchronized", route = route.new(plan), room = room.new(plan, nil, {
        timelineIndex = timeline.index,
    }), diagnostics = {} }

    assert(room.prepare(value, second))
    local entered = assert(route.enter(value.route, "one", "F_Test"))
    lu.assertNotNil(room.enter(value, entered))
    lu.assertEquals(value.room.current.occurrence, first)
    lu.assertNil(value.room.prepared)
end

function TestRuntimeSession.testEntryProofFiresThePublishedRoomEnteredDeadline()
    local row = occurrence()
    row.timeline.obligations = { { owner = "owner", checkpoint = "roomEntered" } }
    local plan = { occurrences = { row }, occurrencesById = { one = row }, selectedOccurrenceIds = { "one" } }
    local value = { state = "synchronized", route = route.new(plan), room = room.new(plan, nil, {
        timelineIndex = timeline.index,
    }), diagnostics = {} }
    local entered = assert(route.enter(value.route, "one", "F_Test"))
    assert(room.enter(value, entered))
    lu.assertNil(room.proveEntry(value, { Name = "F_Test" }))
    lu.assertEquals(value.room.current.firstMismatch.checkpoint, "obligation:roomEntered")
end

function TestRuntimeSession.testStrictDecodeTransactionOrderDoesNotChangeRuntimeReadiness()
    local file = assert(io.open(fixtures.path("fg-ixion-chaos.execution.json"), "rb"))
    local source = file:read("*a")
    file:close()
    local function reverseTransactions(plan)
        for _, row in ipairs(plan.occurrences) do
            local transactions = row.timeline.transactions
            for left = 1, math.floor(#transactions / 2) do
                local right = #transactions - left + 1
                transactions[left], transactions[right] = transactions[right], transactions[left]
            end
        end
        return plan
    end

    local raw = assert(json.decode(source))
    -- The strict occurrence decoder materializes derived fields while deriving
    -- the canonical wire fingerprint. Use an isolated decoded copy to derive
    -- the changed wire fingerprint, then decode a second untouched wire copy.
    local fingerprintSource = reverseTransactions(assert(json.decode(source)))
    local decodedRows = assert(occurrenceProtocol.decode(
        fingerprintSource.occurrences,
        fingerprintSource.selectedOccurrenceIds,
        "execution plan.occurrences"
    ))
    for _, row in ipairs(decodedRows) do
        row.transactionsByOwner = nil
        row.conformanceExpected = nil
    end
    local reversed = reverseTransactions(assert(json.decode(source)))
    reversed.planFingerprint = protocol.fingerprint(fingerprintBody(fingerprintSource))

    local decoded = assert(protocol.decode(raw))
    local reordered = assert(protocol.decode(reversed))
    for index, occurrenceRow in ipairs(decoded.occurrences) do
        local first = timelineSession.new(occurrenceRow, timeline.index(occurrenceRow))
        local secondRow = reordered.occurrences[index]
        local second = timelineSession.new(secondRow, timeline.index(secondRow))
        lu.assertEquals(first.prerequisites, second.prerequisites)
        lu.assertEquals(first.obligations, second.obligations)
    end
end

function TestRuntimeSession.testAdmissionBindsNativeIdentityBeforeAnyDamage()
    local priorRun = _G.CurrentRun
    local first = { Hero = {} }
    _G.CurrentRun = first
    local row = occurrence()
    local plan = { kind = 'ready', occurrences = { row }, occurrencesById = { [row.id] = row }, selectedOccurrenceIds = { row.id } }
    local inbox = { load = function() return true, plan end }
    local state = runtime.create()
    assert(runtime.start(state, inbox, 'starting', 2))
    lu.assertIs(state.admittedNativeRun, first)
    runtime.beginNewRun(state)
    lu.assertNil(state.admittedNativeRun)
    _G.CurrentRun = priorRun
end
