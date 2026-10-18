-- Planned-row markers on the Stygian Well, Hermes Shrine and Purging Pool menus.
-- These screens have no native pin; markers are owned components, never GameState pins.
local safeHooks = type(import) == "function" and import("mods/host/presentation_hooks.lua")
    or require("mods.host.presentation_hooks")
local stores = {}

-- The Shrine's rush sticker occupies the native pin corner, so its marker sits left of the icon.
local SHRINE_OFFSET_X = -580

local function rowButtons(screen)
    local buttons = {}
    for key, button in pairs(type(screen.Components) == "table" and screen.Components or {}) do
        if type(key) == "string" and key:match("^PurchaseButton%d+$") and type(button) == "table" then
            buttons[#buttons + 1] = button
        end
    end
    return buttons
end

-- Only the next planned purchase in authored order: the room's first purchase
-- can trigger a Travel Deal refill, so buying out of order desynchronizes.
local function plannedKeys(guide, kind)
    local occurrence = guide and guide.occurrence
    for _, row in ipairs(occurrence and occurrence.roomGuide or {}) do
        local description = row.description or {}
        local open = row.transactionOwner == nil or guide.isCompleted(row.transactionOwner) ~= true
        if kind == "well" and description.kind == "purchaseStygianWellOffer" and open then
            return { [description.generationKey] = true }
        elseif kind == "pool" and description.kind == "sellPurgingPoolTrait" and open then
            return { [description.traitKey] = true }
        elseif kind == "shrine" and description.kind == "purchaseHermesShrineOffer" then
            local progress = guide.shrineProgress(description.generationKey)
            if progress == "pending" or (progress == "purchased" and description.rushed == true) then
                return { [description.generationKey] = true }
            end
        end
    end
    return {}
end

local function buttonKey(kind, button)
    if kind == "pool" then
        -- A sold row keeps fading on screen without its press handler.
        return button.OnPressedFunctionName ~= nil and button.UpgradeName or nil
    end
    local data = button.Data
    if type(data) ~= "table" or (kind == "shrine" and data.__runPlannerShrine ~= true) then return nil end
    return data.__runPlannerGenerationKey
end

local function offsets(kind)
    local layout = _G.ScreenData and _G.ScreenData.UpgradeChoice or {}
    local pinX = (layout.PinOffsetX or 0) - (layout.ButtonOffsetX or 0) - 24
    return kind == "shrine" and SHRINE_OFFSET_X or pinX, layout.PinOffsetY or 0
end

function stores.create(guideView)
    local instance = {}
    local screens = setmetatable({}, { __mode = "k" })

    local function enabled(runtime, state)
        return state and state.state == "synchronized" and runtime and runtime.data
            and runtime.data.read("HighlightPlannedChoices") == true
    end

    local function valid(context, state)
        return state and state.state == "synchronized" and context.state == state
            and context.route == state.route
    end

    local function destroy(screen, context, buttonId)
        local entry = context.markers[buttonId]
        context.markers[buttonId] = nil
        if _G.Destroy then pcall(_G.Destroy, { Ids = { entry.marker.Id } }) end
        if type(screen.Components) == "table" then screen.Components[entry.key] = nil end
    end

    local function hide(screen)
        local context = screens[screen]
        if not context then return end
        for buttonId in pairs(context.markers) do destroy(screen, context, buttonId) end
    end

    local function retire(screen)
        hide(screen)
        screens[screen] = nil
    end

    local function render(runtime, state, screen, context)
        if not valid(context, state) or not enabled(runtime, state) or context.suspended then return end
        local keys = plannedKeys(guideView(), context.kind)
        local matches, counts = {}, {}
        for _, button in ipairs(rowButtons(screen)) do
            local key = buttonKey(context.kind, button)
            if key ~= nil and keys[key] then
                counts[key] = (counts[key] or 0) + 1
                matches[#matches + 1] = { key = key, button = button }
            end
        end
        local wanted = {}
        for _, match in ipairs(matches) do
            if counts[match.key] == 1 and match.button.Id ~= nil then wanted[match.button.Id] = match.button end
        end
        for buttonId in pairs(context.markers) do
            if not wanted[buttonId] then destroy(screen, context, buttonId) end
        end
        if type(_G.CreateScreenComponent) ~= "function" or type(_G.Attach) ~= "function" then return end
        local offsetX, offsetY = offsets(context.kind)
        for buttonId in pairs(wanted) do
            if not context.markers[buttonId] then
                local ok, marker = pcall(_G.CreateScreenComponent, {
                    Name = "BlankObstacle", Group = "Combat_Menu_Overlay", Animation = "StoreItemPin", Alpha = 1,
                })
                if ok and marker then
                    if pcall(_G.Attach, { Id = marker.Id, DestinationId = buttonId,
                        OffsetX = offsetX, OffsetY = offsetY }) then
                        local key = "RunPlannerPlannedStoreMarker" .. tostring(buttonId)
                        context.markers[buttonId] = { marker = marker, key = key }
                        screen.Components = screen.Components or {}
                        screen.Components[key] = marker
                    elseif _G.Destroy then
                        pcall(_G.Destroy, { Ids = { marker.Id } })
                    end
                end
            end
        end
    end

    -- Native rows for `kind` ("well", "shrine" or "pool") are built and bound.
    function instance.present(runtime, state, screen, kind)
        if type(screen) ~= "table" then return end
        local context = screens[screen]
        if context == nil or not valid(context, state) or context.kind ~= kind then
            retire(screen)
            if not state or state.state ~= "synchronized" then return end
            context = { state = state, route = state.route, kind = kind, markers = {} }
            screens[screen] = context
        end
        context.suspended = nil
        render(runtime, state, screen, context)
    end

    function instance.clear(screen)
        if screen then return retire(screen) end
        for value in pairs(screens) do retire(value) end
    end

    function instance.refresh(runtime, state)
        for screen, context in pairs(screens) do
            if not valid(context, state) then
                retire(screen)
            elseif enabled(runtime, state) then
                render(runtime, state, screen, context)
            else
                hide(screen)
            end
        end
    end

    function instance.attach(module, getState)
        local function suspend(_, screen)
            hide(screen)
            if screens[screen] then screens[screen].suspended = true end
        end
        local function resume(runtime, screen)
            local context = screens[screen]
            if context then
                context.suspended = nil
                render(runtime, getState(runtime), screen, context)
            end
        end
        local action = { before = suspend, after = resume }
        safeHooks.wrap(module, "DestroyStoreButtons", "run-planner-highlight-store-rows-destroy",
            { before = suspend })
        safeHooks.wrap(module, "SellTraitScreenDestroyButtons", "run-planner-highlight-pool-rows-destroy",
            { before = suspend })
        safeHooks.wrap(module, "HandleStorePurchase", "run-planner-highlight-well-purchase", action)
        safeHooks.wrap(module, "HandleSurfaceShopAction", "run-planner-highlight-shrine-action", action)
        safeHooks.wrap(module, "HandleSellChoiceSelection", "run-planner-highlight-pool-sale", action)
        safeHooks.wrap(module, "CloseStoreScreen", "run-planner-highlight-store-close", {
            before = function(_, screen) instance.clear(screen) end,
        })
    end
    return instance
end

return stores
