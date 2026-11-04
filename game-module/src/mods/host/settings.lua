-- The player's Run Planner options live in settings.json beside the plan
-- slots; the planner and the module both write it, one option at a time.
local json = type(import) == "function" and import("mods/protocol/json.lua") or require("mods.protocol.json")
local sharedFile = type(import) == "function" and import("mods/host/shared_file.lua") or require("mods.host.shared_file")

local settings = {}
settings.FILE_NAME = "settings.json"
settings.TEMP_FILE_NAME = "settings.json.tmp"
settings.MAX_BYTES = 1024
settings.FORMAT = "run-planner-settings"
settings.FORMAT_VERSION = 1
-- The options in file order; each is a boolean, off when the file is missing or invalid.
settings.OPTIONS = { "showRoomGuide", "highlightPlannedChoices", "snapMode" }
-- Reads of current() reuse the last values for up to this long, in wall-clock
-- seconds; os.time counts whole seconds, so a reread follows within this long.
settings.REFRESH_SECONDS = 1

-- The ModpackLib aliases that held each option before settings.json.
local LEGACY_ALIASES = {
    ShowRoomGuide = "showRoomGuide",
    HighlightPlannedChoices = "highlightPlannedChoices",
    SnapMode = "snapMode",
}

local OPTION = {}
for _, option in ipairs(settings.OPTIONS) do OPTION[option] = true end

function settings.defaults()
    local values = {}
    for _, option in ipairs(settings.OPTIONS) do values[option] = false end
    return values
end

function settings.decode(raw)
    if type(raw) ~= "string" then return nil, "content must be a string" end
    if #raw > settings.MAX_BYTES then return nil, "file exceeds the 1,024-byte limit" end
    local value, decodeError = json.decode(raw)
    if value == nil then return nil, "malformed-json: " .. tostring(decodeError) end
    if not json.isObject(value) then return nil, "top level must be an object" end
    for key in pairs(value) do
        if key ~= "format" and key ~= "formatVersion" and not OPTION[key] then
            return nil, "unexpected key " .. tostring(key)
        end
    end
    if value.format ~= settings.FORMAT then return nil, "format must be " .. settings.FORMAT end
    -- Lua numbers cannot tell 1 from 1.0 or 1e0, so the raw token is checked too.
    if value.formatVersion ~= settings.FORMAT_VERSION
        or raw:match('"formatVersion"%s*:%s*([^%s,}]*)') ~= "1" then
        return nil, "formatVersion must be 1"
    end
    local values = {}
    for _, option in ipairs(settings.OPTIONS) do
        if type(value[option]) ~= "boolean" then return nil, option .. " must be true or false" end
        values[option] = value[option]
    end
    return values
end

function settings.encode(values)
    local parts = { '{"format":"' .. settings.FORMAT .. '","formatVersion":' .. settings.FORMAT_VERSION }
    for _, option in ipairs(settings.OPTIONS) do
        if type(values[option]) ~= "boolean" then error(option .. " must be true or false", 2) end
        parts[#parts + 1] = '"' .. option .. '":' .. tostring(values[option])
    end
    return table.concat(parts, ",") .. "}"
end

-- files replaces io.open/os.remove/os.rename; log receives one line per event;
-- clock measures the refresh interval in wall-clock seconds (CPU time can stall).
function settings.create(root, pathApi, options)
    options = options or {}
    local files = options.files or sharedFile.nativeFiles()
    local log = options.log or sharedFile.defaultLog
    local clock = options.clock or os.time
    local lastInvalid, values, readAt = nil, nil, nil
    local store = {}

    local function paths()
        if type(root) ~= "string" or root == "" then error("settings root must be non-empty", 3) end
        if type(pathApi) ~= "table" or type(pathApi.combine) ~= "function" then
            error("settings require rom.path.combine", 3)
        end
        return pathApi.combine(root, settings.FILE_NAME), pathApi.combine(root, settings.TEMP_FILE_NAME)
    end

    local function remember(next)
        values, readAt = next, clock()
        return next
    end

    local function invalid(key, reason)
        if lastInvalid ~= key then
            lastInvalid = key
            log("[RunPlanner] settings invalid reason=" .. sharedFile.logText(reason) .. " using defaults")
        end
        return remember(settings.defaults()), "invalid", reason
    end

    -- Returns the options, then "present", "missing" or "invalid" and a reason.
    -- Missing and invalid files mean every option off; the file is left as found.
    function store.read()
        local raw, state, openReason = sharedFile.read(files, paths(), settings.MAX_BYTES)
        if state == "missing" then
            lastInvalid = nil
            return remember(settings.defaults()), "missing"
        end
        if raw == nil then return invalid("open:" .. tostring(openReason), openReason) end
        local decoded, reason = settings.decode(raw)
        if decoded == nil then return invalid(raw, reason) end
        lastInvalid = nil
        return remember(decoded), "present"
    end

    -- The options as last read, read again once they are a refresh interval old.
    function store.current()
        local now = clock()
        if values == nil or now < readAt or now - readAt >= settings.REFRESH_SECONDS then store.read() end
        return values
    end

    function store.enabled(option)
        if not OPTION[option] then error("unknown Run Planner option " .. tostring(option), 2) end
        return store.current()[option] == true
    end

    -- Changes one option over the file as it is now, so a change made in the
    -- planner to another option is kept.
    function store.write(option, enabled)
        if not OPTION[option] then error("unknown Run Planner option " .. tostring(option), 2) end
        if type(enabled) ~= "boolean" then error(option .. " must be true or false", 2) end
        local next = {}
        for key, value in pairs(store.read()) do next[key] = value end
        next[option] = enabled
        local path, tempPath = paths()
        local written, reason = sharedFile.replace(files, path, tempPath, settings.encode(next))
        if not written then
            log("[RunPlanner] settings write-failed " .. option .. "=" .. tostring(enabled)
                .. " reason=" .. sharedFile.logText(reason))
            return false, reason
        end
        remember(next)
        log("[RunPlanner] settings set " .. option .. "=" .. tostring(enabled))
        return true
    end

    -- Before settings.json, ModpackLib kept these options in the module's .cfg
    -- under [config]. With no settings.json yet, the ticks found there seed it
    -- once; the written file marks the move done. Returns true when it wrote.
    function store.seedFromLegacy(legacyPath)
        if type(legacyPath) ~= "string" or legacyPath == "" then return false end
        local path, tempPath = paths()
        local _, state = sharedFile.read(files, path, settings.MAX_BYTES)
        if state ~= "missing" then return false end
        local file = files.open(legacyPath, "rb")
        if not file then return false end
        local raw = file:read(64 * 1024) or ""
        file:close()
        local seeded, found, section = settings.defaults(), false, "config"
        for line in raw:gmatch("[^\r\n]+") do
            local named = line:match("^%s*%[([^%]]+)%]%s*$")
            if named then
                section = named
            elseif section == "config" then
                local key, value = line:match("^%s*([%w_]+)%s*=%s*(%a+)%s*$")
                local option = LEGACY_ALIASES[key]
                if option and (value == "true" or value == "false") then
                    seeded[option], found = value == "true", true
                end
            end
        end
        if not found then return false end
        local written, reason = sharedFile.replace(files, path, tempPath, settings.encode(seeded))
        if not written then
            log("[RunPlanner] settings seed-failed reason=" .. sharedFile.logText(reason))
            return false
        end
        remember(seeded)
        log("[RunPlanner] settings seeded from ModpackLib config")
        return true
    end

    return store
end

return settings
