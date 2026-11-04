-- Challenge switches. The module steers only a planned switch's existence, its
-- variant, the encounter native rolls for it at entry (with that encounter's
-- composition or an Elite switch's elite and forced attributes) and so its
-- reward; the press and its outcome stay the player's. Room entry proves the
-- switch and room exit proves how its fight ended from native state, never from
-- the order of contacts.
-- luacheck: globals ObstacleData
local challengeSwitch = {}

local PRESS = "interactChallengeSwitch"
local CLAIM_PRODUCER = "ChallengeSwitchLoot"
local NECTAR = "GiftDrop"

local function name(value)
    return type(value) == "table" and (value.GenusName or value.Name) or nil
end

local function contains(values, wanted)
    for _, value in pairs(type(values) == "table" and values or {}) do
        if value == wanted then return true end
    end
    return false
end

local function obstacleData()
    local gameValue = _G.game or game
    return gameValue and gameValue.ObstacleData or _G.ObstacleData
end

-- The planned press's outcome, or nil when the plan leaves the switch unused.
function challengeSwitch.plannedOutcome(occurrence)
    for _, row in ipairs(occurrence and occurrence.roomGuide or {}) do
        if row.description and row.description.kind == PRESS then return row.description.outcome end
    end
    return nil
end

-- Whether the plan claims the claim's bonus Nectar.
function challengeSwitch.plannedNectar(occurrence)
    for _, transaction in ipairs(occurrence and occurrence.timeline and occurrence.timeline.transactions or {}) do
        if transaction.kind == "acquisition" and transaction.producerLifecycleKey == CLAIM_PRODUCER
            and transaction.reward and transaction.reward.rewardType == NECTAR then
            return true
        end
    end
    return false
end

-- Room entry: the switch native spawned is the planned variant with the planned
-- encounter. Its presence either way is the structural feature proof.
function challengeSwitch.prove(occurrence, nativeRoom)
    local planned = occurrence and occurrence.overview and occurrence.overview.challengeSwitch
    if planned == nil or type(nativeRoom) ~= "table" or nativeRoom.ChallengeSwitch == nil then return true end
    local variant = name(nativeRoom.ChallengeSwitch) or nativeRoom.__runPlannerChallengeVariant
    if variant ~= planned.variantKey then
        return nil, { kind = "challengeSwitch", expected = planned.variantKey, observed = variant }
    end
    local encounter = name(nativeRoom.ChallengeEncounter)
    if encounter ~= planned.encounterKey then
        return nil, { kind = "challengeSwitchEncounter", expected = planned.encounterKey, observed = encounter }
    end
    return true
end

-- How the switch's fight ended, read at room exit before native LeaveRoom
-- marks a running fight EndedEarly.
function challengeSwitch.observedOutcome(nativeRoom)
    if type(nativeRoom) ~= "table" or not nativeRoom.StartedChallengeEncounter then return nil end
    local encounter = nativeRoom.ChallengeEncounter
    if type(encounter) ~= "table" or encounter.Completed ~= true then return "left" end
    local switch = nativeRoom.ChallengeSwitch
    if type(switch) ~= "table" or switch.IsOpen ~= true then return "unclaimed" end
    if encounter.EncounterType == "PerfectClear" then
        return encounter.PlayerTookDamage and "failed" or "hitless"
    end
    return "finished"
end

-- Room exit: the planned press happened and ended as planned, and the bonus
-- Nectar dropped exactly when planned. A Time or Elite claim's hit only decides
-- the Nectar, so it is read through it.
function challengeSwitch.proveOutcome(occurrence, nativeRoom)
    if occurrence == nil or occurrence.overview == nil or occurrence.overview.challengeSwitch == nil then
        return true
    end
    local planned = challengeSwitch.plannedOutcome(occurrence)
    local observed = challengeSwitch.observedOutcome(nativeRoom)
    if planned ~= observed then
        return nil, { kind = "challengeSwitchOutcome", expected = planned or "unused", observed = observed or "unused" }
    end
    if planned ~= nil and planned ~= "left" then
        local claim = type(nativeRoom) == "table" and nativeRoom.__runPlannerChallengeLoot or nil
        local nectar = claim ~= nil and claim.nectar == true
        if nectar ~= challengeSwitch.plannedNectar(occurrence) then
            return nil, { kind = "challengeSwitchNectar", expected = challengeSwitch.plannedNectar(occurrence),
                observed = nectar }
        end
    end
    return true
end

-- The switch's encounter as a generated phase, for the composition pipeline.
function challengeSwitch.phase(occurrence)
    local planned = occurrence and occurrence.overview and occurrence.overview.challengeSwitch
    if planned == nil then return nil end
    return { slotKey = "challengeSwitch", encounterKey = planned.encounterKey, customization = planned.customization }
end

function challengeSwitch.attach(module, session, getState, report, room, generatedEncounter)
    local spawnScope, eliteScope, attributeScope, lootScope

    local function diagnostic(state, occurrence, observed)
        if session.diagnostic then session.diagnostic(state, "challenge-switch", observed, occurrence) end
    end

    -- HandleSecretSpawns rolls existence from the room's creation-time chance
    -- flag, then the variant, its encounter and that encounter's roster.
    module.hooks.wrap("HandleSecretSpawns", "run-planner-challenge-switch-spawn", function(_, runtime, base,
        currentRun, ...)
        local state = getState(runtime)
        local nativeRoom = type(currentRun) == "table" and currentRun.CurrentRoom or nil
        local active = state and room.current(state) or nil
        if state == nil or state.state ~= "synchronized" or active == nil or type(nativeRoom) ~= "table"
            or nativeRoom.__runPlannerExecutionRoomId ~= active.occurrence.id then
            return base(currentRun, ...)
        end
        local occurrence = active.occurrence
        local planned = occurrence.overview.challengeSwitch
        -- Only the flag's read is steered; its native draw already happened at creation.
        nativeRoom.ChallengeChanceSuccess = planned ~= nil
        if planned == nil then return base(currentRun, ...) end
        -- CreateRoom rolls G's extra-exit lock only without a switch, so a switch room never locks.
        nativeRoom.LockExtraExits = nil
        local prior = spawnScope
        spawnScope = { state = state, occurrence = occurrence, planned = planned, room = nativeRoom, stage = "variant" }
        local args = table.pack(...)
        local ok, result = pcall(function()
            return generatedEncounter.withSwitchEncounter(state, occurrence, challengeSwitch.phase(occurrence),
                function() return base(currentRun, table.unpack(args, 1, args.n)) end)
        end)
        local scope = spawnScope
        spawnScope = prior
        if not ok then error(result, 0) end
        if scope.stage == "variant" then
            diagnostic(state, occurrence, { kind = "switch-not-rolled", expected = planned.variantKey })
        end
        report(runtime)
        return result
    end)

    module.hooks.wrap("GetRandomValue", "run-planner-challenge-switch-choice", function(_, _, base, values, ...)
        local scope = spawnScope
        if scope == nil or type(values) ~= "table" then return base(values, ...) end
        if scope.stage == "variant" then
            local data = obstacleData()
            -- Only a nonempty list of declared switch variants is the variant draw.
            if next(values) == nil or type(data) ~= "table" then return base(values, ...) end
            for _, value in pairs(values) do
                if type(value) ~= "string" or type(data) ~= "table" or type(data[value]) ~= "table"
                    or data[value].EncounterOptionsName == nil then
                    return base(values, ...)
                end
            end
            -- Native consumes its draw; the planned variant replaces only the result.
            local rolled = base(values, ...)
            local chosen = contains(values, scope.planned.variantKey) and scope.planned.variantKey or rolled
            if chosen ~= scope.planned.variantKey then
                diagnostic(scope.state, scope.occurrence, { kind = "variant-unavailable",
                    expected = scope.planned.variantKey, observed = rolled })
            end
            local declared = chosen ~= nil and data[chosen] or nil
            if type(declared) ~= "table" then
                -- A native result outside the declarations stays native; nothing later is steered.
                diagnostic(scope.state, scope.occurrence, { kind = "variant-undeclared",
                    expected = scope.planned.variantKey, observed = rolled })
                scope.stage = "spawned"
                return rolled
            end
            scope.room.__runPlannerChallengeVariant = chosen
            scope.stage = "encounter"
            scope.options = scope.room[declared.EncounterOptionsName]
            return chosen
        end
        if scope.stage == "encounter" and values == scope.options then
            local rolled = base(values, ...)
            scope.stage = "spawned"
            if contains(values, scope.planned.encounterKey) then return scope.planned.encounterKey end
            diagnostic(scope.state, scope.occurrence, { kind = "encounter-unavailable",
                expected = scope.planned.encounterKey, observed = rolled })
            return rolled
        end
        return base(values, ...)
    end)

    -- An Elite switch's one generated type is its pinned elite.
    module.hooks.wrap("FillEnemyTypes", "run-planner-challenge-switch-elite", function(_, _, base, encounter, ...)
        local scope = spawnScope
        local elite = scope and scope.planned.elite
        if elite == nil or type(encounter) ~= "table" or encounter.Name ~= scope.planned.encounterKey then
            return base(encounter, ...)
        end
        local prior = eliteScope
        eliteScope = { nativeId = elite.enemy.nativeId, scope = scope }
        local ok, result = pcall(base, encounter, ...)
        local missed = eliteScope and not eliteScope.placed
        eliteScope = prior
        if not ok then error(result, 0) end
        if missed then
            diagnostic(scope.state, scope.occurrence, { kind = "elite-unavailable", expected = elite.enemy.nativeId })
        end
        return result
    end)

    -- The press starts the encounter, whose start draws the forced attribute prefix.
    module.hooks.wrap("PickEliteAttributes", "run-planner-challenge-switch-attributes", function(_, runtime, base,
        encounter, enemyType)
        local state = getState(runtime)
        local active = state and room.current(state) or nil
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local planned = active and active.occurrence.overview.challengeSwitch
        local elite = planned and planned.elite
        if state == nil or state.state ~= "synchronized" or elite == nil or type(nativeRoom) ~= "table"
            or encounter ~= nativeRoom.ChallengeEncounter or enemyType ~= elite.enemy.nativeId then
            return base(encounter, enemyType)
        end
        local prior = attributeScope
        attributeScope = { keys = elite.attributeKeys, index = 1, missed = {} }
        local ok, result = pcall(base, encounter, enemyType)
        local scope = attributeScope
        attributeScope = prior
        if not ok then error(result, 0) end
        for index = scope.index, #scope.keys do scope.missed[#scope.missed + 1] = scope.keys[index] end
        if #scope.missed > 0 then
            diagnostic(state, active.occurrence, { kind = "attributes-unavailable", expected = scope.missed })
        end
        return result
    end)

    module.hooks.wrap("RemoveRandomValue", "run-planner-challenge-switch-draws", function(_, _, base, values, ...)
        if type(values) ~= "table" then return base(values, ...) end
        local elite = eliteScope
        if elite ~= nil and not elite.placed and contains(values, elite.nativeId) then
            for index, value in ipairs(values) do
                if value == elite.nativeId then
                    table.remove(values, index)
                    elite.placed = true
                    return value
                end
            end
        end
        local attributes = attributeScope
        local wanted = attributes and attributes.keys[attributes.index]
        if wanted ~= nil then
            for index, value in ipairs(values) do
                if value == wanted then
                    table.remove(values, index)
                    attributes.index = attributes.index + 1
                    return value
                end
            end
            -- A forced draw the native options lack stops the prefix; later draws stay native.
            for later = attributes.index, #attributes.keys do attributes.missed[#attributes.missed + 1] = attributes.keys[later] end
            attributes.index = #attributes.keys + 1
        end
        return base(values, ...)
    end)

    -- The claim spawns its loot directly; record whether the bonus Nectar dropped.
    module.hooks.wrap("HandleChallengeLoot", "run-planner-challenge-switch-claim", function(_, _, base,
        switch, encounter)
        local nativeRoom = _G.CurrentRun and _G.CurrentRun.CurrentRoom
        local prior = lootScope
        lootScope = { nectar = false }
        local ok, result = pcall(base, switch, encounter)
        local scope = lootScope
        lootScope = prior
        if not ok then error(result, 0) end
        if type(nativeRoom) == "table" then nativeRoom.__runPlannerChallengeLoot = { nectar = scope.nectar } end
        return result
    end)

    module.hooks.wrap("CreateConsumableItem", "run-planner-challenge-switch-loot", function(_, _, base,
        consumableId, consumableName, ...)
        if lootScope ~= nil and consumableName == NECTAR then lootScope.nectar = true end
        return base(consumableId, consumableName, ...)
    end)
end

return challengeSwitch
