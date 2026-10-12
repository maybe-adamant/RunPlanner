-- Exact screen/source-local markers; native hover and pins remain untouched.
local safeHooks = type(import) == "function" and import("mods/host/presentation_hooks.lua")
    or require("mods.host.presentation_hooks")
local guidance = {}

function guidance.create()
    local instance = {}
    local screens = setmetatable({}, { __mode = "k" })
    local sources = setmetatable({}, { __mode = "k" })
    local function enabled(runtime, state)
        return state and state.state == "synchronized" and runtime and runtime.data
            and runtime.data.read("HighlightPlannedChoices") == true
    end

    local function hide(screen)
        local context = screens[screen]
        if context and context.marker and _G.Destroy then
            pcall(_G.Destroy, { Ids = { context.marker.Id } })
        end
        if context then context.marker = nil end
        if type(screen) == "table" and type(screen.Components) == "table" then
            screen.Components.RunPlannerPlannedChoiceMarker = nil
        end
    end

    local function retire(screen)
        hide(screen)
        screens[screen] = nil
    end

    local function suspend(screen, reason)
        hide(screen)
        if screens[screen] then screens[screen][reason] = true end
    end

    local function valid(context, state)
        return state and state.state == "synchronized" and context.state == state
            and context.route == state.route
    end

    local function render(runtime, state, screen, context)
        if not valid(context, state) or context.source ~= screen.Source
            or not enabled(runtime, state) or context.marker or context.rebuilding or context.infoOpen then return end
        local matches = {}
        local buttons = screen.UpgradeButtons or {
            screen.Components and screen.Components.PurchaseButton1,
            screen.Components and screen.Components.PurchaseButton2,
            screen.Components and screen.Components.PurchaseButton3,
        }
        for _, button in ipairs(buttons) do
            local data = button and button.Data
            local key = context.chaos and data and data.OnExpire and data.OnExpire.TraitData
                and data.OnExpire.TraitData.Name or data and data.Name or button.TraitName
            if key == context.selected then
                matches[#matches + 1] = button
            end
        end
        if #matches ~= 1 or (matches[1].InteractBlocks and next(matches[1].InteractBlocks))
            or type(_G.CreateScreenComponent) ~= "function" or type(_G.Attach) ~= "function" then return end
        local ok, marker = pcall(_G.CreateScreenComponent, {
            Name = "BlankObstacle", Group = "Combat_Menu_Overlay", Animation = "StoreItemPin", Alpha = 1,
        })
        if not ok then return end
        if marker and type(_G.Attach) == "function" then
            -- Spell rows reuse the upgrade-choice button geometry, but their
            -- screen does not copy its pin offsets.
            local layout = screen.UpgradeButtons and screen
                or (_G.ScreenData and _G.ScreenData.UpgradeChoice) or screen
            local attached = pcall(_G.Attach, {
                Id = marker.Id, DestinationId = matches[1].Id,
                OffsetX = (layout.PinOffsetX or 0) - (layout.ButtonOffsetX or 0) - 24,
                OffsetY = layout.PinOffsetY or 0,
            })
            if not attached then
                if _G.Destroy then pcall(_G.Destroy, { Ids = { marker.Id } }) end
                return
            end
        end
        if marker then
            context.marker = marker
            screen.Components = screen.Components or {}
            screen.Components.RunPlannerPlannedChoiceMarker = marker
        end
    end

    function instance.present(runtime, state, screen, selected, chaos)
        retire(screen)
        if type(screen) ~= "table" or type(selected) ~= "string" then return end
        if not state or state.state ~= "synchronized" then return end
        local context = { state = state, route = state.route, source = screen.Source,
            selected = selected, chaos = chaos }
        screens[screen] = context
        render(runtime, state, screen, context)
    end

    function instance.bindSource(runtime, state, source, selected, chaos)
        if type(source) == "table" and type(selected) == "string" then
            sources[source] = {
                runtime = runtime, state = state, route = state and state.route, selected = selected, chaos = chaos,
            }
        end
    end

    function instance.constructed(runtime, screen, state)
        local context = type(screen) == "table" and sources[screen.Source] or nil
        if context then
            sources[screen.Source] = nil
            if valid(context, state or context.state) then
                instance.present(runtime, state or context.state, screen, context.selected, context.chaos)
            end
        end
    end

    function instance.clear(screen)
        if screen then
            if screen.Source then sources[screen.Source] = nil end
            retire(screen)
            return
        end
        for value in pairs(screens) do retire(value) end
        for value in pairs(sources) do sources[value] = nil end
    end

    function instance.refresh(runtime, state)
        for screen, context in pairs(screens) do
            if not valid(context, state) or context.source ~= screen.Source then
                retire(screen)
            elseif enabled(runtime, state) then
                render(runtime, state, screen, context)
            else
                hide(screen)
            end
        end
        for source, context in pairs(sources) do
            if not valid(context, state) then sources[source] = nil end
        end
    end

    function instance.attach(module, getState)
        local function suspendScreen(_, screen) suspend(screen, "rebuilding") end
        local function refreshRebuilt(runtime, screen)
            if screens[screen] then
                screens[screen].rebuilding = nil
                instance.refresh(runtime, getState(runtime))
            end
        end
        safeHooks.wrap(module, "AcceptAndCloseSpellScreen", "run-planner-highlight-spell-close", {
            before = function(_, screen) instance.clear(screen) end,
        })
        safeHooks.wrap(module, "CreateBoonLootButtons", "run-planner-highlight-source-screen", {
            before = suspendScreen,
            after = function(runtime, screen)
                instance.constructed(runtime, screen, getState(runtime))
                local context = screens[screen]
                if context then
                    context.rebuilding = nil
                    render(runtime, getState(runtime), screen, context)
                end
            end,
        })
        safeHooks.wrap(module, "CloseUpgradeChoiceScreen", "run-planner-highlight-choice-close", {
            before = function(_, screen) instance.clear(screen) end,
        })
        safeHooks.wrap(module, "TryUpgradeBoon", "run-planner-highlight-choice-rarify", {
            before = function(_, _, screen) suspend(screen, "rebuilding") end,
            after = function(runtime, _, screen) refreshRebuilt(runtime, screen) end,
        })
        safeHooks.wrap(module, "UpgradeChoiceScreenCloseBoonInfo", "run-planner-highlight-choice-boon-info", {
            after = function(runtime, _, args)
                if type(args) == "table" and screens[args.Screen] then
                    screens[args.Screen].infoOpen = nil
                    instance.refresh(runtime, getState(runtime))
                end
            end,
        })
        safeHooks.wrap(module, "AttemptOpenUpgradeChoiceBoonInfo", "run-planner-highlight-choice-boon-info-open", {
            before = function(_, screen) suspend(screen, "infoOpen") end,
        })
        safeHooks.wrap(module, "RerollBoonLoot", "run-planner-highlight-choice-reroll", {
            before = suspendScreen,
            after = refreshRebuilt,
        })
        safeHooks.wrap(module, "DestroyBoonLootButtons", "run-planner-highlight-choice-rows-destroy", {
            before = suspendScreen,
        })
        safeHooks.wrap(module, "DestroyBoonLootButton", "run-planner-highlight-choice-row-destroy", {
            before = suspendScreen,
        })
        safeHooks.wrap(module, "LeaveRoom", "run-planner-highlight-choice-room-leave", {
            before = function() instance.clear() end,
        })
    end
    return instance
end
return guidance
