-- luacheck: globals TestAnvilFixtures
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local json = require("mods.protocol.json")
local protocol = require("mods.protocol.decoder")
local roomSession = require("mods.room.session")
local bindings = require("mods.room.timeline.bindings")
local transformations = require("mods.room.timeline.transformations.hooks")

TestAnvilFixtures = {}

local function loadOccurrence(name, id)
    local file = assert(io.open(fixtures.path(name .. ".execution.json"), "rb"))
    local plan = assert(protocol.decode(assert(json.decode(file:read("*a")))))
    file:close()
    return assert(plan.occurrencesById[id], id)
end

local function anvilResults(occurrence)
    local results = {}
    for _, transaction in ipairs(occurrence.timeline.transactions) do
        if transaction.kind == "transformation" and transaction.transformation.kind == "anvilOfFates" then
            results[#results + 1] = transaction
        end
        for _, role in ipairs(transaction.roles or {}) do
            lu.assertNotEquals(role.gameName, "ChaosWeaponUpgrade", transaction.owner)
        end
    end
    return results
end

-- Real room session behind the coordinator-shaped capability the hooks consume.
local function harness(occurrence)
    local session = roomSession.new(occurrence, assert(bindings.index(occurrence)))
    local callbacks, diagnostics = {}, {}
    local module = { hooks = { wrap = function(name, _, callback) callbacks[name] = callback end } }
    local room = {
        current = function() return session end,
        bound = function(_, active, native) return roomSession.bound(active, native) end,
        claimReady = function(_, active, contact, native, compatible)
            return roomSession.claimReady(active, contact, native, compatible)
        end,
        begin = function(_, handle) return roomSession.begin(session, handle) end,
        peek = function(_, handle) return roomSession.peek(session, handle) end,
    }
    local executor = {
        complete = function(_, handle) return roomSession.complete(session, handle) end,
        diagnostic = function(_, checkpoint, observed)
            diagnostics[#diagnostics + 1] = { checkpoint = checkpoint, observed = observed }
        end,
    }
    transformations.attach(module, executor, function() return {} end, function() end, room)
    return session, callbacks, diagnostics
end

-- One accepted native Anvil use; each RemoveRandomValue offers the whole pool.
local function useAnvil(callbacks, item, pool)
    local selected = {}
    callbacks.UseConsumableItem(nil, {}, function(native)
        callbacks.ConsumableUsedPresentation(nil, {}, function() return true end, {}, native, {})
        callbacks.ChaosHammerUpgrade(nil, {}, function()
            for index = 1, 3 do
                selected[index] = callbacks.RemoveRandomValue(nil, {}, function(values) return values[1] end,
                    pool, {})
            end
            return true
        end, {})
        return true
    end, item, {}, {})
    return selected
end

local function expected(transaction)
    local result = transaction.transformation
    return { result.removedTraitKey, result.addedTraitKeys[1], result.addedTraitKeys[2] }
end

local function shopOwner(occurrence, offerKey)
    for _, offer in ipairs(occurrence.overview.shop.offers) do
        if offer.offerKey == offerKey then return assert(offer.transactionOwner) end
    end
    error("no " .. offerKey .. " offer")
end

function TestAnvilFixtures.testGoldDuplicateOfAnAnvilPurchaseSteersItsOwnSecondResult()
    local occurrence = loadOccurrence("underworld-echo-gold-anvil-duplicate", "golden-i-preboss")
    local anvils = anvilResults(occurrence)
    lu.assertEquals(#anvils, 2)
    local purchaseOwner = shopOwner(occurrence, "PremiumProgress")
    lu.assertEquals(anvils[1].owner, purchaseOwner)
    lu.assertStrContains(anvils[2].owner, "echoDoubleShopReward")

    local session, callbacks, diagnostics = harness(occurrence)
    local pool = { "Other", "StaffDoubleAttackTrait", "StaffDashAttackTrait", "StaffTripleShotTrait",
        "StaffJumpSpecialTrait", "StaffExAoETrait" }
    -- The World Shop row binds its published owner when it is spawned.
    local purchased = { Name = "ChaosWeaponUpgrade", __runPlannerWorldShop = true }
    lu.assertNotNil(roomSession.bind(session,
        assert(roomSession.resolve(session, bindings.resolve, { kind = "owner", owner = purchaseOwner })),
        purchased))
    lu.assertEquals(useAnvil(callbacks, purchased, pool), expected(anvils[1]))
    lu.assertTrue(roomSession.isCompleted(session, anvils[1].owner))
    lu.assertFalse(roomSession.isCompleted(session, anvils[2].owner))

    -- Gold Gold Gold spawns an unbound copy; its use claims the duplicate's own result.
    local duplicate = { Name = "ChaosWeaponUpgrade" }
    lu.assertEquals(useAnvil(callbacks, duplicate, pool), expected(anvils[2]))
    lu.assertTrue(roomSession.isCompleted(session, anvils[2].owner))
    lu.assertTrue(roomSession.checkpoint(session, "roomExit"))
    lu.assertNil(session.firstMismatch)
    lu.assertNil(session.firstFault)
    lu.assertEquals(diagnostics, {})
end

function TestAnvilFixtures.testTravelDealRefillAnvilSteersAfterItsRealization()
    local occurrence = loadOccurrence("surface-travel-deal-refill-anvil", "surface-q-preboss")
    local anvils = anvilResults(occurrence)
    lu.assertEquals(#anvils, 1)
    lu.assertStrContains(anvils[1].owner, "travelDealRefill")

    local session, callbacks, diagnostics = harness(occurrence)
    local pool = { "Other", "StaffDoubleAttackTrait", "StaffLongAttackTrait", "StaffJumpSpecialTrait" }
    lu.assertTrue(roomSession.complete(session,
        assert(roomSession.resolve(session, bindings.resolve,
            { kind = "owner", owner = shopOwner(occurrence, "PremiumProgress") }))))
    -- The refill row is spawned by generation key, which publishes no owner, so it stays unbound.
    lu.assertNil(roomSession.resolve(session, bindings.resolve,
        { kind = "generation", generationKey = "travelDealRefill" }))
    local refillItem = { Name = "ChaosWeaponUpgrade" }
    lu.assertNil(roomSession.claimReady(session, { kind = "transformation", gameName = refillItem.Name },
        refillItem, function(transaction) return transaction.kind == "transformation" or nil end))
    lu.assertTrue(roomSession.complete(session,
        assert(roomSession.resolve(session, bindings.resolve, { kind = "travelDealRefill", carrier = "worldShop" }))))

    lu.assertEquals(useAnvil(callbacks, refillItem, pool), expected(anvils[1]))
    lu.assertTrue(roomSession.isCompleted(session, anvils[1].owner))
    lu.assertTrue(roomSession.checkpoint(session, "roomExit"))
    lu.assertNil(session.firstMismatch)
    lu.assertNil(session.firstFault)
    lu.assertEquals(diagnostics, {})
end
