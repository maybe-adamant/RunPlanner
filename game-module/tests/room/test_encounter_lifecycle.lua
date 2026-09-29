-- Encounter lifecycle compatibility at post-selection binding and room entry.
-- Declarations below copy the inherited native values of the compared fields;
-- tests/probes/test_encounter_lifecycle_native.lua resolves the real ones.
-- luacheck: globals TestEncounterLifecycle
local lu = require("luaunit")
local compatibility = require("mods.room.timeline.encounters.compatibility")
local coordinator = require("mods.room.coordinator")
local encounterHooks = require("mods.room.timeline.encounters.hooks")
local arachne = require("mods.room.timeline.encounters.arachne")

TestEncounterLifecycle = {}

local ships = { FunctionName = "ShipsEncounterSetup" }
local heracles = { FunctionName = "BeginHeraclesEncounter" }

local function declarations()
    return {
        GeneratedF = {
            Name = "GeneratedF", EncounterType = "Default", CountsForRoomEncounterDepth = true,
            CanEncounterSkip = true, PreSpawnEnemies = true, BlockAthenaEncounterKeepsake = false,
        },
        -- Enemy introductions carry different rosters, requirements and seeds.
        GuardIntro = {
            Name = "GuardIntro", EncounterType = "Default", CountsForRoomEncounterDepth = true,
            CanEncounterSkip = true, PreSpawnEnemies = true, BlockAthenaEncounterKeepsake = false,
            EnemySet = { "Guard" }, GameStateRequirements = { { Path = { "Intro" } } },
            SpawnWaves = { { Spawns = { { Name = "Guard", TotalCount = 4 } } } },
        },
        GeneratedO_Intro01 = {
            Name = "GeneratedO_Intro01", EncounterType = "Default", CountsForRoomEncounterDepth = false,
            CanEncounterSkip = true, PreSpawnEnemies = true, BlockAthenaEncounterKeepsake = true,
            DelayedStart = false, SkipShipsEncounterSetup = true, UnthreadedEvents = { ships },
        },
        HeraclesCombatO = {
            Name = "HeraclesCombatO", EncounterType = "Default", CountsForRoomEncounterDepth = true,
            CanEncounterSkip = false, PreSpawnEnemies = false, BlockAthenaEncounterKeepsake = true,
            DelayedStart = true, SkipShipsEncounterSetup = true, UnthreadedEvents = { ships, heracles },
        },
        GeneratedP_PreCombat = {
            Name = "GeneratedP_PreCombat", EncounterType = "Default", CountsForRoomEncounterDepth = false,
            SkipEndEncounterEffects = true, CanEncounterSkip = true, CanEncounterSkipIfNotFirst = false,
            PreSpawnEnemies = true, BlockAthenaEncounterKeepsake = true,
            CheckAthenaEncounterKeepsakeOnSkipEncounterStart = true, DelayedStart = false,
        },
        GeneratedP = {
            Name = "GeneratedP", EncounterType = "Default", CountsForRoomEncounterDepth = true,
            CanEncounterSkip = true, CanEncounterSkipIfNotFirst = false, PreSpawnEnemies = false,
            BlockAthenaEncounterKeepsake = false, CheckAthenaEncounterKeepsakeOnSkipEncounterStart = true,
        },
        GeneratedH = {
            Name = "GeneratedH", EncounterType = "Default", CountsForRoomEncounterDepth = true,
            CanEncounterSkip = true, PreSpawnEnemies = false, BlockAthenaEncounterKeepsake = false,
            ForceEncounterStart = true, DelayedStart = false,
        },
        GeneratedH_PassiveSmall = {
            Name = "GeneratedH_PassiveSmall", EncounterType = "Default", CountsForRoomEncounterDepth = false,
            PreSpawnEnemies = true, DelayedStart = true,
        },
        Empty = { Name = "Empty", EncounterType = "NonCombat" },
    }
end

local function variant(source, name, changes)
    local result = {}
    for key, value in pairs(source) do result[key] = value end
    result.Name = name
    for key, value in pairs(changes or {}) do
        if value == "nil" then result[key] = nil else result[key] = value end
    end
    return result
