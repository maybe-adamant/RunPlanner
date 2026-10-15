local lu = require("luaunit")
local lfs = require("lfs")
local inbox = require("mods/host/inbox")
local protocol = require("mods.protocol.decoder")
local fixtures = require("tests/harness/fixture_loader")

TestInbox = {}

local function temporaryDirectory()
    local path = os.tmpname()
    os.remove(path)
    assert(lfs.mkdir(path))
    return path
end

local function write(path, content)
    local file = assert(io.open(path, "wb"))
    file:write(content)
    file:close()
end

local function removeDirectory(path)
    for filename in lfs.dir(path) do
        if filename ~= "." and filename ~= ".." then os.remove(path .. "/" .. filename) end
    end
    lfs.rmdir(path)
end

local pathApi = { combine = function(root, file) return root .. "/" .. file end }

local REMOVE = {}

-- The fixture plan with header fields replaced; REMOVE removes a field.
local function withHeader(fields)
    local raw = fixtures.raw()
    for key, value in pairs(fields) do
        local pattern = '"' .. key .. '":[^,]*,'
        lu.assertNotNil(raw:find(pattern), key)
        raw = raw:gsub(pattern, value == REMOVE and "" or ('"' .. key .. '":' .. value .. ","), 1)
    end
    return raw
end

local function slot() return fixtures.raw() end

function TestInbox.testOnlyTheSelectedFixedSlotIsRead()
    local root = temporaryDirectory()
    write(root .. "/other.json", slot())
    write(root .. "/slot-1.runplanner.json", slot())
    write(root .. "/slot-2.runplanner.json", slot())
    local runtime = inbox.create(root, protocol.decode, pathApi)
    lu.assertEquals(runtime.activeSlot(), 1)
    lu.assertTrue(runtime.load(2))
    lu.assertEquals(runtime.status().slot, 2)
    lu.assertEquals(runtime.status().file, "present")
    write(root .. "/slot-2.runplanner.json", string.rep("x", inbox.MAX_BYTES + 1))
    lu.assertFalse(runtime.load())
    lu.assertEquals(runtime.status().error.code, "plan-too-large")
    lu.assertFalse(runtime.load(13))
    lu.assertEquals(runtime.status().error.code, "invalid-slot")
    lu.assertFalse(runtime.load(0))
    lu.assertEquals(runtime.status().error.code, "not-published")
    write(root .. "/slot-0.runplanner.json", slot())
    lu.assertTrue(runtime.load(0))
    lu.assertEquals(runtime.activeSlot(), 0)
    lu.assertEquals(runtime.status().slot, 0)
    lu.assertEquals(runtime.status().file, "present")
    removeDirectory(root)
end

function TestInbox.testFreshReaderDoesNotInspectUntilAsked()
    local root = temporaryDirectory()
    write(root .. "/slot-1.runplanner.json", slot())
    local runtime = inbox.create(root, protocol.decode, pathApi)
    lu.assertEquals(runtime.status().inspection, "not-inspected")
    lu.assertNil(runtime.plan())
    lu.assertTrue(runtime.load())
    lu.assertEquals(runtime.status().inspection, "inspected")
    removeDirectory(root)
end

function TestInbox.testMissingSlotIsInactiveAndDoesNotEnumerateAlternatives()
    local root = temporaryDirectory()
    write(root .. "/slot-2.runplanner.json", slot())
    local runtime = inbox.create(root, protocol.decode, pathApi)
    lu.assertFalse(runtime.load())
    lu.assertEquals(runtime.status().error.code, "not-published")
    lu.assertEquals(runtime.status().error.message, "published plan slot 1 is not present")
    removeDirectory(root)
end

function TestInbox.testMalformedPlanRetainsTheDecoderReason()
    local root = temporaryDirectory()
    write(root .. "/slot-3.runplanner.json", slot())
    local runtime = inbox.create(root, function() return nil, "specific decoder rejection" end, pathApi)
    lu.assertFalse(runtime.load(3))
    lu.assertEquals(runtime.status().error, {
        code = "malformed-plan",
        message = "specific decoder rejection",
    })
    removeDirectory(root)
end

function TestInbox.testOnlyAPlanForThisCatalogAndSchemaPairIsAdmitted()
    local root = temporaryDirectory()
    local runtime = inbox.create(root, protocol.decode, pathApi)
    write(root .. "/slot-1.runplanner.json", slot())
    lu.assertTrue(runtime.load(1))
    lu.assertEquals(runtime.status().schema, protocol.versionLabel())
    lu.assertEquals(runtime.status().catalog, protocol.CATALOG_VERSION)
    lu.assertEquals(runtime.plan().planFingerprint, fixtures.decode().planFingerprint)
    local cases = {
        { withHeader({ schemaRevision = protocol.SCHEMA_REVISION + 1 }), "stale-slot" },
        { withHeader({ schemaVersion = protocol.SCHEMA_VERSION - 1 }), "stale-slot" },
        { withHeader({ catalogVersion = '"another-catalog"' }), "stale-slot" },
        { withHeader({ schemaVersion = REMOVE, schemaRevision = REMOVE }), "stale-slot" },
        { '{"format":"run-planner-slot","buildId":"ab","plan":' .. fixtures.raw() .. "}", "stale-slot" },
        { "not json", "malformed-plan" },
        { "[1]", "malformed-plan" },
        { withHeader({ format = '"run-planner-other"' }), "malformed-plan" },
    }
    for _, case in ipairs(cases) do
        write(root .. "/slot-1.runplanner.json", case[1])
        local loaded, code = runtime.load(1)
        lu.assertFalse(loaded)
        lu.assertEquals(code, case[2])
        lu.assertEquals(runtime.status().error.code, case[2])
        lu.assertNil(runtime.plan())
    end
    write(root .. "/slot-1.runplanner.json", withHeader({ schemaRevision = protocol.SCHEMA_REVISION + 1 }))
    runtime.load(1)
    lu.assertStrContains(runtime.status().error.message, "send it again")
    removeDirectory(root)
end

function TestInbox.testTheEventSlotAndTwelveSlotsUseTheClosedFileMapping()
    lu.assertEquals(inbox.SLOT_COUNT, 12)
    lu.assertEquals(inbox.EVENT_SLOT, 0)
    for slot = inbox.EVENT_SLOT, inbox.SLOT_COUNT do
        lu.assertEquals(inbox.slotFileName(slot), "slot-" .. tostring(slot) .. ".runplanner.json")
    end
    lu.assertNil(inbox.slotFileName(-1))
    lu.assertNil(inbox.slotFileName(13))
    lu.assertNil(inbox.slotFileName(1.5))
end

function TestInbox.testMissingFileUsesErrnoBeforeMessageText()
    lu.assertTrue(inbox.isMissingFileError("anything", 2))
    lu.assertFalse(inbox.isMissingFileError("C:/not found/slot-1.runplanner.json: Permission denied", 13))
    lu.assertTrue(inbox.isMissingFileError("slot-1.runplanner.json: No such file or directory"))
    lu.assertFalse(inbox.isMissingFileError("Permission denied"))
end

return TestInbox
