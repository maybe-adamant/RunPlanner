-- luacheck: globals TestHostBootstrap
local lu = require("luaunit")

TestHostBootstrap = {}

function TestHostBootstrap.testInspectorAttachesStandaloneGuiBeforeActivation()
    local registered = { pathApi = {} }
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
    local runtime = {
        attach = function(target) lu.assertIs(target, module) end,
        roomGuideInspection = function() end,
        sessionInspection = function() end,
        inboxInspection = {}, activeSlot = {}, slotOverview = {},
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
        ["mods/host/status_ui.lua"] = { bind = function(inbox, inspect, activeSlot, slotOverview)
            lu.assertIs(inbox, runtime.inboxInspection)
            lu.assertIs(inspect, runtime.sessionInspection)
            lu.assertIs(activeSlot, runtime.activeSlot)
            lu.assertIs(slotOverview, runtime.slotOverview)
            return { drawTab = drawTab }
        end },
        ["mods/room/guide.lua"] = { attach = function(target, inspection)
            lu.assertIs(target, module)
            lu.assertIs(inspection, runtime.roomGuideInspection)
        end },
        ["mods/host/victory_summary.lua"] = { attach = function(target, inspection, slotOverview)
            lu.assertIs(target, module)
            lu.assertIs(inspection, runtime.sessionInspection)
            lu.assertIs(slotOverview, runtime.slotOverview)
        end },
    }
    local environment = setmetatable({
        _PLUGIN = {
            guid = "adamantRunPlanner-Run_Planner", version = "1.2.3",
            config_mod_folder_path = "unused", plugins_mod_folder_path = "plugin-folder",
        },
        import_as_fallback = function() end,
        import = function(path) return assert(imports[path], path) end,
        rom = {
            game = {},
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
    lu.assertTrue(registered.activated)
    lu.assertIs(registered.tab, drawTab)
end
