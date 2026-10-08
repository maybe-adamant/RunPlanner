-- Manual: cd game-module && lua tests/probes/test_run_modifiers_native.lua /path/to/Scripts
package.path = './?.lua;./src/?.lua;' .. package.path
local native = require('tests.probes.run_modifiers_native')
local root = assert(arg[1] or os.getenv('HADES2_SCRIPTS_PATH'))
local env = native.environment()
native.load(root, 'CombatLogic.lua', { 'Kill' }, env)
local args = { AttackerTable = env.CurrentRun.Hero }
local victim = { ObjectId = 2, Name = 'Enemy', Health = 100, MoneyDropOnDeath = { Chance = 0.2 } }
local ok, err = pcall(env.Kill, victim, args)
assert(not ok and err == 'probe-kill-terminal')
assert(env.deathDrop[1] == victim and env.deathDrop[2] == victim.MoneyDropOnDeath and env.deathDrop[3] == env.CurrentRun.Hero)
print('Native Kill death-drop argument contacts passed')

local lu = require('luaunit')
local hooks = require('mods.run_modifiers.hooks')
local capture = require('tests.harness.hook_composition').capture
local nativeGame = require('tests.harness.native_game')
local session = require('mods.runtime.session')
local function configured(settings)
    local e = native.environment()
    native.load(root, 'CombatLogic.lua', { 'Kill' }, e)
    native.load(root, 'RoomLogic.lua', { 'CheckMoneyDrop' }, e)
    native.load(root, 'EffectLogic.lua', { 'CharmApply', 'CharmClear' }, e)
    native.load(root, 'RunLogic.lua', { 'GenerateEncounter' }, e)
    native.load(root, 'UtilityLogic.lua', { 'OverwriteTableKeys' }, e)
    local state = session.create()
    state.state, state.reason = 'synchronized', 'ready'
    state.plan, state.admittedNativeRun = { runModifiers = settings }, e.CurrentRun
    local restore = nativeGame.install(e)
    local module, _, callbacks = capture()
    hooks.attach(module, session, function() return state end, function() end)
    for name, callback in pairs(callbacks) do
        local base = assert(e[name])
        e[name] = function(...) return callback(nil, {}, base, ...) end
    end
    return e, state, restore
end

local gold = { enemyGoldDropChance = 100 }
local function checkGold(changes, expectedStore, expectedDrops)
    local e, _, restore = configured(gold)
    local v = { ObjectId = 2, Name = 'Enemy', DamageType = 'Enemy', AddToEnemyTeam = true,
        MoneyDropOnDeath = { Chance = 0.2, MinParcels = 3, MaxParcels = 3, MinValue = 5, MaxValue = 5 } }
    e.ActiveEnemies[2] = v
    v.SkipRecordDestroyedState = true
    e.CleanupEnemy = function() end
    e.ClearEffect = function() e.CharmClear({ Victim = v }) end
    local chances = {}
    e.RandomChance = function(chance) chances[#chances + 1] = chance return chance >= 1 end
    local moneyDrop = e.CheckMoneyDrop
    e.CheckMoneyDrop = function(...) moneyDrop(...) error('probe-kill-terminal', 0) end
    if changes then changes(e, v) end
    local ok, err = pcall(e.Kill, v, { AttackerTable = e.CurrentRun.Hero })
    assert(not ok and err == 'probe-kill-terminal')
    lu.assertEquals(e.CurrentRun.CurrentRoom.Encounter.MoneyDropStore, expectedStore)
    lu.assertEquals(e.drops or {}, expectedDrops)
    lu.assertEquals(v.MoneyDropOnDeath.Chance, 0.2)
    restore()
    return chances
end
lu.assertEquals(checkGold(nil, -3, { 5 }), { 1 })
checkGold(function(e) e.CurrentRun.CurrentRoom.Encounter.MoneyDropStore = 0 end, 0, {})
checkGold(function(e) e.HasHeroTraitValue = function() return true end end, 2, {})
for _, marker in ipairs({ 'Charmed', 'AlwaysTraitor' }) do
    lu.assertEquals(checkGold(function(_, v) v[marker] = true end, 2, {}), { 0.2 })
end
checkGold(function(_, v) v.DamageType = 'Neutral' end, 2, {})
checkGold(function(_, v) v.AddToEnemyTeam = nil end, 2, {})
checkGold(function(_, v) v.MoneyDropOnDeath.IgnoreRoomMoneyStore = true end, 2, {})
print('Native gold BlockMoney, exhaustion, parcel overshoot, hostility snapshot and declaration preservation passed')

-- The base-difficulty roll follows the budget roll; it ends the probe there.
local function checkBudget(settings, encounter, expectedDraw, expectedStore)
    local e, _, restore = configured(settings)
    local draws = {}
    e.DebugPrint = function() end
    e.CurrentRun.RunDepthCache = 4
    e.RandomInt = function(minimum, maximum)
        draws[#draws + 1] = { minimum, maximum }
        if #draws == 2 then error('probe-generate-terminal', 0) end
        return maximum
    end
    local bounds = { encounter.MoneyDropCapMin, encounter.MoneyDropCapMax }
    local ok, err = pcall(e.GenerateEncounter, e.CurrentRun, {}, encounter)
    assert(not ok and err == 'probe-generate-terminal', tostring(err))
    lu.assertEquals(draws[1], expectedDraw)
    lu.assertEquals(#draws, 2)
    lu.assertEquals(encounter.MoneyDropStore, expectedStore)
    lu.assertEquals({ encounter.MoneyDropCapMin, encounter.MoneyDropCapMax }, bounds)
    restore()
end
local function biomeF()
    return { MoneyDropCapMin = 10, MoneyDropCapMax = 15, MoneyDropCapDepthRamp = 0.5,
        BaseDifficulty = 1, BaseDifficultyMin = 1, BaseDifficultyMax = 2 }
end
checkBudget({}, biomeF(), { 10, 15 }, 17)
checkBudget({ encounterGoldRange = 0 }, biomeF(), { 10, 10 }, 12)
checkBudget({ encounterGoldRange = 25 }, biomeF(), { 11, 11 }, 13)
checkBudget({ encounterGoldRange = 100 }, biomeF(), { 15, 15 }, 17)
print('Native budget single draw, depth ramp and bound restoration passed')
