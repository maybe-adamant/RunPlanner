-- luacheck: globals TestSettings
local lu = require("luaunit")
local lfs = require("lfs")
local settings = require("mods.host.settings")

TestSettings = {}

local pathApi = { combine = function(root, file) return root .. "/" .. file end }
local ALL_OFF = { showRoomGuide = false, highlightPlannedChoices = false, snapMode = false }

local function temporaryDirectory()
    local path = os.tmpname()
    os.remove(path)
    assert(lfs.mkdir(path))
    return path
end

local function entries(root)
    local names = {}
    for name in lfs.dir(root) do
        if name ~= "." and name ~= ".." then names[#names + 1] = name end
    end
    table.sort(names)
    return names
end

local function contents(path)
    local file = io.open(path, "rb")
    if not file then return nil end
    local value = file:read("*a")
    file:close()
    return value
end

local function publish(path, value)
    local file = assert(io.open(path, "wb"))
    file:write(value)
    file:close()
end

function TestSettings:setUp()
    self.root = temporaryDirectory()
    self.path = self.root .. "/settings.json"
    self.logs, self.now = {}, 0
    self.store = settings.create(self.root, pathApi, {
        log = function(line) self.logs[#self.logs + 1] = line end,
        clock = function() return self.now end,
    })
end

function TestSettings:tearDown()
    for _, name in ipairs(entries(self.root)) do os.remove(self.root .. "/" .. name) end
    lfs.rmdir(self.root)
end

function TestSettings.testEncodeIsCanonicalAndDecodeAcceptsOnlyTheExactContract()
    local values = { showRoomGuide = true, highlightPlannedChoices = false, snapMode = true }
    local encoded = settings.encode(values)
    lu.assertEquals(encoded, '{"format":"run-planner-settings","formatVersion":1,'
        .. '"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":true}')
    lu.assertEquals(settings.decode(encoded), values)
    lu.assertEquals(settings.decode(' { "snapMode": false, "highlightPlannedChoices": false, "showRoomGuide": false,'
        .. ' "formatVersion": 1, "format": "run-planner-settings" }\n'), ALL_OFF)
    lu.assertError(settings.encode, { showRoomGuide = true })
    for _, raw in ipairs({
        "",
        "[]",
        '{"format":"run-planner-settings","formatVersion":1,"showRoomGuide":true,"highlightPlannedChoices":false}',
        '{"format":"run-planner-settings","formatVersion":1,"showRoomGuide":1,"highlightPlannedChoices":false,"snapMode":false}',
        '{"format":"run-planner-settings","formatVersion":1.0,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":false}',
        '{"format":"run-planner-settings","formatVersion":2,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":false}',
        '{"format":"other","formatVersion":1,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":false}',
        '{"format":"run-planner-settings","formatVersion":1,"showRoomGuide":true,"highlightPlannedChoices":false,'
            .. '"snapMode":false,"extra":true}',
        string.rep(" ", settings.MAX_BYTES + 1),
    }) do
        lu.assertNil(settings.decode(raw), raw)
    end
end

function TestSettings:testMissingAndInvalidFilesMeanEveryOptionOffAndAreLeftAsFound()
    local values, state = self.store.read()
    lu.assertEquals({ values, state }, { ALL_OFF, "missing" })
    lu.assertEquals(entries(self.root), {})
    publish(self.path, "{broken")
    values, state = self.store.read()
    lu.assertEquals({ values, state }, { ALL_OFF, "invalid" })
    self.store.read()
    lu.assertEquals(#self.logs, 1)
    lu.assertStrContains(self.logs[1], "[RunPlanner] settings invalid reason=")
    lu.assertEquals(contents(self.path), "{broken")
end

function TestSettings:testWritingOneOptionKeepsTheOthersAsTheFileHoldsThem()
    publish(self.path, settings.encode({ showRoomGuide = false, highlightPlannedChoices = true, snapMode = false }))
    lu.assertTrue(self.store.write("snapMode", true))
    lu.assertEquals(settings.decode(contents(self.path)),
        { showRoomGuide = false, highlightPlannedChoices = true, snapMode = true })
    lu.assertEquals(entries(self.root), { "settings.json" })
    lu.assertTrue(self.store.enabled("snapMode"))
    lu.assertEquals(self.logs, { "[RunPlanner] settings set snapMode=true" })
    lu.assertError(self.store.write, "unknownOption", true)
    lu.assertError(self.store.write, "snapMode", "yes")
end

function TestSettings:testCurrentRereadsTheFileOnceItsValuesAreARefreshIntervalOld()
    lu.assertFalse(self.store.enabled("showRoomGuide"))
    publish(self.path, settings.encode({ showRoomGuide = true, highlightPlannedChoices = false, snapMode = false }))
    self.now = settings.REFRESH_SECONDS / 2
    lu.assertFalse(self.store.enabled("showRoomGuide"))
    self.now = settings.REFRESH_SECONDS
    lu.assertTrue(self.store.enabled("showRoomGuide"))
    lu.assertError(self.store.enabled, "unknownOption")
end

function TestSettings:testAFailedWriteLeavesTheFileAndNoTemporaryFile()
    publish(self.path, settings.encode(ALL_OFF))
    local store = settings.create(self.root, pathApi, {
        log = function(line) self.logs[#self.logs + 1] = line end,
        files = {
            open = io.open, remove = os.remove,
            rename = function() return nil, "denied" end,
        },
    })
    local written, reason = store.write("showRoomGuide", true)
    lu.assertFalse(written)
    lu.assertStrContains(reason, "could not rename temp file")
    lu.assertFalse(store.enabled("showRoomGuide"))
    lu.assertEquals(entries(self.root), {})
    lu.assertStrContains(self.logs[1], "[RunPlanner] settings write-failed showRoomGuide=true")
end

local LEGACY = table.concat({
    "## Settings file was created by plugin adamant-ModpackLib native backend", "",
    "[config]", "",
    "# Setting type: Boolean", "# Default value: false", "DebugMode = true", "",
    "HighlightPlannedChoices = false", "", "ShowRoomGuide = true", "", "SnapMode = true", "",
    "[config.Other.1]", "ShowRoomGuide = false", "",
}, "\n")

function TestSettings:testAnAbsentFileIsSeededOnceFromTheOldModpackLibTicks()
    local legacy = self.root .. "/legacy.cfg"
    publish(legacy, LEGACY)
    lu.assertTrue(self.store.seedFromLegacy(legacy))
    lu.assertEquals(settings.decode(contents(self.path)),
        { showRoomGuide = true, highlightPlannedChoices = false, snapMode = true })
    lu.assertEquals(self.logs, { "[RunPlanner] settings seeded from ModpackLib config" })
    -- The written file marks the move done; later changes in the old file are ignored.
    publish(legacy, LEGACY:gsub("SnapMode = true", "SnapMode = false"))
    lu.assertFalse(self.store.seedFromLegacy(legacy))
    lu.assertTrue(self.store.enabled("snapMode"))
end

function TestSettings:testAPresentFileIgnoresTheOldTicks()
    local legacy = self.root .. "/legacy.cfg"
    publish(legacy, LEGACY)
    publish(self.path, "{broken")
    lu.assertFalse(self.store.seedFromLegacy(legacy))
    lu.assertEquals(contents(self.path), "{broken")
end

function TestSettings:testNoOldTicksOrNoOldFileWritesNothing()
    local legacy = self.root .. "/legacy.cfg"
    lu.assertFalse(self.store.seedFromLegacy(legacy))
    lu.assertFalse(self.store.seedFromLegacy(nil))
    publish(legacy, "[config]\nDebugMode = true\n")
    lu.assertFalse(self.store.seedFromLegacy(legacy))
    lu.assertNil(contents(self.path))
end
