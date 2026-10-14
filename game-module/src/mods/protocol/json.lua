-- Small bounded JSON decoder used only at the fixed execution-plan boundary.
-- It returns tagged tables so protocol validation can distinguish arrays and
-- objects without accepting Lua tables produced by arbitrary callers.

local json = {}
local null = setmetatable({}, { __json_null = true })

local function fail(message)
    return nil, message
end

-- The first non-whitespace index at or after index, or past the end.
local function whitespace(source, index)
    local found = source:find("[^ \t\r\n]", index)
    if found ~= nil then return found end
    return index > #source and index or #source + 1
end

local REPLACEMENTS = {
    ['"'] = '"', ['\\'] = "\\", ['/'] = '/', b = "\b", f = "\f",
    n = "\n", r = "\r", t = "\t",
}
-- A quote, a backslash or a control character ends a plain run of string bytes.
local SPECIAL = '[%z\1-\31"\\]'

local function decodeString(source, index)
    local output, count = nil, 0
    local nextIndex = index + 1
    while true do
        local stop = source:find(SPECIAL, nextIndex)
        if stop == nil then return fail("unterminated string") end
        local character = source:sub(stop, stop)
        if character ~= '"' and character ~= "\\" then return fail("unescaped control character") end
        local run = source:sub(nextIndex, stop - 1)
        if character == '"' then
            if output == nil then return run, stop + 1 end
            output[count + 1] = run
            return table.concat(output), stop + 1
        end
        output = output or {}
        count = count + 1
        output[count] = run
        local escaped = source:sub(stop + 1, stop + 1)
        if escaped == "u" then
            local digits = source:sub(stop + 2, stop + 5)
            if not digits:match("^%x%x%x%x$") then return fail("invalid unicode escape") end
            local code = tonumber(digits, 16)
            if code > 127 then return fail("non-ascii unicode escapes are unsupported") end
            count = count + 1
            output[count] = string.char(code)
            nextIndex = stop + 6
        elseif REPLACEMENTS[escaped] ~= nil then
            count = count + 1
            output[count] = REPLACEMENTS[escaped]
            nextIndex = stop + 2
        else
            return fail("invalid string escape")
        end
    end
end

local function decodeValue(source, index)
    index = whitespace(source, index)
    local character = source:sub(index, index)
    if character == '"' then return decodeString(source, index) end
    if character == "{" then
        local value = setmetatable({}, { __json_object = true })
        local nextIndex = whitespace(source, index + 1)
        if source:sub(nextIndex, nextIndex) == "}" then return value, nextIndex + 1 end
        while true do
            if source:sub(nextIndex, nextIndex) ~= '"' then return fail("object key must be a string") end
            local key, afterKey = decodeString(source, nextIndex)
            if key == nil then return nil, afterKey end
            nextIndex = whitespace(source, afterKey)
            if source:sub(nextIndex, nextIndex) ~= ":" then return fail("object key missing colon") end
            local item, afterItem = decodeValue(source, nextIndex + 1)
            if item == nil then return nil, afterItem end
            if value[key] ~= nil then return fail("duplicate object key") end
            value[key] = item
            nextIndex = whitespace(source, afterItem)
            local separator = source:sub(nextIndex, nextIndex)
            if separator == "}" then return value, nextIndex + 1 end
            if separator ~= "," then return fail("object missing separator") end
            nextIndex = whitespace(source, nextIndex + 1)
        end
    end
    if character == "[" then
        local value = setmetatable({}, { __json_array = true })
        local nextIndex = whitespace(source, index + 1)
        if source:sub(nextIndex, nextIndex) == "]" then return value, nextIndex + 1 end
        while true do
            local item, afterItem = decodeValue(source, nextIndex)
            if item == nil then return nil, afterItem end
            value[#value + 1] = item
            nextIndex = whitespace(source, afterItem)
            local separator = source:sub(nextIndex, nextIndex)
            if separator == "]" then return value, nextIndex + 1 end
            if separator ~= "," then return fail("array missing separator") end
            nextIndex = whitespace(source, nextIndex + 1)
        end
    end
    local token = source:match("^[%-%+%d%.eE]+", index)
    if token ~= nil then
        local cursor = 1
        local function isDigit(digitCharacter)
            return digitCharacter ~= "" and digitCharacter:match("^%d$") ~= nil
        end
        if token:sub(cursor, cursor) == "-" then cursor = cursor + 1 end
        local first = token:sub(cursor, cursor)
        if first == "0" then
            cursor = cursor + 1
            if isDigit(token:sub(cursor, cursor)) then return fail("invalid number") end
        elseif first:match("^[1-9]$") ~= nil then
            cursor = cursor + 1
            while isDigit(token:sub(cursor, cursor)) do cursor = cursor + 1 end
        else
            return fail("invalid number")
        end
        if token:sub(cursor, cursor) == "." then
            cursor = cursor + 1
            if not isDigit(token:sub(cursor, cursor)) then return fail("invalid number") end
            while isDigit(token:sub(cursor, cursor)) do cursor = cursor + 1 end
        end
        local exponent = token:sub(cursor, cursor)
        if exponent == "e" or exponent == "E" then
            cursor = cursor + 1
            local sign = token:sub(cursor, cursor)
            if sign == "+" or sign == "-" then cursor = cursor + 1 end
            if not isDigit(token:sub(cursor, cursor)) then return fail("invalid number") end
            while isDigit(token:sub(cursor, cursor)) do cursor = cursor + 1 end
        end
        if cursor <= #token then return fail("invalid number") end
        local number = tonumber(token)
        if number == nil or number ~= number or number == math.huge or number == -math.huge then
            return fail("invalid number")
        end
        return number, index + #token
    end
    if source:sub(index, index + 3) == "true" then return true, index + 4 end
    if source:sub(index, index + 4) == "false" then return false, index + 5 end
    if source:sub(index, index + 3) == "null" then return null, index + 4 end
    return fail("unexpected JSON value")
end

function json.decode(source)
    if type(source) ~= "string" then return fail("JSON input must be a string") end
    local value, nextIndex = decodeValue(source, 1)
    if value == nil then return nil, nextIndex end
    nextIndex = whitespace(source, nextIndex)
    if nextIndex <= #source then return fail("trailing JSON data") end
    return value
end

json.null = null
json.isObject = function(value)
    local meta = type(value) == "table" and getmetatable(value) or nil
    return meta ~= nil and meta.__json_object == true
end
json.isArray = function(value)
    local meta = type(value) == "table" and getmetatable(value) or nil
    return meta ~= nil and meta.__json_array == true
end
json.isNull = function(value)
    local meta = type(value) == "table" and getmetatable(value) or nil
    return meta ~= nil and meta.__json_null == true
end

return json
