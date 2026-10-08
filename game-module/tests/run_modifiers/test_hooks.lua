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
    self.state.plan = { runModifiers = {} }
    self.state.admittedNativeRun = self.run
    self.enemy = { ObjectId = 2, DamageType = 'Enemy', AddToEnemyTeam = true, MoneyDropOnDeath = { Chance = 0.2, Metadata = {} } }
    self.restore = nativeGame.install({ CurrentRun = self.run, CurrentHubRoom = false, SessionMapState = {},
        ActiveEnemies = { [2] = self.enemy }, CheckMoneyDrop = function() end, Kill = function() end,
        GenerateEncounter = function() end })
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
    self.state.plan.runModifiers.enemyGoldDropChance = 80
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
    lu.assertEquals(self:drop().Chance, 0.8)
    self.state.plan.runModifiers.enemyGoldDropChance = 5 lu.assertEquals(self:drop().Chance, 0.05)
    self.state.plan.runModifiers.enemyGoldDropChance = 0 lu.assertEquals(self:drop().Chance, 0)
    local reaction = { Chance = 0.2 }
    lu.assertIs(self:drop(reaction), reaction)
    self.state.plan.runModifiers.enemyGoldDropChance = nil lu.assertIs(self:drop(), data)
end
function TestRunModifiers:testSelfAndDisabledPassthrough()
    self.state.plan.runModifiers.enemyGoldDropChance = 80
    local args = {}
    lu.assertEquals(table.pack(self:invoke('Kill', function(v, a) lu.assertIs(v, self.run.Hero) lu.assertIs(a, args) return 1, nil, 3 end, self.run.Hero, args)), { n = 3, 1, nil, 3 })
    self.state.plan.runModifiers = nil
    lu.assertEquals(table.pack(self:invoke('Kill', function(v, a) lu.assertIs(v, self.enemy) lu.assertIs(a, args) return 1, nil, 3 end, self.enemy, args)), { n = 3, 1, nil, 3 })
    lu.assertFalse(self:applied())
end
function TestRunModifiers:testLifetimeMatrixAndFrozenPlan()
    self.state.plan.runModifiers.enemyGoldDropChance = 80
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
    self.state.plan.runModifiers.enemyGoldDropChance = 80
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
    self.state.plan.runModifiers.enemyGoldDropChance = 40
    lu.assertNil(self.adapter.verifyNative(self.state))
    lu.assertEquals(self.state.firstFault.expected, 'Kill')
end
function TestRunModifiers:testMissingGenerateEncounterFaultsOnlyForTheBudget()
    _G.GenerateEncounter = nil
    self.state.plan.runModifiers.enemyGoldDropChance = 40
    lu.assertTrue(self.adapter.verifyNative(self.state))
    self.state.plan = { runModifiers = { encounterGoldRange = 25 } }
    lu.assertNil(self.adapter.verifyNative(self.state))
    lu.assertEquals(self.state.firstFault.expected, 'GenerateEncounter')
end
function TestRunModifiers:testMissingCheckMoneyDropFault()
    self.state.plan.runModifiers.enemyGoldDropChance = 40
    _G.CheckMoneyDrop = nil
    lu.assertNil(self.adapter.verifyNative(self.state))
    lu.assertEquals(self.state.firstFault.expected, 'CheckMoneyDrop')
end
function TestRunModifiers:testCoroutineYieldRetainsOnlyItsOwnScope()
    self.state.plan.runModifiers.enemyGoldDropChance = 80
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
    self.state.plan.runModifiers.enemyGoldDropChance = 80
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
    self.state.plan.runModifiers.enemyGoldDropChance = 80
    local declaration = self.enemy.MoneyDropOnDeath
    self:invoke('Kill', function()
        local reaction = self:invoke('CheckMoneyDrop', function(_, data) return data end, self.enemy, declaration)
        lu.assertIs(reaction, declaration)
        local death = self:invoke('CheckMoneyDrop', function(_, data) return data end, self.enemy, declaration, nil)
        lu.assertEquals(death.Chance, 0.8)
    end, self.enemy)
end

-- Scripted native budget roll: hard overrides, then one RandomInt over the bounds.
local function nativeGenerate(after)
    return function(_, _, encounter)
        if encounter.IsHardEncounter and encounter.HardEncounterOverrideValues then
            for key, value in pairs(encounter.HardEncounterOverrideValues) do encounter[key] = value end
        end
        encounter.MoneyDropStore = _G.RandomInt(encounter.MoneyDropCapMin, encounter.MoneyDropCapMax)
        if after then after(encounter) end
        return encounter, 'tail'
    end
