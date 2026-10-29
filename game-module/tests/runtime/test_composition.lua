-- luacheck: globals TestRuntimeComposition
local lu = require("luaunit")
local navigation = require("mods.navigation.hooks")
local roomHooks = require("mods.room.hooks")
local encounterHooks = require("mods.room.timeline.encounters.hooks")
local roomFeatureHooks = require("mods.room.features.hooks")
local transformations = require("mods.room.timeline.transformations.hooks")
local acquisitions = require("mods.room.timeline.acquisitions.hooks")
local seaStarDefinition = require("mods.room.timeline.acquisitions.sea_star")
local nativeGame = require("tests.harness.native_game")
local traitAcquisitions = require("mods.room.timeline.acquisitions.traits.hooks")
local rowOptions = require("mods.room.timeline.acquisitions.traits.row_options")
local hexTreeDefinition = require("mods.spells.hex_tree")
local loadoutHooks = require("mods.loadout.hooks")
local roomSession = require("mods.room.session")
local routeSession = require("mods.route.session")
local roomGuide = require("mods.presentation.room_guide")
local support = require("tests.harness.hook_composition")
local activeSlotModule = require("mods.host.active_slot")
local lfs = require("lfs")
local protocol = require("mods.protocol.decoder")
local capture, stub = support.capture, support.stub
local attachFeatureHooks = support.attachFeatureHooks
local navigationEntryStub = support.navigationEntryStub
local unusedLoadoutScope = {
    startingRun = function() return false end, installedRun = function() return false end, synchronizeStartingRoom = function()
        error("starting-room loadout synchronization is outside this test")
    end,
}
local function shipCombatStub()
    return {
        rewardContext = function() end,
        preparePhases = function() return function() end end,
        attach = function() end,
    }
end
local function generatedEncounterStub()
    return {
        attach = function() end,
        withPhase = function(_, _, _, _, action) return action() end,
        withRewardDestination = function(_, _, _, action) return action() end,
    }
end
TestRuntimeComposition = {}

function TestRuntimeComposition.testGuideInspectionProjectsActualRoomCompletionWithoutMutatingExecution()
    local priorImport, priorRom = _G.import, _G.rom
    local transaction = { owner = "guide-owner", kind = "fountainUse" }
    local occurrence = {
        id = "guide-room", gameName = "F_Combat01", overview = {},
        roomGuide = { { key = "fountain", transactionOwner = "guide-owner", description = { kind = "useFountain" } } },
        transactionsByOwner = { ["guide-owner"] = transaction },
        timeline = { transactions = { transaction }, dependencies = {}, obligations = {} },
    }
    local plan = { selectedOccurrenceIds = { "guide-room" }, occurrencesById = { ["guide-room"] = occurrence } }
    local route = routeSession.new(plan)
    assert(routeSession.enter(route, "guide-room", "F_Combat01"))
    local active = roomSession.new(occurrence, { owner = { ["guide-owner"] = { transaction = transaction } } })
    local state = { state = "synchronized", reason = "ready", plan = plan, route = route,
        room = { current = active }, diagnostics = {} }
    local function actual(name)
        local saved = _G.import
        _G.import = nil
        local value = require(name)
        _G.import = saved
        return value
    end
    local function freshImport(path)
        if path == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if path == "mods/runtime/composition.lua" then return assert(loadfile("src/" .. path))() end
        if path == "mods/protocol/json.lua" or path == "mods/protocol/decoder.lua" then
            return { decode = function(value) return value end, versionLabel = function() return "96.0" end }
        end
        if path == "mods/host/active_slot.lua" then return { create = function() return {} end } end
        if path == "mods/host/inbox.lua" then
            return { create = function() return {
                activeSlot = function() return 1 end, select = function() end, load = function() end,
                status = function() return {} end, plan = function() return plan end,
            } end }
        end
        if path == "mods/runtime/session.lua" then
            return { create = function() return state end, steering = function() return false end,
                status = function() return { state = state.state, reason = state.reason } end }
        end
        if path == "mods/route/session.lua" then return actual("mods.route.session") end
        if path == "mods/navigation/ephyra.lua" then return actual("mods.navigation.ephyra") end
        if path == "mods/room/coordinator.lua" then return actual("mods.room.coordinator") end
        if path == "mods/spells/hex_tree.lua" then return { create = function() return { attach = function() end } end } end
        if path == "mods/room/timeline/encounters/thessaly.lua" then return { create = shipCombatStub } end
        if path == "mods/room/timeline/encounters/generated.lua" then return { create = generatedEncounterStub } end
        return { attach = function() end }
    end
    _G.import, _G.rom = freshImport, { path = {} }
    local runtime = freshImport("mods/runtime/composition.lua").bind("/tmp/run-planner-test")
    local callbacks, tables = {}, {}
    roomGuide.attach({ overlays = {
        order = { module = 30 }, createLine = function() end,
        createTable = function(name) tables[name] = true end,
        onCommit = function(callback) callbacks.commit = callback end,
        onInterval = function(_, _, callback) callbacks.interval = callback end,
    } }, runtime.roomGuideInspection)
    local overlay = {
        setLine = function() end,
        setTable = function(_, rows) tables.rows = rows end,
        refreshOwned = function() end,
    }
    local overlayRuntime = { data = { read = function(alias)
        lu.assertEquals(alias, "ShowRoomGuide")
        return true
    end } }
    callbacks.interval(nil, overlayRuntime, overlay)
    lu.assertEquals(tables.rows, { { instruction = "Fountain" } })
    local handle = assert(roomSession.resolve(active, function(index) return index.owner["guide-owner"] end, "test"))
    assert(roomSession.complete(active, handle))
    callbacks.interval(nil, overlayRuntime, overlay)
    lu.assertEquals(tables.rows, {})
    lu.assertTrue(roomSession.isCompleted(active, "guide-owner"))
    state.state = "desynchronized"
    callbacks.interval(nil, overlayRuntime, overlay)
    lu.assertEquals(tables.rows, {})
    lu.assertTrue(roomSession.isCompleted(active, "guide-owner"))
    _G.import, _G.rom = priorImport, priorRom
