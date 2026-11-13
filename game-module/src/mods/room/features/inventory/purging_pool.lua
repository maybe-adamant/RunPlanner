-- Purging Pool menu steering over the native legal trait candidate set.
local poolInventory = {}

local SLOTS = { "left", "middle", "right" }

-- A plan publishes every shown slot of a list, so the list is exactly its slots in order.
local function plannedSelection(entry, available)
    local bySlot = {}
    for _, slot in ipairs(entry.traits or {}) do
        local option = available[slot.traitKey]
        if option == nil then
            return nil, { checkpoint = "purging-pool-inventory", expected = slot.traitKey, observed = nil }
        end
        bySlot[slot.slotKey] = option
    end
    local selected = {}
    for _, slotKey in ipairs(SLOTS) do
        if bySlot[slotKey] ~= nil then selected[#selected + 1] = bySlot[slotKey] end
    end
    return selected
end

-- The list on show when the Pool opens: the one it regenerates after the fountain
-- use changed a listed boon, else the entry list.
function poolInventory.openingTraits(pool)
    return pool.refreshTraits or pool.traits
end

-- `roll` 0 installs the list on show at the first opening; k installs the k-th reroll's.
function poolInventory.steer(occurrence, nativeRoom, roll)
    local pool = occurrence and occurrence.overview.purgingPool
    if pool == nil or type(nativeRoom) ~= "table" then return true end
    local entry = (roll or 0) == 0 and { traits = poolInventory.openingTraits(pool) }
        or (pool.rerolls and pool.rerolls[roll])
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
    local selected, errorValue = plannedSelection(entry, available)
    if selected == nil then return nil, errorValue end
    -- Preserve the native partition: selected rows are not leftover candidates.
    -- Rerolls may then use the remaining domain without replaying our selection.
    for _, option in ipairs(selected) do available[option.Name] = nil end
    nativeRoom.SellValues = available
    nativeRoom.SellOptions = selected
    return true
end

return poolInventory
