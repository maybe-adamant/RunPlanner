-- luacheck: globals TestPresentationHooks
local lu = require("luaunit")
local safeHooks = require("mods.host.presentation_hooks")
local highlights = require("mods.presentation.highlights.highlights")

TestPresentationHooks = {}

local function captureModule()
    local wrapped = {}
    return wrapped, { hooks = { wrap = function(path, _, callback) wrapped[path] = callback end } }
end

local function withLog(action)
    local priorRom, logs = _G.rom, {}
    _G.rom = { log = { info = function(line) logs[#logs + 1] = line end } }
    local ok, failure = pcall(action, logs)
    _G.rom = priorRom
    assert(ok, failure)
end

function TestPresentationHooks.testThrowingRoomHookStillRunsBaseWithOriginalArguments()
    withLog(function(logs)
        local wrapped, module = captureModule()
        safeHooks.wrap(module, "StartRoom", "planted-room-start", {
            before = function() error("before failed") end,
            after = function() error("after failed") end,
        })
        local currentRun, room, received = {}, {}, nil
        local function base(...)
            received = table.pack(...)
            return "native-result", nil, "third"
        end
        for _ = 1, 2 do
            local results = table.pack(wrapped.StartRoom(nil, {}, base, currentRun, room))
            lu.assertEquals(results.n, 3)
            lu.assertEquals(results[1], "native-result")
            lu.assertNil(results[2])
            lu.assertEquals(results[3], "third")
            lu.assertEquals(received.n, 2)
            lu.assertIs(received[1], currentRun)
            lu.assertIs(received[2], room)
        end
        lu.assertEquals(#logs, 1)
        lu.assertStrContains(logs[1], "planted-room-start")
    end)
end

function TestPresentationHooks.testNativeFailureStillPropagatesUnchanged()
    local wrapped, module = captureModule()
    local ran = false
    safeHooks.wrap(module, "LeaveRoom", "planted-room-leave", { after = function() ran = true end })
    local ok, failure = pcall(wrapped.LeaveRoom, nil, {}, function() error({ native = true }) end)
    lu.assertFalse(ok)
    lu.assertEquals(failure, { native = true })
    lu.assertFalse(ran)
    local cleaned = false
    safeHooks.wrap(module, "EphyraZoomOut", "planted-cleanup", { cleanup = function()
        cleaned = true
        error("cleanup failed")
    end })
    ok, failure = pcall(wrapped.EphyraZoomOut, nil, {}, function() error({ native = "zoom" }) end)
    lu.assertFalse(ok)
    lu.assertEquals(failure, { native = "zoom" })
    lu.assertTrue(cleaned)
    lu.assertEquals({ wrapped.EphyraZoomOut(nil, {}, function(value) return value, 2 end, 1) }, { 1, 2 })
end

function TestPresentationHooks.testThrowingScreenHookStillReturnsTheNativeResult()
    withLog(function()
        local wrapped, module = captureModule()
        highlights.create(function() end).attach(module, function() error("state unavailable") end)
        local screen, loot, args, received = { Source = {} }, {}, {}, nil
        local result = wrapped.CreateBoonLootButtons(nil, {}, function(...)
            received = table.pack(...)
            return "native-buttons"
        end, screen, loot, false, args)
        lu.assertEquals(result, "native-buttons")
        lu.assertEquals(received.n, 4)
        lu.assertIs(received[1], screen)
        lu.assertIs(received[2], loot)
        lu.assertFalse(received[3])
        lu.assertIs(received[4], args)
    end)
end

function TestPresentationHooks.testFailedDecorationKeepsTheNativeResult()
    withLog(function()
        local wrapped, module = captureModule()
        safeHooks.wrap(module, "PopulateDoorRewardPreviewSubIcons", "planted-icons", {
            decorate = function() error("icons failed") end,
        })
        local icons = {}
        lu.assertIs(wrapped.PopulateDoorRewardPreviewSubIcons(nil, {}, function() return icons end, {}, {}), icons)
        safeHooks.wrap(module, "PopulateDoorRewardPreviewSubIcons", "planted-icons-text", {
            decorate = function() return "not icons" end,
        })
        lu.assertIs(wrapped.PopulateDoorRewardPreviewSubIcons(nil, {}, function() return icons end, {}, {}), icons)
    end)
end

function TestPresentationHooks.testOnlyTheMapSubIconsMayBeDecorated()
    local wrapped, module = captureModule()
    local ok, failure = pcall(safeHooks.wrap, module, "StartRoom", "planted-decoration", {
        decorate = function() return {} end,
    })
    lu.assertFalse(ok)
    lu.assertStrContains(failure, "StartRoom")
    lu.assertNil(wrapped.StartRoom)
    safeHooks.wrap(module, "PopulateDoorRewardPreviewSubIcons", "planted-empty-icons", {
        decorate = function() return { "marker" } end,
    })
    lu.assertEquals(wrapped.PopulateDoorRewardPreviewSubIcons(nil, {}, function() end, {}, {}), { "marker" })
end

function TestPresentationHooks.testExecutionFacingEntryPointsContainFailures()
    withLog(function(logs)
        local instance = highlights.create(function() error("route unavailable") end)
        lu.assertNil(instance.hub({}, { state = "synchronized", route = {} }, {}, { slots = {} }))
        lu.assertEquals(#logs, 1)
        local guarded = safeHooks.guard("planted-overlay", function(_, _, overlay) overlay.missing() end)
        lu.assertNil(guarded(nil, {}, {}))
    end)
end
