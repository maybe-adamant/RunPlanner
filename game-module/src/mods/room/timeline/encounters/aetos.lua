-- Aetos is a biome-owned best-effort directive, not encounter composition or
-- conformance. Only the declaration's wave-start dispatch is adapted. Private
-- event copies remain safe while the native eagle callback yields.
local aetos = {}

local function copy(value)
    local result = {}
    for key, item in pairs(value or {}) do result[key] = item end
    return result
end

local function scopeFor(state, room, nativeRoom)
    if state == nil then return nil end
    if state.state ~= "synchronized" or state.plan == nil then
        state.aetos = nil
        return nil
    end
    local occurrence = room.occurrence(state, nativeRoom)
    -- Unrelated callbacks may lack a room carrier; they cannot erase a
    -- completed directive and accidentally rearm it later in Olympus.
    if occurrence == nil then return nil end
    if occurrence.biomeKey ~= "P" then
        state.aetos = nil
        return nil
    end
    local directive = state.plan.olympusAetos
    if directive == nil then state.aetos = nil; return nil end
    local scope = state.aetos
    if scope == nil or scope.plan ~= state.plan then
        scope = { plan = state.plan, directive = directive, released = false }
        state.aetos = scope
    end
    return scope, occurrence
end

local function release(scope, session, state, occurrence, reason)
    if scope.released then return end
    scope.released = true
    if reason and session.diagnostic then
        session.diagnostic(state, "aetos-appearance", {
            reason = reason, phase = scope.directive.phaseKey, wave = scope.directive.wave,
        }, occurrence)
    end
end

function aetos.attach(module, session, getState, report, room)
    module.hooks.wrap("RunEventsGeneric", "run-planner-aetos-wave", function(_, runtime, base,
        events, encounter, contextArgs)
        local state = getState(runtime)
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local scope, occurrence = scopeFor(state, room, nativeRoom)
        if scope == nil or type(encounter) ~= "table"
            or (scope.released and scope.failedEncounter ~= encounter) then
            return base(events, encounter, contextArgs)
        end
        local phase = room.encounterPhase(state, encounter)
        local gameValue = _G.game or game
        local declarations = gameValue and gameValue.EncounterData or _G.EncounterData
        local declaration = declarations and declarations[encounter.Name] or encounter
        if phase == nil or events == nil or events ~= declaration.WaveStartUnthreadedEvents then
            return base(events, encounter, contextArgs)
        end
        local directive = scope.directive
        local target = directive.kind == "target" and directive.occurrenceId == occurrence.id
            and directive.phaseKey == phase.slotKey
        if target and (type(encounter.SpawnWaves) ~= "table" or #encounter.SpawnWaves < directive.wave) then
            scope.failedEncounter = encounter
            release(scope, session, state, occurrence, "missing-actual-wave")
            report(runtime)
        end
        local attempt = not scope.released and target and encounter.CurrentWaveNum == directive.wave
        local adapted = copy(events)
        for index = #adapted, 1, -1 do
            local event = adapted[index]
            if event.FunctionName == "OlympusEagleSpawn" then
                if attempt then
                    local forced = copy(event)
                    forced.GameStateRequirements = copy(event.GameStateRequirements)
                    forced.GameStateRequirements.ChanceToPlay = nil
                    adapted[index] = forced
                else
                    table.remove(adapted, index)
                end
            end
        end
        -- There is no ambient override to restore, including on native errors.
        -- Mark the one attempt before dispatch so a nested contact cannot retry.
        if attempt then scope.released = true end
        local ok, result = pcall(base, adapted, encounter, contextArgs)
        if attempt and state.plan == scope.plan and state.aetos == scope
            and state.state == "synchronized" then
            scope.released = false
            local reason
            if not ok then reason = "native-error"
            elseif nativeRoom.OlympusEagleSpawn ~= true then reason = "native-ineligible-or-missed" end
            if reason then scope.failedEncounter = encounter end
            release(scope, session, state, occurrence, reason)
            report(runtime)
        end
        if not ok then error(result, 0) end
        return result
    end)

    module.hooks.wrap("LeaveRoom", "run-planner-aetos-exit", function(_, runtime, base, currentRun, door)
        local state = getState(runtime)
        local scope, occurrence = scopeFor(state, room, currentRun and currentRun.CurrentRoom)
        if scope and not scope.released and scope.directive.kind == "target"
            and scope.directive.occurrenceId == occurrence.id then
            release(scope, session, state, occurrence, "target-exited-without-appearance")
            report(runtime)
        end
        return base(currentRun, door)
    end)
end

return aetos
