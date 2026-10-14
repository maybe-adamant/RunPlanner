-- The planner's advisory slot overview, slots.runplanner.json beside the plan
-- slots, describes occupied slots for display. Entries are never trusted for
-- execution: only the one slot the inbox loads is checked against the build.
local json = type(import) == "function" and import("mods/protocol/json.lua") or require("mods.protocol.json")
local inbox = type(import) == "function" and import("mods/host/inbox.lua") or require("mods.host.inbox")

local overview = {}
overview.FILE_NAME = "slots.runplanner.json"
overview.FORMAT = "run-planner-slot-overview"
overview.FORMAT_VERSION = 1
overview.MAX_BYTES = 65536

local REQUIRED_TEXT = { "label", "sentAt", "aspect", "route", "endBiome", "buildId", "fingerprint" }
local OPTIONAL_TEXT = { "planName", "startingKeepsake", "practiceStart" }

local function text(value)
    return type(value) == "string" and value:match("%S") ~= nil and value or nil
end

-- The event slot's entry names its event; a malformed event leaves the entry without one.
local function event(value)
    if not json.isObject(value) then return nil end
    local result = { id = text(value.id), title = text(value.title), endsAt = text(value.endsAt) }
    if result.id == nil or result.title == nil or result.endsAt == nil then return nil end
    return result
end

local function entry(value, slot)
    if not json.isObject(value) then return nil end
    local result = {}
    for _, key in ipairs(REQUIRED_TEXT) do
        result[key] = text(value[key])
        if result[key] == nil then return nil end
    end
    for _, key in ipairs(OPTIONAL_TEXT) do result[key] = text(value[key]) end
    local fear = value.startingFear
    if type(fear) ~= "number" or fear < 0 or fear ~= math.floor(fear) then return nil end
    result.startingFear = fear
    if slot == inbox.EVENT_SLOT then result.event = event(value.event) end
    return result
end

-- Entries by slot number. A malformed file holds no entries; a malformed
-- entry is skipped alone, since every entry is advisory.
function overview.decode(raw)
    if type(raw) ~= "string" or #raw > overview.MAX_BYTES then return {} end
    local value = json.decode(raw)
    if not json.isObject(value) or value.format ~= overview.FORMAT
        or value.formatVersion ~= overview.FORMAT_VERSION or not json.isObject(value.slots) then
        return {}
    end
    local entries = {}
    for key, slotValue in pairs(value.slots) do
        local slot = type(key) == "string" and (key == "0" or key:match("^[1-9]%d?$")) and tonumber(key) or nil
        if slot ~= nil and slot <= inbox.SLOT_COUNT then entries[slot] = entry(slotValue, slot) end
    end
    return entries
end

local function nativeFiles()
    return { open = io.open }
end

-- files replaces io.open. read() returns the entries, each marked whether it
-- names this module build, and for each slot, the event slot included,
-- whether its plan file exists;
-- existence is an open and close, never a read.
function overview.create(root, pathApi, buildId, options)
    options = options or {}
    local files = options.files or nativeFiles()
    local store = {}

    local function path(fileName)
        if type(root) ~= "string" or root == "" then error("slot overview root must be non-empty", 3) end
        if type(pathApi) ~= "table" or type(pathApi.combine) ~= "function" then
            error("slot overview requires rom.path.combine", 3)
        end
        return pathApi.combine(root, fileName)
    end

    -- Unchanged overview bytes return the same entry tables, so display memos hold.
    local lastRaw, lastEntries = nil, nil
    function store.read()
        local raw
        local file = files.open(path(overview.FILE_NAME), "rb")
        if file then
            raw = file:read(overview.MAX_BYTES + 1)
            file:close()
        end
        local entries = lastEntries
        if raw == nil or raw ~= lastRaw then
            entries = raw ~= nil and overview.decode(raw) or {}
            for _, value in pairs(entries) do value.matchesBuild = buildId ~= nil and value.buildId == buildId end
            lastRaw, lastEntries = raw, entries
        end
        local present = {}
        for slot = inbox.EVENT_SLOT, inbox.SLOT_COUNT do
            -- The event slot is always probed: only its file confirms that its entry's event is current.
            if entries[slot] ~= nil and slot ~= inbox.EVENT_SLOT then
                present[slot] = true
            else
                local slotFile = files.open(path(inbox.slotFileName(slot)), "rb")
                present[slot] = slotFile ~= nil
                if slotFile then slotFile:close() end
            end
        end
        return entries, present
    end

    return store
end

return overview
