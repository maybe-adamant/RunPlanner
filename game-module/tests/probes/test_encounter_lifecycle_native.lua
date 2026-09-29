-- Manual only: lua tests/probes/test_encounter_lifecycle_native.lua /path/to/Scripts
-- Loads native encounter declarations, resolves them with the game's own
-- ProcessDataInheritance/DeepInheritData, and checks representative lifecycle
-- compatibility verdicts plus the start-contact classification they rely on.
-- luacheck: globals TestEncounterLifecycleNative
local lu = require("luaunit")
package.path = "./src/?.lua;./src/?/init.lua;./tests/?.lua;./tests/?/init.lua;" .. package.path
local compatibility = require("mods.room.timeline.encounters.compatibility")

local TestEncounterLifecycleNative = {}
_G.TestEncounterLifecycleNative = TestEncounterLifecycleNative

local function scriptsPath()
    local value = arg[1] or os.getenv("HADES2_SCRIPTS_PATH")
    assert(type(value) == "string" and value ~= "", "supply HADES2_SCRIPTS_PATH or a Scripts directory")
    return value:gsub("/$", "")
end

local nativeScriptsPath = scriptsPath()
if arg[1] then table.remove(arg, 1) end -- The source directory is not a LuaUnit test selector.

local function read(name)
    local file = assert(io.open(nativeScriptsPath .. "/" .. name, "rb"))
    local value = file:read("*a")
    file:close()
    return (value:gsub("^\239\187\191", ""))
end