end
function TestRunModifiers:budget(encounter, after)
    local draws = {}
    local restore = nativeGame.install({ RandomInt = function(minimum, maximum)
        draws[#draws + 1] = { minimum, maximum } return minimum end })
    local ok, result, tail = pcall(self.invoke, self, 'GenerateEncounter', nativeGenerate(after), self.run, {}, encounter)
    restore()
    if not ok then error(result, 0) end
    lu.assertIs(result, encounter) lu.assertEquals(tail, 'tail')
    return draws
end
function TestRunModifiers:testEncounterGoldRangeFixesTheOneBudgetRoll()
    for _, case in ipairs({ { 0, 10 }, { 25, 11 }, { 50, 13 }, { 100, 15 }, { 12.5, 11 } }) do
        self.state.plan.runModifiers.encounterGoldRange = case[1]
        local encounter = { MoneyDropCapMin = 10, MoneyDropCapMax = 15 }
        lu.assertEquals(self:budget(encounter), { { case[2], case[2] } })
        lu.assertEquals(encounter.MoneyDropStore, case[2])
        lu.assertEquals({ encounter.MoneyDropCapMin, encounter.MoneyDropCapMax }, { 10, 15 })
    end
    self.state.plan.runModifiers.encounterGoldRange = 29
    lu.assertEquals(self:budget({ MoneyDropCapMin = 0, MoneyDropCapMax = 50 }), { { 15, 15 } })
    self.state.plan.runModifiers.encounterGoldRange = nil
    lu.assertEquals(self:budget({ MoneyDropCapMin = 10, MoneyDropCapMax = 15 }), { { 10, 15 } })
end
function TestRunModifiers:testEncounterGoldRangeLeavesNonNumericBoundsAndInactiveGenerationNative()
    self.state.plan.runModifiers.encounterGoldRange = 100
    for _, encounter in ipairs({ { MoneyDropCapMin = 10 },
        { IsHardEncounter = true, HardEncounterOverrideValues = { MoneyDropCapMax = 'nil' }, MoneyDropCapMin = 10, MoneyDropCapMax = 15 } }) do
        local seen
        lu.assertIs(self:invoke('GenerateEncounter', function(_, _, e)
            seen = { e.MoneyDropCapMin, e.MoneyDropCapMax } return e end, self.run, {}, encounter), encounter)
        lu.assertEquals(seen, { 10, encounter.MoneyDropCapMax })
    end
    for _, state in ipairs({ 'starting', 'desynchronized', 'faulted' }) do
        self.state.state = state
        lu.assertEquals(self:budget({ MoneyDropCapMin = 10, MoneyDropCapMax = 15 }), { { 10, 15 } })
    end
    self.state.state, self.state.reason = 'inactive', 'configured-prefix-complete'
    lu.assertEquals(self:budget({ MoneyDropCapMin = 10, MoneyDropCapMax = 15 }), { { 15, 15 } })
end
function TestRunModifiers:testEncounterGoldRangeNarrowsHardOverridesAndRestoresThem()
    self.state.plan.runModifiers.encounterGoldRange = 25
    local hard = { MoneyDropCapMin = 20, MoneyDropCapMax = 30, DepthDifficultyRamp = 30 }
    local encounter = { IsHardEncounter = true, HardEncounterOverrideValues = hard, MoneyDropCapMin = 10, MoneyDropCapMax = 15 }
    lu.assertEquals(self:budget(encounter), { { 23, 23 } })
    lu.assertIs(encounter.HardEncounterOverrideValues, hard)
    lu.assertEquals(hard, { MoneyDropCapMin = 20, MoneyDropCapMax = 30, DepthDifficultyRamp = 30 })
    -- Native generation leaves the hard-overridden bounds on the encounter.
    lu.assertEquals({ encounter.MoneyDropCapMin, encounter.MoneyDropCapMax }, { 20, 30 })
    local softHard = { DepthDifficultyRamp = 30 }
    encounter = { IsHardEncounter = true, HardEncounterOverrideValues = softHard, MoneyDropCapMin = 10, MoneyDropCapMax = 15 }
    lu.assertEquals(self:budget(encounter), { { 11, 11 } })
    lu.assertIs(encounter.HardEncounterOverrideValues, softHard)
    lu.assertEquals({ encounter.MoneyDropCapMin, encounter.MoneyDropCapMax }, { 10, 15 })
end
function TestRunModifiers:testEncounterGoldRangeRestoresBoundsOnErrorAndFaults()
    self.state.plan.runModifiers.encounterGoldRange = 100
    local hard = { MoneyDropCapMin = 20, MoneyDropCapMax = 30 }
    local encounter = { IsHardEncounter = true, HardEncounterOverrideValues = hard, MoneyDropCapMin = 10, MoneyDropCapMax = 15 }
    lu.assertErrorMsgContains('generation exploded', function()
        self:budget(encounter, function() error('generation exploded') end)
    end)
    lu.assertIs(encounter.HardEncounterOverrideValues, hard)
    lu.assertEquals({ encounter.MoneyDropCapMin, encounter.MoneyDropCapMax }, { 20, 30 })
    lu.assertEquals(self.state.state, 'faulted')
    lu.assertEquals(self.state.firstFault.checkpoint, 'run-modifiers:native-fault')
end

-- The planner-owned generation wrap narrows BaseDifficulty the same way; both
-- single-value ranges apply and unwind in either wrap order.
local generatedDefinition = require('mods.room.timeline.encounters.generated')
local function composedGeneration(test, modifiersFirst, encounter)
    local module, _, callbacks = support.capture()
    local generated = generatedDefinition.create()
    local occurrence, plannerState = { id = 'generated' }, { state = 'synchronized' }
    local phase = { slotKey = 'Combat', encounterKey = 'Generated', customization = { {
        kind = 'generated', decisionKey = 'generatedComposition', expectedBudget = 42, waveCount = 1, baseRoll = 42,
        waves = { { waveIndex = 1, types = {}, counts = {} } } } } }
    local room = { occurrence = function() return occurrence end, encounterPhase = function() return nil end }
    local function attachGenerated()
        generated.attach(module, { diagnostic = function() end }, function() return plannerState end, room)
    end
    if not modifiersFirst then attachGenerated() end
    hooks.attach(module, session, function() return test.state end, function() end)
    if modifiersFirst then attachGenerated() end
    local draws = {}
    local restore = nativeGame.install({ RandomInt = function(minimum, maximum)
        draws[#draws + 1] = { minimum, maximum } return minimum end })
    generated.withPhase(plannerState, room, phase, {}, function()
        callbacks.SetupEncounter(nil, {}, function(data, nativeRoom)
            return callbacks.GenerateEncounter(nil, {}, function(_, _, e)
                if e.IsHardEncounter and e.HardEncounterOverrideValues then
                    for key, value in pairs(e.HardEncounterOverrideValues) do e[key] = value end
                end
                e.MoneyDropStore = _G.RandomInt(e.MoneyDropCapMin, e.MoneyDropCapMax)
                e.DifficultyRating = _G.RandomInt(e.BaseDifficultyMin, e.BaseDifficultyMax)
                return e
            end, test.run, nativeRoom, data)
        end, encounter, {})
    end)
    restore()
    return draws
end
function TestRunModifiers:testEncounterGoldRangeComposesWithPlannerOwnedGeneration()
    self.state.plan.runModifiers.encounterGoldRange = 25
    for _, modifiersFirst in ipairs({ true, false }) do
        local encounter = { Name = 'Generated', MoneyDropCapMin = 10, MoneyDropCapMax = 15,
            BaseDifficultyMin = 1, BaseDifficultyMax = 99 }
        lu.assertEquals(composedGeneration(self, modifiersFirst, encounter), { { 11, 11 }, { 42, 42 } })
        lu.assertEquals({ encounter.MoneyDropCapMin, encounter.MoneyDropCapMax, encounter.BaseDifficultyMin,
            encounter.BaseDifficultyMax }, { 10, 15, 1, 99 })
        local hard = { MoneyDropCapMin = 20, MoneyDropCapMax = 30, BaseDifficultyMin = 30, BaseDifficultyMax = 60 }
        encounter = { Name = 'Generated', IsHardEncounter = true, HardEncounterOverrideValues = hard,
            MoneyDropCapMin = 10, MoneyDropCapMax = 15, BaseDifficultyMin = 1, BaseDifficultyMax = 99 }
        lu.assertEquals(composedGeneration(self, modifiersFirst, encounter), { { 23, 23 }, { 42, 42 } })
        lu.assertIs(encounter.HardEncounterOverrideValues, hard)
        lu.assertEquals(hard, { MoneyDropCapMin = 20, MoneyDropCapMax = 30, BaseDifficultyMin = 30, BaseDifficultyMax = 60 })
        lu.assertEquals({ encounter.MoneyDropCapMin, encounter.MoneyDropCapMax, encounter.BaseDifficultyMin,
            encounter.BaseDifficultyMax }, { 20, 30, 30, 60 })
    end
end
