-- Manual: cd game-module && lua tests/probes/test_run_modifiers_native.lua /path/to/Scripts
package.path = './?.lua;./src/?.lua;' .. package.path
local native = require('tests.probes.run_modifiers_native')
local root = assert(arg[1] or os.getenv('HADES2_SCRIPTS_PATH'))
local env = native.environment()
native.load(root, 'CombatLogic.lua', { 'addCritMultiplier', 'addDdMultiplier', 'CalculateCritChance', 'CalculateDoubleDamageChance', 'Damage', 'Kill' }, env)
local contacts = {}
for _, name in ipairs({ 'CalculateCritChance', 'CalculateDoubleDamageChance', 'GetTotalHeroTraitValue', 'RandomChance' }) do
    local base = env[name]
    env[name] = function(...) contacts[#contacts + 1] = { name, ... } return base(...) end
end
local args = { AttackerTable = env.CurrentRun.Hero }
local victim = { ObjectId = 2, Name = 'Enemy', Health = 100 }
local ok, err = pcall(env.Damage, victim, args)
assert(not ok and err == 'probe-damage-terminal')
assert(contacts[1][1] == 'CalculateCritChance' and contacts[1][2] == env.CurrentRun.Hero and contacts[1][3] == victim and contacts[1][5] == args)
assert(contacts[2][1] == 'CalculateDoubleDamageChance')
assert(contacts[3][2] == 'LuckMultiplier' and contacts[4][2] == 'OutgoingUnmodifiedCritBonus')
assert(contacts[5][1] == 'RandomChance' and contacts[6][1] == 'RandomChance')
victim.MoneyDropOnDeath = { Chance = 0.2 }
ok, err = pcall(env.Kill, victim, args)
assert(not ok and err == 'probe-kill-terminal')
assert(env.deathDrop[1] == victim and env.deathDrop[2] == victim.MoneyDropOnDeath and env.deathDrop[3] == env.CurrentRun.Hero)
print('Native Damage sequence and Kill death-drop argument contacts passed')

local lu = require('luaunit')
local hooks = require('mods.run_modifiers.hooks')
local capture = require('tests.harness.hook_composition').capture
local nativeGame = require('tests.harness.native_game')
local session = require('mods.runtime.session')
local function configured(settings)
    local e = native.environment()
    native.load(root, 'CombatLogic.lua', { 'addCritMultiplier', 'addDdMultiplier', 'CalculateCritChance', 'CalculateDoubleDamageChance', 'Damage', 'Kill' }, e)
    native.load(root, 'RoomLogic.lua', { 'CheckMoneyDrop' }, e)
    native.load(root, 'EffectLogic.lua', { 'CharmApply', 'CharmClear' }, e)
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
local nativeSettings = { guaranteeEligibleCrits = false, guaranteeEligibleDoubleDamage = false, enemyGoldDropChanceMultiplier = 1 }
local both = { guaranteeEligibleCrits = true, guaranteeEligibleDoubleDamage = true, enemyGoldDropChanceMultiplier = 1 }
-- Default scope is direct passthrough, so the deliberate host terminal does not create a modifier fault.
local function checkDamage(settings, changes, expectedAmount, crit, double)
    local e, state, restore = configured(settings)
    e.CurrentRun.Hero.OutgoingCritModifiers = { { Chance = 0.2 } }
    e.CurrentRun.Hero.OutgoingDoubleDamageModifiers = { { Chance = 0.2 } }
    local v = { ObjectId = 2, Health = 100 }
    local a = { AttackerTable = e.CurrentRun.Hero }
    if changes then changes(e, e.CurrentRun.Hero, v, a) end
    local ok, err = pcall(e.Damage, v, a)
    assert(not ok and err == 'probe-damage-terminal')
    lu.assertEquals(#e.rng, 2)
    lu.assertEquals(e.rng[1].n, 1)
    lu.assertEquals(e.rng[2].n, 1)
    lu.assertEquals(a.DamageAmount, expectedAmount)
    lu.assertEquals(a.IsCrit, crit)
    lu.assertEquals(a.IsDoubleDamage, double)
    restore()
    return state
end
checkDamage(nativeSettings, nil, 10, nil, nil)
checkDamage({ guaranteeEligibleCrits = true, guaranteeEligibleDoubleDamage = false, enemyGoldDropChanceMultiplier = 1 }, nil, 30, true, nil)
checkDamage({ guaranteeEligibleCrits = false, guaranteeEligibleDoubleDamage = true, enemyGoldDropChanceMultiplier = 1 }, nil, 20, nil, true)
checkDamage(both, nil, 60, true, true)
checkDamage(both, function(e, _, _, a) e.ProjectileData.Block = { BlockCrit = true, BlockDoubleDamage = true } a.SourceProjectile = 'Block' end, 20, nil, true)
checkDamage(both, function(e, _, _, a) e.EffectData.Block = { BlockCrit = true, BlockDoubleDamage = true } a.EffectName = 'Block' end, 10, nil, nil)
checkDamage(both, function(_, h) h.OutgoingCritModifiers = {} h.OutgoingDoubleDamageModifiers = {} end, 10, nil, nil)
-- Final unmodified crit bonus turns raw zero into an eligible chance.
checkDamage(both, function(e, h)
    h.OutgoingCritModifiers, h.OutgoingDoubleDamageModifiers = {}, {}
    local base = e.GetTotalHeroTraitValue
    e.GetTotalHeroTraitValue = function(key, ...)
        local result = base(key, ...)
        return key == 'OutgoingUnmodifiedCritBonus' and 0.1 or result
    end
end, 30, true, nil)
-- Luck zero cancels both raw chances.
checkDamage(both, function(e)
    local base = e.GetTotalHeroTraitValue
    e.GetTotalHeroTraitValue = function(key, ...)
        local result = base(key, ...)
        return key == 'LuckMultiplier' and 0 or result
    end
end, 10, nil, nil)
print('Native damage blockers, combined multipliers, final chances, Ares and missing-health cases passed')

-- Read the actual Ares modifier declarations; unrelated visual constants and
-- weapon-set unions are host data placeholders, not combat-policy substitutes.
local traitFile = assert(io.open(root .. '/TraitData_Ares.lua', 'rb'))
local traitSource = traitFile:read('*a'):gsub('^\239\187\191', '')
traitFile:close()
local traitEnv = setmetatable({ TraitData = {}, Color = {}, WeaponSets = {},
    EffectData = setmetatable({}, { __index = function() return {} end }),
    ConcatTableValues = function() return {} end,
    OverwriteTableKeys = function(target, declarations) for key, value in pairs(declarations) do target[key] = value end end,
}, { __index = _G })
assert(load(traitSource, '@TraitData_Ares.lua', 't', traitEnv))()
local ares = traitEnv.TraitData.AresStatusDoubleDamageBoon.AddOutgoingDoubleDamageModifiers
local missingHealth = traitEnv.TraitData.MissingHealthCritBoon.AddOutgoingDoubleDamageModifiers
for _, active in ipairs({ false, true }) do
    checkDamage(both, function(_, h, v)
        h.OutgoingCritModifiers = {}
        h.OutgoingDoubleDamageModifiers = { { Chance = ares.Chance.BaseValue, ValidActiveEffects = ares.ValidActiveEffects } }
        v.ActiveEffects = active and { AresStatus = true } or {}
    end, active and 20 or 10, nil, active and true or nil)
end
for _, missing in ipairs({ 0, 10 }) do
    checkDamage(both, function(_, h)
        h.Health = h.MaxHealth - missing
        h.OutgoingCritModifiers = {}
        h.OutgoingDoubleDamageModifiers = { { IncreasingHealthThresholdCritChance = missingHealth.IncreasingHealthThresholdCritChance.BaseValue } }
    end, missing > 0 and 20 or 10, nil, missing > 0 and true or nil)
end
print('Actual Ares declarations exercised through native damage calculations')

local gold = { guaranteeEligibleCrits = false, guaranteeEligibleDoubleDamage = false, enemyGoldDropChanceMultiplier = 5 }
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
