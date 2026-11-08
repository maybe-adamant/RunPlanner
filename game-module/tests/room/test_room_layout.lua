-- Room layout steering: the published flip and entry are preset on the created
-- room, a published entry wins over an arrival door's forced entry once per
-- entered occurrence, and the observed layout is checked as a diagnostic.
-- luacheck: globals TestRoomLayout
local lu = require("luaunit")
local layout = require("mods.room.features.layout")
local coordinator = require("mods.room.coordinator")
local support = require("tests.harness.hook_composition")
local fixtures = require("tests.harness.fixture_loader")
local protocol = require("mods.protocol.decoder")

TestRoomLayout = {}

local function occurrenceOf(fixture, id)
    local plan = assert(protocol.decode(fixtures.decode(fixture)))
    return assert(plan.occurrencesById[id])
end

local function harness(occurrence)
    local module, _, callbacks = support.capture()
    local state = { state = "synchronized", room = { current = { occurrence = occurrence } } }
    local diagnostics, reports = {}, 0
    local session = {
        diagnostic = function(_, kind, observed)
            diagnostics[#diagnostics + 1] = { kind = kind, observed = observed }
        end,
    }
    layout.attach(module, session, function() return state end, function() reports = reports + 1 end, coordinator)
    return callbacks, state, diagnostics, function() return reports end
end

local function gather(callbacks, currentRun, nativeRoom)
    local seen
    callbacks.GatherRoomPresentationObjects(nil, {}, function(run, room)
        -- Native prefers a forced arrival entry to the room's own points.
        if run.NextHeroStartPoint ~= nil and run.NextHeroEndPoint ~= nil then
            room.HeroStartPoint, room.HeroEndPoint = run.NextHeroStartPoint, run.NextHeroEndPoint
            run.NextHeroStartPoint, run.NextHeroEndPoint = nil, nil
        end
        seen = { room.HeroStartPoint, room.HeroEndPoint }
    end, currentRun, nativeRoom)
    return seen
end

function TestRoomLayout.testCreatedRoomTakesThePublishedFlipAndEntry()
    local occurrence = occurrenceOf("underworld-fgh.execution.json", "golden-h-combat02")
    lu.assertEquals(occurrence.overview.layout, { flipped = true, entry = { startPointId = 565481, endPointId = 565479 } })
    local nativeRoom = coordinator.realizeFeatures(nil, occurrence, { Name = "H_Combat02" })
    lu.assertEquals({ nativeRoom.Flipped, nativeRoom.HeroStartPoint, nativeRoom.HeroEndPoint }, { true, 565481, 565479 })

    -- A run start publishes its fixed unflipped layout; native's own flip computation never sees it unset.
    local opening = occurrenceOf("underworld-fgh.execution.json", "golden-f-start")
    lu.assertEquals(opening.overview.layout, { flipped = false })
    local openingRoom = coordinator.realizeFeatures(nil, opening, { Name = "F_Opening01" })
    lu.assertEquals(openingRoom.Flipped, false)
    lu.assertNil(openingRoom.HeroStartPoint)
end

function TestRoomLayout.testUnpublishedLayoutStaysNative()
    local nativeRoom = coordinator.realizeFeatures(nil, { overview = {} }, { Name = "F_Combat01" })
    lu.assertNil(nativeRoom.Flipped)
    lu.assertNil(nativeRoom.HeroStartPoint)
    local entryOnly = coordinator.realizeFeatures(nil, {
        overview = { layout = { entry = { startPointId = 7, endPointId = 8 } } },
    }, { Name = "F_Combat02" })
    lu.assertNil(entryOnly.Flipped)
    lu.assertEquals({ entryOnly.HeroStartPoint, entryOnly.HeroEndPoint }, { 7, 8 })
end

function TestRoomLayout.testPublishedEntryWinsOverAForcedArrivalOnceThenStaysNative()
    local occurrence = { id = "room", overview = { layout = { entry = { startPointId = 7, endPointId = 8 } } } }
    local callbacks, _, diagnostics, reports = harness(occurrence)
    local nativeRoom = { __runPlannerExecutionRoomId = "room", HeroStartPoint = 7, HeroEndPoint = 8 }
    local currentRun = { NextHeroStartPoint = 5, NextHeroEndPoint = 6 }
    lu.assertEquals(gather(callbacks, currentRun, nativeRoom), { 7, 8 })
    lu.assertEquals(diagnostics, { { kind = "room-entry-forced", observed = { expected = 7, observed = 5 } } })
    lu.assertEquals(reports(), 1)
    -- A revisit through a return door keeps native's forced entry.
    currentRun.NextHeroStartPoint, currentRun.NextHeroEndPoint = 5, 6
    lu.assertEquals(gather(callbacks, currentRun, nativeRoom), { 5, 6 })
    lu.assertEquals(#diagnostics, 1)
end

function TestRoomLayout.testUnpublishedEntryKeepsTheForcedArrival()
    local callbacks, _, diagnostics = harness({ id = "room", overview = { layout = { flipped = true } } })
    local currentRun = { NextHeroStartPoint = 5, NextHeroEndPoint = 6 }
    lu.assertEquals(gather(callbacks, currentRun, { __runPlannerExecutionRoomId = "room" }), { 5, 6 })
    -- Another occurrence's room is never steered.
    local other = harness({ id = "other", overview = { layout = { entry = { startPointId = 7, endPointId = 8 } } } })
    currentRun.NextHeroStartPoint, currentRun.NextHeroEndPoint = 5, 6
    lu.assertEquals(gather(other, currentRun, { __runPlannerExecutionRoomId = "room" }), { 5, 6 })
    lu.assertEquals(diagnostics, {})
end

function TestRoomLayout.testObservedEntryAndFlipAreDiagnosedOnceWithoutMismatch()
    local occurrence = { id = "room", overview = { layout = { flipped = true, entry = { startPointId = 7, endPointId = 8 } } } }
    local callbacks, state, diagnostics, reports = harness(occurrence)
    local function present(nativeRoom)
        lu.assertEquals(callbacks.StartRoomPresentation(nil, {}, function() return "native" end, {}, nativeRoom), "native")
    end
    present({ __runPlannerExecutionRoomId = "room", HeroStartPoint = 7, Flipped = true })
    lu.assertEquals(diagnostics, {})

    callbacks, state, diagnostics, reports = harness(occurrence)
    local displaced = { __runPlannerExecutionRoomId = "room", HeroStartPoint = 9, Flipped = false }
    present(displaced)
    present(displaced)
    lu.assertEquals(diagnostics, {
        { kind = "room-entry", observed = { expected = 7, observed = 9 } },
        { kind = "room-flip", observed = { expected = true, observed = false } },
    })
    lu.assertEquals(reports(), 1)
    lu.assertEquals(state.state, "synchronized")
end
