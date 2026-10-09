-- One owner-agnostic native Hex-tree realization seam. Owners provide a
-- realised node map; native CreateTalentTree keeps every draw and the planned
-- talents replace its results once it returns.
local hexTree = {}

local function diagnostic(scope, checkpoint, expected, observed)
    if scope and scope.diagnostic then scope.diagnostic(checkpoint, expected, observed) end
end

local function olympian(node)
    return type(node.Pool) == "table" and (node.Pool.OlympianSpell ~= nil or node.Pool.OlympianCount ~= nil)
end

-- Keystone nodes are Rare, Legendary nodes Epic and repeatable nodes Common.
local function rarity(node)
    if type(node.Pool) ~= "table" then return "Common" end
    if node.Pool.Keystone ~= nil then return "Rare" end
    if node.Pool.Legendary ~= nil then return "Epic" end
    return "Common"
end

local function overwrite(scope, structure)
    local planned = {}
    for key, talent in pairs(scope.expected.nodes or {}) do planned[key] = talent end
    for depth, column in ipairs(type(structure) == "table" and structure or {}) do
        for slot, node in pairs(column) do
            if type(node) == "table" and not olympian(node) then
                local key = depth .. ":" .. tostring(slot)
                local talent = planned[key]
                if talent == nil then
                    diagnostic(scope, "hex-tree-node", key, node.Name)
                else
                    node.Name, node.Rarity = talent, rarity(node)
                    planned[key] = nil
                end
            end
        end
    end
    local missing = {}
    for key in pairs(planned) do missing[#missing + 1] = key end
    table.sort(missing)
    for _, key in ipairs(missing) do diagnostic(scope, "hex-tree-node", key .. "=" .. planned[key], "missing") end
end

function hexTree.create()
    local tree = {}
    local pending, active

    function tree.prepare(expected, traitKey, diagnosticCallback)
        local scope = { prior = pending, expected = expected, traitKey = traitKey, diagnostic = diagnosticCallback }
        pending = scope
        return scope
    end
    function tree.clear(scope)
        if pending ~= scope then return end
        pending = scope.prior
        if not scope.created then diagnostic(scope, "hex-tree-contact", "CreateTalentTree", "missing") end
    end
    function tree.realize(expected, traitKey, diagnosticCallback, action)
        local scope = tree.prepare(expected, traitKey, diagnosticCallback)
        local ok, result = pcall(action)
        tree.clear(scope)
        if not ok then error(result, 0) end
        return result
    end

    function tree.attach(module)
        module.hooks.wrap("CreateTalentTree", "run-planner-hex-tree", function(_, _, base, spellData)
            local scope = pending
            if scope == nil or spellData.TraitName ~= scope.traitKey then
                return base(spellData)
            end
            pending = scope.prior
            scope.created = true
            local prior = active; active = scope
            local ok, result = pcall(base, spellData)
            active = prior
            if not ok then error(result, 0) end
            overwrite(scope, result)
            return result
        end)
        module.hooks.wrap("GetRandomValue", "run-planner-hex-layout", function(_, _, base, values, ...)
            if active and type(values) == "table" then
                for _, value in ipairs(values) do
                    if type(value) == "table" and value.Name == active.expected.layoutKey then return value end
                end
                diagnostic(active, "hex-tree-layout", active.expected.layoutKey, "native-ineligible")
            end
            return base(values, ...)
        end)
    end

    return tree
end

return hexTree
