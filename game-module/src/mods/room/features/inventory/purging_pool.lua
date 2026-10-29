-- Purging Pool menu steering over the native legal trait candidate set.
local poolInventory = {}

local SLOTS = { "left", "middle", "right" }

-- A list keeps the native row count, or reaches its last pinned slot. Unpinned slots
-- keep native rows in order; a native row a pin displaced is replaced from the
-- remaining candidates.
local function pinnedSelection(entry, nativeRoom, available)
    local pinned, pinnedNames, lastPinned = {}, {}, 0
    for _, slot in ipairs(entry.traits or {}) do
        local option = available[slot.traitKey]
        if option == nil then
            return nil, { checkpoint = "purging-pool-inventory", expected = slot.traitKey, observed = nil }
        end
        pinned[slot.slotKey], pinnedNames[slot.traitKey] = option, true
        for index, slotKey in ipairs(SLOTS) do
            if slotKey == slot.slotKey and index > lastPinned then lastPinned = index end
        end
    end
    -- A sale leaves a hole in the native list.
    local indexes = {}
    for index, option in pairs(nativeRoom.SellOptions or {}) do
        if type(index) == "number" and type(option) == "table" and option.Name ~= nil then
            indexes[#indexes + 1] = index
        end
    end
    table.sort(indexes)
    local natives, used = {}, {}
    for _, index in ipairs(indexes) do
        local name = nativeRoom.SellOptions[index].Name
        if not pinnedNames[name] and available[name] ~= nil then
            natives[#natives + 1] = available[name]
            used[name] = true
        end
    end
    local spare = {}
    for name, option in pairs(available) do
        if not pinnedNames[name] and not used[name] then spare[#spare + 1] = option end
    end
    table.sort(spare, function(left, right) return left.Name < right.Name end)
    local selected = {}
    for index = 1, math.max(#indexes, lastPinned) do
        local option = pinned[SLOTS[index]] or table.remove(natives, 1)
        if option == nil and #spare > 0 then
            option = type(_G.RemoveRandomValue) == "function" and _G.RemoveRandomValue(spare)
                or table.remove(spare, 1)
        end
        if option ~= nil then selected[#selected + 1] = option end
    end
    return selected
end

-- `roll` 0 installs the initial list's pinned slots; k installs the k-th reroll's.
function poolInventory.steer(occurrence, nativeRoom, roll)
    local pool = occurrence and occurrence.overview.purgingPool
    if pool == nil or type(nativeRoom) ~= "table" then return true end
    local entry = (roll or 0) == 0 and pool or (pool.rerolls and pool.rerolls[roll])
    if entry == nil or #(entry.traits or {}) == 0 then return true end
    if type(nativeRoom.SellValues) ~= "table" then
        return nil, { checkpoint = "purging-pool-inventory", expected = "native SellValues", observed = nil }
    end
    local available = {}
    for key, option in pairs(nativeRoom.SellValues) do available[key] = option end
    -- GenerateSellTraitShop removes random selections from SellValues after
    -- placing them in SellOptions. Together they are one legal candidate set.
    for _, option in pairs(nativeRoom.SellOptions or {}) do
        if type(option) == "table" and option.Name ~= nil and available[option.Name] == nil then
            available[option.Name] = option
        end
    end
    local selected, errorValue = pinnedSelection(entry, nativeRoom, available)
    if selected == nil then return nil, errorValue end
    -- Preserve the native partition: selected rows are not leftover candidates.
    -- Rerolls may then use the remaining domain without replaying our selection.
    for _, option in ipairs(selected) do available[option.Name] = nil end
    nativeRoom.SellValues = available
    nativeRoom.SellOptions = selected
    return true
end

return poolInventory
