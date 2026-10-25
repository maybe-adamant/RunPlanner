-- Manual only: HADES2_SCRIPTS_PATH=/path/to/Scripts lua tests/probes/test_biome_depth_native.lua
-- Replays each execution fixture's room sequence through native UpdateRunHistoryCache,
-- GetBiomeDepth, StartRoom RunOverrides, EndBiomeRecords and StartEncounter's depth
-- counters, and compares the published counters at roomEntered (after StartRoom's
-- unthreaded events) and beforeRoomExit (after LeaveRoom's refresh).
-- luacheck: globals CurrentRun GameState UpdateRunHistoryCache GetBiomeDepth GetRunDepth IsEmpty
package.path = "./src/?.lua;./src/?/init.lua;./tests/?.lua;./tests/?/init.lua;" .. package.path
local fixtures = require("tests/harness/fixture_loader")
local protocol = require("mods.protocol.decoder")

local scriptsPath = (arg[1] or os.getenv("HADES2_SCRIPTS_PATH") or ""):gsub("/$", "")
assert(scriptsPath ~= "", "supply HADES2_SCRIPTS_PATH or a Scripts directory argument")

local function read(path)
    local handle = assert(io.open(path, "rb"))
    local text = handle:read("*a"):gsub("^\239\187\191", ""):gsub("\r\n", "\n")
    handle:close()
    return text
end

-- Load unmodified native function bodies; nothing proprietary is copied here.
local runSource = read(scriptsPath .. "/RunLogic.lua")
for _, name in ipairs({ "UpdateRunHistoryCache", "GetRunDepth", "GetBiomeDepth" }) do
    local first = assert(runSource:find("\nfunction " .. name .. "%s*%("), "missing " .. name)
    local last = runSource:find("\nfunction ", first + 1)
    assert(load(runSource:sub(first + 1, last and last - 1 or #runSource), "@RunLogic.lua:" .. name))()
end
function IsEmpty(values) return values == nil or next(values) == nil end

-- Native declaration files, loaded in a permissive sandbox: only the declaration
-- tables are kept, and every other global resolves to an inert stub.
local function loadDeclarations(files, environment)
    local stub
    stub = setmetatable({}, { __index = function() return stub end, __call = function() return stub end })
    setmetatable(environment, { __index = function(_, key) return _G[key] ~= nil and _G[key] or stub end })
    for _, file in ipairs(files) do
        local path = scriptsPath .. "/" .. file .. ".lua"
        local handle = io.open(path, "rb")
        if handle then
            handle:close()
            assert(load(read(path), "@" .. file .. ".lua", "t", environment))()
        end
    end
end
local function addKeys(target, source) for key, value in pairs(source) do target[key] = value end end

local roomSets = {}
loadDeclarations({ "RoomData", "RoomDataF", "RoomDataG", "RoomDataH", "RoomDataI", "RoomDataN", "RoomDataO",
    "RoomDataP", "RoomDataQ", "RoomDataChaos", "RoomDataAnomaly", "RoomDataDream", "RoomDataC" },
    { RoomSetData = roomSets, RoomData = {}, AddTableKeysCheckDupes = addKeys })
local rooms = {}
for _, set in pairs(roomSets) do addKeys(rooms, set) end

local encounters
do
    local files = { "EncounterData" }
    local listing = io.popen('ls "' .. scriptsPath .. '"')
    for name in listing:lines() do
        local file = name:match("^(EncounterData_.+)%.lua$")
        if file then files[#files + 1] = file end
    end
    listing:close()
    -- EncounterData.lua assigns the table; later files overwrite keys into it.
    local environment = { ConstantsData = {}, OverwriteTableKeys = addKeys }
    loadDeclarations(files, environment)
    encounters = rawget(environment, "EncounterData")
end

-- Native DeepInheritData fills only missing keys, so the first parent supplying one wins.
local function inherited(store, name, key, seen)
    local declaration = assert(store[name], "native data has no " .. tostring(name))
    local value = declaration[key]
    if value == "nil" then return nil end
    if value ~= nil then return value end
    seen = seen or {}
    for _, parent in ipairs(declaration.InheritFrom or {}) do
        if not seen[parent] and store[parent] then
            seen[parent] = true
            value = inherited(store, parent, key, seen)
            if value ~= nil then return value end
        end
    end
    return nil
end

local function nativeRoom(name)
    return {
        Name = name,
        NextRoomSet = inherited(rooms, name, "NextRoomSet"),
        RunOverrides = inherited(rooms, name, "RunOverrides"),
        StartUnthreadedEvents = inherited(rooms, name, "StartUnthreadedEvents"),
    }
end

-- StartRoom's unthreaded EndBiomeRecords; F and N Openings gate it on a Dream run.
local function endsBiomeRecords(room, dream)
    for _, event in ipairs(room.StartUnthreadedEvents or {}) do
        if event.FunctionName == "EndBiomeRecords" then
            local eligible = true
            for _, requirement in ipairs(event.GameStateRequirements or {}) do
                local path = requirement.PathTrue
                assert(path and path[1] == "CurrentRun" and path[2] == "IsDreamRun" and #path == 2,
                    room.Name .. " has an unmodeled EndBiomeRecords requirement")
                eligible = eligible and dream
            end
            if eligible then return true end
        end
    end
    return false
end

local function plan(fileName)
    return assert(protocol.decode(fixtures.decode(fileName)))
end

local function replay(fileName)
    local decoded = plan(fileName)
    local dream = decoded.routeKey == "Dream"
    local byId = {}
    for _, occurrence in ipairs(decoded.occurrences) do byId[occurrence.id] = occurrence end
    local results, fillers = {}, 0
    GameState = { RoomCountCache = {} }
    CurrentRun = { RoomHistory = {}, EncounterDepth = 1 }
    local offset = 0
    if dream then
        -- The Dream door's RunOverrides; SelectNextDreamBiome gives Dream_Intro a NextRoomSet at runtime.
        CurrentRun.BiomeDepthCache, CurrentRun.IsDreamRun = 1, true
        UpdateRunHistoryCache(CurrentRun)
        CurrentRun.CurrentRoom = { Name = "Dream_Intro", NextRoomSet = {} }
        offset = 1
    else
        UpdateRunHistoryCache(CurrentRun)
    end
    local function leave()
        table.insert(CurrentRun.RoomHistory, CurrentRun.CurrentRoom)
        UpdateRunHistoryCache(CurrentRun, CurrentRun.CurrentRoom)
    end
    local function check(occurrence, frame, diagnostic)
        if diagnostic == nil then return end
        local planned = diagnostic.counters
        local native = {
            biomeDepthCache = CurrentRun.BiomeDepthCache,
            biomeEncounterDepth = CurrentRun.BiomeEncounterDepth,
            routeEncounterDepth = CurrentRun.EncounterDepth,
            roomHistoryOrdinal = #CurrentRun.RoomHistory - offset,
        }
        for _, key in ipairs({ "biomeDepthCache", "biomeEncounterDepth", "routeEncounterDepth", "roomHistoryOrdinal" }) do
            if planned[key] ~= native[key] then
                results[#results + 1] = string.format("%s %s %s: planned %s %s, native %s", fileName,
                    occurrence.gameName, frame, key, tostring(planned[key]), tostring(native[key]))
            end
        end
    end
    local compared = 0
    for _, id in ipairs(decoded.selectedOccurrenceIds) do
        local occurrence = byId[id]
        local diagnostics = occurrence and occurrence.diagnostics or {}
        local entered, exited = diagnostics.roomEntered, diagnostics.beforeRoomExit
        if entered or exited then
            local entryOrdinal = entered and entered.counters.roomHistoryOrdinal
                or exited.counters.roomHistoryOrdinal - 1
            -- Restored Hub and parent rooms are left again without a published occurrence.
            while #CurrentRun.RoomHistory + (CurrentRun.CurrentRoom and 1 or 0) < entryOrdinal + offset do
                assert(occurrence.gameName:match("^N_"), fileName .. " has an unexplained history gap before " .. id)
                if CurrentRun.CurrentRoom then leave() end
                CurrentRun.CurrentRoom = { Name = "RestoredRoom" }
                fillers = fillers + 1
            end
            if CurrentRun.CurrentRoom then leave() end
            CurrentRun.CurrentRoom = nativeRoom(occurrence.gameName)
            UpdateRunHistoryCache(CurrentRun)
            if CurrentRun.CurrentRoom.RunOverrides then
                for key, value in pairs(CurrentRun.CurrentRoom.RunOverrides) do CurrentRun[key] = value end
            end
            CurrentRun.BiomeDepthCache = CurrentRun.BiomeDepthCache or GetBiomeDepth(CurrentRun)
            if endsBiomeRecords(CurrentRun.CurrentRoom, dream) then CurrentRun.BiomeEncounterDepth = 1 end
            check(occurrence, "roomEntered", entered)
            -- StartEncounter advances both encounter depths for each counting encounter.
            for _, phase in ipairs(occurrence.overview and occurrence.overview.encounterPhases or {}) do
                if inherited(encounters, phase.encounterKey, "CountsForRoomEncounterDepth") then
                    CurrentRun.BiomeEncounterDepth = (CurrentRun.BiomeEncounterDepth or 1) + 1
                    CurrentRun.EncounterDepth = CurrentRun.EncounterDepth + 1
                end
            end
            if exited then
                leave()
                check(occurrence, "beforeRoomExit", exited)
                CurrentRun.CurrentRoom = nil
            end
            compared = compared + (entered and 1 or 0) + (exited and 1 or 0)
        end
    end
    return results, compared, fillers
end

local files = {}
local listing = io.popen('ls "' .. fixtures.root .. '"')
for name in listing:lines() do
    if name:match("%.execution%.json$") then files[#files + 1] = name end
end
listing:close()
local failures, total = 0, 0
for _, fileName in ipairs(files) do
    local mismatches, compared, fillers = replay(fileName)
    total = total + compared
    print(string.format("%-56s %3d checkpoints %2d restores %s", fileName, compared, fillers,
        #mismatches == 0 and "ok" or "MISMATCH"))
    for _, line in ipairs(mismatches) do print("  " .. line) end
    failures = failures + #mismatches
end
print(string.format("%d checkpoints, %d mismatches", total, failures))
os.exit(failures == 0 and 0 or 1)
