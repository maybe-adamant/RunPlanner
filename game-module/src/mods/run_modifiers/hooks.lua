-- Run-wide actuators. Native calculations, blockers and money accounting remain
-- native; only the death-drop chance input and the encounter budget bounds change.
local modifiers = {}
local function pack(...) return { n = select('#', ...), ... } end

function modifiers.attach(module, session, getState, report)
    local main = {}
    local scopes = setmetatable({}, { __mode = 'k' })
    local function thread() return coroutine.running() or main end
    local function scope() return scopes[thread()] end
    local function options(state)
        local run = _G.CurrentRun
        if not state or state.admittedNativeRun ~= run or not run or not run.Hero
            or run.Hero.IsDead or (_G.SessionMapState or {}).HandlingDeath or _G.CurrentHubRoom
            or state.firstFault or state.firstMismatch or state.admissionError then return nil end
        if state.state ~= 'synchronized'
            and not (state.state == 'inactive' and state.reason == 'configured-prefix-complete') then return nil end
        return state.plan and state.plan.runModifiers
    end
    local function diagnostic(s, detail)
        if not s or s.diagnosed then return end
        s.diagnosed = true
        session.modifierDiagnostic(s.state, 'run-modifiers:native-contact', { detail = detail })
        report(s.runtime)
    end
    local function call(base, ...)
        if type(base) ~= 'function' then error('required native function missing', 0) end
        return base(...)
    end
    local function scoped(s, base, ...)
        local key = thread()
        local previous = scopes[key]
        scopes[key] = s
        local result = pack(pcall(call, base, ...))
        scopes[key] = previous
        if not result[1] then
            if s then
                session.fault(s.state, 'run-modifiers:native-fault', 'native contact returns', tostring(result[2]))
                report(s.runtime)
            end
            error(result[2], 0)
        end
        if s and not s.consumed and type(s.data) == 'table'
            and type(s.data.Chance) == 'number' and s.data.Chance > 0
            and not s.data.IgnoreRoomMoneyStore then diagnostic(s, 'missing death-drop contact') end
        return table.unpack(result, 2, result.n)
    end
    local verifiedPlan, verifiedRun
    local function verifyNative(state)
        local settings = options(state)
        if not settings or (settings.enemyGoldDropChance == nil and settings.encounterGoldRange == nil) then
            return true
        end
        if verifiedPlan == state.plan and verifiedRun == state.admittedNativeRun then return true end
        local required = settings.enemyGoldDropChance ~= nil and { 'Kill', 'CheckMoneyDrop' } or {}
        if settings.encounterGoldRange ~= nil then required[#required + 1] = 'GenerateEncounter' end
        for _, name in ipairs(required) do
            if type(_G[name]) ~= 'function' then
                session.fault(state, 'run-modifiers:missing-native', name, type(_G[name]))
                return nil
            end
        end
        verifiedPlan, verifiedRun = state.plan, state.admittedNativeRun
        return true
    end
    module.hooks.wrap('Kill', 'run-planner-modifier-kill', function(_, runtime, base, ...)
        local victim, args = ...
        local state = getState(runtime)
        local settings = options(state)
        local s
        if settings and settings.enemyGoldDropChance ~= nil and type(victim) == 'table'
            and victim ~= _G.CurrentRun.Hero and not victim.IsDead
            and victim.DamageType == 'Enemy' and victim.AddToEnemyTeam == true
            and not victim.Charmed and not victim.AlwaysTraitor
            and (_G.ActiveEnemies or {})[victim.ObjectId] == victim then
            s = { state = state, runtime = runtime, settings = settings,
                victim = victim, data = victim.MoneyDropOnDeath, killer = args and args.AttackerTable }
            if type(_G.CheckMoneyDrop) ~= 'function' then
                session.fault(state, 'run-modifiers:missing-native', 'CheckMoneyDrop', type(_G.CheckMoneyDrop))
                report(runtime)
                return base(...)
            end
        end
        if not s and not scope() then return base(...) end
        return scoped(s, base, ...)
    end)
    module.hooks.wrap('CheckMoneyDrop', 'run-planner-modifier-death-drop', function(_, _, base, ...)
        local victim, data, killer = ...
        local s = scope()
        local encounter = _G.CurrentRun and _G.CurrentRun.CurrentRoom and _G.CurrentRun.CurrentRoom.Encounter
        -- Native Kill supplies all three operands, even a nil killer; reactions
        -- supply only victim/data and cannot claim the death-drop contact.
        if s and not s.consumed and select('#', ...) == 3
            and s.victim == victim and s.data == data and s.killer == killer then
            s.consumed = true
            if options(s.state) == s.settings and type(data) == 'table' and type(data.Chance) == 'number'
                and data.Chance > 0 and not data.IgnoreRoomMoneyStore and encounter and type(encounter.MoneyDropStore) == 'number' then
                local copy = {}
                for key, value in pairs(data) do copy[key] = value end
                copy.Chance = s.settings.enemyGoldDropChance / 100
                local arguments = pack(...)
                arguments[2] = copy
                return scoped(nil, base, table.unpack(arguments, 1, arguments.n))
            end
        end
        if s then return scoped(nil, base, ...) end
        return base(...)
    end)
    -- GenerateEncounter applies hard overrides, then rolls the budget once with
    -- RandomInt(MoneyDropCapMin, MoneyDropCapMax); a single-value range fixes it.
    module.hooks.wrap('GenerateEncounter', 'run-planner-modifier-encounter-gold', function(_, runtime, base, ...)
        local _, _, encounter = ...
        local state = getState(runtime)
        local settings = options(state)
        local percent = settings and settings.encounterGoldRange
        if percent == nil or type(encounter) ~= 'table' then return base(...) end
        local hard = encounter.IsHardEncounter and encounter.HardEncounterOverrideValues or nil
        local function effective(key)
            if type(hard) == 'table' and hard[key] ~= nil then return hard[key] end
            return encounter[key]
        end
        local minimum, maximum = effective('MoneyDropCapMin'), effective('MoneyDropCapMax')
        if type(minimum) ~= 'number' or type(maximum) ~= 'number' then return base(...) end
        -- Integer arithmetic keeps half-way points exact (29% of 0..50 is 15).
        local fixed = math.floor((100 * minimum + percent * (maximum - minimum) + 50) / 100)
        local swapsHard = type(hard) == 'table' and (hard.MoneyDropCapMin ~= nil or hard.MoneyDropCapMax ~= nil)
        encounter.MoneyDropCapMin, encounter.MoneyDropCapMax = fixed, fixed
        if swapsHard then
            local narrowed = {}
            for key, value in pairs(hard) do narrowed[key] = value end
            narrowed.MoneyDropCapMin, narrowed.MoneyDropCapMax = fixed, fixed
            encounter.HardEncounterOverrideValues = narrowed
        end
        local result = pack(pcall(call, base, ...))
        -- Native generation leaves the effective (hard-overridden) bounds behind.
        if swapsHard then encounter.HardEncounterOverrideValues = hard end
        encounter.MoneyDropCapMin, encounter.MoneyDropCapMax = minimum, maximum
        if not result[1] then
            session.fault(state, 'run-modifiers:native-fault', 'native contact returns', tostring(result[2]))
            report(runtime)
            error(result[2], 0)
        end
        return table.unpack(result, 2, result.n)
    end)
    return { verifyNative = verifyNative }
end
return modifiers
