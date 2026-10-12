-- luacheck: globals TestHostBootstrap
local lu = require("luaunit")

TestHostBootstrap = {}

-- failing names presentation imports whose construct or attach throws.
local function bootstrap(failing)
    failing = failing or {}
    local registered = { pathApi = {}, logs = {} }
    local bridge = { renderWindow = function() end, addMenuBar = function() end }
    local module = {
        data = { define = function() end },
        ui = { tab = function(draw) registered.tab = draw end },
        overlays = {
            order = { module = 30 },
            createLine = function() end, createTable = function() end,
            onCommit = function() end, onInterval = function() end,
        },
        fallbackUi = { attachGuiOnce = function(register) register(bridge) end },
        activate = function()
            lu.assertEquals(registered.window, bridge.renderWindow)
            lu.assertEquals(registered.menu, bridge.addMenuBar)
            registered.activated = true
        end,
    }
    local slotOverview, highlights = {}, {}
    local runtime = {
        attach = function(target, guidance)
            lu.assertIs(target, module)
            registered.executionAttached, registered.highlights = true, guidance
        end,
        roomGuideInspection = function() end,
        sessionInspection = function() end,
        nextOccurrence = function() end,
        inboxInspection = {}, activeSlot = {},
    }
    local drawTab = function() end
    local imports = {
        ["mods/host/data.lua"] = { buildStorage = function() return {} end },
        ["mods/host/build_identity.lua"] = { read = function(pluginRoot, pathApi)
            lu.assertEquals(pluginRoot, "plugin-folder")
            lu.assertIs(pathApi, registered.pathApi)
            return "installed-build"
        end },
        ["mods/runtime/composition.lua"] = { bind = function(root, version, buildId)
            lu.assertEquals({ root, version, buildId }, { "unused", "1.2.3", "installed-build" })
            return runtime
        end },
        ["mods/presentation/slot_overview.lua"] = { create = function(root, pathApi, buildId)
            lu.assertEquals({ root, buildId }, { "unused", "installed-build" })
            lu.assertIs(pathApi, registered.pathApi)
            return slotOverview
        end },
        ["mods/presentation/status_ui.lua"] = { bind = function(inbox, inspect, activeSlot, overview)
            lu.assertIs(inbox, runtime.inboxInspection)
            lu.assertIs(inspect, runtime.sessionInspection)
            lu.assertIs(activeSlot, runtime.activeSlot)
            lu.assertIs(overview, slotOverview)
            return { drawTab = drawTab }
        end },
        ["mods/presentation/highlights/highlights.lua"] = { create = function(nextOccurrence)
            lu.assertIs(nextOccurrence, runtime.nextOccurrence)
            registered.expectedHighlights = highlights
            return highlights
        end },
        ["mods/presentation/room_guide.lua"] = { attach = function(target, inspection)
            lu.assertIs(target, module)
            lu.assertIs(inspection, runtime.roomGuideInspection)
            registered.guide = true
        end },
        ["mods/presentation/victory_summary.lua"] = { attach = function(target, inspection, overview)
            lu.assertIs(target, module)
            lu.assertIs(inspection, runtime.sessionInspection)
            lu.assertIs(overview, slotOverview)
            registered.victory = true
        end },
    }
    for path in pairs(failing) do
        for name in pairs(imports[path]) do
            imports[path][name] = function() error("planted presentation failure") end
        end
    end
    local environment = setmetatable({
        _PLUGIN = {
            guid = "adamantRunPlanner-Run_Planner", version = "1.2.3",
            config_mod_folder_path = "unused", plugins_mod_folder_path = "plugin-folder",
        },
        import_as_fallback = function() end,
        import = function(path) return assert(imports[path], path) end,
        rom = {
            game = {},
            log = { info = function(line) registered.logs[#registered.logs + 1] = line end },
            path = registered.pathApi,
            gui = {
                add_imgui = function(callback) registered.window = callback end,
                add_to_menu_bar = function(callback) registered.menu = callback end,
            },
            mods = {
                ["SGG_Modding-ENVY"] = { auto = function() end },
                ["SGG_Modding-ModUtil"] = { once_loaded = { game = function(callback) callback() end } },
                ["SGG_Modding-ReLoad"] = { auto_single = function()
                    return { load = function(_, initialize) initialize() end }
                end },
                ["adamant-ModpackLib"] = { createModule = function() return module end },
            },
        },
    }, { __index = _G })
    assert(loadfile("src/main.lua", "t", environment))()
    registered.drawTab = drawTab
    return registered
end

function TestHostBootstrap.testInspectorAttachesStandaloneGuiBeforeActivation()
    local registered = bootstrap()
    lu.assertTrue(registered.activated)
    lu.assertTrue(registered.executionAttached)
    lu.assertIs(registered.highlights, registered.expectedHighlights)
    lu.assertIs(registered.tab, registered.drawTab)
    lu.assertTrue(registered.guide)
    lu.assertTrue(registered.victory)
    lu.assertEquals(registered.logs, {})
end

function TestHostBootstrap.testFailingPresentationSurfacesLeaveExecutionAttached()
    local registered = bootstrap({
        ["mods/presentation/highlights/highlights.lua"] = true,
        ["mods/presentation/status_ui.lua"] = true,
        ["mods/presentation/room_guide.lua"] = true,
        ["mods/presentation/slot_overview.lua"] = true,
    })
    lu.assertTrue(registered.activated)
    lu.assertTrue(registered.executionAttached)
    lu.assertNil(registered.highlights)
    lu.assertNil(registered.tab)
    lu.assertNil(registered.guide)
    lu.assertNil(registered.victory)
    lu.assertEquals(#registered.logs, 5)
end
