-- The record of a snap correction that could not hold, kept on the session for
-- the rest of the run, and the log lines that explain it. Pure: no native reads.
local failure = {}

local MAX_PATHS = 6
local MAX_TEXT = 200

-- Bounded, with control bytes and backslashes as \ddd escapes so a value cannot
-- start a new log line.
local function clip(text)
    text = tostring(text)
    if #text > MAX_TEXT then text = text:sub(1, MAX_TEXT) .. "..." end
    return (text:gsub("[%c\\]", function(byte) return string.format("\\%03d", byte:byte()) end))
end

-- A bounded one-line rendering of a published or observed value, keys sorted.
local function render(value, depth)
    if type(value) == "number" then return string.format("%.17g", value) end
    if type(value) ~= "table" then return tostring(value) end
    if (depth or 0) >= 3 then return "{...}" end
    local keys = {}
    for key in pairs(value) do keys[#keys + 1] = key end
    table.sort(keys, function(left, right) return tostring(left) < tostring(right) end)
    local parts = {}
    for _, key in ipairs(keys) do
        parts[#parts + 1] = tostring(key) .. "=" .. render(value[key], (depth or 0) + 1)
    end
    return "{" .. table.concat(parts, ",") .. "}"
end

failure.render = function(value) return clip(render(value)) end

-- Each family's differing leaves, at most MAX_PATHS per family.
local function bounded(differences)
    local result = {}
    for index, difference in ipairs(differences or {}) do
        local paths, all = {}, difference.paths or {}
        for position = 1, math.min(#all, MAX_PATHS) do paths[position] = clip(all[position]) end
        if #all > MAX_PATHS then paths[#paths + 1] = "+" .. (#all - MAX_PATHS) .. " more" end
        result[index] = { family = difference.family, paths = paths }
    end
    return result
end

local function familyNames(differences)
    local names = {}
    for _, difference in ipairs(differences or {}) do names[#names + 1] = difference.family end
    return names
end

-- kind: "unwritable" (a family the frame needs cannot be written), "still-differs"
-- (the write ran but the frame check still fails) or "fault" (an error was raised).
-- trigger is the mismatch that started the snap; before and after are
-- snap.differences results; unwritable is { family, reason }; err is error text.
function failure.record(args)
    local before, after = bounded(args.before), bounded(args.after)
    local failed = args.kind == "still-differs" and familyNames(after)
        or args.kind == "unwritable" and args.unwritable and { args.unwritable.family }
        or familyNames(before)
    local trigger = args.trigger
    return {
        room = args.room, occurrenceId = args.occurrenceId, frame = args.frame == true, kind = args.kind,
        failedFamilies = failed, differedFamilies = familyNames(before),
        before = before, after = after, unwritable = args.unwritable,
        error = args.err ~= nil and clip(args.err) or nil,
        trigger = type(trigger) == "table" and {
            checkpoint = trigger.checkpoint or trigger.kind,
            expected = failure.render(trigger.expected), observed = failure.render(trigger.observed),
        } or nil,
    }
end

-- One summary line, then one line per detail: the trigger, each family before
-- the write, each family still different after it, and the error.
function failure.lines(record)
    local lines = {
        "[RunPlanner] snap failed room=" .. tostring(record.room)
            .. " occurrence=" .. tostring(record.occurrenceId)
            .. " frame=" .. (record.frame and "yes" or "none")
            .. " kind=" .. tostring(record.kind)
            .. " failed=" .. (#record.failedFamilies > 0 and table.concat(record.failedFamilies, ",") or "none")
            .. " differed=" .. (#record.differedFamilies > 0 and table.concat(record.differedFamilies, ",") or "none")
            .. " trigger=" .. tostring(record.trigger and record.trigger.checkpoint or "none"),
    }
    local function detail(text) lines[#lines + 1] = "[RunPlanner] snap failed detail " .. text end
    if record.trigger then
        detail("trigger " .. tostring(record.trigger.checkpoint) .. " expected=" .. record.trigger.expected
            .. " observed=" .. record.trigger.observed)
    end
    for _, difference in ipairs(record.before) do
        detail("before " .. difference.family .. ": " .. table.concat(difference.paths, "; "))
    end
    if record.unwritable then
        detail("unwritable " .. tostring(record.unwritable.family) .. ": " .. clip(record.unwritable.reason))
    end
    for _, difference in ipairs(record.after) do
        detail("after " .. difference.family .. ": " .. table.concat(difference.paths, "; "))
    end
    if record.error then detail("error " .. record.error) end
    return lines
end

return failure
