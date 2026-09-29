-- Encounter selection, native encounter identity, and lifecycle contacts for
-- one active room occurrence. Encounter-owned outcomes attach beside this
-- boundary; native encounter names never recover a phase after selection.
local automatic = type(import) == "function" and import("mods/room/timeline/encounters/automatic.lua")
    or require("mods.room.timeline.encounters.automatic")
local boss = type(import) == "function" and import("mods/room/timeline/encounters/boss.lua")
    or require("mods.room.timeline.encounters.boss")
local hecate = type(import) == "function" and import("mods/room/timeline/encounters/hecate.lua")
    or require("mods.room.timeline.encounters.hecate")
local scylla = type(import) == "function" and import("mods/room/timeline/encounters/scylla.lua")
    or require("mods.room.timeline.encounters.scylla")
local cerberus = type(import) == "function" and import("mods/room/timeline/encounters/cerberus.lua")
    or require("mods.room.timeline.encounters.cerberus")
local eris = type(import) == "function" and import("mods/room/timeline/encounters/eris.lua")
    or require("mods.room.timeline.encounters.eris")
local arachne = type(import) == "function" and import("mods/room/timeline/encounters/arachne.lua")
    or require("mods.room.timeline.encounters.arachne")
local chronos = type(import) == "function" and import("mods/room/timeline/encounters/chronos.lua")
    or require("mods.room.timeline.encounters.chronos")
local typhon = type(import) == "function" and import("mods/room/timeline/encounters/typhon.lua")
    or require("mods.room.timeline.encounters.typhon")
local nemesis = type(import) == "function" and import("mods/room/timeline/encounters/nemesis.lua")
    or require("mods.room.timeline.encounters.nemesis")
local figLeaf = type(import) == "function" and import("mods/keepsakes/fig_leaf.lua")
    or require("mods.keepsakes.fig_leaf")
local thessaly = type(import) == "function" and import("mods/room/timeline/encounters/thessaly.lua")
    or require("mods.room.timeline.encounters.thessaly")
local generated = type(import) == "function" and import("mods/room/timeline/encounters/generated.lua")
    or require("mods.room.timeline.encounters.generated")
local compatibility = type(import) == "function" and import("mods/room/timeline/encounters/compatibility.lua")
    or require("mods.room.timeline.encounters.compatibility")

local hooks = {}

local function chooseForcedEncounter(base, currentRun, nativeRoom, args, declaration)
    if type(currentRun) ~= "table" or declaration == nil then return nil end
    local priorRunForce = currentRun.ForceNextEncounterData
    local priorGlobalForce = _G.ForceNextEncounter
    currentRun.ForceNextEncounterData = declaration
    _G.ForceNextEncounter = nil
    local ok, result = pcall(base, currentRun, nativeRoom, args)
    currentRun.ForceNextEncounterData = priorRunForce
    _G.ForceNextEncounter = priorGlobalForce
    if not ok then error(result, 0) end
    return result
end

