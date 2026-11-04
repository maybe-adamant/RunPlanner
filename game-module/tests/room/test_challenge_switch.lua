-- luacheck: globals TestChallengeSwitch
-- Challenge switch witnesses over the planner's switch fixtures: the spawn's
-- steering at its native draws, the room-entry proof and the state-based
-- outcome proof at room exit.
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local protocol = require("mods.protocol.decoder")
local switch = require("mods.room.features.challenge_switch")
local support = require("tests.harness.hook_composition")
local guide = require("mods.presentation.room_guide")
local text = require("mods.presentation.mismatch_text")

TestChallengeSwitch = {}

local function occurrenceOf(name, id)
    local plan = assert(protocol.decode(fixtures.decode(name .. ".execution.json")))
    return assert(plan.occurrencesById[id], id)
end

local function hitless() return occurrenceOf("underworld-f-switches", "golden-f-b5-e1") end
local function finished() return occurrenceOf("underworld-f-switches", "golden-f-b8-e1") end
local function failed() return occurrenceOf("underworld-f-switches-failed-left", "golden-f-b5-e1") end
local function left() return occurrenceOf("underworld-f-switches-failed-left", "golden-f-b8-e1") end
local function elite() return occurrenceOf("surface-p-elite-switch", "surface-p-6-1-p_combat10") end

local function nativeRoom(occurrence, fight)
    local planned = occurrence.overview.challengeSwitch
    local room = {
        Name = occurrence.gameName, __runPlannerExecutionRoomId = occurrence.id,
        ChallengeSwitch = { Name = planned.variantKey },
        ChallengeEncounter = { Name = planned.encounterKey },
    }
    if fight == nil then return room end
    room.StartedChallengeEncounter = true
    room.ChallengeEncounter.EncounterType = fight.type
    room.ChallengeEncounter.Completed = fight.completed
    room.ChallengeEncounter.InProgress = not fight.completed
    room.ChallengeEncounter.PlayerTookDamage = fight.hit
    room.ChallengeSwitch.IsOpen = fight.claimed
    if fight.claimed then room.__runPlannerChallengeLoot = { nectar = fight.nectar == true } end
    return room
end

function TestChallengeSwitch.testTheFixturesPublishEachOutcomeAndItsClaims()
    lu.assertEquals(switch.plannedOutcome(hitless()), "hitless")
    lu.assertTrue(switch.plannedNectar(hitless()))
    lu.assertEquals(switch.plannedOutcome(finished()), "finished")
    lu.assertFalse(switch.plannedNectar(finished()))
    lu.assertEquals(finished().overview.challengeSwitch.customization[1].kind, "generated")
    lu.assertEquals(switch.plannedOutcome(failed()), "failed")
    lu.assertEquals(switch.plannedOutcome(left()), "left")
    lu.assertEquals(elite().overview.challengeSwitch.elite.attributeKeys, { "Frenzy", "Blink" })
end

function TestChallengeSwitch.testEntryProvesThePlannedVariantAndEncounter()
    local occurrence = finished()
    lu.assertTrue(switch.prove(occurrence, nativeRoom(occurrence)))
    local other = nativeRoom(occurrence)
    other.ChallengeSwitch.Name = "PerfectClearChallengeSwitch_Pom"
    local ok, issue = switch.prove(occurrence, other)
    lu.assertNil(ok)
    lu.assertEquals(issue, { kind = "challengeSwitch", expected = "TimeChallengeSwitch_Money",
        observed = "PerfectClearChallengeSwitch_Pom" })
    local encounter = nativeRoom(occurrence)
    encounter.ChallengeEncounter.Name = "TimeChallengeG"
    ok, issue = switch.prove(occurrence, encounter)
    lu.assertNil(ok)
    lu.assertEquals(issue.kind, "challengeSwitchEncounter")
end

function TestChallengeSwitch.testExitProvesEachOutcomeFromNativeState()
    local cases = {
        { hitless(), { type = "PerfectClear", completed = true, claimed = true, nectar = true } },
        { finished(), { type = "TimeChallenge", completed = true, claimed = true, hit = true } },
        { failed(), { type = "PerfectClear", completed = true, claimed = true, hit = true } },
        { left(), { type = "TimeChallenge", completed = false } },
    }
    for _, case in ipairs(cases) do
        lu.assertTrue(switch.proveOutcome(case[1], nativeRoom(case[1], case[2])), case[1].id)
    end
