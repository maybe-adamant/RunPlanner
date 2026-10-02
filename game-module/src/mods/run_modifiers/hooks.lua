-- Run-wide actuators. Native calculations, blockers, damage application and
-- money accounting remain native; only the verified roll/drop input is changed.
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
        if s and s.kind == 'damage' and s.stage ~= 'crit' and s.stage ~= 'done'
            and s.stage ~= 'unsupported' then diagnostic(s, 'incomplete damage roll sequence') end
        if s and s.kind == 'kill' and not s.consumed and type(s.data) == 'table'
            and type(s.data.Chance) == 'number' and s.data.Chance > 0
            and not s.data.IgnoreRoomMoneyStore then diagnostic(s, 'missing death-drop contact') end
        return table.unpack(result, 2, result.n)
    end
    local verifiedPlan, verifiedRun
    local function verifyNative(state)
        local settings = options(state)
        if not settings or (not settings.guaranteeEligibleCrits and not settings.guaranteeEligibleDoubleDamage
            and settings.enemyGoldDropChanceMultiplier == 1) then return true end
        if verifiedPlan == state.plan and verifiedRun == state.admittedNativeRun then return true end
        local names = {}
        if settings.guaranteeEligibleCrits or settings.guaranteeEligibleDoubleDamage then
            names = { 'Damage', 'CalculateCritChance', 'CalculateDoubleDamageChance', 'GetTotalHeroTraitValue', 'RandomChance' }
        end
        if settings.enemyGoldDropChanceMultiplier > 1 then
            names[#names + 1], names[#names + 2] = 'Kill', 'CheckMoneyDrop'
        end
        for _, name in ipairs(names) do
            if type(_G[name]) ~= 'function' then
                session.fault(state, 'run-modifiers:missing-native', name, type(_G[name]))
                return nil
            end
        end
        verifiedPlan, verifiedRun = state.plan, state.admittedNativeRun
        return true
    end
    module.hooks.wrap('Damage', 'run-planner-modifier-damage', function(_, runtime, base, ...)
        local victim, args = ...
        local state = getState(runtime)
        local settings = options(state)
        local s
        if settings and (settings.guaranteeEligibleCrits or settings.guaranteeEligibleDoubleDamage)
            and type(args) == 'table' and args.AttackerTable == _G.CurrentRun.Hero
            and victim ~= _G.CurrentRun.Hero then
            s = { kind = 'damage', state = state, runtime = runtime, settings = settings,
                victim = victim, args = args, stage = 'crit' }
            for _, name in ipairs({ 'CalculateCritChance', 'CalculateDoubleDamageChance', 'GetTotalHeroTraitValue', 'RandomChance' }) do
                if type(_G[name]) ~= 'function' then
                    session.fault(state, 'run-modifiers:missing-native', name, type(_G[name]))
                    report(runtime)
                    return base(...)
                end
            end
        end
        if not s and not scope() then return base(...) end
        return scoped(s, base, ...)
    end)
    local function calculation(name, expected, following)
        module.hooks.wrap(name, 'run-planner-modifier-' .. name, function(_, _, base, ...)
            local attacker, victim, _, args = ...
            local s = scope()
            if not s or s.kind ~= 'damage' then return base(...) end
            local matches = s.stage == expected and attacker == _G.CurrentRun.Hero and victim == s.victim and args == s.args
            local result = pack(scoped(nil, base, ...))
            if matches then s.stage = following else s.stage = 'unsupported' diagnostic(s, name) end
            return table.unpack(result, 1, result.n)
        end)
    end
    calculation('CalculateCritChance', 'crit', 'double')
    calculation('CalculateDoubleDamageChance', 'double', 'luck')
    module.hooks.wrap('GetTotalHeroTraitValue', 'run-planner-modifier-bonuses', function(_, _, base, ...)
        local property, args = ...
        local s = scope()
        if not s or s.kind ~= 'damage' then return base(...) end
        local result = pack(scoped(nil, base, ...))
        if s.stage == 'luck' and property == 'LuckMultiplier' and type(args) == 'table' and args.IsMultiplier == true then
            s.stage = 'bonus'
        elseif s.stage == 'bonus' and property == 'OutgoingUnmodifiedCritBonus' then
            s.stage = 'crit-roll'
        elseif s.stage ~= 'crit' and s.stage ~= 'done' then
            s.stage = 'unsupported'
            diagnostic(s, property)
        end
        return table.unpack(result, 1, result.n)
    end)
    module.hooks.wrap('RandomChance', 'run-planner-modifier-rolls', function(_, _, base, ...)
        local chance = ...
        local s = scope()
        -- Mask the native RNG body too: nested callbacks cannot consume this roll.
        local result
        if s then result = pack(scoped(nil, base, ...)) else return base(...) end
        if s.kind == 'damage' then
            local guarantee
            if s.stage == 'crit-roll' then
                guarantee, s.stage = s.settings.guaranteeEligibleCrits, 'double-roll'
            elseif s.stage == 'double-roll' then
                guarantee, s.stage = s.settings.guaranteeEligibleDoubleDamage, 'done'
            elseif s.stage ~= 'crit' and s.stage ~= 'done' then
                s.stage = 'unsupported' diagnostic(s, 'unexpected RandomChance')
            end
            if guarantee and type(chance) == 'number' and chance > 0 and options(s.state) == s.settings then result[1] = true end
        end
        return table.unpack(result, 1, result.n)
    end)
    module.hooks.wrap('Kill', 'run-planner-modifier-kill', function(_, runtime, base, ...)
        local victim, args = ...
        local state = getState(runtime)
        local settings = options(state)
        local s
        if settings and settings.enemyGoldDropChanceMultiplier > 1 and type(victim) == 'table'
            and victim ~= _G.CurrentRun.Hero and not victim.IsDead
            and victim.DamageType == 'Enemy' and victim.AddToEnemyTeam == true
            and not victim.Charmed and not victim.AlwaysTraitor
            and (_G.ActiveEnemies or {})[victim.ObjectId] == victim then
            s = { kind = 'kill', state = state, runtime = runtime, settings = settings,
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
        if s and s.kind == 'kill' and not s.consumed and select('#', ...) == 3
            and s.victim == victim and s.data == data and s.killer == killer then
            s.consumed = true
            if options(s.state) == s.settings and type(data) == 'table' and type(data.Chance) == 'number'
                and data.Chance > 0 and not data.IgnoreRoomMoneyStore and encounter and type(encounter.MoneyDropStore) == 'number' then
                local copy = {}
                for key, value in pairs(data) do copy[key] = value end
                copy.Chance = math.min(1, data.Chance * s.settings.enemyGoldDropChanceMultiplier)
                local arguments = pack(...)
                arguments[2] = copy
                return scoped(nil, base, table.unpack(arguments, 1, arguments.n))
            end
        end
        if s then return scoped(nil, base, ...) end
        return base(...)
    end)
    return { verifyNative = verifyNative }
end
return modifiers
