local lu = require('luaunit')
local hooks = require('mods.run_modifiers.hooks')
local support = require('tests.harness.hook_composition')
local session = require('mods.runtime.session')
local nativeGame = require('tests.harness.native_game')

TestRunModifiers = {}
function TestRunModifiers:setUp()
    self.run = { Hero = { ObjectId = 1 }, CurrentRoom = { Encounter = { MoneyDropStore = 2 } } }
    self.state = session.create()
    self.state.state, self.state.reason = 'synchronized', 'ready'
    self.state.plan = { runModifiers = { guaranteeEligibleCrits = false, guaranteeEligibleDoubleDamage = false, enemyGoldDropChanceMultiplier = 1 } }
    self.state.admittedNativeRun = self.run
    self.enemy = { ObjectId = 2, DamageType = 'Enemy', AddToEnemyTeam = true, MoneyDropOnDeath = { Chance = 0.2, Metadata = {} } }
    self.restore = nativeGame.install({ CurrentRun = self.run, CurrentHubRoom = false, SessionMapState = {},
        ActiveEnemies = { [2] = self.enemy }, CalculateCritChance = function() end, CalculateDoubleDamageChance = function() end,
        GetTotalHeroTraitValue = function() end, RandomChance = function() end, CheckMoneyDrop = function() end,
        Damage = function() end, Kill = function() end })
    local module, _, callbacks = support.capture()
    self.callbacks = callbacks
    self.adapter = hooks.attach(module, session, function() return self.state end, function() end)
    self.calls = {}
end
function TestRunModifiers:tearDown() self.restore() end
function TestRunModifiers:invoke(name, base, ...)
    return self.callbacks[name](nil, {}, base, ...)