end

function TestChallengeSwitch.testExitReportsADifferentFightEnding()
    local cases = {
        -- Pressed but never claimed, or never pressed.
        { hitless(), { type = "PerfectClear", completed = true, claimed = false }, "unclaimed" },
        { finished(), nil, "unused" },
        -- A planned hitless clear taken with a hit.
        { hitless(), { type = "PerfectClear", completed = true, claimed = true, hit = true }, "failed" },
        -- A planned left fight finished and claimed.
        { left(), { type = "TimeChallenge", completed = true, claimed = true }, "finished" },
    }
    for _, case in ipairs(cases) do
        local ok, issue = switch.proveOutcome(case[1], nativeRoom(case[1], case[2]))
        lu.assertNil(ok)
        lu.assertEquals(issue.kind, "challengeSwitchOutcome")
        lu.assertEquals(issue.observed, case[3])
    end
end

function TestChallengeSwitch.testNectarMustDropExactlyWhenPlanned()
    local missing = nativeRoom(hitless(), { type = "PerfectClear", completed = true, claimed = true, nectar = false })
    local ok, issue = switch.proveOutcome(hitless(), missing)
    lu.assertNil(ok)
    lu.assertEquals(issue, { kind = "challengeSwitchNectar", expected = true, observed = false })
    local unplanned = nativeRoom(finished(), { type = "TimeChallenge", completed = true, claimed = true, nectar = true })
    ok, issue = switch.proveOutcome(finished(), unplanned)
    lu.assertNil(ok)
    lu.assertEquals(issue, { kind = "challengeSwitchNectar", expected = false, observed = true })
end

