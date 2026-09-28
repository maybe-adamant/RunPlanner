-- The active plan slot lives in active-slot.json beside the plan slots; the
-- planner and the module both write it, and each read goes to the file.
local json = type(import) == "function" and import("mods/protocol/json.lua") or require("mods.protocol.json")
local inbox = type(import) == "function" and import("mods/host/inbox.lua") or require("mods.host.inbox")

local activeSlot = {}
activeSlot.FILE_NAME = "active-slot.json"
activeSlot.TEMP_FILE_NAME = "active-slot.json.tmp"
activeSlot.MAX_BYTES = 1024
activeSlot.FORMAT = "run-planner-active-slot"
activeSlot.FORMAT_VERSION = 1
activeSlot.DEFAULT_SLOT = 1

local KEYS = { format = true, formatVersion = true, slot = true }

local function validSlot(slot)
    return type(slot) == "number" and slot == math.floor(slot) and slot >= 1 and slot <= inbox.SLOT_COUNT
end

local function numberToken(raw, key)
    return raw:match('"' .. key .. '"%s*:%s*([^%s,}]*)')
end

function activeSlot.decode(raw)
    if type(raw) ~= "string" then return nil, "content must be a string" end
    if #raw > activeSlot.MAX_BYTES then return nil, "file exceeds the 1,024-byte limit" end
    local value, decodeError = json.decode(raw)
    if value == nil then return nil, "malformed-json: " .. tostring(decodeError) end
    if not json.isObject(value) then return nil, "top level must be an object" end
    for key in pairs(value) do
        if not KEYS[key] then return nil, "unexpected key " .. tostring(key) end
    end
    if value.format ~= activeSlot.FORMAT then return nil, "format must be " .. activeSlot.FORMAT end
    -- Lua numbers cannot tell 3 from 3.0 or 3e0, so the raw number tokens are checked too.
    if value.formatVersion ~= activeSlot.FORMAT_VERSION or numberToken(raw, "formatVersion") ~= "1" then
        return nil, "formatVersion must be 1"
    end
    local slotToken = numberToken(raw, "slot")
    if not validSlot(value.slot) or slotToken == nil or not slotToken:match("^[1-6]$") then
        return nil, "slot must be an integer from 1 through 6"
    end
    return value.slot
end

function activeSlot.encode(slot)
    if not validSlot(slot) then error("active slot must be an integer from 1 through 6", 2) end
    return '{"format":"' .. activeSlot.FORMAT .. '","formatVersion":' .. activeSlot.FORMAT_VERSION
        .. ',"slot":' .. string.format("%d", slot) .. "}"
end

local function nativeFiles()
    return { open = io.open, remove = os.remove, rename = os.rename }
end

-- Control bytes become \ddd escapes so a reason cannot start a new log line.
local function logText(value)
    local escaped = tostring(value):gsub("[%c\\\"]", function(byte)
        return string.format("\\%03d", byte:byte())
    end)
    return '"' .. escaped .. '"'
end

local function defaultLog(message)
    if rom and rom.log and rom.log.info then rom.log.info(message) end
end

-- files replaces io.open/os.remove/os.rename; log receives one line per event.
function activeSlot.create(root, pathApi, options)
    options = options or {}
    local files = options.files or nativeFiles()
    local log = options.log or defaultLog
    local lastInvalid = nil
    local store = {}

    local function paths()
        if type(root) ~= "string" or root == "" then error("active slot root must be non-empty", 3) end
        if type(pathApi) ~= "table" or type(pathApi.combine) ~= "function" then
            error("active slot requires rom.path.combine", 3)
        end
        return pathApi.combine(root, activeSlot.FILE_NAME), pathApi.combine(root, activeSlot.TEMP_FILE_NAME)
    end

    local function readRaw(path)
        local file, openError, openErrno = files.open(path, "rb")
        if not file then
            if inbox.isMissingFileError(openError, openErrno) then return nil, "missing" end
            return nil, "invalid", "could not open: " .. tostring(openError)
        end
        local content = file:read(activeSlot.MAX_BYTES + 1)
        file:close()
        return content or "", "present"
    end

    local function invalid(key, reason)
        if lastInvalid ~= key then
            lastInvalid = key
            log("[RunPlanner] active-slot invalid reason=" .. logText(reason)
                .. " using slot=" .. activeSlot.DEFAULT_SLOT)
        end
        return activeSlot.DEFAULT_SLOT, "invalid", reason
    end

    -- Returns the slot, then "present", "missing" or "invalid" and a reason.
    -- Missing and invalid files mean slot 1; the file is left as found.
    function store.read()
        local path = paths()
        local raw, state, openReason = readRaw(path)
        if state == "missing" then
            lastInvalid = nil
            return activeSlot.DEFAULT_SLOT, "missing"
        end
        if raw == nil then return invalid("open:" .. tostring(openReason), openReason) end
        local slot, reason = activeSlot.decode(raw)
        if slot == nil then return invalid(raw, reason) end
        lastInvalid = nil
        return slot, "present"
    end

    -- os.rename cannot replace on Windows, so the old file is removed first; a
    -- reader may briefly find no file, never a partial one.
    function store.write(slot)
        local path, tempPath = paths()
        local content = activeSlot.encode(slot)
        local function fail(reason)
            files.remove(tempPath)
            log("[RunPlanner] active-slot write-failed slot=" .. slot .. " reason=" .. logText(reason))
            return false, reason
        end
        local file, openError = files.open(tempPath, "wb")
        if not file then return fail("could not open temp file: " .. tostring(openError)) end
        local written, writeError = file:write(content)
        local closed, closeError = file:close()
        if not written then return fail("could not write temp file: " .. tostring(writeError)) end
        if not closed then return fail("could not close temp file: " .. tostring(closeError)) end
        local removed, removeError, removeErrno = files.remove(path)
        if not removed and not inbox.isMissingFileError(removeError, removeErrno) then
            return fail("could not remove previous file: " .. tostring(removeError))
        end
        local renamed, renameError = files.rename(tempPath, path)
        if not renamed then renamed, renameError = files.rename(tempPath, path) end
        if not renamed then return fail("could not rename temp file: " .. tostring(renameError)) end
        log("[RunPlanner] active-slot set slot=" .. slot)
        return true
    end

    return store
end

return activeSlot
