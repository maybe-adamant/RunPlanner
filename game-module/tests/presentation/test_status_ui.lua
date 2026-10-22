-- luacheck: globals TestStatusUi
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local statusUi = require("mods.presentation.status_ui")
local hostData = require("mods.host.data")
local nativeGame = require("tests.harness.native_game")

TestStatusUi = {}

local function matchesVersion(entry)
    local protocol = require("mods.protocol.decoder")
    return protocol.matchesVersion(entry)
end

local function decodeFixture(name)
    local file = assert(io.open(fixtures.path(name), "rb"))
    local raw = file:read("*a")
    file:close()
    return assert(require("mods.protocol.decoder").decode(assert(require("mods.protocol.json").decode(raw))))
end

local function publishedPlan() return decodeFixture("automatic-boss.execution.json") end

local function entry(fields)
    local value = {
        label = "Melinoe - Underworld", planName = "Staff practice", sentAt = "2026-10-12T10:00:00.000Z",
        aspect = "Melinoe (Staff)", route = "Underworld", endBiome = "Oceanus", startingFear = 8,
        catalogVersion = "0.55.0-anvil-of-fates", schemaVersion = 98, schemaRevision = 1,
        fingerprint = "b999ccce", matchesVersion = true,
    }
    for key, field in pairs(fields or {}) do value[key] = field end
    return value
end