function hooks.attach(module, session, getState, report, room, shipCombat, generatedEncounter, highlights)
    shipCombat = shipCombat or thessaly.create()
    generatedEncounter = generatedEncounter or generated.create()
    generatedEncounter.attach(module, session, getState, room)
    local encounterIndex
    local directEncounterSequences = setmetatable({}, { __mode = "k" })

    module.hooks.wrap("SetupRoomMultipleEncountersData", "run-planner-encounter-assembly", function(_, runtime,
        base, nativeRoom, args)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then return base(nativeRoom, args) end
        local restoreShipPhases = shipCombat.preparePhases(state, room, nativeRoom)
        encounterIndex = 0
        local ok, result = pcall(base, nativeRoom, args)
        encounterIndex = nil
        restoreShipPhases()
        if not ok then error(result, 0) end
        report(runtime)
        return result
    end)

    module.hooks.wrap("ChooseEncounter", "run-planner-encounter-choice", function(_, runtime, base, currentRun,
        nativeRoom, args)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then return base(currentRun, nativeRoom, args) end

        local phase, role
        if encounterIndex ~= nil then
            encounterIndex = encounterIndex + 1
            phase = room.encounterAt(state, encounterIndex, nativeRoom)
            role = compatibility.role(encounterIndex, true,
                type(nativeRoom) == "table" and type(nativeRoom.Encounters) == "table" and nativeRoom.Encounters[1])
        else
            local first = room.encounterAt(state, 1, nativeRoom)
            local second = room.encounterAt(state, 2, nativeRoom)
            local index = 1
            if second == nil then
                phase = first
            elseif type(nativeRoom) == "table" then
                local sequence = directEncounterSequences[nativeRoom]
                local occurrenceId = nativeRoom.__runPlannerExecutionRoomId
                if sequence == nil or sequence.occurrenceId ~= occurrenceId then
                    sequence = { index = 1, occurrenceId = occurrenceId, done = false }
                    directEncounterSequences[nativeRoom] = sequence
                end
                if not sequence.done then
                    index = sequence.index
                    phase = room.encounterAt(state, sequence.index, nativeRoom)
                    sequence.index = sequence.index + 1
                    if phase == nil then sequence.done = true end
                end
            end
            role = compatibility.role(index, false, type(nativeRoom) == "table" and nativeRoom.Encounter)
        end
        local declaration
        local gameValue = _G.game or game
        local declarations = gameValue and gameValue.EncounterData or nil
        if phase ~= nil then
            declaration = declarations and declarations[phase.encounterKey] or nil
        end
        local admitted = declaration ~= nil
        if phase and not declaration and session.diagnostic then
            session.diagnostic(state, "encounter-eligibility", {
                phase = phase.slotKey, encounterKey = phase.encounterKey,
                room = nativeRoom and nativeRoom.Name, reason = "missing-declaration",
            }, room.occurrence(state, nativeRoom))
        end
        do
            local eligible = gameValue and gameValue.IsEncounterEligible or _G.IsEncounterEligible
            if declaration then
                local ok, verdict = pcall(eligible, currentRun, nativeRoom, declaration, args)
                if not ok or not verdict then
                    admitted = false
                    if session.diagnostic then session.diagnostic(state, "encounter-eligibility", {
                        phase = phase.slotKey, encounterKey = phase.encounterKey,
                        room = nativeRoom and nativeRoom.Name,
                        reason = ok and "native-ineligible" or "native-check-error",
                        error = not ok and tostring(verdict) or nil,
                    }, room.occurrence(state, nativeRoom)) end
                end
            end
        end
        local function choose()
            return admitted
                and chooseForcedEncounter(base, currentRun, nativeRoom, args, declaration)
                or base(currentRun, nativeRoom, args)
        end
        -- withPhase also installs a neutral scope for nil/unsupported phases,
        -- so nested native setup cannot inherit an outer same-name override.
        local result = generatedEncounter.withPhase(state, room, admitted and phase or nil, nativeRoom, choose)
        if phase ~= nil and type(result) == "table" then
            local actual = compatibility.nativeName(result)
            local substituted = actual ~= phase.encounterKey
            local compatible, conflict = compatibility.compare(declarations, phase.encounterKey, actual, role)
            -- A later different native choice for an already carried phase is ambient.
            if substituted and room.encounterBound(state, phase.slotKey, nativeRoom) then
                return result
            elseif compatible then
                room.bindEncounter(state, result, phase.slotKey, nativeRoom, substituted and actual or nil)
            elseif session.diagnostic then
                session.diagnostic(state, "encounter-lifecycle", {
                    kind = "lifecycle-conflict", phase = phase.slotKey,
                    encounterKey = phase.encounterKey, observed = actual, conflict = conflict,
                }, room.occurrence(state, nativeRoom))
            end
        end
        return result
    end)

    module.hooks.wrap("StartEncounter", "run-planner-encounter-start", function(_, runtime, base, currentRun,
        nativeRoom, encounter)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then
            return base(currentRun, nativeRoom, encounter)
        end
        room.startEncounter(state, encounter)
        local result = base(currentRun, nativeRoom, encounter)
        report(runtime)
        return result
    end)

    module.hooks.wrap("EndEncounterEffects", "run-planner-encounter-end", function(_, runtime, base, currentRun,
        nativeRoom, encounter)
        local state = getState(runtime)
        if state == nil or state.state ~= "synchronized" then return base(currentRun, nativeRoom, encounter) end
        local phase = room.encounterPhase(state, encounter)
        local final = phase ~= nil and room.encounterIsFinal(state, encounter) or false
        if phase ~= nil then room.window(state, "encounterEnd:" .. phase.slotKey) end
        local result = base(currentRun, nativeRoom, encounter)
        if final then room.window(state, "afterCombat") end
        report(runtime)
        return result
    end)

    shipCombat.attach(module, session, getState, report, room, highlights)
    automatic.attach(module, session, getState, report, room)
    boss.attach(module, session, getState, report, room)
    hecate.attach(module, session, getState, report, room)
    scylla.attach(module, session, getState, report, room)
    cerberus.attach(module, session, getState, report, room)
    eris.attach(module, session, getState, report, room)
    arachne.attach(module, session, getState, report, room)
    chronos.attach(module, session, getState, report, room)
    typhon.attach(module, session, getState, report, room)
    nemesis.attach(module, session, getState, report, room)
    figLeaf.attach(module, getState, report, room)
end

return hooks
