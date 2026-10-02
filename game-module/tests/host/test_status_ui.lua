-- luacheck: globals TestStatusUi
local lu = require("luaunit")
local fixtures = require("tests/harness/fixture_loader")
local statusUi = require("mods.host.status_ui")
local hostData = require("mods.host.data")
local nativeGame = require("tests.harness.native_game")

TestStatusUi = {}

local function inactive()
    return { state = "inactive", reason = "not-started" }
end

local function canvas(lines, tab, detailTab)
    local bars = {}
    return {
        TextWrapped = function(text) lines[#lines + 1] = text end,
        BeginTabBar = function(id) bars[#bars + 1] = id; return true end,
        EndTabBar = function() table.remove(bars) end,
        BeginTabItem = function(label)
            local selected = bars[#bars] == "plan_details" and (detailTab or "Arcana") or (tab or "Plan")
            return label == selected
        end,
        EndTabItem = function() end,
        CollapsingHeader = function() return true end,
        PushID = function() end, PopID = function() end,
        Indent = function() end, Unindent = function() end,
    }
end

local function slotFile(slot)
    local file = { slot = slot, state = "present", reads = 0, writes = {} }
    function file.read() file.reads = file.reads + 1; return file.slot, file.state end
    function file.write(value) file.writes[#file.writes + 1] = value; file.slot = value; return true end
    return file
end

local function viewField(value)
    local field = { value = value }
    function field.read() return field.value end
    function field.write(_, next) field.value = next end
    return field
end

local function publishedPlan()
    local file = assert(io.open(fixtures.path("automatic-boss.execution.json"), "rb"))
    local raw = file:read("*a")
    file:close()
    return assert(require("mods.protocol.decoder").decode(assert(require("mods.protocol.json").decode(raw))))
end

function TestStatusUi:setUp()
    self.labelCalls = 0
    self.restore = nativeGame.install({ GetDisplayName = function(args)
        self.labelCalls = self.labelCalls + 1
        local labels = {
            WeaponStaffSwing = "Witch's Staff", BaseStaffAspect = "Aspect of Melinoe",
            BossMetaUpgradeKeepsake = "Crystal Figurine", ChanneledCast = "The Sorceress",
            HealingReductionShrineUpgrade = "Vow of Scars",
        }
        return labels[args.Text] or args.Text
    end })
end

function TestStatusUi:tearDown()
    self.restore()
end

function TestStatusUi.testSummaryNamesAnAbsentAspectAndKeepsakeNone()
    local json = require("mods/protocol/json")
    local protocol = require("mods.protocol.decoder")
    local file = assert(io.open(fixtures.path("fresh-file-fghi.execution.json"), "rb"))
    local plan = assert(protocol.decode(assert(json.decode(file:read("*a")))))
    file:close()
    local summary = require("mods.host.plan_summary").build(plan, function(key)
        assert(key ~= nil, "display names are only looked up for present keys")
        return key
    end)
    lu.assertEquals({ summary.weapon, summary.aspect, summary.keepsake }, { "WeaponStaffSwing", "None", "None" })
end

function TestStatusUi.testStorageIncludesIndependentDefaultDisabledGuidanceSettings()
    local storage = hostData.buildStorage()
    lu.assertEquals(#storage, 3)
    lu.assertEquals(storage[1].alias, "ActivePlanSlot")
    lu.assertEquals(storage[1].default, 1)
    lu.assertEquals(storage[1].min, 1)
    lu.assertEquals(storage[1].max, 6)
    lu.assertFalse(storage[1].persist)
    lu.assertEquals(storage[2], {
        type = "bool", alias = "ShowRoomGuide", label = "Show room guide",
        tooltip = "Show read-only planned room instructions on the HUD.", default = false,
    })
    lu.assertEquals(storage[3], {
        type = "bool", alias = "HighlightPlannedChoices", label = "Highlight planned choices",
        tooltip = "Mark the next planned door or choice when it is available.", default = false,
    })
end

function TestStatusUi.testInspectionUsesTheBoundInboxCapabilityDirectly()
    local loads, statusReads, selections, drawn = 0, 0, {}, {}
    local inbox = {
        activeSlot = function() return 1 end,
        select = function(slot) selections[#selections + 1] = slot end,
        load = function(slot) loads = loads + 1; lu.assertEquals(slot, 1) end,
        plan = function() end,
        status = function()
            statusReads = statusReads + 1
            return { file = "present", inspection = "inspected", build = "0123456789ab", catalog = "c" }
        end,
    }
    local ui = statusUi.bind(inbox, inactive, slotFile(1))
    local field, guideField, highlightField, checkbox = viewField(1),
        { read = function() return false end }, { read = function() return false end }, nil
    local widgets = {
        dropdown = function(target) lu.assertEquals(target, field) end,
        checkbox = function(target, opts)
            if opts.id == "show_room_guide" then checkbox = { target = target, opts = opts } end
        end,
        button = function() return true end,
        text = function(value) drawn[#drawn + 1] = value end,
    }

    ui.drawTab(nil, {
        data = { get = function(alias)
            return alias == "ActivePlanSlot" and field or alias == "ShowRoomGuide" and guideField or highlightField
        end },
        draw = { widgets = widgets, imgui = canvas(drawn) },
    })

    lu.assertEquals(loads, 1)
    lu.assertEquals(statusReads, 2)
    lu.assertEquals(selections, {})
    lu.assertEquals(checkbox.target, guideField)
    lu.assertEquals(checkbox.opts, { id = "show_room_guide", label = "Show room guide" })
    lu.assertStrContains(table.concat(drawn, "\n"), "File: present | Build: 0123456789ab | Catalog: c")
end

function TestStatusUi.testPickerShowsTheActiveSlotFileAndSelectsItWithoutWriting()
    local selected, loaded, dropdown = nil, nil, nil
    local inbox = {
        activeSlot = function() return 1 end,
        select = function(slot) selected = slot end,
        load = function(slot) loaded = slot end,
        plan = function() end,
        status = function() return { file = "not-inspected", build = "unknown" } end,
    }
    local field, file = viewField(1), slotFile(4)
    local ui = statusUi.bind(inbox, inactive, file, function() return 0 end)
    local widgets = {
        dropdown = function(target, opts)
            dropdown = { target = target, opts = opts, shown = target:read() }
            return false
        end,
        checkbox = function() end,
        button = function() return false end,
        text = function() end,
    }

    ui.drawTab(nil, { data = { get = function(alias)
        return alias == "ActivePlanSlot" and field or { read = function() return false end }
    end }, draw = { widgets = widgets, imgui = canvas({}) } })

    lu.assertEquals(dropdown.target, field)
    lu.assertEquals(dropdown.shown, 4)
    lu.assertEquals(dropdown.opts.values, { 1, 2, 3, 4, 5, 6 })
    lu.assertEquals(selected, 4)
    lu.assertEquals(file.writes, {})
    lu.assertNil(loaded)
end

local function pickerHarness(file, clock)
    local selections, picks = {}, {}
    local active = 1
    local inbox = {
        activeSlot = function() return active end,
        select = function(slot) active = slot; selections[#selections + 1] = slot end,
        load = function() end,
        plan = function() end,
        status = function() return { file = "not-inspected", build = "unknown" } end,
    }
    local field, lines = viewField(1), {}
    local ui = statusUi.bind(inbox, inactive, file, clock)
    local ctx = { data = { get = function(alias)
        return alias == "ActivePlanSlot" and field or { read = function() return false end }
    end }, draw = { imgui = canvas(lines), widgets = {
        dropdown = function(target)
            local pick = table.remove(picks, 1)
            if pick == nil then return false end
            target:write(pick)
            return true
        end,
        checkbox = function() end, button = function() return false end, text = function() end,
    } } }
    return {
        field = field, selections = selections,
        draw = function(pick)
            picks[#picks + 1] = pick
            for index = #lines, 1, -1 do lines[index] = nil end
            ui.drawTab(nil, ctx)
            return table.concat(lines, "\n")
        end,
    }
end

function TestStatusUi.testPlayerPickWritesTheFileThenSelectsTheInboxSlot()
    local file = slotFile(2)
    local harness = pickerHarness(file, function() return 0 end)
    harness.draw()
    lu.assertEquals(file.writes, {})
    harness.draw(5)
    lu.assertEquals(file.writes, { 5 })
    lu.assertEquals(harness.field.value, 5)
    lu.assertEquals(harness.selections, { 2, 5 })
    harness.draw()
    lu.assertEquals(file.writes, { 5 })
end

function TestStatusUi.testFailedPickShowsWhatTheFileNowHolds()
    local file = slotFile(3)
    local fail = true
    function file.write(value)
        file.writes[#file.writes + 1] = value
        if fail then file.slot, file.state = 1, "missing"; return false end
        file.slot, file.state = value, "present"
        return true
    end
    local harness = pickerHarness(file, function() return 0 end)
    local text = harness.draw(6)
    lu.assertEquals(file.writes, { 6 })
    lu.assertEquals(harness.field.value, 1)
    lu.assertEquals(harness.selections, {})
    lu.assertStrContains(text, "Could not save the active slot.")
    lu.assertStrContains(harness.draw(), "Could not save the active slot.")
    fail = false
    text = harness.draw(2)
    lu.assertNotStrContains(text, "Could not save the active slot.")
    lu.assertNotStrContains(text, "No saved choice")
    lu.assertEquals(harness.field.value, 2)
end

function TestStatusUi.testUnsavedChoiceHintFollowsTheFileState()
    local now = 0
    local file = slotFile(1)
    file.state = "missing"
    local harness = pickerHarness(file, function() return now end)
    lu.assertStrContains(harness.draw(), "No saved choice; using Slot 1.")
    file.state = "invalid"
    now = now + statusUi.ACTIVE_SLOT_REFRESH_SECONDS
    lu.assertStrContains(harness.draw(), "No saved choice; using Slot 1.")
    file.slot, file.state = 3, "present"
    now = now + statusUi.ACTIVE_SLOT_REFRESH_SECONDS
    lu.assertNotStrContains(harness.draw(), "No saved choice")
    lu.assertEquals(file.writes, {})
end

function TestStatusUi.testOutsideChangesRefreshTheViewWithoutWritingOrPerFrameReads()
    local now = 0
    local file = slotFile(2)
    local harness = pickerHarness(file, function() return now end)
    for _ = 1, 600 do
        harness.draw()
        now = now + 1 / 60
    end
    lu.assertTrue(file.reads <= 11, "reads=" .. file.reads)
    lu.assertTrue(file.reads >= 9, "reads=" .. file.reads)
    file.slot = 4
    harness.field.value = 1
    now = now + statusUi.ACTIVE_SLOT_REFRESH_SECONDS
    harness.draw()
    lu.assertEquals(harness.field.value, 4)
    lu.assertEquals(harness.selections, { 2, 4 })
    lu.assertEquals(file.writes, {})
end

function TestStatusUi.testStorageResetOfTheViewIsNotAPlayerPick()
    local file = slotFile(3)
    local harness = pickerHarness(file, function() return 0 end)
    harness.draw()
    harness.field.value = 1
    harness.draw()
    lu.assertEquals(harness.field.value, 3)
    lu.assertEquals(file.writes, {})
    lu.assertEquals(file.reads, 1)
end

local function inspect(plan, snapshot, tab, detailTab)
    local lines = {}
    local ui = statusUi.bind({
        activeSlot = function() return 6 end,
        select = function() error("unexpected slot selection") end,
        load = function() error("unexpected file read") end,
        plan = function() return plan end,
        status = function() return { file = "present", build = "0123456789ab" } end,
    }, function() return snapshot end, slotFile(6), function() return 0 end)
    local ctx = {
        data = { get = function() return viewField(6) end },
        draw = { imgui = canvas(lines, tab, detailTab), widgets = {
            text = function(text) lines[#lines + 1] = text end,
            dropdown = function() end, checkbox = function() end,
            button = function() return false end,
        } },
    }
    ui.drawTab(nil, ctx)
    return table.concat(lines, "\n"), ui, ctx
end

function TestStatusUi:testPublishedLoadoutUsesReadableNamesAndCachesOnlyPlanPresentation()
    local plan = publishedPlan()
    plan.startingLoadout.fear.configuredRanks.HealingReductionShrineUpgrade = 2
    plan.startingLoadout.fear.effectiveRanks.HealingReductionShrineUpgrade = 1
    local postboss = plan.occurrences[#plan.occurrences]
    postboss.timeline.transactions[#postboss.timeline.transactions + 1] = {
        kind = "keepsakeChange", keepsakeKey = "UntranslatedKeepsake",
    }
    local text, ui, ctx = inspect(plan, inactive())
    lu.assertStrContains(text, "Weapon: Witch's Staff || Aspect: Aspect of Melinoe"
        .. " || Starting keepsake: Crystal Figurine")
    lu.assertStrContains(text, postboss.gameName .. ": UntranslatedKeepsake")
    lu.assertStrContains(text, "The Sorceress - Rank 3 (Epic, manual)")
    lu.assertNotStrContains(text, "Vow of Scars")
    local calls = self.labelCalls
    ui.drawTab(nil, ctx)
    lu.assertEquals(self.labelCalls, calls)
    local lines = {}
    ctx.draw.imgui = canvas(lines, "Plan", "Fear")
    ui.drawTab(nil, ctx)
    text = table.concat(lines, "\n")
    lu.assertStrContains(text, "Vow of Scars: Configured 2 / Effective 1")
    lu.assertNotStrContains(text, "EnemyHealthShrineUpgrade")
    lu.assertNotStrContains(text, "The Sorceress")
    lines = {}
    ctx.draw.imgui = canvas(lines, "Plan", "Technical details")
    ui.drawTab(nil, ctx)
    text = table.concat(lines, "\n")
    lu.assertStrContains(text, "Project: " .. plan.projectId)
    lu.assertStrContains(text, "Fingerprint: " .. plan.planFingerprint)
    lu.assertNotStrContains(text, "The Sorceress")
    lu.assertNotStrContains(text, "Vow of Scars")
    lu.assertEquals(self.labelCalls, calls)
end

function TestStatusUi.testRunningPlanStaysSeparateFromPreviewAndRetainsFailureDetails()
    local frozen, other = publishedPlan(), publishedPlan()
    other.startingLoadout.weaponKey = "OtherWeapon"
    local first, last = frozen.occurrences[2], frozen.occurrences[1]
    local snapshot = {
        state = "synchronized", reason = "ready", slot = 2, plan = frozen, index = 2,
        current = first, lastExited = last, postbossAdmission = { gameName = "F_PostBoss01" },
    }
    local text, ui, ctx = inspect(other, snapshot, "Current Run")
    lu.assertStrContains(text, "Run: Synchronized | Steering: active")
    lu.assertStrContains(text, "Running plan: Slot 2")
    lu.assertStrContains(text, "Tracked room: " .. first.gameName)
    lu.assertStrContains(text, "Postboss resync succeeded at F_PostBoss01")
    lu.assertStrContains(text, "Weapon: Witch's Staff")
    lu.assertNotStrContains(text, "OtherWeapon")
    snapshot.state, snapshot.reason, snapshot.checkpoint = "desynchronized", "first-mismatch", "room-exit"
    snapshot.issue = { expected = { count = 4 }, observed = { count = 3 } }
    local lines = {}
    ctx.draw.imgui = canvas(lines, "Current Run")
    ctx.draw.widgets.text = function(line) lines[#lines + 1] = line end
    ui.drawTab(nil, ctx)
    text = table.concat(lines, "\n")
    lu.assertStrContains(text, "Run: Desynchronized | Steering: off")
    lu.assertStrContains(text, "Checkpoint: room-exit")
    lu.assertStrContains(text, "count: 4")
    lu.assertStrContains(text, "count: 3")
end

function TestStatusUi.testStatusDistinguishesStartupAdmissionCompletionAndFaults()
    for _, case in ipairs({
        { "inactive", "not-started", "Inactive", "off" },
        { "inactive", "admission-rejected", "Inactive", "off" },
        { "inactive", "configured-prefix-complete", "Plan complete", "off" },
        { "starting", "ready", "Starting", "active" },
        { "faulted", "executor-fault", "Executor fault", "off" },
    }) do
        local snapshot = { state = case[1], reason = case[2] }
        local text = inspect(nil, snapshot, "Current Run")
        lu.assertStrContains(text, "Run: " .. case[3] .. " | Steering: " .. case[4])
        lu.assertEquals(snapshot, { state = case[1], reason = case[2] })
    end
end

function TestStatusUi.testBadPreviewReportsDecoderReasonWithoutChangingRunStatus()
    local inbox = {
        activeSlot = function() return 1 end,
        select = function() end,
        load = function() return false end,
        plan = function() end,
        status = function() return {
            file = "present", error = { code = "malformed-plan", message = "Invalid contract" },
        } end,
    }
    local snapshot = { state = "synchronized", reason = "ready" }
    local ui = statusUi.bind(inbox, function() return snapshot end, slotFile(1))
    local lines = {}
    ui.drawTab(nil, {
        data = { get = function() return viewField(1) end },
        draw = { imgui = canvas(lines), widgets = {
            text = function(line) lines[#lines + 1] = line end,
            dropdown = function() end, checkbox = function() end, button = function() return true end,
        } },
    })
    local text = table.concat(lines, "\n")
    lu.assertStrContains(text, "Reason: Invalid contract")
    lu.assertStrContains(text, "Run: Synchronized | Steering: active")
    lu.assertEquals(snapshot.state, "synchronized")
end

return TestStatusUi