local function slotFile(slot)
    local file = { slot = slot, state = "present", reads = 0, writes = {} }
    function file.read() file.reads = file.reads + 1; return file.slot, file.state end
    function file.write(value) file.writes[#file.writes + 1] = value; file.slot = value; return true end
    return file
end

local function overviewStore(entries, present)
    local store = { entries = entries or {}, present = present or {}, reads = 0 }
    function store.read() store.reads = store.reads + 1; return store.entries, store.present end
    return store
end

-- slots[n] is { plan = plan } or { error = code }; a missing slot is not published.
local function fakeInbox(slots)
    local inbox = { loads = {}, slots = slots or {} }
    local current, plan, status = 1, nil, { file = "not-inspected" }
    function inbox.activeSlot() return current end
    function inbox.plan() return plan end
    function inbox.status()
        local copy = { slot = current, schema = "96.0", catalog = "unknown" }
        for key, value in pairs(status) do copy[key] = value end
        return copy
    end
    function inbox.load(slot)
        inbox.loads[#inbox.loads + 1] = slot
        current = slot
        local published = inbox.slots[slot]
        if published == nil then
            plan, status = nil, { file = "not-published", error = { code = "not-published", message = "absent" } }
        elseif published.plan then
            plan = published.plan
            status = { file = "present", catalog = plan.catalogVersion, fingerprint = plan.planFingerprint }
        else
            plan, status = nil, { file = "present", error = { code = published.error, message = "rejected" } }
        end
        return plan ~= nil
    end
    return inbox
end

local function viewField(value)
    local field = { value = value }
    function field.read() return field.value end
    function field.write(_, next) field.value = next end
    return field
end

-- A window drawn once per call as Lib's module frame draws it: the header, then
-- each tab's label and state, then the active tab. Picks and buttons are queued
-- for the next draw.
local function harness(options)
    options = options or {}
    local h = {
        inbox = options.inbox or fakeInbox(options.slots),
        file = options.file or slotFile(options.slot or 1),
        overview = options.overview or overviewStore(options.entries, options.present),
        snapshot = options.snapshot or { state = "inactive", reason = "not-started" },
        tab = options.tab or "Plan", debug = options.debug == true,
        field = viewField(1), picks = {}, presses = {}, now = 0,
    }
    h.inspections = 0
    local ui = statusUi.bind(h.inbox, function() h.inspections = h.inspections + 1; return h.snapshot end, h.file,
        h.overview,
        function() return h.now end)
    local lines, tabs, dropdown, checkboxes
    h.drawn = {}
    local function seen(text) h.drawn[#h.drawn + 1] = text; return text end
    local imgui = {
        TextWrapped = function(text) lines[#lines + 1] = seen(text) end,
        TextDisabled = function(text) lines[#lines + 1] = seen(text) .. ":" end,
        SameLine = function() end,
        BeginTabBar = function() h.open.bar = h.open.bar + 1; return true end,
        EndTabBar = function() h.open.bar = h.open.bar - 1 end,
        BeginTabItem = function(label)
            tabs[#tabs + 1] = seen(label)
            if label == h.tab then h.open.tab = h.open.tab + 1 end
            return label == h.tab
        end,
        EndTabItem = function() h.open.tab = h.open.tab - 1 end,
        CollapsingHeader = function(label) lines[#lines + 1] = "[" .. seen(label) .. "]"; return true end,
        PushID = function() h.open.id = h.open.id + 1 end, PopID = function() h.open.id = h.open.id - 1 end,
        Indent = function() h.open.indent = h.open.indent + 1 end,
        Unindent = function() h.open.indent = h.open.indent - 1 end,
    }
    local widgets = {
        text = function(text, style) lines[#lines + 1] = seen(text); h.lastStyle = style end,
        separator = function() end,
        dropdown = function(target, opts)
            dropdown = { opts = opts, shown = target:read() }
            seen(opts.label)
            for _, label in pairs(opts.displayValues) do seen(label) end
            local pick = table.remove(h.picks, 1)
            if pick == nil then return false end
            target:write(pick)
            return true
        end,
        checkbox = function(target, opts)
            seen(opts.label)
            checkboxes[#checkboxes + 1] = { target = target, opts = opts }
        end,
        button = function(label, opts) seen(label); return table.remove(h.presses, 1) == opts.id end,
    }
    local guide, highlight, snap = viewField(false), viewField(false), viewField(false)
    local ctx = {
        data = { get = function(alias)
            if alias == "ActivePlanSlot" then return h.field end
            if alias == "ShowRoomGuide" then return guide end
            if alias == "HighlightPlannedChoices" then return highlight end
            if alias == "SnapMode" then return snap end
            if alias == "DebugMode" then return viewField(h.debug) end
            error("unexpected alias " .. alias)
        end },
        draw = { imgui = imgui, widgets = widgets },
    }
    function h.draw(pick, press)
        lines, tabs, checkboxes = {}, {}, {}
        h.open = { bar = 0, tab = 0, id = 0, indent = 0 }
        if pick then h.picks[#h.picks + 1] = pick end
        if press then h.presses[#h.presses + 1] = press end
        ui.header(nil, ctx)
        h.states = {}
        for _, entry in ipairs(ui.tabs) do
            tabs[#tabs + 1] = seen(entry.label)
            h.states[entry.id] = entry.state and entry.state(nil, ctx) or nil
            if entry.label == h.tab then entry.draw(nil, ctx) end
        end
        h.lines, h.tabs, h.dropdown, h.checkboxes = lines, tabs, dropdown, checkboxes
        h.guide, h.highlight, h.snap = guide, highlight, snap
        return table.concat(lines, "\n")
    end
    return h
end

function TestStatusUi:setUp()
    self.restore = nativeGame.install({ GetDisplayName = function(args)
        local labels = {
            WeaponStaffSwing = "Witch's Staff", BaseStaffAspect = "Aspect of Melinoe",
            BossMetaUpgradeKeepsake = "Crystal Figurine", ZeusWeaponBoon = "Heaven Strike",
            ZeusSpecialBoon = "Heaven Flourish",
        }
        return labels[args.Text] or args.Text
    end })
end

function TestStatusUi:tearDown()
    self.restore()
end

function TestStatusUi.testStorageIncludesTheViewSlotAndDefaultDisabledGuidanceSettings()
    local storage = hostData.buildStorage()
    lu.assertEquals(#storage, 4)
    lu.assertEquals(storage[1], {
        type = "int", alias = "ActivePlanSlot", default = 1, min = 0, max = 12, persist = false,
    })
    lu.assertEquals(storage[2].alias, "ShowRoomGuide")
    lu.assertFalse(storage[2].default)
    lu.assertEquals(storage[3].alias, "HighlightPlannedChoices")
    lu.assertFalse(storage[3].default)
    -- Snap mode changes gameplay, so it is persisted and hashed like the guidance options.
    lu.assertEquals(storage[4].alias, "SnapMode")
    lu.assertFalse(storage[4].default)
    lu.assertNil(storage[4].persist)
    lu.assertNil(storage[4].hash)
    lu.assertNil(hostData.buildStatus)
end

function TestStatusUi.testPickerLabelsSlotsFromTheOverviewAndSlotFiles()
    local h = harness({
        slot = 3, entries = { [3] = entry({ label = "Circe - Surface" }) }, present = { [2] = true, [3] = true },
    })
    h.draw()
    local opts = h.dropdown.opts
    lu.assertEquals(opts.label, "Plan for next run")
    lu.assertEquals(opts.values, { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 })
    lu.assertEquals(opts.displayValues[1], "Slot 1 (empty)")
    lu.assertEquals(opts.displayValues[2], "Slot 2")
    lu.assertEquals(opts.displayValues[3], "Slot 3 (Circe - Surface)")
    lu.assertEquals(opts.displayValues[12], "Slot 12 (empty)")
    lu.assertEquals(h.dropdown.shown, 3)
    lu.assertEquals(h.checkboxes[1].opts, { id = "show_room_guide", label = "Show room guide" })
    lu.assertIs(h.checkboxes[1].target, h.guide)
    lu.assertEquals(h.checkboxes[2].opts, { id = "highlight_planned_choices", label = "Highlight planned choices" })
end

local EVENT = { id = "2026-w42-staff", title = "Week 42: Staff sprint", endsAt = "2026-10-19T00:00:00Z" }

function TestStatusUi.testPickerMarksSlotsMadeForAnotherVersionAsOutdated()
    local h = harness({
        slot = 3, present = { [0] = true },
        entries = {
            [0] = entry({ event = EVENT, matchesVersion = false }),
            [3] = entry({ label = "Circe - Surface", matchesVersion = false }),
            [4] = entry({ label = "Circe - Surface" }),
        },
    })
    local text = h.draw()
    lu.assertEquals(h.dropdown.opts.displayValues[0], "Event: Week 42: Staff sprint (outdated)")
    lu.assertEquals(h.dropdown.opts.displayValues[3], "Slot 3 (Circe - Surface) (outdated)")
    lu.assertEquals(h.dropdown.opts.displayValues[4], "Slot 4 (Circe - Surface)")
    lu.assertStrContains(text, "Made for another Run Planner version - resend from the app or update the mod")
    lu.assertEquals(h.inbox.loads, {})
end

function TestStatusUi.testTheEventSlotIsListedFirstOnlyWhileItHoldsAFileOrIsActive()
    local h = harness({ slot = 2, present = { [2] = true } })
    h.draw()
    lu.assertEquals(h.dropdown.opts.values, { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 })
    lu.assertNil(h.dropdown.opts.displayValues[0])

    h = harness({
        slot = 2, entries = { [0] = entry({ label = "Circe - Surface", event = EVENT }) }, present = { [0] = true },
    })
    h.draw()
    lu.assertEquals(h.dropdown.opts.values, { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 })
    lu.assertEquals(h.dropdown.opts.displayValues[0], "Event: Week 42: Staff sprint (Circe - Surface)")
    h.draw(0)
    lu.assertEquals(h.file.writes, { 0 })
    lu.assertEquals(h.inbox.loads, {})

    -- An active event slot whose file is gone stays listed so the picker shows it.
    h = harness({ slot = 0 })
    local text = h.draw()
    lu.assertEquals(h.dropdown.opts.values[1], 0)
    lu.assertEquals(h.dropdown.opts.displayValues[0], "Event (none)")
    lu.assertStrContains(text, "No event right now.")
end

local function reopen(h) h.now = h.now + statusUi.REOPEN_GAP_SECONDS + 0.1 end

function TestStatusUi.testDrawingAndPickingNeverLoadAndLoadDecodesTheShownSlot()
    local plan = publishedPlan()
    local h = harness({ slot = 2, slots = { [2] = { plan = plan }, [5] = { plan = plan } } })
    for _ = 1, 120 do
        h.draw()
        h.now = h.now + 1 / 60
    end
    lu.assertEquals(h.inbox.loads, {})
    h.draw(5)
    lu.assertEquals(h.file.writes, { 5 })
    lu.assertEquals(h.field.value, 5)
    lu.assertEquals(h.inbox.loads, {})
    h.draw(nil, "run_planner_reload")
    lu.assertEquals(h.inbox.loads, { 5 })
    h.draw()
    reopen(h)
    h.draw()
    lu.assertEquals(h.inbox.loads, { 5 })
end

function TestStatusUi.testTheViewIsReadWhenTheWindowOpensAndAfterItsOwnWrite()
    local h = harness({ slot = 2, slots = { [2] = { plan = publishedPlan() } } })
    for _ = 1, 600 do
        h.draw()
        h.now = h.now + 1 / 60
    end
    lu.assertEquals(h.file.reads, 1)
    lu.assertEquals(h.overview.reads, 1)
    h.file.slot = 4
    h.field.value = 1
    h.draw()
    lu.assertEquals(h.field.value, 2)
    lu.assertEquals(h.file.reads, 1)
    reopen(h)
    h.draw()
    lu.assertEquals(h.field.value, 4)
    lu.assertEquals(h.file.reads, 2)
    lu.assertEquals(h.overview.reads, 2)
    h.draw(6)
    lu.assertEquals(h.file.reads, 3)
    lu.assertEquals(h.overview.reads, 2)
    h.draw(nil, "run_planner_reload")
    lu.assertEquals(h.file.reads, 4)
    lu.assertEquals(h.overview.reads, 3)
    lu.assertEquals(h.inbox.loads, { 6 })
    lu.assertEquals(h.file.writes, { 6 })
end

-- Real stores over counted file opens: frames between openings touch no file.
function TestStatusUi.testFramesOpenNoFilesUntilTheWindowReopens()
    local path = { combine = function(root, name) return root .. "/" .. name end }
    local contents = {
        ["active-slot.json"] = '{"format":"run-planner-active-slot","formatVersion":1,"slot":2}',
        ["slots.runplanner.json"] = '{"format":"run-planner-slot-overview","formatVersion":2,"slots":{"2":'
            .. '{"label":"Melinoe - Underworld","sentAt":"2026-10-12T10:00:00.000Z","aspect":"Melinoe (Staff)",'
            .. '"route":"Underworld","endBiome":"Oceanus","startingFear":8,"catalogVersion":"0.55.0-anvil-of-fates",'
            .. '"schemaVersion":98,"schemaRevision":1,"fingerprint":"b999ccce"}}}',
        ["slot-2.runplanner.json"] = "{}",
    }
    local opens = 0
    local files = {
        open = function(name)
            opens = opens + 1
            local content = contents[name:match("[^/]+$")]
            if content == nil then return nil, name .. ": No such file or directory", 2 end
            return { read = function() return content end, close = function() return true end }
        end,
    }
    local h = harness({
        file = require("mods.host.active_slot").create("config", path, { files = files, log = function() end }),
        overview = require("mods.presentation.slot_overview").create("config", path, matchesVersion, { files = files }),
    })
    local text = h.draw()
    lu.assertStrContains(text, "Route:\nUnderworld -> Oceanus")
    local perOpening = opens
    lu.assertTrue(perOpening > 0)
    for _ = 1, 600 do
        h.now = h.now + 1 / 60
        h.draw()
    end
    lu.assertEquals(opens, perOpening)
    reopen(h)
    h.draw()
    lu.assertEquals(opens, 2 * perOpening)
    lu.assertEquals(h.inbox.loads, {})
end

function TestStatusUi.testFailedPickShowsWhatTheFileNowHolds()
    local h = harness({ slot = 3 })
    local fail = true
    function h.file.write(value)
        h.file.writes[#h.file.writes + 1] = value
        if fail then h.file.slot, h.file.state = 1, "missing"; return false end
        h.file.slot, h.file.state = value, "present"
        return true
    end
    lu.assertStrContains(h.draw(6), "Could not save the active slot.")
    lu.assertEquals(h.field.value, 1)
    lu.assertStrContains(h.draw(), "Could not save the active slot.")
    fail = false
    lu.assertNotStrContains(h.draw(2), "Could not save the active slot.")
    lu.assertEquals(h.field.value, 2)
end

function TestStatusUi.testDetailsComeFromTheOverviewEntry()
    local h = harness({
        slot = 4, slots = { [4] = { plan = publishedPlan() } },
        entries = { [4] = entry({ startingKeepsake = "Silver Wheel", practiceStart = "Thessaly · Boss" }) },
    })
    local text = h.draw()
    lu.assertStrContains(text, "Plan:\nStaff practice")
    lu.assertStrMatches(text, ".*Sent:\n%d+ Oct 2026, %d%d:%d%d\n.*")
    lu.assertStrContains(text, "Aspect:\nMelinoe (Staff)")
    lu.assertStrContains(text, "Route:\nUnderworld -> Oceanus")
    lu.assertStrContains(text, "Keepsake:\nSilver Wheel")
    lu.assertStrContains(text, "Fear:\n8")
    lu.assertStrContains(text, "Practice:\nThessaly - Boss")
    lu.assertStrContains(text, "Status:\nReady")
    lu.assertNotStrContains(text, "Witch's Staff")
end

function TestStatusUi.testDetailsFollowTheLoadedPlanWhenTheEntryDescribesAnotherFingerprint()
    local h = harness({
        slot = 4, slots = { [4] = { plan = publishedPlan() } },
        entries = { [4] = entry({ fingerprint = "ffffffff", planName = "Old plan" }) },
    })
    lu.assertStrContains(h.draw(), "Plan:\nOld plan")
    local text = h.draw(nil, "run_planner_reload")
    lu.assertNotStrContains(text, "Old plan")
    lu.assertNotStrContains(text, "Sent:")
    lu.assertStrContains(text, "Aspect:\nAspect of Melinoe (Witch's Staff)")
    lu.assertStrContains(text, "Route:\nUnderworld -> Oceanus")
    lu.assertStrContains(text, "Keepsake:\nCrystal Figurine")
    lu.assertNotStrContains(text, "Fear:")
    lu.assertStrContains(text, "Status:\nReady")
end

function TestStatusUi.testSlotStatusesForEmptyStaleAndUnreadableSlots()
    local h = harness({ slot = 1 })
    lu.assertStrContains(h.draw(), "Nothing sent to this slot yet.")
    lu.assertNotStrContains(h.draw(), "Status:")

    h = harness({
        slot = 2, slots = { [2] = { error = "stale-slot" } }, entries = { [2] = entry({ matchesVersion = false }) },
    })
    local text = h.draw()
    lu.assertStrContains(text, "Plan:\nStaff practice")
    lu.assertStrContains(text, "Made for another Run Planner version - resend from the app or update the mod")

    -- A slot file the overview does not describe is decoded only on Load.
    h = harness({ slot = 2, slots = { [2] = { error = "malformed-plan" } }, present = { [2] = true } })
    text = h.draw()
    lu.assertStrContains(text, "No overview - Load to inspect")
    lu.assertNotStrContains(text, "Status:")
    lu.assertEquals(h.inbox.loads, {})
    text = h.draw(nil, "run_planner_reload")
    lu.assertStrContains(text, "Status:\nThis slot can't be read")
    lu.assertNotStrContains(text, "Nothing sent")
    lu.assertNotStrContains(text, "No overview")
end

local function synchronized(plan, index, fields)
    local snapshot = { state = "synchronized", reason = "ready", slot = 2, plan = plan, index = index,
        current = plan.occurrencesById[plan.selectedOccurrenceIds[index]] }
    for key, value in pairs(fields or {}) do snapshot[key] = value end
    return snapshot
end

function TestStatusUi.testTheHeaderAndTheShownTabShareOneSessionReadPerFrame()
    local h = harness({ tab = "Current Run", snapshot = synchronized(publishedPlan(), 2) })
    for _ = 1, 30 do
        h.draw()
        h.now = h.now + 1 / 60
    end
    lu.assertEquals(h.inspections, 30)
    lu.assertEquals(h.overview.reads, 1)
    lu.assertEquals(h.inbox.loads, {})
end

function TestStatusUi.testHeaderStates()
    local plan = publishedPlan()
    local named = publishedPlan()
    named.displayName = "Golden run"
    local practice = decodeFixture("underworld-start-i-preboss.execution.json")
    local cases = {
        { { state = "inactive", reason = "not-started" }, "No run" },
        { { state = "starting", reason = "ready", slot = 2, plan = named, index = 1 },
            "Starting - Golden run (Slot 2)" },
        { synchronized(plan, 3), "Synchronized - Staff practice (Slot 2)" },
        { synchronized(practice, 40, { plan = practice }), "Synchronized - Slot 2 - Practice" },
        { synchronized(plan, 3, { state = "desynchronized", reason = "first-mismatch",
            issue = { checkpoint = "test-contact" } }),
            "Desynchronized", "Out of sync at Erebus Combat 3. The game continues on its own." },
        { synchronized(plan, 3, { state = "faulted", reason = "executor-fault" }),
            "Stopped (planner error)", "The game continues on its own." },
        { { state = "inactive", reason = "admission-rejected", issue = { checkpoint = "run-start",
            observed = { code = "stale-slot" } } },
            "Plan not used", "Made for another Run Planner version - update the mod or resend." },
        { synchronized(plan, 25, { state = "inactive", reason = "configured-prefix-complete" }),
            "Plan complete - Staff practice" },
        { synchronized(plan, 25, { reason = "configured-prefix-complete" }), "Plan complete - Staff practice" },
        { { state = "inactive", reason = "resumed-unsteered" },
            "Not steering", "Resumed after a reload; this run isn't steered." },
        { synchronized(plan, 3, { state = "inactive", reason = "disabled" }),
            "Not steering", "Run Planner was turned off during this run." },
    }
    for _, case in ipairs(cases) do
        local h = harness({ snapshot = case[1], tab = "none", entries = { [2] = entry() } })
        h.draw()
        lu.assertEquals(h.lines[1], case[2])
        lu.assertEquals(h.lines[2], case[3])
        lu.assertNotStrContains(table.concat(h.lines, "\n"), "Steering")
    end
end

function TestStatusUi.testCurrentRunShowsPlanProgressAndTheNextRoom()
    local plan = publishedPlan()
    local h = harness({ tab = "Current Run", snapshot = synchronized(plan, 2), entries = { [2] = entry() } })
    local text = h.draw()
    lu.assertStrContains(text, "Staff practice (Slot 2)")
    lu.assertStrContains(text, "Room 2 of 25 - Erebus Combat 2")
    h.snapshot.current, h.snapshot.index = nil, 3
    text = h.draw()
    lu.assertStrContains(text, "Next: Erebus Combat 3 (room 3 of 25)")
    lu.assertNotStrContains(text, "Underworld")

    h.snapshot = synchronized(plan, 25, { state = "inactive", reason = "configured-prefix-complete" })
    lu.assertStrContains(h.draw(), "Staff practice - all 25 planned rooms done. The game continues on its own.")

    h.snapshot = synchronized(plan, 3, { state = "inactive", reason = "disabled" })
    text = h.draw()
    lu.assertStrContains(text, "No plan is running. The next run will use Slot 1 (empty).")
    lu.assertNotStrContains(text, "Room 3")
end

function TestStatusUi.testPracticeProgressCountsFromTheStartRoom()
    local plan = decodeFixture("underworld-start-i-preboss.execution.json")
    local h = harness({ tab = "Current Run", snapshot = synchronized(plan, 40) })
    local text = h.draw()
    lu.assertStrContains(text, "Slot 2 - Practice from Tartarus - Preboss")
    lu.assertStrContains(text, "Room 1 of 2 - Tartarus Preboss")
    h.snapshot = synchronized(plan, 41)
    lu.assertStrContains(h.draw(), "Room 2 of 2 - Tartarus Chronos")
end

function TestStatusUi.testNoRunNamesTheNextRunSlot()
    local h = harness({ tab = "Current Run", slot = 3, entries = { [3] = entry({ label = "Circe - Surface" }) } })
    lu.assertStrContains(h.draw(), "No plan is running. The next run will use Slot 3 (Circe - Surface).")
end

function TestStatusUi.testEventDetailsAndTheRunningEventComeFromTheEventEntry()
    local plan = publishedPlan()
    local h = harness({
        slot = 0, slots = { [0] = { plan = plan } },
        entries = { [0] = entry({ event = EVENT }) }, present = { [0] = true },
    })
    local text = h.draw()
    lu.assertStrContains(text, "Event:\nWeek 42: Staff sprint")
    lu.assertStrMatches(text, ".*Ends:\n%d+ Oct 2026, %d%d:%d%d\n.*")
    lu.assertStrContains(text, "Plan:\nStaff practice")

    h.tab = "Current Run"
    h.snapshot = synchronized(plan, 2)
    lu.assertStrContains(h.draw(), "Event: Week 42: Staff sprint\n")
    h.overview.present[0] = false
    h.now = h.now + 2
    lu.assertNotStrContains(h.draw(), "Week 42")
    h.overview.present[0] = true
    h.overview.entries[0] = entry({ event = EVENT, fingerprint = "ffffffff" })
    h.now = h.now + 2
    local other = h.draw()
    lu.assertStrContains(other, "Slot 2\nRoom 2 of 25")
    lu.assertNotStrContains(other, "Week 42")
end

local function desynchronized(issue, index, between)
    local plan = publishedPlan()
    local snapshot = synchronized(plan, index or 3, {
        state = "desynchronized", reason = "first-mismatch", issue = issue,
        checkpoint = issue.checkpoint,
    })
    if between then snapshot.current = nil end
    local h = harness({ tab = "Current Run", snapshot = snapshot })
    return h.draw()
end

function TestStatusUi.testMismatchesAreDescribedInPlainWords()
    local text = desynchronized({
        checkpoint = "room-exit-conformance:traitInventory",
        expected = { present = { { traitKey = "ZeusWeaponBoon", rarity = "Epic" },
            { traitKey = "ZeusSpecialBoon" } }, absent = {} },
        observed = { present = { { traitKey = "ZeusWeaponBoon", rarity = "Rare" } }, absent = {} },
    })
    lu.assertStrContains(text, "Stopped at Erebus Combat 3 (leaving the room) - room 3 of 25")
    lu.assertStrContains(text, "What differed: missing Heaven Flourish; Heaven Strike is Rare, planned Epic.")
    lu.assertStrContains(text, "[More details]")
    lu.assertStrContains(text, "Heaven Strike (Epic)")
    lu.assertNotStrContains(text, "ZeusWeaponBoon")

    local plan = publishedPlan()
    text = desynchronized({
        checkpoint = "room-entry", expected = plan.occurrencesById[plan.selectedOccurrenceIds[3]],
        observed = { id = "golden-f-b2-e1", gameName = "F_Combat07" },
    }, 3, true)
    lu.assertStrContains(text, "Out of sync at Erebus Combat 7.")
    lu.assertStrContains(text, "Stopped at Erebus Combat 7 (entering the room) - room 3 of 25")
    lu.assertStrContains(text, "What differed: planned Erebus Combat 3, entered Erebus Combat 7.")

    text = desynchronized({ kind = "target", index = 1, expected = "F_Combat04", observed = "F_Combat09" })
    lu.assertStrContains(text, "(when the doors appeared)")
    lu.assertStrContains(text, "What differed: a door led to Erebus Combat 9 instead of Erebus Combat 4.")

    text = desynchronized({ checkpoint = "obligation:exitUsable", expected = "owner-1", observed = "incomplete" })
    lu.assertStrContains(text, "(when the exits opened)")
    lu.assertStrContains(text, "What differed: a planned step wasn't done before the exits opened.")

    text = desynchronized({ checkpoint = "room-exit-conformance:elementCounts",
        expected = { Fire = 2, Air = 0 }, observed = { Fire = 1, Air = 0 } })
    lu.assertStrContains(text, "What differed: element counts Fire 1 (planned 2).")

    text = desynchronized({ checkpoint = "trait-offer-blocked-row", expected = "no blocked row",
        observed = "blocked row" })
    lu.assertStrContains(text, "(a trait choice)")
    lu.assertStrContains(text, "What differed: the game locked a row the plan didn't reject.")

    text = desynchronized({ checkpoint = "test-contact", expected = { count = 4.1 }, observed = { count = 3 } })
    lu.assertStrContains(text, "(a plan check)")
    lu.assertStrContains(text, "What differed: See More details.")
    lu.assertStrContains(text, "  count: 4.1")
    lu.assertNotStrContains(text, "4.0999999")
end

function TestStatusUi.testDiagnosticsTabIsMutedUntilDebugMode()
    local plan = publishedPlan()
    local snapshot = synchronized(plan, 3, {
        state = "desynchronized", reason = "first-mismatch", checkpoint = "test-contact",
        issue = { checkpoint = "test-contact", expected = { count = 4 }, observed = { count = 3 } },
    })
    local h = harness({ snapshot = snapshot, slots = { [1] = { error = "stale-slot" } } })
    h.draw(nil, "run_planner_reload")
    lu.assertEquals(h.tabs, { "Plan", "Current Run", "Diagnostics" })
    lu.assertEquals(h.states, { current_run = "attention", diagnostics = "muted" })
    h.tab = "Diagnostics"
    local hint = h.draw()
    lu.assertStrContains(hint, "Turn on Debug Mode (Advanced tab) to see diagnostics.")
    lu.assertNotStrContains(hint, "Session:")
    h.debug = true
    local text = h.draw()
    lu.assertEquals(h.states, { current_run = "attention" })
    lu.assertStrContains(text, "Session: desynchronized / first-mismatch")
    lu.assertStrContains(text, "Checkpoint: test-contact")
    lu.assertStrContains(text, "Schema: 96.0")
    lu.assertStrContains(text, "Slot error: stale-slot")
    lu.assertStrContains(text, "Running project: " .. plan.projectId)
    lu.assertStrContains(text, "Running fingerprint: " .. plan.planFingerprint)
    lu.assertStrContains(text, "count: 4")
end

function TestStatusUi.testPlannerChangesToTheShownSlotShowWhenTheWindowReopens()
    local h = harness({ slot = 2 })
    lu.assertStrContains(h.draw(), "Nothing sent to this slot yet.")
    -- First send to the empty slot.
    h.inbox.slots[2] = { plan = publishedPlan() }
    h.overview.entries, h.overview.present = { [2] = entry() }, { [2] = true }
    h.now = h.now + 0.1
    lu.assertStrContains(h.draw(), "Nothing sent to this slot yet.")
    reopen(h)
    local text = h.draw()
    lu.assertStrContains(text, "Plan:\nStaff practice")
    lu.assertStrContains(text, "Status:\nReady")
    h.draw(nil, "run_planner_reload")
    lu.assertEquals(h.inbox.loads, { 2 })
    -- A different plan resent to the slot: the overview describes it again.
    h.overview.entries[2] = entry({ fingerprint = "11111111", planName = "Resent" })
    reopen(h)
    lu.assertStrContains(h.draw(), "Plan:\nResent")
    -- Resent for another version.
    h.overview.entries[2] = entry({ fingerprint = "11111111", matchesVersion = false })
    reopen(h)
    lu.assertStrContains(h.draw(), "Made for another Run Planner version")
    -- An unreadable file without an entry waits for Load.
    h.inbox.slots[2] = { error = "malformed-plan" }
    h.overview.entries[2] = nil
    reopen(h)
    lu.assertStrContains(h.draw(), "No overview - Load to inspect")
    lu.assertEquals(h.inbox.loads, { 2 })
end

function TestStatusUi.testFailedSaveStaysUntilTheFileHoldsTheRequestedSlot()
    local h = harness({ slot = 3 })
    local accept = false
    function h.file.write(value)
        h.file.writes[#h.file.writes + 1] = value
        if accept then h.file.slot = value end
        return accept
    end
    lu.assertStrContains(h.draw(6), "Could not save the active slot.")
    lu.assertEquals(h.field.value, 3)
    reopen(h)
    lu.assertStrContains(h.draw(), "Could not save the active slot.")
    h.file.slot = 6
    reopen(h)
    lu.assertNotStrContains(h.draw(), "Could not save the active slot.")
end

function TestStatusUi.testMalformedRecordsKeepEveryImGuiScopeBalanced()
    local plan = publishedPlan()
    local throwing = setmetatable({}, { __index = function() error("boom") end })
    local unpairable = setmetatable({}, { __pairs = function() error("no pairs") end })
    local issues = {
        { outcome = "fault", checkpoint = "practice-start:install", traceback = "stack", observed = "boom" },
        { code = "lua-error", message = "attempt to index nil" },
        { checkpoint = "room-exit-conformance:traitInventory",
            expected = { present = { { rarity = "Epic" }, "ZeusWeaponBoon", 3 }, absent = { 4, false } },
            observed = { present = "x", absent = {} } },
        { checkpoint = "room-entry", expected = throwing, observed = unpairable },
        throwing,
    }
    for _, issue in ipairs(issues) do
        for _, state in ipairs({ "desynchronized", "faulted" }) do
            for _, tab in ipairs({ "Current Run", "Diagnostics" }) do
                local h = harness({ tab = tab, debug = true, snapshot = synchronized(plan, 3, {
                    state = state, reason = state == "faulted" and "executor-fault" or "first-mismatch",
                    issue = issue,
                }) })
                h.draw()
                lu.assertEquals(h.open, { bar = 0, tab = 0, id = 0, indent = 0 })
                lu.assertTrue(#h.lines >= 1)
            end
        end
    end
    local h = harness({ tab = "Current Run", snapshot = synchronized(plan, 3, {
        state = "desynchronized", reason = "first-mismatch",
        issue = { checkpoint = "room-exit-conformance:traitInventory",
            expected = { present = { { rarity = "Epic" } }, absent = {} }, observed = { present = "x" } },
    }) })
    local text = h.draw()
    lu.assertStrContains(text, "Stopped at Erebus Combat 3 (leaving the room)")
    lu.assertStrContains(text, "What differed: See More details.")
end

function TestStatusUi.testDetailsHideInternalIdsAndEphyraDoorsAreWorded()
    local plan = publishedPlan()
    local h = harness({ tab = "Current Run", snapshot = synchronized(plan, 3, {
        state = "desynchronized", reason = "first-mismatch",
        issue = { kind = "ephyraDoorRoom", doorId = 551234, index = 2,
            expected = "F_Combat04", observed = "F_Combat09" },
    }) })
    local text = h.draw()
    lu.assertStrContains(text, "(when the doors appeared)")
    lu.assertStrContains(text, "What differed: a door led to Erebus Combat 9 instead of Erebus Combat 4.")
    lu.assertNotStrContains(text, "551234")
    h.snapshot.issue = { kind = "cageReward", index = 1, cageIndex = 2, expected = { rewardType = "Boon",
        spawnPointId = 77, doorId = 88, groupIndex = 3 }, observed = { rewardType = "Gold" } }
    text = h.draw()
    lu.assertStrContains(text, "reward type: Boon")
    for _, raw in ipairs({ "77", "88", "index", "Index", "door id", "spawn" }) do lu.assertNotStrContains(text, raw) end
end

function TestStatusUi:testEveryDrawnTextIsAscii()
    self.restore()
    self.restore = nativeGame.install({ GetDisplayName = function(args)
        local labels = { BaseStaffAspect = "Aspect of Melinoë", WeaponStaffSwing = "Witch’s Staff" }
        return labels[args.Text] or args.Text
    end })
    local plan = publishedPlan()
    plan.displayName = "Melinoë’s run — 日本"
    local accented = entry({ label = "Melinoë - Underworld", planName = "Melinoë’s run",
        aspect = "Melinoë (Staff)", practiceStart = "Thessaly · Boss", startingKeepsake = "Ærøskøbing" })
    local states = {
        { "Plan", { state = "inactive", reason = "not-started" } },
        { "Current Run", { state = "inactive", reason = "not-started" } },
        { "Current Run", synchronized(plan, 2) },
        { "Current Run", synchronized(plan, 3, { state = "desynchronized", reason = "first-mismatch",
            issue = { checkpoint = "room-exit-conformance:traitInventory",
                expected = { present = { { traitKey = "BaseStaffAspect" } }, absent = {} },
                observed = { present = {}, absent = {} } } }) },
        { "Current Run", synchronized(plan, 25, { reason = "configured-prefix-complete" }) },
        { "Diagnostics", synchronized(plan, 3, { state = "faulted", reason = "executor-fault",
            issue = { checkpoint = "test", expected = "Melinoë", observed = { name = "Ærø" } } }) },
    }
    local drawn = {}
    for _, case in ipairs(states) do
        for _, slots in ipairs({ { [2] = { plan = plan } }, { [2] = { error = "stale-slot" } } }) do
            local h = harness({ slot = 2, slots = slots, entries = { [2] = accented, [3] = entry() },
                present = { [2] = true }, snapshot = case[2], tab = "Plan", debug = true })
            h.draw(nil, "run_planner_reload")
            h.tab = case[1]
            h.draw()
            for _, text in ipairs(h.drawn) do
                drawn[#drawn + 1] = text
                lu.assertNil(text:find("[\128-\255]"), "non-ASCII text: " .. text)
            end
        end
    end
    local all = table.concat(drawn, "\n")
    lu.assertStrContains(all, "Slot 2 (Melinoe - Underworld)")
    lu.assertStrContains(all, "Melinoe's run - ?? (Slot 2)")
    lu.assertStrContains(all, "Thessaly - Boss")
    lu.assertStrContains(all, "AEroskobing")
end

return TestStatusUi
