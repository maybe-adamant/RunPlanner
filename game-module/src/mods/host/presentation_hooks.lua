-- The build-covered hook boundary for the presentation layer: the only way it
-- registers native hooks or overlay callbacks, or exposes entry points to
-- execution. Native base always runs with its original arguments and returns
-- its results unchanged, except the allowlisted map sub-icon decoration;
-- presentation work runs under pcall, logs once per key on failure, and never
-- throws into the native chain or into execution.
local safeHooks = {}

-- Native functions whose first result presentation may extend for display.
local DECORATED = { PopulateDoorRewardPreviewSubIcons = true }

local reported = {}

local function report(key, failure)
    if reported[key] then return end
    reported[key] = true
    if rom and rom.log and rom.log.info then
        rom.log.info("[RunPlanner] presentation " .. tostring(key) .. " failed: " .. tostring(failure))
    end
end

-- Returns fn guarded: a failure is logged once and yields nothing.
function safeHooks.guard(key, fn)
    assert(type(fn) == "function", "presentation guard needs a function")
    return function(...)
        local results = table.pack(pcall(fn, ...))
        if not results[1] then
            report(key, results[2])
            return nil
        end
        return table.unpack(results, 2, results.n)
    end
end

-- handlers.before(runtime, ...) runs before base and handlers.after(runtime, ...)
-- after it, both receiving base's live arguments (the same table references). handlers.decorate(runtime, result, ...)
-- may replace base's first result with a table for display only; a failure or
-- non-table answer keeps base's result. handlers.cleanup(runtime, ...) runs
-- after base even when base throws; base's error value is then rethrown.
function safeHooks.wrap(module, path, key, handlers)
    if handlers.decorate and not DECORATED[path] then
        error("presentation may not decorate the result of " .. tostring(path), 2)
    end
    local before = handlers.before and safeHooks.guard(key, handlers.before)
    local after = handlers.after and safeHooks.guard(key, handlers.after)
    local decorate = handlers.decorate and safeHooks.guard(key, handlers.decorate)
    local cleanup = handlers.cleanup and safeHooks.guard(key, handlers.cleanup)
    module.hooks.wrap(path, key, function(_, runtime, base, ...)
        if before then before(runtime, ...) end
        local results
        if cleanup then
            local outcome = table.pack(pcall(base, ...))
            cleanup(runtime, ...)
            if not outcome[1] then error(outcome[2], 0) end
            results = table.pack(table.unpack(outcome, 2, outcome.n))
        else
            results = table.pack(base(...))
        end
        if after then after(runtime, ...) end
        if decorate then
            local replacement = decorate(runtime, results[1], ...)
            if type(replacement) == "table" then
                results[1], results.n = replacement, math.max(results.n, 1)
            end
        end
        return table.unpack(results, 1, results.n)
    end)
end

function safeHooks.onCommit(module, key, callback)
    module.overlays.onCommit(safeHooks.guard(key, callback))
end

function safeHooks.onInterval(module, name, seconds, callback)
    module.overlays.onInterval(name, seconds, safeHooks.guard(name, callback))
end

function safeHooks.afterHook(module, path, key, callback)
    module.overlays.afterHook(path, safeHooks.guard(key, callback))
end

return safeHooks