-- The shipped hooks, a synchronized room and a scripted native spawn.
local function attached(occurrence)
    local module, _, callbacks = support.capture()
    local state = { state = "synchronized" }
    local active = { occurrence = occurrence }
    local diagnostics, phases = {}, {}
    local room = { current = function() return active end }
    local generated = {
        withSwitchEncounter = function(_, _, phase, action)
            phases[#phases + 1] = phase
            return action()
        end,
    }
    switch.attach(module, { diagnostic = function(_, _, observed) diagnostics[#diagnostics + 1] = observed end },
        function() return state end, function() end, room, generated)
    return callbacks, diagnostics, phases
end

local OBSTACLES = {
    TimeChallengeSwitch_Money = { EncounterOptionsName = "TimeChallengeEncounterOptions" },
    PerfectClearChallengeSwitch_Pom = { EncounterOptionsName = "PerfectClearEncounterOptions" },
    PerfectClearChallengeSwitch_MaxHealth = { EncounterOptionsName = "PerfectClearEncounterOptions" },
    EliteChallengeSwitch_MaxMana = { EncounterOptionsName = "EliteChallengeEncounterOptions" },
}

local function withGlobals(values, action)
    local prior = {}
    for key, value in pairs(values) do prior[key] = _G[key]; _G[key] = value end
    local ok, errorValue = pcall(action)
    for key in pairs(values) do _G[key] = prior[key] end
    if not ok then error(errorValue, 0) end
end

-- Native HandleSecretSpawns: the chance flag gates the switch; the variant and
-- its encounter are drawn, then the encounter's types for a generated one.
local function spawn(callbacks, run, options)
    return callbacks.HandleSecretSpawns(nil, {}, function(currentRun)
        local room = currentRun.CurrentRoom
        if not room.ChallengeChanceSuccess then return end
        local variant = callbacks.GetRandomValue(nil, {}, function(values) return values[1] end, options.variants)
        room.ChallengeSwitch = { Name = variant }
        local encounterOptions = room[OBSTACLES[variant].EncounterOptionsName]
        local encounter = callbacks.GetRandomValue(nil, {}, function(values) return values[1] end, encounterOptions)
        room.ChallengeEncounter = { Name = encounter }
        if options.eliteTypes then
            callbacks.FillEnemyTypes(nil, {}, function(generated)
                generated.Type = callbacks.RemoveRandomValue(nil, {}, function(values)
                    return table.remove(values, 1)
                end, options.eliteTypes)
            end, room.ChallengeEncounter)
        end
    end, run)
end

function TestChallengeSwitch.testTheSpawnRealizesThePlannedVariantAndEncounter()
    local occurrence = finished()
    local callbacks, diagnostics, phases = attached(occurrence)
    local room = { __runPlannerExecutionRoomId = occurrence.id, ChallengeChanceSuccess = false,
        TimeChallengeEncounterOptions = { "TimeChallengeF" } }
    withGlobals({ ObstacleData = OBSTACLES }, function()
        spawn(callbacks, { CurrentRoom = room }, {
            variants = { "PerfectClearChallengeSwitch_Pom", "TimeChallengeSwitch_Money" } })
    end)
    lu.assertTrue(room.ChallengeChanceSuccess)
    lu.assertEquals(room.ChallengeSwitch.Name, "TimeChallengeSwitch_Money")
    lu.assertEquals(room.ChallengeEncounter.Name, "TimeChallengeF")
    lu.assertEquals(diagnostics, {})
    -- The composed encounter is generated inside the switch's preparation scope.
    lu.assertEquals(phases[1].slotKey, "challengeSwitch")
    lu.assertIs(phases[1].customization, occurrence.overview.challengeSwitch.customization)
    lu.assertTrue(switch.prove(occurrence, room))
end

function TestChallengeSwitch.testARoomWithoutAPlannedSwitchSpawnsNone()
    local occurrence = occurrenceOf("underworld-f-switches", "golden-f-b6-e1")
    local callbacks = attached(occurrence)
    local room = { __runPlannerExecutionRoomId = occurrence.id, ChallengeChanceSuccess = true }
    withGlobals({ ObstacleData = OBSTACLES }, function()
        spawn(callbacks, { CurrentRoom = room }, { variants = { "TimeChallengeSwitch_Money" } })
    end)
    lu.assertFalse(room.ChallengeChanceSuccess)
    lu.assertNil(room.ChallengeSwitch)
end

function TestChallengeSwitch.testAnUnavailableVariantStaysNativeWithADiagnostic()
    local occurrence = finished()
    local callbacks, diagnostics = attached(occurrence)
    local room = { __runPlannerExecutionRoomId = occurrence.id,
        PerfectClearEncounterOptions = { "PerfectClearChallengeF" } }
    withGlobals({ ObstacleData = OBSTACLES }, function()
        spawn(callbacks, { CurrentRoom = room }, { variants = { "PerfectClearChallengeSwitch_Pom" } })
    end)
    lu.assertEquals(room.ChallengeSwitch.Name, "PerfectClearChallengeSwitch_Pom")
    lu.assertEquals(diagnostics[1].kind, "variant-unavailable")
    local ok, issue = switch.prove(occurrence, room)
    lu.assertNil(ok)
    lu.assertEquals(issue.kind, "challengeSwitch")
end

function TestChallengeSwitch.testAnEmptyOrUndeclaredDrawStaysNative()
    local occurrence = finished()
    local callbacks, diagnostics = attached(occurrence)
    local room = { __runPlannerExecutionRoomId = occurrence.id }
    withGlobals({ ObstacleData = OBSTACLES }, function()
        callbacks.HandleSecretSpawns(nil, {}, function()
            -- An empty list is not the variant draw.
            local empty = callbacks.GetRandomValue(nil, {}, function() return "native-empty" end, {})
            lu.assertEquals(empty, "native-empty")
            -- A native result outside the declarations stays native, with a diagnostic.
            local rolled = callbacks.GetRandomValue(nil, {}, function() return nil end,
                { "PerfectClearChallengeSwitch_Pom" })
            lu.assertNil(rolled)
            -- Nothing later is steered once the draw fell through.
            local later = callbacks.GetRandomValue(nil, {}, function(values) return values[1] end,
                { "TimeChallengeSwitch_Money" })
            lu.assertEquals(later, "TimeChallengeSwitch_Money")
        end, { CurrentRoom = room })
    end)
    lu.assertEquals(diagnostics[1].kind, "variant-unavailable")
    lu.assertEquals(diagnostics[2].kind, "variant-undeclared")
    lu.assertNil(room.__runPlannerChallengeVariant)
end

function TestChallengeSwitch.testAnEliteSwitchFieldsItsPinnedEliteAndForcedAttributes()
    local occurrence = elite()
    local nativeId = occurrence.overview.challengeSwitch.elite.enemy.nativeId
    local callbacks, diagnostics = attached(occurrence)
    local room = { __runPlannerExecutionRoomId = occurrence.id,
        EliteChallengeEncounterOptions = { "EliteChallengeP" } }
    withGlobals({ ObstacleData = OBSTACLES, CurrentRun = { CurrentRoom = room } }, function()
        spawn(callbacks, { CurrentRoom = room }, { variants = { "EliteChallengeSwitch_MaxMana" },
            eliteTypes = { "SatyrSapper_Elite", nativeId, "AutomatonBeamer_Elite" } })
        lu.assertEquals(room.ChallengeEncounter.Type, nativeId)
        -- The press starts the encounter, whose start draws the attributes.
        local drawn = {}
        callbacks.PickEliteAttributes(nil, {}, function()
            local options = { "Vacuuming", "Blink", "Frenzy", "Fog" }
            for _ = 1, 2 do
                drawn[#drawn + 1] = callbacks.RemoveRandomValue(nil, {}, function(values)
                    return table.remove(values, 1)
                end, options)
            end
        end, room.ChallengeEncounter, nativeId)
        lu.assertEquals(drawn, { "Frenzy", "Blink" })
        -- Another encounter's draws stay native.
        local native = callbacks.PickEliteAttributes(nil, {}, function()
            return callbacks.RemoveRandomValue(nil, {}, function(values) return table.remove(values, 1) end,
                { "Vacuuming", "Frenzy" })
        end, { Name = "Other" }, nativeId)
        lu.assertEquals(native, "Vacuuming")
    end)
    lu.assertEquals(diagnostics, {})
end

function TestChallengeSwitch.testTheClaimRecordsWhetherItsBonusNectarDropped()
    local occurrence = hitless()
    local callbacks = attached(occurrence)
    local room = {}
    withGlobals({ CurrentRun = { CurrentRoom = room } }, function()
        callbacks.HandleChallengeLoot(nil, {}, function()
            callbacks.CreateConsumableItem(nil, {}, function() end, 1, "GiftDrop", 0)
            callbacks.CreateConsumableItem(nil, {}, function() end, 2, "MaxHealthDrop", 0)
        end, {}, {})
    end)
    lu.assertEquals(room.__runPlannerChallengeLoot, { nectar = true })
    callbacks.CreateConsumableItem(nil, {}, function() end, 3, "GiftDrop", 0)
    lu.assertEquals(room.__runPlannerChallengeLoot, { nectar = true })
end

local function guideRows(occurrence)
    local projection = guide.project({ kind = "room", occurrence = occurrence,
        isCompleted = function() return false end, shrineProgress = function() return "pending" end })
    local rows = {}
    for _, row in ipairs(projection and projection.rows or {}) do rows[#rows + 1] = row.instruction end
    return rows
end

function TestChallengeSwitch.testTheGuideNamesHowThePlannedFightEnds()
    for _, case in ipairs({
        { hitless(), "Switch: clear unhit" }, { finished(), "Switch: clear" },
        { failed(), "Switch: clear, take hit" }, { left(), "Switch: leave mid-fight" },
    }) do
        local found = false
        for _, row in ipairs(guideRows(case[1])) do
            if type(row) == "string" and row == case[2] then found = true end
        end
        lu.assertTrue(found, case[1].id .. " " .. case[2])
    end
end

function TestChallengeSwitch.testMismatchesReadAsTheSwitchThatDiffered()
    lu.assertEquals(text.difference({ kind = "challengeSwitchOutcome", expected = "hitless", observed = "failed" }),
        "the challenge switch was cleared with a hit (planned cleared unhit)")
    lu.assertEquals(text.difference({ kind = "challengeSwitchNectar", expected = true, observed = false }),
        "the planned switch Nectar didn't drop")
    lu.assertEquals(text.difference({ kind = "feature", expected = "challengeSwitch", observed = false }),
        "the planned challenge switch didn't appear")
    lu.assertEquals(text.difference({ kind = "challengeSwitch", expected = "TimeChallengeSwitch_Money",
        observed = "PerfectClearChallengeSwitch_Pom" }),
        "planned switch Time Challenge Switch Money, found Perfect Clear Challenge Switch Pom")
end

return TestChallengeSwitch
