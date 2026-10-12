-- Display text for plans, slots and the session state, shared by the status
-- window and the victory summary. Reads decoded plans, overview entries and
-- session snapshots; never native loadout state.
local names = type(import) == "function" and import("mods/presentation/names.lua")
    or require("mods.presentation.names")
local mismatchText = type(import) == "function" and import("mods/presentation/mismatch_text.lua")
    or require("mods.presentation.mismatch_text")
local inbox = type(import) == "function" and import("mods/host/inbox.lua") or require("mods.host.inbox")

local presentation = {}
presentation.EVENT_SLOT = inbox.EVENT_SLOT

local ROUTES = { Underworld = "Underworld", Surface = "Surface", FreshFile = "Fresh File", Dream = "Dream Dive" }
local START_POINTS = { Opening = "Opening", PreBoss = "Preboss", Boss = "Boss" }
local MONTHS = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" }

function presentation.slotName(slot)
    if slot == inbox.EVENT_SLOT then return "Event" end
    return "Slot " .. tostring(slot)
end

-- "Plan name (Slot N)", or just "Slot N" for an unnamed plan.
function presentation.title(planName, slot)
    local slotName = presentation.slotName(slot)
    return planName == slotName and slotName or planName .. " (" .. slotName .. ")"
end

-- The overview entry describes this plan only while its fingerprint matches.
function presentation.entryFor(plan, entry)
    if type(plan) == "table" and type(entry) == "table" and entry.fingerprint == plan.planFingerprint then
        return entry
    end
    return nil
end

-- The community event a plan belongs to: the event slot entry's event while
-- the event slot's file exists and the entry describes this plan's fingerprint.
-- Display only.
function presentation.runningEvent(plan, entries, present)
    if type(present) ~= "table" or not present[inbox.EVENT_SLOT] then return nil end
    local entry = type(entries) == "table" and entries[inbox.EVENT_SLOT] or nil
    local described = presentation.entryFor(plan, entry)
    return described and described.event or nil
end

function presentation.planName(plan, entry, slot)
    if type(plan) == "table" and type(plan.displayName) == "string" and plan.displayName ~= "" then
        return plan.displayName
    end
    local described = plan == nil and entry or presentation.entryFor(plan, entry)
    if described and described.planName then return described.planName end
    return presentation.slotName(slot)
end

-- Index of the first realized occurrence: a Practice start's room, otherwise 1.
local function startIndex(plan)
    local start = plan.startState and plan.startState.occurrenceId
    if start ~= nil then
        for index, id in ipairs(plan.selectedOccurrenceIds) do
            if id == start then return index end
        end
    end
    return 1
end

function presentation.practicePlace(plan)
    local start = plan.startState and plan.startState.occurrenceId
    local occurrence = start and plan.occurrencesById[start]
    if occurrence == nil then return nil end
    local biome, kind = tostring(occurrence.gameName):match("^(%u)_(%a+)")
    local biomeName = names.biomeName(biome)
    if biomeName and START_POINTS[kind] then return biomeName .. " - " .. START_POINTS[kind] end
    return names.room(occurrence.gameName)
end

-- Progress counted from the first realized room: rooms before a Practice start
-- were never played. occurrence is the current room, or the next when between rooms.
function presentation.progress(snapshot)
    local plan = snapshot.plan
    local first = startIndex(plan)
    local total = #plan.selectedOccurrenceIds - first + 1
    local index = snapshot.index or first
    local between = snapshot.current == nil
    local occurrence = snapshot.current
    if between then
        local id = plan.selectedOccurrenceIds[index]
        occurrence = id and plan.occurrencesById[id] or nil
    end
    return {
        room = math.max(1, math.min(index - first + 1, total)), total = total,
        occurrence = occurrence, between = between,
    }
end

-- Where the session stopped: the room actually entered when entry differed
-- from the plan, otherwise the current room or the room it was about to enter.
function presentation.stopPlace(snapshot)
    if type(snapshot.plan) ~= "table" then return nil end
    local issue = snapshot.issue
    if type(issue) == "table" and issue.checkpoint == "room-entry" and type(issue.observed) == "table"
        and type(issue.observed.gameName) == "string" then
        return names.room(issue.observed.gameName)
    end
    local occurrence = presentation.progress(snapshot).occurrence
    return occurrence and names.room(occurrence.gameName) or nil
end

function presentation.isComplete(snapshot)
    return snapshot.reason == "configured-prefix-complete"
end