local function body(source, name)
    local startAt = assert(source:find("function " .. name .. "%s*%(", 1), "native source does not define " .. name)
    local nextAt = source:find("\nfunction ", startAt + 1)
    return source:sub(startAt, nextAt and nextAt - 1 or #source)
end

-- Data files reference unrelated tables (Color, GameData, ...); give them inert values.
local function dataEnvironment()
    local inert = { __index = function(values, key)
        local value = setmetatable({}, getmetatable(values))
        rawset(values, key, value)
        return value
    end }
    return setmetatable({}, { __index = function(values, key)
        if _G[key] ~= nil then return _G[key] end
        local value = setmetatable({}, inert)
        rawset(values, key, value)
        return value
    end })
end

local function loadDeclarations()
    local env = dataEnvironment()
    local utility = read("UtilityLogic.lua")
    for _, name in ipairs({
        "ShallowCopyTable", "DeepCopyTable", "MergeTables", "ConcatTableValuesIPairs", "ConcatTableValues",
        "OverwriteTableKeys",
    }) do assert(load(body(utility, name), "@UtilityLogic.lua:" .. name, "t", env))() end
    local runData = read("RunData.lua")
    local ignores = assert(runData:match("local inheritanceIgnores%s*=%s*%b{}"), "RunData inheritanceIgnores")
    assert(load(ignores .. "\n" .. body(runData, "ProcessDataInheritance") .. "\n"
        .. body(runData, "DeepInheritData"), "@RunData.lua", "t", env))()
    local imports = { "EncounterSets.lua", "EncounterData.lua" }
    for name in runData:gmatch('Import "(EncounterData_[%w_]+%.lua)"') do
        if name ~= "EncounterData_Test.lua" then imports[#imports + 1] = name end
    end
    for _, name in ipairs(imports) do assert(load(read(name), "@" .. name, "t", env))() end
    local declarations = env.EncounterData
    -- Mirrors RunData's EncounterData pass.
    for name, declaration in pairs(declarations) do
        declaration.Name = name
        env.ProcessDataInheritance(declaration, declarations)
        if declaration.EncounterType == nil then declaration.EncounterType = "Default" end
    end
    return declarations
end

local declarations = loadDeclarations()

local function compare(expected, actual, role)
    assert(declarations[expected], "native declaration " .. expected)
    assert(declarations[actual], "native declaration " .. actual)
    return compatibility.compare(declarations, expected, actual, role)
end

local function contains(values, expected)
    for _, value in ipairs(values or {}) do if value == expected then return true end end
    return false
end

function TestEncounterLifecycleNative.testOIntroductionAndHeraclesConflictOnDepth()
    local compatible, conflict = compare("GeneratedO_Intro01", "HeraclesCombatO", compatibility.role(1, true))
    lu.assertNil(compatible)
    lu.assertEquals(conflict[1], "depth")
    lu.assertTrue(contains(conflict, "figLeafSkip"))
end

function TestEncounterLifecycleNative.testPPrecombatAndOrdinaryCombatConflictOnEndAndSkip()
    local compatible, conflict = compare("GeneratedP_PreCombat", "GeneratedP", compatibility.role(1, true))
    lu.assertNil(compatible)
    lu.assertTrue(contains(conflict, "endEffects"))
    lu.assertTrue(contains(conflict, "skipPropagation"))
    -- The later ordinary P phase agrees with Heracles only on inherited start skipping.
    compatible, conflict = compare("GeneratedP", "HeraclesCombatP", compatibility.role(2, true))
    lu.assertNil(compatible)
    lu.assertTrue(contains(conflict, "envelopeTermination"))
end

function TestEncounterLifecycleNative.testEnemyIntroductionsInheritTheirBiomeCombatLifecycle()
    lu.assertTrue(compare("GeneratedF", "GuardIntro", compatibility.role(1, false)))
    lu.assertTrue(compare("GeneratedG", "FishSwarmerIntro", compatibility.role(1, false)))
end

function TestEncounterLifecycleNative.testPresentationOnlyStoryMatchesEmpty()
    lu.assertTrue(compare("Empty", "Story_Chronos_01", compatibility.role(1, false)))
end

function TestEncounterLifecycleNative.testDeclarativeOverridesLeaveComparedPolicyAndSetupIsUnproven()
    local compared = {}
    for _, key in ipairs({
        "EncounterType", "CountsForRoomEncounterDepth", "SkipEndEncounterEffects", "SkipBossTraits",
        "BlockSpawnMultipliers", "CanEncounterSkip", "CanEncounterSkipIfNotFirst",
        "BlockDionysusEncounterKeepsake", "PreSpawnEnemies", "BlockAthenaEncounterKeepsake",
        "CheckAthenaEncounterKeepsakeOnSkipEncounterStart", "SkipEncounterStart", "ForceEncounterStart",
        "DelayedStart", "BlockMultipleEncounters", "SkipShipsEncounterSetup",
    }) do compared[key] = true end
    local touched, setup = {}, {}
    local function inspect(name, source, overrides)
        for key in pairs(type(overrides) == "table" and overrides or {}) do
            if compared[key] then touched[#touched + 1] = name .. ":" .. source .. ":" .. key end
        end
    end
    for name, declaration in pairs(declarations) do
        if declaration.SetupEvents ~= nil then setup[#setup + 1] = name end
        inspect(name, "hard", declaration.HardEncounterOverrideValues)
        for level, dream in pairs(type(declaration.DreamBiomeData) == "table" and declaration.DreamBiomeData or {}) do
            inspect(name, "dream" .. tostring(level), type(dream) == "table" and dream.DataOverrides)
        end
        for index, wave in ipairs(type(declaration.SpawnWaves) == "table" and declaration.SpawnWaves or {}) do
            inspect(name, "wave" .. index, type(wave) == "table" and wave.OverrideValues)
        end
    end
    table.sort(touched)
    lu.assertEquals(touched, {})
    -- Setup callbacks are not replayed, so their declarations cannot prove a substitution.
    lu.assertTrue(#setup > 0)
    for _, name in ipairs(setup) do
        local compatible, conflict = compare("Empty", name, compatibility.role(1, false))
        lu.assertNil(compatible)
        lu.assertEquals(conflict, { "setup" })
    end
end

function TestEncounterLifecycleNative.testStartContactClassificationCoversEveryStartEffectsCaller()
    local classified = {
        BeginArachneEncounter = true, BeginArtemisEncounter = true, BeginIcarusEncounter = true,
        BeginHeraclesEncounter = true, BeginNemesisEncounter = true, BeginCrawlerEncounter = true,
        BeginPerfectClearEncounter = true, BeginAthenaEncounter = true, ShipsEncounterSetup = true,
        BeginEliteChallenge = true, BeginOpeningEncounter = true, StartDevotionTest = true,
        -- Room/enemy contacts that start a delayed primary; unproven by that rule.
        TyphonTailIntro = true, BossIntro = true,
        StartEncounter = true, StartEncounterEffects = true,
    }
    local callers = {}
    for _, name in ipairs({ "RoomLogic.lua", "EncounterLogic.lua", "RunLogic.lua", "CombatLogic.lua",
        "EnemyAILogic.lua", "RewardLogic.lua", "EventLogic.lua" }) do
        local source = read(name)
        local current
        for line in (source .. "\n"):gmatch("(.-)\n") do
            current = line:match("^function%s+([%w_]+)%s*%(") or current
            if current and line:find("StartEncounterEffects%s*%(") and not classified[current] then
                callers[#callers + 1] = name .. ":" .. current
            end
        end
    end
    lu.assertEquals(callers, {})
    local roomLogic = read("RoomLogic.lua")
    lu.assertNotNil(body(roomLogic, "BeginAthenaEncounter"):find("TableLength%(CurrentRun.CurrentRoom.Encounters%) == 1"))
    local shipSetup = body(roomLogic, "ShipsEncounterSetup")
    lu.assertTrue(shipSetup:find("SkipShipsEncounterSetup", 1, true) < shipSetup:find("StartEncounterEffects", 1, true))
end

function TestEncounterLifecycleNative.testStartContactsAppearOnlyInRunEventsLists()
    local contacts = {
        BeginArachneEncounter = true, BeginArtemisEncounter = true, BeginIcarusEncounter = true,
        BeginHeraclesEncounter = true, BeginNemesisEncounter = true, BeginCrawlerEncounter = true,
        BeginPerfectClearEncounter = true, BeginAthenaEncounter = true, ShipsEncounterSetup = true,
        BeginEliteChallenge = true, BeginOpeningEncounter = true, StartDevotionTest = true,
    }
    local runEvents = {
        ThreadedEvents = true, PreUnthreadedEvents = true, UnthreadedEvents = true, PostUnthreadedEvents = true,
    }
    local elsewhere, seen = {}, 0
    local function scan(value, path, inRunEvents, visited)
        if type(value) ~= "table" or visited[value] then return end
        visited[value] = true
        if contacts[value.FunctionName] then
            if inRunEvents then seen = seen + 1 else elsewhere[#elsewhere + 1] = path end
        end
        for key, nested in pairs(value) do scan(nested, path .. "." .. tostring(key), inRunEvents, visited) end
    end
    for name, declaration in pairs(declarations) do
        for key, value in pairs(declaration) do
            scan(value, name .. "." .. tostring(key), runEvents[key] == true, {})
        end
    end
    table.sort(elsewhere)
    lu.assertEquals(elsewhere, {})
    lu.assertTrue(seen > 0)
end

os.exit(lu.LuaUnit.run())
