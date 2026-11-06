-- luacheck: globals TestHeraclesBounty
-- Heracles's bounty binds the RoomMoneyDrop his post-combat AI spawns to the
-- phase's published bounty pickup, never a same-named duplicate or another
-- thread's spawn. Owners are the planner's wire for a Sea Star proc plan.
local lu = require("luaunit")
local heracles = require("mods.room.timeline.encounters.heracles")
local bindings = require("mods.room.timeline.bindings")
local guide = require("mods.presentation.room_guide")

TestHeraclesBounty = {}

local BOUNTY = [=[["acquisitionEntry","Surface","N","[\"acquisitionSite\",\"Surface\",\"N\",\"[\\\"occurrence\\\",\\\"Surface\\\",\\\"N\\\",\\\"surface-n-combat05\\\"]\",\"heraclesBounty:Encounter\"]","bounty"]]=]
local DUPLICATE = [=[["acquisitionEntry","Surface","N","[\"acquisitionSite\",\"Surface\",\"N\",\"[\\\"occurrence\\\",\\\"Surface\\\",\\\"N\\\",\\\"surface-n-combat05\\\"]\",\"seaStarDuplicate:%5B%22acquisitionEntry%22%2C%22Surface%22%2C%22N%22%2C%22%5B%5C%22acquisitionSite%5C%22%2C%5C%22Surface%5C%22%2C%5C%22N%5C%22%2C%5C%22%5B%5C%5C%5C%22occurrence%5C%5C%5C%22%2C%5C%5C%5C%22Surface%5C%5C%5C%22%2C%5C%5C%5C%22N%5C%5C%5C%22%2C%5C%5C%5C%22surface-n-combat05%5C%5C%5C%22%5D%5C%22%2C%5C%22heraclesBounty%3AEncounter%5C%22%5D%22%2C%22bounty%22%5D:self\"]","seaStarDuplicate"]]=]
local REWARD = { rewardType = "RoomMoneyDrop", producerLifecycleKey = "HeraclesBountyPickup" }

local function acquisition(owner, role)
    return {
        kind = "acquisition", owner = owner, sourceOwner = owner, reward = REWARD,
        producerLifecycleKey = "HeraclesBountyPickup", window = { kind = "standard", phase = "afterCombat" },
        roles = { role },
    }
end

local function occurrence()
    local bounty = acquisition(BOUNTY, { role = "self", disposition = "normal", kind = "consumable",
        gameName = "RoomMoneyDrop", lifecyclePoint = "roomRewardPickup", seaStarResult = { kind = "proc" } })
    local duplicate = acquisition(DUPLICATE, { role = "self", disposition = "normal", kind = "consumable",
        gameName = "RoomMoneyDrop", lifecyclePoint = "roomRewardPickup",
        producer = { kind = "seaStarDuplicate", sourceOwner = BOUNTY, sourceRole = "self" } })
    -- The duplicate precedes its source here so a first-match lookup would pick it.
    return {
        id = "surface-n-combat05", gameName = "N_Combat05",
        timeline = { transactions = { duplicate, bounty } },
        transactionsByOwner = { [BOUNTY] = bounty, [DUPLICATE] = duplicate },
    }
end

local function harness()
    local callbacks = {}
    local module = { hooks = { wrap = function(name, _, callback) callbacks[name] = callback end } }
    local current = { occurrence = occurrence() }
    local index = assert(bindings.index(current.occurrence))
    local bound, reports = {}, 0
    local encounter = { Name = "HeraclesCombatN", PlayerMoneyObjective = 100 }
    local room = {
        current = function() return current end,
        encounterPhase = function(_, native)
            return native == encounter and { slotKey = "Encounter", encounterKey = "HeraclesCombatN" } or nil
        end,
        resolve = function(_, _, contact) return bindings.resolve(index, contact) end,
        bind = function(_, _, handle, native) bound[#bound + 1] = { owner = handle.transaction.owner, native = native } end,
    }
    heracles.attach(module, {}, function() return { state = "synchronized" } end,
        function() reports = reports + 1 end, room)
    _G.CurrentRun = { CurrentRoom = { Encounter = encounter } }
    local function create(name)
        return callbacks.CreateConsumableItem(nil, {}, function(id, consumable)
            return { ObjectId = id, Name = consumable }
        end, 7, name, 0)
    end
    local function postCombat(body)
        return callbacks.HeraclesPostCombat(nil, {}, function() return body() end, { Name = "NPC_Heracles_01" })
    end
    return { create = create, postCombat = postCombat, bound = bound, reports = function() return reports end }
end

function TestHeraclesBounty.tearDown()
    _G.CurrentRun = nil
end

function TestHeraclesBounty.testFindsThePhaseBountyNotItsSeaStarDuplicate()
    lu.assertEquals(heracles.bountyOwner(occurrence(), "Encounter"), BOUNTY)
    lu.assertNil(heracles.bountyOwner(occurrence(), "Encounter2"))
    lu.assertNil(heracles.bountyOwner({ timeline = { transactions = {} } }, "Encounter"))
end

function TestHeraclesBounty.testBindsTheSpawnedBountyToItsPlannedPickup()
    local h = harness()
    local item
    h.postCombat(function() item = h.create("RoomMoneyDrop") end)
    lu.assertEquals(h.bound, { { owner = BOUNTY, native = item } })
    lu.assertEquals(h.reports(), 1)
end

function TestHeraclesBounty.testOnlyTheFirstMoneyDropInsideHisPostCombatBinds()
    local h = harness()
    h.create("RoomMoneyDrop")
    h.postCombat(function()
        h.create("HealDrop")
        h.create("RoomMoneyDrop")
        h.create("RoomMoneyDrop")
    end)
    h.create("RoomMoneyDrop")
    lu.assertEquals(#h.bound, 1)
end

function TestHeraclesBounty.testAnotherThreadSpawningDuringHisWaitDoesNotBind()
    local h = harness()
    local waiting = coroutine.create(function()
        h.postCombat(function()
            coroutine.yield()
            h.create("RoomMoneyDrop")
        end)
    end)
    assert(coroutine.resume(waiting))
    -- A room reward on another thread while his AI waits stays unbound here.
    h.create("RoomMoneyDrop")
    lu.assertEquals(#h.bound, 0)
    assert(coroutine.resume(waiting))
    lu.assertEquals(#h.bound, 1)
    lu.assertEquals(h.bound[1].owner, BOUNTY)
end

function TestHeraclesBounty.testAPlanWithoutABountyLeavesTheSpawnNative()
    local h = harness()
    _G.CurrentRun.CurrentRoom.Encounter = { Name = "OtherEncounter" }
    h.postCombat(function() h.create("RoomMoneyDrop") end)
    lu.assertEquals(h.bound, {})
end

function TestHeraclesBounty.testGuideRowCollectsGold()
    local snapshot = {
        kind = "room",
        occurrence = { gameName = "N_Combat05", transactionsByOwner = occurrence().transactionsByOwner,
            roomGuide = { { key = "bounty", transactionOwner = BOUNTY,
                description = { kind = "interactAcquisitionEntry", reward = REWARD } } } },
        isCompleted = function() return false end,
    }
    lu.assertEquals(guide.project(snapshot).rows, { { instruction = "Collect Gold" } })
end
