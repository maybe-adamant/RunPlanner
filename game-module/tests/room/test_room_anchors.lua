-- Room object anchors through the composed room feature hooks: each object's
-- ChallengeSwitchBase draw takes its published anchor, unplanned draws never
-- take a planned anchor, and the Fields point scope never captures them.
-- luacheck: globals TestRoomAnchors
local lu = require("luaunit")
local featureHooks = require("mods.room.features.hooks")
local support = require("tests.harness.hook_composition")

TestRoomAnchors = {}

local ANCHORS = { 1, 2, 3, 4, 5 }

function TestRoomAnchors:setUp()
    self.saved = { _G.GetIdsByType, _G.GetIds, _G.RoomData, _G.IsGameStateEligible }
    _G.GetIdsByType = function(args)
        if args.Name == "ChallengeSwitchBase" then return { table.unpack(ANCHORS) } end
        if args.Name == "LootPoint" then return { 11, 12, 13 } end
        return {}
    end
    _G.GetIds = function() return { 21, 22 } end
    _G.RoomData = { BaseRoom = {} }
    _G.IsGameStateEligible = function() return true end
end

function TestRoomAnchors:tearDown()
    _G.GetIdsByType, _G.GetIds, _G.RoomData, _G.IsGameStateEligible = table.unpack(self.saved, 1, 4)
end

