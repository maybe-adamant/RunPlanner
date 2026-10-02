-- The module build identity, stamped by the planner into the installed
-- execution-compatibility.json; a plan slot must name the same build.
local json = type(import) == "function" and import("mods/protocol/json.lua") or require("mods.protocol.json")

local buildIdentity = {}
buildIdentity.FILE_NAME = "execution-compatibility.json"
buildIdentity.MAX_BYTES = 16384

-- The installed build id, or nil when the file is missing, oversized, malformed or unstamped.
function buildIdentity.read(pluginRoot, pathApi)
    if type(pluginRoot) ~= "string" or pluginRoot == ""
        or type(pathApi) ~= "table" or type(pathApi.combine) ~= "function" then
        return nil
    end
    local file = io.open(pathApi.combine(pluginRoot, buildIdentity.FILE_NAME), "rb")
    if not file then return nil end
    local content = file:read(buildIdentity.MAX_BYTES + 1)
    file:close()
    if type(content) ~= "string" or #content > buildIdentity.MAX_BYTES then return nil end
    local value = json.decode(content)
    if not json.isObject(value) then return nil end
    local buildId = value.buildId
    if type(buildId) ~= "string" or not buildId:match("^" .. string.rep("[0-9a-f]", 64) .. "$") then
        return nil
    end
    return buildId
end

function buildIdentity.short(buildId)
    return type(buildId) == "string" and buildId:sub(1, 12) or "unknown"
end

return buildIdentity
