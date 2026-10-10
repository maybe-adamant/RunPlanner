-- Thin coordinator for the current route and room execution protocol. Semantic
-- comparison stays in the native fact adapters; this module only propagates
-- their exact owner contacts and the first mismatch that disables enforcement.
local route = type(import) == "function" and import("mods/route/session.lua")
    or require("mods.route.session")
local room = type(import) == "function" and import("mods/room/coordinator.lua")
    or require("mods.room.coordinator")
local conformance = type(import) == "function" and import("mods/room/conformance/readers.lua")
    or require("mods.room.conformance.readers")

local runtime = {}
local maxDiagnostics = 16

function runtime.create()
    return {
        initialized = false,
        state = "inactive",
        reason = "not-started",
        diagnostics = {},
    }
end

local function fail(state, errorValue, expected, observed)
    if state.firstMismatch == nil then
        state.firstMismatch = type(errorValue) == "table" and errorValue or {
            checkpoint = errorValue, expected = expected, observed = observed,
        }
    end
    state.state, state.reason = "desynchronized", "first-mismatch"
    local routeState = state.route
    if routeState and routeState.firstMismatch == nil then routeState.firstMismatch = state.firstMismatch end
    return nil, state.firstMismatch
end

function runtime.status(state)
    local record = state.firstMismatch or state.firstFault or state.admissionError
    return {
        state = state.state, reason = state.reason,
        checkpoint = record and record.checkpoint,
    }
end

function runtime.mismatch(state, checkpoint, expected, observed)
    state.aetos = nil
    if type(checkpoint) == "table" and checkpoint.outcome == "fault" then
        return runtime.fault(state, checkpoint, expected, observed)
    end
    if state.firstFault ~= nil then return nil, state.firstFault end
    if state.state ~= "desynchronized" and state.room ~= nil then room.dispose(state) end
    return fail(state, checkpoint, expected, observed)
end

-- Faults are executor/host contract failures, never evidence that an admitted
-- run diverged.  They make enforcement passive just like a mismatch so hooks
-- can still call native code, but retain a separate reporting product.
function runtime.fault(state, errorValue, expected, observed)
    state.aetos = nil
    if state.firstMismatch ~= nil then return nil, state.firstMismatch end
    if state.firstFault == nil then
        state.firstFault = type(errorValue) == "table" and errorValue or {
            outcome = "fault", checkpoint = errorValue, expected = expected, observed = observed,
        }
        state.firstFault.outcome = "fault"
        state.firstFault.traceback = debug.traceback("", 2)
    end
    if state.room ~= nil then room.dispose(state) end
    state.state, state.reason = "faulted", "executor-fault"
    return nil, state.firstFault
end

-- No selected execution document was admitted, so this is intentionally not
-- the terminal run-mismatch transition.
function runtime.rejectAdmission(state, checkpoint, expected, observed)
    if state.admissionError == nil then
        state.admissionError = type(checkpoint) == "table" and checkpoint or {
            checkpoint = checkpoint, expected = expected, observed = observed,
        }
    end
    state.initialized = false
    state.state, state.reason = "inactive", "admission-rejected"
    return nil, state.admissionError
end

local function reset(state)
    if state.room ~= nil then room.dispose(state) end
    state.initialized = false
    state.state = "inactive"
    state.plan = nil
    state.admittedNativeRun = nil
    state.modifierDiagnostics = nil
    state.aetos = nil
    state.planSlot = nil
    state.loggedSession = nil
    state.route = nil
    state.room = nil
    state.firstMismatch = nil
    state.firstFault = nil
    state.loggedFault = nil
    state.admissionError = nil
    state.loggedMismatch = nil
    state.loggedAdmission = nil
    state.practiceStart = nil
    state.diagnostics = {}
    state.reason = "not-started"
    return state
end

function runtime.beginNewRun(state)
    return reset(state)
end

-- A run loaded into a fresh process is never re-attached; it continues
-- unsteered. The installed loadout and its restore still follow the saved run.
function runtime.resumeUnsteered(state)
    if state.initialized or state.reason ~= "not-started" then return false end
    state.reason = "resumed-unsteered"
    return true
end

local function nativeRunModeMatches(plan)
    local dream = _G.CurrentRun ~= nil and _G.CurrentRun.IsDreamRun == true
    return (plan.routeKey == "Dream") == dream
end

