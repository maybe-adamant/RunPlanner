-- Focused execution boundary for NPC trait menus. Native menu construction,
-- option-specific preparation, selection, and trait acquisition stay native;
-- this adapter installs the published offer and binds the exact selection.
-- Native drop production and other selected-trait effects remain pass-through.
local adapter = type(import) == "function" and import("mods/room/timeline/acquisitions/npc/trait_offer.lua")
    or require("mods.room.timeline.acquisitions.npc.trait_offer")
local screenChecks = type(import) == "function"
        and import("mods/room/timeline/acquisitions/traits/screen_checks.lua")
    or require("mods.room.timeline.acquisitions.traits.screen_checks")

local npc = {}

local function copy(value)
    local result = {}
    for key, item in pairs(value or {}) do result[key] = item end
    return result
end

local function copyInvocationArgs(args)
    if type(args) ~= "table" then return args end
    local result = copy(args)
    if type(args.UpgradeOptions) == "table" then
        result.UpgradeOptions = {}
        for index, option in ipairs(args.UpgradeOptions) do
            result.UpgradeOptions[index] = copy(option)
        end
    end
    if type(args.PortraitShift) == "table" then result.PortraitShift = copy(args.PortraitShift) end
    return result
end

local function encounterHandle(room, state, source)
    return type(room.encounterHandle) == "function" and room.encounterHandle(state, source) or nil
end

function npc.attach(module, session, getState, report, room, highlights, rowOptions)
    assert(type(rowOptions) == "table", "NPC row options are required")
    local choices = setmetatable({}, { __mode = "k" })
    local activeSelection
    local selectionObservers = {}

    local function installInput(scope, args)
        if scope.payload == nil then return false end
        -- Install before the named NPC callback so native option-specific work
        -- (for example Circe's familiar preparation) sees the authored rows.
        return adapter.applyNpcTraitOffer(scope.payload, args, rowOptions)
    end

    local rarityScope

    local function plannedKeys(scope)
        local keys = {}
        local offer = scope.payload.transaction.resolution.offer
        for index, option in ipairs(offer.options or {}) do keys[index] = option.key end
        return keys
    end

    local function nativeKeys(options)
        local keys = {}
        for _, option in ipairs(type(options) == "table" and options or {}) do
            if type(option) == "table" then keys[#keys + 1] = option.ItemName end
        end
        return keys
    end

    local function reportUnavailable(scope, options)
        session.mismatch(scope.state, "npc-trait-offer", plannedKeys(scope), nativeKeys(options))
    end

    -- Native NPC choices may swap a non-Common row after a failed rarity roll.
    module.hooks.wrap("PassRarityCheck", "run-planner-npc-rarity", function(_, _, base, rarityName)
        if rarityScope ~= nil and rarityScope.forceRarity then return true end
        return base(rarityName)
    end)

    local function attachChoice(functionName, giver)
        module.hooks.wrap(functionName, "run-planner-npc-entry", function(_, runtime, base, source,
            args, screen)
            local state = getState(runtime)
            local current = room.current(state)
            local handle = encounterHandle(room, state, source)
            local payload = handle and room.begin(state, handle) or nil
            local resolution = payload and payload.transaction.resolution
            local invocationArgs = args
            if current ~= nil and resolution and resolution.kind == "traitOffer"
                and resolution.offer.giver == giver then
                local installed = copyInvocationArgs(args)
                local scope = {
                    state = state, current = current, handle = handle, payload = payload,
                }
                if screenChecks.report(session, state,
                    screenChecks.expectation(resolution.offer.expectation, source)) then
                    report(runtime)
                    return base(source, args, screen)
                end
                if not installInput(scope, installed) then
                    reportUnavailable(scope, args and args.UpgradeOptions)
                else
                    local ineligible, nativeError = screenChecks.npcRows(installed.UpgradeOptions, source)
                    if nativeError ~= nil then
                        session.fault(state, {
                            outcome = "fault", checkpoint = "native-api", expected = "IsGameStateEligible",
                            observed = nativeError,
                        })
                    elseif ineligible ~= nil then
                        session.mismatch(state, "npc-trait-requirements", ineligible, "native-ineligible")
                    else
                        scope.steered = true
                        invocationArgs = installed
                        choices[source] = scope
                    end
                end
            end
            local scope = invocationArgs ~= args and choices[source] or nil
            local priorRarity = rarityScope
            if scope ~= nil then
                scope.forceRarity = true
                rarityScope = scope
            end
            local ok, result = pcall(base, source, invocationArgs, screen)
            if scope ~= nil then
                scope.forceRarity = false
                if rarityScope == scope then rarityScope = priorRarity end
            end
            if not ok then error(result, 0) end
            report(runtime)
            return result
        end)
    end

    attachChoice("ArachneCostumeChoice", "Arachne")
    attachChoice("NarcissusBenefitChoice", "Narcissus")
    attachChoice("MedeaCurseChoice", "Medea")
    attachChoice("CirceBlessingChoice", "Circe")
    attachChoice("IcarusBenefitChoice", "Icarus")
    attachChoice("EchoChoice", "Echo")

    module.hooks.wrap("OpenUpgradeChoiceMenu", "run-planner-npc-menu", function(_, runtime, base, source, args)
        local scope = choices[source]
        if scope ~= nil then
            -- Native rarity re-picks finish before the menu opens.
            scope.forceRarity = false
            -- Native selection may reorder the three rows. Reapply the same
            -- authored set at the shared menu contact after native preparation.
            if not adapter.applyNpcTraitOffer(scope.payload, source, rowOptions) then
                reportUnavailable(scope, source and source.UpgradeOptions)
                choices[source] = nil
                scope = nil
            end
        end
        local expected = adapter.expectedTrait(scope and scope.payload)
        if highlights and expected then highlights.bindSource(runtime, getState(runtime), source, expected.key, false) end
        local result = base(source, args)
        report(runtime)
        return result
    end)

    module.hooks.wrap("HandleUpgradeChoiceSelection", "run-planner-npc-selection", function(_, runtime,
        base, screen, button, args)
        local source = screen and screen.Source
        local scope = choices[source]
        if scope == nil then return base(screen, button, args) end

        local selected = button and button.Data and button.Data.Name
        local expected = adapter.expectedTrait(scope.payload)
        local exact = expected ~= nil and expected.key == selected
        local prior = activeSelection
        local deferCompletion = false
        if exact and scope.steered then
            scope.selectedOption = expected
            activeSelection = scope
            local observer = selectionObservers[expected.key]
            if observer ~= nil then deferCompletion = observer(scope) == true end
        end
        local ok, result = pcall(base, screen, button, args)
        activeSelection = prior
        if not ok then error(result, 0) end
        if not deferCompletion then
            session.complete(scope.state, scope.handle)
        end
        choices[source] = nil
        report(runtime)
        return result
    end)

    return {
        current = function(giver)
            if activeSelection == nil then return nil end
            local resolution = activeSelection.payload and activeSelection.payload.transaction.resolution
            local offer = resolution and resolution.kind == "traitOffer" and resolution.offer
            if offer == nil or offer.giver ~= giver then return nil end
            return activeSelection
        end,
        observeSelection = function(traitKey, observer)
            selectionObservers[traitKey] = observer
        end,
    }
end

return npc
