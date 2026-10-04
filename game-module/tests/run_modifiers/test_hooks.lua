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
    self.state.plan = { runModifiers = { enemyGoldDropChanceMultiplier = 1 } }
    self.state.admittedNativeRun = self.run
    self.enemy = { ObjectId = 2, DamageType = 'Enemy', AddToEnemyTeam = true, MoneyDropOnDeath = { Chance = 0.2, Metadata = {} } }
    self.restore = nativeGame.install({ CurrentRun = self.run, CurrentHubRoom = false, SessionMapState = {},
        ActiveEnemies = { [2] = self.enemy }, CheckMoneyDrop = function() end, Kill = function() end })
    local module, _, callbacks = support.capture()
    self.callbacks = callbacks
    self.adapter = hooks.attach(module, session, function() return self.state end, function() end)
end
function TestRunModifiers:tearDown() self.restore() end
function TestRunModifiers:invoke(name, base, ...)
    return self.callbacks[name](nil, {}, base, ...)
end
-- This is only a contact driver: it never classifies game eligibility or
-- implements native money accounting.
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
function TestRunModifiers:applied() return self:drop() ~= self.enemy.MoneyDropOnDeath end
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
function TestRunModifiers:testSelfAndDisabledPassthrough()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 4
    local args = {}
    lu.assertEquals(table.pack(self:invoke('Kill', function(v, a) lu.assertIs(v, self.run.Hero) lu.assertIs(a, args) return 1, nil, 3 end, self.run.Hero, args)), { n = 3, 1, nil, 3 })
    self.state.plan.runModifiers = nil
    lu.assertEquals(table.pack(self:invoke('Kill', function(v, a) lu.assertIs(v, self.enemy) lu.assertIs(a, args) return 1, nil, 3 end, self.enemy, args)), { n = 3, 1, nil, 3 })
    lu.assertFalse(self:applied())
end
function TestRunModifiers:testLifetimeMatrixAndFrozenPlan()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 4
    self.state.state, self.state.reason = 'inactive', 'configured-prefix-complete'
    lu.assertTrue(self:applied())
    for _, state in ipairs({ 'starting', 'desynchronized', 'faulted' }) do
        self.state.state = state lu.assertFalse(self:applied())
    end
    self.state.state, self.state.reason = 'synchronized', 'ready'
    self.run.CurrentRoom = { Name = 'N_Hub', Encounter = { MoneyDropStore = 2 } }
    lu.assertTrue(self:applied())
    self.run.Hero.IsDead = true lu.assertFalse(self:applied()) self.run.Hero.IsDead = nil
    _G.SessionMapState.HandlingDeath = true lu.assertFalse(self:applied()) _G.SessionMapState.HandlingDeath = nil
    _G.CurrentHubRoom = {} lu.assertFalse(self:applied()) _G.CurrentHubRoom = nil
    _G.CurrentRun = { Hero = self.run.Hero } lu.assertFalse(self:applied()) _G.CurrentRun = self.run
    self.state.admissionError = {} lu.assertFalse(self:applied())
end
function TestRunModifiers:testMissingDeathDropContactIsDiagnosedOnceAndMissingNativeFaults()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 4
    for _ = 1, 3 do
        self:invoke('Kill', function() end, self.enemy, { AttackerTable = self.run.Hero })
    end
    lu.assertEquals(#self.state.diagnostics, 1)
    lu.assertNil(self.state.firstFault)
    _G.CheckMoneyDrop = nil
    lu.assertEquals(self:invoke('Kill', function() return 'native' end, self.enemy, { AttackerTable = self.run.Hero }), 'native')
    lu.assertEquals(self.state.state, 'faulted')
    lu.assertEquals(self.state.firstFault.expected, 'CheckMoneyDrop')
end
function TestRunModifiers:testRequiredOwnerMissingAndDisabledNoChecks()
    _G.Kill = nil
    lu.assertTrue(self.adapter.verifyNative(self.state))
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 2
    lu.assertNil(self.adapter.verifyNative(self.state))
    lu.assertEquals(self.state.firstFault.expected, 'Kill')
end
function TestRunModifiers:testMissingCheckMoneyDropFault()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 2
    _G.CheckMoneyDrop = nil
    lu.assertNil(self.adapter.verifyNative(self.state))
    lu.assertEquals(self.state.firstFault.expected, 'CheckMoneyDrop')
end
function TestRunModifiers:testCoroutineYieldRetainsOnlyItsOwnScope()
    self.state.plan.runModifiers.enemyGoldDropChanceMultiplier = 4
    local data = self.enemy.MoneyDropOnDeath
    local co = coroutine.create(function()
        return self:invoke('Kill', function()
            coroutine.yield('armed')
            return self:invoke('CheckMoneyDrop', function(_, actual) return actual end, self.enemy, data, nil)
        end, self.enemy, {})
    end)
    lu.assertEquals(table.pack(coroutine.resume(co)), { n = 2, true, 'armed' })
    lu.assertIs(self:invoke('CheckMoneyDrop', function(_, actual) return actual end, self.enemy, data, nil), data)
    lu.assertTrue(self:applied())
    local ok, result = coroutine.resume(co)
    lu.assertTrue(ok) lu.assertEquals(result.Chance, 0.8)
    lu.assertIs(self:invoke('CheckMoneyDrop', function(_, actual) return actual end, self.enemy, data, nil), data)
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
    for _, name in ipairs({ 'Kill', 'CheckMoneyDrop' }) do
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
