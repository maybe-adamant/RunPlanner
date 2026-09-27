-- Test-only loader for the planner's execution fixtures. Runtime code never uses it.
local json = require("mods/protocol/json")
local loader = {}

-- The planner-engine corpus is the single copy; resolve it from this file's
-- location inside game-module/ so the root is independent of how the loader was found.
local moduleRoot = debug.getinfo(1, "S").source:match("^@(.-)tests[/\\]harness[/\\]fixture_loader%.lua$")
loader.root = assert(moduleRoot, "cannot locate game-module root")
    .. "../packages/planner-engine/test/execution-plan/fixtures/"
loader.fixturePath = loader.root .. "f-opening.execution.json"

function loader.path(fileName)
    return loader.root .. fileName
end

function loader.raw()
    local file = assert(io.open(loader.fixturePath, "rb"))
    local value = file:read("*a")
    file:close()
    return value
end

function loader.decode()
    local value, errorMessage = json.decode(loader.raw())
    assert(value, errorMessage)
    return value
end

return loader