-- Context: freshSave when native StartNewGame starts the run, chaosTrial while
-- a Chaos Trial holds its own loadout, restoreError when the previous run's
-- profile could not be restored.
function runtime.start(state, inbox, phase, activeSlot, context)
    context = context or {}
    reset(state)
    state.initialized = true
    if context.restoreError ~= nil then
        return runtime.rejectAdmission(state, "loadout-restore", "restored profile loadout",
            tostring(context.restoreError))
    end
    if context.chaosTrial then
        return runtime.rejectAdmission(state, "chaos-trial", "no active Chaos Trial", "active Chaos Trial")
    end
    local loaded, plan = inbox.load(activeSlot)
    if not loaded or type(plan) ~= "table" or plan.kind ~= "ready" then
        local inboxStatus = inbox.status and inbox.status() or nil
        local observed = inboxStatus and inboxStatus.error or plan
        return runtime.rejectAdmission(state, "run-start", "ready execution plan", observed)
    end
    if not nativeRunModeMatches(plan) then
        return runtime.rejectAdmission(state, "run-mode", plan.routeKey, {
            isDreamRun = _G.CurrentRun and _G.CurrentRun.IsDreamRun == true,
        })
    end
    -- A Fresh File route is the first run of a brand-new save.
    if plan.routeKey == "FreshFile" and not context.freshSave then
        return runtime.rejectAdmission(state, "fresh-file", "brand-new save", "existing save")
    end
    for _, occurrence in ipairs(plan.occurrences) do
        for _, fact in ipairs((occurrence.roomExitConformance or {}).facts or {}) do
            if not conformance.supports(fact.kind) then
                return runtime.rejectAdmission(state, "room-exit-conformance",
                    "reachable conformance reader", fact.kind)
            end
        end
    end
    -- A Practice mode start begins at its start occurrence; earlier
    -- occurrences are never realized.
    local routeState = route.new(plan)
    if plan.startState ~= nil then
        local index, routeError
        for candidate, id in ipairs(plan.selectedOccurrenceIds) do
            if id == plan.startState.occurrenceId then index = candidate break end
        end
        routeState, routeError = route.newAt(plan, index)
        if routeState == nil then return runtime.fault(state, routeError) end
    end
    state.plan = plan
    state.admittedNativeRun = _G.CurrentRun
    state.planSlot = activeSlot
    state.route = routeState
    state.room = room.new(plan, function(errorValue, expected, observed)
        return runtime.mismatch(state, errorValue, expected, observed)
    end, {
        onFault = function(errorValue, expected, observed)
            return runtime.fault(state, errorValue, expected, observed)
        end,
        diagnostic = function(checkpoint, observed, owner)
            return runtime.diagnostic(state, checkpoint, observed, owner)
        end,
        readConformance = function(kind, currentRun, gameState, expected)
            return conformance.read(kind, currentRun, gameState, expected)
        end,
    })
    state.state, state.reason = phase == "starting" and "starting" or "synchronized", "ready"
    return true
end

function runtime.complete(state, handle)
    return room.complete(state, handle)
end

function runtime.automatic(state, effect, phaseKey)
    local current = room.current(state)
    if current == nil then return nil end
    local handle = room.resolve(state, current, { kind = "automatic", effect = effect, phaseKey = phaseKey })
    if handle == nil then return room.incidental(state) end
    local payload = room.begin(state, handle)
    if payload == nil then return nil end
    return runtime.complete(state, handle)
end

function runtime.diagnostic(state, checkpoint, observed, occurrence)
    if state == nil or state.state ~= "synchronized" then return true end
    local current = room.current(state)
    occurrence = occurrence or current and current.occurrence
    if occurrence == nil then return true end
    local expected = occurrence.diagnostics and occurrence.diagnostics[checkpoint]
    local diagnostics = state.diagnostics or {}
    state.diagnostics = diagnostics
    if #diagnostics >= maxDiagnostics then table.remove(diagnostics, 1) end
    diagnostics[#diagnostics + 1] = {
        occurrenceId = occurrence.id, checkpoint = checkpoint,
        expected = expected, observed = observed,
    }
    return true
end

-- Run-wide diagnostics alone remain available after the configured prefix.
function runtime.modifierDiagnostic(state, checkpoint, observed)
    if state == nil then return true end
    state.modifierDiagnostics = state.modifierDiagnostics or {}
    if state.modifierDiagnostics[checkpoint] then return true end
    state.modifierDiagnostics[checkpoint] = true
    local diagnostics = state.diagnostics
    if #diagnostics >= maxDiagnostics then table.remove(diagnostics, 1) end
    diagnostics[#diagnostics + 1] = { checkpoint = checkpoint, observed = observed }
    return true
end

function runtime.readConformance(kind, currentRun, gameState, expected)
    return conformance.read(kind, currentRun, gameState, expected)
end

return runtime
