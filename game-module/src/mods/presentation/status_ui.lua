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
-- A draw after a longer pause is the window opening again.
ui.REOPEN_GAP_SECONDS = 0.5

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
local NO_OVERVIEW = "No overview - Load to inspect"
local DEBUG_HINT = "Turn on Debug Mode (Advanced tab) to see diagnostics."
local LOAD_BUTTON = { id = "run_planner_reload" }
local GUIDE_CHECKBOX = { id = "show_room_guide", label = "Show room guide" }
local HIGHLIGHT_CHECKBOX = { id = "highlight_planned_choices", label = "Highlight planned choices" }
local SNAP_CHECKBOX = { id = "snap_mode", label = "Snap back to the plan" }

local function safeText(value)
    local ok, text = pcall(function()
        return type(value) == "number" and string.format("%.17g", value) or tostring(value)
    end)
    return ok and text or "<unprintable>"
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

local sortedKeys = memo(function(value)
    local keys = {}
    for key in pairs(value) do keys[#keys + 1] = key end
    table.sort(keys, function(a, b) return safeText(a) < safeText(b) end)
    return keys
end)

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
        local keys = sortedKeys(value)
        if #keys == 0 then imgui.TextWrapped("(empty)") end
        for _, key in ipairs(keys) do drawValues(imgui, safeText(key), value[key], ancestors) end
    end)
    imgui.Unindent()
    imgui.PopID()
    ancestors[value] = nil
end

local function row(drawApi, label, value, style)
    local imgui = drawApi.imgui
    imgui.TextDisabled(label)
    imgui.SameLine(LABEL_COLUMN)
    if style then drawApi.widgets.text(value, style) else imgui.TextWrapped(value) end
end

