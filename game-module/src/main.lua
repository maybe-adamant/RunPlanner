-- Run Planner's game companion consumes the application's execution-only JSON.
-- It freezes a decoded plan at StartNewRun and never imports planner code.
-- luacheck: globals rom import_as_fallback modutil lib _PLUGIN game reload import

local mods = rom.mods
mods["SGG_Modding-ENVY"].auto()

rom = rom
_PLUGIN = _PLUGIN
game = rom.game
modutil = mods["SGG_Modding-ModUtil"]
reload = mods["SGG_Modding-ReLoad"]
lib = mods["adamant-ModpackLib"]

-- A presentation surface that fails to load or attach is logged and skipped;
-- execution attaches regardless.
local function presentationSurface(name, build)
    local ok, value = pcall(build)
    if ok then return value end
    if rom.log and rom.log.info then
        rom.log.info("[RunPlanner] presentation " .. name .. " unavailable: " .. tostring(value))
    end
    return nil
end

local function initialize()
    import_as_fallback(rom.game)
    local data = import("mods/host/data.lua")
    local runtime = import("mods/runtime/composition.lua").bind(_PLUGIN.config_mod_folder_path, _PLUGIN.version)
    local protocol = import("mods/protocol/decoder.lua")
    -- The only execution file that imports mods/presentation: presentation receives
    -- read-only views plus the status window's slot-picker capabilities.
    local slotOverview = presentationSurface("slot overview", function()
        return import("mods/presentation/slot_overview.lua").create(_PLUGIN.config_mod_folder_path, rom.path,
            protocol.matchesVersion)
    end)
    local highlights = presentationSurface("highlights", function()
        return import("mods/presentation/highlights/highlights.lua").create(runtime.nextOccurrence, runtime.roomGuideInspection)
    end)
    local module = lib.createModule({
        pluginGuid = _PLUGIN.guid,
        modpack = "run-planner",
        id = "Run_Planner",
        name = "Run Planner",
        shortName = "Run Planner",
        tooltip = "Play a run planned in the Run Planner application.",
    })
    if not module then return end
    module.data.define(data.buildStorage())
    local statusWindow = presentationSurface("status window", function()
        import("mods/presentation/status_ui.lua").attach(module, runtime.inboxInspection,
            runtime.sessionInspection, runtime.activeSlot, slotOverview)
        return true
    end)
    -- Lib activates only with a declared tab, so a failed window leaves an empty one.
    if not statusWindow then module.ui.tab(function() end) end
    presentationSurface("room guide", function()
        import("mods/presentation/room_guide.lua").attach(module, runtime.roomGuideInspection)
    end)
    presentationSurface("victory summary", function()
        import("mods/presentation/victory_summary.lua").attach(module, runtime.sessionInspection, slotOverview)
    end)
    runtime.attach(module, highlights)
    module.fallbackUi.attachGuiOnce(function(fallbackUi)
        rom.gui.add_imgui(fallbackUi.renderWindow)
        rom.gui.add_to_menu_bar(fallbackUi.addMenuBar)
    end)
    module.activate()
end

local loader = reload.auto_single()
modutil.once_loaded.game(function() loader.load(nil, initialize) end)
