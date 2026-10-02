local lu = require("luaunit")
local lfs = require("lfs")
local inbox = require("mods/host/inbox")
local buildIdentity = require("mods/host/build_identity")
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

local BUILD = string.rep("ab", 32)
local OTHER_BUILD = string.rep("cd", 32)

local function envelope(buildId, plan)
    return '{"format":"run-planner-slot","buildId":"' .. buildId .. '","plan":' .. (plan or fixtures.raw()) .. "}"
end

local function slot(buildId) return envelope(buildId or BUILD) end

function TestInbox.testOnlyTheSelectedFixedSlotIsRead()
    local root = temporaryDirectory()
    write(root .. "/other.json", slot())
    write(root .. "/slot-1.runplanner.json", slot())
    write(root .. "/slot-2.runplanner.json", slot())
    local runtime = inbox.create(root, protocol.decode, pathApi, BUILD)
    lu.assertEquals(runtime.activeSlot(), 1)
    lu.assertTrue(runtime.load(2))
    lu.assertEquals(runtime.status().slot, 2)
    lu.assertEquals(runtime.status().file, "present")
    write(root .. "/slot-2.runplanner.json", string.rep("x", inbox.MAX_BYTES + 1))
    lu.assertFalse(runtime.load())
    lu.assertEquals(runtime.status().error.code, "plan-too-large")
    lu.assertFalse(runtime.load(7))
    lu.assertEquals(runtime.status().error.code, "invalid-slot")
    removeDirectory(root)
end

function TestInbox.testFreshReaderDoesNotInspectUntilAsked()
    local root = temporaryDirectory()
    write(root .. "/slot-1.runplanner.json", slot())
    local runtime = inbox.create(root, protocol.decode, pathApi, BUILD)
    lu.assertEquals(runtime.status().inspection, "not-inspected")
    lu.assertNil(runtime.plan())
    lu.assertTrue(runtime.load())
    lu.assertEquals(runtime.status().inspection, "inspected")
    removeDirectory(root)
end

function TestInbox.testMissingSlotIsInactiveAndDoesNotEnumerateAlternatives()
    local root = temporaryDirectory()
    write(root .. "/slot-2.runplanner.json", slot())
    local runtime = inbox.create(root, protocol.decode, pathApi, BUILD)
    lu.assertFalse(runtime.load())
    lu.assertEquals(runtime.status().error.code, "not-published")
    lu.assertEquals(runtime.status().error.message, "published plan slot 1 is not present")
    removeDirectory(root)
end

function TestInbox.testMalformedPlanRetainsTheDecoderReason()
    local root = temporaryDirectory()
    write(root .. "/slot-3.runplanner.json", slot())
    local runtime = inbox.create(root, function() return nil, "specific decoder rejection" end, pathApi, BUILD)
    lu.assertFalse(runtime.load(3))
    lu.assertEquals(runtime.status().error, {
        code = "malformed-plan",
        message = "specific decoder rejection",
    })
    removeDirectory(root)
end

function TestInbox.testOnlyAnExactEnvelopeForThisBuildIsAdmitted()
    local root = temporaryDirectory()
    local runtime = inbox.create(root, protocol.decode, pathApi, BUILD)
    write(root .. "/slot-1.runplanner.json", slot())
    lu.assertTrue(runtime.load(1))
    lu.assertEquals(runtime.status().build, BUILD:sub(1, 12))
    lu.assertEquals(runtime.status().catalog, protocol.CATALOG_VERSION)
    lu.assertEquals(runtime.plan().planFingerprint, fixtures.decode().planFingerprint)
    local cases = {
        { slot(OTHER_BUILD), "stale-slot" },
        { fixtures.raw(), "stale-slot" },
        { "not json", "malformed-plan" },
        { '{"format":"run-planner-slot","buildId":"' .. BUILD .. '"}', "malformed-plan" },
        { (envelope(BUILD):gsub('^{', '{"extra":1,')), "malformed-plan" },
        { envelope(BUILD, '{"format":"run-planner-execution"}'), "malformed-plan" },
    }
    for _, case in ipairs(cases) do
        write(root .. "/slot-1.runplanner.json", case[1])
        local loaded, code = runtime.load(1)
        lu.assertFalse(loaded)
        lu.assertEquals(code, case[2])
        lu.assertEquals(runtime.status().error.code, case[2])
        lu.assertNil(runtime.plan())
    end
    write(root .. "/slot-1.runplanner.json", slot(OTHER_BUILD))
    runtime.load(1)
    lu.assertStrContains(runtime.status().error.message, "send it again")
    local unknown = inbox.create(root, protocol.decode, pathApi, nil)
    lu.assertFalse(unknown.load(1))
    lu.assertEquals(unknown.status().error.code, "module-build-unknown")
    lu.assertEquals(unknown.status().build, "unknown")
    lu.assertStrContains(unknown.status().error.message, "Game panel")
    removeDirectory(root)
end

function TestInbox.testBuildIdentityReadsOnlyAStampedCompatibilityFile()
    local root = temporaryDirectory()
    local file = root .. "/" .. buildIdentity.FILE_NAME
    lu.assertNil(buildIdentity.read(root, pathApi))
    write(file, '{"format":"run-planner-execution","catalogVersion":"c","buildId":"' .. BUILD .. '"}')
    lu.assertEquals(buildIdentity.read(root, pathApi), BUILD)
    for _, content in ipairs({
        '{"format":"run-planner-execution","catalogVersion":"c"}',
        '{"buildId":"abc"}',
        '{"buildId":"' .. BUILD:upper() .. '"}',
        '["' .. BUILD .. '"]',
        "not json",
        '{"buildId":"' .. BUILD .. '"}' .. string.rep(" ", buildIdentity.MAX_BYTES),
    }) do
        write(file, content)
        lu.assertNil(buildIdentity.read(root, pathApi))
    end
    lu.assertNil(buildIdentity.read(nil, pathApi))
    lu.assertEquals(buildIdentity.short(BUILD), BUILD:sub(1, 12))
    lu.assertEquals(buildIdentity.short(nil), "unknown")
    removeDirectory(root)
end

function TestInbox.testAllSixSlotsUseTheClosedFileMapping()
    for slot = 1, inbox.SLOT_COUNT do
        lu.assertEquals(inbox.slotFileName(slot), "slot-" .. tostring(slot) .. ".runplanner.json")
    end
    lu.assertNil(inbox.slotFileName(0))
    lu.assertNil(inbox.slotFileName(7))
    lu.assertNil(inbox.slotFileName(1.5))
end

function TestInbox.testMissingFileUsesErrnoBeforeMessageText()
    lu.assertTrue(inbox.isMissingFileError("anything", 2))
    lu.assertFalse(inbox.isMissingFileError("C:/not found/slot-1.runplanner.json: Permission denied", 13))
    lu.assertTrue(inbox.isMissingFileError("slot-1.runplanner.json: No such file or directory"))
    lu.assertFalse(inbox.isMissingFileError("Permission denied"))
end

return TestInbox
