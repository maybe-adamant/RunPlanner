-- luacheck: globals TestStartState
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local json = require("mods/protocol/json")
local protocol = require("mods.protocol.decoder")

TestStartState = {}

local function wire(name)
    local file = assert(io.open(fixtures.path(name .. ".execution.json"), "rb"))
    local value = assert(json.decode(file:read("*a")))
    file:close()
    return value
end

local function rejected(name, mutate, expected)
    local value = wire(name)
    mutate(value.startState, value)
    local plan, reason = protocol.decode(value)
    lu.assertNil(plan)
    lu.assertStrContains(reason, expected)
end

function TestStartState.testStartFixturesDecodeWithTheirStartPoint()
    local opening = assert(protocol.decode(wire("surface-start-q-opening")))
    lu.assertEquals({ opening.startState.point, opening.startState.biomeKey, opening.startState.gold },
        { "opening", "Q", 120 })
    lu.assertEquals(opening.startState.biomeVisitOrder, { "N", "O", "P" })
    lu.assertEquals(opening.startState.elementEssences, { Fire = 0, Air = 0, Earth = 1, Water = 0 })
    lu.assertNil(opening.startState.biome)
    local preboss = assert(protocol.decode(wire("underworld-start-i-preboss")))
    lu.assertEquals(preboss.startState.roomName, "I_PreBoss02")
    lu.assertEquals(preboss.startState.biome.clockwork.remainingClockworkGoals, 0)
    lu.assertEquals(opening.startState.keepsake.traits,
        { { name = "ManaOverTimeRefundKeepsake", rarity = "Epic", slotted = true } })
    local dream = assert(protocol.decode(wire("dream-start-n-opening")))
    lu.assertEquals(dream.routeKey, "Dream")
    lu.assertEquals(dream.startState.biomeKey, "N")
    lu.assertNil(assert(protocol.decode(wire("underworld-fghi"))).startState)
end

function TestStartState.testStartStateIsFingerprinted()
    rejected("underworld-start-i-preboss", function(start) start.gold = 1 end, "fingerprint")
    rejected("underworld-start-i-preboss", function(_, value) value.startState = nil end, "fingerprint")
end

function TestStartState.testStartStateShapeIsStrict()
    for _, case in ipairs({
        { function(start) start.unknown = true end, "unknown field" },
        { function(start) start.traits = nil end, "missing traits" },
        { function(start) start.point = "hub" end, "point" },
        { function(start) start.gold = 1.5 end, "gold" },
        { function(start) start.roomHistory[1].nextRoomSet = false end, "nextRoomSet" },
        { function(start) start.traits[1].storedGold = 1 end, "unknown field" },
        { function(start) start.traits[2] = start.traits[1] end, "duplicate" },
        { function(start) start.traits[1].rarity = "Mythic" end, "rarity" },
        { function(start) start.maxStats.hiddenGrants[1].source = assert(json.decode('{"kind":"base"}')) end,
            "source is missing key" },
        { function(start) start.maxStats.hiddenGrants[1].source = assert(json.decode('{"kind":"aspect","key":"X"}')) end,
            "kind is unsupported" },
        { function(start) start.keepsake.traits = assert(json.decode('[{"name":"RarifyKeepsake"}]')) end,
            "missing rarity" },
        { function(start)
            start.keepsake.traits = assert(json.decode(
                '[{"name":"A","rarity":"Epic","slotted":true},{"name":"B","rarity":"Epic","slotted":true}]'))
        end, "more than one slotted" },
        { function(start) start.biome.clockwork.extra = 1 end, "unknown field" },
        { function(start) start.elementEssences = nil end, "missing elementEssences" },
        { function(start) start.elementEssences.Aether = 1 end, "unknown field" },
        { function(start) start.elementEssences.Fire = -1 end, "elementEssences.Fire" },
        { function(start) start.elementEssences.Water = 0.5 end, "elementEssences.Water" },
    }) do
        rejected("underworld-start-i-preboss", case[1], case[2])
    end
end

function TestStartState.testStartOccurrenceIsTheStartPointRoom()
    rejected("underworld-start-i-preboss", function(start) start.occurrenceId = "missing" end, "must be selected")
    rejected("underworld-start-i-preboss", function(start) start.roomName = "I_PreBoss01" end,
        "occurrence identity")
    rejected("underworld-start-i-preboss", function(start) start.biome = nil end, "exactly for a Preboss")
    rejected("surface-start-q-opening", function(start) start.biomeVisitOrder = { "N", "O", "P", "Q" } end,
        "biomeVisitOrder")
    rejected("surface-start-q-opening", function(start, value)
        local ids = value.selectedOccurrenceIds
        for index, id in ipairs(ids) do
            if id == start.occurrenceId then start.occurrenceId = ids[index + 1] break end
        end
        for _, occurrence in ipairs(value.occurrences) do
            if occurrence.id == start.occurrenceId then start.roomName = occurrence.gameName end
        end
    end, "start point's room")
end

function TestStartState.testVisitOrderIsTheBiomesEnteredBeforeTheStart()
    rejected("underworld-start-i-preboss", function(start) start.biomeVisitOrder = { "F", "G", "H" } end,
        "biomeVisitOrder")
    rejected("underworld-start-i-preboss", function(start) start.biomeVisitOrder = { "F", "H", "G", "I" } end,
        "biomeVisitOrder")
end

function TestStartState.testOpeningIsAfterTheRouteStart()
    rejected("surface-start-q-opening", function(start, value)
        local first = value.selectedOccurrenceIds[1]
        for _, occurrence in ipairs(value.occurrences) do
            if occurrence.id == first then
                start.biomeKey, start.occurrenceId, start.roomName = occurrence.biomeKey, first, occurrence.gameName
            end
        end
        start.biomeVisitOrder = assert(json.decode('[]'))
    end, "after the route start")
end

function TestStartState.testClockworkIsPresentExactlyForAnIPreboss()
    rejected("underworld-start-i-preboss", function(start) start.biome.clockwork = nil end,
        "clockwork is present exactly for an I Preboss")
end
