-- Small files beside the plan slots that the planner and the module both write.
local inbox = type(import) == "function" and import("mods/host/inbox.lua") or require("mods.host.inbox")

local sharedFile = {}

function sharedFile.nativeFiles()
    return { open = io.open, remove = os.remove, rename = os.rename }
end

-- Control bytes become \ddd escapes so a reason cannot start a new log line.
function sharedFile.logText(value)
    local escaped = tostring(value):gsub("[%c\\\"]", function(byte)
        return string.format("\\%03d", byte:byte())
    end)
    return '"' .. escaped .. '"'
end

function sharedFile.defaultLog(message)
    if rom and rom.log and rom.log.info then rom.log.info(message) end
end

-- Returns at most maxBytes + 1 bytes and "present", nil and "missing", or nil,
-- "invalid" and a reason.
function sharedFile.read(files, path, maxBytes)
    local file, openError, openErrno = files.open(path, "rb")
    if not file then
        if inbox.isMissingFileError(openError, openErrno) then return nil, "missing" end
        return nil, "invalid", "could not open: " .. tostring(openError)
    end
    local content = file:read(maxBytes + 1)
    file:close()
    return content or "", "present"
end

-- os.rename cannot replace on Windows, so the old file is removed first; a
-- reader may briefly find no file, never a partial one. Returns true, or false
-- and a reason with the temporary file removed.
function sharedFile.replace(files, path, tempPath, content)
    local function fail(reason)
        files.remove(tempPath)
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
    return true
end

return sharedFile
