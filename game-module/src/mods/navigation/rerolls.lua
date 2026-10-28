-- Planned door, cage, ship-wheel and Hub board rerolls. A target publishes its
-- first native draw; its last planned reroll, across Hub stays for a board
-- door, is what it offers onward.
local rerolls = {}

local function pressesOf(occurrence, matches)
    local result = {}
    for _, reroll in ipairs(occurrence and occurrence.rerolls or {}) do
        if matches(reroll.target) then result[#result + 1] = reroll end
    end
    return result
end

function rerolls.doorRerolled(occurrence, exitKey)
    for _, reroll in ipairs(occurrence and occurrence.rerolls or {}) do
        if reroll.target.kind ~= "wheelOffer" and reroll.target.exitKey == exitKey then return true end
    end
    return false
end

-- The reward a published batch door offers after its rerolls.
function rerolls.doorReward(occurrence, target)
    local reward = target.reward
    for _, reroll in ipairs(occurrence and occurrence.rerolls or {}) do
        if reroll.target.kind == "door" and reroll.target.exitKey == target.exitKey then reward = reroll.reward end
    end
    return reward
end

-- A Fields door's cage rewards after its rerolls; nil for a door without cages.
function rerolls.cageRewards(occurrence, target)
    if target.cageRewards == nil then return nil end
    local result = {}
    for index, reward in ipairs(target.cageRewards) do result[index] = reward end
    for _, reroll in ipairs(occurrence and occurrence.rerolls or {}) do
        if reroll.target.kind == "cage" and reroll.target.exitKey == target.exitKey then
            result[reroll.target.cageIndex] = reroll.reward
        end
    end
    return result
end

-- A batch door target as it stands after its rerolls.
function rerolls.effectiveTarget(occurrence, target)
    if not rerolls.doorRerolled(occurrence, target.exitKey) then return target end
    local result = {}
    for key, value in pairs(target) do result[key] = value end
    result.reward = rerolls.doorReward(occurrence, target)
    result.cageRewards = rerolls.cageRewards(occurrence, target)
    return result
end

function rerolls.wheelOfferReward(occurrence, wheelKey, offer)
    local reward = offer.reward
    for _, reroll in ipairs(occurrence and occurrence.rerolls or {}) do
        local target = reroll.target
        if target.kind == "wheelOffer" and target.wheelKey == wheelKey and target.offerKey == offer.offerKey then
            reward = reroll.reward
        end
    end
    return reward
end

function rerolls.hubSlotRerolled(hub, slotKey)
    for _, reroll in ipairs(hub and hub.rerolls or {}) do
        if reroll.slotKey == slotKey then return true end
    end
    return false
end

function rerolls.hubSlotReward(hub, slot)
    local reward = slot.reward
    for _, reroll in ipairs(hub and hub.rerolls or {}) do
        if reroll.slotKey == slot.slotKey then reward = reroll.reward end
    end
    return reward
end

local function destinationId(door)
    local room = type(door) == "table" and door.Room or nil
    return type(room) == "table" and room.__runPlannerExecutionRoomId
        or type(door) == "table" and door.__runPlannerExecutionDoorTarget or nil
end

-- The planned presses of `kind` ("door" or "cage") on a native door, in order,
-- with the key that counts them; nil for a door the plan does not publish.
-- Room doors belong to the current occurrence; Hub board doors to the Hub.
function rerolls.doorPresses(current, hub, door, kind)
    local id = destinationId(door)
    if id == nil then return nil end
    if current ~= nil and current.doors ~= nil and current.doors.kind == "batch" then
        for _, target in ipairs(current.doors.targets) do
            if target.room.id == id then
                return pressesOf(current, function(pressed)
                    return pressed.kind == kind and pressed.exitKey == target.exitKey
                end), kind .. "\0" .. current.id .. "\0" .. target.exitKey
            end
        end
    end
    if current == nil and hub ~= nil and kind == "door" then
        for _, slot in ipairs(hub.slots or {}) do
            if slot.room.id == id then
                local presses = {}
                for _, reroll in ipairs(hub.rerolls or {}) do
                    if reroll.slotKey == slot.slotKey then presses[#presses + 1] = reroll end
                end
                return presses, "hub\0" .. slot.slotKey
            end
        end
    end
    return nil
end

function rerolls.wheelPresses(occurrence, wheelKey, offerKey)
    return pressesOf(occurrence, function(target)
        return target.kind == "wheelOffer" and target.wheelKey == wheelKey and target.offerKey == offerKey
    end)
end

-- Counts each target's native presses; the nth press takes the nth planned one.
function rerolls.counter()
    local counts = setmetatable({}, { __mode = "k" })
    return function(owner, key, presses)
        local byKey = counts[owner] or {}
        counts[owner] = byKey
        local ordinal = (byKey[key] or 0) + 1
        byKey[key] = ordinal
        return presses[ordinal], ordinal, #presses
    end
end

return rerolls
