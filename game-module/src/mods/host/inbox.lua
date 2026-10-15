-- The module inbox owns transport for the fixed published plan slots: the
-- planner's event slot 0 and the twelve sendable slots. It
-- reads one bounded file only when the session explicitly asks for a new-run
-- plan or an inspection, and admits only a plan made for this module's catalog
-- and schema pair.
local json = type(import) == "function" and import("mods/protocol/json.lua") or require("mods.protocol.json")
local protocol = type(import) == "function" and import("mods/protocol/decoder.lua")
    or require("mods.protocol.decoder")

local inbox = {}
inbox.MAX_BYTES = 1048576
-- The envelope earlier planners wrote around a plan.
local LEGACY_SLOT_FORMAT = "run-planner-slot"
inbox.SLOT_COUNT = 12
-- The read-only slot the planner fills with the community event plan.
inbox.EVENT_SLOT = 0
inbox.SLOT_FILES = {
    [0] = "slot-0.runplanner.json",
    "slot-1.runplanner.json",
    "slot-2.runplanner.json",
    "slot-3.runplanner.json",
    "slot-4.runplanner.json",
    "slot-5.runplanner.json",
    "slot-6.runplanner.json",
    "slot-7.runplanner.json",
    "slot-8.runplanner.json",
    "slot-9.runplanner.json",
    "slot-10.runplanner.json",
    "slot-11.runplanner.json",
    "slot-12.runplanner.json",
}

local function normalizeSlot(slot)
    if type(slot) ~= "number" or slot ~= math.floor(slot)
        or slot < inbox.EVENT_SLOT or slot > inbox.SLOT_COUNT then
        return nil
    end
    return slot
end

function inbox.slotFileName(slot)
    local normalized = normalizeSlot(slot)
    return normalized and inbox.SLOT_FILES[normalized] or nil
end

local function slotPath(root, pathApi, slot)
    if type(root) ~= "string" or root == "" then error("inbox root must be non-empty", 3) end
    if type(pathApi) ~= "table" or type(pathApi.combine) ~= "function" then
        error("inbox requires rom.path.combine", 3)
    end
    local fileName = inbox.slotFileName(slot)
    if fileName == nil then return nil, "invalid-slot", "plan slot must be an integer from 0 through 12" end
    return pathApi.combine(root, fileName)
end

-- errno 2 is ENOENT; the message is matched only when no errno is given.
function inbox.isMissingFileError(message, errno)
    if errno ~= nil then return errno == 2 end
    local text = string.lower(tostring(message or ""))
    return text:find("no such file", 1, true) ~= nil
        or text:find("cannot find", 1, true) ~= nil
        or text:find("not found", 1, true) ~= nil
end

function inbox.readBinary(root, pathApi, slot)
    local path, slotError, slotMessage = slotPath(root, pathApi, slot)
    if path == nil then return nil, slotError, slotMessage end
    local file, openError, openErrno = io.open(path, "rb")
    if not file then
        if inbox.isMissingFileError(openError, openErrno) then
            return nil, "not-published", "published plan slot " .. tostring(slot) .. " is not present"
        end
        return nil, "file-open-failed", tostring(openError or "could not open published plan slot")
    end
    local content = file:read(inbox.MAX_BYTES + 1)
    file:close()
    if content == nil then return nil, "file-read-failed", "could not read published plan slot" end
    if #content > inbox.MAX_BYTES then
        return nil, "plan-too-large", "plan exceeds the 1,048,576-byte limit"
    end
    return content
end

-- The plan a slot holds when it names this module's catalog and schema pair, or a status
-- code and reason.
function inbox.admit(raw)
    local value, decodeError = json.decode(raw)
    if value == nil then return nil, "malformed-plan", "malformed-json: " .. tostring(decodeError) end
    if not json.isObject(value) then return nil, "malformed-plan", "slot must hold an execution plan" end
    if value.format == LEGACY_SLOT_FORMAT then
        return nil, "stale-slot", "plan was sent by an earlier Run Planner; send it again"
    end
    if value.format ~= protocol.FORMAT then
        return nil, "malformed-plan", "slot must hold a run-planner-execution plan"
    end
    if not protocol.matchesVersion(value) then
        return nil, "stale-slot", "plan was made for another Run Planner version; send it again or update the mod"
    end
    return value
end

function inbox.create(root, decode, pathApi)
    if type(decode) ~= "function" then error("inbox decoder must be a function", 2) end
    local state = {
        plan = nil,
        selectedSlot = 1,
        status = {
            slot = 1,
            file = "not-inspected",
            inspection = "not-inspected",
            load = "idle",
            schema = protocol.versionLabel(),
            catalog = "unknown",
            fingerprint = nil,
            error = nil,
        },
    }
    local api = {}
    local function resetStatus()
        state.status.slot = state.selectedSlot
        state.status.file = "not-inspected"
        state.status.inspection = "not-inspected"
        state.status.load = "idle"
        state.status.catalog = "unknown"
        state.status.fingerprint = nil
        state.status.error = nil
    end

    function api.activeSlot() return state.selectedSlot end
    function api.select(slot)
        local normalized = normalizeSlot(slot)
        if normalized == nil then
            return false, "invalid-slot"
        end
        if normalized ~= state.selectedSlot then
            state.selectedSlot = normalized
            state.plan = nil
            resetStatus()
        end
        return true, normalized
    end
    function api.plan() return state.plan end
    function api.status()
        local copy = {}
        for key, value in pairs(state.status) do copy[key] = value end
        return copy
    end
    function api.load(slot)
        if slot ~= nil then
            local selected, selectError = api.select(slot)
            if not selected then
                state.plan = nil
                state.status.slot = slot
                state.status.file = "error"
                state.status.inspection, state.status.load = "failed", "error"
                state.status.error = { code = selectError, message = "plan slot must be an integer from 0 through 12" }
                return false, selectError
            end
        end
        state.plan = nil
        state.status.slot, state.status.file = state.selectedSlot, "reading"
        state.status.inspection, state.status.load = "reading", "loading"
        state.status.catalog, state.status.fingerprint, state.status.error = "unknown", nil, nil
        local raw, code, message = inbox.readBinary(root, pathApi, state.selectedSlot)
        if raw == nil then
            state.status.file = code == "not-published" and "not-published" or "error"
            state.status.inspection, state.status.load = "failed", "error"
            state.status.error = { code = code, message = message }
            return false, code
        end
        local function rejected(rejectCode, rejectMessage)
            state.status.inspection, state.status.load = "failed", "error"
            state.status.file = "present"
            state.status.error = { code = rejectCode, message = rejectMessage }
            return false, rejectCode
        end
        local wire, admitCode, admitMessage = inbox.admit(raw)
        if wire == nil then return rejected(admitCode, admitMessage) end
        local decoded, decodeError = decode(wire)
        if decoded == nil then return rejected("malformed-plan", decodeError) end
        state.plan = decoded
        state.status.file, state.status.inspection, state.status.load = "present", "inspected", "ready"
        state.status.catalog = decoded.catalogVersion
        state.status.fingerprint = decoded.planFingerprint
        return true, decoded
    end
    return api
end

return inbox
