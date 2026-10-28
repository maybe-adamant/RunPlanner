-- Purging Pool menu steering over the native legal trait candidate set.
local poolInventory = {}

local SLOTS = { "left", "middle", "right" }

-- The k-th reroll's unpinned slots keep native rows; a native row a pin displaced is
-- replaced from the remaining candidates.
local function rerolledSelection(entry, nativeRoom, available)
    local pinned, pinnedNames = {}, {}
    for _, slot in ipairs(entry.traits or {}) do
        local option = available[slot.traitKey]
        if option == nil then
            return nil, { checkpoint = "purging-pool-inventory", expected = slot.traitKey, observed = nil }
        end
        pinned[slot.slotKey], pinnedNames[slot.traitKey] = option, true
    end
    local natives, used = {}, {}
    for _, option in ipairs(nativeRoom.SellOptions or {}) do
        if type(option) == "table" and option.Name ~= nil and not pinnedNames[option.Name]
            and available[option.Name] ~= nil then
            natives[#natives + 1] = available[option.Name]
            used[option.Name] = true
        end
    end
    local spare = {}
    for name, option in pairs(available) do
        if not pinnedNames[name] and not used[name] then spare[#spare + 1] = option end
    end
    table.sort(spare, function(left, right) return left.Name < right.Name end)
    local selected = {}
    for _, slotKey in ipairs(SLOTS) do
        local option = pinned[slotKey] or table.remove(natives, 1)
        if option == nil and #spare > 0 then
            option = type(_G.RemoveRandomValue) == "function" and _G.RemoveRandomValue(spare)
                or table.remove(spare, 1)
        end
        if option ~= nil then selected[#selected + 1] = option end
    end
    return selected
end

-- `roll` 0 installs the initial list; k installs the k-th reroll's pinned slots.
function poolInventory.steer(occurrence, nativeRoom, roll)
    local pool = occurrence and occurrence.overview.purgingPool
    if pool == nil or not pool.interacted or type(nativeRoom) ~= "table" then return true end
    local entry = (roll or 0) > 0 and pool.rerolls and pool.rerolls[roll] or nil
    if (roll or 0) > 0 and entry == nil then return true end
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
    local selected = {}
    if entry ~= nil then
        local errorValue
        selected, errorValue = rerolledSelection(entry, nativeRoom, available)
        if selected == nil then return nil, errorValue end
    else
        for _, slot in ipairs(pool.traits or {}) do
            if slot.traitKey ~= nil then
                local option = available[slot.traitKey]
                if option == nil then
                    return nil, { checkpoint = "purging-pool-inventory",
                        expected = slot.traitKey, observed = nil }
                end
                selected[#selected + 1] = option
            end
        end
    end
    -- Preserve the native partition: selected rows are not leftover candidates.
    -- Rerolls may then use the remaining domain without replaying our selection.
    for _, option in ipairs(selected) do available[option.Name] = nil end
    nativeRoom.SellValues = available
    nativeRoom.SellOptions = selected
    return true
end

return poolInventory