-- The window header: a status line, an optional reason line and a tone.
function presentation.header(snapshot, planName)
    local title = presentation.title(planName, snapshot.slot)
    local practice = type(snapshot.plan) == "table" and snapshot.plan.startState ~= nil and " - Practice" or ""
    if presentation.isComplete(snapshot) then
        return { text = "Plan complete - " .. planName, tone = "complete" }
    end
    if snapshot.state == "starting" then
        return { text = "Starting - " .. title .. practice, tone = "starting" }
    end
    if snapshot.state == "synchronized" then
        return { text = "Synchronized - " .. title .. practice, tone = "synchronized" }
    end
    if snapshot.state == "desynchronized" then
        local place = presentation.stopPlace(snapshot)
        return {
            text = "Desynchronized", tone = "desynchronized",
            reason = (place and "Out of sync at " .. place .. ". " or "Out of sync. ")
                .. "The game continues on its own.",
        }
    end
    if snapshot.state == "faulted" then
        return { text = "Stopped (planner error)", tone = "faulted", reason = "The game continues on its own." }
    end
    if snapshot.reason == "admission-rejected" then
        return { text = "Plan not used", tone = "faulted", reason = mismatchText.admission(snapshot.issue) }
    end
    if snapshot.reason == "resumed-unsteered" then
        return { text = "Not steering", tone = "inactive", reason = "Resumed after a reload; this run isn't steered." }
    end
    return { text = "No run", tone = "inactive" }
end

function presentation.route(routeKey, endBiome)
    return (ROUTES[routeKey] or routeKey) .. " -> " .. endBiome
end

-- Seconds since the epoch for a UTC calendar time (proleptic Gregorian).
local function utcEpoch(year, month, day, hour, minute, second)
    local floor = math.floor
    local y = month <= 2 and year - 1 or year
    local era = floor(y / 400)
    local yearOfEra = y - era * 400
    local dayOfYear = floor((153 * (month + (month > 2 and -3 or 9)) + 2) / 5) + day - 1
    local dayOfEra = yearOfEra * 365 + floor(yearOfEra / 4) - floor(yearOfEra / 100) + dayOfYear
    local days = era * 146097 + dayOfEra - 719468
    return ((days * 24 + hour) * 60 + minute) * 60 + second
end

-- "2026-10-12T10:00:00.000Z" in local time, such as "12 Oct 2026, 12:00".
function presentation.localTime(iso)
    local year, month, day, hour, minute, second =
        tostring(iso):match("^(%d%d%d%d)%-(%d%d)%-(%d%d)T(%d%d):(%d%d):(%d%d)")
    if year == nil or MONTHS[tonumber(month)] == nil then return nil end
    local ok, localTime = pcall(os.date, "*t", utcEpoch(tonumber(year), tonumber(month), tonumber(day),
        tonumber(hour), tonumber(minute), tonumber(second)))
    if not ok or type(localTime) ~= "table" then return nil end
    return string.format("%d %s %d, %02d:%02d", localTime.day, MONTHS[localTime.month], localTime.year,
        localTime.hour, localTime.min)
end

-- Label and value rows describing a slot from its overview entry.
function presentation.entryDetails(entry)
    local rows = {}
    local function add(label, value) if value ~= nil then rows[#rows + 1] = { label, value } end end
    if entry.event then
        add("Event", entry.event.title)
        add("Ends", presentation.localTime(entry.event.endsAt))
    end
    add("Plan", entry.planName)
    add("Sent", presentation.localTime(entry.sentAt))
    add("Aspect", entry.aspect)
    add("Route", entry.route .. " -> " .. entry.endBiome)
    add("Keepsake", entry.startingKeepsake)
    add("Fear", tostring(entry.startingFear))
    add("Practice", entry.practiceStart)
    return rows
end

-- The same rows from a decoded plan, for a slot the overview does not describe.
-- The Fear total is the planner's to compute, so it is omitted here.
function presentation.planDetails(plan)
    local rows = {}
    local function add(label, value) if value ~= nil then rows[#rows + 1] = { label, value } end end
    local loadout = plan.startingLoadout
    local weapon = names.display(loadout.weaponKey, loadout.weaponKey)
    add("Plan", plan.displayName)
    add("Aspect", loadout.aspectKey and (names.display(loadout.aspectKey, loadout.aspectKey) .. " (" .. weapon .. ")")
        or weapon)
    add("Route", presentation.route(plan.routeKey,
        names.biomeName(plan.extent.terminalBiomeKey) or plan.extent.terminalBiomeKey))
    local keepsake = plan.startingKeepsake.keepsakeKey
    add("Keepsake", keepsake and names.display(keepsake, keepsake))
    add("Practice", presentation.practicePlace(plan))
    return rows
end

return presentation
