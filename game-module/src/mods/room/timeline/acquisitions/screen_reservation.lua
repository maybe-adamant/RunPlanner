-- Keeps a single-pick screen's planned final rows off the native screens before
-- its planned final one, so they cannot be picked early and the native reroll's
-- random ban of one shown row never removes a planned row. Native generation
-- still owns rarities, eligibility and that ban. Transforming (Chaos) rows
-- ignore native exclusions and are left alone.
local reservation = {}

local function snapshot(loot)
    local saved = {}
    for key, value in pairs(loot) do saved[key] = value end
    return saved
end

local function restore(loot, saved)
    for key in pairs(snapshot(loot)) do
        if saved[key] == nil then loot[key] = nil end
    end
    for key, value in pairs(saved) do loot[key] = value end
end

local function rowCount(loot)
    return type(loot.UpgradeOptions) == "table" and #loot.UpgradeOptions or 0
end

local function withExclusions(args, names)
    local result = {}
    for key, value in pairs(args or {}) do result[key] = value end
    local excluded = {}
    for _, name in ipairs(type(result.ExclusionNames) == "table" and result.ExclusionNames or {}) do
        excluded[#excluded + 1] = name
    end
    for _, name in ipairs(names) do excluded[#excluded + 1] = name end
    result.ExclusionNames = excluded
    return result
end

local function maxChoices()
    if type(_G.GetTotalLootChoices) ~= "function" then return nil end
    local ok, choices = pcall(_G.GetTotalLootChoices)
    return ok and type(choices) == "number" and choices or nil
end

local function shows(loot, names)
    local planned = {}
    for _, name in ipairs(names) do planned[name] = true end
    for _, row in ipairs(type(loot.UpgradeOptions) == "table" and loot.UpgradeOptions or {}) do
        if type(row) == "table" and planned[row.ItemName] then return true end
    end
    return false
end

-- Generates with every planned row reserved, then only the picked row, keeping the
-- first that does not shrink the screen below its native row count; otherwise the
-- native screen. `native` is an already generated native screen, or nil to generate
-- one only when the screen is not full.
local function generateReserved(generate, loot, args, plan, native)
    local tiers = { plan.names }
    if plan.picked ~= nil and #plan.names > 1 then tiers[2] = { plan.picked } end
    local full = maxChoices()
    for _, names in ipairs(tiers) do
        generate(withExclusions(args, names))
        local count = rowCount(loot)
        if native == nil and full ~= nil and count >= full then return end
        if native == nil then
            local reserved = snapshot(loot)
            generate(args)
            native = { saved = snapshot(loot), count = rowCount(loot) }
            if count >= native.count then
                restore(loot, reserved)
                return
            end
        elseif count >= native.count then
            return
        end
    end
    restore(loot, native.saved)
end

function reservation.create()
    local instance = {}
    local plans = setmetatable({}, { __mode = "k" })
    local rerolls = setmetatable({}, { __mode = "k" })
    local active

    -- `plan` = { planned = reroll count, names = final row names, picked = picked name }.
    -- Called at the screen's first native screen; regenerates it only when it shows a
    -- planned row, the way a native reroll regenerates.
    function instance.initial(loot, plan)
        if type(loot) ~= "table" or plans[loot] ~= nil or type(plan) ~= "table"
            or (plan.planned or 0) <= 0 or #(plan.names or {}) == 0 then return end
        plans[loot] = plan
        if loot.TransformingTraits or not shows(loot, plan.names) then return end
        generateReserved(function(args) _G.SetTraitsOnLoot(loot, args) end, loot, {
            BoonRaritiesOverride = loot.RarityChances, IgnoreAllRarityBonus = true, IgnoreRoomRarityBonus = true,
        }, plan, { saved = snapshot(loot), count = rowCount(loot) })
    end

    function instance.attach(module)
        module.hooks.wrap("RerollBoonLoot", "run-planner-reserve-planned-rows", function(_, _, base, screen,
            button, ...)
            local loot = type(button) == "table" and button.LootData or nil
            local plan = loot and plans[loot]
            if plan == nil then return base(screen, button, ...) end
            local generation = (rerolls[loot] or 0) + 1
            rerolls[loot] = generation
            -- The planned final screen is installed over its native roll.
            if generation >= plan.planned then return base(screen, button, ...) end
            local prior = active
            active = { loot = loot, plan = plan }
            local results = table.pack(pcall(base, screen, button, ...))
            active = prior
            if not results[1] then error(results[2], 0) end
            return table.unpack(results, 2, results.n)
        end)

        module.hooks.wrap("SetTraitsOnLoot", "run-planner-reserve-planned-rows", function(_, _, base, loot, args)
            local scope = active
            if scope == nil or scope.loot ~= loot or loot.TransformingTraits then return base(loot, args) end
            active = nil
            local ok, failure = pcall(generateReserved, function(generated) base(loot, generated) end,
                loot, args, scope.plan, nil)
            active = scope
            if not ok then error(failure, 0) end
        end)
    end

    return instance
end

return reservation
