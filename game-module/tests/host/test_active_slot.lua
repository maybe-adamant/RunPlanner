-- luacheck: globals TestActiveSlot
local lu = require("luaunit")
local lfs = require("lfs")
local activeSlot = require("mods.host.active_slot")

TestActiveSlot = {}

local pathApi = { combine = function(root, file) return root .. "/" .. file end }

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

local function removeDirectory(root)
    for _, name in ipairs(entries(root)) do os.remove(root .. "/" .. name) end
    lfs.rmdir(root)
end

function TestActiveSlot:setUp()
    self.root = temporaryDirectory()
    self.path = self.root .. "/active-slot.json"
    self.logs = {}
    self.store = activeSlot.create(self.root, pathApi, {
        log = function(line) self.logs[#self.logs + 1] = line end,
    })
end

function TestActiveSlot:tearDown()
    removeDirectory(self.root)
end

function TestActiveSlot.testEncodeIsCanonicalAndRejectsOutOfRangeSlots()
    lu.assertEquals(activeSlot.encode(3), '{"format":"run-planner-active-slot","formatVersion":1,"slot":3}')
    for _, slot in ipairs({ 0, 7, 2.5, "3" }) do
        lu.assertError(activeSlot.encode, slot)
    end
end

function TestActiveSlot.testDecodeAcceptsOnlyTheExactContract()
    lu.assertEquals(activeSlot.decode(activeSlot.encode(6)), 6)
    lu.assertEquals(activeSlot.decode(' { "slot" : 1, "formatVersion": 1, "format": "run-planner-active-slot" }\n'), 1)
    for _, raw in ipairs({
        "",
        "[]",
        '"x"',
        '{"format":"run-planner-active-slot","formatVersion":1}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":0}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":7}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":2.5}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":"2"}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":3.0}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":3e0}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":30e-1}',
        '{"format":"run-planner-active-slot","formatVersion":1.0,"slot":3}',
        '{"format":"run-planner-active-slot","formatVersion":1,"\\u0073lot":3}',
        '{"format":"run-planner-active-slot","formatVersion":2,"slot":2}',
        '{"format":"run-planner-execution","formatVersion":1,"slot":2}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":2,"extra":true}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":2,"slot":3}',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":2} x',
        '{"format":"run-planner-active-slot","formatVersion":1,"slot":2' .. string.rep(" ", 1024) .. "}",
    }) do
        lu.assertNil(activeSlot.decode(raw), raw)
    end
end

function TestActiveSlot:testMissingFileMeansSlotOneWithoutCreatingIt()
    lu.assertEquals({ self.store.read() }, { 1, "missing" })
    lu.assertEquals(entries(self.root), {})
    lu.assertEquals(self.logs, {})
end

function TestActiveSlot:testValidFileIsReadFreshEachTime()
    publish(self.path, activeSlot.encode(4))
    lu.assertEquals({ self.store.read() }, { 4, "present" })
    publish(self.path, activeSlot.encode(2))
    lu.assertEquals({ self.store.read() }, { 2, "present" })
end

function TestActiveSlot:testInvalidFileMeansSlotOneAndIsLeftAndLoggedOncePerContent()
    publish(self.path, '{"slot":3}')
    local slot, state, reason = self.store.read()
    lu.assertEquals({ slot, state }, { 1, "invalid" })
    lu.assertStrContains(reason, "format")
    self.store.read()
    self.store.read()
    lu.assertEquals(contents(self.path), '{"slot":3}')
    lu.assertEquals(#self.logs, 1)
    lu.assertStrContains(self.logs[1], "[RunPlanner] active-slot invalid")
    lu.assertStrContains(self.logs[1], "using slot=1")
    publish(self.path, string.rep("x", 2048))
    self.store.read()
    self.store.read()
    lu.assertEquals(#self.logs, 2)
    publish(self.path, activeSlot.encode(5))
    self.store.read()
    publish(self.path, '{"slot":3}')
    self.store.read()
    lu.assertEquals(#self.logs, 3)
end

function TestActiveSlot:testMissingNeedsENOENTWhenAnErrnoIsGiven()
    local store = activeSlot.create(self.root, pathApi, {
        log = function(line) self.logs[#self.logs + 1] = line end,
        files = { open = function() return nil, "C:/not found/active-slot.json: Permission denied\nnext", 13 end },
    })
    local slot, state = store.read()
    lu.assertEquals({ slot, state }, { 1, "invalid" })
    lu.assertEquals(#self.logs, 1)
    lu.assertNotStrContains(self.logs[1], "\n")
    lu.assertStrContains(self.logs[1], "\\010next")
    local missing = activeSlot.create(self.root, pathApi, { log = function() end,
        files = { open = function() return nil, "denied", 2 end } })
    lu.assertEquals({ missing.read() }, { 1, "missing" })
end

function TestActiveSlot:testRenameIsRetriedOnceBeforeFailing()
    local attempts = 0
    local store = activeSlot.create(self.root, pathApi, { log = function() end, files = {
        open = io.open, remove = os.remove,
        rename = function(from, to)
            attempts = attempts + 1
            if attempts == 1 then return nil, "sharing violation" end
            return os.rename(from, to)
        end,
    } })
    lu.assertTrue(store.write(4))
    lu.assertEquals(attempts, 2)
    lu.assertEquals(contents(self.path), activeSlot.encode(4))
end

function TestActiveSlot:testWriteReplacesTheFileAndLogsTheChange()
    lu.assertTrue(self.store.write(3))
    lu.assertEquals(contents(self.path), activeSlot.encode(3))
    lu.assertTrue(self.store.write(6))
    lu.assertEquals(contents(self.path), activeSlot.encode(6))
    lu.assertEquals(entries(self.root), { "active-slot.json" })
    lu.assertEquals(self.logs, { "[RunPlanner] active-slot set slot=3", "[RunPlanner] active-slot set slot=6" })
end

function TestActiveSlot:testWriteRemovesBeforeRenamingBecauseRenameCannotReplace()
    publish(self.path, activeSlot.encode(2))
    local calls = {}
    local store = activeSlot.create(self.root, pathApi, { log = function() end, files = {
        open = io.open,
        remove = function(path) calls[#calls + 1] = "remove " .. path; return os.remove(path) end,
        rename = function(from, to)
            calls[#calls + 1] = "rename " .. from .. " " .. to
            if contents(to) ~= nil then return nil, "file exists" end
            return os.rename(from, to)
        end,
    } })
    lu.assertTrue(store.write(5))
    lu.assertEquals(calls, {
        "remove " .. self.path,
        "rename " .. self.path .. ".tmp " .. self.path,
    })
    lu.assertEquals(contents(self.path), activeSlot.encode(5))
end

function TestActiveSlot:testFailedWritesLeaveNoPartialOrTemporaryFile()
    local function failing(overrides)
        local files = { open = io.open, remove = os.remove, rename = os.rename }
        for key, value in pairs(overrides) do files[key] = value end
        return activeSlot.create(self.root, pathApi, {
            files = files, log = function(line) self.logs[#self.logs + 1] = line end,
        })
    end
    publish(self.path, activeSlot.encode(2))

    lu.assertFalse(failing({ open = function() return nil, "denied" end }).write(4))
    lu.assertEquals(contents(self.path), activeSlot.encode(2))
    lu.assertEquals(entries(self.root), { "active-slot.json" })

    lu.assertFalse(failing({ open = function(path, mode)
        local file = io.open(path, mode)
        return { write = function() return nil, "disk full" end, close = function() return file:close() end }
    end }).write(4))
    lu.assertEquals(contents(self.path), activeSlot.encode(2))
    lu.assertEquals(entries(self.root), { "active-slot.json" })

    lu.assertFalse(failing({ remove = function(path)
        if path == self.path then return nil, "access denied" end
        return os.remove(path)
    end }).write(4))
    lu.assertEquals(contents(self.path), activeSlot.encode(2))
    lu.assertEquals(entries(self.root), { "active-slot.json" })

    lu.assertFalse(failing({ rename = function() return nil, "access denied" end }).write(4))
    lu.assertEquals(entries(self.root), {})
    lu.assertEquals({ self.store.read() }, { 1, "missing" })

    lu.assertEquals(#self.logs, 4)
    for _, line in ipairs(self.logs) do lu.assertStrContains(line, "[RunPlanner] active-slot write-failed slot=4") end
end

return TestActiveSlot
