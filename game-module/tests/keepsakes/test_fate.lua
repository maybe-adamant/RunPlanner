-- luacheck: globals TestKeepsakeFate
local lu = require("luaunit")
local nativeGame = require("tests/harness/native_game")
local fate = require("mods.keepsakes.fate")

TestKeepsakeFate = {}

-- A Fated run, its hero and the native fate contacts; UpdateFateStatus is the
-- native rule for a living hero.
local function world(lastAward, traits)
    local hero = { Traits = traits }
    local gameState = { FatedStatus = "Fated", LastAwardTrait = lastAward }
    local removed = {}
    local restore = nativeGame.install({
        GameState = gameState,
        FatedDisableKeepsakes = { AthenaEncounterKeepsake = true },
        RemoveTrait = function(_, name)
            for index, trait in ipairs(hero.Traits) do
                if trait.Name == name then table.remove(hero.Traits, index) break end
            end
            removed[#removed + 1] = name
        end,
        UpdateFateStatus = function()
            if _G.FatedDisableKeepsakes[gameState.LastAwardTrait] then gameState.FatedStatus = "Unfated" end
        end,
    })
    return { Hero = hero }, gameState, removed, restore
end

function TestKeepsakeFate.testFinishesAnInterruptedRackCloseToAFatedDisablingKeepsake()
    local run, gameState, removed, restore = world("AthenaEncounterKeepsake", {
        { Name = "HadesAndPersephoneKeepsake" }, { Name = "HadesDashSweepBoon", GrantedTrait = true },
    })
    fate.finishClose(run)
    restore()
    lu.assertEquals({ gameState.FatedStatus, removed }, { "Unfated", { "HadesDashSweepBoon" } })
end

function TestKeepsakeFate.testLeavesASettledOrStillFatedRunAlone()
    local run, gameState, removed, restore = world("HadesAndPersephoneKeepsake", {
        { Name = "HadesAndPersephoneKeepsake" }, { Name = "HadesDashSweepBoon", GrantedTrait = true },
    })
    fate.finishClose(run)
    restore()
    lu.assertEquals({ gameState.FatedStatus, removed, #run.Hero.Traits }, { "Fated", {}, 2 })
end
