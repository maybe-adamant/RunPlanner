-- luacheck: globals TestSlotOverview
local lu = require("luaunit")
local slotOverview = require("mods.presentation.slot_overview")

TestSlotOverview = {}

local BUILD = string.rep("b", 64)
local PATH = { combine = function(root, name) return root .. "/" .. name end }

local ENTRY = '{"label":"Circe - Surface","planName":"Surface Phial run","sentAt":"2026-10-12T10:00:00.000Z",'
    .. '"aspect":"Circe (Staff)","route":"Surface","endBiome":"Olympus","startingKeepsake":"Silver Wheel",'
    .. '"startingFear":8,"practiceStart":"Thessaly · Boss","buildId":"' .. BUILD .. '","fingerprint":"0123abcd"}'

local function overview(slots)
    return '{"format":"run-planner-slot-overview","formatVersion":1,"slots":{' .. slots .. '}}'
end

-- files maps a file name to its content; every open is recorded.
local function store(files)
    local opened = {}
    local api = { open = function(path, mode)
        lu.assertEquals(mode, "rb")
        local name = path:match("[^/]+$")
        opened[#opened + 1] = name
        local content = files[name]
        if content == nil then return nil, path .. ": No such file or directory", 2 end
        local handle = {}
        function handle:read(count) return content:sub(1, count) end
        function handle:close() return true end
        return handle
    end }
    return slotOverview.create("config", PATH, BUILD, { files = api }), opened
end

function TestSlotOverview.testMissingOverviewHoldsNoEntriesAndSlotFilesAreProbed()
    local overviewStore, opened = store({ ["slot-2.runplanner.json"] = "{}" })
    local entries, present = overviewStore.read()
    lu.assertEquals(entries, {})
    lu.assertTrue(present[2])
    lu.assertFalse(present[1])
    lu.assertFalse(present[12])
    lu.assertFalse(present[0])
    lu.assertEquals(#opened, 14)
    lu.assertEquals(opened[1], "slots.runplanner.json")
end

function TestSlotOverview.testEntriesAreDecodedAndMarkedAgainstTheModuleBuild()
    local stale = ENTRY:gsub(BUILD, string.rep("c", 64))
    local overviewStore, opened = store({
        ["slots.runplanner.json"] = overview('"3":' .. ENTRY .. ',"7":' .. stale),
    })
    local entries, present = overviewStore.read()
    lu.assertEquals(entries[3], {
        label = "Circe - Surface", planName = "Surface Phial run", sentAt = "2026-10-12T10:00:00.000Z",
        aspect = "Circe (Staff)", route = "Surface", endBiome = "Olympus", startingKeepsake = "Silver Wheel",
        startingFear = 8, practiceStart = "Thessaly · Boss", buildId = BUILD, fingerprint = "0123abcd",
        matchesBuild = true,
    })
    lu.assertFalse(entries[7].matchesBuild)
    lu.assertTrue(present[3])
    lu.assertTrue(present[7])
    for _, name in ipairs(opened) do
        lu.assertNotEquals(name, "slot-3.runplanner.json")
        lu.assertNotEquals(name, "slot-7.runplanner.json")
    end
end

function TestSlotOverview.testInvalidFilesAndEntriesAreIgnored()
    for _, raw in ipairs({
        "not json",
        '{"format":"run-planner-slot","formatVersion":1,"slots":{}}',
        '{"format":"run-planner-slot-overview","formatVersion":2,"slots":{}}',
        '{"format":"run-planner-slot-overview","formatVersion":1,"slots":[]}',
        overview('"3":' .. ENTRY) .. string.rep(" ", slotOverview.MAX_BYTES),
    }) do
        lu.assertEquals(slotOverview.decode(raw), {}, raw:sub(1, 80))
    end
    local entries = slotOverview.decode(overview(table.concat({
        '"1":' .. ENTRY,
        '"13":' .. ENTRY,
        '"03":' .. ENTRY,
        '"4":' .. ENTRY:gsub('"label":"Circe %- Surface",', ""),
        '"5":' .. ENTRY:gsub('"startingFear":8', '"startingFear":-1'),
        '"6":' .. ENTRY:gsub('"aspect":"Circe %(Staff%)"', '"aspect":" "'),
        '"8":' .. ENTRY:gsub('"planName":"Surface Phial run",', ""),
    }, ",")))
    lu.assertNotNil(entries[1])
    lu.assertNil(entries[3])
    lu.assertNil(entries[4])
    lu.assertNil(entries[5])
    lu.assertNil(entries[6])
    lu.assertNil(entries[8].planName)
    lu.assertEquals(entries[8].label, "Circe - Surface")
    local count = 0
    for _ in pairs(entries) do count = count + 1 end
    lu.assertEquals(count, 2)
end

function TestSlotOverview.testTheEventSlotEntryCarriesItsEvent()
    local event = '"event":{"id":"2026-w42-staff","title":"Week 42: Staff sprint","endsAt":"2026-10-19T00:00:00Z"},'
    local withEvent = ENTRY:gsub('"buildId"', event .. '"buildId"', 1)
    local overviewStore = store({
        ["slots.runplanner.json"] = overview('"0":' .. withEvent .. ',"2":' .. ENTRY),
        ["slot-0.runplanner.json"] = "{}",
    })
    local entries, present = overviewStore.read()
    lu.assertEquals(entries[0].event, {
        id = "2026-w42-staff", title = "Week 42: Staff sprint", endsAt = "2026-10-19T00:00:00Z",
    })
    lu.assertTrue(present[0])
    lu.assertNil(entries[2].event)
    -- Only the event slot names an event, and its file is probed even with an entry.
    local misplaced = slotOverview.decode(overview('"2":' .. withEvent))
    lu.assertNil(misplaced[2].event)
    local gone = store({ ["slots.runplanner.json"] = overview('"0":' .. withEvent) })
    local goneEntries, gonePresent = gone.read()
    lu.assertNotNil(goneEntries[0].event)
    lu.assertFalse(gonePresent[0])
    local malformed = slotOverview.decode(overview('"0":' .. ENTRY:gsub('"buildId"', '"event":{"id":"x"},"buildId"', 1)
        .. ',"00":' .. withEvent))
    lu.assertNotNil(malformed[0])
    lu.assertNil(malformed[0].event)
end

return TestSlotOverview