end
-- This is only a contact driver: it never calculates chances, applies damage,
-- classifies game eligibility, or implements native money accounting.
function TestRunModifiers:rolls(crit, double, victim, args)
    victim, args = victim or self.enemy, args or { AttackerTable = self.run.Hero }
    return self:invoke('Damage', function(v, a)
        self:invoke('CalculateCritChance', function() return crit end, a.AttackerTable, v, nil, a)
        self:invoke('CalculateDoubleDamageChance', function() return double end, a.AttackerTable, v, nil, a)
        self:invoke('GetTotalHeroTraitValue', function() return 1 end, 'LuckMultiplier', { IsMultiplier = true })
        self:invoke('GetTotalHeroTraitValue', function() return 0 end, 'OutgoingUnmodifiedCritBonus')
        local function rng(chance, marker) self.calls[#self.calls + 1] = { chance, marker } return false, nil, marker end
        local first = table.pack(self:invoke('RandomChance', rng, crit, 'crit'))
        local second = table.pack(self:invoke('RandomChance', rng, double, 'double'))
        return first, second
    end, victim, args)
end
function TestRunModifiers:testIndependentSettingsAndEqualChances()
    for _, row in ipairs({ { false, false }, { true, false }, { false, true }, { true, true } }) do
        self.state.plan.runModifiers.guaranteeEligibleCrits = row[1]
        self.state.plan.runModifiers.guaranteeEligibleDoubleDamage = row[2]
        self.calls = {}
        local c, d = self:rolls(0.2, 0.2)
        lu.assertEquals(c, { n = 3, row[1], nil, 'crit' })
        lu.assertEquals(d, { n = 3, row[2], nil, 'double' })
        lu.assertEquals(self.calls, { { 0.2, 'crit' }, { 0.2, 'double' } })
    end
end
function TestRunModifiers:testFinalChanceNonpositiveAndUnrelatedRng()
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    self.state.plan.runModifiers.guaranteeEligibleDoubleDamage = true
    local c, d = self:rolls(0, -0.2)
    lu.assertFalse(c[1]) lu.assertFalse(d[1])
    lu.assertFalse(self:invoke('RandomChance', function() return false end, 0.5))
end
function TestRunModifiers:testIncomingSelfAndDisabledPassthrough()
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    local c = self:rolls(0.2, 0.2, self.run.Hero)
    lu.assertFalse(c[1])
    c = self:rolls(0.2, 0.2, self.enemy, { AttackerTable = self.enemy })
    lu.assertFalse(c[1])
    self.state.plan.runModifiers = nil
    local args = {}
    lu.assertEquals(table.pack(self:invoke('Damage', function(v, a) lu.assertIs(v, self.enemy) lu.assertIs(a, args) return 1, nil, 3 end, self.enemy, args)), { n = 3, 1, nil, 3 })
end
function TestRunModifiers:testLifetimeMatrixAndFrozenPlan()
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    self.state.state, self.state.reason = 'inactive', 'configured-prefix-complete'
    lu.assertTrue((self:rolls(0.2, 0.2))[1])
    for _, state in ipairs({ 'starting', 'desynchronized', 'faulted' }) do
        self.state.state = state lu.assertFalse((self:rolls(0.2, 0.2))[1])
    end
    self.state.state, self.state.reason = 'synchronized', 'ready'
    self.run.CurrentRoom = { Name = 'N_Hub', Encounter = {} }
    lu.assertTrue((self:rolls(0.2, 0.2))[1])
    self.run.Hero.IsDead = true lu.assertFalse((self:rolls(0.2, 0.2))[1]) self.run.Hero.IsDead = nil
    _G.SessionMapState.HandlingDeath = true lu.assertFalse((self:rolls(0.2, 0.2))[1]) _G.SessionMapState.HandlingDeath = nil
    _G.CurrentHubRoom = {} lu.assertFalse((self:rolls(0.2, 0.2))[1]) _G.CurrentHubRoom = nil
    _G.CurrentRun = { Hero = self.run.Hero } lu.assertFalse((self:rolls(0.2, 0.2))[1]) _G.CurrentRun = self.run
    self.state.admissionError = {} lu.assertFalse((self:rolls(0.2, 0.2))[1])
end
-- Error assertions must enclose the entire owner scope.
function TestRunModifiers:testNestedCoroutinesAndFaultCleanup()
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    lu.assertErrorMsgContains('host exploded', function()
        self:invoke('Damage', function()
            local co = coroutine.create(function() lu.assertFalse(self:invoke('RandomChance', function() return false end, 0.2)) end)
            lu.assertTrue(coroutine.resume(co))
            lu.assertTrue((self:rolls(0.2, 0.2))[1])
            error('host exploded')
        end, self.enemy, { AttackerTable = self.run.Hero })
    end)
    lu.assertEquals(self.state.state, 'faulted')
    lu.assertNil(self.state.firstMismatch)
    lu.assertFalse(self:invoke('RandomChance', function() return false end, 0.2))
end
function TestRunModifiers:testUnsupportedSequenceOnceAndMissingNative()
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    for _ = 1, 3 do
        self:invoke('Damage', function()
            self:invoke('CalculateDoubleDamageChance', function() return 0.2 end, self.run.Hero, self.enemy, nil, {})
            lu.assertFalse(self:invoke('RandomChance', function() return false end, 0.2))
        end, self.enemy, { AttackerTable = self.run.Hero })
    end
    lu.assertEquals(#self.state.diagnostics, 1)
    _G.CalculateCritChance = nil
    self:invoke('Damage', function() end, self.enemy, { AttackerTable = self.run.Hero })
    lu.assertEquals(self.state.state, 'faulted')
end
function TestRunModifiers:drop(data, killer)
    data = data or self.enemy.MoneyDropOnDeath
    return self:invoke('Kill', function(v)
        -- Allegiance is reset by native ClearEffect before the real drop.
        v.Charmed = nil
        return self:invoke('CheckMoneyDrop', function(actualVictim, actualData, actualKiller)
            lu.assertIs(actualVictim, v) lu.assertIs(actualKiller, killer)
            return actualData
        end, v, data, killer)
    end, self.enemy, { AttackerTable = killer })
end
function TestRunModifiers:testGoldChanceOnlyCopyAndExclusions()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 4
    local data = self.enemy.MoneyDropOnDeath
    local result = self:drop(data, self.run.Hero)
    lu.assertNotIs(result, data) lu.assertEquals(result.Chance, 0.8)
    lu.assertIs(result.Metadata, data.Metadata) lu.assertEquals(data.Chance, 0.2)
    for _, field in ipairs({ 'Charmed', 'AlwaysTraitor' }) do
        self.enemy[field] = true lu.assertIs(self:drop(), data) self.enemy[field] = nil
    end
    for _, field in ipairs({ 'DamageType', 'AddToEnemyTeam' }) do
        local original = self.enemy[field] self.enemy[field] = nil lu.assertIs(self:drop(), data) self.enemy[field] = original
    end
    _G.ActiveEnemies = {} lu.assertIs(self:drop(), data) _G.ActiveEnemies[2] = self.enemy
    for _, chance in ipairs({ 0, -1 }) do data.Chance = chance lu.assertIs(self:drop(), data) end
    data.Chance = nil lu.assertIs(self:drop(), data) data.Chance = 0.5
    data.IgnoreRoomMoneyStore = true lu.assertIs(self:drop(), data) data.IgnoreRoomMoneyStore = nil
    self.run.CurrentRoom.Encounter = nil lu.assertIs(self:drop(), data)
    self.run.CurrentRoom.Encounter = { MoneyDropStore = 0 }
    lu.assertEquals(self:drop().Chance, 1)
    local reaction = { Chance = 0.2 }
    lu.assertIs(self:drop(reaction), reaction)
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 1 lu.assertIs(self:drop(), data)
end

function TestRunModifiers:testRequiredOwnerMissingAndDisabledNoChecks()
    _G.Damage = nil
    lu.assertTrue(self.adapter.verifyNative(self.state))
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    lu.assertNil(self.adapter.verifyNative(self.state))
    lu.assertEquals(self.state.firstFault.expected, 'Damage')
end
function TestRunModifiers:testMissingKillFault()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 2
    _G.Kill = nil
    lu.assertNil(self.adapter.verifyNative(self.state))
    lu.assertEquals(self.state.firstFault.expected, 'Kill')
end

function TestRunModifiers:testCoroutineYieldRetainsOnlyItsOwnScope()
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    local victim, args = self.enemy, { AttackerTable = self.run.Hero }
    local co = coroutine.create(function()
        return self:invoke('Damage', function()
            self:invoke('CalculateCritChance', function() return 0.2 end, self.run.Hero, victim, nil, args)
            self:invoke('CalculateDoubleDamageChance', function() return 0.2 end, self.run.Hero, victim, nil, args)
            self:invoke('GetTotalHeroTraitValue', function() return 1 end, 'LuckMultiplier', { IsMultiplier = true })
            self:invoke('GetTotalHeroTraitValue', function() return 0 end, 'OutgoingUnmodifiedCritBonus')
            coroutine.yield('armed')
            local c = self:invoke('RandomChance', function() return false end, 0.2)
            local d = self:invoke('RandomChance', function() return false end, 0.2)
            return c, d
        end, victim, args)
    end)
    lu.assertEquals(table.pack(coroutine.resume(co)), { n = 2, true, 'armed' })
    lu.assertFalse(self:invoke('RandomChance', function() return false end, 0.2))
    lu.assertTrue((self:rolls(0.2, 0.2))[1])
    lu.assertEquals(table.pack(coroutine.resume(co)), { n = 3, true, true, false })
    lu.assertFalse(self:invoke('RandomChance', function() return false end, 0.2))
end
function TestRunModifiers:testHelperInnerContactsAndIncomingNestedDamageDoNotConsumeRolls()
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    local args, victim = { AttackerTable = self.run.Hero }, self.enemy
    self:invoke('Damage', function()
        self:invoke('CalculateCritChance', function()
            lu.assertFalse(self:invoke('RandomChance', function() return false end, 0.2))
            self:invoke('GetTotalHeroTraitValue', function() return 0 end, 'OutgoingUnmodifiedCritBonus')
            return 0.2
        end, self.run.Hero, victim, nil, args)
        self:invoke('CalculateDoubleDamageChance', function() return 0.2 end, self.run.Hero, victim, nil, args)
        self:invoke('GetTotalHeroTraitValue', function() return 1 end, 'LuckMultiplier', { IsMultiplier = true })
        self:invoke('GetTotalHeroTraitValue', function() return 0 end, 'OutgoingUnmodifiedCritBonus')
        lu.assertFalse((self:rolls(0.2, 0.2, self.run.Hero))[1])
        lu.assertTrue(self:invoke('RandomChance', function() return false end, 0.2))
        lu.assertFalse(self:invoke('RandomChance', function() return false end, 0.2))
    end, victim, args)
end
function TestRunModifiers:testPartialSequenceIsDiagnosticAndNativeEarlyBranchIsSilent()
    self.state.plan.runModifiers.guaranteeEligibleCrits = true
    self:invoke('Damage', function() end, self.enemy, { AttackerTable = self.run.Hero, PureDamage = true })
    lu.assertEquals(self.state.diagnostics, {})
    local args = { AttackerTable = self.run.Hero }
    self:invoke('Damage', function()
        self:invoke('CalculateCritChance', function() return 0.2 end, self.run.Hero, self.enemy, nil, args)
    end, self.enemy, args)
    lu.assertEquals(#self.state.diagnostics, 1)
    lu.assertNil(self.state.firstMismatch) lu.assertNil(self.state.firstFault)
end
function TestRunModifiers:testThrowingGoldAndNestedKillCleanup()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 4
    lu.assertErrorMsgContains('money host exploded', function()
        self:invoke('Kill', function()
            self:invoke('Kill', function() return 'neutral' end, { DamageType = 'Neutral' })
            self:invoke('CheckMoneyDrop', function() error('money host exploded') end,
                self.enemy, self.enemy.MoneyDropOnDeath, nil)
        end, self.enemy)
    end)
    lu.assertEquals(self.state.state, 'faulted') lu.assertNil(self.state.firstMismatch)
    lu.assertIs(self:invoke('CheckMoneyDrop', function(_, data) return data end, self.enemy, self.enemy.MoneyDropOnDeath), self.enemy.MoneyDropOnDeath)
end
function TestRunModifiers:testAllNativePreservesExactArgumentAndReturnTuples()
    for _, name in ipairs({ 'Damage', 'Kill', 'CalculateCritChance', 'CalculateDoubleDamageChance', 'GetTotalHeroTraitValue', 'RandomChance', 'CheckMoneyDrop' }) do
        local argument = {}
        for _, values in ipairs({ { n = 0 }, { n = 1, argument }, { n = 3, argument, nil, 'extra' } }) do
            local result = table.pack(self:invoke(name, function(...)
                local actual = table.pack(...)
                lu.assertEquals(actual.n, values.n)
                if values.n > 0 then lu.assertIs(actual[1], argument) end
                lu.assertEquals(actual[3], values[3])
                return nil, argument, nil
            end, table.unpack(values, 1, values.n)))
            lu.assertEquals(result.n, 3) lu.assertNil(result[1]) lu.assertIs(result[2], argument) lu.assertNil(result[3])
        end
    end
    lu.assertEquals(self.state.diagnostics, {}) lu.assertNil(self.state.firstFault)
end
function TestRunModifiers:testReactionCannotClaimDeathDataWithNilKiller()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 4
    local declaration = self.enemy.MoneyDropOnDeath
    self:invoke('Kill', function()
        local reaction = self:invoke('CheckMoneyDrop', function(_, data) return data end, self.enemy, declaration)
        lu.assertIs(reaction, declaration)
        local death = self:invoke('CheckMoneyDrop', function(_, data) return data end, self.enemy, declaration, nil)
        lu.assertEquals(death.Chance, 0.8)
    end, self.enemy)
end