local function harness(overview)
    local module, _, callbacks = support.capture()
    local occurrence = { id = "room", gameName = "F_Combat01", overview = overview }
    local state = { state = "synchronized" }
    local diagnostics, reports = {}, 0
    local session = support.stub()
    session.diagnostic = function(_, kind, observed)
        diagnostics[#diagnostics + 1] = { kind = kind, observed = observed }
    end
    featureHooks.attach(module, session, function() return state end, function() reports = reports + 1 end, {
        current = function() return { occurrence = occurrence } end,
        occurrence = function(_, nativeRoom)
            return nativeRoom.__runPlannerExecutionRoomId == occurrence.id and occurrence or nil
        end,
        additional = function() return nil end,
    })
    return callbacks, diagnostics, state
end

-- Native's lowest-remaining draw, leaving a hole as RemoveRandomValue does.
local function lowest(values)
    local key
    for candidate, value in pairs(values) do
        if key == nil or value < values[key] then key = candidate end
    end
    if key == nil then return nil end
    local value = values[key]
    values[key] = nil
    return value
end

local function draw(callbacks, values) return callbacks.RemoveRandomValue(nil, {}, lowest, values) end

-- HandleSecretSpawns' object order over one ChallengeSwitchBase pool.
local function spawn(callbacks, present, nativeRoom)
    local currentRun = { CurrentRoom = nativeRoom }
    local function eligible(name, ...)
        return callbacks[name](nil, {}, function() return present[name] == true end, ...)
    end
    callbacks.HandleSecretSpawns(nil, {}, function(run)
        local room = run.CurrentRoom
        local ids = _G.GetIdsByType({ Name = "ChallengeSwitchBase" })
        local pin = _G.RoomData[room.Name] and _G.RoomData[room.Name].WellShopChallengeBaseId
        if next(ids) and eligible("IsWellShopEligible", run, room) then
            room.WellShop = { ObjectId = pin or draw(callbacks, ids) }
            for key, value in pairs(ids) do if value == pin then ids[key] = nil end end
        end
        if next(ids) and eligible("IsSellTraitShopEligible", room) then
            room.SellTraitShop = { ObjectId = draw(callbacks, ids) }
        end
        if next(ids) and eligible("IsSurfaceShopEligible", run, room) then
            room.SurfaceShop = { ObjectId = draw(callbacks, ids) }
        end
        if next(ids) and present.switch then
            -- The switch's encounter generation draws from other pools in between.
            lu.assertEquals(draw(callbacks, { 900, 901 }), 900)
            room.ChallengeSwitch = { ObjectId = draw(callbacks, ids) }
        end
        if next(ids) and eligible("IsMetaRewardStandEligible", run, room) then
            room.MetaRewardStand = { ObjectId = draw(callbacks, ids) }
        end
    end, currentRun)
    return nativeRoom
end

local function objects(room)
    local function id(object) return object and object.ObjectId or false end
    return { id(room.WellShop), id(room.SellTraitShop), id(room.SurfaceShop), id(room.ChallengeSwitch),
        id(room.MetaRewardStand) }
end

function TestRoomAnchors.testPlannedAnchorsAreTakenAndUnplannedObjectsDrawAroundThem()
    local callbacks, diagnostics = harness({
        stygianWell = { offers = {} },
        purgingPool = { anchorId = 1 },
        hermesShrine = { offers = {}, anchorId = 4 },
        challengeSwitch = { variantKey = "Switch", anchorId = 2 },
    })
    local room = spawn(callbacks, { IsMetaRewardStandEligible = true, switch = true },
        { Name = "F_Combat01", __runPlannerExecutionRoomId = "room", ForceWellShop = true, ForceSurfaceShop = true })
    -- The Well draws over {3, 5}; the Meta Reward Stand takes what is left.
    lu.assertEquals(objects(room), { 3, 1, 4, 2, 5 })
    lu.assertEquals(diagnostics, {})
end

function TestRoomAnchors.testWithoutPlannedAnchorsEveryDrawStaysNative()
    local callbacks, diagnostics = harness({ purgingPool = {}, challengeSwitch = { variantKey = "Switch" } })
    local room = spawn(callbacks, { switch = true }, { Name = "F_Combat01", __runPlannerExecutionRoomId = "room" })
    lu.assertEquals(objects(room), { false, 1, false, 2, false })
    lu.assertEquals(diagnostics, {})
end

function TestRoomAnchors.testPinnedWellKeepsItsPinAndTheSwitchStillTakesItsAnchor()
    _G.RoomData.F_PostBoss01 = { WellShopChallengeBaseId = 5 }
    local callbacks, diagnostics = harness({
        stygianWell = { offers = {}, anchorId = 5 },
        challengeSwitch = { variantKey = "Switch", anchorId = 3 },
    })
    local room = spawn(callbacks, { switch = true },
        { Name = "F_PostBoss01", __runPlannerExecutionRoomId = "room", ForceWellShop = true })
    lu.assertEquals(objects(room), { 5, false, false, 3, false })
    lu.assertEquals(diagnostics, {})
end

function TestRoomAnchors.testUnavailableAnchorDiagnosesAndFallsBackToNative()
    local callbacks, diagnostics = harness({
        purgingPool = { anchorId = 1 },
        challengeSwitch = { variantKey = "Switch", anchorId = 9 },
    })
    local room = spawn(callbacks, { switch = true }, { Name = "F_Combat01", __runPlannerExecutionRoomId = "room" })
    lu.assertEquals(objects(room), { false, 1, false, 2, false })
    lu.assertEquals(diagnostics, {
        { kind = "room-anchor-unavailable", observed = { object = "challengeSwitch", anchorId = 9 } },
        { kind = "room-anchor", observed = { object = "challengeSwitch", expected = 9, observed = 2 } },
    })
end

function TestRoomAnchors.testUnsynchronizedAndOtherRoomsStayNative()
    local callbacks, diagnostics, state = harness({ purgingPool = { anchorId = 3 } })
    local present = { IsSellTraitShopEligible = true }
    local other = spawn(callbacks, present, { Name = "F_Combat01", __runPlannerExecutionRoomId = "other" })
    lu.assertEquals(objects(other), { false, 1, false, false, false })
    state.state = "desynchronized"
    local room = spawn(callbacks, present, { Name = "F_Combat01", __runPlannerExecutionRoomId = "room" })
    lu.assertEquals(objects(room), { false, 1, false, false, false })
    lu.assertEquals(diagnostics, {})
end

function TestRoomAnchors.testFieldsAndAnchorScopesNeverCaptureEachOthersDraws()
    local callbacks, diagnostics = harness({
        fields = { cagePoints = { { slotKey = "cage1", pointId = 13 } }, optionalRewards = {} },
        purgingPool = { anchorId = 2 },
    })
    local room = { Name = "H_Combat01", __runPlannerExecutionRoomId = "room", OptionalRewardChances = {},
        BonusRewardStoreName = "FieldsOptionalRewards" }
    local cagePoint, anchorInside
    callbacks.SpawnRewardCages(nil, {}, function()
        -- An anchor-like pool inside the Fields scope is not an anchor draw.
        anchorInside = draw(callbacks, { 1, 2 })
        cagePoint = draw(callbacks, { 11, 12, 13 })
    end, room, {})
    lu.assertEquals({ anchorInside, cagePoint }, { 1, 13 })
    local pool = spawn(callbacks, {}, room)
    lu.assertEquals(pool.SellTraitShop.ObjectId, 2)
    lu.assertEquals(diagnostics, {})
end
