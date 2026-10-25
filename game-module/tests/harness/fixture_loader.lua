-- Test-only loader for the planner's execution fixtures. Runtime code never uses it.
local json = require("mods/protocol/json")
local primitives = require("mods.protocol.primitives")
local protocol = require("mods.protocol.decoder")
local loader = {}

-- The planner-engine corpus is the single copy; resolve it from this file's
-- location inside game-module/ so the root is independent of how the loader was found.
local moduleRoot = debug.getinfo(1, "S").source:match("^@(.-)tests[/\\]harness[/\\]fixture_loader%.lua$")
loader.root = assert(moduleRoot, "cannot locate game-module root")
    .. "../packages/planner-engine/test/execution-plan/fixtures/"
loader.defaultName = "f-opening.execution.json"

function loader.path(fileName)
    return loader.root .. fileName
end

-- The fingerprint the decoder computes over a plan's contents, read from its own
-- fingerprint call; the plan's stale fingerprint then fails only that comparison.
local function decoderFingerprint(plan, fileName)
    local original, computed = primitives.fingerprint, nil
    primitives.fingerprint = function(value)
        computed = original(value)
        return computed
    end
    local ok, decoded, errorMessage = pcall(protocol.decode, plan)
    primitives.fingerprint = original
    assert(ok, decoded)
    assert(decoded or tostring(errorMessage):find("fingerprint does not match", 1, true),
        fileName .. ": " .. tostring(errorMessage))
    return computed
end

-- A fixture keeps the schema pair it was generated under; tests read it under this
-- module's pair, with the fingerprint recomputed over the restamped contents.
local function restamp(source, fileName)
    local plan = assert(json.decode(source))
    plan.schemaVersion, plan.schemaRevision = protocol.SCHEMA_VERSION, protocol.SCHEMA_REVISION
    for key, value in pairs({
        schemaVersion = tostring(protocol.SCHEMA_VERSION),
        schemaRevision = tostring(protocol.SCHEMA_REVISION),
        planFingerprint = '"' .. decoderFingerprint(plan, fileName) .. '"',
    }) do
        local count
        source, count = source:gsub('"' .. key .. '":%s*[^,\n]*', '"' .. key .. '": ' .. value, 1)
        assert(count == 1, fileName .. " has no " .. key)
    end
    return source
end

local restamped = {}

-- The fixture's JSON text under this module's schema pair.
function loader.raw(fileName)
    fileName = fileName or loader.defaultName
    if restamped[fileName] == nil then
        local file = assert(io.open(loader.path(fileName), "rb"))
        local value = file:read("*a")
        file:close()
        restamped[fileName] = restamp(value, fileName)
    end
    return restamped[fileName]
end

-- The fixture's wire table under this module's schema pair.
function loader.decode(fileName)
    local value, errorMessage = json.decode(loader.raw(fileName))
    assert(value, errorMessage)
    return value
end

return loader
