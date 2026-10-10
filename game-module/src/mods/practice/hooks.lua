-- Practice mode start: native contacts that install the published start state
-- into a fresh run, check it at the start room, and keep the run out of
-- RunHistory. The keepsake equip and start-room creation contacts stay with
-- their loadout and room owners.
local install = type(import) == "function" and import("mods/practice/install.lua")
    or require("mods.practice.install")
local admission = type(import) == "function" and import("mods/room/conformance/admission.lua")
    or require("mods.room.conformance.admission")

local hooks = {}

local function roomName(value)
    return type(value) == "table" and (value.GenusName or value.Name) or nil
end

local function phase(state, expected)
    local practice = state and state.practiceStart
    return practice ~= nil and practice.phase == expected and _G.CurrentRun == state.admittedNativeRun
end

-- Install and self-check failures are executor faults: execution goes passive
-- and the run continues natively from the start room.
local function guarded(session, state, action, checkpoint)
    local ok, errorValue = pcall(action)
    if ok then return true end
    if type(errorValue) ~= "table" then
        errorValue = { outcome = "fault", checkpoint = "practice-start:" .. (checkpoint or "install"),
            observed = tostring(errorValue) }
    end
    session.fault(state, errorValue)
    return false
end

local function selfCheck(session, state, check)
    if state.state ~= "synchronized" then return end
    guarded(session, state, function()
        local ok, mismatch = check(state.plan.startState)
        if not ok then
            session.mismatch(state, type(mismatch) == "table" and mismatch or "practice-start:state",
                "matching start state", mismatch)
        end
    end, "self-check")
end

function hooks.attach(module, session, getState, report, loadout, hexTree)
    assert(type(loadout) == "table" and type(loadout.verifyCompleted) == "function", "loadout verification is required")
    assert(type(hexTree) == "table", "Hex Tree instance is required")

    -- Native StartNewRun reads the same args table it passes down.
    local startDepth, startArgs = 0, nil
    module.hooks.wrap("StartNewRun", "run-planner-practice-run", function(_, runtime, base, previousRun, args)
        args = args or {}
        local priorArgs = startArgs
        startDepth, startArgs = startDepth + 1, args
        local ok, result = pcall(base, previousRun, args)
        startDepth, startArgs = startDepth - 1, priorArgs
        if not ok then error(result, 0) end
        local state = getState(runtime)
        if startDepth == 0 and phase(state, "recorded") then
            -- The authored gold, after native StartNewRun credits its own.
            state.practiceStart.phase = "started"
            guarded(session, state, function() install.creditGold(state.plan.startState) end)
            report(runtime)
        end
        return result
    end)

    -- The loadout is complete once native StartNewRun has equipped the Arcana.
    -- Only a verified loadout is moved to the start room and installed.
    local function begin(state)
        local plan = state.plan
        local start = plan.startState
        if not install.supported(start) then
            session.mismatch(state, "practice-start:point", "opening", start.point)
            return
        end
        loadout.verifyCompleted(state, session.mismatch)
        if state.state ~= "synchronized" then return end
        local familiar = start.familiar and start.familiar.name or nil
        if familiar ~= _G.GameState.EquippedFamiliar then
            session.mismatch(state, "practice-start:familiar", familiar, _G.GameState.EquippedFamiliar)
            return
        end
        for key, value in pairs(install.runOverrides(start, plan.routeKey)) do _G.CurrentRun[key] = value end
        install.redirect(startArgs, start, plan.routeKey)
        state.practiceStart = { phase = "installing" }
        guarded(session, state, function()
            install.hero(start, {
                aspectKey = plan.startingLoadout.aspectKey,
                hexTree = hexTree,
                diagnostic = function(checkpoint, expected, observed)
                    session.modifierDiagnostic(state, checkpoint, { expected = expected, observed = observed })
                end,
            })
        end)
        state.practiceStart.phase = "installed"
    end

    module.hooks.wrap("EquipMetaUpgrades", "run-planner-practice-start", function(_, runtime, base, hero, args)
        local result = base(hero, args)
        local state = getState(runtime)
        if state ~= nil and startDepth > 0 and state.state == "starting" and state.plan
            and state.plan.startState ~= nil and state.practiceStart == nil then
            begin(state)
            report(runtime)
        end
        return result
    end)

    module.hooks.wrap("InitializeRewardStores", "run-planner-practice-records", function(_, runtime, base, run)
        local result = base(run)
        local state = getState(runtime)
        if startDepth > 0 and phase(state, "installed") then
            state.practiceStart.phase = "recorded"
            guarded(session, state, function() install.records(state.plan.startState) end)
            report(runtime)
        end
        return result
    end)

    -- The start room's forced first-room setup is read from the run itself, so
    -- it also applies after Save & Quit and while execution is passive.
    module.hooks.wrap("SetupHeroObject", "run-planner-practice-hero", function(_, runtime, base, room, applyLuaUpgrades)
        if not install.startRoom(_G.CurrentRun, room, applyLuaUpgrades) then
            return base(room, applyLuaUpgrades)
        end
        local result = install.heroSetup(base, room)
        -- The maxima are final here, the slotted Silver Wheel's grant included;
        -- the Intro's own room-start effects have not run.
        local state = getState(runtime)
        if phase(state, "started") and roomName(room) == state.plan.startState.roomName then
            state.practiceStart.phase = "entered"
            selfCheck(session, state, install.verifyMaxStats)
            report(runtime)
        end
        return result
    end)

    -- Room-start effects, including an Opening's biome-start keepsake effects,
    -- have run; player input and the encounter have not.
    module.hooks.wrap("StartRoomPresentation", "run-planner-practice-check", function(_, runtime, base, ...)
        local state = getState(runtime)
        if phase(state, "entered") then
            state.practiceStart.phase = "checked"
            selfCheck(session, state, function(start)
                return admission.verify(state.plan.occurrencesById[start.occurrenceId],
                    state.plan.startingLoadout, "practice-start")
            end)
            report(runtime)
        end
        return base(...)
    end)

    -- Native EndRun appends the ended run to RunHistory and strips the history
    -- by each run's distance from the end (SaveLogic.lua:197-205). A practice
    -- run is removed before that strip, and PrevRun becomes the last recorded
    -- run, as DoPatches sets it on load (PatchLogic.lua:13-17). Clear-time and
    -- depth records written during play remain.
    local endingPractice = false
    module.hooks.wrap("StripRunHistoryForSave", "run-planner-practice-strip", function(_, _, base, ...)
        if endingPractice then return nil end
        return base(...)
    end)
    module.hooks.wrap("EndRun", "run-planner-practice-history", function(_, _, base, currentRun)
        if type(currentRun) ~= "table" or currentRun[install.runFlag] ~= true then return base(currentRun) end
        endingPractice = true
        local ok, result = pcall(base, currentRun)
        endingPractice = false
        if not ok then error(result, 0) end
        local history = _G.GameState.RunHistory
        for index = #history, 1, -1 do
            if history[index] == currentRun then
                table.remove(history, index)
                break
            end
        end
        _G.GameState.CompletedRunsCache = #history
        _G.PrevRun = history[#history]
        _G.StripRunHistoryForSave()
        return result
    end)

    return {
        -- Native StartNewRun is creating the installed start room.
        creatingStartRoom = function(state, args)
            return startDepth > 0 and phase(state, "recorded") and type(args) == "table"
                and args.RoomName == state.plan.startState.roomName
        end,
    }
end

return hooks
