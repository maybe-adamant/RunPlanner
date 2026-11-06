-- Heracles's bounty. HeraclesPostCombat (EnemyAILogic.lua) spawns the credited
-- gold as a bare RoomMoneyDrop after his fight; this binds that exact object to
-- the phase's published bounty pickup. Collecting it stays the direct-pickup
-- adapter's, which also reuses the object for a Sea Star duplicate.
local json = type(import) == "function" and import("mods/protocol/json.lua") or require("mods.protocol.json")

local heracles = {}

local PRODUCER = "HeraclesBountyPickup"
local ENTRY = "bounty"
local GAME_NAME = "RoomMoneyDrop"

-- The planner names the site with encodeURIComponent of the phase key.
local function encodeComponent(value)
    return (value:gsub("[^%w%-_%.!~%*'%(%)]", function(char)
        return string.format("%%%02X", char:byte())
    end))
end

local function decodedArray(value)
    local decoded = type(value) == "string" and json.decode(value) or nil
    return type(decoded) == "table" and json.isArray(decoded) and decoded or nil
end

-- The owner of the phase's bounty acquisition, or nil when the plan has none.
function heracles.bountyOwner(occurrence, phaseKey)
    if type(phaseKey) ~= "string" then return nil end
    local siteKey = "heraclesBounty:" .. encodeComponent(phaseKey)
    for _, transaction in ipairs(occurrence and occurrence.timeline and occurrence.timeline.transactions or {}) do
        if transaction.kind == "acquisition" and transaction.producerLifecycleKey == PRODUCER then
            local entry = decodedArray(transaction.owner)
            local site = entry and entry[1] == "acquisitionEntry" and entry[5] == ENTRY and decodedArray(entry[4])
            if site and site[1] == "acquisitionSite" and site[5] == siteKey then return transaction.owner end
        end
    end
    return nil
end

function heracles.attach(module, _session, getState, report, room)
    -- His post-combat AI waits before the spawn; a yielded unrelated thread
    -- must not inherit the scope.
    local scopes = setmetatable({}, { __mode = "k" })
    local mainThread = {}
    local function threadKey() return coroutine.running() or mainThread end

    module.hooks.wrap("HeraclesPostCombat", "run-planner-heracles-bounty-scope", function(_, runtime, base,
        enemy, ...)
        local key = threadKey()
        local prior = scopes[key]
        scopes[key] = { runtime = runtime }
        local result = table.pack(pcall(base, enemy, ...))
        scopes[key] = prior
        if not result[1] then error(result[2], 0) end
        return table.unpack(result, 2, result.n)
    end)

    module.hooks.wrap("CreateConsumableItem", "run-planner-heracles-bounty-bind", function(_, _, base,
        consumableId, consumableName, ...)
        local result = base(consumableId, consumableName, ...)
        local key = threadKey()
        local scope = scopes[key]
        if scope == nil or scope.bound or consumableName ~= GAME_NAME or type(result) ~= "table" then
            return result
        end
        scope.bound = true
        local state = getState(scope.runtime)
        local current = state and room.current(state) or nil
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local phase = current and room.encounterPhase(state, nativeRoom and nativeRoom.Encounter) or nil
        local owner = phase and heracles.bountyOwner(current.occurrence, phase.slotKey) or nil
        local handle = owner and room.resolve(state, current, { kind = "owner", owner = owner }) or nil
        if handle ~= nil then
            room.bind(state, current, handle, result)
            report(scope.runtime)
        end
        return result
    end)
end

return heracles
