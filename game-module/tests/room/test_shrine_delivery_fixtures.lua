-- luacheck: globals TestShrineDeliveryFixtures
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local json = require("mods.protocol.json")
local protocol = require("mods.protocol.decoder")
local room = require("mods.room.session")
local bindings = require("mods.room.timeline.bindings")

TestShrineDeliveryFixtures = {}

local function loadPlan(name)
    local file = assert(io.open(fixtures.path(name .. ".execution.json"), "rb"))
    local plan = assert(protocol.decode(assert(json.decode(file:read("*a")))))
    file:close()
    return plan
end

local function occurrence(plan, id)
    return assert(plan.occurrencesById[id], id)
end

local function deliveryContact(sourceKey)
    return { kind = "hermesShrineDelivery", sourceKey = sourceKey }
end

-- The published delivery source key of one Shrine offer, by generation.
local function sourceKeyOf(plan, id, generationKey)
    for _, offer in ipairs(occurrence(plan, id).overview.hermesShrine.offers) do
        if offer.generationKey == generationKey then return assert(offer.deliverySourceKey) end
    end
    error(id .. " publishes no " .. generationKey .. " offer")
end

local function deliveryRows(plan)
    local rows = {}
    for _, id in ipairs(plan.selectedOccurrenceIds) do
        for _, transaction in ipairs(occurrence(plan, id).timeline.transactions) do
            if transaction.hermesShrineSourceKey ~= nil then
                rows[#rows + 1] = { host = id, sourceKey = transaction.hermesShrineSourceKey }
            end
        end
    end
    return rows
end

local function newSession(plan, id)
    local entry = occurrence(plan, id)
    return room.new(entry, assert(bindings.index(entry)))
end

local function completeWheel(session)
    local wheel = room.resolve(session, bindings.resolve, { kind = "rewardWheel", wheelKey = "wheel1" })
    if wheel ~= nil then lu.assertTrue(room.complete(session, wheel)) end
end

local function collectDelivery(session, sourceKey, native)
    local handle = assert(room.resolve(session, bindings.resolve, deliveryContact(sourceKey)))
    lu.assertNotNil(room.bind(session, handle, native))
    lu.assertTrue(rawequal(room.bound(session, native), handle))
    lu.assertTrue(room.complete(session, handle))
    return handle
end

function TestShrineDeliveryFixtures.testCrossBiomeCountdownBindsOnlyAtItsOShipHostPhase()
    local plan = loadPlan("surface-shrine-deliveries")
    local sourceKey = sourceKeyOf(plan, "surface-n-combat11-sideDoor1", "initial:secondLeft")
    local host = "surface-o-combat04"
    local passed = {}
    for _, id in ipairs(plan.selectedOccurrenceIds) do
        if id == host then break end
        passed[#passed + 1] = id
        lu.assertNil(bindings.resolve(assert(bindings.index(occurrence(plan, id))), deliveryContact(sourceKey)), id)
    end
    -- The source room and the non-ticking Postboss and O Intro rooms are all passed without a row.
    for _, id in ipairs({ "surface-n-combat11-sideDoor1", "surface-n-preboss:postboss", "surface-o-intro" }) do
        lu.assertTrue(#passed > 0 and (function()
            for _, passedId in ipairs(passed) do if passedId == id then return true end end
            return false
        end)(), id)
    end

    local session = newSession(plan, host)
    local payload = assert(room.peek(session, assert(room.resolve(session, bindings.resolve, deliveryContact(sourceKey)))))
    lu.assertEquals(payload.transaction.window, { kind = "encounterEnd", phaseKey = "Combat1" })
    lu.assertEquals(payload.transaction.reward.rewardType, "MaxHealthDrop")
    lu.assertTrue(room.openWindow(session, "roomEntered"))
    lu.assertTrue(room.startEncounter(session))
    lu.assertTrue(room.openWindow(session, "encounterEnd:Combat1"))
    lu.assertEquals(room.activePhase(session, "encounterEnd"), "Combat1")
    collectDelivery(session, sourceKey, { Name = "MaxHealthDrop" })
    completeWheel(session)
    lu.assertTrue(room.close(session, function() return true end))
    lu.assertNil(session.firstMismatch)

    -- Later rooms never publish the collected delivery again.
    local after = false
    for _, id in ipairs(plan.selectedOccurrenceIds) do
        if after then
            lu.assertNil(bindings.resolve(assert(bindings.index(occurrence(plan, id))), deliveryContact(sourceKey)), id)
        end
        if id == host then after = true end
    end
end

function TestShrineDeliveryFixtures.testFourthBiomeFlushBindsAtPrebossEntryAndNotAtTheBoss()
    local plan = loadPlan("surface-shrine-deliveries")
    local sourceKey = sourceKeyOf(plan, "surface-p-preboss-shop:postboss", "initial:secondRight")
    for _, id in ipairs(plan.selectedOccurrenceIds) do
        local resolved = bindings.resolve(assert(bindings.index(occurrence(plan, id))), deliveryContact(sourceKey))
        if id == "surface-q-preboss" then
            lu.assertEquals(resolved.transaction.window, { kind = "postOutgoing" })
            lu.assertEquals(resolved.transaction.reward.rewardType, "MaxManaDrop")
        else
            lu.assertNil(resolved, id)
        end
    end
    lu.assertEquals(occurrence(plan, "surface-q-preboss:boss").timeline.transactions, {})

    local session = newSession(plan, "surface-q-preboss")
    lu.assertTrue(room.openWindow(session, "roomEntered"))
    lu.assertTrue(room.openWindow(session, "postOutgoing"))
    collectDelivery(session, sourceKey, { Name = "MaxManaDrop" })
    lu.assertTrue(room.close(session, function() return true end))
    lu.assertNil(session.firstMismatch)
end

function TestShrineDeliveryFixtures.testRushedRankedPickupIsCollectedInThePurchaseRoomAfterItsRefill()
    local plan = loadPlan("surface-shrine-deliveries")
    local id = "surface-o-combat07"
    local sourceKey = sourceKeyOf(plan, id, "initial:first")
    local session = newSession(plan, id)
    local pickup = assert(room.resolve(session, bindings.resolve, deliveryContact(sourceKey)))
    lu.assertEquals(room.peek(session, pickup).transaction.window, { kind = "postOutgoing" })
    lu.assertTrue(room.openWindow(session, "roomEntered"))
    completeWheel(session)
    lu.assertTrue(room.openWindow(session, "postOutgoing"))
    -- The published order realizes the Travel Deal refill before the rushed item is taken.
    local refill = assert(room.resolve(session, bindings.resolve, { kind = "travelDealRefill", carrier = "hermesShrine" }))
    lu.assertTrue(room.complete(session, refill))
    collectDelivery(session, sourceKey, { Name = "HealBigDrop", __runPlannerShrine = true,
        __runPlannerShrineSourceKey = sourceKey })
    lu.assertTrue(room.close(session, function() return true end))
    lu.assertNil(session.firstMismatch)
    for _, laterId in ipairs({ "surface-o-combat01", "surface-o-devotion", "surface-o-preboss" }) do
        lu.assertNil(bindings.resolve(assert(bindings.index(occurrence(plan, laterId))), deliveryContact(sourceKey)))
    end
end

function TestShrineDeliveryFixtures.testRushedUnrankedPickupCanBeLeftBehindWithoutMismatch()
    local plan = loadPlan("surface-shrine-rushed-unranked")
    local id = "surface-o-combat07"
    local sourceKey = sourceKeyOf(plan, id, "initial:first")
    local offers = occurrence(plan, id).overview.hermesShrine.offers
    lu.assertEquals(offers[1].purchase, { roomDelay = 2, rushed = true })
    for _, row in ipairs(deliveryRows(plan)) do lu.assertNotEquals(row.sourceKey, sourceKey) end

    local session = newSession(plan, id)
    lu.assertTrue(room.openWindow(session, "roomEntered"))
    completeWheel(session)
    lu.assertTrue(room.openWindow(session, "postOutgoing"))
    local handle, errorValue = room.resolve(session, bindings.resolve, deliveryContact(sourceKey))
    lu.assertNil(handle)
    lu.assertNil(errorValue)
    lu.assertTrue(room.close(session, function() return true end))
    lu.assertNil(session.firstMismatch)
    lu.assertNil(session.firstFault)
end

function TestShrineDeliveryFixtures.testTravelDealRefillDecodesOnTheShrineCarrierAndBindsItsLaterDelivery()
    local plan = loadPlan("surface-shrine-deliveries")
    local session = newSession(plan, "surface-o-combat07")
    local refill = assert(room.resolve(session, bindings.resolve, { kind = "travelDealRefill", carrier = "hermesShrine" }))
    local payload = assert(room.peek(session, refill))
    lu.assertEquals(payload.transaction.kind, "travelDealRefill")
    lu.assertEquals(payload.transaction.refill.carrier, "hermesShrine")
    lu.assertEquals(payload.transaction.refill.source, { generationKey = "initial:first", slotIndex = 1 })
    local replacement = payload.transaction.refill.replacement
    lu.assertEquals(replacement.generationKey, "travelDealRefill")
    lu.assertEquals(replacement.optionKey, "ArmorBoost")
    lu.assertEquals(replacement.purchase, { roomDelay = 2, rushed = false })
    lu.assertNil(bindings.resolve(assert(bindings.index(occurrence(plan, "surface-o-combat07"))),
        deliveryContact(replacement.deliverySourceKey)))

    local host = newSession(plan, "surface-o-combat01")
    local delivery = assert(room.resolve(host, bindings.resolve, deliveryContact(replacement.deliverySourceKey)))
    local deliveryPayload = assert(room.peek(host, delivery))
    lu.assertEquals(deliveryPayload.transaction.window, { kind = "encounterEnd", phaseKey = "Combat1" })
    lu.assertEquals(deliveryPayload.transaction.reward.rewardType, "ArmorBoost")
end

function TestShrineDeliveryFixtures.testTwoDeliveriesIntoOneHostBindIndependentlyBySourceKey()
    local plan = loadPlan("surface-shrine-deliveries")
    local introKey = sourceKeyOf(plan, "surface-n-combat11-sideDoor1", "initial:secondRight")
    local combatKey = occurrence(plan, "surface-o-combat07").transactionsByOwner
    local refillKey
    for _, transaction in pairs(combatKey) do
        if transaction.kind == "travelDealRefill" then refillKey = transaction.refill.replacement.deliverySourceKey end
    end
    lu.assertNotNil(refillKey)
    lu.assertNotEquals(introKey, refillKey)

    local session = newSession(plan, "surface-o-combat01")
    local intro = assert(room.resolve(session, bindings.resolve, deliveryContact(introKey)))
    local combat = assert(room.resolve(session, bindings.resolve, deliveryContact(refillKey)))
    lu.assertFalse(rawequal(intro, combat))
    lu.assertEquals(room.peek(session, intro).transaction.window, { kind = "encounterEnd", phaseKey = "Intro" })
    lu.assertEquals(room.peek(session, combat).transaction.window, { kind = "encounterEnd", phaseKey = "Combat1" })

    lu.assertTrue(room.openWindow(session, "roomEntered"))
    lu.assertTrue(room.startEncounter(session))
    lu.assertTrue(room.openWindow(session, "encounterEnd:Intro"))
    local introItem = { Name = "MaxManaDrop" }
    collectDelivery(session, introKey, introItem)
    completeWheel(session)
    lu.assertTrue(room.startEncounter(session))
    lu.assertTrue(room.openWindow(session, "encounterEnd:Combat1"))
    local combatItem = { Name = "ArmorBoost" }
    collectDelivery(session, refillKey, combatItem)
    lu.assertTrue(rawequal(room.bound(session, introItem), intro))
    lu.assertTrue(rawequal(room.bound(session, combatItem), combat))
    lu.assertTrue(room.close(session, function() return true end))
    lu.assertNil(session.firstMismatch)
end

function TestShrineDeliveryFixtures.testDreamPendingDeliveryPublishesNoRowAndStaysSynchronizedThroughTheBoss()
    local plan = loadPlan("dream-shrine-pending")
    local sourceKey = sourceKeyOf(plan, "dream-q-ordinary", "initial:first")
    lu.assertEquals(occurrence(plan, "dream-q-ordinary").overview.hermesShrine.offers[1].purchase,
        { roomDelay = 8, rushed = false })
    lu.assertEquals(deliveryRows(plan), {})
    lu.assertEquals(plan.selectedOccurrenceIds[#plan.selectedOccurrenceIds], "dream-q-preboss:boss")
    for _, id in ipairs(plan.selectedOccurrenceIds) do
        local session = newSession(plan, id)
        lu.assertTrue(room.openWindow(session, "roomEntered"))
        local handle, errorValue = room.resolve(session, bindings.resolve, deliveryContact(sourceKey))
        lu.assertNil(handle, id)
        lu.assertNil(errorValue, id)
        lu.assertTrue(room.openWindow(session, "postOutgoing"))
        lu.assertTrue(room.close(session, function() return true end), id)
        lu.assertNil(session.firstMismatch, id)
        lu.assertNil(session.firstFault, id)
    end
end