end

local function first(role) return compatibility.role(1, role == "multiple") end

local function contains(values, expected)
    for _, value in ipairs(values or {}) do if value == expected then return true end end
    return false
end

-- A synchronized runtime around the real room coordinator.
local function world(phases, nativeDeclarations)
    local occurrence = {
        id = "room", gameName = "Room", transactionsByOwner = {},
        timeline = { transactions = {}, dependencies = {}, obligations = {} },
        overview = { encounterPhases = phases },
    }
    local state = { state = "synchronized", plan = { occurrencesById = { room = occurrence } } }
    local diagnostics, mismatches = {}, {}
    local function diagnostic(checkpoint, observed)
        diagnostics[#diagnostics + 1] = { checkpoint = checkpoint, observed = observed }
        return true
    end
    state.room = coordinator.new(state.plan, function(errorValue)
        mismatches[#mismatches + 1] = errorValue
        return nil, errorValue
    end, { diagnostic = diagnostic })
    assert(coordinator.enter(state, occurrence))
    local windows = {}
    local room = setmetatable({
        window = function(receivedState, window)
            windows[#windows + 1] = window
            return coordinator.window(receivedState, window)
        end,
    }, { __index = coordinator })
    local callbacks = {}
    local module = { hooks = { wrap = function(name, _, callback) callbacks[name] = callback end } }
    local session = { diagnostic = function(_, checkpoint, observed) return diagnostic(checkpoint, observed) end }
    encounterHooks.attach(module, session, function() return state end, function() end, room)
    local priorGame = _G.game
    _G.game = {
        EncounterData = nativeDeclarations or declarations(),
        IsEncounterEligible = function() return true end,
    }
    return {
        state = state, occurrence = occurrence, callbacks = callbacks, room = room, module = module,
        session = session, diagnostics = diagnostics, mismatches = mismatches, windows = windows,
        restore = function() _G.game = priorGame end,
    }
end

local function choose(context, nativeRoom, name)
    return context.callbacks.ChooseEncounter(nil, {}, function() return { Name = name } end, {}, nativeRoom, {})
end

function TestEncounterLifecycle.testCompatibleIntroSubstitutionKeepsEndAndFinalContacts()
    local context = world({ { slotKey = "Combat", encounterKey = "GeneratedF", kind = "combat" } })
    local nativeRoom = { __runPlannerExecutionRoomId = "room" }
    local native = choose(context, nativeRoom, "GuardIntro")
    nativeRoom.Encounter = native

    lu.assertEquals(coordinator.encounterPhase(context.state, native).slotKey, "Combat")
    lu.assertTrue(coordinator.encounterIsFinal(context.state, native))
    context.callbacks.StartEncounter(nil, {}, function() end, {}, nativeRoom, native)
    context.callbacks.EndEncounterEffects(nil, {}, function() end, {}, nativeRoom, native)
    lu.assertEquals(context.windows, { "encounterEnd:Combat", "afterCombat" })

    -- Room-entry proof over the same carrier and a reconstructed one logs no repeat.
    lu.assertTrue(coordinator.bindEntryEncounters(context.state, nativeRoom))
    local reconstructed = { Name = "GuardIntro" }
    lu.assertTrue(coordinator.bindEntryEncounters(context.state, { Encounter = reconstructed }))
    lu.assertEquals(coordinator.encounterPhase(context.state, reconstructed).slotKey, "Combat")
    context.restore()
    lu.assertEquals(context.diagnostics, { {
        checkpoint = "encounter-lifecycle",
        observed = { kind = "lifecycle-substitution", phase = "Combat", encounterKey = "GeneratedF",
            observed = "GuardIntro" },
    } })
    lu.assertEquals(context.mismatches, {})
end

function TestEncounterLifecycle.testOHeraclesPrecombatDepthConflictKeepsMismatch()
    local native = declarations()
    local compatible, conflict = compatibility.compare(native, "GeneratedO_Intro01", "HeraclesCombatO",
        compatibility.role(1, true))
    lu.assertNil(compatible)
    lu.assertEquals(conflict[1], "depth")
    lu.assertTrue(contains(conflict, "figLeafSkip"))
    -- Both run StartEncounterEffects once per ship wheel contact; timing is not compared.
    lu.assertFalse(contains(conflict, "startEffects"))

    local context = world({
        { slotKey = "Intro", encounterKey = "GeneratedO_Intro01" },
        { slotKey = "Combat", encounterKey = "GeneratedO_Intro01" },
    })
    local nativeRoom = { __runPlannerExecutionRoomId = "room", MultipleEncountersData = { {}, {} } }
    local selected
    context.callbacks.SetupRoomMultipleEncountersData(nil, {}, function()
        nativeRoom.Encounters = {}
        selected = choose(context, nativeRoom, "HeraclesCombatO")
        nativeRoom.Encounters[1] = selected
        return true
    end, nativeRoom, {})
    lu.assertNil(coordinator.encounterPhase(context.state, selected))
    lu.assertEquals(context.diagnostics[1].observed.kind, "lifecycle-conflict")
    lu.assertEquals(context.diagnostics[1].observed.conflict, conflict)

    nativeRoom.Encounters[2] = { Name = "GeneratedO_Intro01" }
    lu.assertNil(coordinator.bindEntryEncounters(context.state, nativeRoom))
    context.restore()
    lu.assertEquals(context.mismatches, { {
        kind = "encounter", expected = "GeneratedO_Intro01", observed = "HeraclesCombatO", conflict = conflict,
    } })
    lu.assertNil(coordinator.encounterPhase(context.state, selected))
end

function TestEncounterLifecycle.testPPrecombatEndAndSkipConflictIsNamed()
    local native = declarations()
    -- Equal depth isolates the ordinary end-effect and skip-propagation policies.
    native.DepthPreCombat = variant(native.GeneratedP_PreCombat, "DepthPreCombat",
        { CountsForRoomEncounterDepth = true, BlockAthenaEncounterKeepsake = false })
    local compatible, conflict = compatibility.compare(native, "GeneratedP", "DepthPreCombat",
        compatibility.role(1, true))
    lu.assertNil(compatible)
    lu.assertEquals(conflict, { "endEffects", "spawnMultiplierUses", "skipPropagation" })

    compatible, conflict = compatibility.compare(native, "GeneratedP_PreCombat", "GeneratedP",
        compatibility.role(1, true))
    lu.assertNil(compatible)
    lu.assertEquals(conflict, { "depth", "endEffects", "spawnMultiplierUses", "skipPropagation", "gorgonBlock" })
end

function TestEncounterLifecycle.testBossAndEncounterUseDifferencesAreDetected()
    local native = declarations()
    native.Boss = variant(native.GeneratedF, "Boss", { EncounterType = "Boss" })
    native.SkipBossTraits = variant(native.GeneratedF, "SkipBossTraits", { SkipBossTraits = true })
    native.BlockedSpawnUses = variant(native.GeneratedF, "BlockedSpawnUses", { BlockSpawnMultipliers = true })
    native.NoDepth = variant(native.GeneratedF, "NoDepth", { CountsForRoomEncounterDepth = false })
    for name, expected in pairs({
        Boss = { "bossEffects" }, SkipBossTraits = { "bossEffects" },
        BlockedSpawnUses = { "spawnMultiplierUses" }, NoDepth = { "depth" },
    }) do
        local compatible, conflict = compatibility.compare(native, "GeneratedF", name, first())
        lu.assertNil(compatible, name)
        lu.assertEquals(conflict, expected, name)
    end
    -- Disabled end effects mask the spawn-multiplier use gate.
    native.QuietA = variant(native.Empty, "QuietA", { BlockSpawnMultipliers = true })
    lu.assertTrue(compatibility.compare(native, "Empty", "QuietA", first()))
end

function TestEncounterLifecycle.testNilAndFalseAreTheSameNativePolicy()
    local native = {
        Explicit = {
            Name = "Explicit", EncounterType = "Default", CountsForRoomEncounterDepth = false,
            SkipEndEncounterEffects = false, SkipBossTraits = false, BlockSpawnMultipliers = false,
            CanEncounterSkip = false, BlockDionysusEncounterKeepsake = false, PreSpawnEnemies = false,
            BlockAthenaEncounterKeepsake = false, CheckAthenaEncounterKeepsakeOnSkipEncounterStart = false,
            SkipEncounterStart = false, ForceEncounterStart = false, DelayedStart = false,
            BlockMultipleEncounters = false,
        },
        Omitted = { Name = "Omitted", EncounterType = "Default" },
    }
    lu.assertTrue(compatibility.compare(native, "Explicit", "Omitted", first("multiple")))
    lu.assertTrue(compatibility.compare(native, "Explicit", "Omitted", compatibility.role(2, true)))
end

function TestEncounterLifecycle.testLaterPhaseOverridesAgreeAtSelectionAndReload()
    local native = declarations()
    -- Native later phases skip start and take CanEncounterSkipIfNotFirst.
    native.LaterVariant = variant(native.GeneratedP, "LaterVariant",
        { CanEncounterSkip = false, CanEncounterSkipIfNotFirst = "nil", DelayedStart = true })
    lu.assertTrue(compatibility.compare(native, "GeneratedP", "LaterVariant", compatibility.role(2, true)))
    local compatible, conflict = compatibility.compare(native, "GeneratedP", "LaterVariant",
        compatibility.role(1, true))
    lu.assertNil(compatible)
    lu.assertEquals(conflict, { "startEffects" })
    native.FirstVariant = variant(native.GeneratedP, "FirstVariant", { CanEncounterSkip = false })
    compatible, conflict = compatibility.compare(native, "GeneratedP", "FirstVariant", compatibility.role(1, true))
    lu.assertNil(compatible)
    lu.assertEquals(conflict, { "figLeafSkip" })

    local context = world({
        { slotKey = "Intro", encounterKey = "GeneratedP_PreCombat" },
        { slotKey = "Combat", encounterKey = "GeneratedP" },
    }, native)
    local nativeRoom = { __runPlannerExecutionRoomId = "room", MultipleEncountersData = { {}, {} } }
    context.callbacks.SetupRoomMultipleEncountersData(nil, {}, function()
        nativeRoom.Encounters = {}
        nativeRoom.Encounters[1] = choose(context, nativeRoom, "GeneratedP_PreCombat")
        nativeRoom.Encounters[2] = choose(context, nativeRoom, "LaterVariant")
        -- SetupRoomMultipleEncountersData writes the later-phase overrides after selection.
        nativeRoom.Encounters[2].SkipEncounterStart = true
        return true
    end, nativeRoom, {})
    lu.assertEquals(coordinator.encounterPhase(context.state, nativeRoom.Encounters[2]).slotKey, "Combat")

    local reloaded = {
        Encounters = {
            { Name = "GeneratedP_PreCombat" },
            { Name = "LaterVariant", SkipEncounterStart = true, CanEncounterSkip = false },
        },
    }
    lu.assertTrue(coordinator.bindEntryEncounters(context.state, reloaded))
    lu.assertEquals(coordinator.encounterPhase(context.state, reloaded.Encounters[2]).slotKey, "Combat")
    context.restore()
    lu.assertEquals(#context.diagnostics, 1)
    lu.assertEquals(context.mismatches, {})
end

function TestEncounterLifecycle.testConsumedFigLeafOnReloadStillBinds()
    local native = declarations()
    native.GeneratedFVariant = variant(native.GeneratedF, "GeneratedFVariant")
    local context = world({ { slotKey = "Combat", encounterKey = "GeneratedF", figLeafSkip = false } }, native)
    -- A failed roll clears CanEncounterSkip on the live object; policy is unchanged.
    for _, name in ipairs({ "GeneratedF", "GeneratedFVariant" }) do
        local carrier = { Name = name, CanEncounterSkip = false, SpawnsSkipped = false, Completed = true }
        lu.assertTrue(coordinator.bindEntryEncounters(context.state, { Encounter = carrier }))
        lu.assertEquals(coordinator.encounterPhase(context.state, carrier).figLeafSkip, false)
    end
    context.restore()
    lu.assertEquals(context.mismatches, {})
end

function TestEncounterLifecycle.testFieldsKeepPerCageBindingAndOrder()
    local native = declarations()
    native.GeneratedHVariant = variant(native.GeneratedH, "GeneratedHVariant")
    native.GeneratedHNoDepth = variant(native.GeneratedH, "GeneratedHNoDepth", { CountsForRoomEncounterDepth = false })
    local phases = {
        { slotKey = "Passive", encounterKey = "GeneratedH_PassiveSmall" },
        { slotKey = "Cage01", encounterKey = "GeneratedH" },
        { slotKey = "Cage02", encounterKey = "GeneratedH" },
    }
    local context = world(phases, native)
    local nativeRoom = { __runPlannerExecutionRoomId = "room" }
    nativeRoom.Encounter = choose(context, nativeRoom, "GeneratedH_PassiveSmall")
    local cage1 = choose(context, nativeRoom, "GeneratedH")
    local cage2 = choose(context, nativeRoom, "GeneratedHVariant")
    lu.assertEquals(coordinator.encounterPhase(context.state, cage1).slotKey, "Cage01")
    lu.assertEquals(coordinator.encounterPhase(context.state, cage2).slotKey, "Cage02")
    lu.assertFalse(coordinator.encounterIsFinal(context.state, cage1))
    lu.assertTrue(coordinator.encounterIsFinal(context.state, cage2))

    nativeRoom.CageRewards = { { Encounter = { Name = "GeneratedH" } }, { Encounter = { Name = "GeneratedHVariant" } } }
    lu.assertTrue(coordinator.bindEntryEncounters(context.state, nativeRoom))
    lu.assertEquals(coordinator.encounterPhase(context.state, nativeRoom.CageRewards[2].Encounter).slotKey, "Cage02")
    lu.assertEquals(#context.diagnostics, 1)

    nativeRoom.CageRewards[1].Encounter = { Name = "GeneratedHNoDepth" }
    lu.assertNil(coordinator.bindEntryEncounters(context.state, nativeRoom))
    context.restore()
    lu.assertEquals(context.mismatches[1].expected, "GeneratedH")
    lu.assertEquals(context.mismatches[1].observed, "GeneratedHNoDepth")
    lu.assertEquals(context.mismatches[1].conflict, { "depth" })
end

function TestEncounterLifecycle.testReconstructedCarrierInANewSessionBindsAndLogsOnce()
    local context = world({ { slotKey = "Combat", encounterKey = "GeneratedF" } })
    local restored = { Encounter = { Name = "GuardIntro" } }
    -- StartRoom binds before native setup and again in the completed-setup proof.
    lu.assertTrue(coordinator.bindEntryEncounters(context.state, restored))
    lu.assertTrue(coordinator.bindEntryEncounters(context.state, restored))
    context.restore()
    lu.assertEquals(coordinator.encounterPhase(context.state, restored.Encounter).slotKey, "Combat")
    lu.assertEquals(#context.diagnostics, 1)
    lu.assertEquals(context.diagnostics[1].observed.observed, "GuardIntro")
end

function TestEncounterLifecycle.testSubstitutionNeverInstallsAnotherDeclarationsCustomization()
    local native = declarations()
    native.ArachneCombatF = variant(native.GeneratedF, "ArachneCombatF")
    native.ArachneCombatVariant = variant(native.GeneratedF, "ArachneCombatVariant")
    local phase = {
        slotKey = "Combat", encounterKey = "ArachneCombatF",
        customization = { { kind = "cocoonCount", decisionKey = "cocoonCount", count = 6 } },
    }
    local context = world({ phase }, native)
    arachne.attach(context.module, context.session, function() return context.state end, nil, context.room)
    local nativeRoom = { __runPlannerExecutionRoomId = "room" }
    local substituted = choose(context, nativeRoom, "ArachneCombatVariant")
    local bound = coordinator.encounterPhase(context.state, substituted)
    lu.assertEquals(bound.slotKey, "Combat")
    lu.assertNil(bound.customization)
    local received
    context.callbacks.SetupArachneCombatEncounter(nil, {}, function(_, args) received = args end,
        substituted, { CocoonCountMin = 4, CocoonCountMax = 8 })
    lu.assertEquals(received, { CocoonCountMin = 4, CocoonCountMax = 8 })

    local exact = { Name = "ArachneCombatF" }
    lu.assertTrue(coordinator.bindEntryEncounters(context.state, { Encounter = exact }))
    lu.assertIs(coordinator.encounterPhase(context.state, exact), phase)
    context.callbacks.SetupArachneCombatEncounter(nil, {}, function(_, args) received = args end,
        exact, { CocoonCountMin = 4, CocoonCountMax = 8 })
    context.restore()
    lu.assertEquals(received, { CocoonCountMin = 6, CocoonCountMax = 6 })
end

function TestEncounterLifecycle.testTraitAndNpcOutcomesAreNotCompared()
    local native = declarations()
    native.Story = { Name = "Story", EncounterType = "NonCombat",
        StartRoomUnthreadedEvents = { { FunctionName = "GiveTrait", Args = { TraitName = "Boon" } } },
        LootData = { "NPCBoon" }, RewardPreviewIcon = "Icon", GameStateRequirements = { {} } }
    lu.assertTrue(compatibility.compare(native, "Empty", "Story", first()))
end

function TestEncounterLifecycle.testUnclassifiedStartOrSetupDoesNotProveDifferentNames()
    local native = declarations()
    native.Elite = variant(native.GeneratedF, "Elite", { UnthreadedEvents = { { FunctionName = "BeginEliteChallenge" } } })
    native.Delayed = variant(native.GeneratedF, "Delayed", { DelayedStart = true })
    native.Setup = variant(native.GeneratedF, "Setup", { SetupEvents = { { FunctionName = "Anything" } } })
    local compatible, conflict = compatibility.compare(native, "GeneratedF", "Elite", first())
    lu.assertNil(compatible)
    lu.assertEquals(conflict, { "startEffects" })
    compatible, conflict = compatibility.compare(native, "GeneratedF", "Delayed", first())
    lu.assertNil(compatible)
    lu.assertEquals(conflict, { "startEffects" })
    compatible, conflict = compatibility.compare(native, "GeneratedF", "Setup", first())
    lu.assertNil(compatible)
    lu.assertEquals(conflict, { "setup" })
    compatible, conflict = compatibility.compare(native, "GeneratedF", "Missing", first())
    lu.assertNil(compatible)
    lu.assertEquals(conflict, { "declaration" })
    -- The same name keeps exact acceptance without consulting declarations.
    lu.assertTrue(compatibility.compare({}, "Delayed", "Delayed", first()))
end

function TestEncounterLifecycle.testLaterChoiceForACarriedPhaseIsNotClaimed()
    local context = world({ { slotKey = "Combat", encounterKey = "GeneratedF" } })
    local nativeRoom = { __runPlannerExecutionRoomId = "room" }
    local carried = choose(context, nativeRoom, "GeneratedF")
    local ambient = choose(context, nativeRoom, "GuardIntro")
    context.restore()
    lu.assertEquals(coordinator.encounterPhase(context.state, carried).slotKey, "Combat")
    lu.assertNil(coordinator.encounterPhase(context.state, ambient))
    lu.assertEquals(context.diagnostics, {})
end

function TestEncounterLifecycle.testUnmodeledCarriersRemainExact()
    local registry = require("mods.room.timeline.encounters.phases").create()
    local occurrence = { id = "room", overview = { unmodeledEncounterKeys = { "Empty" }, encounterPhases = {} } }
    local native = declarations()
    native.Story = { Name = "Story", EncounterType = "NonCombat" }
    local ok, mismatch = registry.prove(occurrence, { Encounter = { Name = "Story" } }, native)
    lu.assertNil(ok)
    lu.assertEquals(mismatch, { kind = "encounter", expected = "Empty", observed = "Story" })
end
