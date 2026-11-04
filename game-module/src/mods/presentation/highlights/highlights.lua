-- Planned-choice markers. Execution notifies these entry points; they draw
-- markers on native objects and never steer or change execution state.
local world = type(import) == "function" and import("mods/presentation/highlights/world.lua")
    or require("mods.presentation.highlights.world")
local screen = type(import) == "function" and import("mods/presentation/highlights/choice_screen.lua")
    or require("mods.presentation.highlights.choice_screen")
local pathNodes = type(import) == "function" and import("mods/presentation/highlights/path_nodes.lua")
    or require("mods.presentation.highlights.path_nodes")
local storeScreens = type(import) == "function" and import("mods/presentation/highlights/store_screens.lua")
    or require("mods.presentation.highlights.store_screens")
local safeHooks = type(import) == "function" and import("mods/host/presentation_hooks.lua")
    or require("mods.host.presentation_hooks")
local highlights = {}

-- `roomGuide` is the read-only room guide inspection (occurrence, completion, Shrine progress);
-- `highlighted` reads the player's Highlight planned choices option.
function highlights.create(nextOccurrence, roomGuide, highlighted)
    assert(type(highlighted) == "function", "highlights require the Highlight planned choices option")
    local doors, choices, path = world.create(nextOccurrence, highlighted), screen.create(highlighted), pathNodes.create()
    local stores = storeScreens.create(roomGuide or function() return nil end, highlighted)
    local entries = {
        doors = doors.doors,
        hub = doors.hub,
        wheel = doors.wheel,
        clearWorld = doors.clear,
        retireWorld = doors.retire,
        screen = choices.present,
        bindSource = choices.bindSource,
        -- A Well, Shrine or Pool menu whose rows are built and bound.
        store = stores.present,
        -- `depth:slot` node keys of the Path screen now open, or nil to clear.
        pathNodes = path.plan,
    }
    local function enabled(_, state)
        return state ~= nil and state.state == "synchronized" and highlighted() == true
    end
    function entries.refresh(runtime, state)
        doors.refresh(runtime, state)
        choices.refresh(runtime, state)
        stores.refresh(runtime, state)
        path.refreshOpen(enabled(runtime, state))
    end
    function entries.attach(module, getState)
        choices.attach(module, getState)
        stores.attach(module, getState)
        -- The option changes in the window or the planner; markers follow it at once.
        if module.overlays then
            local shown = highlighted() == true
            safeHooks.onInterval(module, "run-planner-highlight-option", 0.25, function(_, runtime)
                local now = highlighted() == true
                if now == shown then return end
                shown = now
                entries.refresh(runtime, getState(runtime))
            end)
        end
        safeHooks.wrap(module, "UpdateTalentButtons", "run-planner-path-planned-nodes", {
            after = function(runtime, talentScreen)
                path.refresh(talentScreen, enabled(runtime, getState(runtime)))
            end,
        })
        local mapOpen = false
        safeHooks.wrap(module, "EphyraZoomOut", "run-planner-highlight-hub-map", {
            before = function() mapOpen = true end,
            cleanup = function() mapOpen = false end,
        })
        safeHooks.wrap(module, "PopulateDoorRewardPreviewSubIcons", "run-planner-highlight-hub-map-icons", {
            decorate = function(runtime, icons, door)
                if mapOpen then return doors.mapIcons(runtime, getState(runtime), door, icons) end
                return nil
            end,
        })
        safeHooks.wrap(module, "RemoveRoomRewardPreviews", "run-planner-highlight-previews-remove", {
            before = function() doors.clear() end,
        })
        safeHooks.wrap(module, "LeaveRoom", "run-planner-highlight-world-leave", {
            before = function()
                mapOpen = false
                doors.clear()
                stores.clear()
            end,
        })
        safeHooks.wrap(module, "StartRoom", "run-planner-highlight-room-start", {
            before = function()
                mapOpen = false
                doors.clear()
                choices.clear()
                stores.clear()
            end,
        })
    end
    -- Execution calls these entry points; a presentation failure never reaches it.
    local instance = {}
    for name, entry in pairs(entries) do instance[name] = safeHooks.guard("highlights." .. name, entry) end
    return instance
end

return highlights
