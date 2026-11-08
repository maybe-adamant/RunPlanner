-- Native point draws (`RemoveRandomValue` over a room's placement points)
-- steered to planned points. Native draws leave holes in their pool, so pools
-- are read by key, and every removal leaves the pool collapsed in ascending
-- order, as native's own next draw would.
local placement = {}

local function remaining(values)
    local result = {}
    for _, value in pairs(values) do result[#result + 1] = value end
    table.sort(result, function(left, right)
        if type(left) == type(right) and type(left) == "number" then return left < right end
        return tostring(left) < tostring(right)
    end)
    return result
end

local function replace(values, items)
    for key in pairs(values) do values[key] = nil end
    for index, value in ipairs(items) do values[index] = value end
end

function placement.contains(values, wanted)
    if type(values) ~= "table" or wanted == nil then return false end
    for _, value in pairs(values) do
        if value == wanted then return true end
    end
    return false
end

-- Whether every point of a nonempty pool belongs to the room's point set.
function placement.within(values, set)
    if type(values) ~= "table" or set == nil or next(values) == nil then return false end
    for _, value in pairs(values) do
        if not set[value] then return false end
    end
    return true
end

function placement.set(values)
    local result = {}
    for _, value in pairs(type(values) == "table" and values or {}) do result[value] = true end
    return result
end

-- Removes the planned point from the pool without a native draw; nil when absent.
function placement.take(values, wanted)
    if not placement.contains(values, wanted) then return nil end
    local kept = {}
    for _, value in ipairs(remaining(values)) do
        if value ~= wanted then kept[#kept + 1] = value end
    end
    replace(values, kept)
    return wanted
end

-- A native draw from the pool without the reserved points. With nothing else
-- left the draw stays fully native.
function placement.drawExcluding(base, values, reserved, ...)
    if next(reserved) == nil then return base(values, ...) end
    local pool = {}
    for _, value in ipairs(remaining(values)) do
        if not reserved[value] then pool[#pool + 1] = value end
    end
    if #pool == 0 then return base(values, ...) end
    local picked = base(pool, ...)
    if picked ~= nil then placement.take(values, picked) end
    return picked
end

return placement
