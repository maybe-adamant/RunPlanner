-- Stygian Well inventory and carrier-specific Travel Deal refill construction.
local primitives = type(import) == "function"
    and import("mods/room/features/inventory/primitives.lua")
    or require("mods.room.features.inventory.primitives")
local wellInventory = {}

local function retainOffer(storeData, offer)
    if type(offer) ~= "table" then return false end
    local matched = false
    if storeData.HealingOffers and storeData.HealingOffers.WeightedList then
        local count = primitives.narrowHealingOffer(storeData.HealingOffers, offer)
        -- A non-healing refill must consume no healing carrier.
        storeData.HealingOffers.Amount = count > 0 and 1 or 0
        matched = matched or count > 0
    end
    local wanted = { [offer.offerKey] = true }
    local retained, count = primitives.retainAndCount(storeData.Traits, wanted)
    storeData.Traits = retained
    matched = matched or count > 0
    retained, count = primitives.retainAndCount(storeData.Consumables, wanted)
    storeData.Consumables = retained
    return matched or count > 0
end

function wellInventory.prepareRefill(storeData, args, scope)
    if scope == nil or scope.kind ~= "well" or scope.refill == nil then return nil end
    if scope.slotIndex == nil then
        return nil, { checkpoint = "well-refill-slot", expected = "native store slot", observed = nil }
    end
    local refill = primitives.copy(scope.refill.replacement)
    if not retainOffer(storeData, refill) then
        return nil, { checkpoint = "well-refill-inventory", expected = refill.offerKey, observed = nil }
    end
    storeData.MaxOffers = 1
    local expectedRefill = primitives.copy(refill)
    expectedRefill.slotIndex = scope.slotIndex
    return { kind = "travelDealStygianWell", expected = { expectedRefill },
        args = primitives.withStoreData(args, storeData) }
end

local SLOT_INDEX = { healing = 1, secondLeft = 2, secondRight = 3 }

-- The roll a store fill installs: the initial roll, then the k-th reroll's entry at the k-th native reroll.
local function rollOffers(well, generation)
    if generation == 0 then return well.offers end
    local roll = well.rerolls and well.rerolls[generation]
    return roll and roll.offers
end

-- A reroll excludes one random earlier row; it is steered away from the planned rows.
local function exclusionsWithout(names, planned, extra)
    if type(names) ~= "table" and extra == nil then return names end
    local kept = {}
    for _, name in ipairs(type(names) == "table" and names or {}) do
        if not planned[name] then kept[#kept + 1] = name end
    end
    for name in pairs(extra or {}) do kept[#kept + 1] = name end
    return kept
end

-- `generation` counts the native rerolls before this store fill. A roll pins only some
-- slots: the pinned rows come from one narrowed fill and every other slot from a native
-- filler fill, so a slot bought earlier, which native blanks afterwards, keeps the
-- positions of the slots after it.
function wellInventory.prepare(well, storeData, args, generation)
    if well == nil then return nil end
    local offers = rollOffers(well, generation or 0)
    if offers == nil then return nil end
    local pinned, planned, healing, others = {}, {}, nil, 0
    for _, rawOffer in ipairs(offers) do
        local offer = primitives.copy(rawOffer)
        offer.storeIndex = SLOT_INDEX[offer.generationKey:match(":(.+)$")]
        pinned[#pinned + 1] = offer
        planned[offer.offerKey] = true
        if offer.storeIndex == 1 then healing = offer else others = others + 1 end
    end
    table.sort(pinned, function(left, right) return left.storeIndex < right.storeIndex end)
    if #pinned == 0 then return nil end
    local fillData = #pinned < 3 and primitives.copy(storeData) or nil
    if healing ~= nil then
        local healingMatches = 0
        if storeData.HealingOffers and storeData.HealingOffers.WeightedList then
            healingMatches = primitives.narrowHealingOffer(storeData.HealingOffers, healing)
        end
        if healingMatches == 0 then
            return nil, { checkpoint = "well-inventory", expected = healing.offerKey, observed = nil }
        end
        if fillData and fillData.HealingOffers then fillData.HealingOffers.Amount = 0 end
    elseif storeData.HealingOffers then
        storeData.HealingOffers.Amount = 0
    end
    local wanted = {}
    for _, offer in ipairs(pinned) do
        if offer.storeIndex ~= 1 then wanted[offer.offerKey] = true end
    end
    storeData.Traits = primitives.retain(storeData.Traits, wanted)
    storeData.Consumables = primitives.retain(storeData.Consumables, wanted)
    local prepared = primitives.withStoreData(args, storeData)
    prepared.ExclusionNames = exclusionsWithout(prepared.ExclusionNames, planned)
    local fillArgs
    if fillData ~= nil then
        if storeData.MaxOffers ~= nil then
            storeData.MaxOffers = (healing and 1 or 0) + others
            fillData.MaxOffers = fillData.MaxOffers - #pinned
        end
        fillArgs = primitives.withStoreData(args, fillData)
        fillArgs.ExclusionNames = exclusionsWithout(fillArgs.ExclusionNames, planned, planned)
    end
    return { kind = "well", expected = pinned, args = prepared, fillArgs = fillArgs }
end

-- Places the native filler rows in the slots the roll does not pin, in native order.
function wellInventory.merge(prepared, store, fillStore)
    if prepared == nil or prepared.fillArgs == nil or type(store) ~= "table"
        or type(store.StoreOptions) ~= "table" then return store end
    local options, pinnedSlots = {}, {}
    for index, offer in ipairs(prepared.expected) do
        options[offer.storeIndex] = store.StoreOptions[index]
        pinnedSlots[offer.storeIndex] = true
    end
    local fillers = type(fillStore) == "table" and type(fillStore.StoreOptions) == "table"
        and fillStore.StoreOptions or {}
    local nextFiller = 1
    for slot = 1, 3 do
        if not pinnedSlots[slot] then
            options[slot] = fillers[nextFiller]
            nextFiller = nextFiller + 1
        end
    end
    store.StoreOptions = options
    return store
end

return wellInventory
