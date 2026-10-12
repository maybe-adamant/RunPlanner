-- The Run Planner window: a status header, the next run's slot, the current
-- run's progress and, in Debug Mode, the raw session and slot records.
local presentation = type(import) == "function" and import("mods/presentation/run_presentation.lua")
    or require("mods.presentation.run_presentation")
local mismatchText = type(import) == "function" and import("mods/presentation/mismatch_text.lua")
    or require("mods.presentation.mismatch_text")
local names = type(import) == "function" and import("mods/presentation/names.lua")
    or require("mods.presentation.names")
local ascii = type(import) == "function" and import("mods/presentation/ascii.lua")
    or require("mods.presentation.ascii")

local ui = {}
ui.ACTIVE_SLOT_REFRESH_SECONDS = 1

local SLOT_VALUES = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 }
-- The event slot is listed first while it holds a file or is the active slot.
local EVENT_SLOT = presentation.EVENT_SLOT
local WITH_EVENT_VALUES = { EVENT_SLOT, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 }
local LABEL_COLUMN = 110
local TONES = {
    inactive = { color = { 0.7, 0.7, 0.7, 1 } },
    starting = { color = { 1, 0.8, 0.3, 1 } },
    synchronized = { color = { 0.4, 0.9, 0.5, 1 } },
    complete = { color = { 0.4, 0.9, 0.5, 1 } },
    desynchronized = { color = { 1, 0.4, 0.4, 1 } },
    faulted = { color = { 1, 0.6, 0.3, 1 } },
}
local STALE = "Made for another Run Planner version - resend from the app or update the mod"

local function safeText(value)
    local ok, text = pcall(function()
        return type(value) == "number" and string.format("%.17g", value) or tostring(value)
    end)
    return ok and text or "<unprintable>"
end

