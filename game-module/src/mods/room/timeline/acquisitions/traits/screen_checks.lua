-- Checks of one published trait screen at screen open: the order-sensitive
-- state the planner expects, and row legality through native helpers.
local readers = type(import) == "function" and import("mods/room/conformance/readers.lua")
    or require("mods.room.conformance.readers")

local checks = {}

-- A helper the host does not define is skipped; a raised error is reported.
local function nativeCall(problems, name, ...)
    local fn = _G[name]
    if type(fn) ~= "function" then return false end
    local ok, result = pcall(fn, ...)
    if not ok then
        problems[#problems + 1] = { fault = true, expected = name, observed = tostring(result) }
        return false
    end
    return true, result
end

local function compare(problems, checkpoint, expected, observed)
    if observed ~= expected then
        problems[#problems + 1] = { checkpoint = checkpoint, expected = expected, observed = observed }
    end
end

local function rowProblem(problems, key, reason)
    problems[#problems + 1] = { checkpoint = "trait-screen-row", expected = key, observed = reason }
end

local function traitUses(problems, property)
    local ok, trait = nativeCall(problems, "HasHeroTraitValue", property)
    if not ok then return nil end
    return type(trait) == "table" and (trait.Uses or 0) or 0
end

local function liveYarnUses()
    local ok, well = pcall(readers.read, "stygianWell", _G.CurrentRun)
    return ok and type(well) == "table" and well.yarnUses or nil
end

local function godLoot(loot)
    return loot.GodLoot == true or loot.TreatAsGodLootByShops == true
end

-- A requirements copy without ChanceToPlay, which IsGameStateEligible rolls
-- through RandomChance (RequirementsLogic.lua:35-40).
local function withoutChance(requirements)
    if type(requirements) ~= "table" or requirements.ChanceToPlay == nil then return requirements end
    local copy = {}
    for key, value in pairs(requirements) do
        if key ~= "ChanceToPlay" then copy[key] = value end
    end
    return copy
end

local function withoutChanceData(data)
    if type(data) ~= "table" or type(data.GameStateRequirements) ~= "table"
        or data.GameStateRequirements.ChanceToPlay == nil then
        return data
    end
    local copy = {}
    for key, value in pairs(data) do copy[key] = value end
    copy.GameStateRequirements = withoutChance(data.GameStateRequirements)
    return copy
end

-- The rarify source a menu reads, in native precedence: a source naming this
-- loot wins over the general one (UpgradeChoiceLogic.lua:1377-1402).
local function rarifyUses(problems, loot)
    local hero = _G.CurrentRun and _G.CurrentRun.Hero
    local source
    for _, trait in ipairs(type(hero) == "table" and hero.Traits or {}) do
        local upgrade = type(trait) == "table" and trait.RarityUpgradeData or nil
        if type(upgrade) == "table" then
            if upgrade.LootName == nil and godLoot(loot)
                and (not upgrade.RequireNotExcludeFromLastRunBoon or not loot.ExcludeFromLastRunBoon) then
                source = upgrade
            end
            if loot.Name == upgrade.LootName then
                source = upgrade
                break
            end
        end
    end
    if source == nil then return 0 end
    if source.RequireFated then
        local ok, fated = nativeCall(problems, "IsFateValid")
        if not ok then return nil end
        if not fated then return 0 end
    end
    return source.Uses or 0
end

-- Each published field against live trait uses and the loot flags the screen
-- close reads (UpgradeChoiceLogic.lua:1124-1144). Loot flags only ever turn on,
-- so a spend also needs its effect still held. `loot` is absent without a carrier.
function checks.expectation(expectation, loot)
    local problems = {}
    if type(expectation) ~= "table" then return problems end
    local hymn = (expectation.hymnUses ~= nil or expectation.consumesHymn ~= nil)
        and traitUses(problems, "ForceSwaps") or nil
    local yarn = (expectation.yarnUses ~= nil or expectation.consumesYarn ~= nil) and liveYarnUses() or nil
    if expectation.hymnUses ~= nil and hymn ~= nil then
        compare(problems, "trait-screen-hymn", expectation.hymnUses, hymn)
    end
    if expectation.yarnUses ~= nil and yarn ~= nil then
        compare(problems, "trait-screen-yarn", expectation.yarnUses, yarn)
    end
    if loot ~= nil then
        if expectation.consumesHymn ~= nil and hymn ~= nil then
            compare(problems, "trait-screen-hymn-spend", expectation.consumesHymn,
                loot.UseSwapTrait == true and hymn > 0)
        end
        if expectation.consumesYarn ~= nil and yarn ~= nil then
            compare(problems, "trait-screen-yarn-spend", expectation.consumesYarn,
                loot.RarityBoosted == true and loot.ForceCommonWithoutCurse ~= true and yarn > 0)
        end
        if expectation.consumesOrdinary ~= nil then
            local ok, cursed = nativeCall(problems, "HeroHasTrait", "ChaosCommonCurse")
            if ok then
                compare(problems, "trait-screen-ordinary-spend", expectation.consumesOrdinary,
                    loot.ForceCommon == true and loot.ForceCommonWithoutCurse ~= true and cursed == true)
            end
        end
    end
    if expectation.concaveStone ~= nil then
        local uses = traitUses(problems, "DoubleBoonChance")
        if uses ~= nil then
            compare(problems, "trait-screen-concave-stone", expectation.concaveStone.uses, uses)
        end
        if loot ~= nil then
            compare(problems, "trait-screen-concave-stone-giver", expectation.concaveStone.giverProcs,
                godLoot(loot) and loot.BlockDoubleBoon ~= true)
        end
    end
    if expectation.rarifyUses ~= nil and loot ~= nil then
        local uses = rarifyUses(problems, loot)
        if uses ~= nil then compare(problems, "trait-screen-rarify", expectation.rarifyUses, uses) end
    end
    if expectation.rarityFloor ~= nil then
        local ok, trait = nativeCall(problems, "GetHeroTrait", "ElementalRarityUpgradeBoon")
        if ok then
            compare(problems, "trait-screen-rarity-floor", expectation.rarityFloor,
                type(trait) == "table" and trait.Activated == true)
        end
    end
    return problems
end

local function eligible(problems, key)
    if type(_G.TraitData) ~= "table" then return nil end
    local data = _G.TraitData[key]
    if data == nil then
        rowProblem(problems, key, "unknown trait")
        return nil
    end
    local ok, result = nativeCall(problems, "IsTraitEligible", withoutChanceData(data))
    if ok and result ~= true then rowProblem(problems, key, "IsTraitEligible") end
    return data
end

local function held(problems, key)
    local ok, result = nativeCall(problems, "HeroHasTrait", key)
    return ok and result == true
end

local function slotFilled(problems, data)
    if type(data) ~= "table" or data.Slot == nil then return false end
    local ok, result = nativeCall(problems, "HeroSlotFilled", data.Slot)
    return ok and result == true
end

local function heldTraitCount(problems, key)
    if type(_G.GetTraitCount) ~= "function" then return nil end
    local ok, count = pcall(function() return _G.GetTraitCount(_G.CurrentRun.Hero, { Name = key }) end)
    if not ok then
        problems[#problems + 1] = { fault = true, expected = "GetTraitCount", observed = tostring(count) }
        return nil
    end
    return count
end

-- Ordinary, Hermes, Hammer and encounter god rows, as native generation filters them.
function checks.ordinaryRows(offer, loot)
    local problems = {}
    if type(offer) ~= "table" or offer.kind ~= "traits" then return problems end
    local strip = type(loot) == "table" and loot.StripRequirements == true
    for _, option in ipairs(offer.options or {}) do
        local key = option.key
        local replacement = option.replacement
        if held(problems, key) then rowProblem(problems, key, "held") end
        local data = strip and (type(_G.TraitData) == "table" and _G.TraitData[key]) or eligible(problems, key)
        if replacement ~= nil then
            if not held(problems, replacement.replacedTraitKey) then
                rowProblem(problems, key, "exchange target not held")
            end
            local ok, upgraded = nativeCall(problems, "GetUpgradedRarity", replacement.oldRarity)
            if ok and upgraded == nil then rowProblem(problems, key, "exchange rarity cannot upgrade") end
            if option.effectiveLevel ~= nil then
                local count = heldTraitCount(problems, replacement.replacedTraitKey)
                local bonusOk, bonus = nativeCall(problems, "GetTotalHeroTraitValue", "ExchangeLevelBonus")
                if count ~= nil and bonusOk then
                    compare(problems, "trait-screen-exchange-level", option.effectiveLevel, count + bonus)
                end
            end
        else
            if data ~= nil and not strip and type(_G.TraitRequirements) == "table"
                and _G.TraitRequirements[key] ~= nil then
                local ok, met = nativeCall(problems, "HasTraitRequirements", key)
                if ok and met ~= true then rowProblem(problems, key, "HasTraitRequirements") end
            end
            if slotFilled(problems, data) then rowProblem(problems, key, "slot filled") end
        end
    end
    return problems
end

-- An ordinary screen's expectation, then its rows.
function checks.ordinaryScreen(offer, loot)
    local problems = checks.expectation(offer and offer.expectation, loot)
    for _, problem in ipairs(checks.ordinaryRows(offer, loot)) do problems[#problems + 1] = problem end
    return problems
end

-- The native Pom level count, read before the published count replaces it
-- (UpgradeChoiceLogic.lua:135-143).
function checks.pomLevel(level, loot)
    local problems = {}
    if type(level) ~= "table" or type(loot) ~= "table" then return problems end
    local stackNum = loot.StackNum or 1
    local ok, fated = nativeCall(problems, "IsFateValid")
    if not ok then return problems end
    if fated then
        local bonusOk, bonus = nativeCall(problems, "GetTotalHeroTraitValue", "FatedPomLevelBonus")
        if not bonusOk then return problems end
        stackNum = stackNum + bonus
    end
    compare(problems, "trait-screen-pom-level", level.levelCount, stackNum)
    return problems
end

-- Chaos rows pass native GetEligibleTransformingTrait (TraitLogic.lua:1700-1708).
function checks.chaosRows(offer)
    local problems = {}
    if type(offer) ~= "table" or offer.kind ~= "chaos" then return problems end
    eligible(problems, offer.blessingKey)
    for _, option in ipairs(offer.curseOptions or {}) do eligible(problems, option.curseKey) end
    return problems
end

-- Spell rows pass native GetEligibleSpells, which returns an already chosen
-- set unfiltered (SpellScreenLogic.lua:138-150).
function checks.spellRows(names, screen)
    local problems = {}
    if type(_G.SpellData) ~= "table" then return problems end
    if type(screen) == "table" and screen.StripRequirements then return problems end
    local session = _G.SessionMapState
    if type(session) == "table" and type(session.SelectedSpells) == "table"
        and next(session.SelectedSpells) ~= nil then
        return problems
    end
    for _, name in ipairs(names or {}) do
        local spell = _G.SpellData[name]
        if type(spell) ~= "table" then
            rowProblem(problems, name, "unknown spell")
        elseif spell.GameStateRequirements ~= nil then
            local ok, met = nativeCall(problems, "IsGameStateEligible", spell,
                withoutChance(spell.GameStateRequirements))
            if ok and met ~= true then rowProblem(problems, name, "IsGameStateEligible") end
        end
    end
    return problems
end

-- Echo's last-run rows pass native EchoLastRunBoon's filter (EventLogic.lua:1597-1611).
function checks.echoLastRunRows(nested)
    local problems = {}
    if type(nested) ~= "table" then return problems end
    for _, row in ipairs(nested.options or {}) do
        local key = row.key
        if held(problems, key) then rowProblem(problems, key, "held") end
        local data = eligible(problems, key)
        local ok, god = nativeCall(problems, "IsGodTrait", key, { ForShop = true, ForLastRunBoon = true })
        if ok and not god then rowProblem(problems, key, "IsGodTrait") end
        if slotFilled(problems, data) then rowProblem(problems, key, "slot filled") end
        if type(data) == "table" and data.ExcludeTraitFromLastRunBoonPool then
            rowProblem(problems, key, "excluded from last-run pool")
        end
    end
    for _, problem in ipairs(checks.expectation(nested.expectation)) do problems[#problems + 1] = problem end
    return problems
end

-- Native NPC choices drop any option whose GameStateRequirements fail. Returns
-- the first ineligible row, or nil plus the error when the native call fails.
function checks.npcRows(options, source)
    for _, option in ipairs(options) do
        local requirements = option.GameStateRequirements
        if requirements ~= nil then
            local ok, met = pcall(_G.IsGameStateEligible, source, withoutChance(requirements))
            if not ok then return nil, tostring(met) end
            if met ~= true then return option.ItemName end
        end
    end
    return nil
end

-- The first finding stops the plan: a native error is an executor fault, any
-- other difference a mismatch. Returns whether one was raised.
function checks.report(session, state, problems)
    local problem = problems and problems[1]
    if problem == nil then return false end
    if problem.fault then
        session.fault(state, {
            outcome = "fault", checkpoint = "native-api", expected = problem.expected, observed = problem.observed,
        })
    else
        session.mismatch(state, problem.checkpoint, problem.expected, problem.observed)
    end
    return true
end

return checks