-- Every text the window hands ImGui passes through the ASCII fold. Built once;
-- each frame rebinds it to that frame's draw surface.
local function asciiDraw()
    local current
    local foldedOpts = setmetatable({}, { __mode = "k" })
    local function folded(opts)
        if opts == nil or opts.label == nil then return opts end
        local copy = foldedOpts[opts]
        if copy == nil then
            copy = {}
            for key, value in pairs(opts) do copy[key] = value end
            copy.label = ascii.fold(opts.label)
            foldedOpts[opts] = copy
        end
        return copy
    end
    local drawApi = {
        imgui = setmetatable({
            TextWrapped = function(text) return current.imgui.TextWrapped(ascii.fold(text)) end,
            TextDisabled = function(text) return current.imgui.TextDisabled(ascii.fold(text)) end,
            CollapsingHeader = function(label) return current.imgui.CollapsingHeader(ascii.fold(label)) end,
            BeginTabItem = function(label) return current.imgui.BeginTabItem(ascii.fold(label)) end,
        }, { __index = function(_, key) return current.imgui[key] end }),
        widgets = setmetatable({
            text = function(text, style) return current.widgets.text(ascii.fold(text), style) end,
            button = function(label, opts) return current.widgets.button(ascii.fold(label), opts) end,
            checkbox = function(target, opts) return current.widgets.checkbox(target, folded(opts)) end,
            dropdown = function(target, opts) return current.widgets.dropdown(target, folded(opts)) end,
        }, { __index = function(_, key) return current.widgets[key] end }),
    }
    return function(draw)
        current = draw
        return drawApi
    end
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
    -- slot overview, read when the window opens, on Load and after a pick.
    -- Plans are decoded only by Load; drawing never reads a plan file.
    local viewSlot, failedSlot, lastDrawAt = nil, nil, nil
    local entries, present, values, keys, pickerOpts = {}, {}, SLOT_VALUES, {}, nil
    -- Counts view reads and loads, so cached views know when to rebuild.
    local generation = 0
    -- The window's own Load result: { slot, key, plan, status }.
    local inspection = nil
    local function slotLabel(slot)
        local entry = entries[slot]
        if slot == EVENT_SLOT then
            if not present[slot] then return "Event (none)" end
            if entry and entry.event then
                return "Event: " .. entry.event.title .. " (" .. (entry.matchesVersion and entry.label or "outdated") .. ")"
            end
            return "Event"
        end
        -- An entry made for another catalog or schema pair is marked; no plan is decoded to say so.
        if entry then
            return presentation.slotName(slot) .. " (" .. entry.label .. ")" .. (entry.matchesVersion and "" or " (outdated)")
        end
        if present[slot] then return presentation.slotName(slot) end
        return presentation.slotName(slot) .. " (empty)"
    end
    local function relabel()
        values = (present[EVENT_SLOT] or viewSlot == EVENT_SLOT) and WITH_EVENT_VALUES or SLOT_VALUES
        local labels = {}
        for _, slot in ipairs(values) do labels[slot] = ascii.fold(slotLabel(slot)) end
        pickerOpts = { id = "active_plan_slot", label = "Plan for next run", values = values, displayValues = labels }
        generation = generation + 1
    end

    local function readActiveSlot()
        local state
        viewSlot, state = activeSlotFile.read()
        if state == "present" and viewSlot == failedSlot then failedSlot = nil end
    end

    local function refreshView()
        readActiveSlot()
        entries, present = slotOverview.read()
        keys = {}
        relabel()
    end

    -- What the planner last said about a slot: a send, resend or removal changes it.
    local function slotKey(slot)
        local key = keys[slot]
        if key == nil then
            local entry = entries[slot]
            key = tostring(slot) .. ":" .. (entry and entry.fingerprint or "-")
                .. ":" .. (present[slot] and "present" or "absent")
            keys[slot] = key
        end
        return key
    end

    local function loadSlot(slot)
        inbox.load(slot)
        local status = inbox.status()
        inspection = { slot = slot, key = slotKey(slot), plan = inbox.plan(), status = status }
        generation = generation + 1
        if status.error and rom and rom.log and rom.log.info then
            rom.log.info("[RunPlanner] published-plan inspection failed code="
                .. tostring(status.error.code) .. " reason=" .. tostring(status.error.message))
        end
    end

    -- The Load result while it still describes the shown slot as the overview last read it.
    local function currentInspection()
        local value = inspection
        if value ~= nil and value.slot == viewSlot and value.key == slotKey(viewSlot)
            and inbox.activeSlot() == viewSlot and inbox.plan() == value.plan then
            return value
        end
        return nil
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
        if status and status.error then
            if status.error.code == "stale-slot" then return STALE, TONES.faulted end
            return "This slot can't be read", TONES.faulted
        end
        if plan == nil and entry ~= nil and not entry.matchesVersion then return STALE, TONES.faulted end
        return "Ready", TONES.synchronized
    end

    local function drawDetails(drawApi)
        local loaded, entry = currentInspection(), entries[viewSlot]
        local status, plan = loaded and loaded.status, loaded and loaded.plan
        if (status and status.file == "not-published") or (entry == nil and plan == nil and not present[viewSlot]) then
            drawApi.imgui.TextWrapped(viewSlot == EVENT_SLOT and "No event right now."
                or "Nothing sent to this slot yet.")
            return
        end
        if entry == nil and loaded == nil then
            drawApi.imgui.TextWrapped(NO_OVERVIEW)
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
        local snapMode = ctx.data.get("SnapMode")
        assert(snapMode ~= nil, "status UI SnapMode data field is required")
        if field:read() ~= viewSlot then field:write(viewSlot) end
        if drawApi.widgets.dropdown(field, pickerOpts) then
            local requested = field:read()
            failedSlot = not activeSlotFile.write(requested) and requested or nil
            readActiveSlot()
            relabel()
            field:write(viewSlot)
        end
        imgui.SameLine()
        if drawApi.widgets.button("Load", LOAD_BUTTON) then
            refreshView()
            loadSlot(viewSlot)
        end
        if failedSlot ~= nil then imgui.TextWrapped("Could not save the active slot.") end
        drawDetails(drawApi)
        drawApi.widgets.separator()
        drawApi.widgets.checkbox(showGuide, GUIDE_CHECKBOX)
        drawApi.widgets.checkbox(highlightChoices, HIGHLIGHT_CHECKBOX)
        drawApi.widgets.checkbox(snapMode, SNAP_CHECKBOX)
    end

    -- Every string the tab shows, computed before any ImGui call.
    local function runView(snapshot, planName)
        local plan = snapshot.plan
        if plan == nil or snapshot.reason == "disabled" then
            return { lines = { "No plan is running. The next run will use " .. slotLabel(viewSlot) .. "." } }
        end
        local practice = presentation.practicePlace(plan)
        local event = presentation.runningEvent(plan, entries, present)
        local lines = { (event and "Event: " .. event.title or presentation.title(planName, snapshot.slot))
            .. (practice and " - Practice from " .. practice or "") }
        local progress = presentation.progress(snapshot)
        local snapped = presentation.snapped(snapshot)
        if presentation.isComplete(snapshot) then
            lines[2] = planName .. " - all " .. progress.total .. " planned rooms done. The game continues on its own."
            lines[#lines + 1] = snapped
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
            if snapshot.reason == "snap-loop" then
                lines[#lines + 1] = "Snapping stopped: the snap did not hold."
            end
            lines[#lines + 1] = snapped
            return { lines = lines, mismatch = mismatch and mismatch.planned and mismatch or nil }
        end
        local occurrence = progress.occurrence
        local room = occurrence and names.room(occurrence.gameName) or nil
        if progress.between then
            if room then lines[2] = "Next: " .. room .. " (" .. count .. ")" end
        else
            lines[2] = "Room " .. progress.room .. " of " .. progress.total .. (room and " - " .. room or "")
        end
        lines[#lines + 1] = snapped
        return { lines = lines }
    end

    -- Header and run text follow the session fields they read and the slot view.
    local VIEW_FIELDS = { "plan", "state", "reason", "slot", "index", "current", "issue", "snaps" }
    local cached = { generation = -1 }
    local function sessionView(snapshot)
        local changed = cached.generation ~= generation or cached.viewSlot ~= viewSlot
        for _, key in ipairs(VIEW_FIELDS) do
            if cached[key] ~= snapshot[key] then changed = true end
        end
        if not changed then return cached end
        cached = { generation = generation, viewSlot = viewSlot }
        for _, key in ipairs(VIEW_FIELDS) do cached[key] = snapshot[key] end
        local ok, planName, header = pcall(function()
            local name = presentation.planName(snapshot.plan, entries[snapshot.slot], snapshot.slot)
            return name, presentation.header(snapshot, name)
        end)
        if not ok then planName, header = presentation.slotName(snapshot.slot), { text = "Run Planner" } end
        cached.planName, cached.header = planName, header
        return cached
    end

    local function drawRunTab(imgui, snapshot, view)
        if view.run == nil then
            local ok, run = pcall(runView, snapshot, view.planName)
            view.run = ok and run or { lines = { "Run details are unavailable." } }
        end
        view = view.run
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

    -- The inbox status as of the last view read, Load or inbox change.
    local diagnostic = {}
    local function inboxStatus()
        local slot, plan = inbox.activeSlot(), inbox.plan()
        if diagnostic.generation ~= generation or diagnostic.slot ~= slot or diagnostic.plan ~= plan then
            diagnostic = { generation = generation, slot = slot, plan = plan, status = inbox.status() }
        end
        return diagnostic.status
    end

    local function drawDiagnosticsTab(imgui, snapshot)
        local status = inboxStatus()
        imgui.TextWrapped("Session: " .. tostring(snapshot.state) .. " / " .. tostring(snapshot.reason))
        if snapshot.checkpoint then imgui.TextWrapped("Checkpoint: " .. tostring(snapshot.checkpoint)) end
        imgui.TextWrapped("Slot " .. tostring(status.slot) .. " file: " .. tostring(status.file)
            .. " - Schema: " .. tostring(status.schema) .. " - Catalog: " .. tostring(status.catalog))
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

    -- A failing tab body is logged once.
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

    -- The header starts each frame: it reads the session once and, after a
    -- pause, the slot view. The tab drawn after it reuses that frame.
    local bindDraw = asciiDraw()
    local frame = { snapshot = nil, view = nil }
    local function beginFrame(ctx)
        assert(ctx.data and type(ctx.data.get) == "function", "status UI data dependency is required")
        local now = clock()
        if lastDrawAt == nil or now < lastDrawAt or now - lastDrawAt > ui.REOPEN_GAP_SECONDS then refreshView() end
        lastDrawAt = now
        frame.snapshot = inspectSession()
        frame.view = sessionView(frame.snapshot)
        return frame
    end

    local function drawHeader(_, ctx)
        local current = beginFrame(ctx)
        local drawApi = bindDraw(ctx.draw)
        local header = current.view.header
        drawApi.widgets.text(header.text, TONES[header.tone])
        if header.reason then drawApi.imgui.TextWrapped(header.reason) end
    end

    local function tab(name, body)
        return function(_, ctx)
            local current = frame.snapshot ~= nil and frame or beginFrame(ctx)
            guarded(name, body, ctx, bindDraw(ctx.draw), current)
        end
    end

    local function debugMode(ctx)
        local field = ctx.data.get("DebugMode")
        return field ~= nil and field:read() == true
    end

    return {
        header = drawHeader,
        tabs = {
            { id = "plan", label = "Plan", draw = tab("plan tab", function(ctx, drawApi)
                drawPlanTab(ctx, drawApi)
            end) },
            { id = "current_run", label = "Current Run",
                draw = tab("current run tab", function(_, drawApi, current)
                    drawRunTab(drawApi.imgui, current.snapshot, current.view)
                end),
                state = function()
                    local snapshot = frame.snapshot
                    local stopped = snapshot ~= nil
                        and (snapshot.state == "desynchronized" or snapshot.state == "faulted")
                    return stopped and "attention" or nil
                end },
            { id = "diagnostics", label = "Diagnostics",
                draw = tab("diagnostics tab", function(ctx, drawApi, current)
                    if not debugMode(ctx) then
                        drawApi.imgui.TextWrapped(DEBUG_HINT)
                        return
                    end
                    drawDiagnosticsTab(drawApi.imgui, current.snapshot)
                end),
                state = function(_, ctx) return not debugMode(ctx) and "muted" or nil end },
        },
    }
end

-- Declares the window on the module: the session header and the three tabs.
function ui.attach(module, ...)
    local window = ui.bind(...)
    module.ui.header(window.header)
    module.ui.tabs(window.tabs)
end

return ui