end

function TestRuntimeComposition.testFirstMismatchLogIncludesFullInventoryAndOccurrenceDiagnostics()
    local priorImport, priorRom = _G.import, _G.rom
    local logs = {}
    local state = {
        state = "desynchronized", reason = "first-mismatch",
        firstMismatch = { checkpoint = "room-entry", expected = "F_Test", observed = "F_Wrong" },
        diagnostics = { {
            occurrenceId = "one", checkpoint = "run-state",
            expected = { gold = 1, damageBonus = 1.2 },
            observed = { gold = 2, damageBonus = (1 + 1.2) - 1 },
        } },
    }
    state.firstMismatch.checkpoint = "room-exit-conformance:traitInventory"
    state.firstMismatch.expected = { present = {} }
    state.firstMismatch.observed = { present = {} }
    for index = 1, 8 do
        state.firstMismatch.expected.present[index] = { traitKey = "Trait" .. index, rarity = "Rare", level = 4 }
        state.firstMismatch.observed.present[index] = { traitKey = "Trait" .. index, rarity = "Common", level = 4 }
    end
    local function freshImport(path)
        if path == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if path == "mods/runtime/composition.lua" then return assert(loadfile("src/" .. path))() end
        if path == "mods/protocol/json.lua" or path == "mods/protocol/decoder.lua" then
            return { decode = function(value) return value end, versionLabel = function() return "96.0" end }
        end
        if path == "mods/host/active_slot.lua" then return { create = function() return {} end } end
        if path == "mods/host/inbox.lua" then
            return { create = function()
                return { activeSlot = function() return 1 end, select = function() end,
                    load = function() end, status = function() return {} end }
            end }
        end
        if path == "mods/runtime/session.lua" then
            return { create = function() return state end, steering = function() return false end,
                status = function() return { state = state.state, reason = state.reason } end }
        end
        if path == "mods/spells/hex_tree.lua" then
            return { create = function() return { attach = function() end } end }
        end
        if path == "mods/room/timeline/encounters/thessaly.lua" then
            return { create = shipCombatStub }
        end
        if path == "mods/room/timeline/encounters/generated.lua" then
            return { create = generatedEncounterStub }
        end
        if path == "mods/room/hooks.lua" then
            return { attach = function(_, _, _, report) report({}) end }
        end
        return { create = function() return {} end, attach = function() return {} end }
    end
    _G.import = freshImport
    _G.rom = { path = {}, log = { info = function(message) logs[#logs + 1] = message end } }

    freshImport("mods/runtime/composition.lua").bind("/tmp/run-planner-test").attach({ isEnabled = function() return true end })

    lu.assertEquals(#logs, 2)
    lu.assertStrContains(logs[1], "first-mismatch checkpoint=room-exit-conformance:traitInventory")
    for index = 1, 8 do lu.assertStrContains(logs[1], "traitKey=Trait" .. index) end
    lu.assertStrContains(logs[1], "rarity=Rare")
    lu.assertStrContains(logs[1], "rarity=Common")
    lu.assertStrContains(logs[1], "level=4")
    lu.assertStrContains(logs[1], "diagnostics=")
    lu.assertStrContains(logs[1], "run-state")
    lu.assertStrContains(logs[1], "damageBonus=1.2000000000000002")
    lu.assertStrContains(logs[2], "diagnostic occurrence=one run-state {")
    _G.import, _G.rom = priorImport, priorRom
end

function TestRuntimeComposition.testFaultLogIncludesBindingContextAndEachStackLineOnce()
    local priorImport, priorRom = _G.import, _G.rom
    local logs = {}
    local state = {
        state = "faulted", reason = "executor-fault",
        firstFault = {
            checkpoint = "timeline-binding", expected = "one native carrier per exact handle",
            observed = "different binding",
            context = {
                operation = "bind", transaction = { owner = "health-pickup", kind = "acquisition" },
                native = { name = "HealDrop", objectId = 7123 },
                activeRoom = { id = "opening", gameName = "F_Opening01" },
            },
            traceback = "stack traceback:\n\tacquisitions/binding.lua:67: in callback",
        },
    }
    local function freshImport(path)
        if path == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if path == "mods/runtime/composition.lua" then return assert(loadfile("src/" .. path))() end
        if path == "mods/protocol/json.lua" or path == "mods/protocol/decoder.lua" then
            return { decode = function(value) return value end, versionLabel = function() return "96.0" end }
        end
        if path == "mods/host/active_slot.lua" then return { create = function() return {} end } end
        if path == "mods/host/inbox.lua" then return { create = function() return {} end } end
        if path == "mods/runtime/session.lua" then
            return { create = function() return state end, steering = function() return false end,
                status = function() return { state = state.state, reason = state.reason } end }
        end
        if path == "mods/room/timeline/encounters/thessaly.lua" then return { create = shipCombatStub } end
        if path == "mods/room/timeline/encounters/generated.lua" then
            return { create = generatedEncounterStub }
        end
        if path == "mods/room/hooks.lua" then
            return { attach = function(_, _, _, report) report({}); report({}) end }
        end
        return { create = function() return { attach = function() end } end,
            attach = function() return {} end }
    end
    _G.import = freshImport
    _G.rom = { path = {}, log = { info = function(message) logs[#logs + 1] = message end } }
    local ok, errorValue = pcall(function()
        freshImport("mods/runtime/composition.lua").bind("/tmp/run-planner-test").attach({ isEnabled = function() return true end })
    end)
    _G.import, _G.rom = priorImport, priorRom

    lu.assertTrue(ok, errorValue)
    lu.assertEquals(#logs, 3)
    lu.assertStrContains(logs[1], "executor-fault checkpoint=timeline-binding")
    lu.assertStrContains(logs[1], "name=HealDrop")
    lu.assertStrContains(logs[1], "objectId=7123")
    lu.assertStrContains(logs[1], "owner=health-pickup")
    lu.assertStrContains(logs[1], "gameName=F_Opening01")
    lu.assertStrContains(logs[2], "executor-fault trace stack traceback:")
    lu.assertStrContains(logs[3], "acquisitions/binding.lua:67")
end

function TestRuntimeComposition.testFieldsDiagnosticLogsItsCompletedSnapshotWithoutMismatch()
    local priorImport, priorRom = _G.import, _G.rom
    local logs = {}
    local state = {
        state = "synchronized", reason = "ready",
        diagnostics = { {
            occurrenceId = "fields", checkpoint = "fields-completed-product",
            observed = {
                planned = {
                    entryPair = { startPoint = { id = 1 }, endPoint = { id = 2 } },
                    cages = { { slotKey = "cage1", point = { id = 11 },
                        reward = { rewardType = "Boon", source = "DemeterUpgrade" } } },
                    optionalRewards = { { slotKey = "optional1", point = { id = 21 },
                        reward = { rewardType = "MaxHealthDrop", source = "MaxHealthDrop" } } },
                    nemesisPoint = { id = 31 },
                },
                observed = {
                    entryPair = { startPoint = { id = 1 }, endPoint = { id = 2 } },
                    cages = { { objectId = 101, name = "FieldsRewardCage", spawnPointId = 11,
                        reward = { objectId = 401, name = "RoomRewardConsolationPrize" } } },
                    optionalRewards = { { objectId = 201, name = "MaxHealthDrop", spawnPointId = 21,
                        restore = { rewardType = "MaxHealthDrop", spawnPointId = 21 } } },
                    nemesis = { objectId = 301, name = "NPC_Nemesis_01", spawnPointId = 31 },
                },
            },
        } },
    }
    local function freshImport(path)
        if path == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if path == "mods/runtime/composition.lua" then return assert(loadfile("src/" .. path))() end
        if path == "mods/protocol/json.lua" or path == "mods/protocol/decoder.lua" then
            return { decode = function(value) return value end, versionLabel = function() return "96.0" end }
        end
        if path == "mods/host/active_slot.lua" then return { create = function() return {} end } end
        if path == "mods/host/inbox.lua" then
            return { create = function()
                return { activeSlot = function() return 1 end, select = function() end,
                    load = function() end, status = function() return {} end }
            end }
        end
        if path == "mods/runtime/session.lua" then
            return { create = function() return state end, steering = function() return false end,
                status = function() return { state = state.state, reason = state.reason } end }
        end
        if path == "mods/spells/hex_tree.lua" then
            return { create = function() return { attach = function() end } end }
        end
        if path == "mods/room/timeline/encounters/thessaly.lua" then
            return { create = shipCombatStub }
        end
        if path == "mods/room/timeline/encounters/generated.lua" then
            return { create = generatedEncounterStub }
        end
        if path == "mods/room/hooks.lua" then
            return { attach = function(_, _, _, report)
                report({})
                report({})
            end }
        end
        return { create = function() return {} end, attach = function() return {} end }
    end
    _G.import = freshImport
    _G.rom = { path = {}, log = { info = function(message) logs[#logs + 1] = message end } }

    freshImport("mods/runtime/composition.lua").bind("/tmp/run-planner-test").attach({ isEnabled = function() return true end })

    lu.assertEquals(#logs, 1)
    lu.assertStrContains(logs[1], "diagnostic occurrence=fields")
    lu.assertStrContains(logs[1], "cage1:11:Boon/DemeterUpgrade")
    lu.assertStrContains(logs[1], "101:FieldsRewardCage#11")
    lu.assertStrContains(logs[1], "201:MaxHealthDrop#21=MaxHealthDrop/nil#21")
    _G.import, _G.rom = priorImport, priorRom
end

function TestRuntimeComposition.testAdmittedSessionAndEveryDiagnosticAreLoggedOnce()
    local priorImport, priorRom = _G.import, _G.rom
    local logs = {}
    local state = {
        state = "synchronized", reason = "ready", planSlot = 2,
        plan = {
            projectId = "project-1", displayName = "Fast \"Fields\"\n[RunPlanner] forged",
            planFingerprint = "0a1b2c3d",
            routeKey = "Underworld", catalogVersion = "0.55.0",
        },
        diagnostics = {
            { occurrenceId = "opening", checkpoint = "run-state", observed = { gold = 3 } },
            { occurrenceId = "fight", checkpoint = "encounter-composition", observed = { waves = 2 } },
        },
    }
    local function freshImport(path)
        if path == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if path == "mods/runtime/composition.lua" then return assert(loadfile("src/" .. path))() end
        if path == "mods/protocol/json.lua" or path == "mods/protocol/decoder.lua" then
            return { decode = function(value) return value end, versionLabel = function() return "96.0" end }
        end
        if path == "mods/host/active_slot.lua" then return { create = function() return {} end } end
        if path == "mods/host/inbox.lua" then return { create = function() return {} end } end
        if path == "mods/runtime/session.lua" then
            return { create = function() return state end, steering = function() return false end,
                status = function() return { state = state.state, reason = state.reason } end }
        end
        if path == "mods/room/timeline/encounters/thessaly.lua" then return { create = shipCombatStub } end
        if path == "mods/room/timeline/encounters/generated.lua" then
            return { create = generatedEncounterStub }
        end
        if path == "mods/room/hooks.lua" then
            return { attach = function(_, _, _, report)
                report({})
                state.diagnostics[#state.diagnostics + 1] = {
                    occurrenceId = "exit", checkpoint = "room-exit", observed = "F_Next",
                }
                report({})
            end }
        end
        return { create = function() return { attach = function() end } end,
            attach = function() return {} end }
    end
    _G.import = freshImport
    _G.rom = { path = {}, log = { info = function(message) logs[#logs + 1] = message end } }
    local ok, errorValue = pcall(function()
        freshImport("mods/runtime/composition.lua").bind("/tmp/run-planner-test", "1.2.3").attach({ isEnabled = function() return true end })
    end)
    _G.import, _G.rom = priorImport, priorRom

    lu.assertTrue(ok, errorValue)
    lu.assertEquals(#logs, 4)
    lu.assertEquals(logs[1], "[RunPlanner] session admitted slot=2 project=project-1"
        .. " name=\"Fast \\034Fields\\034\\010[RunPlanner] forged\""
        .. " fingerprint=0a1b2c3d route=Underworld schema=96.0"
        .. " catalog=0.55.0 module=1.2.3")
    lu.assertEquals(logs[2], "[RunPlanner] diagnostic occurrence=opening run-state {gold=3}")
    lu.assertEquals(logs[3], "[RunPlanner] diagnostic occurrence=fight encounter-composition {waves=2}")
    lu.assertEquals(logs[4], "[RunPlanner] diagnostic occurrence=exit room-exit F_Next")
end

function TestRuntimeComposition.testAcquisitionCompositionSharesOneSeaStarAcrossEveryCarrier()
    local priorImport = _G.import
    local module, _, callbacks = capture()
    local carrierActions = {}
    local carrierPaths = {
        ["mods/room/timeline/acquisitions/traits/hooks.lua"] = true,
        ["mods/room/timeline/acquisitions/levels/hooks.lua"] = true,
        ["mods/room/timeline/acquisitions/path/hooks.lua"] = true,
        ["mods/room/timeline/acquisitions/pickups/hooks.lua"] = true,
    }
    local function freshImport(path)
        if path == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if path == "mods/room/timeline/acquisitions/sea_star.lua" then
            return assert(loadfile("src/" .. path))()
        end
        if carrierPaths[path] then
            return {
                attach = function(_, _, _, _, _, carrierSeaStar)
                    carrierActions[path] = function()
                        local mismatch
                        local scope = carrierSeaStar.scope({}, {
                            detail = { seaStarResult = { kind = "proc" } },
                        })
                        local result = carrierSeaStar.call(scope, function()
                            local chance = callbacks.GetTotalHeroTraitValue(nil, {}, function() return 0 end,
                                "DoubleRewardChance", {})
                            local proc = nativeGame.randomChance(0)(chance)
                            return { chance = chance, proc = proc }
                        end, function(_, checkpoint) mismatch = checkpoint end)
                        return result, mismatch
                    end
                    return path:find("traits", 1, true) and {} or nil
                end,
            }
        end
        if path == "mods/room/timeline/acquisitions/hooks.lua" then
            return assert(loadfile("src/" .. path))()
        end
        return { attach = function()
            if path:find("npc/hooks", 1, true) then return {} end
            return nil
        end }
    end
    _G.import = freshImport

    local acquisitionComposition = freshImport("mods/room/timeline/acquisitions/hooks.lua")
    acquisitionComposition.attach(module, {}, function() end, function() end, {}, {})
    for _, path in ipairs({
        "mods/room/timeline/acquisitions/traits/hooks.lua",
        "mods/room/timeline/acquisitions/levels/hooks.lua",
        "mods/room/timeline/acquisitions/path/hooks.lua",
        "mods/room/timeline/acquisitions/pickups/hooks.lua",
    }) do
        local result, mismatch = carrierActions[path]()
        lu.assertEquals(result, { chance = 1, proc = true }, path)
        lu.assertNil(mismatch, path)
    end

    _G.import = priorImport
end

function TestRuntimeComposition.testRuntimeCompositionSharesOneHexTreeAcrossLoadoutAndSpellAcquisition()
    local priorImport = _G.import
    local module, _, callbacks = capture()
    module.cache = { define = function()
        error("executor runtime state must not register a save-backed cache")
    end }
    local loadoutTree, acquisitionTree
    local function freshImport(path)
        if path == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if path == "mods/protocol/json.lua" or path == "mods/protocol/decoder.lua" then
            return { decode = function(value) return value end, versionLabel = function() return "96.0" end }
        end
        if path == "mods/host/active_slot.lua" then return { create = function() return {} end } end
        if path == "mods/host/inbox.lua" then
            return { create = function()
                return {
                    activeSlot = function() return 1 end,
                    select = function() end,
                    load = function() end,
                    status = function() return {} end,
                }
            end }
        end
        if path == "mods/route/session.lua" or path == "mods/room/coordinator.lua"
            or path == "mods/room/conformance/readers.lua" then
            return {}
        end
        if path == "mods/runtime/session.lua" then
            return {
                create = function() return {} end,
                steering = function() return false end,
                status = function() return { state = "inactive", reason = "test" } end,
            }
        end
        if path == "mods/spells/hex_tree.lua" then return assert(loadfile("src/" .. path))() end
        if path == "mods/room/timeline/encounters/thessaly.lua" then
            return { create = shipCombatStub }
        end
        if path == "mods/room/timeline/encounters/generated.lua" then
            return { create = generatedEncounterStub }
        end
        if path == "mods/loadout/hooks.lua" then
            return { attach = function(_, _, _, _, _, sharedTree)
                loadoutTree = sharedTree
                return {}
            end }
        end
        if path == "mods/room/timeline/acquisitions/hooks.lua" then
            return { attach = function(_, _, _, _, _, sharedTree) acquisitionTree = sharedTree end }
        end
        return { attach = function() return {} end }
    end
    _G.import = freshImport
    local priorRom = _G.rom
    _G.rom = { path = {} }

    local runtime = assert(loadfile("src/mods/runtime/composition.lua"))().bind("/tmp/run-planner-test")
    runtime.attach(module)
    local expected = {
        layoutKey = "ExpectedLayout", nodes = {},
    }
    local mismatches = {}
    local function mismatch(checkpoint) mismatches[#mismatches + 1] = checkpoint end
    local startup = loadoutTree.prepare(expected, "StartupTrait", mismatch)
    callbacks.CreateTalentTree(nil, {}, function() return "startup-tree" end,
        { TraitName = "StartupTrait" })
    loadoutTree.clear(startup)
    local acquired = acquisitionTree.realize(expected, "AcquiredTrait", mismatch, function()
        return callbacks.CreateTalentTree(nil, {}, function() return "acquired-tree" end,
            { TraitName = "AcquiredTrait" })
    end)
    lu.assertEquals(acquired, "acquired-tree")
    lu.assertEquals(mismatches, {})

    _G.import, _G.rom = priorImport, priorRom
end

function TestRuntimeComposition.testCompositionPassesRouteAndRoomAuthoritiesToHooks()
    local priorImport, priorRom = _G.import, _G.rom
    local route, room, conformance = {}, {}, {}
    local frozen, preview = {}, {}
    local state = {
        state = "synchronized", reason = "ready", plan = frozen, planSlot = 3,
        route = { index = 2, currentOccurrence = { gameName = "N_Combat01" } },
    }
    local attached
    local function freshImport(path)
        if path == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if path == "mods/runtime/composition.lua" then
            return assert(loadfile("src/" .. path))()
        end
        if path == "mods/protocol/json.lua" or path == "mods/protocol/decoder.lua" then
            return { decode = function(value) return value end, versionLabel = function() return "96.0" end }
        end
        if path == "mods/host/active_slot.lua" then return { create = function() return {} end } end
        if path == "mods/host/inbox.lua" then
            return { create = function()
                return {
                    activeSlot = function() return 1 end,
                    select = function() end,
                    load = function() end,
                    plan = function() return preview end,
                    status = function() return {} end,
                }
            end }
        end
        if path == "mods/route/session.lua" then return route end
        if path == "mods/room/coordinator.lua" then return room end
        if path == "mods/room/conformance/readers.lua" then return conformance end
        if path == "mods/runtime/session.lua" then
            return {
                create = function() return state end,
                steering = function() return false end,
                status = function() return require("mods.runtime.session").status(state) end,
            }
        end
        if path == "mods/spells/hex_tree.lua" then
            return { create = function() return { attach = function() end } end }
        end
        if path == "mods/room/timeline/encounters/thessaly.lua" then
            return { create = shipCombatStub }
        end
        if path == "mods/room/timeline/encounters/generated.lua" then
            return { create = generatedEncounterStub }
        end
        if path == "mods/loadout/hooks.lua" or path == "mods/room/timeline/acquisitions/hooks.lua" then
            return { attach = function() return {} end }
        end
        if path == "mods/room/hooks.lua" then
            return { attach = function(_, sessionValue, _, _, routeValue, roomValue)
                attached = { session = sessionValue, route = routeValue, room = roomValue }
            end }
        end
        return { attach = function() return {} end }
    end
    _G.import = freshImport
    _G.rom = { path = {} }

    local runtime = freshImport("mods/runtime/composition.lua").bind("/tmp/run-planner-test")
    lu.assertEquals(type(runtime.attach), "function")
    lu.assertEquals(type(runtime.inboxInspection.load), "function")
    lu.assertEquals(type(runtime.inboxInspection.status), "function")
    lu.assertEquals(type(runtime.inboxInspection.activeSlot), "function")
    lu.assertEquals(type(runtime.inboxInspection.select), "function")
    lu.assertIs(runtime.inboxInspection.plan(), preview)
    local snapshot = runtime.sessionInspection()
    lu.assertIs(snapshot.plan, frozen)
    lu.assertEquals(snapshot.slot, 3)
    lu.assertEquals(snapshot.current.gameName, "N_Combat01")
    lu.assertEquals(snapshot.index, 2)
    preview = {}
    state.state, state.reason = "faulted", "executor-fault"
    state.firstFault = { checkpoint = "test-contact", expected = "native function", observed = "missing" }
    snapshot = runtime.sessionInspection()
    lu.assertIs(runtime.inboxInspection.plan(), preview)
    lu.assertIs(snapshot.plan, frozen)
    lu.assertEquals(snapshot.state, "faulted")
    lu.assertIs(snapshot.issue, state.firstFault)
    lu.assertEquals(snapshot.checkpoint, "test-contact")
    runtime.attach({ isEnabled = function() return true end })
    lu.assertTrue(rawequal(attached.route, route))
    lu.assertTrue(rawequal(attached.room, room))

    _G.import, _G.rom = priorImport, priorRom
end

function TestRuntimeComposition.testAdmissionReadsTheActiveSlotFileEachTime()
    local priorImport, priorRom = _G.import, _G.rom
    local root = os.tmpname()
    os.remove(root)
    assert(lfs.mkdir(root))
    local path = root .. "/" .. activeSlotModule.FILE_NAME
    local function publish(content)
        local file = assert(io.open(path, "wb"))
        file:write(content)
        file:close()
    end
    local loadoutRuntime
    local function freshImport(importPath)
        if importPath == "mods/run_modifiers/hooks.lua" then return { attach = function() return { verifyNative = function() end } end } end
        if importPath == "mods/runtime/composition.lua" then return assert(loadfile("src/" .. importPath))() end
        if importPath == "mods/host/active_slot.lua" then return activeSlotModule end
        if importPath == "mods/protocol/json.lua" or importPath == "mods/protocol/decoder.lua" then
            return { decode = function(value) return value end, versionLabel = function() return "96.0" end }
        end
        if importPath == "mods/host/inbox.lua" then
            return { create = function() return { activeSlot = function() return 1 end } end }
        end
        if importPath == "mods/room/timeline/encounters/thessaly.lua" then return { create = shipCombatStub } end
        if importPath == "mods/room/timeline/encounters/generated.lua" then
            return { create = generatedEncounterStub }
        end
        if importPath == "mods/loadout/hooks.lua" then
            return { attach = function(_, value) loadoutRuntime = value; return {} end }
        end
        return { create = function() return { attach = function() end } end, attach = function() return {} end }
    end
    _G.import = freshImport
    _G.rom = { path = { combine = function(base, name) return base .. "/" .. name end }, log = { info = function() end } }
    freshImport("mods/runtime/composition.lua").bind(root).attach({ isEnabled = function() return true end })

    local read = loadoutRuntime.activePlanSlot
    lu.assertEquals(read({}), 1)
    publish(activeSlotModule.encode(4))
    lu.assertEquals(read({}), 4)
    publish('{ "format": "run-planner-active-slot", "formatVersion": 1, "slot": 2 }')
    lu.assertEquals(read({}), 2)
    publish('{"slot":9}')
    lu.assertEquals(read({}), 1)
    local file = assert(io.open(path, "rb"))
    lu.assertEquals(file:read("*a"), '{"slot":9}')
    file:close()

    os.remove(path)
    lfs.rmdir(root)
    _G.import, _G.rom = priorImport, priorRom
end

function TestRuntimeComposition.testRuntimeCompositionInstallsSupportedHookGroups()
    local module, names, callbacks = capture()
    local hexTree = hexTreeDefinition.create()
    local session = stub()
    local getState, report = function() end, function() end
    local route = { expected = function() end, current = function() end }
    local priorImport = _G.import
    _G.import = function(path)
        return require((path:gsub("%.lua$", ""):gsub("/", ".")))
    end
    loadoutHooks.attach(module, { inbox = {}, session = session, activePlanSlot = function() return 1 end, enabled = function() return true end },
        getState, report, session, hexTree)
    _G.import = priorImport
    acquisitions.attach(module, session, getState, report, session, hexTree)
    local transformationScope = transformations.attach(module, session, getState, report, session)
    local featureScope = roomFeatureHooks.attach(module, session, getState, report, session)
    local navigationEntry = navigation.attach(module, session, getState, report, route, session, transformationScope)
    roomHooks.attach(module, session, getState, report, route, session, featureScope, navigationEntry,
        unusedLoadoutScope)
    encounterHooks.attach(module, session, getState, report, session)
    attachFeatureHooks(module, session, getState, report, session, route)
    lu.assertNil(callbacks.AthenaUse)
    lu.assertNil(callbacks.HandleAthenaSpawn)
    for _, name in ipairs({
        "ChooseStartingRoom", "StartRoom", "DoUnlockRoomExits", "LeaveRoom",
        "StartEncounter", "EndEncounterEffects", "SetupRoomMultipleEncountersData",
        "SetupEncounter", "GenerateEncounter", "CalculateActiveEnemyCap", "FillEnemyTypes",
        "PickEncounterEliteAttributes", "HandleNextSpawn",
        "ShipsEncounterSetup", "ChooseNextRewardStore", "CreateDoorRewardPreview", "UseShipWheel",
        "UseConsumableItem", "AddStackToTraits", "HandleLootPickup",
        "ConvertMetaRewardPresentation", "CreateLoot", "UnwrapRandomLoot",
        "ArachneCostumeChoice", "NarcissusBenefitChoice", "MedeaCurseChoice", "CirceBlessingChoice",
        "IcarusBenefitChoice", "EchoChoice", "PassRarityCheck", "SpawnNemesisForRandomEvents",
        "CheckAvailableTextLines",
        "NemesisTradeChoice", "TradeDoExchange", "NPCRewardDropPreProcess", "NPCRewardDropPreProcessArgs",
        "NPCRewardDrop", "StartNemesisDamageContest", "NemesisDamageContestTimer",
        "CirceRandomMetaUpgrade", "AddRandomMetaUpgrades", "CirceMetaUpgradeRarity",
        "CirceRemoveShrineUpgrades", "RandomChance", "GetRandomKey",
        "FillInShopOptions", "CreateStoreButtons", "RestockWorldItem", "CreateConsumableItem",
        "ChaosHammerUpgrade",
        "SpawnStoreItemInWorld", "HandleStorePurchase", "AwardRandomStoreItem",
    }) do
        lu.assertNotNil(names[name], name)
    end
    lu.assertNil(names.GoldifyPresentation)
    lu.assertNil(names.SetTransformingTraitsOnLoot)
end

function TestRuntimeComposition.testKeepsakeAdaptersAreInstalledOnceAtTheirCarrierBoundaries()
    local module, names = capture()
    local hexTree = hexTreeDefinition.create()
    local seaStar = seaStarDefinition.create()
    local session = stub()
    local priorImport = _G.import
    _G.import = function(path)
        return require((path:gsub("%.lua$", ""):gsub("/", ".")))
    end
    loadoutHooks.attach(module, { inbox = {}, session = session, activePlanSlot = function() return 1 end, enabled = function() return true end },
        function() end, function() end, session, hexTree)
    _G.import = priorImport
    encounterHooks.attach(module, session, function() end, function() end, session)
    traitAcquisitions.attach(module, session, function() end, function() end, session, seaStar, nil,
        rowOptions)

    local expected = {
        { "GiveDurationHammer", "run-planner-equip-hammer" },
        { "AddRandomMetaUpgrades", "run-planner-boss-arcana" },
        { "AddRandomChaosBlessing", "run-planner-equip-embryo-result" },
        { "AddRandomChaosBlessing", "run-planner-embryo" },
        { "GetProcessedTraitData", "run-planner-equip-embryo-values" },
        { "GetProcessedTraitData", "run-planner-embryo-values" },
        { "HandleEncounterPreSpawns", "run-planner-fig-leaf-pre-spawns" },
        { "HandleEnemySpawns", "run-planner-fig-leaf-enemy-spawns" },
        { "HasHeroTraitValue", "run-planner-scope-concave-stone-roll" },
        { "RandomChance", "run-planner-steer-concave-stone-roll" },
    }
    for _, item in ipairs(expected) do
        lu.assertEquals(names[item[1]][item[2]], true, item[1] .. ":" .. item[2])
    end
end

function TestRuntimeComposition.testMismatchStopsEnforcementWithoutBlockingNativeRoomFlow()
    local module, _, callbacks = capture()
    local session = stub()
    local getState = function()
        return { state = "desynchronized" }
    end
    local route = { expected = function() end, current = function() end }
    local featureScope = roomFeatureHooks.attach(module, session, getState, function() end, session)
    local navigationEntry = navigation.attach(module, session, getState, function() end, route, session)
    roomHooks.attach(module, session, getState, function() end,
        route, session, featureScope, navigationEntry, unusedLoadoutScope)

    local starting = callbacks.ChooseStartingRoom(nil, {}, function()
        return { Name = "NativeOpening" }
    end, {}, {})
    local entered = callbacks.StartRoom(nil, {}, function()
        return "native-entry"
    end, {}, { Name = "NativeOpening" })
    local left = callbacks.LeaveRoom(nil, {}, function()
        return "native-exit"
    end, {}, {})

    lu.assertEquals(starting, { Name = "NativeOpening" })
    lu.assertEquals(entered, "native-entry")
    lu.assertEquals(left, "native-exit")
end

function TestRuntimeComposition.testRoomAfterConfiguredPrefixHandsControlBackToNativeGame()
    local module, _, callbacks = capture()
    local state = { state = "synchronized", route = {}, room = {} }
    local session = stub()
    local enteredRoom = false
    local route = {
        expected = function() return nil end,
        enter = function() return true end,
    }
    local room = {
        enter = function() enteredRoom = true end,
        realize = function() return nil end,
    }
    roomHooks.attach(module, session, function() return state end, function() end,
        route, room, { currentAdditional = function() return nil end }, navigationEntryStub,
        unusedLoadoutScope)

    local result = callbacks.StartRoom(nil, {}, function()
        return "native-entry"
    end, {}, { Name = "H_Opening01" })

    lu.assertEquals(result, "native-entry")
    lu.assertFalse(enteredRoom)
    lu.assertEquals(state.state, "inactive")
    lu.assertEquals(state.reason, "configured-prefix-complete")
end

function TestRuntimeComposition.testAdmittedModifierCompositionUsesFrozenRunAndPlanAfterPrefix()
    local runtimeSession = require('mods.runtime.session')
    local modifierHooks = require('mods.run_modifiers.hooks')
    local admitted = { Hero = { ObjectId = 1 }, CurrentRoom = { Encounter = { MoneyDropStore = 2 } } }
    local victim = { ObjectId = 2, DamageType = 'Enemy', AddToEnemyTeam = true, MoneyDropOnDeath = { Chance = 0.2 } }
    local state = runtimeSession.create()
    local plan = { kind = 'ready', occurrences = {}, selectedOccurrenceIds = {}, occurrencesById = {},
        runModifiers = { enemyGoldDropChance = 80 } }
    local preview = plan
    local module, _, callbacks = capture()
    local restore = nativeGame.install({ CurrentRun = admitted, CurrentHubRoom = false, SessionMapState = {},
        ActiveEnemies = { [2] = victim }, Kill = function() end, CheckMoneyDrop = function() end,
        rom = { path = {}, log = { info = function() end } } })
    local priorImport = _G.import
    _G.import = function(path)
        if path == 'mods/runtime/session.lua' then
            return setmetatable({ create = function() return state end }, { __index = runtimeSession })
        end
        if path == 'mods/run_modifiers/hooks.lua' then return modifierHooks end
        if path == 'mods/protocol/decoder.lua' then return protocol end
        if path == 'mods/host/active_slot.lua' then return { create = function() return { read = function() return 1 end } end } end
        if path == 'mods/host/inbox.lua' then return { create = function() return {
            load = function() return true, preview end, plan = function() return preview end,
            status = function() return {} end,
        } end } end
        if path == 'mods/spells/hex_tree.lua' then return { create = function() return { attach = function() end } end } end
        if path == 'mods/room/timeline/encounters/thessaly.lua' then return { create = shipCombatStub } end
        if path == 'mods/room/timeline/encounters/generated.lua' then return { create = generatedEncounterStub } end
        if path == 'mods/loadout/hooks.lua' then return { attach = function(_, _, _, report)
            assert(runtimeSession.start(state, { load = function() return true, plan end }, 'starting', 1))
            report({})
            -- The loadout owner publishes this transition after native verification.
            state.state, state.reason = 'synchronized', 'ready'
            report({})
            return {}
        end } end
        return { attach = function() return {} end }
    end
    local bound = assert(loadfile('src/mods/runtime/composition.lua'))().bind('/tmp/run-planner-modifiers-test')
    bound.attach(module)
    lu.assertIs(state.admittedNativeRun, admitted)
    preview = { runModifiers = {} }
    lu.assertIs(bound.sessionInspection().plan, plan)
    state.state, state.reason = 'inactive', 'configured-prefix-complete'
    local args = { AttackerTable = admitted.Hero }
    local function drop()
        return callbacks.Kill(nil, {}, function(v)
            return callbacks.CheckMoneyDrop(nil, {}, function(_, data) return data end, v, v.MoneyDropOnDeath, admitted.Hero)
        end, victim, args)
    end
    lu.assertEquals(drop().Chance, 0.8)
    runtimeSession.beginNewRun(state)
    lu.assertNil(state.admittedNativeRun)
    lu.assertIs(drop(), victim.MoneyDropOnDeath)
    _G.import = priorImport
    restore()
end

-- An admitted synchronized run with the real session and run-modifier hooks.
local function enabledToggleRun()
    local runtimeSession = require('mods.runtime.session')
    local modifierHooks = require('mods.run_modifiers.hooks')
    local admitted = { Hero = { ObjectId = 1 }, CurrentRoom = { Encounter = { MoneyDropStore = 2 } } }
    local victim = { ObjectId = 2, DamageType = 'Enemy', AddToEnemyTeam = true, MoneyDropOnDeath = { Chance = 0.2 } }
    local run = { session = runtimeSession, state = runtimeSession.create(), victim = victim, commits = {},
        refreshed = {}, logs = {} }
    local plan = { kind = 'ready', occurrences = {}, selectedOccurrenceIds = {}, occurrencesById = {},
        runModifiers = { enemyGoldDropChance = 80 }, planFingerprint = 'feedface' }
    local module, _, callbacks = capture()
    run.module = module
    module.overlays = { onCommit = function(callback) run.commits[#run.commits + 1] = callback end }
    local highlights = {
        attach = function() end,
        refresh = function(_, value) run.refreshed[#run.refreshed + 1] = value.state end,
    }
    local restore = nativeGame.install({ CurrentRun = admitted, CurrentHubRoom = false, SessionMapState = {},
        ActiveEnemies = { [2] = victim }, Kill = function() end, CheckMoneyDrop = function() end,
        rom = { path = {}, log = { info = function(message) run.logs[#run.logs + 1] = message end } } })
    local priorImport = _G.import
    _G.import = function(path)
        if path == 'mods/runtime/session.lua' then
            return setmetatable({ create = function() return run.state end }, { __index = runtimeSession })
        end
        if path == 'mods/run_modifiers/hooks.lua' then return modifierHooks end
        if path == 'mods/host/active_slot.lua' then return { create = function() return { read = function() return 1 end } end } end
        if path == 'mods/host/inbox.lua' then return { create = function() return {} end } end
        if path == 'mods/spells/hex_tree.lua' then return { create = function() return { attach = function() end } end } end
        if path == 'mods/room/timeline/encounters/thessaly.lua' then return { create = shipCombatStub } end
        if path == 'mods/room/timeline/encounters/generated.lua' then return { create = generatedEncounterStub } end
        if path == 'mods/loadout/hooks.lua' then return { attach = function()
            assert(runtimeSession.start(run.state, { load = function() return true, plan end }, 'synchronized', 3))
            return {}
        end } end
        return { attach = function() return {} end }
    end
    run.bound = assert(loadfile('src/mods/runtime/composition.lua'))().bind('/tmp/run-planner-enabled-test')
    run.bound.attach(module, highlights)
    function run.drop()
        return callbacks.Kill(nil, {}, function(v)
            return callbacks.CheckMoneyDrop(nil, {}, function(_, data) return data end, v, v.MoneyDropOnDeath, admitted.Hero)
        end, victim, { AttackerTable = admitted.Hero })
    end
    function run.finish()
        _G.import = priorImport
        restore()
    end
    lu.assertEquals(run.drop().Chance, 0.8)
    run.logs = {}
    return run
end

function TestRuntimeComposition.testDisablingMidRunDropsThePlanForTheRestOfTheRun()
    local run = enabledToggleRun()
    local state, bound = run.state, run.bound
    -- Presentation shows nothing while disabled.
    run.module.enabled = false
    lu.assertEquals(bound.sessionInspection(), { state = 'inactive', reason = 'disabled' })
    lu.assertNil(bound.roomGuideInspection())
    -- The commit that turns the module off ends the session and clears the highlights.
    run.commits[1](nil, {})
    lu.assertEquals(state.state, 'inactive')
    lu.assertEquals(state.reason, 'disabled')
    lu.assertEquals(run.refreshed[#run.refreshed], 'inactive')
    lu.assertIs(run.drop(), run.victim.MoneyDropOnDeath)
    lu.assertEquals(#run.logs, 1)
    lu.assertStrContains(run.logs[1], 'session abandoned: module disabled slot=3 fingerprint=feedface')
    -- Later executor faults and mismatches leave the abandoned session as it is.
    run.session.fault(state, 'late-contact', 'expected', 'observed')
    run.session.mismatch(state, 'late-check', 'expected', 'observed')
    lu.assertEquals({ state.state, state.reason }, { 'inactive', 'disabled' })
    lu.assertNil(state.firstFault)
    lu.assertNil(state.firstMismatch)

    -- Re-enabling mid-run never resumes the plan.
    run.module.enabled = true
    lu.assertIs(run.drop(), run.victim.MoneyDropOnDeath)
    local snapshot = bound.sessionInspection()
    lu.assertEquals({ snapshot.state, snapshot.reason }, { 'inactive', 'disabled' })
    lu.assertEquals(#run.logs, 1)
    run.finish()
end

-- A toggle that reaches no commit, such as a profile import, is caught by the next hook.
function TestRuntimeComposition.testAHookAbandonsTheSessionWithoutACommit()
    local run = enabledToggleRun()
    run.module.enabled = false
    lu.assertIs(run.drop(), run.victim.MoneyDropOnDeath)
    run.finish()
end

function TestRuntimeComposition.testDisablingKeepsTheOutcomeOfRunsThatNoLongerSteer()
    local run = enabledToggleRun()
    run.session.fault(run.state, 'test-fault', 'expected', 'observed')
    run.module.enabled = false
    run.commits[1](nil, {})
    lu.assertEquals({ run.state.state, run.state.reason }, { 'faulted', 'executor-fault' })
    run.finish()

    -- A completed prefix keeps its outcome; only its run modifiers stop.
    run = enabledToggleRun()
    run.state.state, run.state.reason = 'inactive', 'configured-prefix-complete'
    lu.assertEquals(run.drop().Chance, 0.8)
    run.module.enabled = false
    lu.assertIs(run.drop(), run.victim.MoneyDropOnDeath)
    lu.assertEquals({ run.state.state, run.state.reason }, { 'inactive', 'configured-prefix-complete' })
    lu.assertEquals(#run.logs, 1)
    run.finish()

    -- A completed prefix whose run has ended is left alone.
    run = enabledToggleRun()
    run.state.state, run.state.reason = 'inactive', 'configured-prefix-complete'
    _G.CurrentRun = {}
    run.module.enabled = false
    run.commits[1](nil, {})
    lu.assertNil(run.state.abandoned)
    lu.assertEquals(#run.logs, 0)
    run.finish()
end
