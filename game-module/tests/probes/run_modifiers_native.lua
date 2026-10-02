-- Opt-in source loader: proprietary scripts are never required by ordinary CI.
local M = {}
function M.load(root, fileName, names, environment)
    local file = assert(io.open(root .. '/' .. fileName, 'rb'))
    local source = file:read('*a'):gsub('\r\n', '\n')
    file:close()
    environment = environment or _G
    for _, name in ipairs(names) do
        local first = assert(source:find('function ' .. name .. '%s*%('))
        local last = source:find('\nfunction ', first + 1)
        assert(load(source:sub(first, last and last - 1 or #source), '@' .. fileName .. ':' .. name, 't', environment))()
    end
    return environment
end
function M.environment()
    local env = setmetatable({}, { __index = _G })
    local hero = { ObjectId = 1, Health = 100, MaxHealth = 100, FirstTraitWithPropertyCache = {} }
    env.CurrentRun = { Hero = hero, CurrentRoom = { Kills = {}, ActiveEncounters = {}, Encounter = { MoneyDropStore = 2 } } }
    env.SessionMapState, env.MapState, env.ActiveEnemies = {}, { ActiveObstacles = {} }, {}
    env.CheckOnKillWeaponUpgrades = function() end
    env.ProjectileData, env.EffectData = {}, {}
    env.GetWeaponData = function() end
    env.CalculateDamageMultipliers = function() return 1 end
    env.CalculateBaseDamage = function() return 10 end
    env.CalculateBaseDamageAdditions = function() return 0 end
    env.CalculateDamageAdditions = function() return 0 end
    env.GetTotalHeroTraitValue = function(key) return (key == 'LuckMultiplier' or key == 'MoneyMultiplier') and 1 or 0 end
    env.IsEmpty = function(t) return not t or next(t) == nil end
    env.ContainsAnyKey = function(t, keys) for _, key in ipairs(keys) do if t[key] then return true end end return false end
    env.round = function(v) return math.floor(v + 0.5) end
    env.rng = {}
    env.RandomChance = function(...) env.rng[#env.rng + 1] = table.pack(...) return false end
    env.CalculateLifestealModifiers = function() error('probe-damage-terminal', 0) end
    env.ClearEffect, env.EffectPostClearAll, env.KillEnemy = function() end, function() end, function() end
    env.CheckMoneyDrop = function(...) env.deathDrop = table.pack(...) error('probe-kill-terminal', 0) end
    env.HasHeroTraitValue = function() return false end
    env.RandomInt = function(minimum) return minimum end
    env.DropMoney = function(amount) env.drops = env.drops or {} env.drops[#env.drops + 1] = amount end
    return env
end
return M