-- Raw record tree. Children draw under pcall so every Push has its Pop.
local function drawValues(imgui, label, value, ancestors)
    if type(value) ~= "table" then
        imgui.TextWrapped(label .. ": " .. safeText(value))
        return
    end
    ancestors = ancestors or {}
    if ancestors[value] then imgui.TextWrapped(label .. ": <cycle>"); return end
    if not imgui.CollapsingHeader(label) then return end
    ancestors[value] = true
    imgui.PushID(label)
    imgui.Indent()
    pcall(function()
        local keys = {}
        for key in pairs(value) do keys[#keys + 1] = key end
        table.sort(keys, function(a, b) return safeText(a) < safeText(b) end)
        if #keys == 0 then imgui.TextWrapped("(empty)") end
        for _, key in ipairs(keys) do drawValues(imgui, safeText(key), value[key], ancestors) end
    end)
    imgui.Unindent()
    imgui.PopID()
    ancestors[value] = nil
end

-- Display products of immutable records, cached by record identity.
local function memo(build)
    local cache = setmetatable({}, { __mode = "k" })
    return function(key)
        if type(key) ~= "table" then return build(key) end
        local value = cache[key]
        if value == nil then
            value = build(key) or false
            cache[key] = value
        end
        return value or nil
    end
end

local function row(drawApi, label, value, style)
    local imgui = drawApi.imgui
    imgui.TextDisabled(label)
    imgui.SameLine(LABEL_COLUMN)
    if style then drawApi.widgets.text(value, style) else imgui.TextWrapped(value) end
end

-- Every text the window hands ImGui passes through the ASCII fold.
local function asciiDraw(drawApi)
    local imgui, widgets = drawApi.imgui, drawApi.widgets
    local function folded(opts)
        if opts == nil or opts.label == nil then return opts end
        local copy = {}
        for key, value in pairs(opts) do copy[key] = value end
        copy.label = ascii.fold(opts.label)
        return copy
    end
    return {
        imgui = setmetatable({
            TextWrapped = function(text) return imgui.TextWrapped(ascii.fold(text)) end,
            TextDisabled = function(text) return imgui.TextDisabled(ascii.fold(text)) end,
            CollapsingHeader = function(label) return imgui.CollapsingHeader(ascii.fold(label)) end,
            BeginTabItem = function(label) return imgui.BeginTabItem(ascii.fold(label)) end,
        }, { __index = imgui }),
        widgets = setmetatable({
            text = function(text, style) return widgets.text(ascii.fold(text), style) end,
            button = function(label, opts) return widgets.button(ascii.fold(label), opts) end,
            checkbox = function(target, opts) return widgets.checkbox(target, folded(opts)) end,
            dropdown = function(target, opts) return widgets.dropdown(target, folded(opts)) end,
        }, { __index = widgets }),
    }
end

function ui.bind(inbox, inspectSession, activeSlotFile, slotOverview, clock)
    assert(type(inbox) == "table" and type(inbox.activeSlot) == "function"
        and type(inbox.load) == "function" and type(inbox.status) == "function"
        and type(inbox.plan) == "function", "status UI inbox dependency is required")
    assert(type(inspectSession) == "function", "status UI session inspection is required")
    assert(type(activeSlotFile) == "table" and type(activeSlotFile.read) == "function"
        and type(activeSlotFile.write) == "function", "status UI active slot file is required")
    assert(type(slotOverview) == "table" and type(slotOverview.read) == "function",
        "status UI slot overview is required")
    clock = clock or os.clock

    -- The picker and slot descriptions are a view of active-slot.json and the
    -- slot overview, reread at most once per interval while drawn.
    local viewSlot, refreshedAt, failedSlot, loadedKey = nil, nil, nil, nil
    local entries, present, labels, values = {}, {}, {}, SLOT_VALUES
    local function slotLabel(slot)
        local entry = entries[slot]
        if slot == EVENT_SLOT then
            if not present[slot] then return "Event (none)" end
            if entry and entry.event then return "Event: " .. entry.event.title .. " (" .. entry.label .. ")" end
            return "Event"
        end
        if entry then return presentation.slotName(slot) .. " (" .. entry.label .. ")" end
        if present[slot] then return presentation.slotName(slot) end
        return presentation.slotName(slot) .. " (empty)"
    end
    local function refreshView(force)
        local now = clock()
        if not force and refreshedAt ~= nil and now >= refreshedAt
            and now - refreshedAt < ui.ACTIVE_SLOT_REFRESH_SECONDS then
            return
        end
        local state
        viewSlot, state = activeSlotFile.read()
        if state == "present" and viewSlot == failedSlot then failedSlot = nil end
        entries, present = slotOverview.read()
        values = (present[EVENT_SLOT] or viewSlot == EVENT_SLOT) and WITH_EVENT_VALUES or SLOT_VALUES
        labels = {}
        for _, slot in ipairs(values) do labels[slot] = ascii.fold(slotLabel(slot)) end
        refreshedAt = now
    end

    -- What the planner last said about a slot: a send, resend or removal changes it.
    local function slotKey(slot)
        local entry = entries[slot]
        return tostring(slot) .. ":" .. (entry and entry.fingerprint .. ":" .. entry.buildId or "-")
            .. ":" .. (present[slot] and "present" or "absent")
    end

    local function loadSlot(slot)
        loadedKey = slotKey(slot)
        inbox.load(slot)
        local status = inbox.status()
        if status.error and rom and rom.log and rom.log.info then
            rom.log.info("[RunPlanner] published-plan inspection failed code="
                .. tostring(status.error.code) .. " reason=" .. tostring(status.error.message))
        end
    end

    -- One read per slot shown, and again whenever the overview shows its file changed.
    local function ensureLoaded(slot)
        if inbox.activeSlot() ~= slot or inbox.status().file == "not-inspected" or loadedKey ~= slotKey(slot) then
            loadSlot(slot)
        end
    end

    local planDetails = memo(presentation.planDetails)
    local entryDetails = memo(presentation.entryDetails)
    -- Each part falls back on its own, so one odd field never hides the rest.
    local mismatchView = memo(function(issue)
        local function try(fn, ...)
            local ok, value = pcall(fn, ...)
            return ok and value or nil
        end
        return {
            when = try(mismatchText.checkpoint, issue) or "a plan check",
            difference = try(mismatchText.difference, issue),
            planned = try(mismatchText.lines, issue.expected, "  ") or { "  (unreadable)" },
            found = try(mismatchText.lines, issue.observed, "  ") or { "  (unreadable)" },
        }
    end)

    local function slotStatus(status, plan, entry)
        if status.error then
            if status.error.code == "stale-slot" then return STALE, TONES.faulted end
            return "This slot can't be read", TONES.faulted
        end
        if plan == nil and entry ~= nil and not entry.matchesBuild then return STALE, TONES.faulted end
        return "Ready", TONES.synchronized
    end

    local function drawDetails(drawApi)
        local status, plan, entry = inbox.status(), inbox.plan(), entries[viewSlot]
        if status.file == "not-published" or (entry == nil and plan == nil and not present[viewSlot]) then
            drawApi.imgui.TextWrapped(viewSlot == EVENT_SLOT and "No event right now."
                or "Nothing sent to this slot yet.")
            return
        end
        local described = plan == nil and entry or presentation.entryFor(plan, entry)
        local rows = described and entryDetails(described) or plan and planDetails(plan) or {}
        for _, detail in ipairs(rows) do row(drawApi, detail[1], detail[2]) end
        row(drawApi, "Status", slotStatus(status, plan, entry))
    end

    local function drawPlanTab(ctx, drawApi)
        local imgui = drawApi.imgui
        local field = ctx.data.get("ActivePlanSlot")
        assert(field ~= nil, "status UI ActivePlanSlot data field is required")
        local showGuide = ctx.data.get("ShowRoomGuide")
        assert(showGuide ~= nil, "status UI ShowRoomGuide data field is required")
        local highlightChoices = ctx.data.get("HighlightPlannedChoices")
        assert(highlightChoices ~= nil, "status UI HighlightPlannedChoices data field is required")
        if field:read() ~= viewSlot then field:write(viewSlot) end
        local picked = drawApi.widgets.dropdown(field, {
            id = "active_plan_slot",
            label = "Plan for next run",
            values = values,
            displayValues = labels,
        })
        if picked then
            local requested = field:read()
            failedSlot = not activeSlotFile.write(requested) and requested or nil
            refreshView(true)
            field:write(viewSlot)
            loadSlot(viewSlot)
        end
        imgui.SameLine()
        if drawApi.widgets.button("Reload", { id = "run_planner_reload" }) then
            refreshView(true)
            loadSlot(viewSlot)
        end
        if failedSlot ~= nil then imgui.TextWrapped("Could not save the active slot.") end
        ensureLoaded(viewSlot)
        drawDetails(drawApi)
        drawApi.widgets.separator()
        drawApi.widgets.checkbox(showGuide, { id = "show_room_guide", label = "Show room guide" })
        drawApi.widgets.checkbox(highlightChoices, {
            id = "highlight_planned_choices",
            label = "Highlight planned choices",
        })
    end

    -- Every string the tab shows, computed before any ImGui call.
    local function runView(snapshot, planName)
        local plan = snapshot.plan
        if plan == nil then
            return { lines = { "No plan is running. The next run will use " .. slotLabel(viewSlot) .. "." } }
        end
        local practice = presentation.practicePlace(plan)
        local event = presentation.runningEvent(plan, entries, present)
        local lines = { (event and "Event: " .. event.title or presentation.title(planName, snapshot.slot))
            .. (practice and " - Practice from " .. practice or "") }
        local progress = presentation.progress(snapshot)
        if presentation.isComplete(snapshot) then
            lines[2] = planName .. " - all " .. progress.total .. " planned rooms done. The game continues on its own."
            return { lines = lines }
        end
        local count = "room " .. progress.room .. " of " .. progress.total
        if snapshot.state == "desynchronized" or snapshot.state == "faulted" then
            local issue = type(snapshot.issue) == "table" and snapshot.issue or nil
            local mismatch = snapshot.state == "desynchronized" and issue and mismatchView(issue) or nil
            local when = snapshot.state == "faulted" and "planner error" or mismatch and mismatch.when or "a plan check"
            lines[2] = "Stopped at " .. (presentation.stopPlace(snapshot) or "the current room")
                .. " (" .. when .. ") - " .. count
            if snapshot.state == "desynchronized" then
                lines[3] = "What differed: "
                    .. (mismatch and mismatch.difference and mismatch.difference .. "." or "See More details.")
            end
            return { lines = lines, mismatch = mismatch and mismatch.planned and mismatch or nil }
        end
        local occurrence = progress.occurrence
        local room = occurrence and names.room(occurrence.gameName) or nil
        if progress.between then
            if room then lines[2] = "Next: " .. room .. " (" .. count .. ")" end
        else
            lines[2] = "Room " .. progress.room .. " of " .. progress.total .. (room and " - " .. room or "")
        end
        return { lines = lines }
    end

    local function drawRunTab(imgui, snapshot, planName)
        local ok, view = pcall(runView, snapshot, planName)
        if not ok then view = { lines = { "Run details are unavailable." } } end
        for _, line in ipairs(view.lines) do imgui.TextWrapped(line) end
        local mismatch = view.mismatch
        if mismatch and imgui.CollapsingHeader("More details") then
            imgui.PushID("mismatch_details")
            imgui.TextWrapped("Planned:")
            for _, line in ipairs(mismatch.planned) do imgui.TextWrapped(line) end
            imgui.TextWrapped("Found:")
            for _, line in ipairs(mismatch.found) do imgui.TextWrapped(line) end
            imgui.PopID()
        end
    end

    local function drawDiagnosticsTab(imgui, snapshot)
        local status = inbox.status()
        imgui.TextWrapped("Session: " .. tostring(snapshot.state) .. " / " .. tostring(snapshot.reason))
        if snapshot.checkpoint then imgui.TextWrapped("Checkpoint: " .. tostring(snapshot.checkpoint)) end
        imgui.TextWrapped("Slot " .. tostring(status.slot) .. " file: " .. tostring(status.file)
            .. " - Module build: " .. tostring(status.build) .. " - Catalog: " .. tostring(status.catalog))
        if status.fingerprint then imgui.TextWrapped("Slot fingerprint: " .. tostring(status.fingerprint)) end
        if status.error then
            imgui.TextWrapped("Slot error: " .. tostring(status.error.code))
            if status.error.message then imgui.TextWrapped("Reason: " .. tostring(status.error.message)) end
        end
        local plan = snapshot.plan
        if plan then
            imgui.TextWrapped("Running project: " .. tostring(plan.projectId))
            imgui.TextWrapped("Running fingerprint: " .. tostring(plan.planFingerprint)
                .. " - Catalog: " .. tostring(plan.catalogVersion))
        end
        local issue = snapshot.issue
        if type(issue) == "table" then
            imgui.TextWrapped("Record checkpoint: " .. safeText(issue.checkpoint or issue.kind))
            drawValues(imgui, "Expected", issue.expected)
            drawValues(imgui, "Observed", issue.observed)
        end
    end

    -- A failing tab body is logged once and its Begin still gets its End.
    local reported = {}
    local function guarded(name, body, ...)
        local ok, errorValue = pcall(body, ...)
        if not ok and not reported[name] then
            reported[name] = true
            if rom and rom.log and rom.log.info then
                rom.log.info("[RunPlanner] status window " .. name .. " failed: " .. safeText(errorValue))
            end
        end
    end

    local function draw(_, ctx)
        local drawApi = asciiDraw(ctx.draw)
        local imgui = drawApi.imgui
        assert(ctx.data and type(ctx.data.get) == "function", "status UI data dependency is required")
        refreshView(false)
        local snapshot = inspectSession()
        local ok, planName, header = pcall(function()
            local name = presentation.planName(snapshot.plan, entries[snapshot.slot], snapshot.slot)
            return name, presentation.header(snapshot, name)
        end)
        if not ok then planName, header = presentation.slotName(snapshot.slot), { text = "Run Planner" } end
        drawApi.widgets.text(header.text, TONES[header.tone])
        if header.reason then imgui.TextWrapped(header.reason) end
        if not imgui.BeginTabBar("run_planner_inspector") then return end
        if imgui.BeginTabItem("Plan") then
            guarded("plan tab", drawPlanTab, ctx, drawApi)
            imgui.EndTabItem()
        end
        if imgui.BeginTabItem("Current Run") then
            guarded("current run tab", drawRunTab, imgui, snapshot, planName)
            imgui.EndTabItem()
        end
        local debugMode = ctx.data.get("DebugMode")
        if debugMode ~= nil and debugMode:read() == true and imgui.BeginTabItem("Diagnostics") then
            guarded("diagnostics tab", drawDiagnosticsTab, imgui, snapshot)
            imgui.EndTabItem()
        end
        imgui.EndTabBar()
    end
    return { drawTab = draw }
end

return ui
